// Scanline Reveal — one soft horizontal band sweeps the frame on hover/focus/tap
// and leaves a mono tag in the corner. Reduced motion: tag appears, no sweep.
import { reduced } from './reduce-motion.js';

function ensure(el) {
  if (el._scan) return el._scan;
  el.classList.add('scan');
  // Frames keep their label outside the box, so the band lives in the clipped body.
  const host = el.querySelector('[data-scan-host]') || el;
  const band = document.createElement('span');
  band.className = 'scan-band';
  band.setAttribute('aria-hidden', 'true');
  host.append(band);
  if (el.dataset.scan) {
    const tag = document.createElement('span');
    tag.className = 'scan-tag hud';
    tag.setAttribute('aria-hidden', 'true');
    tag.textContent = el.dataset.scan;
    host.append(tag);
  }
  band.addEventListener('animationend', () => el.classList.remove('is-scanning'));
  return (el._scan = band);
}

export function scan(el) {
  ensure(el);
  el.classList.add('is-tagged');
  if (reduced() || el.classList.contains('is-scanning')) return;
  el.classList.add('is-scanning');
}

export function initScanline(root = document) {
  root.querySelectorAll('[data-scan]').forEach((el) => {
    ensure(el);
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') scan(el); });
    el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') scan(el); });
    el.addEventListener('focusin', () => scan(el));
  });
}
