// The studio floor in video: scenes that show how the Work canvas moves, drawn one frame at a time like the logo's build.
//
//   diveScene     the open-and-close zoom. A tile lights up (lock-on and scan), then the camera dives into it while the
//                 grid zooms, the neighbours fade and the tile grows into the page; the same morph runs backwards to close.
//                 The timings and the maths are canvas.js's (DIVE_MS 700, ease in and out, log-space zoom).
//   lockOnScene   the settled lockup locked on: brackets snap in, a scan sweeps it, the address lands as a tag.
//   lowerThirdScene  a name panel for the lower left of a video, built from the same pieces. Transparent when alpha is set.
//
// Every length is the site's CSS length times K (assets/js/jcg-cam.js), so the 60 px grid is the site's 24 px grid at
// 2.5x. The pieces (brackets, scan, tag, eases) come from jcg-hud.js, the lockup and type from jcg-bud.js.
import { FPS, drawMark, drawWord, drawType, drawGrid, lockup } from './jcg-bud.js';
import { K, camLerp, rectOn, drawFloorGrid, easeInOutCubic, clamp01, lerp } from './jcg-cam.js';
import { ms, easeOut, snapIn, lockOn, drawBrackets, drawScan, drawTag } from './jcg-hud.js';

const VOID = '#0B0C0E', VOID2 = '#111418', PH1 = '#1A1E24', CHROME = '#E6E9ED', CHROME2 = 'rgba(230,233,237,.72)', CHROME3 = '#8A919B';
const LINE = 'rgba(230,233,237,.10)', LINE_STRONG = 'rgba(230,233,237,.24)', QUIET = 'rgba(230,233,237,.14)', SIGNAL = '#FF5B35';
const W0 = 1920, H0 = 1080;

/** The floor: the lockup at 24 px blocks and four frames, every edge a multiple of the 24 px grid, 96 px between neighbours
    where they face each other (the Work canvas's spacing). */
export const FLOOR = {
  lockup: { x: -96, y: -72, w: 180, h: 120 },
  tiles: [
    { id: 'a', label: 'SC-02 / HOME', x: 192, y: -192, w: 408, h: 288, chip: 'STUDIO CONCEPT' },
    { id: 'b', label: 'SC-01 / PAGE', x: -600, y: -216, w: 312, h: 240, chip: 'STUDIO CONCEPT' },
    { id: 'c', label: 'SC-01 / TOKENS', x: -336, y: 120, w: 264, h: 192 },
    { id: 'd', label: 'SC-02 / PRICING', x: 144, y: 192, w: 288, h: 144 },
  ],
};
/** The page a tile opens into: one block in from every edge of the frame, so it sits on the 60 px lattice. */
export const PAGE = { x: 60, y: 60, w: 1800, h: 960 };
const FLOOR_CAM = { z: 0.6, cx: 0, cy: 0 };          // 60% is the lowest zoom with a 14 px pitch, so the grid never has to step

const label = (ctx, text, x, baseline, size, color) => drawType(ctx, text, text.length, x, baseline, size, size * (8 / 11 + 0.08), color);
const typeWidth = (text, size) => text.length * size * (8 / 11 + 0.08);
const display = (ctx, text, x, baseline, size, color, { weight = 600, stretch = 'semi-expanded', track = -0.02 } = {}) => {
  ctx.save();
  ctx.font = `${weight} ${size}px Archivo`; ctx.fontStretch = stretch; ctx.letterSpacing = `${track * size}px`;
  ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, x, baseline);
  ctx.restore();
};
const fill = (ctx, color, r) => { ctx.fillStyle = color; ctx.fillRect(r.x, r.y, r.w, r.h); };
/** The chip (.chip--tag): chrome on void, 1 px line, 11 px mono. (x, bottom) is its lower left corner. */
function chip(ctx, text, x, bottom, k = K) {
  const size = 11 * k, w = typeWidth(text, size) + 16 * k + 2 * k, h = size + 12 * k + 2 * k;
  fill(ctx, VOID, { x, y: bottom - h, w, h });
  ctx.strokeStyle = LINE_STRONG; ctx.lineWidth = k; ctx.strokeRect(x + k / 2, bottom - h + k / 2, w - k, h - k);
  label(ctx, text, x + k + 8 * k, bottom - h + k + 6 * k + size * 0.82, size, CHROME);
  return w;
}

function drawTile(ctx, t, r, s) {
  fill(ctx, PH1, r);
  ctx.strokeStyle = LINE; ctx.lineWidth = s; ctx.strokeRect(r.x + s / 2, r.y + s / 2, r.w - s, r.h - s);
  label(ctx, t.label, r.x + 12 * K, r.y + 12 * K + 11 * K * 0.82, 11 * K, CHROME3);
  if (t.chip) chip(ctx, t.chip, r.x + 12 * K, r.y + r.h - 12 * K);
}
function drawLockupOn(ctx, r, cell) {
  drawMark(ctx, 600, r.x, r.y, cell);
  const S = lockup(r.x, r.y, cell).studio;
  drawWord(ctx, 'STUDIO', 6, S.x, S.baseline - S.cap, S.cap / 8, CHROME2);
}

