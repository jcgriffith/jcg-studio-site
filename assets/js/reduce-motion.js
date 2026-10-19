// Single source for prefers-reduced-motion. Modules read reduced() at call time,
// so toggling the OS setting mid-session takes effect on the next interaction.
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

export const reduced = () => mq.matches;

export function onReducedChange(fn) {
  mq.addEventListener('change', () => fn(mq.matches));
}

// Resolves once an element first enters the viewport (or immediately without IO).
export function onceInView(el, fn, rootMargin = '0px 0px -12% 0px') {
  if (!('IntersectionObserver' in window)) { fn(el); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { io.disconnect(); fn(el); }
    }
  }, { rootMargin, threshold: 0.15 });
  io.observe(el);
}
