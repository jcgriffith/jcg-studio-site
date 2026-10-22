// Home (/) boot: studio floor engine + HUD wiring, global behaviors.
import { createFloor, resolveMedia, mountCarousel, mountCover3d } from './canvas.js?v=20261023u';
import { initSplitFlap } from './splitflap.js';
import { initHudSnap } from './hud-snap.js';
import { reduced } from './reduce-motion.js';
import { loadWorks } from './works.js?v=20261023u';

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
      <p class="folio-meta hud">${c.handle ? `<span class="frame-caption-handle" role="link" tabindex="0" data-href="${esc(c.handle.url)}">${esc(c.handle.text)}</span>` : `<span>${esc(c.tag)}</span>`}${c.staged ? '<span class="chip chip--staged">Staged</span>' : ''}</p>
      <h2 class="folio-name">${esc(c.concept)}</h2>
      <p class="folio-desc">${esc(c.description || c.member)}</p>`;
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
        <span class="eyebrow ticks snap">List · Work</span>
        <h1 class="h2" id="list-title">Work. <span class="mute">${n} pieces.</span></h1>
      </header>
      <div class="folio-list" role="table" aria-label="Work">
        <div class="folio-list-head hud" role="row">
          <span role="columnheader">Project</span>
          <span role="columnheader">Piece</span>
          <span role="columnheader">Type</span>
          <span role="columnheader">Year</span>
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
    a.dataset.types = (c.types || []).join(' ');
    a.dataset.id = c.id;
    a.setAttribute('role', 'row');
    a.innerHTML = `
      <span class="folio-row-id hud" role="cell">${esc(c.tag)}</span>
      <span class="folio-row-name" role="cell"><b>${esc(c.concept)}</b><span class="mute">${esc(c.description || c.member)}</span></span>
      <span class="folio-row-kind hud" role="cell">${esc(c.workType || data.kinds[c.kind])}</span>
      <span class="folio-row-frames hud" role="cell">${esc(c.date || '')}${c.staged ? ' <span class="chip chip--staged">Staged</span>' : ''}</span>
      <span class="folio-row-go" role="cell" aria-hidden="true">Open</span>`;
    list.append(a);
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
  const data = await loadWorks('assets/data/works.json?v=20261023u');
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
    floor.focusPiece(a.dataset.id);
  };
  grid.addEventListener('click', diveFromFolio);
  list.addEventListener('click', diveFromFolio);

  // Products with a live model (concepts.json `product.model`): one WebGL layer flies each over its cover, its Grid card
  // and its item page (product-3d.js, three.js on demand).
  if (data.concepts.some((c) => c.product?.model)) {
    import('./product-3d.js?v=20261023u').then(({ initProducts }) => initProducts(data, floor))
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

// A card's media reel, fitted (JC 2026-10-22: "those initial images should align with the right edge of the
// description ... the final image cut in the margin"): the row height is chosen so a whole number of items fills the
// content width exactly (as many as the room's height allows), and the next item starts just past the content edge,
// peeking into the margin where the card's border cuts it.
{
  const fit = (track) => {
    const items = [...track.children].filter((el) => el.matches('img, video'));
    if (!items.length) return;
    const card = track.closest('.piece-card'), cs = getComputedStyle(card);
    const W = track.clientWidth - parseFloat(cs.paddingRight), g = parseFloat(getComputedStyle(track).columnGap) || 0;
    const reel = track.closest('.piece-reel'), nav = reel.querySelector('.piece-reel-nav');
    const H = reel.clientHeight - (nav ? nav.offsetHeight + (parseFloat(getComputedStyle(reel).rowGap) || 0) : 0);   // the room the reel has
    if (!W || !H) return;
    const ar = items.map((el) => (Number(el.getAttribute('width')) || 4) / (Number(el.getAttribute('height')) || 3));
    items.forEach((el) => { el.style.width = ''; });
    // First choice: the full height, with the items that fit the width widened a little to fill it exactly (they crop at
    // their edges, object-fit: cover), at most 35% wider than they are.
    let n = 0, used = 0;
    while (n < items.length && used + ar[n] * H + (n ? g : 0) <= W) { used += ar[n] * H + (n ? g : 0); n++; }
    // ...or one more item, narrowed a little (cropped at its edges) to squeeze in, at least 60% of its width;
    // whichever changes the pictures least.
    const fitN = (k) => { let w = 0; for (let i = 0; i < k; i++) w += ar[i] * H; return (W - (k - 1) * g) / w; };
    const up = n ? fitN(n) : Infinity, down = n < items.length ? fitN(n + 1) : 0;
    const okUp = up <= 1.35, okDown = down >= 0.6;
    const k = okUp && okDown ? (Math.abs(Math.log(up)) <= Math.abs(Math.log(down)) ? n : n + 1) : okUp ? n : okDown ? n + 1 : 0;
    const scale = k === n ? up : down;
    let h = H;
    if (k) items.slice(0, k).forEach((el, i) => { el.style.width = `${(ar[i] * H * scale).toFixed(2)}px`; });
    else {
      // Otherwise: a lower row where a whole number of items fills the width at their own shape.
      let sum = 0;
      for (let k = 1; k <= items.length; k++) { sum += ar[k - 1]; const hk = (W - (k - 1) * g) / sum; if (hk <= H) { h = hk; break; } }
    }
    track.style.setProperty('--reel-h', `${h.toFixed(2)}px`); track.style.height = `${h.toFixed(2)}px`;   // the arrows sit right under the row
  };
  const ro = new ResizeObserver((es) => es.forEach((e) => fit(e.target.querySelector?.('.piece-reel-track') || e.target)));
  const watch = () => document.querySelectorAll('.piece-reel-track:not([data-fit])').forEach((t) => { t.dataset.fit = ''; ro.observe(t.closest('.piece-reel')); fit(t); });
  new MutationObserver(watch).observe(document.body, { subtree: true, childList: true });
  watch();
}
