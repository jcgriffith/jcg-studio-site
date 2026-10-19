// Build the mark (play layer, PLAY-BREAKDOWN.md item 2, JC, 2026-10-05): the logo's ten pieces (nine blocks and the
// G's half-height spur, cut from the real geometry in jcg-bud.js) lie scattered on the dot grid. Drag each into its faint
// place in the ghost of the logo; near enough, it lands with the HUD overshoot. When all ten are in, the mark buds from
// one block, the way the nav's does, and STUDIO types in under it. A mono bar reads the pieces placed, the time since the
// first touch, and this device's best time (play-store.js). Finishing fires `build:done` on the host (a block, play.js).
// On the 404 page and the brand Logo tab: initBuild(host) fills an empty <div class="build" data-build>.
// Touch-first: a piece takes the finger at once (touch-action: none on pieces only), so the empty board still scrolls the
// page. Reduced motion: pieces land without the overshoot and the finished mark appears whole.
import { BLOCKS, blockD, markD, FINAL_D, MARK_W, MARK_H, MARK_END, FPS, wordSVG } from './jcg-bud.js';
import { easeSnap } from './jcg-hud.js';
import { best, record } from './play-store.js';
import { reduced } from './reduce-motion.js';

const IDS = Object.keys(BLOCKS), N = IDS.length, LAND = 420, NEAR = 0.35;
const NS = 'http://www.w3.org/2000/svg';
const clock = (ms) => { const t = Math.max(0, ms) / 1000; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`; };
const svg = (w, h, d, cls) => `<svg class="${cls}" xmlns="${NS}" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;

export function initBuild(host) {
  if (!host || host._build) return host?._build;
  host.innerHTML =
    '<div class="build-bar hud"><span>Pieces <b data-b="placed">0</b> / ' + N + '</span><span>Time <b data-b="time">00:00.0</b></span>' +
    '<span>Best <b data-b="best">--:--.-</b></span><button class="btn btn--ghost btn--sm build-again" type="button" data-b-again>Scatter</button></div>' +
    '<div class="build-board" role="group" aria-label="Puzzle: put the JCG Studio logo back together. Drag each piece into its place."></div>';
  const board = host.querySelector('.build-board'), out = Object.fromEntries([...host.querySelectorAll('[data-b]')].map((el) => [el.dataset.b, el]));
  const again = host.querySelector('[data-b-again]');
  board.insertAdjacentHTML('beforeend', svg(MARK_W, MARK_H, FINAL_D, 'build-ghost') + svg(MARK_W, MARK_H, '', 'build-final'));
  const ghost = board.querySelector('.build-ghost'), final = board.querySelector('.build-final'), finalPath = final.querySelector('path');
  const word = document.createElement('span');
  word.className = 'build-word';
  word.setAttribute('aria-hidden', 'true');
  board.append(word);
  const pieces = IDS.map((id) => {
    const [, , w, h] = BLOCKS[id].r, el = document.createElement('div');
    el.className = 'build-piece';
    el.innerHTML = svg(w, h, blockD(id), '');
    board.append(el);
    return { id, el, w, h, x: 0, y: 0, placed: false, anim: 0 };
  });

  let k = 1, mx = 0, my = 0, W = 0, H = 0, z = 1, t0 = 0, timer = 0, done = false;
  const slot = (p) => ({ x: mx + BLOCKS[p.id].r[0] * k, y: my + BLOCKS[p.id].r[1] * k });
  const place = (p) => { p.el.style.translate = `${p.x}px ${p.y}px`; };
  const show = () => {
    const b = best('build');
    out.placed.textContent = String(pieces.filter((p) => p.placed).length);
    out.best.textContent = b ? clock(b) : '--:--.-';
  };

  // The board: the logo's size from the width (a block is at most 48 px), with a band above and below it to scatter into.
  function layout(keep) {
    const w = board.clientWidth;
    if (!w) return;
    const oldK = k, oldMx = mx, oldMy = my;
    k = Math.min(0.8, (w - 32) / MARK_W);
    W = w; H = Math.round(MARK_H * k + 2 * 90 * k + 32);
    mx = Math.round((W - MARK_W * k) / 2); my = Math.round((H - MARK_H * k) / 2);
    board.style.height = H + 'px';
    for (const s of [ghost, final]) { s.style.width = MARK_W * k + 'px'; s.style.height = MARK_H * k + 'px'; s.style.translate = `${mx}px ${my}px`; }
    for (const p of pieces) {
      p.el.style.width = p.w * k + 'px'; p.el.style.height = p.h * k + 'px';
      if (p.placed) Object.assign(p, slot(p));
      else if (keep) { p.x = mx + (p.x - oldMx) * (k / oldK); p.y = my + (p.y - oldMy) * (k / oldK); clampIn(p); }
      place(p);
    }
    if (done) setWord(6);
  }
  function clampIn(p) {
    p.x = Math.min(Math.max(4, p.x), W - p.w * k - 4);
    p.y = Math.min(Math.max(4, p.y), H - p.h * k - 4);
  }
  // Scatter: five pieces in the band above the logo and five below, in random order, each in its own column so none
  // hides another, and none on its own place.
  function scatter() {
    done = false; t0 = 0; clearInterval(timer); timer = 0;
    host.classList.remove('is-built');
    finalPath.setAttribute('d', ''); word.innerHTML = '';
    out.time.textContent = '00:00.0'; again.textContent = 'Scatter';
    const order = pieces.map((p) => [Math.random(), p]).sort((a, b) => a[0] - b[0]).map(([, p]) => p);
    const per = Math.ceil(N / 2), cw = (W - 16) / per;
    order.forEach((p, i) => {
      const row = i < per ? 0 : 1, col = i % per;
      const y0 = row ? my + MARK_H * k + 8 : 8, y1 = row ? H - 8 : my - 8;
      p.placed = false; p.el.classList.remove('is-placed', 'is-held');
      p.x = 8 + col * cw + Math.random() * Math.max(0, cw - p.w * k);
      p.y = y0 + Math.random() * Math.max(0, y1 - y0 - p.h * k);
      clampIn(p); place(p);
    });
    show();
  }
  function tick() { if (t0) out.time.textContent = clock(performance.now() - t0); }

  // Landing: near its place, a piece snaps in on the HUD overshoot; anywhere else it stays where it was put down.
  function land(p) {
    const s = slot(p);
    if (Math.hypot(p.x - s.x, p.y - s.y) > NEAR * 60 * k) { clampIn(p); place(p); return; }
    p.placed = true; p.el.classList.add('is-placed');
    const fx = p.x, fy = p.y, a0 = performance.now();
    cancelAnimationFrame(p.anim);
    if (reduced()) { Object.assign(p, s); place(p); }
    else {
      const step = (now) => {
        const t = Math.min(1, (now - a0) / LAND), e = easeSnap(t);
        p.x = fx + (s.x - fx) * e; p.y = fy + (s.y - fy) * e; place(p);
        if (t < 1) p.anim = requestAnimationFrame(step);
      };
      p.anim = requestAnimationFrame(step);
    }
    show();
    if (pieces.every((q) => q.placed)) setTimeout(finish, reduced() ? 0 : LAND);
  }

  // All ten: the time is kept, the pieces give way to the logo budding from one block, and STUDIO types in under it.
  function finish() {
    if (done) return;
    done = true;
    clearInterval(timer); timer = 0;
    const ms = t0 ? performance.now() - t0 : 0;
    out.time.textContent = clock(ms);
    const fresh = ms > 0 && record('build', Math.round(ms), { lower: true });
    show();
    again.textContent = fresh ? 'New best · Again' : 'Again';
    host.classList.add('is-built');
    host.dispatchEvent(new CustomEvent('build:done', { bubbles: true, detail: { ms: Math.round(ms), best: fresh } }));
    if (reduced()) { finalPath.setAttribute('d', FINAL_D); setWord(6); return; }
    const a0 = performance.now(), TYPE = 4, total = MARK_END + 12 + 6 * TYPE;
    const step = (now) => {
      const f = ((now - a0) / 1000) * FPS;
      finalPath.setAttribute('d', f < MARK_END ? markD(f) : FINAL_D);
      setWord(Math.max(0, Math.min(6, Math.floor((f - MARK_END - 12) / TYPE) + 1)));
      if (f < total && done) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  // STUDIO under the mark: capitals one block tall, centred, half a block below it.
  function setWord(n) {
    const unit = (60 * k) / 8;
    word.style.translate = `${Math.round(mx + (MARK_W * k - 45 * unit) / 2)}px ${Math.round(my + MARK_H * k + 30 * k)}px`;
    word.innerHTML = wordSVG('STUDIO', unit, 'aria-hidden="true" focusable="false"');
    word.querySelectorAll('svg > g').forEach((g, i) => { g.style.visibility = i < n ? '' : 'hidden'; });
  }

  // Hands
  let held = null;
  board.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.build-piece');
    const p = el && pieces.find((q) => q.el === el);
    if (!p || p.placed || held || done || e.button > 0) return;
    e.preventDefault();
    cancelAnimationFrame(p.anim);
    held = { p, id: e.pointerId, ox: e.clientX - p.x, oy: e.clientY - p.y };
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* pointer gone */ }
    el.classList.add('is-held'); el.style.zIndex = ++z;
    if (!t0) { t0 = performance.now(); timer = setInterval(tick, 100); }
  });
  board.addEventListener('pointermove', (e) => {
    if (!held || e.pointerId !== held.id) return;
    const p = held.p;
    p.x = e.clientX - held.ox; p.y = e.clientY - held.oy;
    place(p);
  });
  const release = (e) => {
    if (!held || e.pointerId !== held.id) return;
    const { p } = held;
    held = null;
    p.el.classList.remove('is-held');
    land(p);
  };
  board.addEventListener('pointerup', release);
  board.addEventListener('pointercancel', release);
  board.addEventListener('dragstart', (e) => e.preventDefault());
  again.addEventListener('click', scatter);

  let lastW = 0;
  new ResizeObserver(() => { const w = board.clientWidth; if (w && w !== lastW) { const first = !lastW; lastW = w; layout(!first); if (first) scatter(); } }).observe(board);
  return (host._build = { scatter, get done() { return done; }, pieces });
}
