// Full-screen media viewer for a piece's card (desktop / iPad) and bottom sheet (phone). Lightbox pass 2026-10-27.
//   openLightbox({ items, index, title, opener, phone, onClose })   items: [{ type: 'image'|'video', thumb, full, poster, w, h }]
//   reelStep(button) / reelIndex(track) / reelGo(track, i)          the card's own carousel (one big slide at a time)
// Plain DOM, no libraries. The viewer is a native scroll-snap row (swipe = the browser's own scrolling), loads only the
// slide on show (plus a cheap thumb for its neighbours; phones never prefetch the next full-size one), and gives the
// page back exactly as it found it on close.
const mq = (q) => window.matchMedia(q).matches;
const reduced = () => mq('(prefers-reduced-motion: reduce)');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* The largest file we have: x-800.webp has x.webp (the original) beside it. A video is its own best file. */
export function fullOf(src) {
  const m = /^(.*)-(\d{3,4})\.webp(\?.*)?$/i.exec(src || '');
  return m ? `${m[1]}.webp${m[3] || ''}` : src;
}

/* ── The card's carousel ─────────────────────────────────────────────────────────────────────────────────────── */
const trackGap = (t) => parseFloat(getComputedStyle(t).columnGap) || 0;
export const reelIndex = (t) => {
  const n = t.children.length, step = t.clientWidth + trackGap(t);
  return n && step ? Math.max(0, Math.min(n - 1, Math.round(t.scrollLeft / step))) : 0;
};
export function reelGo(t, i, smooth = !reduced()) {
  const n = t.children.length;
  if (!n) return;
  const to = ((i % n) + n) % n;
  t.scrollTo({ left: to * (t.clientWidth + trackGap(t)), behavior: smooth && Math.abs(to - reelIndex(t)) <= 1 ? 'smooth' : 'auto' });
}
export function reelStep(button) {
  const t = button.closest('.piece-reel')?.querySelector('.piece-reel-track');
  if (t) reelGo(t, reelIndex(t) + Number(button.dataset.reel));
}
/* keeps each card's "n / total" honest while its row scrolls (scroll doesn't bubble, so listen in capture) */
export function wireReel(host) {
  host.addEventListener('scroll', (e) => {
    const t = e.target;
    if (!t.classList?.contains('piece-reel-track')) return;
    const c = t.closest('.piece-reel')?.querySelector('[data-reel-count]');
    if (c) c.textContent = `${reelIndex(t) + 1} / ${t.children.length}`;
  }, { capture: true, passive: true });
}

/* ── The viewer ──────────────────────────────────────────────────────────────────────────────────────────────── */
let V = null;         // the one viewer element set (built on first open)
let S = null;         // state while open

function build() {
  const root = document.createElement('div');
  root.className = 'lb';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-roledescription', 'media viewer');
  root.innerHTML = `
    <div class="lb-top">
      <span class="lb-count" data-lb-count aria-live="polite"></span>
      <button type="button" class="lb-x" data-lb-close aria-label="Close viewer">×</button>
    </div>
    <div class="lb-track" data-lb-track></div>
    <button type="button" class="lb-arrow lb-prev" data-lb-go="-1" aria-label="Previous">←</button>
    <button type="button" class="lb-arrow lb-next" data-lb-go="1" aria-label="Next">→</button>`;
  document.body.append(root);
  V = {
    root, track: root.querySelector('[data-lb-track]'), count: root.querySelector('[data-lb-count]'),
    x: root.querySelector('[data-lb-close]'), arrows: [...root.querySelectorAll('.lb-arrow')],
  };
  root.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target.closest('[data-lb-close]')) { close(); return; }
    const g = e.target.closest('[data-lb-go]');
    if (g) { go(cur() + Number(g.dataset.lbGo)); return; }
    if (e.target.classList.contains('lb-slide')) close();   // the dark margin round the media
  });
  // nothing the viewer sees may reach the floor underneath (drag, wheel, pinch)
  for (const t of ['pointerdown', 'pointerup', 'touchstart', 'wheel', 'dblclick']) root.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
  V.track.addEventListener('scroll', onScroll, { passive: true });
}

const cur = () => (V && V.track.clientWidth ? Math.max(0, Math.min(S.items.length - 1, Math.round(V.track.scrollLeft / V.track.clientWidth))) : 0);

function slideHtml(it, i, n, title) {
  const label = `${title}, ${it.type === 'video' ? 'video' : 'image'} ${i + 1} of ${n}`;
  const media = it.type === 'video'
    ? `<video class="lb-media" controls playsinline muted preload="none"${it.poster ? ` poster="${esc(it.poster)}"` : ''} aria-label="${esc(label)}"></video>`
    : `<img class="lb-media" alt="${esc(label)}" decoding="async" draggable="false">`;
  return `<div class="lb-slide" data-i="${i}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}">${media}</div>`;
}

