// Feedback (assets/css/feedback.css): the parts that need script.
//   toast({ title, text, state, label, action, life, root }): a message that drops in under the top HUD row and leaves
//     on its own: 4 s, 6 s with an action, never for an error. Hovering or focusing it pauses the time; the fuse along
//     its bottom is the timer. state and label make its status line (queued, active, review, done, paused, error,
//     note). action is { label, onClick }. Three at most; the oldest goes. Returns { el, dismiss }.
//   busy(el, on): marks a button or a region busy (aria-busy; a button also turns aria-disabled). The button's lamp
//     blinks (feedback.css) and, on a site page, the nav mark buds as the loader.
//   initFeedback(root): .mark-loader buds while it is on screen (still with reduced motion); [data-dismiss] closes
//     the notice it sits in; .empty-art[data-art="seed"|"mark"] gets its drawing.
// Toasts are announced politely from one live region per root; an error toast is role="alert".
import { reduced } from './reduce-motion.js';
import { markD, FINAL_D, FPS } from './jcg-bud.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LIFE = 4000, LIFE_ACTION = 6000, MAX = 3;

// ── Toast ─────────────────────────────────────────────────────────────
function regionIn(root) {
  const host = root === document ? document.body : root.querySelector('.live-root') || root;
  let region = host.querySelector(':scope > .toasts');
  if (region) return [region, false];
  region = document.createElement('div');
  region.className = 'toasts';
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-relevant', 'additions');
  host.append(region);
  return [region, true];
}

export function toast({ title = '', text = '', state = '', label = '', action = null, life, root = document } = {}) {
  const [region, fresh] = regionIn(root);
  const el = document.createElement('div');
  el.className = 'toast ticks';
  if (state === 'error') { el.dataset.tone = 'error'; el.setAttribute('role', 'alert'); }
  const ms = life ?? (state === 'error' ? 0 : action ? LIFE_ACTION : LIFE);
  el.innerHTML =
    (label ? `<span class="status"${state ? ` data-state="${esc(state)}"` : ''}>${esc(label)}</span>` : '') +
    `<p class="toast-text">${title ? `<b>${esc(title)}</b> ` : ''}${esc(text)}</p>` +
    (action ? `<div class="toast-actions"><button class="toast-action" type="button">${esc(action.label)}</button></div>` : '') +
    '<button class="toast-close" type="button" aria-label="Dismiss"></button>' +
    (ms ? `<i class="toast-fuse" aria-hidden="true" style="--life:${ms}ms"></i>` : '');

  let gone = false, timer = 0, left = ms, started = 0, held = false;
  // Dismissed by hand (play layer), the toast breaks into grid cells that fold back into one block, the seed the mark
  // grows from; timed out or pushed out, it just goes.
  const dismiss = (byHand = false) => {
    if (gone) return;
    gone = true;
    clearTimeout(timer);
    if (byHand === true && !reduced()) {
      const COLS = 8, ROWS = 3, sc = 0, sr = 1;                        // the seed: the left cell of the middle row
      const cells = document.createElement('span');
      cells.className = 'toast-cells';
      cells.setAttribute('aria-hidden', 'true');
      cells.innerHTML = Array.from({ length: COLS * ROWS }, (_, i) => {
        const c = i % COLS, r = Math.floor(i / COLS), seed = c === sc && r === sr;
        return `<i${seed ? ' class="is-seed"' : ''} style="--d:${Math.round(Math.hypot(c - sc, r - sr) * 26)}"></i>`;
      }).join('');
      el.append(cells);
      el.classList.add('is-breaking');
      setTimeout(() => el.remove(), 560);
      return;
    }
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), reduced() ? 0 : 180);
  };
  el._dismiss = dismiss;
  el.querySelector('.toast-close').addEventListener('click', () => dismiss(true));
  if (action) el.querySelector('.toast-action').addEventListener('click', () => { action.onClick?.(); dismiss(true); });

  if (ms && reduced()) {
    // No fuse with reduced motion: a plain timer that holds while the toast is hovered or has focus.
    const run = () => { if (gone) return; held = false; started = performance.now(); timer = setTimeout(dismiss, Math.max(600, left)); };
    const hold = () => { if (held || gone) return; held = true; clearTimeout(timer); left -= performance.now() - started; };
    el.addEventListener('pointerenter', hold);
    el.addEventListener('pointerleave', () => { if (!el.matches(':focus-within')) run(); });
    el.addEventListener('focusin', hold);
    el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget) && !el.matches(':hover')) run(); });
    run();
  } else if (ms) {
    el.querySelector('.toast-fuse').addEventListener('animationend', dismiss);   // CSS pauses it on hover and focus
  }

  const show = () => {
    region.prepend(el);
    [...region.children].slice(MAX).forEach((old) => old._dismiss?.());
    requestAnimationFrame(() => el.classList.add('is-in'));
  };
  if (fresh) setTimeout(show, 100); else show();   // a new live region needs a moment before screen readers watch it
  return { el, dismiss };
}

// ── Busy ──────────────────────────────────────────────────────────────
export function busy(el, on = true) {
  if (on) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy');
  if (el.matches('button, .btn')) { if (on) el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled'); }
}

// ── Mark loader ───────────────────────────────────────────────────────
// The Motion tab's loader loop: one block buds out to the logo, holds, buds back, holds. 128 frames at 60 fps.
const LOOP = 128;
const loopFrame = (f) => { const c = f % LOOP; return c < 52 ? 8 + c : c < 64 ? 60 : c < 116 ? 60 - (c - 64) : 8; };
function initLoader(el) {
  if (!el.querySelector('svg')) el.innerHTML = '<svg viewBox="0 0 450 180" aria-hidden="true" focusable="false"><path/></svg>';
  const path = el.querySelector('path');
  if (!el.hasAttribute('role')) el.setAttribute('role', 'img');
  if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Loading');
  if (reduced()) { path.setAttribute('d', FINAL_D); return; }
  path.setAttribute('d', markD(8));
  let raf = 0, t0 = 0;
  const tick = (now) => {
    if (!t0) t0 = now;
    path.setAttribute('d', markD(loopFrame(((now - t0) / 1000) * FPS)));
    raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !raf) { t0 = 0; raf = requestAnimationFrame(tick); }
    else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(el);
}

// ── Notice ────────────────────────────────────────────────────────────
function initDismiss(btn) {
  const notice = btn.closest('.notice');
  if (!notice) return;
  btn.addEventListener('click', () => {
    notice.classList.add('is-leaving');
    setTimeout(() => {
      notice.hidden = true;
      notice.classList.remove('is-leaving');
      notice.dispatchEvent(new CustomEvent('feedback:dismissed', { bubbles: true }));
    }, reduced() ? 0 : 180);
  });
}

// ── Empty-state art: the budding's first block, or the whole mark ─────
const SEED = '<svg viewBox="133.75 58.75 62.5 62.5" aria-hidden="true" focusable="false"><path d="' + markD(8) + '"/></svg>';
const MARK = '<svg viewBox="0 0 450 180" aria-hidden="true" focusable="false"><path d="' + FINAL_D + '"/></svg>';

export function initFeedback(root = document) {
  const each = (sel, fn) => root.querySelectorAll(sel).forEach((el) => { if (el._fb) return; el._fb = true; fn(el); });
  each('.mark-loader', initLoader);
  each('[data-dismiss]', initDismiss);
  each('.empty-art[data-art]', (el) => { el.innerHTML = el.dataset.art === 'mark' ? MARK : SEED; });
}
