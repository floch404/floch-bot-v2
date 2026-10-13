# Status Command FLOCH BOT

_Dibuat otomatis oleh `npm run report` dari registry. Jangan edit manual._

- Terdaftar: **320** nama · Aktif (tampil di menu): **156**
- tested: 133 · implemented: 23 · needs_config: 7 · planned: 157

**tested** = kode lengkap + lulus tes otomatis (WhatsApp/jaringan disimulasikan). **implemented** = kode lengkap, hanya diuji dengan tiruan; belum dicoba ke layanan sungguhan.
**needs_config** = butuh API key/verifikasi; aktif hanya jika dikonfigurasi. **planned** = BELUM ada; tidak tampil di menu dan tidak dihitung.

## AI (2/12 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .AI | needs_config (nonaktif) | public | Tanya AI (AI). Butuh OPENAI_API_KEY (atau provider default lain). |
| .AIChara | planned | public | Belum diimplementasikan. |
| .DeepSeek | needs_config (nonaktif) | public | Tanya AI (DeepSeek). Butuh DEEPSEEK_API_KEY. |
| .Gemini | needs_config (nonaktif) | public | Tanya AI (Gemini). Butuh GEMINI_API_KEY. |
| .Gemma | needs_config (nonaktif) | public | Tanya AI (Gemma). Butuh GEMMA_API_KEY. |
| .GPT | needs_config (nonaktif) | public | Tanya AI (GPT). Butuh OPENAI_API_KEY. |
| .JadiAnime | planned | public | Belum diimplementasikan. |
| .JadiAnimeV2 | planned | public | Belum diimplementasikan. |
| .JadiGhibli | planned | public | Belum diimplementasikan. |
| .LLM | needs_config (nonaktif) | public | Tanya AI (LLM). Butuh LLM_API_KEY / LLM_BASE_URL. |
| .ResetAI | tested | public | Hapus konteks percakapan AI milikmu (chat pribadi) |
| .ResetAIGroup | tested | public, grup, admin grup | Hapus konteks AI grup ini (khusus admin grup) |

## BOT (16/33 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .AnswerCall | planned | public | Belum diimplementasikan. |
| .AutoClear | planned | public | Belum diimplementasikan. |
| .AutoDelete | planned | public | Belum diimplementasikan. |
| .AutoRead | tested | owner | Tandai pesan masuk sebagai sudah dibaca |
| .Bot | tested | public | Cek apakah bot aktif |
| .BotInfo | tested | public | Informasi bot: versi, runtime, jumlah command aktif |
| .BotOfficial | planned | public | Belum diimplementasikan. |
| .BotSettings | tested | owner | Lihat atau ubah pengaturan global bot (Owner) |
| .ClearChat | planned | public | Belum diimplementasikan. |
| .DeleteChat | planned | public | Belum diimplementasikan. |
| .GetPrivacySetting | implemented | owner | Lihat pengaturan privasi akun WhatsApp bot (Owner) |
| .GoStats | planned | public | Belum diimplementasikan. |
| .GroupMode | tested | owner | Group mode: chat pribadi diabaikan (kecuali Owner) |
| .JadiBot | planned | public | Belum diimplementasikan. |
| .JoinMode | tested | owner | Aktif/nonaktifkan command .join |
| .ListGroup | implemented | owner | Daftar grup tempat bot bergabung (Owner) |
| .MsgStats | tested | public | Statistik pesan di chat ini |
| .NSFW | tested | public | Kebijakan konten dewasa bot (kontrol moderasi, bukan konten) |
| .Pacing | tested | owner | Jeda sebelum membalas (ms, 0-5000) agar tidak terlalu cepat |
| .RejectCall | tested | owner | Tolak panggilan masuk otomatis |
| .ResetPassword | planned | public | Belum diimplementasikan. |
| .runtime | tested | public | Lama bot berjalan |
| .ScanBot | tested | owner | Pemeriksaan kesehatan bot: sesi, database, registry (Owner) |
| .SelfMode | tested | owner | Self mode: hanya Owner yang dilayani |
| .SetBotName | planned | public | Belum diimplementasikan. |
| .SetBotOwner | planned | public | Belum diimplementasikan. |
| .SetPP | planned | public | Belum diimplementasikan. |
| .SetPrivacy | planned | public | Belum diimplementasikan. |
| .Stats | tested | public | Statistik pemakaian bot (nyata dari database) |
| .TrackBot | planned | public | Belum diimplementasikan. |
| .UpCH | planned | public | Belum diimplementasikan. |
| .UpSW | planned | public | Belum diimplementasikan. |
| .UpSW2 | planned | public | Belum diimplementasikan. |

