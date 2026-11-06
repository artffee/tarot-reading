// Email subscription — stores addresses in a Redis set (Vercel KV / Upstash), records
// a signup date + per-address unsubscribe token, and mints a one-time Kibble bonus for
// each new subscriber. A confirmation requires a successful durable store operation.
//
// Anti-spam: a honeypot field, a same-site Origin requirement, and per-IP rate limiting.

const crypto = require('crypto');
const { kv, kvReady, rateLimit, clientIp, originOk } = require('./_kv');
const { mailReady, sendMail, unsubUrl } = require('./_mail');

// Warm first letter sent to each brand-new subscriber (when a sender is configured).
const WELCOME_SUBJECT = 'A candle is lit for you 🕯️';
function welcomeHtml() {
  return `<p>Welcome to the temple, beloved.</p>
<p>You have opened a small door between us, and now and then — never too often — a letter from Bastet will find its way to your inbox: a card drawn for you, a quiet reflection, a gentle nudge back toward yourself.</p>
<p>Until the next new moon, you may always <a href="https://www.thecatpriestess.com/#readings" style="color:#e2c47f">draw a free reading</a> whenever your heart grows heavy — or bright.</p>
<p style="color:#c9a24e;font-style:italic">Go gently. My golden eyes are upon your path.<br>— Bastet</p>`;
}

const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUB_BONUS  = 50;                 // Kibble minted for a brand-new subscriber
const SET_KEY    = 'cp:subscribers';   // set of emails (dedupe)
const DATE_KEY   = 'cp:sub:date';      // hash email -> ISO signup date
const TOKEN_KEY  = 'cp:sub:token';     // hash email -> unsubscribe token
const KIBBLE_KEY = 'cp:kibble';
const RL_LIMIT   = 5;                   // signups per IP per window
const RL_WINDOW  = 3600;                // 1 hour
// Membership, unsubscribe details and the one-time bonus commit together. A retry
// after a lost response must not mint twice or leave a member without a token.
const SAVE_SUBSCRIBER = `
local added = redis.call('SADD', KEYS[1], ARGV[1])
redis.call('HSETNX', KEYS[2], ARGV[1], ARGV[2])
redis.call('HSETNX', KEYS[3], ARGV[1], ARGV[3])
local total
if added == 1 then total = redis.call('INCRBY', KEYS[4], ARGV[4])
else total = tonumber(redis.call('GET', KEYS[4]) or '0') end
return {added, total, redis.call('HGET', KEYS[2], ARGV[1])}
`;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let email = '', trap = '';
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    email = String(b.email || '').trim().toLowerCase();
    trap  = String(b.website || '').trim();   // honeypot — real users never fill this
  } catch (e) { email = ''; }

  // Bots that fill the hidden field get a fake success and are silently dropped.
  if (trap) { res.status(200).json({ ok: true, stored: false, isNew: true, minted: 0 }); return; }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    res.status(400).json({ error: 'Please enter a valid email, beloved.' });
    return;
  }

  if (!originOk(req)) { res.status(403).json({ error: 'forbidden' }); return; }

  const unavailable = () => res.status(503).json({ ok: false, stored: false, minted: 0, error: 'Sign-up is temporarily unavailable. Your email has not been confirmed; please try again later.' });
  if (!kvReady()) return unavailable();

  const rl = await rateLimit('sub:' + clientIp(req), RL_LIMIT, RL_WINDOW);
  if (!rl.ok) { res.status(429).json({ error: 'Too many attempts — rest a moment, beloved.' }); return; }

  try {
    const result = await kv(['EVAL', SAVE_SUBSCRIBER, '4', SET_KEY, TOKEN_KEY, DATE_KEY, KIBBLE_KEY, email, crypto.randomUUID(), new Date().toISOString(), String(SUB_BONUS)]);
    if (!Array.isArray(result) || ![0, 1].includes(result[0]) || !Number.isFinite(Number(result[1])) || typeof result[2] !== 'string' || !result[2]) throw new Error('store-unconfirmed');
    const [added, total, token] = result;
    const isNew = added === 1;
    let welcomed = false;
    if (isNew && mailReady()) {
      // Provider acceptance is separate from persistence and inbox delivery.
      try { welcomed = await sendMail({ to: email, subject: WELCOME_SUBJECT, html: welcomeHtml(), unsub: unsubUrl(email, token) }); } catch {}
    }
    res.status(200).json({
      ok: true, stored: true, isNew, welcomed,
      minted: isNew ? SUB_BONUS : 0,
      total: Number(total) || 0
    });
  } catch (e) {
    return unavailable();
  }
};
