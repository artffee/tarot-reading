// Shared email sender (Resend) + on-brand HTML shell. Used by subscribe.js (welcome
// letter) and broadcast.js (newsletter). No npm deps. Sends only when RESEND_API_KEY
// is set; otherwise mailReady() is false and callers skip sending gracefully.
//
// Set NEWSLETTER_FROM to a verified sender, e.g. "Bastet <bastet@thecatpriestess.com>".

const SITE = 'https://www.thecatpriestess.com';
const FROM = process.env.NEWSLETTER_FROM || 'The Cat Priestess <onboarding@resend.dev>';

function mailReady() { return Boolean(process.env.RESEND_API_KEY); }

function unsubUrl(email, token) {
  return SITE + '/api/unsubscribe?e=' + encodeURIComponent(email) + '&t=' + encodeURIComponent(token || '');
}

// Wrap author content in a simple, on-brand email shell with an unsubscribe footer.
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

// Send one email. Returns true on success, false on any failure (never throws).
async function sendMail({ to, subject, html, unsub }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
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
  } catch (e) { return false; }
}

module.exports = { mailReady, unsubUrl, render, sendMail, SITE, FROM };
