// About page play (2026-10-19). Light, no deps beyond the site's own modules.
// 1. Portrait starts as a pixel mosaic in ink tones and resolves to the photo on hover, focus or tap.
// 2. Timeline years tick like an odometer the first time each row scrolls in.
// 3. "Now" status line: blinking signal dot + live Colorado Springs time.
// 4. Easter egg: tap the status dot three times.
// Reduced motion: photo shown plain, years static, dot steady.
import { reduced, onceInView } from './reduce-motion.js';

function portrait() {
  const img = document.querySelector('.about-portrait');
  if (!img || reduced()) return;
  const wrap = document.createElement('button');
  wrap.type = 'button'; wrap.className = 'px-portrait'; wrap.setAttribute('aria-label', 'Resolve the portrait');
  img.replaceWith(wrap); wrap.append(img);
  const c = document.createElement('canvas'); c.setAttribute('aria-hidden', 'true'); wrap.append(c);
  const ctx = c.getContext('2d', { willReadFrequently: false });
  let level = 14, goal = 14, raf = 0;
  const S = 160;
  const draw = () => {
    const dpr = Math.min(2, devicePixelRatio || 1), size = Math.round(wrap.clientWidth * dpr) || S;
    if (c.width !== size) { c.width = c.height = size; }
    const n = Math.max(1, Math.round(level));
    const cells = Math.max(4, Math.round(size / (n * dpr * 1.6)));
    // sample the image (cover-cropped, like the CSS) into a tiny grid, then scale up with no smoothing
    const t = draw.t || (draw.t = document.createElement('canvas')); t.width = t.height = cells;
    const tc = t.getContext('2d'), iw = img.naturalWidth, ih = img.naturalHeight, m = Math.min(iw, ih);
    tc.filter = level > 1.5 ? 'grayscale(1) contrast(1.15)' : 'none';
    tc.drawImage(img, (iw - m) / 2, (ih - m) / 2, m, m, 0, 0, cells, cells);
    ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, size, size);
    ctx.drawImage(t, 0, 0, size, size);
    c.style.opacity = level <= 1.2 ? '0' : '1';
  };
  const step = () => {
    raf = 0; level += (goal - level) * 0.18;
    if (Math.abs(goal - level) < 0.05) level = goal;
    draw(); if (level !== goal) raf = requestAnimationFrame(step);
  };
  const to = (g) => { goal = g; wrap.classList.toggle('is-resolved', g === 1); if (!raf) raf = requestAnimationFrame(step); };
  const go = () => draw();
  img.complete ? go() : img.addEventListener('load', go, { once: true });
  const hover = matchMedia('(hover: hover)').matches;
  if (hover) {
    wrap.addEventListener('pointerenter', () => to(1));
    wrap.addEventListener('pointerleave', () => to(14));
  }
  wrap.addEventListener('focus', () => { if (wrap.matches(':focus-visible')) to(1); });
  wrap.addEventListener('blur', () => to(14));
  wrap.addEventListener('click', (e) => { if (!hover || e.detail === 0) to(goal === 1 && !(hover && e.detail === 0) ? 14 : 1); });   // tap toggles; keyboard Enter resolves
}

function odometer() {
  document.querySelectorAll('.about-timeline .when').forEach((el, row) => {
    const final = el.textContent;
    if (reduced()) return;
    el.setAttribute('aria-label', final);
    el.classList.add('odo-wait');
    onceInView(el.closest('li'), () => {
      el.classList.remove('odo-wait'); el.closest('li').classList.add('is-in');
      const t0 = performance.now(), dur = 520 + row * 60;
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = [...final].map((ch, i) => (/\d/.test(ch) && p < 1 && i / final.length >= p * 0.9 ? String((Math.random() * 10) | 0) : ch)).join('');
        if (p < 1) requestAnimationFrame(tick); else el.textContent = final;
      };
      requestAnimationFrame(tick);
    }, '0px 0px -8% 0px');
  });
}

function status() {
  const out = document.querySelector('[data-local-time]'), dot = document.querySelector('.now-dot');
  if (!out) return;
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  let egg = 0;
  const tick = () => { if (!egg) out.textContent = `Colorado Springs · ${fmt.format(new Date())}`; };
  tick(); setInterval(tick, 15000);
  if (!dot) return;
  let taps = 0, timer = 0;
  dot.addEventListener('click', () => {
    taps += 1; clearTimeout(timer); timer = setTimeout(() => { taps = 0; }, 900);
    if (taps < 3) return;
    taps = 0; egg = 1; out.textContent = 'Signal acquired · Hello, you.'; out.closest('.now-line').classList.add('is-egg');
    setTimeout(() => { egg = 0; out.closest('.now-line').classList.remove('is-egg'); tick(); }, 3200);
  });
}

odometer(); status();
