// Admin broadcast — send a "Letter from the Temple" to every subscriber, each with a
// personalised one-click unsubscribe link (good for deliverability + consent).
//
//   POST /api/broadcast
//     header: Authorization: Bearer <ADMIN_TOKEN>
//     body:   { subject, html?, text?, test?, confirm? }
//       test    - if set to an email, sends ONLY to that address (dry run of the template)
//       confirm - must be true to send to the whole list (guards against accidents)
//
// Requires ADMIN_TOKEN and RESEND_API_KEY. Sending domain is verified in Resend and set
// via NEWSLETTER_FROM (e.g. "Bastet <bastet@thecatpriestess.com>").

const { kv, kvReady } = require('./_kv');

const SET_KEY   = 'cp:subscribers';
const TOKEN_KEY = 'cp:sub:token';
const SITE      = 'https://www.thecatpriestess.com';
const FROM      = process.env.NEWSLETTER_FROM || 'The Cat Priestess <onboarding@resend.dev>';

function authorized(req) {
  const admin = process.env.ADMIN_TOKEN || '';
  if (!admin) return false;
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return bearer === admin;
}

function unsubUrl(email, token) {
  return SITE + '/api/unsubscribe?e=' + encodeURIComponent(email) + '&t=' + encodeURIComponent(token || '');
}

// Wrap the author's HTML/text in a simple on-brand shell with the unsubscribe footer.
function render(bodyHtml, unsub) {
  return `<div style="font-family:Georgia,'Times New Roman',serif;background:#07070e;padding:28px 0;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#0d0e1c;border:1px solid rgba(201,163,74,.3);border-radius:16px;padding:34px 30px;color:#d9cfb8">
    <div style="text-align:center;font-family:Georgia,serif;letter-spacing:3px;color:#e2c47f;font-size:12px;text-transform:uppercase;margin-bottom:18px">&#10022;&nbsp; The Cat Priestess &nbsp;&#10022;</div>
    <div style="font-size:17px;line-height:1.7;color:#e7dcc2">${bodyHtml}</div>
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid rgba(201,163,74,.2);text-align:center;font-size:12px;color:#8f8578">
      <a href="${unsub}" style="color:#a89d84;text-decoration:underline">Unsubscribe</a>
      &nbsp;·&nbsp; <a href="${SITE}" style="color:#a89d84;text-decoration:underline">thecatpriestess.com</a>
    </div>
  </div></div>`;
}

async function sendOne(key, to, subject, html, unsub) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: FROM, to: [to], subject,
      html: render(html, unsub),
      headers: {
        'List-Unsubscribe': '<' + unsub + '>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    })
  });
  return r.ok;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!process.env.ADMIN_TOKEN)   { res.status(503).json({ error: 'Broadcast disabled — set ADMIN_TOKEN.' }); return; }
  if (!authorized(req))           { res.status(401).json({ error: 'Unauthorized' }); return; }
  const key = process.env.RESEND_API_KEY;
  if (!key)      { res.status(503).json({ error: 'No sender configured — set RESEND_API_KEY (and verify your domain in Resend).' }); return; }
  if (!kvReady()) { res.status(503).json({ error: 'No subscriber store connected.' }); return; }

  let subject = '', html = '', text = '', test = '', confirm = false;
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    subject = String(b.subject || '').trim();
    html    = String(b.html || b.text || '').trim();
    text    = String(b.text || '').trim();
    test    = String(b.test || '').trim().toLowerCase();
    confirm = b.confirm === true;
  } catch (e) {}
  if (!subject || !html) { res.status(400).json({ error: 'subject and html/text are required.' }); return; }
  if (!/<[a-z][\s\S]*>/i.test(html) && text) html = text.replace(/\n/g, '<br>'); // plain -> simple HTML

  try {
    // Dry run to a single address using a throwaway unsubscribe link.
    if (test) {
      const ok = await sendOne(key, test, subject, html, unsubUrl(test, 'preview'));
      res.status(ok ? 200 : 502).json({ ok, test: true, sentTo: test });
      return;
    }
    if (!confirm) { res.status(400).json({ error: 'Set confirm:true to send to the whole list. Use test:"you@email" first.' }); return; }

    const emails = (await kv(['SMEMBERS', SET_KEY])) || [];
    const tokens = emails.length ? (await kv(['HMGET', TOKEN_KEY, ...emails])) || [] : [];
    let sent = 0, failed = 0;
    for (let i = 0; i < emails.length; i++) {
      const ok = await sendOne(key, emails[i], subject, html, unsubUrl(emails[i], tokens[i]));
      ok ? sent++ : failed++;
    }
    res.status(200).json({ ok: true, total: emails.length, sent, failed });
  } catch (e) {
    res.status(500).json({ error: 'Broadcast failed: ' + (e.message || 'unknown') });
  }
};
