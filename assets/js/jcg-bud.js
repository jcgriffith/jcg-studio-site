// The JCG mark and its build, "budding" (approved by JC on 2026-10-02; re-planned 2026-10-05 for the final
// block mark, JC: "C final answer").
// The mark is nine blocks on a 30 x 12 unit grid. A block is 4 x 4 units, with one unit of air between letters.
// J is a stem two blocks tall plus a foot on the diagonal; C is a back, top and bottom on the diagonals; G is the
// same with a half-height spur. Corners round (a fifth of a block) where a letter turns. Where two blocks of one
// letter meet corner to corner, that corner stays square and a fillet fills the two empty quadrants beside it.
// The build: one block appears (the C's back), and every next block pushes out of the block it is attached to.
// Corner neighbours swell out of the corner as a droplet, with the fillet as the neck. The J squeezes out of the
// C's back, pinches off and slides one unit left into its own letter. The G buds off the C's top-right corner,
// its neck thins and snaps, and it slides one unit right.
// Everything is a pure function of the frame number at 60 fps. Geometry is in mark units (one block = 60,
// origin = the mark's top-left corner) and is scaled to any block size when drawn.

export const FPS = 60;
export const MARK_END = 60;                       // by this frame the mark has settled into the exact logo
export const MARK_W = 450, MARK_H = 180;          // 7.5 x 3 blocks
export const UNITS = 4;                           // grid units per block
const C = 60, U = C / UNITS, RAD = 12, K = 0.5522847498;

