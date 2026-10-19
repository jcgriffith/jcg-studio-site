// Home (/) boot: studio floor engine + HUD wiring, global behaviors.
import { loadConcepts, createFloor, resolveMedia, mountCarousel, mountCover3d } from './canvas.js';
import { initSplitFlap } from './splitflap.js';
import { initHudSnap } from './hud-snap.js';
import { reduced } from './reduce-motion.js';

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
  return { t: e + 60, r: e, b: e + 56, l: e };
};

function artifactCount(c) {
  return c.frames.filter((f) => f.kind !== 'plan').length;
}

/** Build the scrollable Grid of concept covers (readable gutters, page scroll). */
function buildGrid(host, data) {
  const n = data.concepts.length;
  host.innerHTML = `
    <div class="wrap folio-wrap">
      <header class="folio-head">
        <span class="eyebrow ticks snap">Grid · Studio Concepts</span>
        <h1 class="h2" id="grid-title">Studio Concepts. <span class="mute">${n} covers.</span></h1>
        <p class="lede">Quiet covers with room to breathe. Open one to dive into the full portfolio item.</p>
      </header>
      <div class="folio-grid" role="list"></div>
    </div>`;
  const grid = host.querySelector('.folio-grid');
  for (const c of data.concepts) {
    const a = document.createElement('a');
    a.href = `#${c.id}`;
    a.className = 'folio-item folio-card';
    a.dataset.kind = c.kind;
    a.dataset.id = c.id;
    a.setAttribute('role', 'listitem');
    const cw = c.coverW || data.layout?.cover?.w || 960;
    const ch = c.coverH || data.layout?.cover?.h || 600;
    a.innerHTML = `
      <div class="folio-cover" style="aspect-ratio:${cw} / ${ch}" aria-hidden="true"></div>
      <p class="folio-meta hud"><span class="chip chip--tag">${esc(c.tag)}</span><span>${esc(data.kinds[c.kind])}</span><span class="mute">${esc((c.date || '').split('·').pop().trim())}</span></p>
      <h2 class="folio-name">${esc(c.concept)}</h2>
      <p class="folio-desc">${esc(c.description || c.member)}</p>
      <p class="folio-facts hud mute">${esc(c.workType || data.kinds[c.kind])}</p>`;
    const cover = a.querySelector('.folio-cover');
    const media = resolveMedia(c);
    if (media.length) mountCarousel(cover, media, { reduced: reduced() });
    if (c.model3d || c.embed3d) {          // a live 3D cover (the JCG Belt, the Etherea Loft), straight to its own page
      mountCover3d(cover, c);
      if (c.openPage && c.page) a.href = new URL(c.page, document.baseURI).href;
    }
    grid.append(a);
  }
  return host;
}

/** Build the compact List rows (id, name, kind, frames). */
function buildList(host, data) {
  const n = data.concepts.length;
  host.innerHTML = `
    <div class="wrap folio-wrap">
      <header class="folio-head">
        <span class="eyebrow ticks snap">List · Studio Concepts</span>
        <h1 class="h2" id="list-title">Studio Concepts. <span class="mute">${n} rows.</span></h1>
        <p class="lede">Dense inventory of every concept. Open a row to dive into the full portfolio item.</p>
      </header>
      <div class="folio-list" role="table" aria-label="Studio Concepts">
        <div class="folio-list-head hud" role="row">
          <span role="columnheader">ID</span>
          <span role="columnheader">Name</span>
          <span role="columnheader">Type</span>
          <span role="columnheader">When</span>
          <span role="columnheader"><span class="sr-only">Open</span></span>
        </div>
      </div>
    </div>`;
  const list = host.querySelector('.folio-list');
  for (const c of data.concepts) {
    const a = document.createElement('a');
    a.href = `#${c.id}`;
    a.className = 'folio-item folio-row';
    a.dataset.kind = c.kind;
    a.dataset.id = c.id;
    a.setAttribute('role', 'row');
    a.innerHTML = `
      <span class="folio-row-id hud" role="cell">${esc(c.id.toUpperCase())}</span>
      <span class="folio-row-name" role="cell"><b>${esc(c.concept)}</b><span class="mute">${esc(c.description || c.member)}</span></span>
      <span class="folio-row-kind hud" role="cell">${esc(c.workType || data.kinds[c.kind])}</span>
      <span class="folio-row-frames hud" role="cell">${esc((c.date || '').split('·').pop().trim() || String(artifactCount(c)).padStart(2, '0'))}</span>
      <span class="folio-row-go" role="cell" aria-hidden="true">Open</span>`;
    list.append(a);
  }
  return host;
}

try {
  const data = await loadConcepts('assets/data/concepts.json');
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

  // Grid / List: in-canvas solo expand (same Open flow as the title-card button).
  const diveFromFolio = (e) => {
    const a = e.target.closest('a.folio-item');
    if (!a?.dataset.id) return;
    e.preventDefault();
    floor.setView('canvas', false);
    floor.openStage(a.dataset.id);
  };
  grid.addEventListener('click', diveFromFolio);
  list.addEventListener('click', diveFromFolio);

  // Products with a live model (concepts.json `product.model`): one WebGL layer flies each over its cover, its Grid card
  // and its item page (product-3d.js, three.js on demand).
  if (data.concepts.some((c) => c.product?.model)) {
    import('./product-3d.js').then(({ initProducts }) => initProducts(data, floor))
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
