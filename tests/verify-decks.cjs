/* Contract + DOM integration checks. Native browser visual QA is a separate step. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),cp=require('node:child_process');
const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..'),read=p=>{let s=fs.readFileSync(path.join(root,p),'utf8');if(p==='decks/gothic/cards.js'&&process.argv.includes('--source-only'))s=s.replace('"ready":false','"ready":true');return s;},hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const args=new Set(process.argv.slice(2));
const box={window:{}};vm.createContext(box);vm.runInContext(read('decks/registry.js'),box);box.CardDecks=box.window.CardDecks;vm.runInContext(read('decks/gothic/cards.js'),box);
const registry=box.window.CardDecks,deck=registry.get('nocturne-gothic'),cards=deck.cards;
assert.equal(cards.length,78);assert.equal(cards.filter(c=>c.arcana==='Major').length,22);
for(const suit of ['Wands','Cups','Swords','Pentacles'])assert.equal(cards.filter(c=>c.suit===suit).length,14);
assert.equal(new Set(cards.map(c=>c.id)).size,78);assert.equal(new Set(cards.map(c=>c.up)).size,78);assert.equal(new Set(cards.map(c=>c.rev)).size,78);
for(const c of cards){assert(c.up.length>90&&c.rev.length>90);assert(c.symbolism.length>70&&c.question.endsWith('?'));assert(c.aff.length&&c.keywords.length===3);assert.equal(c.image,'/cards/gothic/'+c.id+'.webp');assert(read('decks/gothic/'+c.id+'.html').includes(c.name));}
// New themes need only register content: the first card may be numbered zero.
const future=registry.register({id:'future',name:'Future Theme',gallery:'/future',back:'/future/back.webp',cards:[{n:0,name:'A Beginning',up:'One',rev:'Two',aff:['Three']}]});assert.equal(future.cards[0].n,0);assert.equal(registry.draw('future',1)[0].n,0);assert.throws(()=>registry.draw('future',2));assert.throws(()=>registry.register(future));assert(Object.isFrozen(future.cards));
const fixture=JSON.parse(read('tests/original-assets.json'));for(const [p,want] of Object.entries(fixture.files))assert.equal(hash(p),want,'Original file changed: '+p);
const current=read('index.html');for(const [label,re] of Object.entries({CARDS:/const CARDS=\[[\s\S]*?\n\];/,EXTRA:/const EXTRA=\{[\s\S]*?\n\};/})){const match=current.match(re);assert(match,label);assert.equal(crypto.createHash('sha256').update(match[0]).digest('hex'),fixture[label],label+' changed');}
const sitemap=read('sitemap.xml');for(const c of cards)assert.equal(sitemap.split('https://www.thecatpriestess.com/decks/gothic/'+c.id+'</loc>').length,2);
assert(current.includes('id="deckSelect"'));assert(read('deck/index.html').includes('/deck/print.html'));assert(read('sw.js').includes("'/decks/registry.js'"));
if(!args.has('--source-only')){
 assert(deck.ready,'The published collection must be ready.');
 const assets=[...cards.map(c=>c.image.slice(1)),deck.back.slice(1)],hashes=new Set(assets.map(hash));assert.equal(hashes.size,79,'Artwork must be unique, including back.');
 const metadata=JSON.parse(read('docs/gothic-artwork.json'));assert.equal(metadata.assets.length,79);assert(metadata.assets.every(a=>a.status==='finished'));
 for(const a of metadata.assets){assert.equal(hash(a.path),a.sha256);assert(a.width>=896&&a.height>=1344);assert.equal(a.width*3,a.height*2);}
 cp.execFileSync('python3',['-c',"from PIL import Image; import pathlib; files=list(pathlib.Path('cards/gothic').glob('*.webp')); assert len(files)==79; [(Image.open(p).load()) for p in files]; print('79 WebP images decoded successfully')"],{cwd:root,stdio:'inherit'});
}
class Resources extends ResourceLoader{fetch(url){const u=new URL(url);if(u.host!=='www.thecatpriestess.com')return null;let p=path.join(root,decodeURIComponent(u.pathname));if(fs.existsSync(p)&&fs.statSync(p).isFile())return Promise.resolve(p.endsWith('/decks/gothic/cards.js')?Buffer.from(read('decks/gothic/cards.js')):fs.readFileSync(p));return null;}}
async function open(file='index.html',query=''){
 const errors=[],requests=[],shared=[],images=[],rotations=[];const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(read(file),{url:'https://www.thecatpriestess.com/'+query,runScripts:'dangerously',resources:new Resources(),pretendToBeVisual:true,virtualConsole:console,beforeParse(w){
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.fetch=async(url,init)=>{requests.push({url,init});return {ok:true,json:async()=>({total:0,target:10000,reply:'A test reply from Bastet.'})};};
 w.navigator.share=async p=>shared.push(p);w.navigator.canShare=()=>false;
 w.Image=class{constructor(){this.width=896;this.height=1344;}set src(src){this._src=src;images.push(src);w.setTimeout(()=>{if(fs.existsSync(path.join(root,src.replace(/^\//,''))))this.onload?.();else this.onerror?.();},0);}get src(){return this._src;}};
 const gradient={addColorStop(){}};const context={createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,fillRect(){},fillText(){},beginPath(){},moveTo(){},arcTo(){},closePath(){},clip(){},save(){},restore(){},drawImage(){},stroke(){},translate(){},rotate:a=>rotations.push(a),measureText:t=>({width:t.length*9})};w.HTMLCanvasElement.prototype.getContext=()=>context;w.HTMLCanvasElement.prototype.toBlob=function(fn){fn(new w.Blob(['image'],{type:'image/png'}));};
 }});await new Promise(resolve=>dom.window.addEventListener('load',()=>setTimeout(resolve,25),{once:true}));assert.equal(errors.length,0,errors.map(e=>e.message).join('\n'));return {dom,w:dom.window,d:dom.window.document,errors,requests,shared,images,rotations};
}
(async()=>{
 for(const id of ['ivosart-oracle',...(deck.ready?['nocturne-gothic']:[])]){
  const env=await open('index.html','?deck='+id);const {w,d}=env;assert.equal(d.getElementById('deckSelect').value,id);
  for(let i=0;i<1000;i++){const drawn=w.CardDecks.draw(id,5);assert.equal(new Set(drawn.map(c=>c.id)).size,5);assert(drawn.every(c=>c.deckId===id));}
  for(const [key,count] of [['daily',1],['three',3],['journey',5]]){
   d.querySelector('[data-key="'+key+'"]').click();d.getElementById('question').value='<img src=x onerror=alert(1)>';w.startReading(true);
   const r=w.__reading;assert.equal(r.deckId,id);assert.equal(r.items.length,count);assert.equal(d.querySelectorAll('#slots .card').length,count);assert.equal(d.querySelectorAll('#reading img').length,0);assert(!d.getElementById('reading').textContent.includes('undefined'));
   for(const [i,slot] of Array.from(d.querySelectorAll('#slots .slot')).entries()){assert.equal(slot.querySelector('.mname a').getAttribute('href'),r.items[i].card.url);assert.equal(slot.querySelector('.front img').getAttribute('src'),r.items[i].card.image);assert.equal(slot.querySelector('.back img').getAttribute('src'),w.CardDecks.get(id).back);assert.equal(slot.querySelector('.mtext').textContent,r.items[i].rev?r.items[i].card.rev:r.items[i].card.up);assert.equal(slot.querySelector('.card').getAttribute('aria-pressed'),'true');}
   d.getElementById('againBtn').click();assert.equal(w.__reading,null);assert.equal(d.getElementById('deckSelect').value,id);
  }
  const toggle=d.getElementById('revToggle');toggle.dispatchEvent(new w.KeyboardEvent('keydown',{key:' ',bubbles:true}));assert.equal(toggle.getAttribute('aria-checked'),'true');
  w.Math.random=()=>.1;w.startReading(true);assert(w.__reading.items.every(it=>it.rev));for(const it of w.__reading.items)assert(d.getElementById('reading').textContent.includes(it.card.rev)||id==='ivosart-oracle');
  await w.shareReading();assert.equal(env.shared.length,1);assert(env.shared[0].url.includes('deck='+id));assert(env.shared[0].text.includes(w.CardDecks.get(id).name));assert(env.shared[0].text.includes('(reversed)'));assert(env.images.some(src=>src===w.__reading.items[0].card.image));if(id==='nocturne-gothic')assert(env.rotations.length>0);
  if(id==='nocturne-gothic'){const face=d.querySelector('#slots .front');face.querySelector('img').dispatchEvent(new w.Event('error'));assert.equal(face.querySelector('img'),null);assert(face.querySelector('.art-failure').textContent.includes('Illustration unavailable'));}
  d.getElementById('againBtn').click();w.startReading(false);const first=d.querySelector('#slots .card');assert.equal(first.getAttribute('aria-pressed'),'false');assert(d.querySelector('#slots .meaning').hidden);first.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(first.getAttribute('aria-pressed'),'true');d.getElementById('revealAllBtn').click();assert(!d.getElementById('reading').hidden);assert(Array.from(d.querySelectorAll('#slots .meaning')).every(m=>!m.hidden));
  d.getElementById('bastetInput').value='How can I meet this moment?';d.getElementById('bastetForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,15));assert(env.requests.some(r=>r.url==='/api/bastet'));assert(d.getElementById('bastetMsgs').textContent.includes('A test reply from Bastet.'));
  d.getElementById('navNew').click();assert.equal(w.__reading,null);assert(!d.getElementById('table').classList.contains('show'));env.dom.window.close();
 }
 const fallback=await open('index.html','?deck=missing');assert.equal(fallback.d.getElementById('deckSelect').value,'ivosart-oracle');fallback.dom.window.close();
 if(deck.ready){const switcher=await open();const {w,d}=switcher;const select=d.getElementById('deckSelect');select.value='nocturne-gothic';select.dispatchEvent(new w.Event('change'));w.startReading(true);assert.equal(w.__reading.deckId,'nocturne-gothic');d.getElementById('againBtn').click();select.value='ivosart-oracle';select.dispatchEvent(new w.Event('change'));w.startReading(true);assert.equal(w.__reading.deckId,'ivosart-oracle');w.close();}
 const gallery=await open('decks/gothic/index.html');const {w,d}=gallery;const visible=()=>d.querySelectorAll('.gallery-card:not([hidden])').length;assert.equal(visible(),78);d.querySelector('[data-filter="Major"]').click();assert.equal(visible(),22);d.querySelector('[data-filter="Cups"]').click();assert.equal(visible(),14);d.querySelector('[data-filter="All"]').click();const search=d.getElementById('cardSearch');search.value='the moon';search.dispatchEvent(new w.Event('input'));assert.equal(visible(),1);search.value='no-such-card';search.dispatchEvent(new w.Event('input'));assert.equal(visible(),0);assert.equal(d.getElementById('noResults').hidden,false);search.value='';search.dispatchEvent(new w.Event('input'));assert.equal(visible(),78);w.close();
 console.log('Deck checks passed: 78 unique cards, original assets preserved, registry contracts, draw uniqueness, reading modes, reversal/keyboard/share/Bastet flows, switching, and gallery filtering.');
})().catch(error=>{console.error(error);process.exitCode=1;});
