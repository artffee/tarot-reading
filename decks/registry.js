/* Shared, buildless deck registry. Deck data contains content; the reader owns state. */
(function(global){
  'use strict';
  const decks=new Map();
  function slug(value){return String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
  function register(spec){
    if(!spec||!spec.id||!spec.name||!spec.gallery||!spec.back||!Array.isArray(spec.cards)||!spec.cards.length)throw new TypeError('A deck needs identity, routes, a back, and cards.');
    if(decks.has(spec.id))throw new Error('Duplicate deck: '+spec.id);
    const ids=new Set();
    const cards=spec.cards.map((c,i)=>{
      const n=Number.isInteger(c.n)?c.n:i;
      const id=c.id||String(n).padStart(2,'0')+'-'+slug(c.name);
      if(!c.name||!c.up||!c.rev||!Array.isArray(c.aff)||!c.aff.length||ids.has(id))throw new TypeError('Incomplete or duplicate card: '+id);
      ids.add(id);
      return Object.freeze({...c,n,id,deckId:spec.id,rn:c.rn||String(n),aff:Object.freeze(c.aff.slice()),keywords:Object.freeze((c.keywords||[]).slice()),image:c.image||'/cards/'+String(n).padStart(2,'0')+'.webp',url:spec.gallery+'/'+id,alt:c.alt||c.name+' — '+spec.name});
    });
    const deck=Object.freeze({...spec,shortName:spec.shortName||spec.name,ready:spec.ready!==false,cards:Object.freeze(cards)});
    decks.set(spec.id,deck);return deck;
  }
  function get(id){return decks.get(id);}
  function list(){return Array.from(decks.values()).sort((a,b)=>(a.order||0)-(b.order||0));}
  function draw(id,count,random=Math.random){
    const deck=get(id);if(!deck||!deck.ready)throw new RangeError('Deck unavailable.');
    if(!Number.isInteger(count)||count<1||count>deck.cards.length)throw new RangeError('Invalid draw count.');
    const cards=deck.cards.slice();
    for(let i=cards.length-1;i>0;i--){const r=random();if(r<0||r>=1||!Number.isFinite(r))throw new RangeError('Invalid random source.');const j=Math.floor(r*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
    return cards.slice(0,count);
  }
  global.CardDecks=Object.freeze({register,get,list,draw});
})(window);
