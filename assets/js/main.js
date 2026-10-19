// Home boot: global behaviors, one effect per section, lazy studio-floor preview.
import { initHudSnap } from './hud-snap.js';
import { initSplitFlap } from './splitflap.js';
import { initQueue } from './queue.js';
import { initConfirm } from './confirm.js';
import { initPipe, initSeparator } from './pipe.js';
import { initAscii } from './ascii.js';
import { initScanline } from './scanline.js';
import { initTransitions } from './transitions.js';
import { initInfiniteFaq } from './infinite-faq.js';
import { initTypeChoreo } from './type-choreo.js';
import { reduced } from './reduce-motion.js';

// Baseline reveal (not a section effect): fade + 10px rise, once.
function initReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((el) => io.observe(el));
}

// The preview window loads the engine + data only when #work approaches.
function initPreview() {
  const win = document.querySelector('[data-vt-floor]');
  const root = win?.querySelector('[data-floor]');
  if (!root) return;
  const boot = async () => {
    try {
      // Same loader as /work, so media paths resolve from this page too.
      const { createFloor, loadConcepts } = await import('./canvas.js');
      const data = await loadConcepts('../assets/data/concepts.json');
      root.replaceChildren();
      createFloor(root, data, {
        mode: 'preview',
        focus: 'sc-01',
        scale: 0.6,
        home: './',
        work: '../',
        explore: win.querySelector('[data-explore]'),
        keyScope: win,
        insets: { t: 48, r: 16, b: 56, l: 16 },
      });
    } catch (err) {
      win.classList.add('is-failed');
      console.warn('[jcg] studio floor preview unavailable:', err);
    }
  };
  if (!('IntersectionObserver' in window)) { boot(); return; }
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); boot(); } }, { rootMargin: '600px 0px' });
  io.observe(win);
}

// Heavier dream-pass pieces (X feed) load as they approach.
function lazy(el, load) {
  if (!el) return;
  const run = () => load().catch((err) => console.warn('[jcg] lazy module failed:', err));
  if (!('IntersectionObserver' in window)) { run(); return; }
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); run(); } }, { rootMargin: '500px 0px' });
  io.observe(el);
}

initHudSnap();
initSplitFlap();
initReveal();
initQueue(document.getElementById('queue'));
initPipe(document.querySelector('[data-pipe]'));
initSeparator(document.querySelector('[data-sep]'));
initAscii();
initScanline();
initConfirm();
initPreview();
initTransitions();
initTypeChoreo();
initInfiniteFaq(document.getElementById('faq'));
lazy(document.getElementById('x-strip'), () => import('./x-strip.js').then((m) => m.initXStrip(document.getElementById('x-strip'))));

const yr = document.getElementById('yr');
if (yr) yr.textContent = new Date().getFullYear();
