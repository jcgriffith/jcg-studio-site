// Home (/) boot: studio floor engine + HUD wiring, global behaviors.
import { createFloor, resolveMedia, mountCarousel, mountCover3d, isPhoneClass } from './canvas.js?v=20261027w';
import { initSplitFlap } from './splitflap.js';
import { initHudSnap } from './hud-snap.js';
import { reduced } from './reduce-motion.js';
import { loadWorks } from './works.js?v=20261027w';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

initSplitFlap();
initHudSnap();

// Screen-space area the camera can use: below the corner HUD row
// (logo/menu left, Subscribe right), above the bottom HUD.
// Follows the HUD's --edge inset (tokens.css), so the camera clears the corners at every width.
const insets = () => {
  const e = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--edge')) || 12;
  const phone = window.innerWidth < 760;
  return { t: e + (phone ? 60 : 64), r: e, b: e + 56 + (phone ? 50 : 0), l: e };   // phone: the filter strip sits above the bottom HUD
};

function artifactCount(c) {
  return c.frames.filter((f) => f.kind !== 'plan').length;
}

/** Build the scrollable Grid of concept covers (readable gutters, page scroll). */
const touchScreen = () => window.matchMedia('(pointer: coarse)').matches;
const ONE_COL_SIZES = '(max-width: 759px) 92vw, (pointer: coarse) and (max-height: 500px) 92vw, 720px';
function buildGrid(host, data) {
  const n = data.concepts.length;
  host.innerHTML = `
    <div class="wrap folio-wrap">
      <header class="folio-head">
        <span class="eyebrow ticks snap">Grid · Work</span>
        <h1 class="h2" id="grid-title">Work. <span class="mute">${n} pieces.</span></h1>
      </header>
      <div class="folio-grid" role="list"></div>
    </div>`;
  const grid = host.querySelector('.folio-grid');
  for (const c of data.concepts) {
    const a = document.createElement('a');
    a.href = `#${c.id}`;
    a.className = 'folio-item folio-card';
    a.dataset.kind = c.kind;
    a.dataset.types = (c.types || []).join(' ');
    a.dataset.id = c.id;
    a.setAttribute('role', 'listitem');
    const cw = c.coverW || data.layout?.cover?.w || 960;
    const ch = c.coverH || data.layout?.cover?.h || 600;
    a.innerHTML = `
      <div class="folio-cover" style="aspect-ratio:${cw} / ${ch}" aria-hidden="true"></div>
      <p class="folio-meta hud">${c.handle ? `<span class="frame-caption-handle" role="link" tabindex="0" data-href="${esc(c.handle.url)}">${esc(c.handle.text)}</span>` : `<span>${esc(c.tag)}</span>`}${c.staged ? '<span class="chip chip--staged">Staged</span>' : ''}<span class="folio-meta-year">${esc(c.year || '')}</span></p>
      <h2 class="folio-name">${esc(c.concept)}</h2>
      <p class="folio-desc">${esc(c.description || c.member)}</p>`;
    const cover = a.querySelector('.folio-cover');
    const media = resolveMedia(c, true);
    // Task P: touch screens (iPad too) keep a still on the Grid cover, never a live iframe; the branded 3D still when there is one
    if (touchScreen() && c.phoneCover && media[0]) media[0] = { ...media[0], src: c.phoneCover, type: 'image' };
    if (media.length) {
      // Phone Grid is one full-width cover per row (JC 2026-10-28): srcset picks 360/540/720 for ~92vw (720 at DPR 2-3).
      mountCarousel(cover, media, { reduced: reduced(), sizes: ONE_COL_SIZES });
      // phone-class: only the first cover is above the fold (eager); the rest stay lazy. Wider screens show two across.
      const eagerN = isPhoneClass() ? 1 : 2;
      if (grid.children.length < eagerN) cover.querySelectorAll('img').forEach((im, i) => { if (eagerN === 2 || i === 0) { im.loading = 'eager'; im.fetchPriority = 'high'; } });
    }
    if ((c.model3d || c.embed3d) && !touchScreen()) {          // a live 3D cover (the JCG Belt, the Etherea Loft), straight to its own page
      mountCover3d(cover, c);
      if (c.openPage && c.page) a.href = new URL(c.page, document.baseURI).href;
    }
    a.setAttribute('aria-haspopup', 'dialog');
    a.setAttribute('aria-expanded', 'false');
    grid.append(a);
  }
  return host;
}

