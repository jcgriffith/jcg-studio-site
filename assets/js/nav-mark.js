// Nav mark motion: budding, the logo's build (brand/motion.html; geometry in jcg-bud.js).
//   First visit: on a visit's first page load the nav mark buds in from one block, then the cursor types STUDIO.
//   Hover / tap: the mark buds back into one block and out again: on hover with a mouse, or when the
//                mark's link points at the page you are on (it then scrolls to the top instead of reloading).
//   Loader:      while anything is busy (aria-busy="true"), the mark loops between one block and the full
//                logo; when the work finishes it completes the build.
// prefers-reduced-motion: the mark stays still.
// Progress bar (play layer, JC, 2026-10-05): the nav mark also counts the nine blocks found on this device
// (play-store.js). Before any find it is the whole logo: most visitors never play, and the mark is the brand. From the
// first find it shows one more piece per find in full ink over a faint ghost of the whole logo, and at nine the whole
// logo returns with the full bud. Everything above plays on whatever the mark is at the time. The footer marks stay whole.
import { markD, partialD, FINAL_D, PIECES, MARK_END, FPS } from './jcg-bud.js';
import { count, TOTAL } from './play-store.js';

const NAV_MARKS = '.hud-brand .brand-pixel svg, .site-header .brand-pixel svg, .nav .brand-pixel svg';
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const svgs = [...document.querySelectorAll(NAV_MARKS)];
const paths = svgs.map((svg) => svg.querySelector('path')).filter(Boolean);
const draw = (d) => paths.forEach((p) => p.setAttribute('d', d));
const SETTLE = 20; // frames for the springs to come to rest after a move

// ── Progress: how much of the mark the nav shows at rest ────────────────
const piecesFor = () => PIECES;   // 2026-10-08: always the whole logo, all white (JC: "Just make the whole logo white please"); finds no longer build it
let shown = piecesFor(count());
const whole = () => shown >= PIECES;
// The ghost: the whole logo, faint, behind a mark that is still being collected (mark-pixel.css .mark-ghost).
const ghosts = paths.map((p) => {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  g.setAttribute('class', 'mark-ghost');
  g.setAttribute('d', FINAL_D);
  p.before(g);
  return g;
});
const showGhost = () => ghosts.forEach((g) => { g.style.display = whole() ? 'none' : ''; });
showGhost();
const rest = () => (whole() ? FINAL_D : partialD(shown));
const at = (g) => (whole() ? markD(g) : partialD(shown, g));      // the mark at frame g of its build

