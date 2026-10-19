// The play layer, Phase 1 (PLAY-BREAKDOWN.md, approved by JC on 2026-10-05). Loaded on every site page by site-menu.js.
// The spine: everything is made of blocks, and you break, build and collect them.
//   - Nine blocks hide in playful moments around the site (play-store.js has the list). A find arrives as a toast,
//     "BLOCK 4 / 9 · CLEARED THE WALL", and the nav mark, which is the progress bar, grows a piece (nav-mark.js grow()).
//     Finds are kept on this device only. Nothing is locked behind them and nothing nags; reduced motion still counts.
//   - The menu gets a quiet Play section: this device's visit, blocks and best score, a Play button (the footer game,
//     or on the Work floor, which has no footer, a sheet with the game in it), and once all nine are found, the
//     reward: Blueprint, which draws the page's measurements, and a sticker sheet to download.
//   - Pressing things: keycaps on every button (press.js), and the field on footers (dot-field.js).
// The moments themselves live with their parts and announce themselves with DOM events this file turns into finds:
// game:cleared and game:start (footer-game.js), floor:lock and floor:open (canvas.js), faq:read (infinite-faq.js),
// build:done (build-mark.js), field:bloom (dot-field.js). Two need nothing but the page: a case study page, and a visit
// after sunset in Colorado Springs.
import { find, count, has, best, visit, pref, labelOf, TOTAL } from './play-store.js';
import { grow, introDone } from './nav-mark.js';
import { toast } from './feedback.js';
import { keycaps } from './press.js';
import { reduced } from './reduce-motion.js';

const root = document.documentElement;
const pad = (n, w = 2) => String(n).padStart(w, '0');
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const isHome = () => !!document.getElementById('floor');
const game = () => document.querySelector('[data-footer-game]:not(.play-sheet [data-footer-game])');

keycaps(document);
const visitN = visit();

// ── Finds: one at a time, a beat apart, after the first-visit intro ─────
const queue = [];
let busy = false;
function next() {
  if (busy || !queue.length) return;
  busy = true;
  const { id, n } = queue.shift();
  grow(n);
  toast({
    state: 'done',
    label: `Block ${n} / ${TOTAL} · ${labelOf(id)}`,
    text: n === TOTAL ? 'All nine. Blueprint and a sticker sheet are in the menu.'
      : n === 1 ? 'Nine are hidden around the site. Finds stay on this device.'
      : 'Another one found.',
    action: n === TOTAL ? { label: 'Stickers', onClick: () => stickers('png') } : null,
  });
  renderMenu();
  setTimeout(() => { busy = false; next(); }, reduced() ? 300 : 1100);
}
let ready = false;
addEventListener('jcg:find', (e) => { queue.push(e.detail); if (ready) next(); });
introDone.then(() => setTimeout(() => { ready = true; next(); }, 400));

// ── The moments ─────────────────────────────────────────────────────────
document.addEventListener('game:cleared', () => find('wall'));
document.addEventListener('game:start', (e) => { if (e.target.closest?.('.play-sheet')) find('home'); });
document.addEventListener('floor:lock', () => find('lock'));
document.addEventListener('floor:open', () => find('case'));
document.addEventListener('build:done', () => find('build'));
document.addEventListener('field:bloom', () => find('field'));
document.addEventListener('faq:read', (e) => { if (e.detail.n >= e.detail.total) find('faq'); });
// Reduced motion keeps the FAQ as eleven plain <details>: opening all eleven counts the same.
const faq = document.querySelector('[data-faq-source]');
if (faq) {
  const opened = new Set(), all = faq.querySelectorAll('details[data-q]').length;
  faq.addEventListener('toggle', (e) => { if (e.target.open && e.target.dataset.q) { opened.add(e.target.dataset.q); if (opened.size >= all) find('faq'); } }, true);
}
// Two blocks come to you rather than from a touch: a case study page, and a visit after sunset. They count only once this
// device has found a block by playing, so no one who hasn't started is shown a toast or a changed logo.
const onCase = /\/work\/cs-\d+\/?$/.test(location.pathname.replace(/index\.html$/, ''));
function arrive() {
  if (!count()) return;
  if (onCase && !has('case')) find('case');
  if (!has('sunset') && afterSunset()) find('sunset');
}
addEventListener('jcg:find', () => setTimeout(arrive, 0));
introDone.then(() => setTimeout(arrive, 1200));

// ── After sunset in Colorado Springs, by the real clock ────────────────
// NOAA's general solar position equations for the studio (38.8339 N, 104.8214 W), on today's date in America/Denver.
// Night runs from sunset to the next sunrise. No API: the sun keeps its own time.
const LAT = 38.8339, LON = -104.8214, RAD = Math.PI / 180;
export function sunTimes(y, m, d) {
  const n = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 864e5);
  const g = (2 * Math.PI / 365) * (n - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * RAD) / (Math.cos(LAT * RAD) * Math.cos(decl)) - Math.tan(LAT * RAD) * Math.tan(decl)) / RAD;
  const midnight = Date.UTC(y, m - 1, d);
  return { rise: midnight + (720 - 4 * (LON + ha) - eq) * 6e4, set: midnight + (720 - 4 * (LON - ha) - eq) * 6e4 };
}
export function afterSunset(now = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  const { rise, set } = sunTimes(+p.year, +p.month, +p.day);
  return now >= set || now < rise;
}