## DOWNLOADER (0/20 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .CapCut | planned | public | Belum diimplementasikan. |
| .Douyin | planned | public | Belum diimplementasikan. |
| .Downloader | planned | public | Belum diimplementasikan. |
| .DownloadStickerPack | planned | public | Belum diimplementasikan. |
| .Facebook | planned | public | Belum diimplementasikan. |
| .GDrive | planned | public | Belum diimplementasikan. |
| .Gist | planned | public | Belum diimplementasikan. |
| .Gofile | planned | public | Belum diimplementasikan. |
| .Instagram | planned | public | Belum diimplementasikan. |
| .MediaFire | planned | public | Belum diimplementasikan. |
| .Pastebin | planned | public | Belum diimplementasikan. |
| .PinterestDownloader | planned | public | Belum diimplementasikan. |
| .PixelDrain | planned | public | Belum diimplementasikan. |
| .Pixiv | planned | public | Belum diimplementasikan. |
| .TelegramSticker | planned | public | Belum diimplementasikan. |
| .TelegramStickerV2 | planned | public | Belum diimplementasikan. |
| .Threads | planned | public | Belum diimplementasikan. |
| .TikTok | planned | public | Belum diimplementasikan. |
| .Twitter | planned | public | Belum diimplementasikan. |
| .Xiaohongshu | planned | public | Belum diimplementasikan. |

## FUN (8/9 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .Cek | tested | public | Cek "seberapa" sesuatu (hiburan, hasil stabil per teks) |
| .Dadu | tested | public | Lempar dadu (1-5 dadu) |
| .Fact | tested | public | Fakta acak |
| .Koin | tested | public | Lempar koin |
| .Meme | planned | public | Belum diimplementasikan. |
| .Reaction | implemented | public | Bot memberi reaksi emoji pada pesan yang di-reply |
| .Roast | tested | public | Ledekan ringan dan lucu (aman, tanpa menyerang identitas) |
| .Ship | tested | public | Kecocokan dua orang (hiburan) |
| .Suit | tested | public | Suit batu-gunting-kertas lawan bot |

## GAME (14/24 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .AsahOtak | planned | public | Belum diimplementasikan. |
| .Badges | tested | public | Lencana game (dihitung dari statistik nyata) |
| .CakLontong | planned | public | Belum diimplementasikan. |
| .GameLimit | tested | public | Sisa limit game harianmu |
| .GameStats | tested | public | Statistik game kamu (atau yang di-tag) |
| .GlobalLeaderboard | tested | public | Peringkat poin seluruh pengguna bot |
| .GroupAchievements | planned | public | Belum diimplementasikan. |
| .GroupCarry | planned | public | Belum diimplementasikan. |
| .GroupCompare | planned | public | Belum diimplementasikan. |
| .GroupContrib | planned | public | Belum diimplementasikan. |
| .GroupMVP | tested | public, grup | Pemain dengan poin terbanyak di grup ini |
| .GroupStats | tested | public, grup | Statistik game grup ini |
| .Leaderboard | tested | public | Peringkat poin di grup ini / chat pribadi |
| .Math | tested | public | Soal matematika cepat (easy/medium/hard) |
| .ProfileGame | tested | public | Profil game: statistik + lencana |
| .Rival | planned | public | Belum diimplementasikan. |
| .SiapakahAku | planned | public | Belum diimplementasikan. |
| .SusunKata | tested | public | Susun huruf acak menjadi kata yang benar |
| .TebakBendera | tested | public | Tebak negara dari emoji bendera |
| .TebakBom | tested | public | Pilih kotak aman; hindari bom virtual 💥 |
| .TebakGambar | planned | public | Belum diimplementasikan. |
| .TebakKata | tested | public | Tebak kata dari petunjuk dan huruf pertama |
| .TebakLirik | planned | public | Belum diimplementasikan. |
| .TicTacToe | tested | public | Tic-tac-toe melawan bot, atau lawan teman dengan tag |