/** Build the List: one clickable row per piece (project, piece + line, type, year); it expands in place (folio-views.js). */
function buildList(host, data) {
  const n = data.concepts.length;
  host.innerHTML = `
    <div class="wrap folio-wrap">
      <header class="folio-head">
        <span class="eyebrow ticks snap">List · Work</span>
        <h1 class="h2" id="list-title">Work. <span class="mute">${n} pieces.</span></h1>
      </header>
      <div class="folio-list" role="list" aria-label="Work">
        <div class="folio-list-head hud" aria-hidden="true">
          <span>Project</span><span>Piece</span><span>Type</span><span>Year</span><span></span>
        </div>
      </div>
    </div>`;
  const list = host.querySelector('.folio-list');
  for (const c of data.concepts) {
    const el = document.createElement('div');
    el.className = 'folio-item folio-entry';
    el.dataset.kind = c.kind;
    el.dataset.types = (c.types || []).join(' ');
    el.dataset.id = c.id;
    el.setAttribute('role', 'listitem');
    el.innerHTML = `
      <button type="button" class="folio-row" id="row-${esc(c.id)}" aria-expanded="false" aria-controls="drawer-${esc(c.id)}">
        <span class="folio-row-id hud">${esc(c.tag)}</span>
        <span class="folio-row-name"><b>${esc(c.concept)}</b><span class="mute">${esc(c.description || c.member)}</span></span>
        <span class="folio-row-kind hud">${esc(c.workType || data.kinds[c.kind])}</span>
        <span class="folio-row-frames hud">${esc(c.date || '')}${c.staged ? ' <span class="chip chip--staged">Staged</span>' : ''}</span>
        <span class="folio-row-plus" aria-hidden="true"></span>
      </button>
      <div class="fx-drawer" id="drawer-${esc(c.id)}" role="region" aria-label="${esc(c.concept)}" hidden></div>`;
    list.append(el);
  }
  return host;
}

/** The filter bar: All plus every type that has pieces (counts quiet). ?f=<type> holds the state (canvas.js filter()). */
function buildFilters(host, data) {
  if (!host) return;
  // a filter with a single piece reads thin (JC 2026-10-22), so it waits until a second piece of that type exists
  const types = data.types.filter((t) => t.n >= 2);
  host.innerHTML = [{ id: 'all', label: 'All', n: data.concepts.length }, ...types]
    .map((t) => `<button class="hud-btn" type="button" data-filter="${esc(t.id)}" aria-pressed="false">${esc(t.label)}<span class="hud-count">${t.n}</span></button>`).join('');
  host.hidden = types.length < 2;
  document.documentElement.classList.toggle('has-filters', !host.hidden);   // the phone layout makes room for the chip row
}

/** Staged preview (local only): ?staged=0 shows exactly what ships; the toggle shows only when staged pieces exist. */
function buildStagedToggle(btn, data) {
  if (!btn) return;
  const any = data.concepts.some((c) => c.staged);
  if (!data.liveOnly && !any) { btn.hidden = true; return; }
  btn.hidden = false;
  btn.setAttribute('aria-pressed', String(!data.liveOnly));
  btn.querySelector('[data-label]').textContent = data.liveOnly ? 'Live view' : 'Staged on';
  btn.addEventListener('click', () => {
    const q = new URLSearchParams(location.search);
    if (data.liveOnly) q.delete('staged'); else q.set('staged', '0');
    location.search = q.toString();
  });
}

