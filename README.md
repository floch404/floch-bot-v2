# FLOCH BOT

Owner: floch · Developer: floch

Website pairing WhatsApp + bot WhatsApp (Node.js, Express, SQLite, library tidak resmi **Baileys**).

- **Website** hanya untuk menghubungkan WhatsApp lewat *pairing code* dan melihat status koneksi. Tidak ada login, tidak ada halaman Admin/Premium/JWS.
- **Semua fitur lain** (menu, role Owner/Admin/Premium, redeem, JWS, game, moderasi grup) hidup di bot WhatsApp.

> Baileys memakai protokol WhatsApp Web yang **tidak resmi**. Akun yang dipakai bot bisa dibatasi atau diblokir WhatsApp. Pakai nomor cadangan, bukan nomor utama.

---

## 1. Status proyek (baca ini dulu)

Yang **sudah diuji otomatis** (`npm test`, 154 tes lulus) — dengan WhatsApp, jaringan, dan API **ditiru**:

- registry command, pipeline izin/limit/handler, menu (format header, gambar sebagai media, pemecahan pesan, fallback teks)
- role Owner/Admin/Premium aktif/Premium kedaluwarsa/user biasa, redeem, limit harian, persistensi database
- `.jws` untuk keempat tipe pengguna (dengan API tiruan)
- game, perintah grup & moderasi, perintah bot (Owner), perintah tools/fun, AI (fetch tiruan), jadwal salat (fetch tiruan)
- session manager (alur pairing → connected → restart → logout → reconnect) dengan Baileys tiruan
- pairing service, cookie pengunjung
- website di Chromium headless dengan API tiruan: intro + lewati, validasi, kode pairing, salin kode, generate ulang, status via WebSocket, disconnect, CSP tanpa pelanggaran, tampilan 390 px, reduced-motion

Yang **belum pernah dijalankan** (lingkungan pengembangan tidak bisa memasang paket npm maupun menjangkau WhatsApp):

- koneksi **Baileys sungguhan** (pairing code asli, kirim/terima pesan, perintah grup ke WhatsApp sungguhan)
- **Express** sungguhan (file `src/app.js` hanya diuji kabelnya dengan Express tiruan; website diuji dengan server tiruan memakai middleware CSP yang sama)
- API sungguhan: randomwaifu.com, Aladhan, penyedia AI

Jadi: jalankan sendiri `npm install`, lalu cek alur pairing di perangkatmu sebelum menganggapnya siap pakai. Perintah yang butuh WhatsApp sungguhan berstatus `implemented`, bukan `tested`.

**Gambar menu tidak disertakan.** Gambar Floch Forster adalah karakter berhak cipta; letakkan sendiri file gambar yang kamu punya hak pakainya di `public/assets/floch-menu.jpg` (atau atur `MENU_IMAGE_PATH`). Tanpa file itu, `.menu` mengirim teks saja. Gambar hanya dipakai di pesan `.menu`, tidak di website.

**Dua video referensi** yang disebut di spesifikasi tidak pernah saya terima; daftar command dibuat dari inventaris teks (`src/commands/_inventory.js`).

### Jumlah command (angka nyata dari registry)

Total nama di inventaris: **320**. Aktif dan tampil di menu: **156**. Sisanya (**157**) berstatus `planned` dan **tidak** tampil di menu, tidak dihitung di *Total Cmd*, dan menjawab "belum diimplementasikan" bila dipanggil. Perincian per kategori dan per command ada di [`docs/COMMAND_STATUS.md`](docs/COMMAND_STATUS.md) (dibuat dengan `npm run report`).

Belum ada sama sekali: kategori DOWNLOADER, MEDIA (stiker dsb.), MINIGAME, MUSIC, YOUTUBE, sebagian besar SEARCH, dan sebagian TOOLS/GROUP/BOT/AI/GAME. Menambahnya = membuat file di `src/commands/<kategori>/` (lihat bagian 9).

Status command:

| Status | Arti |
|---|---|
| `tested` | kode lengkap dan lulus tes otomatis (dunia luar ditiru) |
| `implemented` | kode lengkap, hanya diuji dengan tiruan; belum dicoba ke layanan sungguhan |
| `needs_config` | butuh API key/verifikasi; aktif di menu hanya bila terkonfigurasi |
| `planned` | belum ada; tidak tampil dan tidak dihitung |

---

## 2. Kebutuhan

- **Node.js ≥ 22.13** (memakai `node:sqlite` bawaan, jadi tanpa kompilasi native)
- npm, koneksi internet
- Nomor WhatsApp untuk bot

## 3. Instalasi di PC (Windows/macOS/Linux)

```bash
git clone <repo-kamu> floch-bot   # atau ekstrak zip
cd floch-bot
npm install
cp .env.example .env              # Windows: copy .env.example .env
```

Edit `.env`, minimal:

```
OWNER_NUMBERS=628xxxxxxxxxx       # nomor Owner (digit, kode negara, tanpa +)
PUBLIC_URL=http://localhost:3000
```

Jalankan:

```bash
npm start
```