// ── The menu's Play section ─────────────────────────────────────────────
const menu = document.querySelector('.site-menu');
const panel = menu?.querySelector('.site-menu-panel');
let section = null;
if (panel) {
  section = document.createElement('div');
  section.className = 'play-menu';
  section.style.setProperty('--i', String(panel.querySelectorAll(':scope > a, .site-menu-actions > a').length));
  section.innerHTML =
    '<p class="play-stats hud" data-play-stats></p>' +
    '<div class="play-menu-row">' +
    '<button class="play-menu-btn" type="button" data-play-open>Play</button>' +
    '<button class="play-menu-btn" type="button" data-blueprint aria-pressed="false" hidden>Blueprint</button>' +
    '<button class="play-menu-btn" type="button" data-stickers="svg" hidden>Stickers · SVG</button>' +
    '<button class="play-menu-btn" type="button" data-stickers="png" hidden>PNG</button>' +
    '</div>';
  panel.append(section);
  const close = () => { if (menu.open) menu.open = false; };
  section.querySelector('[data-play-open]').addEventListener('click', () => { close(); openGame(); });
  section.querySelector('[data-blueprint]').addEventListener('click', () => { close(); setBlueprint(!pref('blueprint'), true); });
  section.querySelectorAll('[data-stickers]').forEach((b) => b.addEventListener('click', () => { close(); stickers(b.dataset.stickers); }));
  renderMenu();
}
function renderMenu() {
  if (!section) return;
  const b = best('wall'), whole = has('all');
  const parts = [visitN > 1 ? `Welcome back · ${ordinal(visitN)} visit` : 'First visit', `Blocks ${count()} / ${TOTAL}`];
  if (b) parts.push(`Best ${pad(b, 4)}`);
  section.querySelector('[data-play-stats]').innerHTML = parts.map((t) => `<span>${t}</span>`).join('');
  section.querySelector('[data-play-open]').hidden = !isHome() && !game();
  section.querySelectorAll('[data-blueprint], [data-stickers]').forEach((el) => { el.hidden = !whole; });
  section.querySelector('[data-blueprint]').setAttribute('aria-pressed', String(!!pref('blueprint')));
}

// ── Play: the footer game, or on the Work floor a sheet with the game in it ──
function openGame() {
  const host = game();
  if (host && !isHome()) {
    host.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'end' });
    setTimeout(() => host.querySelector('.game-play')?.focus({ preventScroll: true }), reduced() ? 0 : 500);
    return;
  }
  let sheet = document.querySelector('.play-sheet');
  if (!sheet) {
    sheet = document.createElement('section');
    sheet.className = 'play-sheet';
    sheet.setAttribute('aria-label', 'Breakout on the logo');
    sheet.hidden = true;
    sheet.innerHTML = '<div class="play-sheet-head hud"><span>Breakout · the floor</span><button class="play-sheet-close" type="button" aria-label="Close the game"></button></div>' +
      '<div class="foot-game" data-footer-game data-wall="WORK"></div>';
    document.body.append(sheet);
    sheet.querySelector('.play-sheet-close').addEventListener('click', closeGame);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) { e.preventDefault(); e.stopPropagation(); closeGame(); } }, true);
    import('./footer-game.js').then((m) => m.mountGame(sheet.querySelector('[data-footer-game]')));
  }
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  root.classList.add('play-open');
  setTimeout(() => sheet.querySelector('.game-play')?.focus({ preventScroll: true }), reduced() ? 50 : 400);
}
function closeGame() {
  const sheet = document.querySelector('.play-sheet');
  if (!sheet || sheet.hidden) return;
  sheet.classList.remove('is-open');
  root.classList.remove('play-open');
  sheet.dispatchEvent(new CustomEvent('game:hide'));
  setTimeout(() => { sheet.hidden = true; }, reduced() ? 0 : 280);
  menu?.querySelector('.site-menu-btn')?.focus({ preventScroll: true });
}

// ── The field on footers ────────────────────────────────────────────────
const footer = document.querySelector('body > footer');
if (footer) import('./dot-field.js').then((m) => m.initField(footer)).catch((err) => console.warn('[jcg] field unavailable:', err));

// ── Build the mark (the 404 page) ───────────────────────────────────────
const build = document.querySelector('[data-build]');
if (build) import('./build-mark.js').then((m) => m.initBuild(build)).catch((err) => console.warn('[jcg] build unavailable:', err));

// ── The reward for all nine: Blueprint and the sticker sheet ────────────
function setBlueprint(on, sweep = false) {
  pref('blueprint', on);
  renderMenu();
  import('./blueprint.js').then((m) => m.blueprint(on, { sweep })).catch((err) => console.warn('[jcg] blueprint unavailable:', err));
}
if (has('all') && pref('blueprint')) setBlueprint(true);
function stickers(kind) {
  import('./stickers.js').then((m) => m.download(kind)).catch((err) => console.warn('[jcg] stickers unavailable:', err));
}
