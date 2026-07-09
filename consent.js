/* Cookie consent + gated Google Analytics.
   GA (and its cookies) load ONLY after the visitor accepts. */
(function () {
  var GA_ID = 'G-M4XFWZEZKQ';
  var KEY = 'cp-consent';

  function loadGA() {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  }

  var choice;
  try { choice = localStorage.getItem(KEY); } catch (e) { choice = null; }
  if (choice === 'granted') { loadGA(); return; }
  if (choice === 'denied') { return; }

  function inject() {
    if (document.getElementById('cookiebar')) return;
    var css = document.createElement('style');
    css.textContent =
      '#cookiebar{position:fixed;left:0;right:0;bottom:0;z-index:70;display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center;justify-content:center;' +
      'padding:14px 20px calc(14px + env(safe-area-inset-bottom));background:rgba(9,9,18,.975);border-top:1px solid rgba(201,163,74,.3);' +
      '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-family:"Cormorant Garamond",Georgia,serif;font-size:15px;color:#d9cfb8;box-shadow:0 -8px 30px rgba(0,0,0,.4)}' +
      '#cookiebar span.cb-txt{max-width:560px;line-height:1.45;text-align:center}' +
      '#cookiebar a{color:#e2c47f;text-decoration:none;border-bottom:1px solid rgba(201,163,74,.4)}' +
      '#cookiebar .cb-btns{display:flex;gap:10px;flex:none}' +
      '#cookiebar button{font-family:"Cinzel",serif;font-size:11.5px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border-radius:22px;padding:9px 20px;transition:.2s}' +
      '#cookiebar #cb-decline{border:1px solid rgba(201,163,74,.45);background:transparent;color:#e2c47f}' +
      '#cookiebar #cb-decline:hover{border-color:#c9a24e;color:#f3ead2}' +
      '#cookiebar #cb-accept{border:0;background:linear-gradient(180deg,#e2c47f,#c9a24e);color:#211c12}' +
      '#cookiebar #cb-accept:hover{filter:brightness(1.06)}';
    document.head.appendChild(css);

    var bar = document.createElement('div');
    bar.id = 'cookiebar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.innerHTML =
      '<span class="cb-txt">The temple uses a few cookies for anonymous analytics, to understand how visitors find their way here. See our <a href="/privacy">Privacy Policy</a>.</span>' +
      '<span class="cb-btns"><button id="cb-decline">Decline</button><button id="cb-accept">Accept</button></span>';
    document.body.appendChild(bar);

    function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} bar.remove(); }
    document.getElementById('cb-accept').onclick = function () { set('granted'); loadGA(); };
    document.getElementById('cb-decline').onclick = function () { set('denied'); };
  }

  if (document.body) inject();
  else window.addEventListener('DOMContentLoaded', inject);
})();