## GENERAL (16/16 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .About | tested | public | Tentang FLOCH BOT |
| .CekBenefit | tested | public | Benefit Premium dan limit harian kamu |
| .Daily | tested | public | Klaim bonus limit harian |
| .Donatur | tested | public | Info dukungan/donasi untuk bot |
| .Help | tested | public | Bantuan otomatis dari registry command |
| .Join | implemented | premium | Minta bot bergabung ke grup lewat link undangan |
| .Limit | tested | public | Cek sisa limit harian |
| .Menu | tested | public | Tampilkan daftar command aktif (.menu <kategori> untuk satu kategori) |
| .NSFW | tested | public | Kebijakan konten dewasa bot (kontrol moderasi, bukan konten) |
| .Owner | tested | public | Info Owner dan Developer |
| .Ping | tested | public | Cek respons bot dan waktu responsnya |
| .Premium | tested | public | Info Premium dan cara mendapatkannya |
| .Redeem | tested | public | Tukar kode redeem menjadi Premium |
| .runtime | tested | public | Lama bot berjalan |
| .sc | tested | public | Informasi source code |
| .Top | tested | public | Command dan pengguna paling aktif (statistik nyata) |

## GROUP (54/74 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .Add | implemented | public, grup, admin grup, bot admin | Tambahkan anggota lewat nomor |
| .AdminOnly | tested | public, grup, admin grup | Bot hanya merespons admin grup di grup ini |
| .Adzan | planned | public | Belum diimplementasikan. |
| .AntiBot | planned | public | Belum diimplementasikan. |
| .AntiBug | planned | public | Belum diimplementasikan. |
| .AntiCall | planned | public | Belum diimplementasikan. |
| .AntiHideTag | planned | public | Belum diimplementasikan. |
| .AntiLink | tested | public, grup, admin grup | Hapus pesan berisi tautan dari non-admin dan beri peringatan |
| .AntiMedia | tested | public, grup, admin grup | Hapus media (gambar/video/stiker) dari non-admin |
| .AntiNSFWMedia | planned | public | Belum diimplementasikan. |
| .AntiSpam | tested | public, grup, admin grup | Peringatkan anggota yang mengirim pesan terlalu cepat |
| .AntiSW | planned | public | Belum diimplementasikan. |
| .AntiTagSw | planned | public | Belum diimplementasikan. |
| .AutoRespon | tested | public, grup, admin grup | Balasan otomatis: .autorespon add <pemicu> / <balasan>, del <pemicu>, list |
| .BadWord | tested | public, grup, admin grup | Kelola kata terlarang: .badword on/off/add <kata>/del <kata>/list |
| .BanChat | tested | public, grup, admin grup | Bot mengabaikan semua command di grup ini (hanya Owner yang dapat memakai bot) |
| .BanList | tested | owner | Daftar pengguna dan chat yang diblokir secara global |
| .BanMember | implemented | public, grup, admin grup, bot admin | Ban anggota dari grup: dikeluarkan dan dikeluarkan lagi bila masuk (bot admin) |
| .CekBotAdmin | tested | public, grup | Cek apakah bot admin di grup ini |
| .CekTanpaGrup | planned | public | Belum diimplementasikan. |
| .Close | implemented | public, grup, admin grup, bot admin | Tutup grup (hanya admin boleh kirim pesan) |
| .Cmd | planned | public | Belum diimplementasikan. |
| .DebugPriority | planned | public | Belum diimplementasikan. |
| .Delete | implemented | public, grup, admin grup, bot admin | Hapus pesan yang di-reply (bot harus admin) |
| .Demote | implemented | public, grup, admin grup, bot admin | Cabut admin grup |
| .Ephemeral | implemented | public, grup, admin grup, bot admin | Atur pesan sementara: off, 24h, 7d, 90d |
| .Goodbye | tested | public, grup, admin grup | Pesan perpisahan saat anggota keluar |
| .GroupID | tested | public, grup | Tampilkan ID grup |
| .GroupInfo | implemented | public, grup | Info grup ini |
| .GroupPrefix | tested | public, grup, admin grup | Atur prefix tambahan khusus grup ("reset" untuk menghapus) |
| .GroupSettings | tested | public, grup | Ringkasan pengaturan bot di grup ini |
| .GStats | tested | public, grup | Statistik pesan grup ini |
| .HideTag | implemented | public, grup, admin grup | Kirim pesan yang me-mention semua anggota tanpa menampilkan daftar (batas 1x per 60 detik) |
| .Info | planned | public | Belum diimplementasikan. |
| .Jockey | planned | public | Belum diimplementasikan. |
| .JoinReq | planned | public | Belum diimplementasikan. |
| .LeaveGroup | implemented | public, grup, admin grup | Bot keluar dari grup ini (tambahkan "ya" untuk konfirmasi) |
| .Left | planned | public | Belum diimplementasikan. |
| .LinkGC | implemented | public, grup, admin grup, bot admin | Tampilkan tautan undangan grup |
| .ListAktif | tested | public, grup, admin grup | Anggota yang pernah terlihat mengirim pesan (data sejak bot bergabung) |
| .ListBanMember | tested | public, grup, admin grup | Daftar anggota yang di-ban dari grup ini |
| .ListMute | tested | public, grup, admin grup | Daftar anggota yang dibisukan |
| .ListTimezone | tested | public | Daftar zona waktu yang didukung |
| .ListWarning | tested | public, grup, admin grup | Daftar anggota yang punya peringatan |
| .MuteMember | tested | public, grup, admin grup | Bisukan anggota: pesannya dihapus otomatis (bot harus admin) |
| .NSFW | tested | public | Kebijakan konten dewasa bot (kontrol moderasi, bukan konten) |
| .Open | implemented | public, grup, admin grup, bot admin | Buka grup (semua anggota boleh kirim pesan) |
| .PinMsg | planned | public | Belum diimplementasikan. |
| .Promote | implemented | public, grup, admin grup, bot admin | Jadikan anggota admin grup |
| .Remove | implemented | public, grup, admin grup, bot admin | Keluarkan anggota |
| .ResetWarn | tested | public, grup, admin grup | Reset peringatan anggota |
| .Revoke | implemented | public, grup, admin grup, bot admin | Reset tautan undangan grup (tautan lama tidak berlaku) |
| .ScheduleGroup | planned | public | Belum diimplementasikan. |
| .SetDesc | implemented | public, grup, admin grup, bot admin | Ubah deskripsi grup |
| .SetGoodbye | tested | public, grup, admin grup | Atur teks perpisahan |
| .SetLang | tested | public, grup, admin grup | Atur bahasa grup (saat ini hanya id) |
| .SetPPGC | planned | public | Belum diimplementasikan. |
| .SetSubject | implemented | public, grup, admin grup, bot admin | Ubah nama grup |
| .SetTimezone | tested | public, grup, admin grup | Atur zona waktu grup (lihat .listtimezone) |
| .SetWelcome | tested | public, grup, admin grup | Atur teks sambutan |
| .Sider | tested | public, grup, admin grup | Anggota yang belum pernah terlihat mengirim pesan sejak bot bergabung |
| .SimulateGoodbye | tested | public, grup, admin grup | Pratinjau pesan perpisahan (tidak mengirim ke anggota lain) |
| .SimulateWelcome | tested | public, grup, admin grup | Pratinjau pesan sambutan (tidak mengirim ke anggota lain) |
| .SyncGroup | tested | public, grup, admin grup | Muat ulang data grup dari WhatsApp (bersihkan cache) |
| .TagAll | implemented | public, grup, admin grup | Mention semua anggota grup (batas 1x per 60 detik) |
| .TopActive | tested | public, grup | Anggota paling aktif (jumlah pesan sejak bot bergabung) |
| .UnbanChat | tested | owner | Cabut ban chat (Owner) |
| .UnbanMember | tested | public, grup, admin grup | Cabut ban anggota grup |
| .UnmuteMember | tested | public, grup, admin grup | Cabut pembisuan anggota |
| .UnpinMsg | planned | public | Belum diimplementasikan. |
| .UpSWGC | planned | public | Belum diimplementasikan. |
| .Warn | tested | public, grup, admin grup | Beri peringatan ke anggota (mencapai batas = dikeluarkan jika bot admin) |
| .Warnings | tested | public, grup | Cek jumlah peringatan seorang anggota (atau dirimu) |
| .Welcome | tested | public, grup, admin grup | Sambut anggota baru |

