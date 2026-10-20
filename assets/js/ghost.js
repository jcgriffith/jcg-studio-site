// JC's ghost (brand Character tab, proposed 2026-10-06). The brand's one orange is JC's hand, and this is his cursor:
// a replay of how he works, never a live presence (every scene that uses it says so). It moves the way a hand does: a
// slight arc on a minimum-jerk clock, a hair past the target, then a correction. It presses, carries things, draws
// marks, and leaves one-line comments.
// ghost(layer) puts it in `layer` (a positioned element). Every action returns a promise that resolves true when it
// finished and false when it was stopped, so a scene reads as a script and can give way to a visitor:
//   const jc = ghost(board); if (!(await jc.moveTo(120, 80))) return; await jc.press(); ...
// Reduced motion: it jumps instead of gliding, marks appear whole, comments still show.
import { reduced } from './reduce-motion.js';

const POINTER = 'M1.2 1.2v16.6l4.3-4.1 2.9 6.5 2.6-1.1-2.8-6.4h6z';   // tip at (1.2, 1.2)
const minJerk = (t) => t * t * t * (10 - 15 * t + 6 * t * t);       // how a hand reaches: slow, fast, slow

export function ghost(layer, { label = 'JC', x = 0, y = 0, pace = 1 } = {}) {   // pace > 1 is a hurried JC
  const el = document.createElement('div');
  el.className = 'ghost';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg class="ghost-ptr" viewBox="0 0 17 22" width="17" height="22"><path d="${POINTER}"/></svg>` +
    `<span class="ghost-tag">${label}</span><span class="ghost-say" hidden></span>`;
  layer.append(el);
  const bubble = el.querySelector('.ghost-say');
  let gen = 0, raf = 0, hushT = 0, lw = layer.clientWidth;
  new ResizeObserver(() => { lw = layer.clientWidth; }).observe(layer);
  const put = () => { el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`; el.classList.toggle('is-flip', x > lw - 250); };   // comments open leftward near the right edge
  const live = (g) => g === gen;
  put();

  function frames(dur, onT) {                        // run onT(0..1) once a frame; resolves false if stopped
    const g = gen, t0 = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        if (!live(g)) return resolve(false);
        const t = Math.min(1, (now - t0) / dur);
        onT(t);
        if (t < 1) raf = requestAnimationFrame(step); else resolve(true);
      };
      raf = requestAnimationFrame(step);
    });
  }

  const api = {
    el,
    get x() { return x; }, get y() { return y; },
    /** Glide to (tx, ty). carry(x, y) is called each frame with the tip's position, to drag something along. */
    moveTo(tx, ty, { ms, carry, arc = 0.1 } = {}) {
      const x0 = x, y0 = y, dx = tx - x0, dy = ty - y0, d = Math.hypot(dx, dy);
      if (d < 0.5 || reduced()) { x = tx; y = ty; put(); carry?.(x, y); return Promise.resolve(true); }
      const dur = ms ?? Math.min(900, 280 + d * 0.7) / pace;
      const side = Math.round(x0 + y0) % 2 ? 1 : -1;   // which way the arc bends: steady for a start point, never random
      const cx = x0 + dx / 2 - (dy / d) * d * arc * side, cy = y0 + dy / 2 + (dx / d) * d * arc * side;
      const over = Math.min(5, d * 0.03), ox = tx + (dx / d) * over, oy = ty + (dy / d) * over;
      return frames(dur, (t) => {
        if (t < 0.86) {                                 // the reach, aimed a hair past the target
          const s = minJerk(t / 0.86), a = 1 - s;
          x = a * a * x0 + 2 * a * s * cx + s * s * ox; y = a * a * y0 + 2 * a * s * cy + s * s * oy;
        } else {                                        // the correction
          const s = minJerk((t - 0.86) / 0.14);
          x = ox + (tx - ox) * s; y = oy + (ty - oy) * s;
        }
        put(); carry?.(x, y);
      });
    },
    /** Draw an SVG <path> that sits in the layer's own pixel space: the tip follows it as the stroke appears. */
    draw(path, { ms } = {}) {
      const L = path.getTotalLength();
      path.style.strokeDasharray = `${L} ${L}`;
      if (reduced()) { path.style.strokeDashoffset = '0'; const p = path.getPointAtLength(L); x = p.x; y = p.y; put(); return Promise.resolve(true); }
      path.style.strokeDashoffset = String(L);
      return frames(ms ?? Math.min(1300, 260 + L * 2) / pace, (t) => {
        const l = L * minJerk(t), p = path.getPointAtLength(l);
        path.style.strokeDashoffset = String(L - l);
        x = p.x; y = p.y; put();
      });
    },
    press() { el.classList.add('is-down'); return api.wait(110); },
    release() { el.classList.remove('is-down'); return api.wait(70); },
    /** One line in JC's voice, beside the cursor. It goes after `ms`, or stays with keep. Doesn't wait. */
    say(text, { ms = 2000, keep = false } = {}) {
      clearTimeout(hushT);
      bubble.textContent = text; bubble.hidden = false;
      if (!keep) hushT = setTimeout(() => { bubble.hidden = true; }, ms);
    },
    hush() { clearTimeout(hushT); bubble.hidden = true; },
    wait(ms) { const g = gen; return new Promise((r) => setTimeout(() => r(live(g)), reduced() ? Math.min(ms, 120) : ms)); },
    /** Stop whatever it is doing (a visitor took the thing it was going for). Pending actions resolve false. */
    stop() { gen++; cancelAnimationFrame(raf); el.classList.remove('is-down'); },
    jump(tx, ty) { x = tx; y = ty; put(); },
    show() { el.classList.remove('is-away'); },
    hide() { el.classList.add('is-away'); },
  };
  return api;
}
