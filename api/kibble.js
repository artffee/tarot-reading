// The Communal Bowl — a real, site-wide Kibble counter shared by every visitor.
//   GET  /api/kibble           -> { total, live }
//   POST /api/kibble {amount}  -> { total, live, minted }   (amount clamped, symbolic)
// The tally is real and public; the "donations" it unlocks are symbolic milestones
// the temple pledges toward (see index.html) — no automated real-money transfer here.

const { kv, kvReady } = require('./_kv');

const KIBBLE_KEY = 'cp:kibble';
const MAX_MINT   = 100;   // per-request cap so the shared bowl can't be spammed upward

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

      if (!kvReady()) { res.status(200).json({ total: 0, live: false, minted: 0 }); return; }

      const total = amount > 0
        ? (Number(await kv(['INCRBY', KIBBLE_KEY, String(amount)])) || 0)
        : (Number(await kv(['GET', KIBBLE_KEY])) || 0);
      res.status(200).json({ total, live: true, minted: amount });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(200).json({ total: 0, live: false, minted: 0 });
  }
};