## MEDIA (0/3 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .FakeThumbnail | planned | public | Belum diimplementasikan. |
| .PhotoLive | planned | public | Belum diimplementasikan. |
| .TopTV | planned | public | Belum diimplementasikan. |

## MINIGAME (0/14 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .2048 | planned | public | Belum diimplementasikan. |
| .Breakout | planned | public | Belum diimplementasikan. |
| .Chess | planned | public | Belum diimplementasikan. |
| .DinoRun | planned | public | Belum diimplementasikan. |
| .FlappyBird | planned | public | Belum diimplementasikan. |
| .Frogger | planned | public | Belum diimplementasikan. |
| .Galaga | planned | public | Belum diimplementasikan. |
| .Minesweeper | planned | public | Belum diimplementasikan. |
| .MiniGame | planned | public | Belum diimplementasikan. |
| .Pacman | planned | public | Belum diimplementasikan. |
| .Racing | planned | public | Belum diimplementasikan. |
| .Snake | planned | public | Belum diimplementasikan. |
| .Sudoku | planned | public | Belum diimplementasikan. |
| .Tetris | planned | public | Belum diimplementasikan. |

## MUSIC (0/5 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .AmazonMusic | planned | public | Belum diimplementasikan. |
| .Play | planned | public | Belum diimplementasikan. |
| .Spotify | planned | public | Belum diimplementasikan. |
| .Tidal | planned | public | Belum diimplementasikan. |
| .YtMusic | planned | public | Belum diimplementasikan. |

