// Admin export — download the subscriber list as CSV.
//   GET /api/export            with header  Authorization: Bearer <ADMIN_TOKEN>
//   GET /api/export?token=...  (query fallback)
// Requires the ADMIN_TOKEN env var to be set; otherwise the endpoint is disabled.

const { kv, kvReady } = require('./_kv');

const SET_KEY   = 'cp:subscribers';
const DATE_KEY  = 'cp:sub:date';

function authorized(req) {
  const admin = process.env.ADMIN_TOKEN || '';
  if (!admin) return false;
  const hdr = req.headers.authorization || '';
  const bearer = hdr.replace(/^Bearer\s+/i, '').trim();
  const q = (req.query && req.query.token) ||
    Object.fromEntries(new URL(req.url, 'http://x').searchParams).token || '';
  return bearer === admin || String(q) === admin;
}

module.exports = async function handler(req, res) {
  if (!process.env.ADMIN_TOKEN) {
    res.status(503).json({ error: 'Export disabled — set ADMIN_TOKEN to enable.' });
    return;
  }
  if (!authorized(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!kvReady()) { res.status(200).setHeader('Content-Type', 'text/csv'); res.end('email,subscribed_at,pocket_priestess,first_nine_nights,memory_of_nine_lives,all_products\n'); return; }

  try {
    const emails = (await kv(['SMEMBERS', SET_KEY])) || [];
    const dates = emails.length ? (await kv(['HMGET', DATE_KEY, ...emails])) || [] : [];
    const interestKeys = ['pocket', 'adoption', 'memory', 'all'];
    const interestLists = await Promise.all(interestKeys.map(k => kv(['SMEMBERS', 'cp:interest:' + k])));
    const interests = interestLists.map(list => new Set(list || []));
    const rows = ['email,subscribed_at,pocket_priestess,first_nine_nights,memory_of_nine_lives,all_products'];
    emails.forEach((e, i) => {
      const safe = '"' + String(e).replace(/"/g, '""') + '"';
      rows.push([safe, dates[i] || '', ...interests.map(set => set.has(e) ? 'yes' : '')].join(','));
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(rows.join('\n') + '\n');
  } catch (e) {
    res.status(500).json({ error: 'Export failed' });
  }
};
