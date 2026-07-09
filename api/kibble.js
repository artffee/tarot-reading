// The Communal Bowl — a real, site-wide Kibble counter shared by every visitor.
//   GET  /api/kibble           -> { total, live }
//   POST /api/kibble {amount}  -> { total, live, minted }
// The tally is real and public; the "donations" it unlocks are symbolic milestones
// the temple pledges toward (see index.html) — no automated real-money transfer here.
//
// Integrity: mints require a same-site Origin and are rate-limited per IP so the
// public counter can't be trivially inflated by a script.

const { kv, kvReady, rateLimit, clientIp, originOk } = require('./_kv');

const KIBBLE_KEY   = 'cp:kibble';
const MAX_MINT     = 100;    // per-request cap
const RL_LIMIT     = 60;     // mints allowed per IP per window (generous for real readers)
const RL_WINDOW    = 3600;   // 1 hour

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const total = kvReady() ? (Number(await kv(['GET', KIBBLE_KEY])) || 0) : 0;
      res.status(200).json({ total, live: kvReady() });
      return;
    }

    if (req.method === 'POST') {
      let amount = 0;
      try {
        const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        amount = Math.floor(Number(b.amount) || 0);
      } catch (e) { amount = 0; }
      amount = Math.max(0, Math.min(MAX_MINT, amount));

      // Reject cross-site scripted mints from the browser.
      if (!originOk(req)) { res.status(403).json({ error: 'forbidden' }); return; }

      if (!kvReady()) { res.status(200).json({ total: 0, live: false, minted: 0 }); return; }

      // Throttle per IP. On limit, return the current total without minting.
      const rl = await rateLimit('kibble:' + clientIp(req), RL_LIMIT, RL_WINDOW);
      if (!rl.ok || amount === 0) {
        const total = Number(await kv(['GET', KIBBLE_KEY])) || 0;
        res.status(rl.ok ? 200 : 429).json({ total, live: true, minted: 0 });
        return;
      }

      const total = Number(await kv(['INCRBY', KIBBLE_KEY, String(amount)])) || 0;
      res.status(200).json({ total, live: true, minted: amount });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(200).json({ total: 0, live: false, minted: 0 });
  }
};
