// Unsubscribe endpoint — reached from the link in every newsletter.
//   GET /api/unsubscribe?e=<email>&t=<token>
// Verifies the per-address token, removes the email from the list, and returns a
// small styled confirmation page in the temple's voice.
//
// Reliability: removal is atomic. Storage outages and failed deletes return 503 and
// never claim the address was removed. Token comparison is length-checked and
// timing-safe when lengths match.

const crypto = require('crypto');
const { Buffer } = require('buffer');
const { kv, kvReady } = require('./_kv');

const SET_KEY   = 'cp:subscribers';
const DATE_KEY  = 'cp:sub:date';
const TOKEN_KEY = 'cp:sub:token';

// One EVAL prevents other requests interleaving with the token check and removal.
// Lua does not roll back runtime errors: validate all key types before any write.
const REMOVE_SUBSCRIBER = `
local expected = {'set', 'hash', 'hash'}
for i = 1, 3 do
  local kind = redis.call('TYPE', KEYS[i]).ok
  if kind ~= 'none' and kind ~= expected[i] then
    return redis.error_reply('WRONGTYPE subscription ledger')
  end
end
local saved = redis.call('HGET', KEYS[2], ARGV[1])
if (not saved) or saved ~= ARGV[2] then return 0 end
redis.call('SREM', KEYS[1], ARGV[1])
redis.call('HDEL', KEYS[2], ARGV[1])
redis.call('HDEL', KEYS[3], ARGV[1])
return 1
`;

function tokensMatch(saved, provided) {
  const a = Buffer.from(String(saved || ''), 'utf8');
  const b = Buffer.from(String(provided || ''), 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — The Cat Priestess</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Cormorant+Garamond:ital@0;1&display=swap');
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font-family:"Cormorant Garamond",Georgia,serif;color:#d9cfb8;text-align:center;
 background:radial-gradient(90% 60% at 80% 4%,#20233f,rgba(0,0,0,0) 45%),linear-gradient(180deg,#0d0e1c,#07070e);
 background-color:#07070e;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:28px}
.card{max-width:460px;padding:40px 34px;border:1px solid rgba(201,163,74,.3);border-radius:18px;
 background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.014));box-shadow:0 16px 48px rgba(0,0,0,.45)}
h1{font-family:"Cinzel",serif;font-weight:700;letter-spacing:2px;font-size:26px;color:#f3ead2;margin:0 0 14px}
p{font-size:18px;line-height:1.6;margin:0 0 10px}
a{color:#e2c47f;text-decoration:none;border-bottom:1px solid rgba(201,163,74,.4)}
.orn{font-size:22px;color:#e2c47f;margin-bottom:12px}
</style></head><body><div class="card"><div class="orn">&#10022;</div>${body}
<p style="margin-top:20px"><a href="/">Return to the temple</a></p></div></body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const q = (req.query && Object.keys(req.query).length)
    ? req.query
    : Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const email = String(q.e || '').trim().toLowerCase();
  const token = String(q.t || '').trim();

  if (!email || !token) {
    res.status(400).end(page('Unsubscribe', '<h1>A link went astray</h1><p>This unsubscribe link is incomplete. If you keep receiving letters you did not ask for, write to <a href="mailto:usivaylo@gmail.com">usivaylo@gmail.com</a>.</p>'));
    return;
  }

  const unavailable = () => res.status(503).end(page(
    'Unsubscribe unavailable',
    '<h1>The ledger is briefly closed</h1><p>We could <strong>not confirm</strong> your unsubscribe request. You may still be subscribed. Please try this same link again in a moment. If letters continue after a few tries, write to <a href="mailto:usivaylo@gmail.com">usivaylo@gmail.com</a>.</p>'
  ));
  const unverified = () => res.status(400).end(page(
    'Unsubscribe link unverified',
    '<h1>This link could not be verified</h1><p>We have not confirmed your removal. This link may be invalid, expired, or already used. Use the unsubscribe link in your latest letter, or write to <a href="mailto:usivaylo@gmail.com">usivaylo@gmail.com</a> for help.</p>'
  ));

  if (!kvReady()) return unavailable();

  try {
    // A missing or mismatched token does not establish that membership was removed.
    const saved = await kv(['HGET', TOKEN_KEY, email]);
    if (saved !== null && typeof saved !== 'string') return unavailable();
    if (!tokensMatch(saved, token)) return unverified();

    const removed = await kv(['EVAL', REMOVE_SUBSCRIBER, '3', SET_KEY, TOKEN_KEY, DATE_KEY, email, token]);
    // Zero may mean a new subscription replaced the token; it is not proof of removal.
    if (removed === 0) return unverified();
    // Upstash returns Redis integer replies as JSON numbers. Never coerce malformed replies.
    if (removed !== 1) return unavailable();

    res.status(200).end(page('Unsubscribed', '<h1>Until we meet again</h1><p>You have been removed from the temple’s mailing list. A letter already being sent may still arrive. The door is always open should you wish to return.</p>'));
  } catch (e) {
    return unavailable();
  }
};
