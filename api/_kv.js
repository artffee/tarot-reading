// Tiny Upstash / Vercel KV REST helper — no npm dependencies, same fetch style as bastet.js.
// Works with either Vercel KV (KV_REST_API_URL / KV_REST_API_TOKEN) or a raw
// Upstash Redis store (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
// With neither configured, kvReady() is false and callers degrade gracefully.

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

module.exports = { kv, kvReady };
