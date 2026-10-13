(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const LABELS = { disconnected: 'Disconnected', connecting: 'Connecting', waiting_pairing: 'Waiting for Pairing', connected: 'Connected', reconnecting: 'Reconnecting', error: 'Error' };
  const COUNTRIES = [
    ['Indonesia', '62'], ['Malaysia', '60'], ['Singapura', '65'], ['Brunei', '673'], ['Thailand', '66'], ['Filipina', '63'], ['Vietnam', '84'],
    ['India', '91'], ['Pakistan', '92'], ['Bangladesh', '880'], ['Jepang', '81'], ['Korea Selatan', '82'], ['China', '86'], ['Arab Saudi', '966'],
    ['Uni Emirat Arab', '971'], ['Turki', '90'], ['Mesir', '20'], ['Australia', '61'], ['Selandia Baru', '64'], ['Inggris', '44'], ['Jerman', '49'],
    ['Prancis', '33'], ['Belanda', '31'], ['Italia', '39'], ['Spanyol', '34'], ['Amerika Serikat / Kanada', '1'], ['Brasil', '55'], ['Meksiko', '52'],
  ];

  const els = {
    pill: $('status-pill'), pillText: $('status-text'), service: $('meta-service'), open: $('open-connect'), panel: $('connect'),
    form: $('form'), country: $('country'), number: $('number'), numberErr: $('number-err'), accessWrap: $('access-wrap'), access: $('access'),
    generate: $('generate'), pairing: $('pairing'), wait: $('wait'), waitText: $('wait-text'), codeBox: $('code-box'), code: $('code'),
    codePhone: $('code-phone'), copy: $('copy'), copyManual: $('copy-manual'), regen: $('regen'), done: $('done'), doneNumber: $('done-number'),
    fail: $('fail'), failText: $('fail-text'), retry: $('retry'), disconnect: $('disconnect'), toasts: $('toasts'),
  };

  let current = { status: 'disconnected' };
  let lastRequest = null; // data formulir terakhir, hanya di memori (tanpa penyimpanan browser)
  let ws = null, wsTimer = 0, poll = 0, announced = '';

  // ---------- util ----------
  function toast(text, kind = 'info', ms = 4500) {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = text;
    els.toasts.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }
  const busy = (btn, on) => { btn.classList.toggle('is-loading', on); btn.disabled = on; };
  const fmtCode = (c) => (c && c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c || '');

  async function api(path, opts = {}) {
    const res = await fetch(`/api${path}`, {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'floch-web', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* bukan JSON */ }
    if (!res.ok) throw new Error((data && data.error) || `Permintaan gagal (${res.status}).`);
    return data;
  }

  // ---------- render status (semua nilai dari backend) ----------
  function render(info) {
    const prev = current.status;
    current = info || { status: 'disconnected' };
    const s = current.status;
    els.pill.dataset.state = s;
    els.pillText.textContent = LABELS[s] || s;

    els.wait.hidden = !(s === 'connecting' || s === 'reconnecting' || (s === 'waiting_pairing' && !current.code));
    els.waitText.textContent = s === 'reconnecting' ? 'Menyambung ulang…' : 'Menghubungi WhatsApp…';
    els.codeBox.hidden = !(s === 'waiting_pairing' && current.code);
    els.done.hidden = s !== 'connected';
    els.fail.hidden = s !== 'error';
    els.disconnect.hidden = !(s === 'connected' || s === 'waiting_pairing' || s === 'connecting' || s === 'reconnecting');
    els.form.hidden = s !== 'disconnected';
    els.pairing.hidden = s === 'disconnected';
    if (s !== 'disconnected') els.panel.hidden = false;

    if (s === 'waiting_pairing' && current.code) {
      els.code.textContent = fmtCode(current.code);
      els.codePhone.textContent = current.phone ? `+${current.phone}` : '';
    }
    if (s === 'connected') els.doneNumber.textContent = current.number ? `Nomor: +${current.number}` : '';
    if (s === 'error') els.failText.textContent = current.error || 'Koneksi gagal. Coba lagi.';

    // Toast hanya saat status berubah, dan hanya berdasarkan status dari backend.
    if (s !== prev && s !== announced) {
      announced = s;
      if (s === 'connected') toast('WhatsApp berhasil terhubung.', 'ok');
      else if (s === 'error') toast(current.error || 'Koneksi gagal.', 'bad', 6000);
      else if (s === 'waiting_pairing' && current.code) toast('Kode pairing siap. Masukkan di WhatsApp.', 'info');
      else if (s === 'disconnected' && prev !== 'disconnected' && prev) toast('Sesi diputus.', 'info');
    }
    managePolling();
  }

  // ---------- real-time: WebSocket, dengan polling status ringan sebagai cadangan ----------
  function connectWs() {
    clearTimeout(wsTimer);
    try {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    } catch { return; }
    ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.type === 'status') render(m.data); } catch { /* abaikan */ } };
    ws.onclose = () => { ws = null; wsTimer = setTimeout(connectWs, 4000); };
    ws.onerror = () => ws && ws.close();
  }
  function managePolling() {
    const need = ['connecting', 'waiting_pairing', 'reconnecting'].includes(current.status);
    if (need && !poll) poll = setInterval(refresh, 4000);
    if (!need && poll) { clearInterval(poll); poll = 0; }
  }
  async function refresh() {
    try { render((await api('/pairing/status')).session); } catch { /* jaringan putus: coba lagi nanti */ }
  }

  // ---------- form ----------
  function validate() {
    const raw = els.number.value.replace(/[\s\-().]/g, '');
    let msg = '';
    if (!raw) msg = 'Nomor wajib diisi.';
    else if (!/^\d+$/.test(raw)) msg = 'Nomor hanya boleh berisi angka.';
    else if (raw.length < 7 || raw.length > 14) msg = 'Panjang nomor tidak wajar (7–14 digit).';
    els.numberErr.hidden = !msg;
    els.numberErr.textContent = msg;
    els.number.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }

  async function generate(fromRegen) {
    if (!fromRegen) {
      if (!validate()) { els.number.focus(); return; }
      lastRequest = { country: els.country.value, number: els.number.value.trim(), accessCode: els.access.value };
    }
    if (!lastRequest) return;
    busy(els.generate, true);
    els.regen.disabled = true;
    try {
      if (fromRegen) { await api('/pairing/disconnect', { method: 'POST', body: {} }); }
      const { session } = await api('/pairing/connect', { method: 'POST', body: lastRequest });
      render(session);
      connectWs();
    } catch (err) {
      toast(err.message, 'bad', 6000);
      if (!fromRegen) { els.numberErr.hidden = false; els.numberErr.textContent = err.message; }
    } finally {
      busy(els.generate, false);
      els.regen.disabled = false;
    }
  }

  async function copyCode() {
    const text = els.code.textContent.trim();
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; }
    } catch { ok = false; }
    if (!ok) {
      // Cadangan: pilih teks lalu coba execCommand. Berhasil hanya jika browser mengonfirmasi.
      const range = document.createRange(); range.selectNodeContents(els.code);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      try { ok = document.execCommand('copy'); } catch { ok = false; }
    }
    els.copyManual.hidden = ok;
    if (ok) toast('Kode disalin.', 'ok'); else toast('Tidak bisa menyalin otomatis. Kode sudah dipilih — salin manual.', 'info', 6000);
  }

  async function disconnect() {
    busy(els.disconnect, true);
    try {
      render((await api('/pairing/disconnect', { method: 'POST', body: {} })).session);
    } catch (err) { toast(err.message, 'bad'); } finally { busy(els.disconnect, false); }
  }

  // ---------- inisialisasi ----------
  function buildCountries() {
    for (const [name, code] of COUNTRIES) {
      const o = document.createElement('option');
      o.value = code; o.textContent = `${name} (+${code})`;
      if (code === '62') o.selected = true;
      els.country.appendChild(o);
    }
  }

  async function loadService() {
    try {
      const d = await api('/status');
      $('meta-owner').textContent = d.owner; $('meta-dev').textContent = d.developer;
      els.service.textContent = d.service === 'online' ? `Online · ${d.sessions.connected} terhubung` : d.service;
      els.accessWrap.hidden = !d.requiresAccessCode;
    } catch { els.service.textContent = 'Tidak dapat dijangkau'; }
  }

  function endIntro() {
    const el = $('intro');
    if (!el || el.classList.contains('is-out')) return;
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 700);
  }

  buildCountries();
  els.open.addEventListener('click', () => { els.panel.hidden = false; els.panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); els.number.focus({ preventScroll: true }); });
  els.form.addEventListener('submit', (e) => { e.preventDefault(); generate(false); });
  els.number.addEventListener('input', () => { if (els.numberErr.textContent) validate(); });
  els.copy.addEventListener('click', copyCode);
  els.regen.addEventListener('click', () => generate(true));
  els.retry.addEventListener('click', async () => { try { await api('/pairing/disconnect', { method: 'POST', body: {} }); } catch { /* abaikan */ } render({ status: 'disconnected' }); });
  els.disconnect.addEventListener('click', disconnect);
  $('intro-skip').addEventListener('click', endIntro);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') endIntro(); });
  setTimeout(endIntro, reduce ? 300 : 3200);

  loadService();
  refresh().then(() => { if (current.status !== 'disconnected') els.panel.hidden = false; });
  connectWs();
})();
