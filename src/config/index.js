'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..', '..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile); // tidak menimpa variabel yang sudah ada
  } catch (err) {
    console.warn('[config] gagal membaca .env:', err.message);
  }
}

const env = process.env;
const bool = (v, d) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
const int = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
const list = (v) =>
  String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const digits = (v) => String(v).replace(/\D/g, '');

const trustProxy = (() => {
  const v = env.TRUST_PROXY;
  if (!v || v === '0' || v === 'false') return false;
  if (v === 'true') return true;
  return /^\d+$/.test(v) ? parseInt(v, 10) : v;
})();

const publicDir = path.join(root, 'public');
const dataDir = env.DATA_DIR ? path.resolve(root, env.DATA_DIR) : path.join(root, 'data');
if (dataDir === publicDir || dataDir.startsWith(publicDir + path.sep)) {
  throw new Error('DATA_DIR tidak boleh berada di dalam folder public.');
}

/** SESSION_SECRET dari env, atau dibuat sekali dan disimpan di DATA_DIR (di luar folder public). */
function loadSecret() {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 16) return env.SESSION_SECRET;
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const file = path.join(dataDir, '.session_secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

const aiProvider = (prefix, defaults) => ({
  apiKey: env[`${prefix}_API_KEY`] || '',
  baseUrl: (env[`${prefix}_BASE_URL`] || defaults.baseUrl).replace(/\/+$/, ''),
  model: env[`${prefix}_MODEL`] || defaults.model,
});

module.exports = {
  // Identitas tetap (tidak dapat diubah lewat env, command, atau request)
  identity: Object.freeze({ botName: 'FLOCH BOT', owner: 'floch', developer: 'floch' }),
  prefix: '.',

  root,
  publicDir,
  dataDir,
  dbFile: path.join(dataDir, 'floch.db'),
  waSessionsDir: path.join(dataDir, 'wa-sessions'),
  tmpDir: path.join(dataDir, 'tmp'),
  timezone: env.TZ_DEFAULT || 'Asia/Jakarta',

  port: int(env.PORT, 3000),
  host: env.HOST || '0.0.0.0',
  trustProxy,
  cookieSecure: bool(env.COOKIE_SECURE, false),
  sessionSecret: loadSecret(),
  publicUrl: (env.PUBLIC_URL || '').replace(/\/+$/, ''),

  // Owner diverifikasi lewat NOMOR WhatsApp (bukan nama kontak/pesan).
  ownerNumbers: list(env.OWNER_NUMBERS).map(digits).filter((n) => /^\d{8,15}$/.test(n)),
  commandCooldownMs: int(env.COMMAND_COOLDOWN_MS, 1000),
  ownerBypassGroupAdmin: bool(env.OWNER_BYPASS_GROUP_ADMIN, true),
  premiumBypassRoles: new Set(list(env.PREMIUM_BYPASS_ROLES || 'owner').map((s) => s.toLowerCase())),
  adminCanManagePremium: bool(env.ADMIN_CAN_MANAGE_PREMIUM, true),

  site: {
    accessCode: env.PAIRING_ACCESS_CODE || '',
    maxSessions: int(env.MAX_SESSIONS, 3),
    visitorTtlMs: int(env.VISITOR_TTL_DAYS, 365) * 86400_000,
    pairingRatePer10Min: int(env.PAIRING_RATE_PER_10MIN, 5),
    apiRatePerMin: int(env.API_RATE_PER_MIN, 300),
  },

  limits: {
    dailyFree: int(env.DAILY_LIMIT_FREE, 30),
    dailyPremium: int(env.DAILY_LIMIT_PREMIUM, 300),
    dailyBonusFree: int(env.DAILY_BONUS_FREE, 10),
    dailyBonusPremium: int(env.DAILY_BONUS_PREMIUM, 30),
    gameFree: int(env.GAME_LIMIT_FREE, 20),
    gamePremium: int(env.GAME_LIMIT_PREMIUM, 100),
  },

  donation: env.DONATION_INFO || '',
  sourceUrl: env.SOURCE_URL || '',

  jws: {
    apiUrl: env.JWS_API_URL || 'https://randomwaifu.com/get/api/',
    jsonPath: env.JWS_JSON_PATH || '',
    timeoutMs: int(env.JWS_TIMEOUT_MS, 10000),
    maxBytes: int(env.JWS_MAX_BYTES, 8 * 1024 * 1024),
    allowHttp: bool(env.JWS_ALLOW_HTTP, false),
    verifiedFile: path.join(dataDir, 'jws-verified.json'),
  },

  ai: {
    timeoutMs: int(env.AI_TIMEOUT_MS, 30000),
    maxContext: int(env.AI_MAX_CONTEXT, 10),
    systemPrompt: env.AI_SYSTEM_PROMPT || 'Kamu adalah FLOCH BOT, asisten WhatsApp yang ringkas dan sopan. Jawab dalam bahasa pengguna.',
    // Semua provider memakai format "OpenAI-compatible chat completions". Isi API key untuk mengaktifkan.
    providers: {
      gpt: aiProvider('OPENAI', { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }),
      deepseek: aiProvider('DEEPSEEK', { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' }),
      gemini: aiProvider('GEMINI', { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' }),
      gemma: aiProvider('GEMMA', { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemma-3-27b-it' }),
      llm: aiProvider('LLM', { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' }),
    },
    defaultProvider: (env.AI_DEFAULT_PROVIDER || 'gpt').toLowerCase(),
  },

  menuImagePath: env.MENU_IMAGE_PATH ? path.resolve(root, env.MENU_IMAGE_PATH) : path.join(publicDir, 'assets', 'floch-menu.jpg'),
  menuShowRestricted: bool(env.MENU_SHOW_RESTRICTED, false),
  waLogLevel: env.WA_LOG_LEVEL || 'silent',
};
