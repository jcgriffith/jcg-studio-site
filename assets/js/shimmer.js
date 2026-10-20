// Placeholder shimmer (Libraries.dev-style) — on frame load ONLY.
// shimmer(el, loader) shows the sweep until the loader promise settles,
// holding at least `min` ms so fast loads don't flash.
import { reduced } from './reduce-motion.js';

export function shimmer(el, loader, min = 520) {
  el.classList.add('is-loading');
  el.setAttribute('aria-busy', 'true');
  const floor = new Promise((r) => setTimeout(r, reduced() ? 0 : min));
  return Promise.allSettled([loader, floor]).then(([res]) => {
    el.classList.remove('is-loading');
    el.removeAttribute('aria-busy');
    return res.status === 'fulfilled' ? res.value : null;
  });
}

// Image loader for frames that carry a real src (future artifacts).
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
