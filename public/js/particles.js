(() => {
  'use strict';
  const canvas = document.getElementById('particles');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let w = 0, h = 0, dots = [], raf = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(70, Math.round((w * h) / 22000));
    dots = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + .4, v: Math.random() * .25 + .05, a: Math.random() * .6 + .2, p: Math.random() * 6.28 }));
    if (reduce.matches) draw(0);
  };
  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      if (!reduce.matches) { d.y -= d.v; d.x += Math.sin(t / 2000 + d.p) * .15; if (d.y < -4) { d.y = h + 4; d.x = Math.random() * w; } }
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, ${70 + (d.r * 40) | 0}, 80, ${d.a * (.6 + .4 * Math.sin(t / 900 + d.p))})`;
      ctx.shadowColor = 'rgba(255,45,61,.8)'; ctx.shadowBlur = 8;
      ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
    }
  };
  const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };
  const start = () => { cancelAnimationFrame(raf); if (!reduce.matches && !document.hidden) raf = requestAnimationFrame(loop); else draw(0); };

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', start);
  reduce.addEventListener?.('change', start);
  resize(); start();
})();
