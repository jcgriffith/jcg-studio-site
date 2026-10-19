// Cross-document View Transitions, home ↔ /work.
// CSS opts in with @view-transition { navigation: auto } and names the shared
// element `floor` (the home preview window ↔ the /work canvas). This module
// only makes the morph honest: if the preview window is off-screen on the home
// side, it drops the name so the page crossfades instead of flying a ghost in.
// Browsers without cross-document support just navigate.

function inViewport(el) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
}

export function initTransitions() {
  const floor = document.querySelector('[data-vt-floor]');
  if (!floor) return;

  window.addEventListener('pageswap', (e) => {
    if (!e.viewTransition) return;
    if (!inViewport(floor)) floor.style.viewTransitionName = 'none';
  });

  window.addEventListener('pagereveal', (e) => {
    if (!e.viewTransition) return;
    if (!inViewport(floor)) floor.style.viewTransitionName = 'none';
    e.viewTransition.finished.finally(() => { floor.style.viewTransitionName = ''; });
  });

  // bfcache restore: make sure the name comes back for the next navigation.
  window.addEventListener('pageshow', () => { floor.style.viewTransitionName = ''; });
}
