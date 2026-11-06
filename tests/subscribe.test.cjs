const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('../api/subscribe.js'),'utf8');
function api({ready=true,result=[1,150,'unsubscribe-token'],error=false,mail=false}={}){
 const calls=[];const module={exports:{}};
 vm.runInNewContext(source,{module,require(name){if(name==='crypto')return require('node:crypto');if(name==='./_kv')return {kvReady:()=>ready,originOk:()=>true,clientIp:()=> 'test',rateLimit:async()=>({ok:true}),kv:async c=>{calls.push(c);if(error)throw Error('private failure');return result;}};if(name==='./_mail')return {mailReady:()=>mail,sendMail:async()=>{throw Error('mail unavailable');},unsubUrl:()=> 'https://example.test/unsubscribe'};throw Error(name);}});
 return {calls,async request(){const out={};const res={setHeader(){},status(c){out.code=c;return this;},json(d){out.body=d;return this;}};await module.exports({method:'POST',body:{email:'synthetic@example.test'},headers:{}},res);return out;}};
}
test('missing or failing storage cannot confirm signup',async()=>{for(const opts of [{ready:false},{error:true},{result:null},{result:[1,10,null]}]){const r=await api(opts).request();assert.equal(r.code,503);assert.equal(r.body.stored,false);assert.equal(r.body.ok,false);}});
test('confirmed new and duplicate results use server totals and one atomic operation',async()=>{for(const added of [0,1]){const h=api({result:[added,150,'token']});const r=await h.request();assert.equal(r.code,200);assert.equal(r.body.stored,true);assert.equal(r.body.minted,added?50:0);assert.equal(r.body.total,150);assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'EVAL');}});
test('mail failure cannot erase an accepted signup',async()=>{const r=await api({mail:true}).request();assert.equal(r.body.stored,true);assert.equal(r.body.welcomed,false);});

async function client(reply){
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const dom=new JSDOM(html,{url:'https://www.thecatpriestess.com/',runScripts:'outside-only'});const w=dom.window;const effects=[];
 w.$=id=>w.document.getElementById(id);w.fetch=async()=>({ok:true,json:async()=>reply});w.gtag=(...x)=>effects.push(['event',...x]);w.jarAdd=n=>effects.push(['bonus',n]);w.paintYou=()=>{};w.paintBowl=n=>effects.push(['total',n]);w.shownTotal=999;
 const start=html.indexOf('  /* email subscribe');const end=html.indexOf('  /* post-reading',start);assert.ok(start>0&&end>start);w.eval(html.slice(start,end));
 const input=w.document.getElementById('subEmail');input.value='synthetic@example.test';w.document.getElementById('subForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));
 return {dom,w,input,effects};
}
test('client preserves email and avoids conversion or reward when storage is unconfirmed',async()=>{const c=await client({ok:true,stored:false,isNew:true,minted:0});assert.equal(c.input.value,'synthetic@example.test');assert.equal(c.w.localStorage.getItem('cp-subscribed'),null);assert.equal(c.effects.length,0);c.dom.window.close();});
test('client uses confirmed reward and total instead of inventing fifty',async()=>{const c=await client({ok:true,stored:true,isNew:true,minted:7,total:107});assert.equal(c.input.value,'');assert.equal(c.w.localStorage.getItem('cp-subscribed'),'1');assert.ok(c.effects.some(x=>x[0]==='bonus'&&x[1]===7));assert.ok(c.effects.some(x=>x[0]==='total'&&x[1]===107));assert.equal(c.effects.filter(x=>x[0]==='event').length,1);c.dom.window.close();});
