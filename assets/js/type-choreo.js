// Type choreography (Departure Mono–style): the muted second clause of each
// heading decodes from pixel noise the first time it enters view. The final
// text is laid out from the start (each glyph is transparent under a 22px
// Departure Mono noise glyph), so nothing reflows or rewraps. Triggered once
// by visibility, never tied to scroll position. Reduced motion: plain text.
import { reduced, onceInView } from './reduce-motion.js';

const NOISE = '░▒▓/+-:·';
const DUR = 720;

function decode(el) {
  const text = el.textContent;
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  const cells = [...text].map((ch) => {
    const s = document.createElement('span');
    s.textContent = ch;
    if (ch.trim()) { s.className = 'dc'; s.dataset.g = NOISE[(Math.random() * NOISE.length) | 0]; }
    vis.append(s);
    return s;
  }).filter((s) => s.className);
  el.replaceChildren(sr, vis);
  el.classList.add('is-decoding');

  const t0 = performance.now();
  const n = cells.length;
  const frame = (now) => {
    const p = Math.min(1, (now - t0) / DUR);
    const front = p * (n + 4);
    cells.forEach((c, i) => {
      if (!c.className) return;
      if (i < front - 4) { c.className = ''; delete c.dataset.g; }
      else if (i < front) { c.classList.add('is-front'); c.dataset.g = NOISE[(Math.random() * NOISE.length) | 0]; }
      else if (Math.random() < 0.25) c.dataset.g = NOISE[(Math.random() * NOISE.length) | 0];
    });
    if (p < 1) requestAnimationFrame(frame);
    else { el.textContent = text; el.classList.remove('is-decoding'); }
  };
  requestAnimationFrame(frame);
}

export function initTypeChoreo(root = document) {
  if (reduced()) return;
  root.querySelectorAll('.h2 .mute, .display .mute').forEach((el) => {
    // Hide until triggered so the clause doesn't flash in finished, then decode.
    el.classList.add('dc-wait');
    onceInView(el, () => setTimeout(() => { el.classList.remove('dc-wait'); decode(el); }, 260), '0px 0px -10% 0px');
  });
}
