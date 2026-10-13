'use strict';

/** Dataset game (kata umum Indonesia + negara). Kecil namun akurat; mudah diperluas. */

const WORDS = [
  ['apel', 'buah berwarna merah/hijau'], ['mangga', 'buah tropis berbiji besar'], ['pisang', 'buah berkulit kuning'], ['jeruk', 'buah penuh vitamin C'],
  ['semangka', 'buah besar berwarna merah di dalam'], ['durian', 'raja buah berduri'], ['nanas', 'buah bermahkota daun'], ['kelapa', 'pohon di pantai tropis'],
  ['kucing', 'hewan peliharaan yang mengeong'], ['anjing', 'sahabat manusia yang menggonggong'], ['gajah', 'hewan darat terbesar, berbelalai'], ['harimau', 'kucing besar bergaris'],
  ['kelinci', 'hewan bertelinga panjang'], ['jerapah', 'hewan berleher panjang'], ['buaya', 'reptil air bergigi tajam'], ['elang', 'burung pemburu bersayap lebar'],
  ['sepeda', 'kendaraan roda dua dikayuh'], ['pesawat', 'kendaraan terbang'], ['kereta', 'kendaraan di atas rel'], ['perahu', 'kendaraan di air'],
  ['jakarta', 'ibu kota Indonesia (saat ini kota administratif terbesar)'], ['bandung', 'kota kembang di Jawa Barat'], ['surabaya', 'kota pahlawan'], ['yogyakarta', 'kota pelajar dan keraton'],
  ['meja', 'perabot untuk menaruh barang'], ['kursi', 'tempat duduk'], ['lemari', 'tempat menyimpan baju'], ['jendela', 'bukaan di dinding untuk cahaya'],
  ['buku', 'kumpulan halaman untuk dibaca'], ['pensil', 'alat tulis yang bisa dihapus'], ['penghapus', 'pasangan pensil'], ['sekolah', 'tempat belajar'],
  ['matahari', 'bintang pusat tata surya'], ['bulan', 'satelit alami Bumi'], ['pelangi', 'lengkung warna setelah hujan'], ['gunung', 'dataran sangat tinggi'],
  ['komputer', 'mesin pengolah data'], ['telepon', 'alat bicara jarak jauh'], ['televisi', 'perangkat menonton siaran'], ['kamera', 'alat memotret'],
  ['rendang', 'masakan daging dari Sumatera Barat'], ['sambal', 'pelengkap makanan yang pedas'], ['tempe', 'makanan fermentasi kedelai'], ['gudeg', 'masakan nangka muda khas Yogyakarta'],
];

const FLAGS = [
  ['ID', ['indonesia']], ['MY', ['malaysia']], ['SG', ['singapura', 'singapore']], ['JP', ['jepang', 'japan']], ['KR', ['korea selatan', 'korea', 'south korea']],
  ['CN', ['china', 'tiongkok', 'cina']], ['IN', ['india']], ['TH', ['thailand']], ['VN', ['vietnam']], ['PH', ['filipina', 'philippines']],
  ['AU', ['australia']], ['NZ', ['selandia baru', 'new zealand']], ['US', ['amerika serikat', 'amerika', 'usa', 'united states']], ['CA', ['kanada', 'canada']],
  ['BR', ['brasil', 'brazil']], ['AR', ['argentina']], ['MX', ['meksiko', 'mexico']], ['GB', ['inggris', 'britania raya', 'united kingdom', 'uk']],
  ['FR', ['prancis', 'perancis', 'france']], ['DE', ['jerman', 'germany']], ['IT', ['italia', 'italy']], ['ES', ['spanyol', 'spain']],
  ['NL', ['belanda', 'netherlands']], ['RU', ['rusia', 'russia']], ['TR', ['turki', 'turkey', 'turkiye']], ['SA', ['arab saudi', 'saudi arabia']],
  ['EG', ['mesir', 'egypt']], ['ZA', ['afrika selatan', 'south africa']], ['NG', ['nigeria']], ['KE', ['kenya']], ['PT', ['portugal']],
  ['SE', ['swedia', 'sweden']], ['NO', ['norwegia', 'norway']], ['CH', ['swiss', 'switzerland']], ['GR', ['yunani', 'greece']], ['PK', ['pakistan']],
  ['BD', ['bangladesh']], ['KH', ['kamboja', 'cambodia']], ['LA', ['laos']], ['MM', ['myanmar', 'burma']],
].map(([code, names]) => ({ code, names, flag: String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) }));

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

module.exports = { WORDS, FLAGS, norm };