/** The item page's content, revealed 600 to 900 ms after the open starts (canvas.css: "content 600-900"). t is ms. */
function pageContent(ctx, t) {
  const at = (t0) => { const a = clamp01((t - t0) / 240); return { a, dy: (1 - easeOut(a)) * 8 * K }; };
  const L = 120;
  let o = at(600); ctx.save(); ctx.globalAlpha *= o.a;
  label(ctx, 'SC-02 / HOME', L, 150 + o.dy, 11 * K, CHROME3);
  chip(ctx, 'STUDIO CONCEPT', L + typeWidth('SC-02 / HOME', 11 * K) + 30 * K, 160 + o.dy);
  label(ctx, 'SITES · 5 ARTIFACTS', L + typeWidth('SC-02 / HOME', 11 * K) + 30 * K + typeWidth('STUDIO CONCEPT', 11 * K) + 16 * K + 2 * K + 30 * K, 150 + o.dy, 11 * K, CHROME3);
  ctx.restore();
  o = at(660); ctx.save(); ctx.globalAlpha *= o.a;
  display(ctx, 'Oriel.', L, 350 + o.dy, 168, CHROME);
  ctx.restore();
  o = at(720); ctx.save(); ctx.globalAlpha *= o.a;
  display(ctx, 'A launch site the team can keep shipping pages on:', L, 440 + o.dy, 44, CHROME2, { weight: 400, stretch: 'normal', track: -0.005 });
  display(ctx, 'home, pricing, changelog, mobile, a section kit.', L, 502 + o.dy, 44, CHROME2, { weight: 400, stretch: 'normal', track: -0.005 });
  ctx.restore();
  [['SC-02 / HOME', 780], ['SC-02 / MOBILE', 830], ['SC-02 / PRICING', 880]].forEach(([text, t0], i) => {
    const q = at(t0), x = L + i * 580, y = 590 + q.dy;
    ctx.save(); ctx.globalAlpha *= q.a;
    fill(ctx, PH1, { x, y, w: 520, h: 390 });
    ctx.strokeStyle = LINE; ctx.lineWidth = K; ctx.strokeRect(x + K / 2, y + K / 2, 520 - K, 390 - K);
    label(ctx, text, x + 12 * K, y + 12 * K + 11 * K * 0.82, 11 * K, CHROME3);
    ctx.restore();
  });
}

// ── the dive ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const DIVE_DUR = 360;
const D = { hover: 48, scan: 48, open: 108, close: 264 }, DIVE_F = Math.round(ms(700));

/** The open-and-close zoom, 360 frames (6 s) and a loop: floor, hover (lock-on and scan), open, page, close, floor. */
export function diveScene(ctx, f, { W = W0, H = H0 } = {}) {
  const A = FLOOR.tiles[0];
  const zEnd = Math.max(PAGE.w / (A.w * K), PAGE.h / (A.h * K));                    // the art covers the page: canvas.js diveCam
  const DIVE_CAM = { z: zEnd, cx: A.x + A.w / 2, cy: A.y + A.h / 2 };
  const eo = f < D.open ? 0 : f < D.open + DIVE_F ? easeInOutCubic((f - D.open) / DIVE_F) : 1;
  const ec = f < D.close ? 0 : f < D.close + DIVE_F ? easeInOutCubic((f - D.close) / DIVE_F) : 1;
  const p = f < D.close ? eo : 1 - ec;                                              // how far open: 0 floor, 1 page
  const cam = camLerp(FLOOR_CAM, DIVE_CAM, p), s = cam.z * K;
  const nbr = f < D.open ? 1 : f < D.close ? 1 - clamp01((f - D.open) / ms(360)) : easeOut(clamp01((f - D.close) / ms(450)));   // is-exiting
  const open = f >= D.open && f < D.close + DIVE_F;                                // the item is open or opening or closing: no reticle

  ctx.fillStyle = VOID; ctx.fillRect(0, 0, W, H);
  drawFloorGrid(ctx, W, H, cam);

  ctx.save(); ctx.globalAlpha = nbr;
  drawLockupOn(ctx, rectOn(cam, W, H, FLOOR.lockup), 24 * s);
  for (const t of FLOOR.tiles.slice(1)) {
    const r = rectOn(cam, W, H, t);
    drawTile(ctx, t, r, s);
    drawBrackets(ctx, r.x, r.y, r.w, r.h, { arm: 18 * s, lw: s, out: 28 * s, color: QUIET });
  }
  ctx.restore();

  // the tile that opens: clipped to the morph rect while the page grows out of it
  const T0 = rectOn(FLOOR_CAM, W, H, A), R = { x: lerp(T0.x, PAGE.x, p), y: lerp(T0.y, PAGE.y, p), w: lerp(T0.w, PAGE.w, p), h: lerp(T0.h, PAGE.h, p) };
  const ra = rectOn(cam, W, H, A);
  ctx.save();
  if (p > 0) { ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip(); }
  drawTile(ctx, A, ra, s);
  ctx.restore();
  if (!open) {
    const hot = f >= D.hover && f < D.open, b = hot ? lockOn(f - D.hover) : { sx: 1, sy: 1, alpha: 1 };
    drawBrackets(ctx, ra.x, ra.y, ra.w, ra.h, { arm: 18 * s, lw: s, out: 28 * s, color: hot ? CHROME2 : QUIET, sx: b.sx, sy: b.sy, alpha: b.alpha });
    if (f >= D.scan && f < D.open) drawScan(ctx, ra.x, ra.y, ra.w, ra.h, f - D.scan, K);
  }

  // the page: pure black, clipped to the same rect, crossfading in over the last 40% of the morph
  const op = clamp01((p - 0.6) / 0.4);
  if (op > 0) {
    ctx.save(); ctx.globalAlpha = op;
    ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    fill(ctx, '#000', R);
    drawBrackets(ctx, PAGE.x, PAGE.y, PAGE.w, PAGE.h, { arm: 14 * K, lw: K, color: LINE_STRONG });
    pageContent(ctx, Math.max(0, ((f - D.open) / FPS) * 1000));
    ctx.restore();
  }
}

