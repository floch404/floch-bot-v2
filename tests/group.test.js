'use strict';
const h = require('./_helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const gs = require('../src/services/group.service');

const ADM = '6288000000001';
const MEM = '6288000000002';
const VIC = '6288000000003';
let gn = 0;
const newGroup = () => `1203630000000${String(++gn).padStart(5, '0')}@g.us`;
const mkSock = (botAdmin = true) => {
  const s = h.makeSock({ participants: [ADM, MEM, VIC] });
  s.groupAdmins = new Set([ADM, ...(botAdmin ? [h.BOT] : [])]);
  return s;
};
const g = (text, { from = ADM, group, sock = mkSock(), ...rest } = {}) => h.say(text, { from, group, sock, ...rest });

test('.groupid .cekbotadmin .syncgroup .groupinfo', async () => {
  const G = newGroup();
  assert.equal((await g('.groupid', { group: G })).text, G);
  assert.match((await g('.cekbotadmin', { group: G })).text, /Bot adalah admin/);
  assert.match((await g('.cekbotadmin', { group: G, sock: mkSock(false) })).text, /bukan admin/);
  assert.match((await g('.syncgroup', { group: G })).text, /dimuat ulang/);
  assert.match((await g('.syncgroup', { group: G, from: MEM })).text, /khusus admin grup/);
  assert.match((await g('.groupinfo', { group: G })).text, /Grup Tes[\s\S]*Anggota: 7/);
  assert.match((await g('.groupid')).text, /hanya dapat dipakai di dalam grup/);
});

test('izin: command admin grup ditolak untuk anggota biasa (backend), bot non-admin ditolak untuk aksi bot', async () => {
  const G = newGroup();
  for (const c of ['.close', '.open', '.tagall', '.warn', '.antilink on', '.welcome on', '.mutemember', '.banmember']) {
    const r = await g(c, { group: G, from: MEM });
    assert.match(r.text, /khusus admin grup/, c);
  }
  assert.match((await g(`.remove ${VIC}`, { group: G, sock: mkSock(false) })).text, /Jadikan bot sebagai admin/);
});

test('.open .close mengirim pengaturan nyata ke WhatsApp; kegagalan WhatsApp dilaporkan jujur', async () => {
  const G = newGroup();
  const s = mkSock();
  assert.match((await g('.close', { group: G, sock: s })).text, /ditutup/);
  assert.deepEqual(s.calls.at(-1), ['setting', 'announcement']);
  assert.match((await g('.open', { group: G, sock: s })).text, /dibuka/);
  assert.deepEqual(s.calls.at(-1), ['setting', 'not_announcement']);
  const bad = mkSock();
  bad.groupSettingUpdate = async () => { throw new Error('forbidden'); };
  assert.match((await g('.close', { group: G, sock: bad })).text, /menolak/);
});

test('.add .remove .promote .demote: hasil per nomor dari WhatsApp; admin lain dan bot tidak bisa di-remove', async () => {
  const G = newGroup();
  const s = mkSock();
  assert.match((await g(`.promote ${VIC}`, { group: G, sock: s })).text, /Dijadikan admin grup: @6288000000003/);
  assert.deepEqual(s.calls.at(-1), ['participants', 'promote', [`${VIC}@s.whatsapp.net`]]);
  assert.match((await g(`.demote ${VIC}`, { group: G, sock: s })).text, /Dicabut/);
  assert.match((await g(`.add 6288000000077`, { group: G, sock: s })).text, /Ditambahkan/);
  assert.match((await g(`.remove ${MEM}`, { group: G, sock: s })).text, /Dikeluarkan/);
  assert.match((await g(`.remove ${h.BOT}`, { group: G, sock: s })).text, /Tidak bisa mengeluarkan/);
  const s2 = mkSock();
  s2.groupAdmins.add(MEM);
  assert.match((await g(`.remove ${MEM}`, { group: G, sock: s2 })).text, /Tidak bisa mengeluarkan/);
  const s3 = mkSock();
  s3.participantsResult = [{ jid: `${VIC}@s.whatsapp.net`, status: '403' }];
  const r = await g(`.remove ${VIC}`, { group: G, sock: s3 });
  assert.match(r.text, /Gagal: 6288000000003 \(kode 403\)/);
  assert.doesNotMatch(r.text, /Dikeluarkan/);
  assert.match((await g('.remove', { group: G })).text, /Target tidak ditemukan/);
});

test('.delete .tagall .hidetag .linkgc .revoke .setsubject .setdesc .ephemeral', async () => {
  const G = newGroup();
  const s = mkSock();
  assert.match((await g('.delete', { group: G, sock: s })).text, /Reply pesan/);
  const d = await g('.delete', { group: G, sock: s, quoted: { sender: MEM, text: 'hapus aku' } });
  assert.ok(d.sock.sent.some((x) => x.content.delete));
  const t = await g('.tagall halo', { group: G, sock: s });
  assert.deepEqual(t.sock.sent.at(-1).content.mentions.length, 7);
  assert.match((await g('.tagall lagi', { group: G, sock: s, sess: undefined })).text, /Tunggu|📢/);
  assert.match((await g('.hidetag pengumuman', { group: G, sock: s })).sock.sent.at(-1).content.text, /pengumuman/);
  assert.match((await g('.linkgc', { group: G })).text, /chat\.whatsapp\.com\/ABC123/);
  s.groupRevokeInvite = async () => 'NEW999';
  assert.match((await g('.revoke', { group: G, sock: s })).text, /NEW999/);
  assert.match((await g('.setsubject Nama Baru', { group: G, sock: s })).text, /diperbarui/);
  assert.deepEqual(s.calls.at(-1), ['subject', 'Nama Baru']);
  s.groupUpdateDescription = async () => {};
  assert.match((await g('.setdesc deskripsi baru', { group: G, sock: s })).text, /diperbarui/);
  s.groupToggleEphemeral = async (j, v) => s.calls.push(['eph', v]);
  assert.match((await g('.ephemeral 7d', { group: G, sock: s })).text, /7d/);
  assert.deepEqual(s.calls.at(-1), ['eph', 604800]);
  assert.match((await g('.ephemeral x', { group: G, sock: s })).text, /Pilihan/);
});

test('.leavegroup butuh konfirmasi', async () => {
  const s = mkSock();
  s.groupLeave = async () => s.calls.push(['leave']);
  const G = newGroup();
  assert.match((await g('.leavegroup', { group: G, sock: s })).text, /konfirmasi/);
  assert.equal(s.calls.length, 0);
  await g('.leavegroup ya', { group: G, sock: s });
  assert.deepEqual(s.calls.at(-1), ['leave']);
});

test('.warn .warnings .resetwarn .listwarning: batas peringatan mengeluarkan anggota hanya jika bot admin', async () => {
  const G = newGroup();
  const s = mkSock();
  for (let i = 1; i <= 2; i++) assert.match((await g(`.warn ${MEM} spam`, { group: G, sock: s })).text, new RegExp(`peringatan ${i}/3`));
  assert.match((await g(`.warnings ${MEM}`, { group: G, sock: s })).text, /2\/3/);
  assert.match((await g('.listwarning', { group: G, sock: s })).text, /6288000000002/);
  const last = await g(`.warn ${MEM}`, { group: G, sock: s });
  assert.match(last.text, /dikeluarkan/);
  assert.deepEqual(s.calls.at(-1), ['participants', 'remove', [`${MEM}@s.whatsapp.net`]]);
  assert.equal(gs.getWarnings(G, MEM), 0);
  const noAdmin = mkSock(false);
  for (let i = 0; i < 3; i++) await g(`.warn ${VIC}`, { group: G, sock: noAdmin });
  assert.equal(noAdmin.calls.length, 0, 'tidak mencoba kick bila bot bukan admin');
  assert.match((await g(`.resetwarn ${VIC}`, { group: G })).text, /direset/);
  assert.match((await g(`.resetwarn ${VIC}`, { group: G })).text, /tidak punya/);
  assert.match((await g(`.warn ${ADM}`, { group: G })).text, /admin grup/);
  assert.match((await g(`.warn ${h.OWNER}`, { group: G })).text, /Owner|admin/);
});

test('.mutemember .unmutemember .listmute: pesan anggota yang di-mute dihapus bot, admin tidak terdampak', async () => {
  const G = newGroup();
  assert.match((await g(`.mutemember ${MEM}`, { group: G })).text, /dibisukan/);
  assert.match((await g('.listmute', { group: G })).text, /6288000000002/);
  const r = await g('halo semua', { group: G, from: MEM });
  assert.equal(r.result.handled, 'moderation');
  assert.ok(r.sock.sent.some((x) => x.content.delete), 'pesan dihapus');
  const adminMsg = await g('.ping', { group: G, from: ADM });
  assert.match(adminMsg.text, /pong/i);
  assert.match((await g(`.unmutemember ${MEM}`, { group: G })).text, /tidak lagi/);
  assert.equal((await g('.listmute', { group: G })).text, 'Tidak ada dibisukan.');
  assert.match((await g(`.mutemember ${ADM}`, { group: G })).text, /admin grup/);
});

test('.banmember .unbanmember .listbanmember: anggota yang di-ban dikeluarkan lagi saat masuk', async () => {
  const G = newGroup();
  const s = mkSock();
  assert.match((await g(`.banmember ${VIC}`, { group: G, sock: s })).text, /daftar ban/);
  assert.match((await g('.listbanmember', { group: G })).text, /6288000000003/);
  const { handleParticipants } = require('../src/whatsapp/group-events');
  const ev = mkSock();
  await handleParticipants({ sock: ev, session: h.session(), update: { id: G, action: 'add', participants: [`${VIC}@s.whatsapp.net`] } });
  assert.deepEqual(ev.calls.at(-1), ['participants', 'remove', [`${VIC}@s.whatsapp.net`]]);
  assert.match((await g(`.unbanmember ${VIC}`, { group: G })).text, /dicabut/);
});

test('.antilink: link undangan dihapus + peringatan; admin dikecualikan; bot non-admin hanya memberi tahu', async () => {
  const G = newGroup();
  assert.match((await g('.antilink on', { group: G })).text, /diaktifkan/);
  const bad = await g('join https://chat.whatsapp.com/ABCDEFGHIJKL', { group: G, from: MEM });
  assert.ok(bad.sock.sent.some((x) => x.content.delete));
  assert.match(bad.text, /peringatan 1\/3/);
  const okAdmin = await g('https://chat.whatsapp.com/ABCDEFGHIJKL', { group: G, from: ADM });
  assert.ok(!okAdmin.sock.sent.some((x) => x.content.delete));
  const G2 = newGroup();
  await g('.antilink on', { group: G2 });
  const noBot = await g('https://chat.whatsapp.com/ABCDEFGHIJKL', { group: G2, from: MEM, sock: mkSock(false) });
  assert.ok(!noBot.sock.sent.some((x) => x.content.delete));
  assert.match(noBot.text, /bukan admin grup/);
});

test('.antispam .antimedia .badword', async () => {
  const G = newGroup();
  await g('.antispam on', { group: G });
  const s = mkSock();
  let last;
  for (let i = 0; i < 7; i++) last = await g(`pesan ${i}`, { group: G, from: MEM, sock: s });
  assert.ok(s.sent.some((x) => /spam pesan/.test(x.content.text || '')));
  await g('.antimedia on', { group: G });
  const sm = mkSock();
  const { handleIncoming } = require('../src/whatsapp/message-handler');
  await handleIncoming({ sock: sm, session: h.session(), msg: { key: { remoteJid: G, id: 'img1', participant: `${MEM}@s.whatsapp.net` }, message: { imageMessage: { caption: '' } }, messageTimestamp: Math.floor(Date.now() / 1000) } });
  assert.ok(sm.sent.some((x) => x.content.delete), 'media dihapus');
  await g('.badword add kasar', { group: G });
  await g('.badword on', { group: G });
  assert.match((await g('.badword list', { group: G })).text, /kasar/);
  const bw = await g('dasar KASAR kamu', { group: G, from: MEM });
  assert.match(bw.text, /kata terlarang/);
  assert.match((await g('.badword del kasar', { group: G })).text, /Dihapus/);
  assert.match((await g('.badword del kasar', { group: G })).text, /tidak ada/);
  assert.match((await g('.antispam maybe', { group: G })).text, /on\|off/);
});

test('.welcome .goodbye .setwelcome .setgoodbye .simulatewelcome .simulategoodbye', async () => {
  const G = newGroup();
  await g('.setwelcome Halo @user di @group!', { group: G });
  await g('.setgoodbye Dadah @user', { group: G });
  assert.match((await g('.simulatewelcome', { group: G })).text, /Halo @6288000000001 di Grup Tes!/);
  assert.match((await g('.simulategoodbye', { group: G })).text, /Dadah @6288000000001/);
  await g('.welcome on', { group: G });
  await g('.goodbye on', { group: G });
  const { handleParticipants } = require('../src/whatsapp/group-events');
  const ev = mkSock();
  await handleParticipants({ sock: ev, session: h.session(), update: { id: G, action: 'add', participants: [`${MEM}@s.whatsapp.net`] } });
  assert.match(ev.sent.at(-1).content.text, /Halo @6288000000002 di Grup Tes!/);
  await handleParticipants({ sock: ev, session: h.session(), update: { id: G, action: 'remove', participants: [`${MEM}@s.whatsapp.net`] } });
  assert.match(ev.sent.at(-1).content.text, /Dadah @6288000000002/);
  await g('.welcome off', { group: G });
  const ev2 = mkSock();
  await handleParticipants({ sock: ev2, session: h.session(), update: { id: G, action: 'add', participants: [`${VIC}@s.whatsapp.net`] } });
  assert.equal(ev2.sent.length, 0);
});

test('.adminonly: bot hanya melayani admin grup; .autorespon; .groupprefix', async () => {
  const G = newGroup();
  await g('.adminonly on', { group: G });
  assert.equal((await g('.ping', { group: G, from: MEM })).result.skipped, 'admin-only-mode');
  assert.match((await g('.ping', { group: G, from: ADM })).text, /pong/i);
  await g('.adminonly off', { group: G });
  assert.match((await g('.autorespon add halo | hai juga', { group: G })).text, /disimpan/);
  assert.equal((await g('halo', { group: G, from: MEM })).text, 'hai juga');
  assert.match((await g('.autorespon list', { group: G })).text, /halo → hai juga/);
  assert.match((await g('.autorespon del halo', { group: G })).text, /dihapus/);
  assert.match((await g('.groupprefix !', { group: G })).text, /Prefix grup: !/);
  assert.match((await g('!ping', { group: G, from: MEM })).text, /pong/i);
  assert.match((await g('.groupprefix a', { group: G })).text, /simbol/);
  assert.match((await g('.groupprefix reset', { group: G })).text, /dihapus/);
});

test('.settimezone .listtimezone .setlang .groupsettings', async () => {
  const G = newGroup();
  assert.match((await g('.listtimezone', { group: G })).text, /Asia\/Jakarta/);
  assert.match((await g('.settimezone asia/tokyo', { group: G })).text, /Asia\/Tokyo/);
  assert.match((await g('.settimezone Mars/Olympus', { group: G })).text, /tidak tersedia/);
  assert.match((await g('.setlang en', { group: G })).text, /hanya bahasa Indonesia/);
  assert.match((await g('.setlang id', { group: G })).text, /id/);
  assert.match((await g('.groupsettings', { group: G })).text, /Zona: Asia\/Tokyo/);
});

test('.banchat (admin grup) dan .unbanchat (Owner): chat diban hanya merespons Owner', async () => {
  const G = newGroup();
  assert.match((await g('.banchat', { group: G })).text, /diban/);
  assert.equal((await g('.ping', { group: G, from: MEM })).result.skipped, 'banned-chat');
  assert.match((await g('.unbanchat', { group: G, from: h.OWNER })).text, /dicabut/);
  assert.match((await g('.unbanchat', { group: G, from: ADM })).text, /khusus Owner/);
  assert.match((await g('.ping', { group: G, from: MEM })).text, /pong/i);
});

test('.topactive .listaktif .sider .gstats memakai statistik pesan nyata', async () => {
  const G = newGroup();
  const s = mkSock();
  await g('halo', { group: G, from: MEM, sock: s });
  await g('halo lagi', { group: G, from: MEM, sock: s });
  await g('hai', { group: G, from: ADM, sock: s });
  assert.match((await g('.topactive', { group: G })).text, /@6288000000002 — 2 pesan/);
  assert.match((await g('.listaktif', { group: G })).text, /@6288000000002 \(2\)/);
  const sider = (await g('.sider', { group: G })).text;
  assert.match(sider, /6288000000003/);
  assert.doesNotMatch(sider, /6288000000002/);
  assert.match((await g('.gstats', { group: G, from: MEM })).text, /Pesanmu: 3/);
});
