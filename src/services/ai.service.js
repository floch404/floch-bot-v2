'use strict';

const config = require('../config');
const { db } = require('../database');

class AiError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiError';
  }
}

const providerConfig = (name) => config.ai.providers[name];
const isConfigured = (name) => !!providerConfig(name)?.apiKey || (name === 'llm' && !!process.env.LLM_BASE_URL);

function loadContext(key) {
  const row = db.prepare('SELECT messages FROM ai_context WHERE key = ?').get(key);
  try {
    return row ? JSON.parse(row.messages) : [];
  } catch {
    return [];
  }
}
function saveContext(key, messages) {
  const trimmed = messages.slice(-config.ai.maxContext * 2);
  db.prepare('INSERT INTO ai_context (key, messages, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET messages = excluded.messages, updated_at = excluded.updated_at').run(key, JSON.stringify(trimmed), Date.now());
}
const resetContext = (key) => db.prepare('DELETE FROM ai_context WHERE key = ?').run(key).changes > 0;
const resetByPrefix = (prefix) => db.prepare("DELETE FROM ai_context WHERE key LIKE ? ESCAPE '\\'").run(`${prefix.replace(/[\\%_]/g, '\\$&')}%`).changes;

/**
 * Panggil provider berformat OpenAI-compatible (/chat/completions). Menangani: provider belum dikonfigurasi,
 * timeout, rate limit (429), status error, dan respons kosong. Konteks percakapan disimpan per kunci.
 */
async function chat(provider, contextKey, prompt) {
  const p = providerConfig(provider);
  if (!p) throw new AiError('Provider AI tidak dikenal.');
  if (!isConfigured(provider)) throw new AiError(`Provider ${provider} belum dikonfigurasi (API key belum diisi).`);

  const history = loadContext(contextKey);
  const messages = [{ role: 'system', content: config.ai.systemPrompt }, ...history, { role: 'user', content: prompt }];

  let res;
  try {
    res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({ model: p.model, messages, max_tokens: 800 }),
      signal: AbortSignal.timeout(config.ai.timeoutMs),
    });
  } catch (err) {
    throw new AiError(err.name === 'TimeoutError' ? 'AI tidak merespons tepat waktu (timeout). Coba lagi.' : 'AI tidak dapat dijangkau. Coba lagi nanti.');
  }
  if (res.status === 429) throw new AiError('Provider AI sedang membatasi permintaan (rate limit). Coba lagi sebentar lagi.');
  if (res.status === 401 || res.status === 403) throw new AiError('API key AI ditolak provider. Hubungi Owner.');
  if (!res.ok) throw new AiError(`Provider AI membalas status ${res.status}.`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new AiError('Respons AI tidak dapat dibaca.');
  }
  const answer = String(data?.choices?.[0]?.message?.content ?? '').trim();
  if (!answer) throw new AiError('AI memberi respons kosong. Coba ulangi dengan pertanyaan lain.');

  saveContext(contextKey, [...history, { role: 'user', content: prompt }, { role: 'assistant', content: answer }]);
  return answer;
}

module.exports = { AiError, chat, isConfigured, resetContext, resetByPrefix, loadContext };