Buka `http://localhost:3000`, tekan **CONNECT WHATSAPP**, pilih kode negara (default +62), isi nomor tanpa 0 di depan, tekan **GENERATE PAIRING CODE**.

Di ponsel dengan nomor itu: WhatsApp → **Perangkat tertaut** → **Tautkan perangkat** → **Tautkan dengan nomor telepon** → masukkan kode. Status berubah menjadi **Connected**. Kirim `.menu` ke bot dari chat WhatsApp lain.

Agar bot hidup terus: jalankan di server/VPS (mis. `pm2 start npm --name floch -- start`) atau biarkan terminal terbuka.

## 4. Instalasi di Android (Termux)

Pasang **Termux dari F-Droid** (versi Play Store usang).

```bash
pkg update && pkg upgrade -y
pkg install nodejs git -y        # pastikan: node -v  => 22.13 atau lebih baru
git clone <repo-kamu> floch-bot && cd floch-bot
npm install
cp .env.example .env && nano .env
npm start
```

Lalu buka `http://localhost:3000` di browser ponsel yang sama. Catatan:

- Jika `node -v` di bawah 22.13, bot tidak bisa jalan (butuh `node:sqlite`). Alternatif: pakai proot-distro (Debian/Ubuntu) lalu pasang Node 22 dari NodeSource, atau jalankan di PC/VPS.
- Matikan penghematan baterai untuk Termux dan jalankan `termux-wake-lock` agar proses tidak dibunuh Android.
- Nomor bot dipairing lewat WhatsApp di ponsel lain (atau ponsel yang sama bila nomornya memang yang ingin dijadikan bot); gunakan nomor cadangan.

## 5. Deployment (hosting, disk persisten, domain)

Panduan lengkap ada di [`docs/DEPLOY.md`](docs/DEPLOY.md): build/start command, Node 22.13+, daftar environment variable, disk persisten untuk `DATA_DIR`, domain/HTTPS/WebSocket, keterbatasan hosting gratis, dan `npm run smoke -- https://domainmu` untuk uji setelah deploy. Ringkasnya: ini aplikasi Node.js yang harus hidup terus (bukan situs statis), dan folder `data/` **wajib** di disk persisten.

## 6. Konfigurasi penting (`.env`)

Lengkapnya di `.env.example`.

| Variabel | Fungsi |
|---|---|
| `OWNER_NUMBERS` | Nomor Owner. Owner **hanya** ditentukan di sini, bukan dari website |
| `PAIRING_ACCESS_CODE` | Kode akses opsional di formulir pairing. **Sangat disarankan** bila website bisa diakses umum |
| `MAX_SESSIONS` | Batas sesi WhatsApp bersamaan (default 3) |
| `PREMIUM_BYPASS_ROLES` | Role yang boleh memakai fitur Premium tanpa langganan (default `owner`) |
| `ADMIN_CAN_MANAGE_PREMIUM` | Admin bot boleh `.addpremium`/`.delpremium` (default `false`) |
| `MENU_SHOW_RESTRICTED` | `false`: menu hanya memuat command yang boleh dipakai pengirim |
| `MENU_IMAGE_PATH` | Lokasi gambar menu |
| `COMMAND_COOLDOWN_MS` | Jeda minimum antar command per pengguna |
| `DAILY_LIMIT_*`, `GAME_LIMIT_*`, `DAILY_BONUS_*` | Limit harian pengguna biasa/Premium |
| `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `GEMMA_API_KEY`, `LLM_*` | Mengaktifkan command AI terkait |
| `JWS_*` | Lihat bagian 7 |

## 7. Role dan Premium

Semua dicek **di backend setiap command dijalankan** (menyembunyikan dari menu bukan mekanisme keamanan).

- **Owner**: nomor di `OWNER_NUMBERS`. Mengelola Admin, Premium, kode redeem, ban, pengaturan bot.
- **Admin bot**: disimpan di database (`.addadmin`/`.deladmin`, hanya Owner). Admin bot **bukan** Owner dan **bukan** otomatis admin grup.
- **Admin grup WhatsApp**: dibaca dari metadata grup; terpisah dari Admin bot.
- **Premium**: punya tanggal mulai dan berakhir, tersimpan di database, otomatis kedaluwarsa. Dapat dari `.addpremium` (Owner) atau `.redeem <kode>` (kode dibuat `.genredeem`). Tidak ada pembayaran palsu; `.donatur` hanya menampilkan info dari `DONATION_INFO`.
- **User biasa**: limit harian, `.daily` untuk bonus.

Command Premium: `.premium .cekpremium .cekbenefit .redeem .limit .daily .donatur` (info untuk semua) dan fitur eksklusif seperti `.jws` dan `.join`.

## 8. Mengaktifkan `.jws`

`.jws` hanya untuk Premium aktif (dan Owner sesuai `PREMIUM_BYPASS_ROLES`), gambar dikirim sebagai **media** WhatsApp. Saat proyek ini dibuat, `https://randomwaifu.com/get/api/` tidak dapat diakses dari lingkungan pengembangan, sehingga **format respons API-nya belum pernah saya lihat** dan adaptor tidak mengarang format.

