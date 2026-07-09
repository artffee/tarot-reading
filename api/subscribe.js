// Email subscription — stores addresses in a Redis set (Vercel KV / Upstash), records
// a signup date + per-address unsubscribe token, and mints a one-time Kibble bonus for
// each new subscriber. Dependency-free. Without a KV store it responds gracefully so the
// form still "works".
//
// Anti-spam: a honeypot field, a same-site Origin requirement, and per-IP rate limiting.

const crypto = require('crypto');
const { kv, kvReady, rateLimit, clientIp, originOk } = require('./_kv');

const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUB_BONUS  = 50;                 // Kibble minted for a brand-new subscriber
const SET_KEY    = 'cp:subscribers';   // set of emails (dedupe)
const DATE_KEY   = 'cp:sub:date';      // hash email -> ISO signup date
const TOKEN_KEY  = 'cp:sub:token';     // hash email -> unsubscribe token
const KIBBLE_KEY = 'cp:kibble';
const RL_LIMIT   = 5;                   // signups per IP per window
const RL_WINDOW  = 3600;                // 1 hour

module.exports = async function handler(req, res) {
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

  // No store yet — accept softly so the visitor still gets a warm confirmation.
  if (!kvReady()) { res.status(200).json({ ok: true, stored: false, isNew: true, minted: 0 }); return; }

  const rl = await rateLimit('sub:' + clientIp(req), RL_LIMIT, RL_WINDOW);
  if (!rl.ok) { res.status(429).json({ error: 'Too many attempts — rest a moment, beloved.' }); return; }

  try {
    const added = await kv(['SADD', SET_KEY, email]);   // 1 if new, 0 if already subscribed
    const isNew = added === 1;
    let total = null;
    if (isNew) {
      const token = crypto.randomUUID();
      await kv(['HSET', TOKEN_KEY, email, token]);
      await kv(['HSET', DATE_KEY, email, new Date().toISOString()]);
      total = await kv(['INCRBY', KIBBLE_KEY, String(SUB_BONUS)]);
    } else {
      total = await kv(['GET', KIBBLE_KEY]);
    }
    res.status(200).json({
      ok: true, stored: true, isNew,
      minted: isNew ? SUB_BONUS : 0,
      total: Number(total) || 0
    });
  } catch (e) {
    res.status(200).json({ ok: true, stored: false, isNew: true, minted: 0 });
  }
};
