// Unsubscribe endpoint — reached from the link in every newsletter.
//   GET /api/unsubscribe?e=<email>&t=<token>
// Verifies the per-address token, removes the email from the list, and returns a
// small styled confirmation page in the temple's voice.

const { kv, kvReady } = require('./_kv');

const SET_KEY   = 'cp:subscribers';
const DATE_KEY  = 'cp:sub:date';
const TOKEN_KEY = 'cp:sub:token';

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — The Cat Priestess</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Cormorant+Garamond:ital@0;1&display=swap');
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font-family:"Cormorant Garamond",Georgia,serif;color:#d9cfb8;text-align:center;
 background:radial-gradient(90% 60% at 80% 4%,#20233f,rgba(0,0,0,0) 45%),linear-gradient(180deg,#0d0e1c,#07070e);
 background-color:#07070e;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:28px}
.card{max-width:460px;padding:40px 34px;border:1px solid rgba(201,163,74,.3);border-radius:18px;
 background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.014));box-shadow:0 16px 48px rgba(0,0,0,.45)}
h1{font-family:"Cinzel",serif;font-weight:700;letter-spacing:2px;font-size:26px;color:#f3ead2;margin:0 0 14px}
p{font-size:18px;line-height:1.6;margin:0 0 10px}
a{color:#e2c47f;text-decoration:none;border-bottom:1px solid rgba(201,163,74,.4)}
.orn{font-size:22px;color:#e2c47f;margin-bottom:12px}
</style></head><body><div class="card"><div class="orn">&#10022;</div>${body}
<p style="margin-top:20px"><a href="/">Return to the temple</a></p></div></body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const q = (req.query && Object.keys(req.query).length)
    ? req.query
    : Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const email = String(q.e || '').trim().toLowerCase();
  const token = String(q.t || '').trim();

  if (!email || !token) {
    res.status(400).end(page('Unsubscribe', '<h1>A link went astray</h1><p>This unsubscribe link is incomplete. If you keep receiving letters you did not ask for, write to <a href="mailto:usivaylo@gmail.com">usivaylo@gmail.com</a>.</p>'));
    return;
  }

  if (!kvReady()) {
    res.status(200).end(page('Unsubscribe', '<h1>Noted, beloved</h1><p>Your wish is honoured. If any letters still find you, reply to one and I will see to it myself.</p>'));
    return;
  }

  try {
    const saved = await kv(['HGET', TOKEN_KEY, email]);
    if (!saved || saved !== token) {
      res.status(200).end(page('Unsubscribe', '<h1>Already at rest</h1><p>This address is not on the list, or the link has already been used. Nothing more to do.</p>'));
      return;
    }
    await kv(['SREM', SET_KEY, email]);
    await kv(['HDEL', TOKEN_KEY, email]);
    await kv(['HDEL', DATE_KEY, email]);
    res.status(200).end(page('Unsubscribed', '<h1>Until we meet again</h1><p>You have been gently removed from the temple’s letters. No more will find your inbox. The door is always open should you wish to return.</p>'));
  } catch (e) {
    res.status(200).end(page('Unsubscribe', '<h1>Noted, beloved</h1><p>Something stirred in the veil, but your request is safe with me. If letters persist, write to <a href="mailto:usivaylo@gmail.com">usivaylo@gmail.com</a>.</p>'));
  }
};
