// Pressing things (play layer, JC, 2026-10-05): the keycap press and the bracket fuse. Styles in assets/css/play.css.
//   keycaps(root)  A pressed button sits one pixel down, like a key, for as long as it is held: by mouse, finger or
//                  pen, not only while :active (iOS Safari never shows :active without a touch listener).
//   fuse(el, opts) Hold to confirm. Corner brackets close in from 14 px to 5 px while the button's lamp fills with the
//                  signal; let go early and they spring back open (a quick tap also says "Hold"). When the fuse burns
//                  through, the phone taps once (navigator.vibrate, where there is one) and onConfirm runs. A keyboard
//                  or screen-reader click (Enter, Space) commits at once: those are never accidental, and a hold would
//                  shut them out. Modified clicks (new tab, new window) pass straight through to the link.
//                  opts: { ms (default data-fuse or 700), onConfirm, active: () => bool (the fuse only arms while true),
//                  hint (the word a quick tap shows, default "Hold") }.
// Reduced motion: the brackets sit closed while you hold and the lamp fills in three steps; nothing springs.
import { reduced } from './reduce-motion.js';
import { easeSnap } from './jcg-hud.js';

const KEYS = '.btn, .hud-btn, .hud-subscribe, .site-menu-btn, .toast-action, .notice-action, .seg, .stepper-btn, .affix-btn, .play-menu-btn';
export function keycaps(root = document) {
  let held = null;
  const up = () => { held?.classList.remove('is-pressed'); held = null; };
  root.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const key = e.target.closest?.(KEYS);
    if (!key || key.matches(':disabled, [aria-disabled="true"]')) return;
    up(); held = key; key.classList.add('is-pressed');
  }, true);
  ['pointerup', 'pointercancel', 'dragstart'].forEach((t) => root.addEventListener(t, up, true));
  root.addEventListener('pointerout', (e) => { if (held && e.target === held && !held.contains(e.relatedTarget)) up(); }, true);
}

const SPRING = 520, TAP = 280;
export function fuse(el, { ms = +el.dataset.fuse || 700, onConfirm = () => {}, active = () => true, hint = 'Hold' } = {}) {
  if (el._fuse) return el._fuse;
  if (!el.querySelector(':scope > .lamp')) el.insertAdjacentHTML('afterbegin', '<span class="lamp" aria-hidden="true"></span>');
  el.insertAdjacentHTML('beforeend', '<i class="fuse-ticks ticks" aria-hidden="true"></i><span class="chip fuse-hint" aria-hidden="true"></span>');
  el.dataset.fuse = ms;
  const tip = el.querySelector(':scope > .fuse-hint');
  let raf = 0, t0 = 0, p = 0, from = 0, hold = null, done = false, tipTimer = 0;
  const set = (v) => el.style.setProperty('--fuse', v.toFixed(3));
  const loop = (fn) => { cancelAnimationFrame(raf); const step = (now) => { if (fn(now) !== false) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); };

  function start(e) {
    if (hold || done || !active()) return;
    hold = { id: e.pointerId, t: e.timeStamp };
    t0 = performance.now();
    el.classList.remove('is-sprung');
    el.classList.add('is-holding');
    loop((now) => {
      p = Math.min(1, (now - t0) / ms);
      set(reduced() ? Math.floor(p * 3) / 3 : p);
      if (p < 1) return true;
      commit();
      return false;
    });
  }
  function commit() {
    hold = null; done = true;
    el.classList.remove('is-holding');
    el.classList.add('is-fused');
    set(1);
    try { navigator.vibrate?.(12); } catch (_) { /* no haptics */ }
    onConfirm();
    setTimeout(reset, 900);
  }
  function reset() { done = false; el.classList.remove('is-fused'); spring(); }
  function spring() {                                     // the brackets fly back open on the HUD overshoot
    from = p; p = 0;
    el.classList.remove('is-holding');
    if (reduced() || from === 0) { set(0); el.classList.remove('is-sprung'); return; }
    el.classList.add('is-sprung');
    const s0 = performance.now();
    loop((now) => {
      const t = Math.min(1, (now - s0) / SPRING);
      set(from * (1 - easeSnap(t)));
      if (t < 1) return true;
      el.classList.remove('is-sprung');
      return false;
    });
  }
  function cancel(e, tapped) {
    if (!hold || (e && e.pointerId !== hold.id)) return;
    const quick = tapped && e.timeStamp - hold.t < TAP;
    hold = null;
    cancelAnimationFrame(raf);
    spring();
    if (quick) say(hint);
  }
  function say(word) {
    tip.textContent = word;
    tip.classList.remove('is-on'); void tip.offsetWidth; tip.classList.add('is-on');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => tip.classList.remove('is-on'), 1400);
  }

  const modified = (e) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0;
  el.addEventListener('pointerdown', (e) => { if (!modified(e) && e.isPrimary) start(e); });
  el.addEventListener('pointerup', (e) => cancel(e, true));
  el.addEventListener('pointercancel', (e) => cancel(e, false));
  el.addEventListener('pointerleave', (e) => cancel(e, false));
  el.addEventListener('contextmenu', (e) => { if (hold || done) e.preventDefault(); });   // a long press is not a context menu
  el.addEventListener('click', (e) => {
    if (modified(e)) return;                              // new tab or window: the link does its own thing
    const swallow = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (done) { swallow(); return; }                      // the click that follows a hold that burned through
    if (!active()) return;                                // not armed: the button's own click runs
    swallow();
    if (e.detail === 0) { done = true; set(1); el.classList.add('is-fused'); onConfirm(); setTimeout(reset, 900); }   // keys and assistive tech
  }, true);
  window.addEventListener('pageshow', (e) => { if (e.persisted) { done = false; hold = null; el.classList.remove('is-holding', 'is-fused', 'is-sprung'); set(0); } });
  return (el._fuse = { say, cancel: () => cancel({ pointerId: hold?.id, timeStamp: 0 }, false) });
}