// ── One clock: only one thing moves the mark at a time ─────────────────
let anim = null;
let raf = 0;
let lastEnd = 0;
function run(name, fn, dur, done, d = at) {
  anim = { name, fn, d, dur, done, start: performance.now() };
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick(now) {
  raf = 0;
  if (!anim) return;
  const f = ((now - anim.start) / 1000) * FPS;
  if (f >= anim.dur) {
    const a = anim;
    anim = null;
    draw(rest());
    lastEnd = now;
    a.done?.();
    if (a.name !== 'loader') sync();
    return;
  }
  draw(anim.d(anim.fn(f)));
  raf = requestAnimationFrame(tick);
}
const markNow = () => (anim ? anim.fn(((performance.now() - anim.start) / 1000) * FPS) : MARK_END);

// ── First visit ─────────────────────────────────────────────────────────
// The page's head script adds html.mark-intro on a visit's first load; CSS keeps the mark and
// STUDIO hidden until this runs (mark-pixel.css has a 1.5 s failsafe).
try { sessionStorage.setItem('jcg-intro', '1'); } catch (e) { /* storage blocked: the intro may replay */ }

// After the bud, the orange one-letter cursor types STUDIO at four frames a letter, then blinks off. The letters are
// SVG groups inside .brand-word (strokes at 12 px capitals: too small to draw on), so each appears whole; they keep
// their space while hidden, so the panel never resizes. The cursor is one letter cell (12 x 12 px), the pitch of the type.
const words = svgs.map((svg) => svg.closest('.brand')?.querySelector('.brand-word')).filter(Boolean);
const lettersOf = (w) => [...w.querySelectorAll('svg > g')];
function hideLetters() {
  for (const w of words) for (const g of lettersOf(w)) g.style.visibility = 'hidden';
}
function typeLetters(finish) {
  const BEAT = 4;
  const sets = words.map((w) => {
    const letters = lettersOf(w);
    const box = w.querySelector('svg').getBoundingClientRect(), wbox = w.getBoundingClientRect();
    const unit = box.height / 8;                                         // px per grid unit: capitals are 8 units tall
    const cursor = document.createElement('span');
    cursor.className = 'brand-cursor';
    cursor.style.width = cursor.style.height = 8 * unit + 'px';          // one cell: the letter pitch by the cap height
    cursor.style.top = box.top - wbox.top + 'px';
    w.style.position = 'relative';
    w.append(cursor);
    return { letters, cursor, unit, x0: box.left - wbox.left };
  });
  const total = (sets[0]?.letters.length ?? 0) * BEAT;
  const start = performance.now();
  const step = (now) => {
    const f = ((now - start) / 1000) * FPS, k = f - total;
    for (const { letters, cursor, unit, x0 } of sets) {
      const n = Math.min(letters.length, Math.floor(f / BEAT));
      letters.forEach((g, i) => { g.style.visibility = i < n ? '' : 'hidden'; });
      cursor.style.left = x0 + (8 * n - 1.5) * unit + 'px';             // the cell the next letter will fill (ink sits 1.5 units in)
      cursor.style.visibility = f < total || k < 12 || (k >= 24 && k < 36) ? '' : 'hidden';   // types, then on, off, on, off
    }
    if (f < total + 36) requestAnimationFrame(step);
    else { sets.forEach(({ cursor }) => cursor.remove()); finish(); }
  };
  requestAnimationFrame(step);
}

// The static path in the page is the whole logo (for no-JS); with JS the progress mark replaces it before it shows
// (mark-pixel.css hides the nav path until html.mark-ready, with the same 1.5 s failsafe).
if (!root.classList.contains('mark-intro') || reduce.matches) draw(rest());
root.classList.add('mark-ready');

// A short build when the mark is still a few pieces: it ends as the newest piece settles, not at the full bud's length.
const introLength = () => (whole() ? MARK_END + SETTLE : [0, 8, 10, 16, 18, 24, 26, 28, 30, 38][shown - 1] + 30);
export const introDone = new Promise((resolve) => {
  if (!root.classList.contains('mark-intro') || !paths.length) return resolve();
  if (reduce.matches) { root.classList.remove('mark-intro'); return resolve(); }
  paths.forEach((p) => { p.setAttribute('d', ''); p.style.opacity = '1'; });
  hideLetters();
  run('intro', (f) => f, introLength(), () => {
    root.classList.remove('mark-intro');
    paths.forEach((p) => p.style.removeProperty('opacity'));
    if (words.length) typeLetters(resolve); else resolve();
  });
});

// ── A find: the newest piece buds out of the mark; the ninth plays the full bud ──
// The newest piece grows in place while the others hold still. At nine the mark folds back into one block and buds out
// whole, the same build as the first visit. Reduced motion: the new mark, still.
const FOLD = 52;
export function grow(n) {
  const next = piecesFor(n);
  if (next === shown) return;
  shown = next;
  showGhost();
  if (!paths.length) return;
  if (reduce.matches) { if (!anim || anim.name === 'loader') draw(rest()); return; }
  const fold = (f) => partialD(PIECES - 1, MARK_END - f);
  if (whole()) run('complete', (f) => f, FOLD + 8 + MARK_END + SETTLE, null, (f) => (f < FOLD ? fold(f) : markD(8 + f - FOLD)));
  else run('find', (f) => f, 40, null, (f) => partialD(shown, undefined, f));
}

// ── Hover / tap: bud back into one block and out again ─────────────────
const REBUD = 112;
const rebudFn = (f) => (f <= 52 ? MARK_END - f : f <= 60 ? 8 : 8 + (f - 60));
function rebud() {
  if (anim || reduce.matches || performance.now() - lastEnd < 800) return;   // never interrupt the intro or the loader
  run('rebud', rebudFn, REBUD + SETTLE);
}
const pageOf = (url) => url.pathname.replace(/index\.html$/, '');
for (const svg of svgs) {
  const link = svg.closest('a');
  if (!link) continue;
  if (finePointer.matches) link.addEventListener('pointerenter', rebud);
  link.addEventListener('click', (event) => {
    const url = new URL(link.href, location.href);
    if (pageOf(url) !== pageOf(location) || (url.hash && url.hash !== '#top')) return;   // a real navigation
    event.preventDefault();
    rebud();
    window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
  });
}

// ── Loader: loop between one block and the full logo while anything is busy ──
// Starts only if the wait outlasts WAIT_MS (no flicker); never interrupts the intro or a re-bud.
const LOOP = 128;
const WAIT_MS = 150;
const loopFn = (f) => { const c = f % LOOP; return c < 52 ? MARK_END - c : c < 64 ? 8 : c < 116 ? 8 + (c - 64) : MARK_END; };
let waiting = null;
const busy = () => !!document.querySelector('[aria-busy="true"]');

function sync() {
  if (!paths.length) return;
  if (busy()) {
    if (reduce.matches || waiting || anim) return;
    waiting = setTimeout(() => {
      waiting = null;
      if (busy() && !anim) run('loader', loopFn, Infinity);
    }, WAIT_MS);
  } else {
    clearTimeout(waiting);
    waiting = null;
    if (anim?.name === 'loader') {                         // finish the build from wherever the loop is
      const m = Math.min(MARK_END, markNow());
      run('finish', (f) => m + f, MARK_END - m + SETTLE);
    }
  }
}

introDone.then(() => {
  new MutationObserver(sync).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-busy'] });
  sync();
});
