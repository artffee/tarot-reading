/* Progressive enhancement: the full gallery and all interpretations work without JS. */
(function(){
  document.querySelectorAll('.art img').forEach(img=>{
    function failed(){img.hidden=true;const label=img.parentElement.querySelector('.art-error');if(label)label.hidden=false;}
    img.addEventListener('error',failed);if(img.complete&&img.naturalWidth===0)failed();
  });
  const search=document.getElementById('cardSearch');if(!search)return;
  const cards=Array.from(document.querySelectorAll('.gallery-card'));
  const buttons=Array.from(document.querySelectorAll('[data-filter]'));let group='All';
  function filter(){const query=search.value.trim().toLowerCase();let n=0;cards.forEach(card=>{const show=(group==='All'||card.dataset.group===group)&&card.dataset.search.includes(query);card.hidden=!show;if(show)n++;});document.getElementById('resultCount').textContent=n+' '+(n===1?'card':'cards');document.getElementById('noResults').hidden=n!==0;}
  buttons.forEach(button=>button.addEventListener('click',()=>{group=button.dataset.filter;buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filter();}));search.addEventListener('input',filter);
})();
