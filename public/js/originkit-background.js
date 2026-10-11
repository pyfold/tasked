/* OriginKit Blinking Squares, adapted for a subdued, non-blocking study canvas. */
(() => {
  const canvas = document.getElementById('taskedOriginBg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = ['#718f65', '#c19a5b', '#65869a'];
  let frame = 0;
  let cells = [];
  let width = 0, height = 0, dpr = 1;
  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    cells = Array.from({ length: Math.ceil(width / 24) * Math.ceil(height / 24) }, (_, i) => {
      const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      return { phase: (seed - Math.floor(seed)) * Math.PI * 2, color: Math.abs(Math.sin(i * 91.7)) % colors.length, active: Math.abs(Math.sin(i * 42.3)) > .48 };
    });
  }
  function draw(time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    const cols = Math.ceil(width / 24), t = reduce ? 0 : time / 2300;
    cells.forEach((cell, i) => {
      if (!cell.active) return;
      const x = (i % cols) * 24 + 7, y = Math.floor(i / cols) * 24 + 7;
      const alpha = reduce ? .12 : .06 + (Math.sin(t + cell.phase) + 1) * .045;
      ctx.fillStyle = colors[cell.color]; ctx.globalAlpha = alpha; ctx.fillRect(x, y, 9, 9);
    });
    ctx.globalAlpha = 1;
    if (!reduce) frame = requestAnimationFrame(draw);
  }
  resize(); draw(0); addEventListener('resize', () => { cancelAnimationFrame(frame); resize(); draw(0); }, { passive: true });
})();

