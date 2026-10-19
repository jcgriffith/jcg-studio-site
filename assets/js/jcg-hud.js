// JCG interface effects on canvas: the site's corner brackets, their snap and lock-on, and the Scanline Reveal, ported
// so video frames and stills can use them. Like jcg-bud.js, every function draws one frame from a progress or a frame
// number, so a render is repeatable.
//
// The numbers are the site's own (assets/css/base.css and canvas.css). Brackets are two 1 px lines per corner, an arm
// of 5 to 18 px, outside the object. A snap seats them in 520 ms on --ease-snap, cubic-bezier(.3, 1.4, .5, 1), from a
// loose start (1.22 x 1.9) while the ink flickers for 360 ms. The scan band is 28% of the frame, sweeps it in 760 ms on
// --ease-in-out and leaves a mono tag that rises 4 px over 240 ms. At any other scale, multiply every length by
// k = step / 24, the step of the grid they sit on (k = 2.5 on the videos' 60 px grid): a 1 px hairline on the site is
// a k px line here, the same rule as the grid's dots.
import { FPS, drawType } from './jcg-bud.js';

export const ms = (n) => (n * FPS) / 1000;          // milliseconds to frames
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of progress 0..1. */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-6) return Y(t); const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 32; i++) { if (X(t) > x) hi = t; else lo = t; t = (lo + hi) / 2; }
    return Y(t);
  };
}
export const easeSnap = cubicBezier(0.3, 1.4, 0.5, 1);     // --ease-snap, the HUD overshoot
export const easeInOut = cubicBezier(0.65, 0, 0.35, 1);    // --ease-in-out
export const easeOut = cubicBezier(0.2, 0.7, 0.2, 1);      // --ease-out

/** The snap-text flicker: opacity .2, 1, .55, 1 at 0, 34, 67 and 100% of 360 ms, three hard steps in each interval
    (animation: snap-text 360ms steps(3, end)). t = 0..1. */
export function flicker(t) {
  const K = [[0, 0.2], [0.34, 1], [0.67, 0.55], [1, 1]];
  if (t >= 1) return 1;
  if (t <= 0) return 0.2;
  for (let i = 0; i < 3; i++) {
    const [a, va] = K[i], [b, vb] = K[i + 1];
    if (t < b) return va + (vb - va) * (Math.floor(((t - a) / (b - a)) * 3) / 3);
  }
  return 1;
}

/** Corner brackets around a rect: eight rects, `arm` long and `lw` thick, on a box `out` outside the rect, scaled
    (sx, sy) about its centre, as the site scales the ::before. color carries its own alpha; `alpha` multiplies it. */
export function drawBrackets(ctx, x, y, w, h, { arm, lw, color, out = 0, sx = 1, sy = 1, alpha = 1 }) {
  const X = x - out, Y = y - out, W = w + 2 * out, H = h + 2 * out, cx = X + W / 2, cy = Y + H / 2;
  ctx.save();
  ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  ctx.translate(cx, cy); ctx.scale(sx, sy); ctx.translate(-cx, -cy);
  ctx.fillRect(X, Y, arm, lw); ctx.fillRect(X, Y, lw, arm);
  ctx.fillRect(X + W - arm, Y, arm, lw); ctx.fillRect(X + W - lw, Y, lw, arm);
  ctx.fillRect(X, Y + H - lw, arm, lw); ctx.fillRect(X, Y + H - arm, lw, arm);
  ctx.fillRect(X + W - arm, Y + H - lw, arm, lw); ctx.fillRect(X + W - lw, Y + H - arm, lw, arm);
  ctx.restore();
}

/** Brackets arriving (HUD Label Snap): from a loose 1.22 x 1.9 and invisible, seating over 520 ms with an overshoot while the
    opacity comes up in 180 ms under the flicker. f = frames since they started. */
export function snapIn(f) {
  const e = easeSnap(clamp01(f / ms(520)));
  return { sx: 1.22 - 0.22 * e, sy: 1.9 - 0.9 * e, alpha: clamp01(f / ms(180)) * flicker(f / ms(360)) };
}

/** Brackets locking on (the hover on a cluster): from 1.07 x 1.09 to rest in 520 ms on --ease-snap, flickering for 360 ms. */
export function lockOn(f) {
  const e = easeSnap(clamp01(f / ms(520)));
  return { sx: 1.07 - 0.07 * e, sy: 1.09 - 0.09 * e, alpha: flicker(f / ms(360)) };
}

/** The Scanline Reveal band over a rect, f frames after it starts (760 ms). Clipped to the rect. */
export function drawScan(ctx, x, y, w, h, f, k = 1) {
  const p = f / ms(760);
  if (p <= 0 || p >= 1) return;
  const o = p < 0.12 ? easeInOut(p / 0.12) : p < 0.88 ? 1 : 1 - easeInOut((p - 0.88) / 0.12);
  const bh = h * 0.28, top = y + (-0.28 + 1.288 * easeInOut(p)) * h;     // translateY(-100%) to translateY(360%) of its own height
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalAlpha *= o;
  const g = ctx.createLinearGradient(0, top, 0, top + bh);
  g.addColorStop(0, 'rgba(230,233,237,0)'); g.addColorStop(0.7, 'rgba(230,233,237,.10)'); g.addColorStop(0.99, 'rgba(230,233,237,.32)'); g.addColorStop(1, 'rgba(230,233,237,0)');
  ctx.fillStyle = g; ctx.fillRect(x, top, w, bh);
  ctx.fillStyle = 'rgba(230,233,237,.07)';                                   // a 1 px line every 3 px, counted up from the bottom
  for (let yy = top + bh - 2 * k; yy > top - k; yy -= 3 * k) ctx.fillRect(x, yy, w, k);
  ctx.fillStyle = 'rgba(230,233,237,.5)'; ctx.fillRect(x, top + bh - k, w, k);   // the 1 px edge it leaves behind
  ctx.restore();
}

/** The scan tag: a mono chip in the frame's lower right corner, 8 px in. It rises 4 px and fades in over 240 ms. f = frames
    since it landed; (right, bottom) is the frame's corner. */
export function drawTag(ctx, text, right, bottom, f, k = 1) {
  const p = clamp01(f / ms(240));
  if (p <= 0) return;
  const size = 11 * k, pitch = size * (8 / 11 + 0.08), padX = 7 * k, padY = 5 * k, b = k;
  const w = text.length * pitch + 2 * padX + 2 * b, h = size + 2 * padY + 2 * b;
  const x = right - 8 * k - w, y = bottom - 8 * k - h + (1 - easeOut(p)) * 4 * k;
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.fillStyle = '#0B0C0E'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(230,233,237,.24)'; ctx.lineWidth = b; ctx.strokeRect(x + b / 2, y + b / 2, w - b, h - b);
  drawType(ctx, text, text.length, x + b + padX, y + b + padY + size * 0.82, size, pitch, '#E6E9ED');
  ctx.restore();
}
