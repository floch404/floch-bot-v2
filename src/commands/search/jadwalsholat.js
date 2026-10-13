'use strict';

const { UserError } = require('../../core/executor');

/**
 * Jadwal salat lewat API publik Aladhan (https://aladhan.com/prayer-times-api), metode 20 = Kemenag RI.
 * Endpoint/format respons mengikuti dokumentasi Aladhan namun BELUM diuji ke jaringan sungguhan dari lingkungan
 * pengembangan (akses keluar diblokir); diuji dengan respons tiruan. Lokasi = kota yang diketik pengguna.
 */
const NAMES = [['Fajr', 'Subuh'], ['Sunrise', 'Terbit'], ['Dhuhr', 'Dzuhur'], ['Asr', 'Ashar'], ['Maghrib', 'Maghrib'], ['Isha', 'Isya']];

async function fetchTimings(city, fetchImpl = fetch) {
  const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=Indonesia&method=20`;
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
  } catch {
    throw new UserError('Layanan jadwal salat tidak dapat dijangkau. Coba lagi nanti.');
  }
  if (!res.ok) throw new UserError(`Kota tidak ditemukan atau layanan membalas status ${res.status}.`);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new UserError('Respons layanan jadwal salat tidak dapat dibaca.');
  }
  const t = data?.data?.timings;
  if (!t || !t.Fajr) throw new UserError('Respons layanan jadwal salat tidak sesuai format yang diharapkan.');
  return { timings: t, date: data.data.date?.readable || '' };
}

module.exports = {
  name: 'jadwalsholat',
  display: 'JadwalSholat',
  category: 'SEARCH',
  description: 'Jadwal salat hari ini untuk kota di Indonesia (metode Kemenag)',
  usage: '.jadwalsholat <kota>',
  minArgs: 1,
  limit: 1,
  status: 'implemented',
  api: 'https://api.aladhan.com (tanpa API key)',
  fetchTimings,
  async run(ctx) {
    const city = ctx.argText.trim().slice(0, 40);
    if (!/^[\p{L}\s.'-]{2,40}$/u.test(city)) throw new UserError('Nama kota tidak valid.');
    const { timings, date } = await (module.exports.fetchImpl ? fetchTimings(city, module.exports.fetchImpl) : fetchTimings(city));
    const clean = (v) => String(v).replace(/\s*\(.*\)$/, '');
    await ctx.reply([`*Jadwal salat ${city}*${date ? ` — ${date}` : ''}`, ...NAMES.map(([k, label]) => `${label}: ${clean(timings[k])}`), '', 'Sumber: Aladhan (metode Kemenag RI). Jadwal bisa berbeda beberapa menit dari masjid setempat.'].join('\n'));
  },
};