## OWNER (11/11 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .AddAdmin | tested | owner | Angkat pengguna menjadi Admin bot |
| .AddPremium | tested | admin | Beri/perpanjang Premium (default 30 hari) |
| .BanList | tested | owner | Daftar pengguna dan chat yang diblokir secara global |
| .BanUser | tested | owner | Blokir pengguna dari semua command bot (perlu konfirmasi) |
| .DelAdmin | tested | owner | Cabut Admin bot (perlu konfirmasi) |
| .DelPremium | tested | admin | Cabut Premium (perlu konfirmasi) |
| .GenRedeem | tested | owner | Buat kode redeem Premium |
| .ListAdmin | tested | owner | Daftar Admin bot |
| .ListPremium | tested | admin | Daftar Premium aktif |
| .RoleLog | tested | owner | Riwayat perubahan role/Premium |
| .UnbanUser | tested | owner | Buka blokir pengguna |

## PROFILE (11/11 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .AFK | tested | public | Tandai dirimu sedang AFK |
| .CekPremium | tested | public | Cek status Premium kamu |
| .ChangePassword | tested | public | Info: bot tidak memakai password |
| .GetPP | implemented | public | Ambil foto profil (diri sendiri / yang di-tag / di-reply) |
| .Level | tested | public | Level dan XP kamu |
| .Profile | tested | public | Lihat profil kamu |
| .SetAge | tested | public | Atur age profil kamu |
| .SetBio | tested | public | Atur bio profil kamu |
| .SetGender | tested | public | Atur gender profil kamu |
| .SetName | tested | public | Atur name profil kamu |
| .SetPrefix | tested | public | Atur prefix profil kamu |

