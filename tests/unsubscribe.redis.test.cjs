// Real Redis/Lua integration through a local Upstash-shaped HTTP adapter.
// No cloud credentials, customer addresses, email delivery or production writes.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const http=require('node:http');
const net=require('node:net');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {once}=require('node:events');
const exec=promisify(execFile);
const keys=['cp:subscribers','cp:sub:token','cp:sub:date'];
const email='reader@example.test',token='good-token';
const delay=ms=>new Promise(r=>setTimeout(r,ms));

test('unsubscribe with real Redis and the real REST helper', {timeout:30000}, async t=>{
  const probe=net.createServer();
  await new Promise(r=>probe.listen(0,'127.0.0.1',r));
  const port=probe.address().port;
  await new Promise(r=>probe.close(r));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'unsubscribe-redis-'));
  const redis=spawn(process.env.REDIS_SERVER||'redis-server',[
    '--bind','127.0.0.1','--port',String(port),'--save','','--appendonly','no',
    '--dir',dir,'--loglevel','warning'
  ],{stdio:['ignore','pipe','pipe']});
  let startupError,logs='';
  redis.on('error',e=>{startupError=e;});
  redis.stdout.on('data',b=>{logs+=b;});
  redis.stderr.on('data',b=>{logs+=b;});
  let server;
  t.after(async()=>{
    if(server?.listening)await new Promise(r=>server.close(r));
    if(redis.pid&&redis.exitCode===null){const closed=once(redis,'close');redis.kill('SIGTERM');await closed;}
    fs.rmSync(dir,{recursive:true,force:true});
  });
  const command=async args=>{
    const {stdout}=await exec(process.env.REDIS_CLI||'redis-cli',[
      '-h','127.0.0.1','-p',String(port),'--json',...args.map(String)
    ]);
    if(stdout.startsWith('error:'))throw Error(stdout.trim());
    return JSON.parse(stdout);
  };
  let ready=false;
  for(let i=0;i<100;i++){
    if(startupError)throw startupError;
    try{ready=(await command(['PING']))==='PONG';if(ready)break;}catch{}
    await delay(25);
  }
  assert(ready,`Isolated Redis did not start: ${logs}`);

  let fault=null,afterLookup=null,loseEvalReply=false;
  server=http.createServer(async(req,res)=>{
    try{
      assert.equal(req.method,'POST');
      assert.equal(req.headers.authorization,'Bearer local-test-only');
      let body='';for await(const chunk of req)body+=chunk;
      const cmd=JSON.parse(body);
      if(fault){const f=fault;fault=null;res.writeHead(f.status||200,{'Content-Type':'application/json'});res.end(f.body);return;}
      const result=await command(cmd);
      if(cmd[0]==='EVAL'&&loseEvalReply){
        res.writeHead(503);res.end('Reply lost after commit');return;
      }
      // Deterministically rotate the stored token between the pre-check and EVAL.
      if(cmd[0]==='HGET'&&afterLookup){const fn=afterLookup;afterLookup=null;await fn();}
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({result}));
    }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const kvModule={exports:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../api/_kv.js'),'utf8'),{
    module:kvModule,fetch,URL,process:{env:{
      KV_REST_API_URL:`http://127.0.0.1:${server.address().port}`,
      KV_REST_API_TOKEN:'local-test-only'
    }}
  });
  const handlerModule={exports:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../api/unsubscribe.js'),'utf8'),{
    module:handlerModule,URL,require(name){
      if(name==='./_kv')return kvModule.exports;
      if(name==='crypto'||name==='buffer')return require('node:'+name);
      throw Error(name);
    }
  });
  const request=async(provided=token)=>{
    const out={headers:{}};
    await handlerModule.exports({method:'GET',query:{e:email,t:provided}}, {
      setHeader(k,v){out.headers[k]=v;},status(s){out.status=s;return this;},end(body){out.body=body;}
    });
    assert.equal(out.headers['Cache-Control'],'no-store');
    return out;
  };
  const seed=async()=>{
    fault=null;afterLookup=null;loseEvalReply=false;
    await command(['DEL',...keys]);
    await command(['SADD',keys[0],email,'other@example.test']);
    await command(['HSET',keys[1],email,token,'other@example.test','other-token']);
    await command(['HSET',keys[2],email,'2026-11-10','other@example.test','2026-11-09']);
  };
  const intact=async(saved=token)=>{
    assert.equal(await command(['SISMEMBER',keys[0],email]),1);
    assert.equal(await command(['HGET',keys[1],email]),saved);
  };
  const noConfirmation=r=>assert.doesNotMatch(r.body,/Until we meet again|Already at rest|Nothing more to do/i);

  await t.test('valid token removes all three records and preserves the other subscriber',async()=>{
    await seed();const r=await request();assert.equal(r.status,200);
    assert.equal(await command(['SISMEMBER',keys[0],email]),0);
    assert.equal(await command(['HGET',keys[1],email]),null);
    assert.equal(await command(['HGET',keys[2],email]),null);
    assert.equal(await command(['SISMEMBER',keys[0],'other@example.test']),1);
    assert.equal(await command(['HGET',keys[1],'other@example.test']),'other-token');
    assert.equal(await command(['HGET',keys[2],'other@example.test']),'2026-11-09');
  });
  await t.test('wrong token leaves active membership intact without a success page',async()=>{
    await seed();const r=await request('wrong-token');assert.equal(r.status,400);noConfirmation(r);await intact();
  });
  await t.test('missing token does not hide orphaned active membership',async()=>{
    await seed();await command(['HDEL',keys[1],email]);
    const r=await request();assert.equal(r.status,400);noConfirmation(r);await intact(null);
  });
  await t.test('token rotation between HGET and EVAL preserves the new subscription',async()=>{
    await seed();afterLookup=()=>command(['HSET',keys[1],email,'new-token']);
    const r=await request();assert.equal(r.status,400);noConfirmation(r);await intact('new-token');
  });
  await t.test('concurrent duplicate requests only confirm the successful EVAL',async()=>{
    await seed();const results=await Promise.all([request(),request()]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
    noConfirmation(results.find(r=>r.status===400));
    assert.equal(await command(['SISMEMBER',keys[0],email]),0);
    assert.equal(await command(['HGET',keys[1],email]),null);
    assert.equal(await command(['HGET',keys[2],email]),null);
  });
  await t.test('wrong-type date record fails before any membership or token deletion',async()=>{
    await seed();await command(['DEL',keys[2]]);await command(['SET',keys[2],'corrupt']);
    const r=await request();assert.equal(r.status,503);noConfirmation(r);await intact();
    assert.equal(await command(['GET',keys[2]]),'corrupt');
  });
  await t.test('HTTP errors, Redis error envelopes and malformed JSON fail closed',async()=>{
    for(const response of [
      {status:503,body:'unavailable'},
      {body:JSON.stringify({error:'ERR storage unavailable'})},
      {body:'not JSON'},
      {body:'{}'}
    ]){
      await seed();fault=response;
      const r=await request();assert.equal(r.status,503);noConfirmation(r);await intact();
    }
  });
  await t.test('missing EVAL result cannot be treated as an already-used link',async()=>{
    await seed();afterLookup=async()=>{fault={body:'{}'};};
    const r=await request();assert.equal(r.status,503);noConfirmation(r);await intact();
  });
  await t.test('lost reply after a committed removal reports uncertainty, never false success',async()=>{
    await seed();loseEvalReply=true;
    const r=await request();assert.equal(r.status,503);noConfirmation(r);
    assert.match(r.body,/not confirm/i);
    assert.doesNotMatch(r.body,/not<\/strong> completed/i);
    assert.equal(await command(['SISMEMBER',keys[0],email]),0);
    assert.equal(await command(['HGET',keys[1],email]),null);
    assert.equal(await command(['HGET',keys[2],email]),null);
  });
});
