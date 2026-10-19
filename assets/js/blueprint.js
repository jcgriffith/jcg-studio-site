// Blueprint, site-wide (play layer: a reward for all nine blocks, PLAY-BREAKDOWN.md, JC, 2026-10-05). The page shows its
// own measurements over itself, as the brand Widgets tab's Blueprint does:
//   - rulers every 24 px along the top and left edges, longer every 120
//   - each HUD panel's width and height and its inset from the viewport edge it sits on
//   - the width and height of the buttons, labels and headings in view
// All of it is read from the page. Turned on from the menu, the site's scan sweeps the screen and the drawing wipes in
// behind it. It then follows scrolling and resizing and holds still otherwise. A dimension that would cover another, or
// leave the screen, is left out, so a crowded phone stays readable. Off by default; play.js keeps the choice on this
// device. Reduced motion: no sweep.
import { scan } from './scanline.js';
import { reduced } from './reduce-motion.js';

const G = 24;
const PICK = '.hud-panel, main .btn, main .eyebrow, main h1, main h2, footer .foot-game canvas, .game-bar, .build-board';
let layer = null, svg = null, raf = 0, on = false;
const tw = (t) => String(t).length * 9;                                  // Departure Mono at 11 px, tracked .08em
const ov = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

function draw() {
  raf = 0;
  if (!on || !svg) return;
  const W = innerWidth, H = innerHeight, L = [], T = [], taken = [];
  const ln = (x1, y1, x2, y2, c) => L.push(`<line${c ? ` class="${c}"` : ''} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  const tx = (x, y, t, a = 'middle', turn = false) => {
    x = Math.round(x); y = Math.round(y);
    T.push(`<text x="${x}" y="${y}" text-anchor="${a}"${turn ? ` transform="rotate(-90 ${x} ${y})"` : ''}>${t}</text>`);
  };
  const dimH = (a, b, y, t, above) => {
    y = Math.round(y); a = Math.round(a); b = Math.round(b);
    ln(a, y + 0.5, b, y + 0.5); ln(a + 0.5, y - 3, a + 0.5, y + 4); ln(b - 0.5, y - 3, b - 0.5, y + 4);
    if (t) tx((a + b) / 2, above ? y - 5 : y + 15, t);
  };
  const dimV = (a, b, x, t, left) => {
    x = Math.round(x); a = Math.round(a); b = Math.round(b);
    ln(x + 0.5, a, x + 0.5, b); ln(x - 3, a + 0.5, x + 4, a + 0.5); ln(x - 3, b - 0.5, x + 4, b - 0.5);
    if (t) tx(left ? x - 4 : x + 12, (a + b) / 2, t, 'middle', true);
  };
  const fits = (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H;
  const clear = (r, boxes, self) => boxes.every((b) => b.el === self || ov(r, b) === 0) && taken.every((b) => ov(r, b) === 0);
  for (let x = G; x < W; x += G) ln(x + 0.5, 0, x + 0.5, x % (5 * G) ? 4 : 8, 'ruler');
  for (let y = G; y < H; y += G) ln(0, y + 0.5, y % (5 * G) ? 4 : 8, y + 0.5, 'ruler');

  const els = [...document.querySelectorAll(PICK)].filter((el) => !el.closest('.blueprint, [hidden], .site-menu-layer, .play-sheet:not(.is-open)'));
  const boxes = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
    boxes.push({ el, x: r.left, y: r.top, w: r.width, h: r.height, hud: el.matches('.hud-panel') && getComputedStyle(el).position === 'fixed' });
    if (boxes.length >= 40) break;
  }
  // HUD panels first: their insets from the edges they sit on, the rule they follow (--edge).
  const lab = (n) => (n >= 20 ? n : '');
  for (const b of boxes.filter((q) => q.hud)) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, edge = { l: b.x, t: b.y, r: W - b.x - b.w, b: H - b.y - b.h };
    if (edge.l < 40) { dimH(0, b.x, cy, lab(Math.round(edge.l)), true); taken.push({ x: 0, y: cy - 17, w: b.x, h: 21 }); }
    if (edge.r < 40) { dimH(b.x + b.w, W, cy, lab(Math.round(edge.r)), true); taken.push({ x: b.x + b.w, y: cy - 17, w: edge.r, h: 21 }); }
    if (edge.t < 40) { dimV(0, b.y, cx, lab(Math.round(edge.t)), false); taken.push({ x: cx - 4, y: 0, w: 17, h: b.y }); }
    if (edge.b < 40) { dimV(b.y + b.h, H, cx, lab(Math.round(edge.b)), false); taken.push({ x: cx - 4, y: b.y + b.h, w: 17, h: edge.b }); }
  }
  // Then every part: its width above or below, its height left or right, wherever that covers nothing.
  for (const b of boxes) {
    const w = Math.round(b.w), h = Math.round(b.h), cx = b.x + b.w / 2, cy = b.y + b.h / 2, ww = Math.max(b.w, tw(w)), hh = Math.max(b.h, tw(h));
    const across = [{ at: b.y - 6, up: true, r: { x: cx - ww / 2, y: b.y - 23, w: ww, h: 21 } }, { at: b.y + b.h + 6, up: false, r: { x: cx - ww / 2, y: b.y + b.h + 2, w: ww, h: 21 } }]
      .find((o) => fits(o.r) && clear(o.r, boxes, b.el));
    if (across) { taken.push(across.r); dimH(b.x, b.x + b.w, across.at, w, across.up); }
    const down = [{ at: b.x - 6, left: true, r: { x: b.x - 19, y: cy - hh / 2, w: 17, h: hh } }, { at: b.x + b.w + 6, left: false, r: { x: b.x + b.w + 2, y: cy - hh / 2, w: 17, h: hh } }]
      .find((o) => fits(o.r) && clear(o.r, boxes, b.el));
    if (down) { taken.push(down.r); dimV(b.y, b.y + b.h, down.at, h, down.left); }
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = L.join('') + T.join('');
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

export function blueprint(state, { sweep = false } = {}) {
  on = !!state;
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'blueprint';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" focusable="false"></svg>';
    document.body.append(layer);
    svg = layer.querySelector('svg');
  }
  layer.hidden = !on;
  document.documentElement.classList.toggle('is-blueprint', on);
  if (!on) {
    svg.innerHTML = '';
    removeEventListener('scroll', schedule);
    removeEventListener('resize', schedule);
    return;
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  draw();
  if (sweep && !reduced()) {
    layer.classList.remove('is-drawing'); void layer.offsetWidth; layer.classList.add('is-drawing');
    scan(layer);
  }
}