// The final logo, block by block: [x, y, w, h] in mark units, and the corners that round. The J's stem is one
// shape, drawn as two blocks so it can grow a block at a time.
export const BLOCKS = {
  J1: { L: 'J', r: [60, 0, 60, 60], round: 'tl tr' },
  J2: { L: 'J', r: [60, 60, 60, 60], round: 'br' },
  J3: { L: 'J', r: [0, 120, 60, 60], round: 'tl bl br' },
  C1: { L: 'C', r: [135, 60, 60, 60], round: 'tl bl' },
  C2: { L: 'C', r: [195, 0, 60, 60], round: 'tl tr br' },
  C3: { L: 'C', r: [195, 120, 60, 60], round: 'tr br bl' },
  G1: { L: 'G', r: [270, 60, 60, 60], round: 'tl bl' },
  G2: { L: 'G', r: [330, 0, 60, 60], round: 'tl tr br' },
  G3: { L: 'G', r: [330, 120, 60, 60], round: 'bl br' },
  G4: { L: 'G', r: [390, 90, 60, 30], round: 'tl tr br' },
};
// Fillets at the corner contacts: [x, y, the corner of the empty quadrant at that point, the bud that grows it].
const WEBS = [
  [60, 120, 'br', 'J3'], [60, 120, 'tl', 'J3'],
  [195, 60, 'br', 'C2'], [195, 60, 'tl', 'C2'], [195, 120, 'bl', 'C3'], [195, 120, 'tr', 'C3'],
  [330, 60, 'br', 'G2'], [330, 60, 'tl', 'G2'], [330, 120, 'bl', 'G3'], [330, 120, 'tr', 'G3'],
  [390, 120, 'br', 'G4'], [390, 120, 'tl', 'G4'],
];
const CORNERS = ['tl', 'tr', 'br', 'bl'];
const rf = (t, k) => (' ' + BLOCKS[t].round + ' ').includes(' ' + k + ' ') ? RAD : 0;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = x => Math.max(0, Math.min(1, x));
function spring(tau, z = 0.66, w = 26) {          // 0 -> 1 with a small overshoot (~6%), settled in ~0.25 s
  if (tau <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}
const settle = tau => spring(tau, 0.92, 20);       // corner radii: slower, no visible overshoot
const smooth = (tau, d) => { const x = clamp01(tau / d); return x * x * (3 - 2 * x); };

// Growth order: the C first, then the J out of the C's back and the G off the C's top-right corner.
const PLAN = [
  { t: 'C1', type: 'seed', s: 0 },
  { t: 'C2', p: 'C1', type: 'corner', dx: 1, dy: -1, s: 8 },
  { t: 'C3', p: 'C1', type: 'corner', dx: 1, dy: 1, s: 10 },
  { t: 'J2', p: 'C1', type: 'edge', d: '-x', s: 16 },          // the J is born, squeezing out of the C's back
  { t: 'G1', p: 'C2', type: 'corner', dx: 1, dy: 1, s: 18 },   // the G is born, on a temporary neck
  { t: 'J1', p: 'J2', type: 'edge', d: '-y', s: 24 },
  { t: 'G2', p: 'G1', type: 'corner', dx: 1, dy: -1, s: 26 },
  { t: 'G3', p: 'G1', type: 'corner', dx: 1, dy: 1, s: 28 },
  { t: 'J3', p: 'J2', type: 'corner', dx: -1, dy: 1, s: 30 },
  { t: 'G4', p: 'G3', type: 'corner', dx: 1, dy: -1, s: 38 },
];
const SNAP0 = 30, SNAP1 = 36, PINCH = 32;         // the G's neck thins over 30-36; the J|C notches pinch in at 32
const SLIDE_J = 36, SLIDE_G = 38;                 // then each letter slides one unit away from the C
const EVENTS = {                                   // corner radius changes for the divisions: [frame, target]
  'C1:tl': [[PINCH, RAD]], 'C1:bl': [[PINCH, RAD]], 'J2:br': [[PINCH, RAD]],   // J|C: the notches pinch in
  'C2:br': [[SNAP1, RAD]], 'G1:tl': [[SNAP1, RAD]],                            // C|G: neck, then split
};
const BY = {}; PLAN.forEach(e => BY[e.t] = e);
const ATTACH = {};                                 // a parent's corners square off when a child starts out of that side
for (const e of PLAN) { if (!e.p) continue;
  const ks = e.type === 'edge' ? { '+x': ['tr', 'br'], '-x': ['tl', 'bl'], '-y': ['tl', 'tr'], '+y': ['bl', 'br'] }[e.d]
                               : [(e.dy > 0 ? 'b' : 't') + (e.dx > 0 ? 'r' : 'l')];
  for (const k of ks) (ATTACH[e.p + ':' + k] = ATTACH[e.p + ':' + k] || []).push(e.s); }

function tile(e, fr) {
  if (fr < e.s) return null;
  const tau = (fr - e.s) / FPS, g = Math.max(0, spring(tau)), hc = settle(Math.max(0, tau - 0.04));
  const [X, Y, W, H] = BLOCKS[e.t].r;
  const full = (v, n) => Math.abs(v - n) < 0.5 ? n : v;   // snap once settled, so blocks never leave a sub-pixel gap
  const gw = full(W * g, W), gh = full(H * g, H);
  let x, y, w, h; const att = {};
  if (e.type === 'seed') { w = gw; h = gh; x = X + W / 2 - w / 2; y = Y + H / 2 - h / 2; }
  else if (e.type === 'edge') {
    if (e.d === '+x') { x = X; y = Y; w = gw; h = H; att.tl = att.bl = 1; }
    else if (e.d === '-x') { x = X + W - gw; y = Y; w = gw; h = H; att.tr = att.br = 1; }
    else if (e.d === '-y') { x = X; y = Y + H - gh; w = W; h = gh; att.bl = att.br = 1; }
    else { x = X; y = Y; w = W; h = gh; att.tl = att.tr = 1; }
  } else {
    const ax = e.dx > 0 ? X : X + W, ay = e.dy > 0 ? Y : Y + H;
    w = gw; h = gh; x = e.dx > 0 ? ax : ax - w; y = e.dy > 0 ? ay : ay - h;
    att[(e.dy > 0 ? 't' : 'b') + (e.dx > 0 ? 'l' : 'r')] = 1;
  }
  const half = Math.max(0, Math.min(w, h) / 2), rr = {};
  for (const k of CORNERS) {
    let v = att[k] ? 0 : lerp(half, rf(e.t, k), hc);   // free corners start round (a droplet), then settle
    const at = ATTACH[e.t + ':' + k];
    if (at) for (const t0 of at) if (fr >= t0) v = lerp(v, 0, settle((fr - t0) / FPS));
    const ev = EVENTS[e.t + ':' + k];
    if (ev) for (const [t0, tg] of ev) if (fr >= t0) v = lerp(v, tg, settle((fr - t0) / FPS));
    rr[k] = Math.max(0, Math.min(v, half));
  }
  return { x, y, w, h, r: rr };
}
function budNeck(e, fr) {                          // a fat neck while the bud grows, a fifth of a block at rest
  if (fr < e.s) return 0;
  const tau = (fr - e.s) / FPS, g = Math.max(0, spring(tau)), hc = settle(Math.max(0, tau - 0.04));
  return Math.max(0, Math.min(C * g, RAD + 10 * (1 - hc)));
}
function splitNeck(fr) {                           // the C|G neck: grows with the G, thins to nothing, gone
  let F = budNeck(BY.G1, fr);
  if (fr >= SNAP0) F *= 1 - smooth((fr - SNAP0) / FPS, (SNAP1 - SNAP0) / FPS);
  return F;
}
function offset(L, fr) {                           // the J and G start against the C, then slide one unit out
  if (L === 'J') return fr < SLIDE_J ? U : U * (1 - spring((fr - SLIDE_J) / FPS, 0.7, 22));
  if (L === 'G') return fr < SLIDE_G ? -U : -U * (1 - spring((fr - SLIDE_G) / FPS, 0.7, 22));
  return 0;
}
function rrPath(p, x, y, w, h, r) {               // rounded rect, per-corner radii, clockwise
  if (w <= 0.05 || h <= 0.05) return;
  const { tl, tr, br, bl } = r;
  p.moveTo(x + tl, y);
  p.lineTo(x + w - tr, y); if (tr > 0) p.bezierCurveTo(x + w - tr + K * tr, y, x + w, y + tr - K * tr, x + w, y + tr);
  p.lineTo(x + w, y + h - br); if (br > 0) p.bezierCurveTo(x + w, y + h - br + K * br, x + w - br + K * br, y + h, x + w - br, y + h);
  p.lineTo(x + bl, y + h); if (bl > 0) p.bezierCurveTo(x + bl - K * bl, y + h, x, y + h - bl + K * bl, x, y + h - bl);
  p.lineTo(x, y + tl); if (tl > 0) p.bezierCurveTo(x, y + tl - K * tl, x + tl - K * tl, y, x + tl, y);
  p.closePath();
}
const IN = { tl: [1, 1], tr: [-1, 1], bl: [1, -1], br: [-1, -1] };
function webPath(p, px, py, k, F) {               // concave fillet at (px, py), into the empty quadrant whose corner k it is
  if (F <= 0.05) return;
  const sx = IN[k][0], sy = IN[k][1];
  const ax = px + F * sx, ay = py, bx = px, by = py + F * sy;
  const c1x = ax - K * F * sx, c1y = ay, c2x = bx, c2y = by - K * F * sy;
  p.moveTo(px, py);
  if (sx * sy > 0) { p.lineTo(ax, ay); p.bezierCurveTo(c1x, c1y, c2x, c2y, bx, by); }
  else { p.lineTo(bx, by); p.bezierCurveTo(c2x, c2y, c1x, c1y, ax, ay); }
  p.closePath();
}

function buildMark(p, fr) {
  for (const e of PLAN) { const s = tile(e, fr); if (!s) continue; rrPath(p, s.x + offset(BLOCKS[e.t].L, fr), s.y, s.w, s.h, s.r); }
  for (const [x, y, k, bud] of WEBS) { const F = budNeck(BY[bud], fr); if (F > 0) webPath(p, x + offset(BLOCKS[bud].L, fr), y, k, F); }
  const n = splitNeck(fr); if (n > 0) { webPath(p, 255, 60, 'bl', n); webPath(p, 255, 60, 'tr', n); }
  return p;
}
const n2 = v => String(Math.round(v * 100) / 100);
class PathString {                                 // the Path2D calls used above, written out as SVG path data
  constructor() { this.d = ''; }
  moveTo(x, y) { this.d += 'M' + n2(x) + ' ' + n2(y); }
  lineTo(x, y) { this.d += 'L' + n2(x) + ' ' + n2(y); }
  bezierCurveTo(a, b, c, d, e, f) { this.d += 'C' + [a, b, c, d, e, f].map(n2).join(' '); }
  closePath() { this.d += 'Z'; }
}
/** The mark at frame `fr` as a Path2D in mark units (block 60, origin at the mark's top-left). */
export function markPath(fr) { return buildMark(new Path2D(), fr); }
/** The same, as SVG path data (for an <svg viewBox="0 0 450 180">). Empty before the first block appears. */
export function markD(fr) { return fr <= 0 ? '' : buildMark(new PathString(), fr).d; }
/** The settled logo as SVG path data. */
export const FINAL_D = markD(10 * MARK_END);
/** The pieces of the build, in the order they bud: nine blocks and the G's half-height spur. */
export const PIECES = PLAN.length;
/** The mark's first n pieces in budding order, every one already in its final place (no letter slides, no temporary
    necks): the nav's progress bar for the nine blocks (play-store.js), one more piece per find. fr is the frame the
    pieces are drawn at (settled by default; small frames replay their build); `grow` draws the newest piece that many
    frames into its own bud while the rest hold still. partialD(PIECES) is the logo. */
export function partialD(n, fr = 10 * MARK_END, grow = Infinity) {
  const p = new PathString(), show = PLAN.slice(0, Math.max(0, Math.min(n, PIECES))), newest = show[show.length - 1];
  const at = (e) => (e === newest && grow !== Infinity ? e.s + grow : fr);
  for (const e of show) { const s = tile(e, at(e)); if (s) rrPath(p, s.x, s.y, s.w, s.h, s.r); }
  for (const [x, y, k, bud] of WEBS) { const e = BY[bud]; if (!show.includes(e)) continue; const F = budNeck(e, at(e)); if (F > 0) webPath(p, x, y, k, F); }
  return p.d;
}
/** One block on its own, as the logo has it (its corners rounded where its letter turns), as SVG path data with the
    block's top-left at 0 0 (60 x 60 mark units; the spur is 60 x 30). The pieces of the build-the-mark puzzle. */
export function blockD(id) {
  const [, , w, h] = BLOCKS[id].r, r = {}, p = new PathString();
  for (const k of CORNERS) r[k] = rf(id, k);
  rrPath(p, 0, 0, w, h, r);
  return p.d;
}
/** Draw the mark at frame `fr` with its top-left corner at (x0, y0) and the given block size. */
export function drawMark(ctx, fr, x0, y0, cell, color = '#E6E9ED') {
  if (fr <= 0) return;
  ctx.save(); ctx.translate(x0, y0); ctx.scale(cell / C, cell / C);
  ctx.fillStyle = color; ctx.fill(markPath(fr)); ctx.restore();
}
/** The dot grid: the site's Work-canvas pattern (assets/css/canvas.css) at block scale. A dot on every block (one grid row
    or column is one block, 60 px at the videos' size), faint (alpha .11); every fifth dot, in both directions, brighter and
    larger (alpha .24, 1.2x the radius), drawn over its base dot, so it has a brighter core, as on the site. The site's dots
    are 1 px on a 24 px step; here the radius keeps the same ratio, step / 24 (2.5 px at 60 px blocks). JC: "will be a
    pattern we use in our branding". The lattice starts at the mark's top-left corner (x0, y0), so every block row of the
    mark, and a lockup's rows below it, sit on a row of dots. minors:false draws only the highlighted dots. */
export const GRID_EVERY = 5;
export function drawGrid(ctx, w, h, x0, y0, cell, { minors = true } = {}) {
  const step = cell, big = step * GRID_EVERY, r = step / 24;
  const lattice = (s) => ({ sx: ((x0 % s) + s) % s, sy: ((y0 % s) + s) % s });
  const dots = (s, rad, color) => {
    const { sx, sy } = lattice(s);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let y = sy; y <= h + rad; y += s) for (let x = sx; x <= w + rad; x += s) { ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, Math.PI * 2); }
    ctx.fill();
  };
  if (minors) dots(step, r, 'rgba(230,233,237,.11)');
  dots(big, r * 1.2, 'rgba(230,233,237,.24)');
}
/** Departure Mono type on the grid. size: font px; pitch: letter cell width; n: letters shown. */
export function drawType(ctx, text, n, x, baseline, size, pitch, color) {
  ctx.font = size + 'px "Departure Mono"'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color;
  for (let i = 0; i < Math.min(n, text.length); i++) ctx.fillText(text[i], x + pitch * i, baseline);
}
// ── STUDIO's letters ────────────────────────────────────────────────────────────────────────────────────────────
// JC picked "Departure, redrawn" (2026-10-05): the letters of the pixel face the logo carried before, redrawn as
// smooth strokes on the same grid. A letter is 5 x 8 units (a unit is an eighth of the cap height), a stroke is one
// unit wide, the pitch is 8 units (one cap height, so one letter per cell), corners round with a centreline radius of
// 1.25, and the ink sits 1.5 units into its cell. A glyph is SVG path data in grid units (y down), its strokes in the
// order a pen would draw them. The same data is inlined as static SVG in the nav and footer, drawn on canvas in the
// videos and the footer game, and drawn on stroke by stroke in the build.
export const PITCH = 8, INK_W = 5, CAP = 8, INK_X = 1.5;
const RC = 1.25;
const arc = (sweep, x, y) => `A${RC} ${RC} 0 0 ${sweep} ${x} ${y}`;
const CTOP = `V1.75${arc(0, 3.25, 0.5)}H1.75${arc(0, 0.5, 1.75)}`;                   // C and G: the top-right tick, the top bar, the top-left corner
const CBOT = `V6.25${arc(0, 1.75, 7.5)}H3.25${arc(0, 4.5, 6.25)}`;                   // ...and the bottom-left corner, the bottom bar, the bottom-right corner
const RAW = {
  S: ['round', [`M4.5 2${CTOP}V2.25${arc(0, 1.75, 3.5)}H3.25${arc(1, 4.5, 4.75)}V6.25${arc(1, 3.25, 7.5)}H1.75${arc(1, 0.5, 6.25)}V6`]],
  T: ['miter', ['M0 .5H5', 'M2.5 .5V8']],
  U: ['round', [`M.5 0V6.25${arc(0, 1.75, 7.5)}H3.25${arc(0, 4.5, 6.25)}V0`]],
  D: ['miter', [`M.5 .5H3.25${arc(1, 4.5, 1.75)}V6.25${arc(1, 3.25, 7.5)}H.5Z`]],
  I: ['miter', ['M0 .5H5', 'M2.5 .5V7.5', 'M0 7.5H5']],
  O: ['round', [`M1.75 .5H3.25${arc(1, 4.5, 1.75)}V6.25${arc(1, 3.25, 7.5)}H1.75${arc(1, 0.5, 6.25)}V1.75${arc(1, 1.75, 0.5)}Z`]],
  J: ['miter', [`M2 .5H4.5V6.25${arc(1, 3.25, 7.5)}H1.75${arc(1, 0.5, 6.25)}V6`]],
  C: ['round', [`M4.5 2${CTOP}${CBOT}V6`]],
  G: ['miter', [`M4.5 2${CTOP}${CBOT}V4.5H3`]],
  '.': ['miter', ['M2.5 6V8']],
};
function pathLength(d) {                           // M, H, V, L, A, Z only; every arc is a quarter circle of radius RC
  let len = 0, x = 0, y = 0, sx = 0, sy = 0;
  for (const [, c, a] of d.matchAll(/([MHVLAZ])([^MHVLAZ]*)/g)) {
    const v = a.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (c === 'M') { x = sx = v[0]; y = sy = v[1]; }
    else if (c === 'H') { len += Math.abs(v[0] - x); x = v[0]; }
    else if (c === 'V') { len += Math.abs(v[0] - y); y = v[0]; }
    else if (c === 'L') { len += Math.hypot(v[0] - x, v[1] - y); x = v[0]; y = v[1]; }
    else if (c === 'A') { len += Math.PI / 2 * RC; x = v[5]; y = v[6]; }
    else if (c === 'Z') { len += Math.hypot(sx - x, sy - y); x = sx; y = sy; }
  }
  return len;
}
/** Every letter: { join, strokes: [{ d, len }], all (one path, for a single even fill), total (length) }. */
export const GLYPHS = Object.fromEntries(Object.entries(RAW).map(([ch, [join, ds]]) => {
  const strokes = ds.map((d) => ({ d, len: pathLength(d) }));
  return [ch, { join, strokes, all: ds.join(''), total: strokes.reduce((n, s) => n + s.len, 0) }];
}));
/** A word's letters as SVG groups in grid units, the first letter's ink box at x = 0 (so an SVG viewBox can start there). */
export function wordGroups(text) {
  return [...text].map((ch, i) => (GLYPHS[ch] ? `<g transform="translate(${i * PITCH} 0)" stroke-linejoin="${GLYPHS[ch].join}"><path d="${GLYPHS[ch].all}"/></g>` : '')).join('');
}
/** Ink width of a word in grid units: eight per letter, less the last letter's side space. */
export const wordInk = (text) => (text.length - 1) * PITCH + INK_W;
/** A word as a stand-alone SVG, `unit` CSS px per grid unit (a unit of 1 puts the capitals at 8 px). Strokes use currentColor. */
export function wordSVG(text, unit = 1, attrs = '') {
  const w = wordInk(text);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${CAP}" width="${+(w * unit).toFixed(2)}" height="${+(CAP * unit).toFixed(2)}" ${attrs} fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="butt">${wordGroups(text)}</svg>`;
}
const paths = new Map();
const pathOf = (d) => paths.get(d) || (paths.set(d, new Path2D(d)), paths.get(d));
/** Stroke one letter on canvas: ink box top-left at (ox, oy), fp px per grid unit, P = how much of it is drawn (0..1,
    spread over its strokes by length). Whole letters are one stroke, so a translucent colour stays even where strokes cross. */