## SEARCH (1/10 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .Google | planned | public | Belum diimplementasikan. |
| .JadwalSholat | implemented | public | Jadwal salat hari ini untuk kota di Indonesia (metode Kemenag) |
| .Lyric | planned | public | Belum diimplementasikan. |
| .Pinterest | planned | public | Belum diimplementasikan. |
| .PinterestVideo | planned | public | Belum diimplementasikan. |
| .SauceNAO | planned | public | Belum diimplementasikan. |
| .Wallhaven | planned | public | Belum diimplementasikan. |
| .WhatAnime | planned | public | Belum diimplementasikan. |
| .YtMusicSearch | planned | public | Belum diimplementasikan. |
| .YtSearch | planned | public | Belum diimplementasikan. |

## TOOLS (27/75 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .ASCII85 | tested | public | Encode/decode Ascii85 (BASE85 = Ascii85) |
| .ATBASH | tested | public | Cipher Atbash (encode = decode) |
| .AudioEffect | planned | public | Belum diimplementasikan. |
| .B32 | tested | public | Encode/decode Base32 |
| .B64 | tested | public | Encode/decode Base64 |
| .Barcode | planned | public | Belum diimplementasikan. |
| .BASE32 | tested | public | Encode/decode Base32 |
| .BASE64 | tested | public | Encode/decode Base64 |
| .BASE85 | tested | public | Encode/decode Ascii85 (BASE85 = Ascii85) |
| .BestFrame | planned | public | Belum diimplementasikan. |
| .BIN | tested | public | Encode/decode biner |
| .BINARY | tested | public | Encode/decode biner |
| .Blur | planned | public | Belum diimplementasikan. |
| .Brat | planned | public | Belum diimplementasikan. |
| .Calculator | tested | public | Kalkulator aman: + - * / % ^ ( ) sqrt abs sin cos tan log ln round floor ceil pi e |
| .CoAscii | planned | public | Belum diimplementasikan. |
| .Color | tested | public | Konversi warna HEX/RGB ke HEX, RGB, HSL |
| .Compress | planned | public | Belum diimplementasikan. |
| .Crop | planned | public | Belum diimplementasikan. |
| .Decode | tested | public | Decode teks dengan format pilihan |
| .Emojimix | planned | public | Belum diimplementasikan. |
| .Encode | tested | public | Encode teks dengan format pilihan |
| .Flip | planned | public | Belum diimplementasikan. |
| .GetEXIF | planned | public | Belum diimplementasikan. |
| .GetIDCH | planned | public | Belum diimplementasikan. |
| .GetMedia | planned | public | Belum diimplementasikan. |
| .GetMsgID | tested | public | Tampilkan ID pesan yang di-reply |
| .HEX | tested | public | Encode/decode heksadesimal |
| .HTML | tested | public | Escape/unescape HTML |
| .Humming | planned | public | Belum diimplementasikan. |
| .Iac | planned | public | Belum diimplementasikan. |
| .JadiBurik | planned | public | Belum diimplementasikan. |
| .JWT | tested | public | Decode header & payload JWT secara lokal (tanda tangan tidak diverifikasi) |
| .Lang | planned | public | Belum diimplementasikan. |
| .Lens | planned | public | Belum diimplementasikan. |
| .Lorem | tested | public | Buat teks lorem ipsum (default 30 kata, maks 200) |
| .Lower | tested | public | Ubah teks menjadi huruf kecil |
| .MediaQuality | planned | public | Belum diimplementasikan. |
| .MORSE | tested | public | Encode/decode kode Morse |
| .OCR | planned | public | Belum diimplementasikan. |
| .OCT | tested | public | Encode/decode oktal (per byte) |
| .OCTAL | tested | public | Encode/decode oktal (per byte) |
| .Pesan | planned | public | Belum diimplementasikan. |
| .Pixelate | planned | public | Belum diimplementasikan. |
| .QC | planned | public | Belum diimplementasikan. |
| .QR | planned | public | Belum diimplementasikan. |
| .ReadMore | tested | public | Buat pesan "Baca selengkapnya": pisahkan bagian dengan / |
| .ReadQRIS | planned | public | Belum diimplementasikan. |
| .RemoveBG | planned | public | Belum diimplementasikan. |
| .Resize | planned | public | Belum diimplementasikan. |
| .Reverse | tested | public | Balik urutan teks |
| .Romanize | planned | public | Belum diimplementasikan. |
| .ROT13 | tested | public | Cipher ROT13 (encode = decode) |
| .Rotate | planned | public | Belum diimplementasikan. |
| .SetQRIS | planned | public | Belum diimplementasikan. |
| .SMeme | planned | public | Belum diimplementasikan. |
| .Smooth | planned | public | Belum diimplementasikan. |
| .SSWeb | planned | public | Belum diimplementasikan. |
| .Stabilize | planned | public | Belum diimplementasikan. |
| .Sticker | planned | public | Belum diimplementasikan. |
| .Testimage | planned | public | Belum diimplementasikan. |
| .ToDocMsg | planned | public | Belum diimplementasikan. |
| .ToGif | planned | public | Belum diimplementasikan. |
| .ToImage | planned | public | Belum diimplementasikan. |
| .ToMP3 | planned | public | Belum diimplementasikan. |
| .ToVideo | planned | public | Belum diimplementasikan. |
| .Translate | planned | public | Belum diimplementasikan. |
| .Trim | planned | public | Belum diimplementasikan. |
| .TTS | planned | public | Belum diimplementasikan. |
| .TTSAI | planned | public | Belum diimplementasikan. |
| .Upload | planned | public | Belum diimplementasikan. |
| .Upper | tested | public | Ubah teks menjadi huruf besar |
| .Upscaler | planned | public | Belum diimplementasikan. |
| .URL | tested | public | Encode/decode URL (percent-encoding) |
| .WhatMusic | planned | public | Belum diimplementasikan. |

## YOUTUBE (0/10 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .Album | planned | public | Belum diimplementasikan. |
| .Play | planned | public | Belum diimplementasikan. |
| .Play2 | planned | public | Belum diimplementasikan. |
| .PlayDownloader | planned | public | Belum diimplementasikan. |
| .YouTube | planned | public | Belum diimplementasikan. |
| .YtMp3 | planned | public | Belum diimplementasikan. |
| .YtMp4 | planned | public | Belum diimplementasikan. |
| .YtMusic | planned | public | Belum diimplementasikan. |
| .YtMusicSearch | planned | public | Belum diimplementasikan. |
| .YtSearch | planned | public | Belum diimplementasikan. |

## JWS (0/1 aktif)

| Command | Status | Akses | Keterangan |
|---|---|---|---|
| .jws | needs_config (nonaktif) | premium | Random Waifu Search (gambar acak) — khusus Premium |
