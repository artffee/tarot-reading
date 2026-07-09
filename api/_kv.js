// Tiny Upstash / Vercel KV REST helper + shared request guards — no npm dependencies,
// same fetch style as bastet.js. Works with either Vercel KV (KV_REST_API_URL /
// KV_REST_API_TOKEN) or a raw Upstash Redis store (UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN). With neither configured, kvReady() is false and
// callers degrade gracefully.

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL   || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

function kvReady() { return Boolean(KV_URL && KV_TOKEN); }

// Run a single Redis command, e.g. kv(['INCRBY','cp:kibble','5']) -> new value.
async function kv(command) {
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + KV_TOKEN, 'content-type': 'application/json' },
    body: JSON.stringify(command)
  });
  if (!r.ok) throw new Error('kv http ' + r.status);
  const d = await r.json();
  if (d && d.error) throw new Error(d.error);
  return d ? d.result : null;
}

// Fixed-window rate limiter. Returns { ok, count, limit }. Fails OPEN so an
// infrastructure hiccup never locks real visitors out.
async function rateLimit(bucket, limit, windowSec) {
  if (!kvReady()) return { ok: true, count: 0, limit };
  try {
    const key = 'cp:rl:' + bucket;
    const count = Number(await kv(['INCR', key])) || 0;
    if (count === 1) await kv(['EXPIRE', key, String(windowSec)]);
    return { ok: count <= limit, count, limit };
  } catch (e) {
    return { ok: true, count: 0, limit };
  }
}

// Best-effort client IP behind Vercel's proxy.
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'] || '';
  const first = String(xff).split(',')[0].trim();
  return first || req.headers['x-real-ip'] || 'unknown';
}

// Browser requests must originate from our own site; non-browser clients (no
// Origin/Referer, e.g. health checks) are allowed but still rate-limited.
const ALLOWED_HOSTS = ['thecatpriestess.com', 'www.thecatpriestess.com', 'localhost', '127.0.0.1'];
function originOk(req) {
  const o = req.headers.origin || req.headers.referer || '';
  if (!o) return true;
  try { return ALLOWED_HOSTS.includes(new URL(o).hostname); }
  catch (e) { return true; }
}

module.exports = { kv, kvReady, rateLimit, clientIp, originOk };