export function drawGlyph(ctx, ch, ox, oy, fp, P, color) {
  const g = GLYPHS[ch];
  if (!g || P <= 0) return;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(fp, fp);
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.lineCap = 'butt'; ctx.lineJoin = g.join; ctx.miterLimit = 4;
  if (P >= 1) ctx.stroke(pathOf(g.all));
  else {
    let left = P * g.total;
    for (const s of g.strokes) {
      if (left <= 0) break;
      ctx.setLineDash(left >= s.len ? [] : [left, s.len + 1]);
      ctx.stroke(pathOf(s.d));
      left -= s.len;
    }
  }
  ctx.restore();
}
/** The first n letters of a word, whole. x = left of the first letter's cell, capTop = top of the capitals, fp = px per grid unit. */
export function drawWord(ctx, text, n, x, capTop, fp, color) {
  for (let i = 0; i < Math.min(n, text.length); i++) drawGlyph(ctx, text[i], x + (PITCH * i + INK_X) * fp, capTop, fp, 1, color);
}
const DRAW = 12, UNDRAW = 6;                       // frames to draw a letter on, and to draw it back off
/** Letters that draw on and off. Letter i starts at frame appear[i] (a pen draws it over 12 frames, easing out) and draws
    back off from vanish[i] (Infinity keeps it; 6 frames, last stroke first). Same arguments as before: x = left of the
    first cell, capTop, fp = px per grid unit (cap height / 8). */