Adaptor menangani dua kemungkinan: API membalas gambar langsung (`Content-Type: image/*`), atau JSON berisi URL gambar (path diatur `JWS_JSON_PATH`, atau kunci umum `url/image/image_url/imageUrl/link/file`). Format lain ditolak dengan pesan jelas.

Di server kamu (butuh internet):

```bash
npm run check:jws
```

Skrip menguji API sungguhan dan menampilkan formatnya. Jika berhasil, JWS ditandai terverifikasi dan baru **tampil aktif di `.menu`** (tanpa perlu restart). Jika gagal, `.jws` tetap nonaktif dan menjawab bahwa fitur belum aktif. Jika JSON-nya berbeda, isi `JWS_JSON_PATH` (mis. `data.url`) lalu ulangi.

Perlindungan: hanya HTTPS, blokir alamat IP privat/localhost (anti-SSRF), batas pengalihan, batas ukuran, cek tipe gambar, cooldown per nomor, dan saklar Owner (`.botsettings jws_enabled`).

## 9. Menambah command

Buat file di `src/commands/<kategori>/` yang mengekspor satu objek atau array. Registry memuatnya otomatis, dan `.menu`, handler, izin, serta hitungan *Total Cmd* memakai registry yang sama.

```js
module.exports = {
  name: 'halo', display: 'Halo', category: 'FUN', description: 'Menyapa',
  aliases: [], permission: 'public',      // public | premium | admin | owner
  groupOnly: false, groupAdmin: false, botAdmin: false,
  minArgs: 0, limit: 1,                   // biaya limit harian
  status: 'tested',                       // atau implemented / needs_config
  examples: [{ args: '', expect: /Halo/ }], // dijalankan otomatis oleh tests/commands.test.js
  async run(ctx) { await ctx.reply('Halo!'); },
};
```

Tes otomatis menolak command berstatus `tested` yang tidak punya contoh/tes yang memanggilnya. Jalankan `npm run report` untuk memperbarui `docs/COMMAND_STATUS.md`.

## 10. Perintah npm

| Perintah | Fungsi |
|---|---|
| `npm start` | Jalankan server + bot |
| `npm test` | Jalankan seluruh tes |
| `npm run check:jws` | Uji API JWS sungguhan lalu tandai terverifikasi |
| `npm run report` | Perbarui `docs/COMMAND_STATUS.md` |
| `npm run smoke -- <url>` | Uji cepat setelah deploy (tanpa nomor) |

## 11. Keamanan

- Pengunjung website anonim; satu cookie `HttpOnly` + `SameSite=Strict` menjadi satu-satunya akses ke sesi miliknya. ID di database adalah HMAC dari token. Pengunjung lain tidak bisa melihat atau memutus sesinya, termasuk pairing code (WebSocket juga memeriksa cookie dan Origin).
- CSP ketat (`script-src 'self'`, `style-src 'self'`), header keamanan, pengecekan CSRF (`X-Requested-With` + Origin), rate limit, batas ukuran body.
- Pairing selalu mulai dari sesi bersih; nomor yang tersambung harus sama dengan yang dimasukkan.
- `data/` (kredensial WhatsApp, database, `.session_secret`) tidak pernah disajikan; jangan di-commit dan jangan dibagikan. Siapa pun yang memegang `data/wa-sessions` bisa mengendalikan akun WhatsApp bot.
- Tanpa `PAIRING_ACCESS_CODE`, siapa pun yang membuka website bisa memulai sesi (dibatasi `MAX_SESSIONS`). Isi kode akses bila website publik.

## 12. Pemecahan masalah

| Gejala | Penyebab/solusi |
|---|---|
| `node:sqlite` tidak ditemukan | Node < 22.13. Perbarui Node |
| Kode pairing tidak muncul / Error | Nomor salah, WhatsApp membatasi permintaan, atau jaringan; tekan GENERATE ULANG setelah beberapa menit. Pesan error asli ditampilkan |
| Menu tanpa gambar | `public/assets/floch-menu.jpg` belum ada (lihat bagian 1) |
| `.jws` bilang belum aktif | Jalankan `npm run check:jws` di server bot |
| Command AI belum aktif | Isi API key di `.env`, restart |
| Perintah grup menjawab "Jadikan bot sebagai admin" | Jadikan nomor bot admin grup |
| Pairing ulang terus diminta | `data/` hilang/ephemeral di hosting, atau perangkat dikeluarkan dari WhatsApp |

## 13. Struktur

```
src/
  commands/      command per kategori + _inventory.js (daftar nama dari spesifikasi)
  core/          registry, permissions, executor, moderation, targets
  services/      premium, role, limit, profile, group, game, stats, settings, jws, ai, pairing
  whatsapp/      connection (Baileys), session-manager, message-handler, group-events, hooks
  routes/ realtime/ visitors/ middleware/ database/ config/
public/          website pairing (index.html, css/, js/)
scripts/         check-jws.js, command-report.js
tests/           suite tes (node --test)
docs/            COMMAND_STATUS.md (otomatis)
```
