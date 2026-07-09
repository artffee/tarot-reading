// Email subscription — stores addresses in a Redis set (Vercel KV / Upstash) and
// mints a one-time Kibble bonus for each new subscriber. Dependency-free.
// Without a KV store configured it responds gracefully so the form still "works".

const { kv, kvReady } = require('./_kv');

const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUB_BONUS = 50;                // Kibble minted for a brand-new subscriber
const SET_KEY   = 'cp:subscribers';
const KIBBLE_KEY= 'cp:kibble';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let email = '';
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    email = String(b.email || '').trim().toLowerCase();
  } catch (e) { email = ''; }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    res.status(400).json({ error: 'Please enter a valid email, beloved.' });
    return;
  }

  // No store yet — accept softly so the visitor still gets a warm confirmation.
  if (!kvReady()) { res.status(200).json({ ok: true, stored: false, isNew: true, minted: 0 }); return; }

  try {
    const added = await kv(['SADD', SET_KEY, email]);   // 1 if new, 0 if already subscribed
    const isNew = added === 1;
    let total = null;
    if (isNew) total = await kv(['INCRBY', KIBBLE_KEY, String(SUB_BONUS)]);
    else       total = await kv(['GET', KIBBLE_KEY]);
    res.status(200).json({
      ok: true, stored: true, isNew,
      minted: isNew ? SUB_BONUS : 0,
      total: Number(total) || 0
    });
  } catch (e) {
    // Never lose the visitor to an infrastructure hiccup.
    res.status(200).json({ ok: true, stored: false, isNew: true, minted: 0 });
  }
};
