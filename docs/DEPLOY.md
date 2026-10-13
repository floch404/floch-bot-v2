# Deploy FLOCH BOT

FLOCH BOT adalah **aplikasi Node.js yang harus berjalan terus** (Express + WebSocket + koneksi WhatsApp). Ia **bukan situs statis**:
GitHub Pages / hosting statis hanya akan menampilkan README dan pairing tidak akan pernah bekerja.

## Ringkasan

| Hal | Nilai |
|---|---|
| Node.js | **22.13 atau lebih baru** (memakai `node:sqlite` bawaan). `.nvmrc` = 22 |
| Build command | `npm install --omit=dev` |
| Start command | `npm start` |
| Port | dari env `PORT` (default 3000); dengarkan `0.0.0.0` |
| Health check | `GET /api/health` |
| WebSocket | wajib didukung hosting (path `/ws`, tanpa library tambahan di sisi klien) |
| Disk persisten | **wajib** untuk `DATA_DIR` (kredensial WhatsApp + database) |

## Environment variables

Wajib:

| Variabel | Isi |
|---|---|
| `OWNER_NUMBERS` | nomor Owner, digit dengan kode negara, tanpa `+` (mis. `628123456789`) |
| `DATA_DIR` | path **di disk persisten** (mis. `/var/data`) |
| `COOKIE_SECURE` | `true` bila diakses lewat HTTPS (hampir selalu, di hosting) |
| `TRUST_PROXY` | `1` bila di belakang reverse proxy hosting (agar rate limit membaca IP asli) |

Sangat disarankan: `PAIRING_ACCESS_CODE` (tanpa ini siapa pun yang membuka URL bisa memulai sesi bot), `MAX_SESSIONS` (default 3), `PUBLIC_URL`.
Opsional: kunci AI (`OPENAI_API_KEY` dst.), `JWS_*`, limit harian — lihat `.env.example`. Semua rahasia hanya di environment variables hosting, tidak pernah di JavaScript frontend atau di Git.

## Disk persisten (kenapa wajib)

Folder `DATA_DIR` berisi `wa-sessions/` (kredensial login WhatsApp), `floch.db` (role, Premium, limit, skor), dan `.session_secret`.
Jika disk hilang saat restart/deploy ulang: bot logout dan harus pairing ulang, Premium/limit/skor hilang, dan cookie pengunjung tidak lagi cocok.
Aplikasi **tidak menghapus** kredensial saat server restart; sesi dipulihkan otomatis dari disk. Kredensial hanya dihapus saat Disconnect, logout dari ponsel, atau pairing yang tidak selesai.

## Contoh platform

**Render.com** — `render.yaml` sudah disertakan (Blueprint). Disk persisten hanya ada di paket berbayar.
**VPS / PC (disarankan)** — `git clone`, `npm install --omit=dev`, isi `.env`, jalankan `pm2 start npm --name floch -- start`, pasang Nginx/Caddy untuk HTTPS dan WebSocket (`proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`).
**Docker** — `docker build -t floch-bot .` lalu `docker run -p 3000:3000 -v floch-data:/data --env-file .env floch-bot`.

## Domain

Arahkan domain ke hosting (CNAME/A sesuai panel hosting), aktifkan HTTPS, lalu set `PUBLIC_URL=https://domainmu` dan `COOKIE_SECURE=true`.
Tidak ada CORS yang dibuka: website dan API satu origin. Jangan menaruh frontend di domain lain.

## Keterbatasan hosting gratis

- Layanan yang tidur saat idle memutus WhatsApp; pesan masuk saat tidur tidak diproses.
- Tanpa disk persisten → pairing ulang setiap restart.
- Batas RAM/CPU kecil; banyak sesi bersamaan bisa membuat proses dimatikan. Turunkan `MAX_SESSIONS`.
- Beberapa penyedia melarang bot WhatsApp pada kebijakannya. Periksa syarat layanan.

## Menguji setelah deploy

1. Otomatis, tanpa nomor: `npm run smoke -- https://domainmu` (cek health, halaman pairing, CSP, perlindungan CSRF, validasi nomor, dan bahwa `.env`/`data` tidak bisa diunduh).
2. Manual (wajib; hanya bisa dilakukan kamu): buka website → pilih +62 → isi nomor bot tanpa 0 → **CONNECT WHATSAPP** → tunggu kode muncul → **SALIN KODE** → di WhatsApp: Perangkat tertaut → Tautkan perangkat → Tautkan dengan nomor telepon → masukkan kode. Status harus berubah ke **Connected** dari backend.
3. Kirim `.menu` dari nomor lain ke bot.
4. Restart layanan lewat dashboard hosting; status harus kembali **Connected** tanpa pairing ulang (membuktikan disk persisten bekerja).

## Tentang Baileys

`@whiskeysockets/baileys` adalah integrasi **pihak ketiga tidak resmi** (bukan WhatsApp Business API). Protokolnya bisa berubah sewaktu-waktu dan akun yang dipakai bisa dibatasi atau diblokir WhatsApp; gunakan nomor cadangan. Versi dipatok ke `6.7.24` (tag `legacy` di npm saat audit ini; tag `latest` saat itu adalah `7.0.0-rc14`, rilis kandidat dengan perubahan breaking, jadi sengaja tidak dipakai). Setelah `npm install` pertama, **commit `package-lock.json`** agar deploy berikutnya identik. Jika WhatsApp mengubah protokol dan pairing gagal, perbarui versi Baileys dan jalankan ulang tes + uji manual di atas.