try {
  const data = await loadWorks('assets/data/works.json?v=20261027w');
  buildFilters($('[data-filters]'), data);
  buildStagedToggle($('[data-staged-toggle]'), data);
  const index = $('#index');
  index.hidden = true;

  const grid = buildGrid($('#grid'), data);
  const list = buildList($('#list'), data);
  grid.hidden = true;
  list.hidden = true;

  const floor = createFloor($('#floor'), data, {
    mode: 'full',
    home: 'membership/',
    work: '',
    insets,
    onView: (v, prev) => document.dispatchEvent(new CustomEvent('jcg:view', { detail: { view: v, prev } })),
    onStageOver: (on, id) => document.dispatchEvent(new CustomEvent('jcg:stageover', { detail: { on, id } })),
    drawer: $('#drawer'),
    index,
    grid,
    list,
    hud: {
      zoom: $('[data-zoom]'),
      live: $('#floor-live'),
      zoomIn: $('[data-zoom-in]'),
      zoomOut: $('[data-zoom-out]'),
      fit: $('[data-fit]'),
      filters: $$('[data-filter]'),
      views: $$('.hud-bottom [data-view]'),
    },
  });

  // Canvas on a phone: the piece sheet opens over Canvas (the camera does the fly-in). When it closes, go back to the scrolling
  // Grid/List the visitor came from instead of stranding them on the non-scrolling Canvas (Task L, 2026-10-28).
  const phoneQ = { get matches() { return isPhoneClass(); } };   // phone portrait or on its side (Task O: both get the full-height sheet)
  const root = document.documentElement;
  let sheetWas = root.classList.contains('piece-sheet-open');
  new MutationObserver(() => {
    const on = root.classList.contains('piece-sheet-open');
    // Explore 3D / Case study / Story hide the sheet because the project stage opens over it (root.solo-open): that is not a close,
    // so stay on Canvas with the stage up (Task M, 2026-10-28; the observer used to bounce to Grid and tear the stage down).
    if (sheetWas && !on && phoneQ.matches && root.dataset.view === 'canvas' && !root.classList.contains('solo-open')) {
      let saved = null; try { saved = sessionStorage.getItem('jcg-work-view'); } catch (_) { /* private mode */ }
      if (saved !== 'canvas') floor.setView(saved === 'list' ? 'list' : 'grid', true, false);
    }
    sheetWas = on;
  }).observe(root, { attributes: true, attributeFilter: ['class'] });
  // Grid / List open each piece in place (Task P, 2026-10-28): the card/row expands where it is, with the same carousel,
  // lightbox and buttons as the Canvas card. Loaded after first paint; a click before it lands is picked up from the hash.
  import('./folio-views.js?v=20261027w').then(({ initFolioViews }) => initFolioViews({ data, floor, grid, list }))
    .catch((err) => console.warn('[jcg] grid/list expansion unavailable:', err));

  // Products with a live model (concepts.json `product.model`): one WebGL layer flies each over its cover, its Grid card
  // and its item page (product-3d.js, three.js on demand).
  if (data.concepts.some((c) => c.product?.model)) {
    import('./product-3d.js?v=20261026b').then(({ initProducts }) => initProducts(data, floor))
      .catch((err) => console.warn('[jcg] 3D products unavailable:', err));
  }

  // The field (play layer, dot-field.js): press the floor's empty space and its dots light up, on the floor's own lattice,
  // panning and zooming with it.
  const floorRoot = $('#floor'), world = floorRoot.querySelector('.world');
  if (world) {
    import('./dot-field.js').then(({ initField }) => initField(floorRoot, {
      layer: world,
      toLayer: (e) => { const r = world.getBoundingClientRect(), s = r.width / (world.offsetWidth || r.width) || 1; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; },
      canStart: (e) => !e.target.closest('.cluster, .frame, a, button, .hud-panel, .lock-tags'),
    })).catch((err) => console.warn('[jcg] field unavailable:', err));
  }

  // Reduced motion: the camera already jumps instead of flying; also offer Grid.
  const note = $('[data-rm-note]');
  let noted = false;                                     // storage can be blocked: that must not stop the floor
  try { noted = !!sessionStorage.getItem('jcg-rm-note'); } catch (e) { /* storage blocked */ }
  if (reduced() && !noted && location.hash !== '#index') {
    note.hidden = false;
    const hide = () => { note.hidden = true; try { sessionStorage.setItem('jcg-rm-note', '1'); } catch (e) { /* storage blocked */ } };
    $('[data-rm-grid]')?.addEventListener('click', () => { hide(); floor.setView('grid'); });
    $('[data-rm-dismiss]')?.addEventListener('click', hide);
  }
} catch (err) {
  // Fail loud, fall back to the Index (the no-JS path).
  console.error('[jcg] studio floor failed to boot:', err);
  document.documentElement.classList.replace('js', 'no-js');
  $('[data-floor-error]').hidden = false;
}