export function drawBudLetters(ctx, fr, text, x, capTop, fp, color, appear, vanish = []) {
  for (let i = 0; i < text.length; i++) {
    if (!(fr >= appear[i])) continue;
    let P = 1 - Math.pow(1 - clamp01((fr - appear[i]) / DRAW), 3);
    const out = vanish[i] ?? Infinity;
    if (fr >= out) P *= 1 - clamp01((fr - out) / UNDRAW);
    drawGlyph(ctx, text[i], x + (PITCH * i + INK_X) * fp, capTop, fp, P, color);
  }
}
const CELLS = new Map();
/** The grid cells a letter touches (for the footer game's bricks), read from a canvas once: { x, y } in its 5 x 8 ink box,
    every cell holding more than 2% ink. Browser only. */
export function glyphCells(ch) {
  if (CELLS.has(ch)) return CELLS.get(ch);
  const S = 16, c = document.createElement('canvas'); c.width = INK_W * S; c.height = CAP * S;
  const g = c.getContext('2d', { willReadFrequently: true });
  drawGlyph(g, ch, 0, 0, S, 1, '#fff');
  const d = g.getImageData(0, 0, c.width, c.height).data, cells = [];
  for (let cy = 0; cy < CAP; cy++) for (let cx = 0; cx < INK_W; cx++) {
    let sum = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) sum += d[((cy * S + y) * c.width + cx * S + x) * 4 + 3];
    if (sum / (S * S * 255) > 0.02) cells.push({ x: cx, y: cy });
  }
  CELLS.set(ch, cells);
  return cells;
}

