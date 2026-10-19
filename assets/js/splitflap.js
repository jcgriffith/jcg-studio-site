// Split-Flap CTA — label glyphs cascade like a departures board on hover/focus,
// settling left to right. Reduced motion: the label never flips.
import { reduced } from './reduce-motion.js';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·+-';
const TICK = 38;       // ms per flip
const SETTLE = 2;      // extra flips per character index (left-to-right cascade)

function wrap(label) {
  const text = label.textContent;
  label.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text.trim();
  label.append(sr);
  const chars = [...text].map((ch) => {
    const s = document.createElement('span');
    s.className = 'flap-ch';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = ch;
    s.dataset.ch = ch;
    label.append(s);
    return s;
  });
  return chars;
}

function run(btn, chars) {
  if (reduced() || btn._flapping) return;
  btn._flapping = true;
  const letters = chars.filter((c) => c.dataset.ch.trim());
  let done = 0;
  letters.forEach((c, i) => {
    let n = 3 + Math.floor(i * SETTLE * 0.5) + (Math.random() * 2 | 0);
    const step = () => {
      if (n-- <= 0) {
        c.textContent = c.dataset.ch;
        c.classList.remove('is-flip');
        if (++done === letters.length) btn._flapping = false;
        return;
      }
      c.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      c.classList.remove('is-flip');
      void c.offsetWidth; // restart the flap keyframe
      c.classList.add('is-flip');
      setTimeout(step, TICK);
    };
    setTimeout(step, i * 18);
  });
}

export function initSplitFlap(root = document) {
  root.querySelectorAll('[data-flap]').forEach((btn) => {
    const label = btn.querySelector('.flap');
    if (!label || btn._flapReady) return; // the shared nav inits its CTA too: wrap once
    btn._flapReady = true;
    const chars = wrap(label);
    const go = () => run(btn, chars);
    btn.flap = go; // lets a parent's hover trigger it (canvas tiles)
    btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') go(); });
    btn.addEventListener('focus', () => { if (btn.matches(':focus-visible')) go(); });
  });
}
