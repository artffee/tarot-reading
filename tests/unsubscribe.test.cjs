const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../api/unsubscribe.js'),'utf8');

function api({ready=true, saved='good-token', evalResult=1, error=false, sequence}={}){
  const calls=[];
  const module={exports:{}};
  let step=0;
  vm.runInNewContext(source,{
    module,
    require(name){
      if(name==='crypto')return require('node:crypto');
      if(name==='buffer')return require('node:buffer');
      if(name==='./_kv')return{
        kvReady:()=>ready,
        kv:async (cmd)=>{
          calls.push(cmd);
          if(error)throw Error('private failure');
          if(sequence){
            const next=sequence[step++];
            if(next && next.throw)throw Error(next.throw);
            return next ? next.result : null;
          }
          if(cmd[0]==='HGET')return saved;
          if(cmd[0]==='EVAL')return evalResult;
          return null;
        }
      };
      throw Error(name);
    }
  });
  return {
    calls,
    async request(query={e:'reader@example.test',t:'good-token'}){
      const out={status:0,body:''};
      const res={
        setHeader(){},
        status(c){out.status=c;return this;},
        end(html){out.body=String(html||'');return this;}
      };
      await module.exports({method:'GET',query,url:'/api/unsubscribe?e='+encodeURIComponent(query.e||'')+'&t='+encodeURIComponent(query.t||''),headers:{}},res);
      return out;
    }
  };
}

test('incomplete links stay 400 and never touch storage',async()=>{
  const h=api();
  for(const q of [{e:'',t:'x'},{e:'a@b.c',t:''},{e:'',t:''}]){
    const r=await h.request(q);
    assert.equal(r.status,400);
    assert.match(r.body,/went astray/i);
  }
  assert.equal(h.calls.length,0);
});

test('storage outage cannot claim a successful unsubscribe',async()=>{
  const r=await api({ready:false}).request();
  assert.equal(r.status,503);
  assert.match(r.body,/not<\/strong> completed|not completed/i);
  assert.doesNotMatch(r.body,/wish is honoured|Until we meet again/i);
});

test('failed delete cannot claim a successful unsubscribe',async()=>{
  const r=await api({error:true}).request();
  assert.equal(r.status,503);
  assert.match(r.body,/not<\/strong> completed|ledger is briefly closed/i);
  assert.doesNotMatch(r.body,/Until we meet again/i);
});

test('wrong token is already-at-rest without a destructive EVAL',async()=>{
  const h=api({saved:'other-token'});
  const r=await h.request({e:'reader@example.test',t:'good-token'});
  assert.equal(r.status,200);
  assert.match(r.body,/Already at rest/i);
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0][0],'HGET');
  assert.ok(!h.calls.some(c=>c[0]==='EVAL'));
});

test('confirmed removal uses one atomic EVAL and tells the truth',async()=>{
  const h=api({saved:'good-token',evalResult:1});
  const r=await h.request({e:'reader@example.test',t:'good-token'});
  assert.equal(r.status,200);
  assert.match(r.body,/Until we meet again/i);
  assert.equal(h.calls.length,2);
  assert.equal(h.calls[0][0],'HGET');
  assert.equal(h.calls[1][0],'EVAL');
  assert.equal(h.calls[1][2],'3');
  assert.equal(h.calls[1][3],'cp:subscribers');
  assert.equal(h.calls[1][4],'cp:sub:token');
  assert.equal(h.calls[1][5],'cp:sub:date');
  assert.equal(h.calls[1][6],'reader@example.test');
  assert.equal(h.calls[1][7],'good-token');
});

test('EVAL race that removes nothing stays already-at-rest',async()=>{
  const r=await api({saved:'good-token',evalResult:0}).request();
  assert.equal(r.status,200);
  assert.match(r.body,/Already at rest/i);
  assert.doesNotMatch(r.body,/Until we meet again/i);
});

test('EVAL failure after a valid token lookup is unavailable, not success',async()=>{
  const r=await api({sequence:[{result:'good-token'},{throw:'boom'}]}).request();
  assert.equal(r.status,503);
  assert.match(r.body,/not<\/strong> completed|ledger is briefly closed/i);
});