// the project handle inside a Grid card (the card is itself a link): opens the account in a new tab, not the card
document.addEventListener('click', (e) => {
  const h = e.target.closest('.folio-card .frame-caption-handle[data-href]'); if (!h) return;
  e.preventDefault(); e.stopPropagation(); window.open(h.dataset.href, '_blank', 'noopener');
}, true);
document.addEventListener('keydown', (e) => {
  const h = e.target.closest?.('.folio-card .frame-caption-handle[data-href]');
  if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); window.open(h.dataset.href, '_blank', 'noopener'); }
}, true);

// A card's media reel: its videos play only while that card is open and on screen (they load nothing before),
// and pause when it closes. Reduced motion leaves them on their posters.
{
  const on = (v) => { if (!reduced() && v.closest('.cluster.is-open') && v.dataset.seen === '1') v.play().catch(() => {}); else v.pause(); };
  const io = new IntersectionObserver((es) => es.forEach((e) => { e.target.dataset.seen = e.isIntersecting ? '1' : '0'; on(e.target); }));
  const watch = () => document.querySelectorAll('.piece-reel video:not([data-watched])').forEach((v) => { v.dataset.watched = ''; io.observe(v); });
  new MutationObserver((ms) => {
    watch();
    ms.forEach((m) => { if (m.attributeName === 'class' && m.target.matches?.('.cluster')) m.target.querySelectorAll('.piece-reel video').forEach(on); });
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  watch();
}

// A card's media reel, fitted (lightbox pass 2026-10-27, replacing the 2026-10-22 "several small items" row): one big
// slide at a time fills the card's content width, 4:3 and capped by the room the card has (desktop / iPad) or by the
// screen's height (phone sheet). Wide pictures fill it (cropped a little), tall ones and video sit whole inside it.
// Tapping a slide opens the lightbox (canvas.js); the arrows, swipe and "n / total" move the row.
{
  const fit = (track) => {
    const W = track.clientWidth;
    if (!W) return;
    let h = W * 0.75;
    if (track.closest('.piece-sheet') && isPhoneClass()) {   // full-height phone sheet: CSS flexes the slide (Task O)
      track.style.removeProperty('height'); track.style.removeProperty('--reel-h'); return;
    }
    if (track.closest('.piece-sheet')) h = Math.min(h, Math.max(180, innerHeight * 0.36));
    else {
      const reel = track.closest('.piece-reel'), nav = reel.querySelector('.piece-reel-nav');
      const H = reel.clientHeight - (nav ? nav.offsetHeight + (parseFloat(getComputedStyle(reel).rowGap) || 0) : 0);   // the room the card leaves it
      if (H > 0) h = Math.min(h, H);
    }
    track.style.setProperty('--reel-h', `${h.toFixed(2)}px`); track.style.height = `${h.toFixed(2)}px`;   // the arrows sit right under the row
  };
  const ro = new ResizeObserver((es) => es.forEach((e) => fit(e.target.querySelector?.('.piece-reel-track') || e.target)));
  const watch = () => document.querySelectorAll('.piece-reel-track:not([data-fit])').forEach((t) => { t.dataset.fit = ''; ro.observe(t.closest('.piece-reel')); fit(t); });
  new MutationObserver(watch).observe(document.body, { subtree: true, childList: true });
  watch();
}
