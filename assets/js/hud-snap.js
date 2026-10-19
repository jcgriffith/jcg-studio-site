// HUD Label Snap — corner brackets overshoot then seat, once.
// Nav snaps on load; eyebrows snap the first time they enter view.
import { reduced, onceInView } from './reduce-motion.js';

export function initHudSnap(root = document) {
  const els = root.querySelectorAll('.snap');
  if (reduced()) { els.forEach((el) => el.classList.add('is-snapped')); return; }
  els.forEach((el, i) => {
    const snap = () => el.classList.add('is-snapped');
    if (el.closest('.nav')) setTimeout(snap, 120 + i * 90);
    else onceInView(el, () => setTimeout(snap, 60), '0px 0px -6% 0px');
  });
}
