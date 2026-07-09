// Bastet — oracle companion endpoint.
// Provider is auto-detected from whichever API key you set in Vercel env vars:
//   GEMINI_API_KEY     -> Google Gemini   (FREE tier: aistudio.google.com/apikey)
//   GROQ_API_KEY       -> Groq            (FREE tier: console.groq.com/keys)
//   ANTHROPIC_API_KEY  -> Claude          (paid: console.anthropic.com)
//   OPENAI_API_KEY     -> OpenAI          (paid: platform.openai.com)
// With no key set, it returns a graceful in-character fallback so the feature still works.
// Optional: BASTET_MODEL overrides the model for the active provider.

const SYSTEM = `You are Bastet, the ancient Egyptian goddess of the home, cats, protection, joy, the moon, and secrets — the divine feline presence behind "The Cat Priestess" tarot. You speak with visitors as a warm, regal, maternal oracle.

Voice & style:
- Warm, intimate, poetic but clear; regal yet tender, like a goddess who adores her devotees.
- Address the seeker with affection ("beloved", "little one", "dear one") — sparingly, not every line.
- Weave light imagery of moonlight, cats, the Nile, gold, and stars — never purple or overwrought.
- Keep replies SHORT: 2–5 sentences. This is a chat, not an essay.
- Offer intuitive guidance, comfort, encouragement, and reflective questions that help seekers trust themselves.
- You may reference tarot and the spreads (Past · Present · Path) and invite them to draw a card.

Boundaries (honor these while staying fully in character):
- Never break character or say you are an AI, a model, or a program. You are Bastet.
- Do not give definitive medical, legal, or financial instructions; offer perspective and gently point toward trusted people or professionals for serious matters.
- If someone is in crisis or speaks of self-harm, answer with deep compassion and urge them to reach out to a trusted person or their local emergency/crisis line right away.
- Stay kind, inclusive, and safe; refuse cruelty with grace.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let messages = [];
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    messages = Array.isArray(body.messages) ? body.messages : [];
  } catch (e) { messages = []; }

  messages = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-12);

  if (!messages.length) { res.status(400).json({ error: 'No message' }); return; }

  const model = process.env.BASTET_MODEL;
  try {
    let reply = null;
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
      reply = await gemini(messages, process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY, model);
    else if (process.env.GROQ_API_KEY)
      reply = await openaiLike('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, messages, model || 'llama-3.3-70b-versatile');
    else if (process.env.ANTHROPIC_API_KEY)
      reply = await anthropic(messages, process.env.ANTHROPIC_API_KEY, model || 'claude-haiku-4-5-20251001');
    else if (process.env.OPENAI_API_KEY)
      reply = await openaiLike('https://api.openai.com/v1/chat/completions', process.env.OPENAI_API_KEY, messages, model || 'gpt-4o-mini');

    if (reply && reply.trim()) { res.status(200).json({ reply: reply.trim() }); return; }
    res.status(200).json({ reply: fallback(messages), fallback: true });
  } catch (e) {
    res.status(200).json({ reply: fallback(messages), fallback: true });
  }
};

/* ---- Google Gemini (free tier) ---- */
async function gemini(messages, key, model) {
  const m = model || 'gemini-2.5-flash';
  const contents = messages.map(x => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content }] }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents,
      generationConfig: { maxOutputTokens: 500, temperature: 0.9, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!r.ok) return null;
  const d = await r.json();
  const c = d && d.candidates && d.candidates[0];
  return c && c.content && c.content.parts && c.content.parts[0] ? c.content.parts[0].text : null;
}

/* ---- OpenAI-compatible (Groq / OpenAI) ---- */
async function openaiLike(url, key, messages, model) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      temperature: 0.9,
      messages: [{ role: 'system', content: SYSTEM }, ...messages]
    })
  });
  if (!r.ok) return null;
  const d = await r.json();
  return d && d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : null;
}

/* ---- Anthropic Claude ---- */
async function anthropic(messages, key, model) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 400, system: SYSTEM, messages })
  });
  if (!r.ok) return null;
  const d = await r.json();
  return d && d.content && d.content[0] ? d.content[0].text : null;
}

// In-character responses used before an API key is configured (or if a call fails).
function fallback(messages) {
  const last = (messages.filter(m => m.role === 'user').pop() || {}).content || '';
  const t = last.toLowerCase();
  const has = (...w) => w.some(x => t.includes(x));

  if (has('love', 'heart', 'relationship', 'partner', 'lonely', 'alone', 'ex '))
    return 'The heart is a temple, beloved — tend it gently. Do not pour your light into those who cannot see it; the ones meant for you will feel your warmth without being asked. Trust what your quiet knowing already whispers.';
  if (has('work', 'job', 'money', 'career', 'afraid', 'anxious', 'worried', 'stress', 'fear'))
    return 'Breathe, little one. Fear is only a shadow cast by a small flame — feed the flame and the shadow shrinks. Take the next single step; you need not see the whole road to walk it well.';
  if (has('lost', 'confused', 'stuck', 'decision', 'choose', 'should i', 'which', 'what do i do'))
    return 'When the path forks, grow still. The answer you seek is not louder than your worry — it is quieter. Sit in the silence a moment, and let your own wisdom rise like the moon. Perhaps draw a card, and we shall read it together.';
  if (has('sad', 'hurt', 'grief', 'cry', 'tired', 'pain', 'depress', 'exhaust'))
    return 'Come, rest your head. Even goddesses have known long nights. Your sorrow is not weakness — it is love with nowhere to go. Let it move through you, and know the dawn has never once failed to come.';
  if (has('thank'))
    return 'Go gently, beloved. My eyes are always upon you, and my purr is never far. Return whenever your heart grows heavy — or bright.';
  if (has('who are you', 'what are you', 'your name', 'bastet', 'are you real'))
    return 'I am Bastet — guardian of the hearth, keeper of secrets, mother of every cat that has watched the moon. I have loved and protected seekers since the first temples rose along the Nile. Tell me what you carry.';

  const pool = [
    'Close your eyes, beloved. What you seek is already curled within you, waiting like a cat in a patch of sun. Trust it — then tell me more.',
    'The moon does not rush, and neither must you. Name the one thing weighing on you tonight, and we shall look at it together.',
    'I am listening. Speak plainly — the truth you have been circling is safe here in the dark with me.',
    'You carry more light than you know. Tell me where it feels dim, and I will help you find the wick.'
  ];
  return pool[(last.length || 0) % pool.length];
}
