// Fullscreen site menu — Micasso expand echo (hairline → sheet clip → staggered links).
// Portals the panel to a body-level layer so it escapes fixed HUD stacking contexts.
// Escape (capture, before canvas drawer), backdrop click, focus trap, close-on-navigate.
// No-JS: native <details> dropdown in base.css still works.

import './nav-mark.js';
import './play.js';                                    // the play layer: blocks, the menu's Play section, keycaps, the field
import { initSplitFlap } from './splitflap.js';

// The nav's Subscribe flaps on every page, not just where a page script inits it.
const hudActions = document.querySelector('.hud-actions');
if (hudActions) initSplitFlap(hudActions);

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const menus = [...document.querySelectorAll('.site-menu')];

const CLOSE_MS = () => (reduce.matches ? 40 : 280);

function focusables(root) {
  return [...root.querySelectorAll('a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
}

function syncBtn(menu, open) {
  const btn = menu.querySelector('.site-menu-btn');
  if (!btn) return;
  const isOpen = open ?? (menu.open || document.documentElement.classList.contains('menu-open'));
  btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  btn.setAttribute('aria-label', isOpen ? 'Close menu' : 'Menu');
}

function buildLayer(menu) {
  const panel = menu.querySelector('.site-menu-panel');
  if (!panel) return null;

  const layer = document.createElement('div');
  layer.className = 'site-menu-layer';
  layer.id = panel.id || 'site-menu-panel';
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', 'Primary');
  layer.hidden = true;

  const rule = document.createElement('span');
  rule.className = 'site-menu-rule';
  rule.setAttribute('aria-hidden', 'true');

  const sheet = document.createElement('div');
  sheet.className = 'site-menu-sheet ticks';

  // Move panel into the sheet (details summary stays in chrome).
  panel.removeAttribute('id');
  sheet.appendChild(panel);
  layer.append(rule, sheet);
  document.body.appendChild(layer);

  let i = 0;
  panel.querySelectorAll(':scope > a, .site-menu-actions > a').forEach((a) => {
    a.style.setProperty('--i', String(i++));
  });

  const btn = menu.querySelector('.site-menu-btn');
  if (btn) btn.setAttribute('aria-controls', layer.id);

  return { menu, panel, layer, sheet, btn, closing: false, lastFocus: null };
}

function setPageInert(on) {
  for (const el of document.body.children) {
    if (el.classList.contains('site-menu-layer')) continue;
    if (el.matches('script, style, link')) continue;
    // Keep logo + hamburger chrome interactive for close.
    if (el.matches('header.hud-brand, header.nav, .hud-actions')) continue;
    if (on) {
      if (!el.hasAttribute('data-menu-inert')) {
        el.setAttribute('data-menu-inert', el.inert ? '1' : '0');
        el.inert = true;
      }
    } else if (el.hasAttribute('data-menu-inert')) {
      el.inert = el.getAttribute('data-menu-inert') === '1';
      el.removeAttribute('data-menu-inert');
    }
  }
}

const states = menus.map(buildLayer).filter(Boolean);

function finishClose(state) {
  state.closing = false;
  state.layer.classList.remove('is-open', 'is-closing');
  state.layer.hidden = true;
  document.documentElement.classList.remove('menu-open');
  setPageInert(false);
  // Clearing open fires `toggle`; guard via closing/is-open checks below.
  if (state.menu.open) state.menu.open = false;
  syncBtn(state.menu, false);
  const restore = state.lastFocus || state.btn;
  if (restore && typeof restore.focus === 'function') {
    try { restore.focus({ preventScroll: true }); } catch { restore.focus(); }
  }
  state.lastFocus = null;
}

function openMenu(state) {
  if (state.closing) {
    state.layer.classList.remove('is-closing');
    state.closing = false;
  }
  for (const other of states) {
    if (other !== state && (other.layer.classList.contains('is-open') || other.menu.open)) {
      finishClose(other);
    }
  }

  state.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : state.btn;
  state.layer.hidden = false;
  void state.layer.offsetWidth;
  state.layer.classList.add('is-open');
  document.documentElement.classList.add('menu-open');
  setPageInert(true);
  syncBtn(state.menu, true);

  const first = state.panel.querySelector('a[href]');
  requestAnimationFrame(() => {
    if (!first) return;
    try { first.focus({ preventScroll: true }); } catch { first.focus(); }
  });
}

function closeMenu(state, { immediate = false } = {}) {
  const visible = state.layer.classList.contains('is-open') || state.closing;
  if (!visible && !state.menu.open) {
    finishClose(state);
    return;
  }
  if (immediate || reduce.matches) {
    finishClose(state);
    return;
  }
  if (state.closing) return;

  state.closing = true;
  state.layer.classList.add('is-closing');
  state.layer.classList.remove('is-open');
  syncBtn(state.menu, true); // still "open" until animation ends

  let settled = false;
  const done = () => {
    if (settled) return;
    settled = true;
    state.layer.removeEventListener('transitionend', onEnd);
    clearTimeout(fallback);
    if (state.closing) finishClose(state);
  };
  const onEnd = (e) => {
    if (e.target !== state.sheet && !e.target.classList?.contains('site-menu-rule')) return;
    if (e.propertyName !== 'clip-path' && e.propertyName !== 'transform') return;
    done();
  };
  state.layer.addEventListener('transitionend', onEnd);
  const fallback = setTimeout(done, CLOSE_MS() + 100);
}

for (const state of states) {
  syncBtn(state.menu, false);

  state.menu.addEventListener('toggle', () => {
    if (state.menu.open) {
      openMenu(state);
      return;
    }
    // Summary click closed details: run reverse choreography if still visible.
    if (state.layer.classList.contains('is-open') && !state.closing) closeMenu(state);
    else if (!state.closing) syncBtn(state.menu, false);
  });

  state.panel.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => { closeMenu(state); });
  });

  // Backdrop / empty sheet (not a link) closes.
  state.layer.addEventListener('pointerdown', (e) => {
    if (!state.layer.classList.contains('is-open') || state.closing) return;
    if (e.target.closest('a, button, summary')) return;
    closeMenu(state);
  });
}

// Capture so Escape closes the menu before the canvas treats it as "close drawer".
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = states.filter((s) => s.layer.classList.contains('is-open') || s.closing);
  if (!open.length) return;
  e.preventDefault();
  e.stopPropagation();
  for (const s of open) closeMenu(s);
}, true);

// Focus trap: Tab cycles hamburger ↔ layer links.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const state = states.find((s) => s.layer.classList.contains('is-open'));
  if (!state) return;
  const items = [state.btn, ...focusables(state.layer)].filter(Boolean);
  if (items.length < 2) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || (!state.layer.contains(active) && active !== state.btn))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
});

document.addEventListener('pointerdown', (e) => {
  for (const state of states) {
    if (!state.layer.classList.contains('is-open') || state.closing) continue;
    if (state.layer.contains(e.target) || state.menu.contains(e.target)) continue;
    closeMenu(state);
  }
});
