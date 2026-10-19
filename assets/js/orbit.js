// ORBIT, the article (2026-10-13; scripts/build-orbit-page.py writes the HTML). Small, generic behaviours, all driven by
// data attributes so the builder decides what happens where:
//   the hero orbit to play with; sidecar steps that drive their sticky media (lighting objects and widgets, drawing charts, switching
//   products) with a scan sweep on each change; the before/after swipe; counters on number breaks; interface overlays
//   in immersive scenes; numbered source cards; the carousel; the reading progress line.
// The article reads fine without any of it.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- hero: an orbit to play with ----------
// Three orbits around the word, ticked like an instrument, with small bodies travelling them. The pointer is a mass: it bends
// every line toward it and slows the bodies that pass close. A click or tap sends a ripple through the field. With no
// pointer (phones, or a resting mouse) a faint mass drifts on its own, so the hero is never still. No rules and no score:
// JC (2026-10-14) on the catch-and-balance game: "looks super cool but not intuitive at all or clear what you're doing".
const hero = $('.o-hero');
const field = $('.o-field');
if (hero && field) {
  const ctx = field.getContext('2d'), hudA = $('.o-hud-a'), hudB = $('.o-hud-b');
  const SPIN = 0.12, N = 260, INK = '230, 233, 237';
  const SPEED = [1, -0.55, 0.8];                                     // each orbit's pace, against the main one
  let w = 0, h = 0, orbits = [], t = 0, last = performance.now(), born = last, raf = 0;
  const mass = { x: 0, y: 0, s: 0, tx: 0, ty: 0, ts: 0, seen: 0 };    // eased position and strength, and their targets
  const pulses = [];
  // the bodies: eight on the main orbit, one on each companion
  const bodies = [...Array(8)].map((_, i) => ({ o: 0, a: (i / 8) * Math.PI * 2 })).concat([{ o: 1, a: 1.3 }, { o: 2, a: 4.1 }]);
  // the orbits for this size: centre, radii, tilt, look
  const layout = () => {
    const r = hero.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    w = r.width; h = r.height; field.width = Math.round(w * dpr); field.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const narrow = w < 720, cx = w / 2, cy = h / 2, R = narrow ? w * 0.47 : Math.min(w * 0.43, h * 1.05);
    const spec = narrow ? [[R, R * 0.34, -8, 'main'], [R * 1.12, R * 0.3, 32, 'solid'], [R * 0.86, R * 0.42, -38, 'dots']]
      : [[R, R * 0.29, -4, 'main'], [R * 1.14, R * 0.36, -9, 'solid'], [R * 0.8, R * 0.42, 8, 'dots']];
    orbits = spec.map(([rx, ry, rot, look]) => ({ cx, cy, rx, ry, rot: rot * Math.PI / 180, look }));
    // the readouts describe the drawn path itself
    const m = orbits[0];
    if (hudA) hudA.textContent = `ORBIT · ${bodies.length} BODIES · PERIOD ${Math.round(2 * Math.PI / SPIN)} S`;
    if (hudB) hudB.textContent = `TILT ${(Math.acos(m.ry / m.rx) * 180 / Math.PI).toFixed(1)}° · ECC ${Math.sqrt(1 - (m.ry / m.rx) ** 2).toFixed(2)}`;
    if (!mass.seen) { mass.x = mass.tx = cx; mass.y = mass.ty = cy; }
  };
  // a point on an orbit, before the field
  const at = (o, a) => { const x = o.rx * Math.cos(a), y = o.ry * Math.sin(a), c = Math.cos(o.rot), s = Math.sin(o.rot);
    return [o.cx + x * c - y * s, o.cy + x * s + y * c]; };
  const reach = () => 0.16 * Math.min(w, h) + 70;
  // the field: pulled toward the mass (a pinch that never crosses it), pushed out by ripples
  const bend = ([x, y]) => {
    const dx = mass.x - x, dy = mass.y - y, r = Math.hypot(dx, dy) || 1, pull = mass.s * 0.55 * Math.exp(-((r / reach()) ** 2));
    x += dx * pull; y += dy * pull;
    for (const p of pulses) {
      const age = t - p.t0, front = age * 520, qx = x - p.x, qy = y - p.y, q = Math.hypot(qx, qy) || 1;
      const k = 16 * Math.exp(-age * 1.6) * Math.exp(-(((q - front) / 70) ** 2)) * Math.sin((q - front) / 18);
      x += (qx / q) * k; y += (qy / q) * k;
    }
    return [x, y];
  };
  const near = (x, y) => Math.exp(-((Math.hypot(mass.x - x, mass.y - y) / reach()) ** 2));
  const draw = (now) => {
    const grow = reduced() ? 1 : Math.min(1, (now - born) / 2200), ease = 1 - (1 - grow) ** 3;
    ctx.clearRect(0, 0, w, h);
    orbits.forEach((o) => {
      const pts = Array.from({ length: Math.ceil(N * ease) + 1 }, (_, i) => bend(at(o, -Math.PI / 2 + (i / N) * Math.PI * 2)));
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.setLineDash(o.look === 'dots' ? [2, 7] : []); ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${INK}, ${o.look === 'main' ? 0.42 : 0.24})`; ctx.stroke(); ctx.setLineDash([]);
      if (o.look === 'main' && grow === 1) {                      // ticks, square to the bent line; every sixth one long
        ctx.beginPath();
        for (let i = 0; i < 72; i++) {
          const j = Math.round((i / 72) * N) % N, [x, y] = pts[j], [px, py] = pts[j + 1], tx = px - x, ty = py - y, n = Math.hypot(tx, ty) || 1, L = i % 6 ? 4 : 10;
          ctx.moveTo(x, y); ctx.lineTo(x - (ty / n) * L, y + (tx / n) * L);
        }
        ctx.strokeStyle = `rgba(${INK}, .5)`; ctx.stroke();
      }
    });
    if (grow === 1) bodies.forEach((b) => {
      const [x, y] = bend(at(orbits[b.o], b.a)), main = b.o === 0;
      ctx.fillStyle = `rgba(${INK}, ${main ? 0.85 : 0.7})`; ctx.beginPath(); ctx.arc(x, y, main ? 3 : 2.5, 0, Math.PI * 2); ctx.fill();
    });
    if (mass.s > 0.02) {                                           // the mass itself: a small sight with two rings
      ctx.strokeStyle = `rgba(${INK}, ${0.5 * mass.s})`; ctx.lineWidth = 1;
      [10, 34].forEach((r) => { ctx.beginPath(); ctx.arc(mass.x, mass.y, r, 0, Math.PI * 2); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(mass.x - 4, mass.y); ctx.lineTo(mass.x + 4, mass.y); ctx.moveTo(mass.x, mass.y - 4); ctx.lineTo(mass.x, mass.y + 4); ctx.stroke();
    }
  };
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    // no pointer for a while: a faint mass drifts on a slow figure-eight
    if (now - mass.seen > 4000) { mass.tx = w / 2 + Math.sin(t * 0.21) * w * 0.34; mass.ty = h / 2 + Math.sin(t * 0.42) * h * 0.2; mass.ts = 0.45; }
    const k = Math.min(1, dt * 7);
    mass.x += (mass.tx - mass.x) * k; mass.y += (mass.ty - mass.y) * k; mass.s += (mass.ts - mass.s) * Math.min(1, dt * 3);
    bodies.forEach((b) => { const [x, y] = at(orbits[b.o], b.a); b.a += dt * SPIN * SPEED[b.o] * (1 - 0.8 * mass.s * near(x, y)); });
    while (pulses.length && t - pulses[0].t0 > 2.5) pulses.shift();
    draw(now);
    raf = requestAnimationFrame(tick);
  };
  const local = (e) => { const r = hero.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  hero.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; [mass.tx, mass.ty] = local(e); mass.ts = 1; mass.seen = performance.now(); });
  hero.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') mass.seen = performance.now() - 3000; });
  // a tap or click: a ripple runs out from it, and on touch the mass jumps there; a touch never blocks the scroll
  hero.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a')) return;
    const [x, y] = local(e); pulses.push({ x, y, t0: t });
    if (e.pointerType !== 'mouse') { mass.tx = x; mass.ty = y; mass.ts = 1; mass.seen = performance.now(); }
  });
  addEventListener('resize', () => { layout(); draw(performance.now()); });
  layout();
  if (reduced()) draw(performance.now());
  else new IntersectionObserver(([en]) => { cancelAnimationFrame(raf); if (en.isIntersecting) { last = performance.now(); raf = requestAnimationFrame(tick); } }).observe(hero);
}

// ---------- 02 · a glimpse: the break animates in; each question opens its own scene carousel (one open at a time) ----------
const glBreak = $('.gl-break');
if (glBreak) {
  if (reduced()) glBreak.classList.add('in');
  else new IntersectionObserver(([en], io) => { if (en.isIntersecting) { glBreak.classList.add('in'); io.disconnect(); } }, { threshold: 0.35 }).observe(glBreak);
}
$$('.gl-row').forEach((row) => {
  const q = $('.gl-q', row), track = $('.gl-track', row), count = $('.gl-count', row), cards = $$('.gl-card', row);
  const step = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth);
  q.addEventListener('click', () => {
    const open = !row.classList.contains('open');
    $$('.gl-row.open').forEach((r) => { r.classList.remove('open'); $('.gl-q', r).setAttribute('aria-expanded', 'false'); });
    if (open) { row.classList.add('open'); q.setAttribute('aria-expanded', 'true'); track.scrollTo({ left: 0 });
      // bring the opened row to the top of the view once it has grown
      setTimeout(() => row.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }), 120); }
  });
  $$('.o-arrow', row).forEach((b) => b.addEventListener('click', () => track.scrollBy({ left: step() * +b.dataset.dir, behavior: reduced() ? 'auto' : 'smooth' })));
  // the last card can't reach the left edge, so the end of the track counts as the last scene
  track.addEventListener('scroll', () => { const end = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    count.textContent = `${end ? cards.length : Math.min(cards.length, Math.round(track.scrollLeft / step()) + 1)} / ${cards.length}`; }, { passive: true });
});

// ---------- nav: solid after the hero; a reading line ----------
const nav = $('.o-nav');
if (nav && hero) new IntersectionObserver(([en]) => nav.classList.toggle('solid', !en.isIntersecting), { rootMargin: '-56px 0px 0px 0px' }).observe(hero);
addEventListener('scroll', () => {
  const h = document.documentElement.scrollHeight - innerHeight;
  nav?.style.setProperty('--read', (scrollY / Math.max(1, h)).toFixed(4));
}, { passive: true });

// ---------- charts: series from JSON, drawn reading by reading ----------
const charts = new Map();
for (const el of $$('.chart')) {
  const spec = JSON.parse($('script', el).textContent);
  const svg = $('svg', el);
  const W = 800, H = 400;
  const x0 = spec.x[0], x1 = spec.x[1], y1 = spec.y[1];
  const X = (v) => ((v - x0) / (x1 - x0)) * W, Y = (v) => H - (v / y1) * H;
  let axes = '';
  for (const yv of spec.yTicks) axes += `<line x1="0" x2="${W}" y1="${Y(yv)}" y2="${Y(yv)}"/><text x="-10" y="${Y(yv) + 4}" text-anchor="end">${yv}${spec.unit || ''}</text>`;
  for (const xv of spec.xTicks) axes += `<text x="${X(xv)}" y="${H + 24}" text-anchor="middle">${xv}</text>`;
  let grid = '';
  for (let gx = 0; gx <= W; gx += 40) for (let gy = 0; gy <= H; gy += 40) grid += `<circle cx="${gx}" cy="${gy}" r="${(gx / 40) % 5 === 0 && (gy / 40) % 5 === 0 ? 2.2 : 1}"/>`;
  svg.setAttribute('viewBox', `-50 -10 ${W + 70} ${H + 50}`);
  svg.innerHTML = `<g class="grid">${grid}</g><g class="axes">${axes}</g><path class="line"/><g class="pts">${spec.points.map(([xv, yv]) => `<circle cx="${X(xv)}" cy="${Y(yv)}" r="3.2" opacity="0"/>`).join('')}</g>`;
  const line = $('.line', svg), pts = [...$('.pts', svg).children], read = $('[data-read]', el.closest('.frame'));
  let shown = -1, timer = 0;
  const show = (n) => {
    const seen = spec.points.slice(0, n + 1);
    line.setAttribute('d', seen.length ? 'M' + seen.map(([xv, yv]) => `${X(xv).toFixed(1)} ${Y(yv).toFixed(1)}`).join(' L') : '');
    pts.forEach((c, i) => c.setAttribute('opacity', i <= n ? 1 : 0));
    const p = seen[seen.length - 1];
    if (read && p) read.textContent = `${p[2] || p[0]} · ${p[1]}${spec.unit || ''}${spec.suffix || ''}`;
  };
  charts.set(el, (k) => {
    const target = Math.round(k * (spec.points.length - 1));
    clearTimeout(timer);
    if (reduced()) { shown = target; show(shown); return; }
    const step = () => {
      if (shown === target) return;
      shown += shown < target ? 1 : -1;
      show(shown);
      timer = setTimeout(step, 36);
    };
    step();
  });
}

// ---------- sidecars: the step in the middle of the screen drives its media ----------
const sweep = (frame) => { if (reduced()) return; frame.classList.remove('scan'); void frame.offsetWidth; frame.classList.add('scan'); };
const stepIO = new IntersectionObserver((es) => es.forEach((x) => {
  if (!x.isIntersecting) return;
  const s = x.target, side = s.closest('.side'), media = $('.side-media', side), frame = $('.frame', media);
  if (s.dataset.state !== undefined && media.dataset.state !== s.dataset.state) {
    media.dataset.state = s.dataset.state;
    const on = s.dataset.state.split(' ');
    $$('[data-k]', media).forEach((el) => {
      const hit = on.includes(el.dataset.k);
      el.classList.toggle('on', hit);
      if (hit) el.classList.add('seen');
    });
    const g = $('[data-group]', media);
    if (g && s.dataset.group) g.textContent = s.dataset.group;
    sweep(frame);
  }
  if (s.dataset.chart) {
    // "id:k": show chart id (others hide) and draw it to share k of its readings
    const [id, k] = s.dataset.chart.includes(':') ? s.dataset.chart.split(':') : [null, s.dataset.chart];
    $$('.chart', media).forEach((c) => {
      const mine = !id || c.dataset.id === id;
      c.classList.toggle('hidden', !mine);
      if (mine) charts.get(c)?.(+k);
    });
    if (id && media.dataset.chartId !== id) { media.dataset.chartId = id; sweep(frame); }
  }
}), { rootMargin: matchMedia('(max-width: 820px)').matches ? '-64% 0px -26% 0px' : '-45% 0px -45% 0px' });   // on a phone the media holds the top half
$$('.o-step').forEach((s) => stepIO.observe(s));

// ---------- the swipe ----------
for (const sw of $$('.swipe')) {
  let drag = false;
  const move = (e) => { const r = sw.getBoundingClientRect(); sw.style.setProperty('--x', `${Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))}%`); };
  sw.addEventListener('pointerdown', (e) => { drag = true; move(e); });
  addEventListener('pointermove', (e) => { if (drag) move(e); });
  addEventListener('pointerup', () => { drag = false; });
  sw.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const v = parseFloat(getComputedStyle(sw).getPropertyValue('--x')) || 50;
    sw.style.setProperty('--x', `${Math.min(100, Math.max(0, v + (e.key === 'ArrowRight' ? 5 : -5)))}%`);
  });
}

// ---------- number breaks: a glitchy count that lands on the sourced figure ----------
for (const n of $$('[data-count]')) {
  const to = parseFloat(n.dataset.count), dp = +(n.dataset.dp || 0), suffix = n.dataset.suffix || '';
  new IntersectionObserver(([en], io) => {
    if (!en.isIntersecting) return;
    io.disconnect();
    if (reduced()) { n.textContent = to.toFixed(dp) + suffix; return; }
    const t0 = performance.now(), dur = 1600;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      const v = to * e + (k < 1 ? (Math.random() - 0.5) * to * 0.06 * (1 - k) : 0);
      n.textContent = Math.max(0, v).toFixed(dp) + suffix;
      if (k < 1) requestAnimationFrame(step); else n.textContent = to.toFixed(dp) + suffix;
    };
    requestAnimationFrame(step);
  }, { threshold: 0.5 }).observe(n);
}

// ---------- immersive scenes: a card brings its interface in ----------
const cardIO = new IntersectionObserver((es) => es.forEach((x) => {
  const imm = x.target.closest('.imm'), key = x.target.dataset.ui;
  if (!key) return;
  $$(`.ui[data-k="${key}"]`, imm).forEach((u) => u.classList.toggle('on', x.isIntersecting));
}), { rootMargin: '-35% 0px -35% 0px' });
$$('.card[data-ui]').forEach((c) => cardIO.observe(c));

// ---------- sources: a numbered marker opens its card ----------
let open = null;
const card = document.createElement('div');
card.className = 'o-srccard';
card.hidden = true;
card.setAttribute('role', 'dialog');
document.body.append(card);
const closeCard = () => { card.hidden = true; open?.setAttribute('aria-expanded', 'false'); open = null; };
document.addEventListener('click', (e) => {
  const b = e.target.closest('.src');
  if (!b) { if (!e.target.closest('.o-srccard')) closeCard(); return; }
  if (open === b) { closeCard(); return; }
  closeCard();
  const li = document.getElementById(`src-${b.dataset.n}`);
  card.innerHTML = `<span class="mono">Source ${b.dataset.n}</span>${li ? li.innerHTML : ''}`;
  card.hidden = false;
  const r = b.getBoundingClientRect();
  card.style.left = `${Math.min(innerWidth - card.offsetWidth - 16, Math.max(16, r.left - 20))}px`;
  card.style.top = `${r.bottom + 10 + card.offsetHeight > innerHeight ? r.top - card.offsetHeight - 10 : r.bottom + 10}px`;
  b.setAttribute('aria-expanded', 'true');
  open = b;
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });
addEventListener('scroll', closeCard, { passive: true });

// ---------- the carousel ----------
const futs = $('.futs');
// only its own arrows (other sections have arrows too), and only when the carousel is on the page
if (futs) $$('.fut-nav .o-arrow').forEach((b) => b.addEventListener('click', () => {
  const c = $('.futc', futs);
  futs.scrollBy({ left: (c.offsetWidth + 16) * +b.dataset.dir, behavior: reduced() ? 'auto' : 'smooth' });
}));