/* load what the slide needs, and only that: its thumb (already cached from the card), then its largest file */
function ensure(i) {
  const n = S.items.length;
  for (const k of [i - 1, i, i + 1]) {
    if (k < 0 || k >= n) continue;
    const it = S.items[k], el = V.track.children[k]?.querySelector('.lb-media');
    if (!el || it.type === 'video') continue;
    if (!el.getAttribute('src')) el.src = it.thumb;
    if (k === i && !el.dataset.full) {
      el.dataset.full = '1';
      if (!it.full || it.full === it.thumb) continue;
      const big = new Image();
      big.decoding = 'async';
      big.onload = () => { if (S && V.track.contains(el)) el.src = it.full; if (!S?.phone) prefetch(i); };
      big.onerror = () => {};
      big.src = it.full;
    }
  }
  const it = S.items[i], v = V.track.children[i]?.querySelector('video');
  if (v && it.type === 'video' && !v.getAttribute('src')) { v.preload = S.phone ? 'none' : 'metadata'; v.src = it.src || it.full; }
}
function prefetch(i) {   // desktop / tablet only: the next and previous full-size, once this one has landed
  for (const k of [i + 1, i - 1]) { const it = S.items[k]; if (it && it.type !== 'video' && it.full) { const im = new Image(); im.decoding = 'async'; im.src = it.full; } }
}

function settle() {
  if (!S) return;
  const i = cur();
  V.count.textContent = `${i + 1} / ${S.items.length}`;
  S.i = i;
  ensure(i);
  [...V.track.children].forEach((s, k) => {
    const v = s.querySelector('video');
    if (!v) return;
    if (k !== i) v.pause();
    else if (!S.phone && !reduced()) { v.muted = true; v.play()?.catch(() => {}); }   // phones never autoplay
  });
}
let t0 = 0;
function onScroll() {
  if (!S) return;
  V.count.textContent = `${cur() + 1} / ${S.items.length}`;
  clearTimeout(t0);
  t0 = setTimeout(settle, 90);
}
function go(i) {
  const n = S.items.length;
  if (n < 2) return;
  const to = ((i % n) + n) % n, from = cur();
  V.track.scrollTo({ left: to * V.track.clientWidth, behavior: reduced() || Math.abs(to - from) > 1 ? 'auto' : 'smooth' });
}

function focusables() {
  return [...V.root.querySelectorAll('button, video[controls]')].filter((el) => !el.hidden && el.offsetParent !== null);
}
function onKey(e) {
  if (!S) return;
  const k = e.key;
  e.stopPropagation();   // the card, the floor and the menu never hear a key while the viewer is up
  if (k === 'Escape') { e.preventDefault(); close(); }
  else if (k === 'ArrowRight') { e.preventDefault(); go(cur() + 1); }
  else if (k === 'ArrowLeft') { e.preventDefault(); go(cur() - 1); }
  else if (k === 'Home') { e.preventDefault(); go(0); }
  else if (k === 'End') { e.preventDefault(); go(S.items.length - 1); }
  else if (k === 'Tab') {
    const f = focusables();
    if (!f.length) return;
    const at = f.indexOf(document.activeElement);
    const next = e.shiftKey ? (at <= 0 ? f.length - 1 : at - 1) : (at < 0 || at === f.length - 1 ? 0 : at + 1);
    e.preventDefault();
    f[next].focus({ preventScroll: true });
  }
}
const onResize = () => { if (S) V.track.scrollTo({ left: S.i * V.track.clientWidth, behavior: 'auto' }); };
const onNav = () => close();

export const lightboxOpen = () => !!S;

export function openLightbox({ items, index = 0, title = '', opener = null, phone = false, onClose = null }) {
  if (S || !items?.length) return;
  if (!V) build();
  const n = items.length, i0 = Math.max(0, Math.min(n - 1, index));
  S = { items, i: i0, title, opener, phone, onClose, saved: document.activeElement };
  V.root.setAttribute('aria-label', `${title}: ${n} ${n === 1 ? 'item' : 'items'}`);
  V.track.innerHTML = items.map((it, i) => slideHtml(it, i, n, title)).join('');
  V.arrows.forEach((a) => { a.hidden = n < 2; });
  V.root.hidden = false;
  document.documentElement.classList.add('lb-open');      // scroll lock (CSS): the page behind never moves
  V.track.scrollTo({ left: i0 * V.track.clientWidth, behavior: 'auto' });
  settle();
  V.x.focus({ preventScroll: true });
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onResize);
  window.addEventListener('hashchange', onNav);
  window.addEventListener('popstate', onNav);
}

export function close() {
  if (!S) return;
  const { opener, onClose, i, saved } = S;
  clearTimeout(t0);
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('hashchange', onNav);
  window.removeEventListener('popstate', onNav);
  V.track.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });   // stop any download
  V.root.hidden = true;
  V.track.innerHTML = '';
  document.documentElement.classList.remove('lb-open');
  S = null;
  try { onClose?.(i); } catch (_) { /* the card is the caller's */ }
  const back = opener && document.contains(opener) ? opener : saved;
  back?.focus?.({ preventScroll: true });
}