// ── the lock-on ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const LOCKON_DUR = 150;
/** The settled lockup on its grid, locked on: brackets snap in from frame 10, a scan sweeps from 36, the address lands
    as the tag at 82. The frame is the lockup's clear space with a second block below it for the tag. */
export function lockOnScene(ctx, f, { W = W0, H = H0 } = {}) {
  const CELL = 60, k = CELL / 24, X0 = 735, Y0 = 360, FRAME = { x: X0 - CELL, y: Y0 - CELL, w: 7.5 * CELL + 2 * CELL, h: 8 * CELL };
  ctx.fillStyle = VOID; ctx.fillRect(0, 0, W, H);
  drawGrid(ctx, W, H, X0, Y0, CELL);
  drawLockupOn(ctx, { x: X0, y: Y0 }, CELL);
  drawScan(ctx, FRAME.x, FRAME.y, FRAME.w, FRAME.h, f - 36, k);
  if (f >= 10) { const b = snapIn(f - 10); drawBrackets(ctx, FRAME.x, FRAME.y, FRAME.w, FRAME.h, { arm: 18 * k, lw: k, out: 28 * k, color: CHROME2, sx: b.sx, sy: b.sy, alpha: b.alpha }); }
  drawTag(ctx, 'JCG.STUDIO', FRAME.x + FRAME.w, FRAME.y + FRAME.h, f - 82, k);
}

// ── the lower third ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const LOWER_DUR = 192;
const LOWER = { name: 'JC Griffith', line: 'FOUNDER · JCG STUDIO' };
/** A name panel for the lower left of a video: the nav's logo panel grown to hold a name. The brackets snap in, the panel
    fills, the orange cursor types the line, the name lifts in, and it all leaves in 240 ms from frame 150. With alpha
    set there is no void and no grid, for overlaying footage. The panel is 14 x 3 blocks, on the 60 px lattice. */
export function lowerThirdScene(ctx, f, { W = W0, H = H0, alpha = false } = {}) {
  if (!alpha) { ctx.fillStyle = VOID; ctx.fillRect(0, 0, W, H); drawGrid(ctx, W, H, 0, 0, 60); }
  const P = { x: 120, y: 780, w: 840, h: 180 }, fade = 1 - clamp01((f - 150) / ms(240));
  const size = 11 * K, pitch = size * (8 / 11 + 0.08), X = P.x + 60 + 150 + 60;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.save(); ctx.globalAlpha *= clamp01((f - 10) / ms(180));
  fill(ctx, VOID2, P);
  ctx.strokeStyle = LINE; ctx.lineWidth = K; ctx.strokeRect(P.x + K / 2, P.y + K / 2, P.w - K, P.h - K);
  ctx.restore();
  const b = snapIn(f);
  drawBrackets(ctx, P.x, P.y, P.w, P.h, { arm: 6 * K, lw: K, out: 5 * K, color: LINE_STRONG, sx: b.sx, sy: b.sy, alpha: b.alpha });
  ctx.save(); ctx.globalAlpha *= clamp01((f - 24) / ms(240));
  drawMark(ctx, 600, P.x + 60, P.y + 60, 20);                                      // the mark at 20 px blocks, the site's 8 px minimum at 2.5x
  ctx.restore();
  const t0 = 36, n = Math.max(0, Math.min(LOWER.line.length, Math.floor((f - t0) / 2))), done = t0 + 2 * LOWER.line.length, base = P.y + 78;
  drawType(ctx, LOWER.line, n, X, base, size, pitch, CHROME3);
  const k = f - done, cursor = f >= t0 && (f < done || k < 12 || (k >= 24 && k < 36));   // typing, then on, off, on, off
  if (cursor) { ctx.fillStyle = SIGNAL; ctx.fillRect(X + pitch * n, base - size * 0.78, pitch, size * 0.78); }
  const a = clamp01((f - done) / ms(240));
  ctx.save(); ctx.globalAlpha *= a;
  display(ctx, LOWER.name, X, P.y + 146 + (1 - easeOut(a)) * 8 * K, 64, CHROME);
  ctx.restore();
  ctx.restore();
}
