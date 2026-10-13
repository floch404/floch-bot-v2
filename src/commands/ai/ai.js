'use strict';

const config = require('../../config');
const ai = require('../../services/ai.service');
const { UserError } = require('../../core/executor');

const MAX_PROMPT = 1500;
const MAX_REPLY = 3500;

/** Konteks AI dipisah: per pengguna di chat pribadi, per grup (bersama) untuk percakapan di grup. */
const keyFor = (ctx, provider) => (ctx.isGroup ? `g:${ctx.session.sid}:${ctx.jid}:${provider}` : `u:${ctx.session.sid}:${ctx.sender || ctx.jid}:${provider}`);

const provider = (name, display, envKey, defaultAlias = false) => ({
  name: name.toLowerCase(),
  display,
  category: 'AI',
  description: `Tanya AI (${name}). Butuh ${envKey}.`,
  usage: `.${name.toLowerCase()} <pertanyaan>`,
  minArgs: 1,
  limit: 1,
  status: 'needs_config',
  requires: [envKey],
  api: `${name} (format OpenAI-compatible)`,
  isConfigured: () => ai.isConfigured(name === 'AI' ? config.ai.defaultProvider : name.toLowerCase()),
  async run(ctx) {
    const p = name === 'AI' ? config.ai.defaultProvider : name.toLowerCase();
    const prompt = ctx.argText.slice(0, MAX_PROMPT);
    try {
      const answer = await ai.chat(p, keyFor(ctx, p), prompt);
      await ctx.reply(answer.length > MAX_REPLY ? `${answer.slice(0, MAX_REPLY)}\n…(dipotong)` : answer);
    } catch (err) {
      if (err instanceof ai.AiError) throw new UserError(`⚠️ ${err.message}`);
      throw err;
    }
  },
});

module.exports = [
  provider('AI', 'AI', 'OPENAI_API_KEY (atau provider default lain)'),
  provider('GPT', 'GPT', 'OPENAI_API_KEY'),
  provider('DeepSeek', 'DeepSeek', 'DEEPSEEK_API_KEY'),
  provider('Gemini', 'Gemini', 'GEMINI_API_KEY'),
  provider('Gemma', 'Gemma', 'GEMMA_API_KEY'),
  provider('LLM', 'LLM', 'LLM_API_KEY / LLM_BASE_URL'),
  {
    name: 'resetai',
    display: 'ResetAI',
    category: 'AI',
    description: 'Hapus konteks percakapan AI milikmu (chat pribadi)',
    status: 'tested',
    examples: [{ args: '', expect: /Konteks AI .* dihapus|Tidak ada konteks/ }],
    async run(ctx) {
      // Hanya konteks MILIK pengirim di chat pribadi (kunci "u:"), tidak menyentuh konteks grup.
      const n = ai.resetByPrefix(`u:${ctx.session.sid}:${ctx.sender || ctx.jid}:`);
      await ctx.reply(n ? `Konteks AI kamu dihapus (${n} provider).` : 'Tidak ada konteks AI yang tersimpan untukmu.');
    },
  },
  {
    name: 'resetaigroup',
    display: 'ResetAIGroup',
    category: 'AI',
    description: 'Hapus konteks AI grup ini (khusus admin grup)',
    groupOnly: true,
    groupAdmin: true,
    status: 'tested',
    async run(ctx) {
      // Hanya konteks grup yang dituju (kunci "g:<sesi>:<jid grup>:").
      const n = ai.resetByPrefix(`g:${ctx.session.sid}:${ctx.jid}:`);
      await ctx.reply(n ? `Konteks AI grup ini dihapus (${n} provider).` : 'Tidak ada konteks AI tersimpan untuk grup ini.');
    },
  },
];