/** The mark as bricks (for the footer game): `per` bricks per grid unit, so a block is 4 x per bricks square.
    The brick at a rounded corner is a quarter disc (kind 'round', corner k); each fillet is one extra brick in the
    empty quadrant beside a same-letter corner contact (kind 'web', corner k). x and y count bricks from the
    mark's top-left. */
export function markBricks(per = 2) {
  const out = [], s = U / per;
  for (const [id, b] of Object.entries(BLOCKS)) {
    const [X, Y, W, H] = b.r, nx = W / s, ny = H / s;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = i === 0 && j === 0 ? 'tl' : i === nx - 1 && j === 0 ? 'tr' : i === 0 && j === ny - 1 ? 'bl' : i === nx - 1 && j === ny - 1 ? 'br' : null;
      out.push({ x: X / s + i, y: Y / s + j, kind: k && rf(id, k) ? 'round' : 'full', k });
    }
  }
  for (const [x, y, k] of WEBS) out.push({ x: x / s - (k[1] === 'r' ? 1 : 0), y: y / s - (k[0] === 'b' ? 1 : 0), kind: 'web', k });
  return out;
}

/** The stacked lockup's type metrics (video and social), from the mark, on the dot grid (one grid row is one block):
    STUDIO's capitals are one block tall, one empty row below the mark and centred under it, so their top and baseline
    sit on rows of dots (JC chose this "one clean grid row" lockup on 2026-10-05); the address, when there is one, is
    half a block tall, one empty row below STUDIO. */
export function lockup(x0, y0, cell) {
  const cap = cell, ucap = cell / 2;
  return {
    studio: { x: x0 + (7.5 * cell - 6 * cap) / 2, baseline: y0 + 5 * cell, size: cap * 11 / 8, pitch: cap, cap },
    url: { x: x0 + (7.5 * cell - 10 * ucap) / 2, baseline: y0 + 6 * cell + ucap, size: ucap * 11 / 8, pitch: ucap, cap: ucap },
  };
}
