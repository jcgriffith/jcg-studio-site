// Studio floor engine — vanilla DOM + one transformed world element.
// Camera: world→screen is  screen = world * s + (x, y).
// Full mode (home /): pan (drag / wheel / trackpad), pinch + ctrl-wheel zoom,
// −/+/Fit, fit-to-frame fly, drawer, Grid|List|Canvas toggle, deep links (#sc-01, #sc-01/tokens),
// filter wiring, rubber-band edges, inertia, LOD, culling, keyboard.
// Preview mode (membership #work): bounded window, never captures wheel or one-finger
// scroll; Explore unlocks drag-pan on desktop, navigates to / on touch.
import { reduced } from './reduce-motion.js';
import { renderFrame } from './frames.js';
import { shimmer, loadImage } from './shimmer.js';
import { scan } from './scanline.js';
import { initSplitFlap } from './splitflap.js';

const MIN_S = 0.08;
// what a cover is, for screen readers: a built project says what it was (719: "Photo studios"), not "Studio concept"
const kindOf = (c) => (c.product ? 'Product' : c.tag === 'BUILT' ? (c.coverKind || 'Case study') : 'Studio concept');
const MAX_S = 3;
const FLY_MS = 450;
const DIVE_MS = 700;     // opening / closing an item: the morph + camera dive
const LOD_UP = 0.65;     // captions (and title-card detail) show at/above when zooming in
const LOD_DOWN = 0.6;    // ...and hide below when zooming out (a narrow band stops flicker)
const FAR = 0.2;         // hide cluster heads + per-frame labels below
const HIT = 44;          // on-screen hit floor, px
const CULL = 160;        // off-screen margin, px
/* Floor layout grid (world CSS-px). Dot pitch on screen = GRID * cam.s
   (LOD may multiply the painted pitch when tiny). Cover x/y/w/h snap here. */
const DEFAULT_GRID = 24;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const make = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
const snapTo = (n, g) => Math.round(n / g) * g;
const modPos = (n, m) => ((n % m) + m) % m;
const rubber = (x, d) => (1 - 1 / ((x * 0.55) / d + 1)) * d;

/* ── Cover / stage media ───────────────────────────────────────────
   concepts.json: media: [{ type: 'image'|'video', src, poster? }].
   Multi-media covers are manual-only: users advance with arrows/dots.
   A single image/video is rendered as one static/looping cover, not a slideshow. */
export function resolveMedia(c) {
  if (Array.isArray(c.media) && c.media.length) return c.media.filter((m) => m && m.src);
  if (c.src) {
    const video = /\.(mp4|webm|mov)(\?|$)/i.test(c.src);
    return [{ type: video ? 'video' : 'image', src: c.src, poster: c.poster || '' }];
  }
  if (c.poster) return [{ type: 'image', src: c.poster }];
  return [];
}

/* ── Concept art ────────────────────────────────────────────────────
   Studio Concept artifacts are SVG files in assets/concepts/<id>/, written by
   scripts/build-concept-art.py. They're inlined rather than used as <img>, so
   their text sets in the page's own fonts and stays sharp at every zoom. A
   failed fetch leaves the slot empty, which shows the flat grey behind it. */
const isArt = (src) => /\.svg(\?|#|$)/i.test(src || '');
const isStill = (src) => /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(src || '');
const hasAsset = (src) => isArt(src) || isStill(src);
const artMarkup = (src, cls = '') => `<span class="concept-art${cls ? ` ${cls}` : ''}" data-art="${esc(src)}" aria-hidden="true"></span>`;
const artCache = new Map();
export function hydrateArt(scope) {
  scope.querySelectorAll('[data-art]:empty').forEach((el) => {
    const src = el.dataset.art;
    if (!artCache.has(src)) artCache.set(src, fetch(src).then((r) => (r.ok ? r.text() : '')).catch(() => ''));
    artCache.get(src).then((svg) => { if (svg && !el.firstChild) el.innerHTML = svg; });
  });
}

function slideMarkup(m) {
  if (m.type === 'video') {
    const poster = m.poster ? ` poster="${esc(m.poster)}"` : '';
    return `<video class="cover-slide-media" src="${esc(m.src)}"${poster} muted loop playsinline preload="metadata"></video>`;
  }
  if (isArt(m.src)) return artMarkup(m.src, 'cover-slide-media');
  return `<img class="cover-slide-media" src="${esc(m.src)}" alt="" loading="lazy" decoding="async">`;
}

export function mountCarousel(host, media, { reduced: rm = false } = {}) {
  if (!host || !media.length) return null;

  // A lone asset is deliberately not treated as a carousel. Videos may loop,
  // but there is no slideshow timer or crossfade state to advance.
  if (media.length === 1) {
    const root = make('div', 'cover-media-single');
    root.innerHTML = slideMarkup(media[0]);
    host.replaceChildren(root);
    hydrateArt(root);
    const video = root.querySelector('video');
    if (video && !rm) {
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.play()?.catch(() => {});
    }
    return {
      root,
      show() {},
      start() { if (video && !rm) video.play()?.catch(() => {}); },
      stop() { video?.pause(); },
      destroy() { video?.pause(); root.remove(); },
    };
  }

  const root = make('div', 'cover-carousel');
  root.dataset.count = String(media.length);
  const track = make('div', 'cover-carousel-track');
  media.forEach((m, i) => {
    const slide = make('div', `cover-slide${i === 0 ? ' is-active' : ''}`);
    slide.dataset.i = String(i);
    slide.innerHTML = slideMarkup(m);
    track.append(slide);
  });
  root.append(track);

  const controls = make('div', 'cover-carousel-controls');
  controls.setAttribute('aria-label', 'Cover media controls');
  const prev = make('button', 'cover-carousel-arrow');
  prev.type = 'button';
  prev.dataset.carouselPrev = '';
  prev.setAttribute('aria-label', 'Previous cover frame');
  prev.textContent = '←';
  const dots = make('div', 'cover-carousel-dots');
  dots.setAttribute('role', 'tablist');
  dots.setAttribute('aria-label', 'Cover frames');
  media.forEach((_, i) => {
    const d = make('button', i === 0 ? 'is-on' : '');
    d.type = 'button';
    d.dataset.slide = String(i);
    d.setAttribute('role', 'tab');
    d.setAttribute('aria-label', `Show cover frame ${i + 1}`);
    d.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    dots.append(d);
  });
  const next = make('button', 'cover-carousel-arrow');
  next.type = 'button';
  next.dataset.carouselNext = '';
  next.setAttribute('aria-label', 'Next cover frame');
  next.textContent = '→';
  controls.append(prev, dots, next);
  root.append(controls);
  host.replaceChildren(root);
  hydrateArt(root);

  const slides = [...track.children];
  const dotButtons = [...dots.children];
  let idx = 0;

  const playActive = () => {
    slides.forEach((slide, i) => {
      const video = slide.querySelector('video');
      if (!video) return;
      if (i === idx && !rm) {
        video.muted = true;
        video.playsInline = true;
        video.play()?.catch(() => {});
      } else video.pause();
    });
  };

  const show = (n) => {
    idx = (n + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === idx));
    dotButtons.forEach((button, i) => {
      const on = i === idx;
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    playActive();
  };

  // Controls sit over a cover link, so keep their interaction from opening the
  // portfolio item or starting a floor drag.
  controls.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
  controls.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const button = e.target.closest('button');
    if (button?.dataset.carouselPrev !== undefined) show(idx - 1);
    else if (button?.dataset.carouselNext !== undefined) show(idx + 1);
    else if (button?.dataset.slide !== undefined) show(Number(button.dataset.slide));
  });

  const start = () => playActive();
  const stop = () => slides.forEach((slide) => slide.querySelector('video')?.pause());
  start();

  return {
    root, show, start, stop,
    destroy() { stop(); root.remove(); },
  };
}

export async function loadConcepts(url) {
  // aria-busy drives the nav mark's snake loader (nav-mark.js) on slow loads.
  document.documentElement.setAttribute('aria-busy', 'true');
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`concepts.json ${res.status}`);
    const data = await res.json();
    data.concepts = data.concepts.filter((c) => !c.hidden);   // hidden: kept in the file, off every page
    return resolvePaths(data, new URL(url, document.baseURI));
  } finally {
    document.documentElement.removeAttribute('aria-busy');
  }
}

// Media paths in concepts.json are site-relative ("assets/media/…"). Resolve them
// against the site root (two levels above the JSON) so every page that loads it
// (/, /membership/) and any deploy subpath reach the same files.
function resolvePaths(data, jsonUrl) {
  const root = new URL('../../', jsonUrl);
  const fix = (o) => { for (const k of ['src', 'poster']) if (o?.[k]) o[k] = new URL(o[k], root).href; };
  for (const c of data.concepts) {
    fix(c);
    c.media?.forEach(fix);
    c.frames?.forEach(fix);
  }
  return data;
}

// A live 3D cover (belt-3d.js card mode) under the product HUD (product-3d.js hud()), on the floor and in the Grid.
export function mountCover3d(into, c, fallback = null) {
  const host = document.createElement('div');
  host.className = 'cover-3d';
  into.append(host);
  if (c.embed3d) {                       // a live scene that is its own page (the Etherea Loft): its viewer, in cover mode, behind the same HUD
    import('./product-3d.js').then(({ hud }) => {
      host.classList.add('cover-3d--embed');
      host.innerHTML = `${hud(c)}<iframe src="${esc(new URL(c.embed3d, document.baseURI).href)}" title="" tabindex="-1" aria-hidden="true" loading="lazy"></iframe>`;
      host.querySelector('iframe').addEventListener('load', () => { host.classList.add('belt3d-ready'); fallback?.classList.add('belt3d-hidden'); }, { once: true });
    }).catch(() => host.remove());
    return;
  }
  Promise.all([import('./product-3d.js'), import('./belt-3d.js')]).then(([{ hud }, { mount }]) => {
    host.innerHTML = hud(c);
    mount(host, { model: new URL(c.model3d, document.baseURI).href, mode: 'card', fallback });
  }).catch(() => host.remove());
}

export function createFloor(root, data, opts = {}) {
  const o = { mode: 'full', home: 'membership/', work: '', focus: null, hud: {}, ...opts };
  const preview = o.mode === 'preview';
  const W = data.world.w;
  const H = data.world.h;
  const cam = { x: 0, y: 0, s: 1 };
  let raw = { ...cam };
  let vw = root.clientWidth || 1;
  let vh = root.clientHeight || 1;
  let rootRect = root.getBoundingClientRect();
  // The floor moves by its camera, never by scrolling. A deep link (#719-studios) made the browser scroll this fixed box to
  // the item's element and shift everything, the open panel included, under the top edge (2026-10-19).
  root.addEventListener('scroll', () => { if (root.scrollTop || root.scrollLeft) root.scrollTo(0, 0); });
  if (root.scrollTop || root.scrollLeft) root.scrollTo(0, 0);
  const listeners = new Set();
  const frames = [];
  const byKey = new Map();
  const clusters = new Map();
  let lodFull = null;
  let far = null;
  let selected = null;
  let drawerOpen = false;
  let view = 'canvas';
  let unlocked = !preview;
  let lastInput = 'pointer';
  let coverPointer = '';                       // the input that last pressed a cover: a first touch locks on, the second opens

  /* ── Build the world ─────────────────────────────────────────── */
  root.classList.add('floor', preview ? 'floor--preview' : 'floor--full');
  const grid = make('div', 'floor-grid');
  grid.setAttribute('aria-hidden', 'true');
  const world = make('div', 'world');
  world.style.width = `${W}px`;
  world.style.height = `${H}px`;
  if (preview) world.setAttribute('aria-hidden', 'true');

  // Layout: each concept is one big cover tile (always visible), laid out as an
  // equal-width masonry by scripts/layout-masonry.py: art + a caption strip
  // (layout.caption) shown from ~60–65% zoom up. Click/tap/Enter opens the
  // full-screen item. Every coordinate snaps to the floor grid (layout.grid).
  // `expand: "left"` concepts open toward the floor centre.
  const { cover: CV, cell: CELL, gutter: G0, cols: COLS, head: HEAD } = data.layout;
  const GRID = data.layout.grid || G0 || DEFAULT_GRID;
  const G = GRID; // gutters share the same unit so edges meet grid lines
  const PAD = G / 2;
  root.style.setProperty('--floor-grid', `${GRID}px`);
  root.style.setProperty('--floor-grid-n', String(GRID));
  const CAPTION = data.layout.caption || 0;
  root.style.setProperty('--caption-h', `${CAPTION}px`);
  // Per-concept cover footprint (art + caption); snapped so JSON drift can't subpixel.
  const coverOf = (c) => ({
    w: snapTo(c.coverW || CV.w, GRID),
    h: snapTo(c.coverH || CV.h, GRID) + CAPTION,
  });
  const motifOf = (c) => c.layoutMotif || 'grid';
  const snapCoord = (n) => snapTo(n, GRID);

  for (const c of data.concepts) {
    const dir = c.expand === 'left' ? -1 : 1;
    const kids = c.frames;
    const { w: cw, h: ch } = coverOf(c);
    const motif = motifOf(c);
    // Title-card band: one card matching this cover's footprint (not a 3x2 kid grid).
    // Narrow covers (poster, doc) get a 480 floor so the card stays readable.
    const bandW = Math.max(cw, 480);
    const bandH = ch;
    const band = { x: dir > 0 ? cw : -bandW, y: HEAD, w: bandW, h: bandH };

    const sec = make('section', 'cluster ticks');
    sec.dataset.id = c.id;
    sec.dataset.kind = c.kind;
    sec.dataset.dir = dir > 0 ? 'right' : 'left';
    sec.dataset.motif = motif;
    const nameId = `${c.id}-name${preview ? '-p' : ''}`;
    sec.setAttribute('aria-labelledby', nameId);
    const cx = snapCoord(c.x);
    const cy = snapCoord(c.y);
    // Keep runtime geometry on the snapped origin (JSON may already be clean).
    c.x = cx; c.y = cy;
    Object.assign(sec.style, { left: `${cx}px`, top: `${cy}px`, width: `${cw}px`, height: `${HEAD + ch}px` });
    // Rest state is quiet — titles live on the click title card (sr-only name for a11y).
    sec.innerHTML = `<h2 class="cluster-name sr-only" id="${nameId}">${esc(c.concept)}</h2>`;

    const artifacts = kids.filter((f) => f.kind !== 'plan');
    const bandEl = make('div', 'cluster-band');
    bandEl.setAttribute('aria-hidden', 'true');
    Object.assign(bandEl.style, { left: `${band.x}px`, top: `${band.y}px`, width: `${band.w}px`, height: `${band.h}px` });
    bandEl.innerHTML = `
      <i class="band-rule"></i>
      <div class="band-sheet ticks">
        <article class="title-card title-card--${esc(motif)}" data-motif="${esc(motif)}">
          <p class="title-card-meta hud">
            <span class="chip chip--tag">${esc(c.tag)}</span>
            <span>${esc(data.kinds[c.kind])}</span>
            <span class="mute">${esc((c.date || '').split('·').pop().trim())}</span>
          </p>
          <h3 class="title-card-name" style="--chars:${Math.max(1, ...String(c.concept || '').split(/\s+/).map((word) => word.length))}">${esc(c.concept)}</h3>
          <p class="title-card-desc">${esc(c.description || c.blurb || '')}</p>
          <dl class="title-card-facts hud">
            <div><dt>Type</dt><dd>${esc(c.workType || data.kinds[c.kind])}</dd></div>
            <div><dt>When</dt><dd>${esc(c.date || '—')}</dd></div>
            <div><dt>Frames</dt><dd>${String(artifacts.length).padStart(2, '0')}</dd></div>
          </dl>
          <button type="button" class="btn title-card-open" data-open-stage data-floor-ui>${preview ? 'Explore →' : 'Open'}</button>
        </article>
      </div>`;

    const cl = { c, el: sec, dir, band, cw, ch, motif, cover: null, kids: [], bandEl, artifacts };
    clusters.set(c.id, cl);

    const tile = (f, key, x, y, w, h, extra) => {
      const plan = f.kind === 'plan';
      const fe = make(plan ? 'div' : 'a', `frame frame--${f.kind}${extra ? ` ${extra}` : ''}`);
      fe.dataset.key = key;
      Object.assign(fe.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
      if (plan) {
        fe.setAttribute('role', 'group');
        fe.setAttribute('aria-label', `${f.label}: Membership plans`);
      } else {
        fe.draggable = false;
        // Covers: no STUDIO CONCEPT scan chip over media (carousel chrome stays).
        // Kid frames keep the scan tag if they ever reappear on the floor.
        if (f.kind !== 'cover') fe.dataset.scan = c.tag;
      }
      if (preview) fe.tabIndex = -1;
      fe.innerHTML = `
        <div class="frame-body" data-scan-host>
          <div class="frame-poster" aria-hidden="true"></div>
          <div class="frame-full" aria-hidden="${plan ? 'false' : 'true'}"></div>
        </div>`;
      if (f.poster) fe.querySelector('.frame-poster').style.backgroundImage = `url("${f.poster}")`;
      const rec = {
        c, f, key, plan, el: fe,
        cover: f.kind === 'cover',
        body: fe.querySelector('.frame-body'),
        full: fe.querySelector('.frame-full'),
        x: c.x + x, y: c.y + y, w, h,
        mounted: false, vis: null, tiny: null,
      };
      if (plan) { rec.full.innerHTML = renderFrame(c, f, { home: o.home }); rec.mounted = true; }
      frames.push(rec);
      return rec;
    };

    const cov = tile({ id: 'cover', label: c.label, kind: 'cover', poster: c.poster, src: c.src }, c.id, 0, HEAD, cw, ch, `frame--motif-${motif}`);
    // Caption under the art (reference grid style); CSS hides it when zoomed out past LOD_DOWN.
    cov.el.insertAdjacentHTML('beforeend', `
      <div class="frame-caption" aria-hidden="true">
        <p class="frame-caption-text"><b>${esc(c.concept)}.</b> ${esc(c.description || c.blurb || '')}</p>
        <p class="frame-caption-meta hud"><span class="chip chip--tag">${esc(c.tag)}</span><span>${esc(data.kinds[c.kind])}</span><span class="frame-caption-open" data-flap><span class="flap">Open</span><span class="arr">→</span></span></p>
      </div>`);
    // Target acquired (play layer): while the cover is locked on, mono tags show real facts from concepts.json.
    // (2026-10-08: the lock-on chips removed; JC: "please remove the chips that appear when I hover on a portfolio item")
    cov.el.href = c.openPage && c.page ? new URL(c.page, document.baseURI).href : `${o.work}#${c.id}`;
    cov.el.setAttribute('aria-label', `${c.concept}: ${kindOf(c)}`);
    cov.el.setAttribute('aria-expanded', 'false');
    cl.cover = cov;
    sec.append(cov.el, bandEl);
    // A live 3D model on the cover (concepts.json `model3d`; 2026-10-12, the JCG Belt in the drone's cover language:
    // asleep at rest, awake on hover). The poster stays underneath until the model has loaded.
    if (c.model3d || c.embed3d) mountCover3d(cov.body, c, cov.body.querySelector('.frame-poster'));
    // A photo cover in the same HUD as the live ones (concepts.json `coverHud`: Terra and Solaris beside Etherea, JC 2026-10-19).
    else if (c.coverHud) import('./product-3d.js').then(({ hud }) => {
      const h = make('div', 'cover-3d cover-3d--photo belt3d-ready'); h.innerHTML = hud(c); cov.body.append(h);
    }).catch(() => {});
    // Cover media: manual carousel or one static/looping asset inside the cover frame.
    const coverMedia = resolveMedia(c);
    if (coverMedia.length) {
      // Dedicated slot on frame-body so living tiles stay visible in lod-poster
      // without wiping .frame-poster / .frame-full.
      cov.el.classList.add('has-media');
      const slot = document.createElement('div');
      slot.className = 'cover-media-slot';
      slot.setAttribute('role', 'group');
      slot.setAttribute('aria-label', 'Cover media');
      cov.body.append(slot);
      cl.carousel = mountCarousel(slot, coverMedia, { reduced: reduced() });
      cov.mounted = true;
    }

    kids.forEach((f) => {
      const r = tile(f, `${c.id}/${f.id}`, 0, HEAD, CELL.w, CELL.h, 'frame--kid');
      r.el.hidden = true;
      r.el.inert = true;
      if (!r.plan) {
        r.el.href = `${o.work}#${r.key}`;
        r.el.setAttribute('aria-label', `${f.label}, ${c.concept}. ${kindOf(c)}.`);
      }
      byKey.set(r.key, r);
      cl.kids.push(r);
    });

    // The whole title card opens the item (its Open button included).
    bandEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (preview && !c.openPage) {
        window.location.href = `${o.work}#${c.id}`;
        return;
      }
      if (c.openPage && c.page && preview) { window.location.href = new URL(c.page, document.baseURI).href; return; }
      openStage(c.id);   // its own page: openStage dives into the cover first
    });

    world.append(sec);
  }

  root.append(grid, world);

  /* ── Geometry ────────────────────────────────────────────────── */
  const isSheet = () => window.matchMedia('(max-width: 759px)').matches;

  function insets() {
    const base = typeof o.insets === 'function' ? o.insets() : { t: 16, r: 16, b: 16, l: 16, ...o.insets };
    if (drawerOpen && o.drawer) {
      if (isSheet()) base.b = Math.max(base.b, o.drawer.offsetHeight + 12);
      else base.r = Math.max(base.r, o.drawer.offsetWidth + 24);
    }
    return base;
  }

  function fitCam(r, pad = 48, maxS = 2) {
    const I = insets();
    const aw = Math.max(40, vw - I.l - I.r - pad * 2);
    const ah = Math.max(40, vh - I.t - I.b - pad * 2);
    const s = clamp(Math.min(aw / r.w, ah / r.h), MIN_S, maxS);
    const target = { s, x: I.l + pad + (aw - r.w * s) / 2 - r.x * s, y: I.t + pad + (ah - r.h * s) / 2 - r.y * s };
    return snapCam(target, { quantizeS: true });
  }

  // Collapsed: head + cover. Expanded: that plus the band.
  // Heads grow upward as the camera zooms out (--inv), so give them headroom.
  const conceptRect = (c) => {
    const cl = clusters.get(c.id);
    const w = cl ? cl.cw : coverOf(c).w;
    const h = cl ? cl.ch : coverOf(c).h;
    return { x: c.x - GRID, y: c.y - GRID, w: w + GRID * 2, h: HEAD + h + GRID * 2 };
  };
  function openRect(c) {
    const { band } = clusters.get(c.id);
    return boundsOf([conceptRect(c), { x: c.x + band.x - GRID, y: c.y + band.y - 8, w: band.w + GRID * 2, h: band.h + 32 }]);
  }
  function boundsOf(list) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of list) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  const allRect = () => boundsOf(data.concepts.map(conceptRect));

  // Keep the view centre inside the world; s inside [MIN_S, MAX_S].
  function clampCam(c) {
    const s = clamp(c.s, MIN_S, MAX_S);
    const cx = clamp((vw / 2 - c.x) / s, 0, W);
    const cy = clamp((vh / 2 - c.y) / s, 0, H);
    return { s, x: vw / 2 - cx * s, y: vh / 2 - cy * s };
  }

  // Soft edges while the finger is still down.
  function rubberize(c) {
    const s = clamp(c.s, MIN_S, MAX_S);
    let cx = (vw / 2 - c.x) / s;
    let cy = (vh / 2 - c.y) / s;
    if (cx < 0) cx = -rubber(-cx * s, vw) / s; else if (cx > W) cx = W + rubber((cx - W) * s, vw) / s;
    if (cy < 0) cy = -rubber(-cy * s, vh) / s; else if (cy > H) cy = H + rubber((cy - H) * s, vh) / s;
    return { s, x: vw / 2 - cx * s, y: vh / 2 - cy * s };
  }

  /* ── Render ──────────────────────────────────────────────────── */
  let dirty = false;
  function schedule() {
    if (dirty) return;
    dirty = true;
    requestAnimationFrame(() => { dirty = false; apply(); });
  }

  /* Paint-time camera: device-pixel translation so GRID-aligned world edges
     don't land between physical pixels (blur) under arbitrary zoom. */
  function paintCam(c = cam) {
    const dpr = window.devicePixelRatio || 1;
    return {
      s: c.s,
      x: Math.round(c.x * dpr) / dpr,
      y: Math.round(c.y * dpr) / dpr,
    };
  }

  /* Settle/fit: also quantize scale so GRID * s is an integer device-pixel pitch.
     Keeps every grid line (and cover edge) on a physical pixel across DPR. */
  function quantizeScale(s) {
    const dpr = window.devicePixelRatio || 1;
    const pitchDev = Math.max(1, Math.round(GRID * s * dpr));
    return clamp(pitchDev / (GRID * dpr), MIN_S, MAX_S);
  }

  function snapCam(c, { quantizeS = false } = {}) {
    const s0 = c.s;
    const s = quantizeS ? quantizeScale(s0) : s0;
    const cx = (vw / 2 - c.x) / s0;
    const cy = (vh / 2 - c.y) / s0;
    return paintCam({ s, x: vw / 2 - cx * s, y: vh / 2 - cy * s });
  }

  function apply() {
    const p = paintCam(cam);
    world.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${p.s})`;
    world.style.setProperty('--inv', (1 / p.s).toFixed(4));

    let step = GRID * p.s;
    while (step < 14) step *= 4;
    const major = step * 5;
    grid.style.backgroundSize = `${step}px ${step}px, ${major}px ${major}px`;
    grid.style.backgroundPosition =
      `${modPos(p.x, step)}px ${modPos(p.y, step)}px, ${modPos(p.x, major)}px ${modPos(p.y, major)}px`;

    const nextFull = lodFull === null ? cam.s >= LOD_DOWN : lodFull ? cam.s >= LOD_DOWN : cam.s >= LOD_UP;
    if (nextFull !== lodFull) { lodFull = nextFull; world.classList.toggle('lod-poster', !lodFull); }
    const nextFar = cam.s < FAR;
    if (nextFar !== far) { far = nextFar; world.classList.toggle('lod-far', far); }

    for (const r of frames) {
      const sx = r.x * p.s + p.x;
      const sy = r.y * p.s + p.y;
      const sw = r.w * p.s;
      const sh = r.h * p.s;
      const vis = sx < vw + CULL && sy < vh + CULL && sx + sw > -CULL && sy + sh > -CULL;
      if (vis !== r.vis) { r.vis = vis; if (!r.plan) r.el.classList.toggle('is-off', !vis); }
      const tiny = Math.min(sw, sh) < HIT;
      if (tiny !== r.tiny) { r.tiny = tiny; r.el.classList.toggle('is-tiny', tiny); }
      if (vis && lodFull && !r.mounted) mount(r);
    }

    if (o.hud.zoom) o.hud.zoom.textContent = `${Math.round(cam.s * 100)}%`;
    listeners.forEach((fn) => fn(cam));
  }

  // Grey placeholders have nothing to mount (no shimmer-as-artwork). Only real
  // media shimmers, and only until it has loaded. Covers with media[] mount their
  // carousel at build time (above); frame-level src still uses this path.
  function mount(r) {
    r.mounted = true;
    if (r.cover) return; // cover carousel already mounted (or flat grey)
    if (!r.f.src || r.el.hidden) return; // band frames stay hidden; their art shows in the item page
    shimmer(r.body, loadImage(r.f.src).then((img) => { img.alt = ''; r.full.append(img); }), 360);
  }

  /* ── Full-screen item (cover or title-card click) ───────────────────
     One morph (see morph()): the item's tile grows straight into the page's
     frame while the camera dives in (the dot grid zooms, neighbors fly off
     and fade) and the page crossfades in over the art. Close / Esc / outside
     runs it backwards to where you were. The panel lives in screen space over
     the floor, so it never scales with zoom. */
  let stageOpen = false;
  let stageId = null;
  let stageFocus = null;
  const panel = make('div', 'folio-panel');
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('data-floor-ui', '');
  panel.innerHTML = `
    <div class="folio-panel-sheet ticks">
      <button type="button" class="folio-panel-x" data-stage-close aria-label="Close portfolio item">×</button>
      <div class="folio-panel-scroll" data-stage-body tabindex="-1"></div>
      <i class="folio-panel-thumb" aria-hidden="true"></i>
    </div>`;
  const stageBody = panel.querySelector('[data-stage-body]');
  const sheet = panel.querySelector('.folio-panel-sheet');
  // Alias kept so older call sites / comments still read cleanly.
  const stage = panel;

  // One asset link. Every motif keeps data-asset-key / href / is-focus so the
  // stage click handler works unchanged; only the wrapper structure differs.
  // `chrome` adds structural furniture (browser bar) — never drawn product art.
  function assetLink(c, f, focusKey, { i = 0, chrome = '', ratio = true, cls = '', no = '' } = {}) {
    const key = `${c.id}/${f.id}`;
    const ar = (f.w / f.h).toFixed(4);
    const shape = ar >= 1.6 ? 'wide' : ar >= 1.15 ? 'land' : ar >= 0.9 ? 'square' : ar >= 0.7 ? 'portrait' : 'tall';
    const art = isArt(f.src) ? artMarkup(f.src) : (isStill(f.src) ? `<img class="concept-still" src="${esc(f.src)}" alt="">` : '');
    const view = `<span class="folio-asset-view"${ratio ? ` style="aspect-ratio:${f.w} / ${f.h}"` : ''}>${art}</span>`;
    // fa-lg: artwork drawn 560+ px wide (tables, pages), laid out bigger than sheets.
    return `
      <a class="folio-asset fa-shape--${shape}${f.w >= 560 ? ' fa-lg' : ''}${art ? ' has-art' : ''}${cls ? ` ${cls}` : ''}${focusKey === key ? ' is-focus' : ''}" href="#${esc(key)}" data-asset-key="${esc(key)}" style="--ar:${ar};--w:${f.w};--i:${i}">
        <span class="folio-asset-thumb" aria-hidden="true">${chrome}${view}</span>
        <span class="folio-asset-label hud">${esc(f.label)}${no ? `<span class="fa-swatch-no">${no}</span>` : ''}</span>
        <span class="folio-asset-note">${esc(f.note || '')}</span>
      </a>`;
  }

  // Asset section structure per layoutMotif. CSS carries the personality;
  // this only decides grouping (hero vs rail vs shelves) and chrome.
  function assetsMarkup(c, arts, focusKey, motif) {
    const link = (f, i, extra) => assetLink(c, f, focusKey, { i, ...extra });
    const all = (extra) => arts.map((f, i) => link(f, i, extra)).join('');
    const [first, ...rest] = arts;
    switch (motif) {
      case 'swatch-grid':
        return `<div class="fa-swatch">${arts.map((f, i) => link(f, i, { no: String(i + 1).padStart(2, '0') })).join('')}</div>`;
      case 'browser-stack':
        // Phones get a rounded screen instead of a desktop browser bar.
        return `<div class="fa-browser">${arts.map((f, i) => link(f, i, f.kind === 'mobile' ? { cls: 'fa-phone' }
          : { chrome: '<span class="fa-chrome"><i></i><i></i><i></i></span>' })).join('')}</div>`;
      case 'deck-spread':
        return `<div class="fa-spread" role="list">${arts.map((f, i) => `<div role="listitem" class="fa-spread-slot">${link(f, i)}</div>`).join('')}</div>`;
      case 'deck-stack':
        return `<div class="fa-stack">${all()}</div>`;
      case 'doc-rail':
        return first ? `<div class="fa-rail"><div class="fa-rail-main">${link(first, 0, { cls: 'fa-doc' })}</div><div class="fa-rail-side">${rest.map((f, i) => link(f, i + 1)).join('')}</div></div>` : '';
      case 'poster-hero':
        return first ? `<div class="fa-poster"><div class="fa-poster-hero">${link(first, 0, { cls: 'fa-hero' })}</div><div class="fa-poster-row">${rest.map((f, i) => link(f, i + 1)).join('')}</div></div>` : '';
      case 'social-mosaic':
        return `<div class="fa-mosaic">${all()}</div>`;
      case 'kit-shelf': {
        const rows = Math.max(1, Math.ceil(arts.length / 3));
        const per = Math.ceil(arts.length / rows);
        const shelves = [];
        for (let r = 0; r < rows; r++) shelves.push(arts.slice(r * per, r * per + per));
        return `<div class="fa-shelves">${shelves.map((row, r) => `
          <div class="fa-shelf">
            <div class="fa-shelf-items">${row.map((f, j) => link(f, r * per + j)).join('')}</div>
            <p class="fa-shelf-no hud" aria-hidden="true">Shelf ${String(r + 1).padStart(2, '0')}</p>
          </div>`).join('')}</div>`;
      }
      default:
        return `<div class="folio-stage-grid">${all()}</div>`;
    }
  }

  // Cover media at the top of the item. Concept art keeps the cover's own
  // shape (CSS fits it to the old 16:9 box's height) so nothing is cropped.
  function coverHero(c) {
    const media = resolveMedia(c);
    if (!media.length) return '';
    const art = media.every((m) => isArt(m.src));
    const ar = ((c.coverW || CV.w) / (c.coverH || CV.h)).toFixed(4);
    return `<div class="folio-stage-cover-media${art ? ' is-art' : ''}" data-stage-carousel${art ? ` style="--ar:${ar}"` : ''}></div>`;
  }

  // A product (concepts.json `product`, 2026-10-08): its own page. The hero is an empty stage that product-3d.js
  // flies the live model into; then what it does, its facts, its renders, and the rest of the suite.
  function productMarkup(c, focusKey) {
    const p = c.product;
    const arts = c.frames.filter((f) => f.kind !== 'plan');
    return `
      <header class="folio-stage-top folio-product-top">
        <div class="folio-product-copy">
          <p class="folio-stage-meta hud">
            <span>${esc(c.label.split(' / ')[0])}</span>
            <span class="chip chip--tag">${esc(c.tag)}</span>
            <span>${esc(data.kinds[c.kind])}</span>
          </p>
          <h2 class="folio-stage-title" id="folio-stage-title">${esc(c.concept)}</h2>
          <p class="folio-stage-member">${esc(c.lede || c.member)}</p>
          ${c.page ? `<a class="btn btn--sm folio-product-page" href="${esc(new URL(c.page, document.baseURI).href)}">${esc(c.pageLabel || 'Open the full page')} <span aria-hidden="true">→</span></a>` : ''}
        </div>
        <div class="folio-product-stage" data-product-stage="${esc(c.id)}" aria-hidden="true"></div>
      </header>
      <div class="folio-product-rows">${(p.sections || []).map((r) => `
        <section class="folio-product-row"><h3 class="hud">${esc(r.k)}</h3><p>${esc(r.v)}</p></section>`).join('')}
      </div>
      <dl class="folio-product-facts">${(p.facts || []).map(([k, v]) => `<div><dt class="hud">${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <section class="folio-stage-assets" aria-label="Renders">
        <h3 class="hud">Renders <span class="mute">· ${String(arts.length).padStart(2, '0')}</span></h3>
        ${assetsMarkup(c, arts, focusKey, 'grid')}
      </section>
      ${p.suite?.length ? `<section class="folio-product-suite" aria-labelledby="suite-${esc(c.id)}">
        <header><h3 class="hud" id="suite-${esc(c.id)}">The suite</h3><p class="mute">Everything on the belt.</p></header>
        <div class="folio-product-track">${p.suite.map(([id, name, line]) => `
          <a class="folio-product-card" href="#${esc(id)}" data-suite="${esc(id)}">
            <img src="${esc((p.suitePath || '') + id)}.jpg" alt="" loading="lazy" width="960" height="600">
            <b>${esc(name)}</b><span class="hud">${esc(line)}</span>
          </a>`).join('')}
        </div>
      </section>` : ''}
    `;
  }

  function stageMarkup(c, focusKey, motif) {
    // A live page shown inside the panel (the Etherea Loft's 3D story, JC 2026-10-19: open like every item, under the nav)
    if (c.stageEmbed) return `<iframe class="folio-stage-embed" src="${esc(new URL(c.stageEmbed, document.baseURI).href)}" title="${c.group === '719' ? '719 Studios: Etherea, Terra and Solaris' : `${esc(c.concept)}: interactive 3D model and story`}" allow="fullscreen"></iframe>`;
    if (c.product) return productMarkup(c, focusKey);
    const arts = c.frames.filter((f) => f.kind !== 'plan');
    return `
      <header class="folio-stage-top">
        <p class="folio-stage-meta hud">
          <span>${esc(c.id.toUpperCase())}</span>
          <span class="chip chip--tag">${esc(c.tag)}</span>
          <span>${esc(data.kinds[c.kind])}</span>
        </p>
        <h2 class="folio-stage-title" id="folio-stage-title">${esc(c.concept)}</h2>
        <p class="folio-stage-member">${esc(c.member)}</p>
        <dl class="folio-stage-facts hud">
          <div><dt>Type</dt><dd>${esc(c.workType || data.kinds[c.kind])}</dd></div>
          <div><dt>When</dt><dd>${esc(c.date || '—')}</dd></div>
        </dl>
      </header>
      <p class="folio-stage-desc">${esc(c.description || c.blurb || '')}</p>
      <blockquote class="folio-stage-ask">“${esc(c.asked)}”</blockquote>
      <section class="folio-stage-shipped" aria-label="Shipped">
        <h3 class="hud">Shipped</h3>
        <ul>${(c.shipped || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </section>
      ${c.moves?.length ? `<section class="folio-stage-moves" aria-label="How it came together">
        <h3 class="hud">How it came together</h3>
        <ol>${c.moves.map((m) => `<li><h4>${esc(m.k)}</h4><p>${esc(m.v)}</p></li>`).join('')}</ol>
      </section>` : ''}
      <section class="folio-stage-assets" aria-label="Assets">
        <h3 class="hud">Assets <span class="mute">· ${String(arts.length).padStart(2, '0')}${arts.every((f) => hasAsset(f.src)) ? '' : ' · placeholder'}</span></h3>
        ${coverHero(c)}
        ${assetsMarkup(c, arts, focusKey, motif)}
      </section>
    `;
  }

  let stageMotif = null;
  function setStageMotif(m) {
    if (stageMotif) panel.classList.remove(`folio-stage--${stageMotif}`);
    stageMotif = m;
    if (m) { panel.classList.add(`folio-stage--${m}`); panel.dataset.motif = m; }
    else delete panel.dataset.motif;
  }

  // Dive target: the camera that makes the cover's art (not its caption) fill
  // the item panel's rect, centred on it.
  function diveCam(cl) {
    const p = panel.getBoundingClientRect();
    const aw = cl.cw, ah = cl.ch - CAPTION;
    const s = clamp(Math.max(p.width / aw, p.height / ah), MIN_S, MAX_S);
    const cx = p.left - rootRect.left + p.width / 2, cy = p.top - rootRect.top + p.height / 2;
    return { s, x: cx - (cl.c.x + aw / 2) * s, y: cy - (cl.c.y + HEAD + ah / 2) * s };
  }

  // The item morph: one rect R eases from the cover tile's on-screen rect to
  // the page's frame (open) or back (close). The camera dives along the same
  // curve; the cover is clipped to R in its own world units and the page to R
  // in panel units, so the item reads as one shape. The page crossfades in
  // over the last 40% (out over the first 40% on close). A morph started
  // mid-flight picks up from the current rect and fade, so nothing jumps.
  let morphing = null; // { R, op, cancel } while a morph runs
  function morph(cl, to, opening, done) {
    const running = morphing && { R: morphing.R, op: morphing.op };
    stopMotion();
    rootRect = root.getBoundingClientRect();
    const P = panel.getBoundingClientRect();
    const page = { x: P.left, y: P.top, w: P.width, h: P.height };
    const tileAt = (c) => ({
      x: rootRect.left + c.x + cl.c.x * c.s,
      y: rootRect.top + c.y + (cl.c.y + HEAD) * c.s,
      w: cl.cw * c.s,
      h: cl.ch * c.s,
    });
    const from = { ...cam };
    const target = clampCam(to);
    const R0 = running ? running.R : opening ? tileAt(from) : page;
    const R1 = opening ? page : tileAt(target);
    const op0 = running ? running.op : opening ? 0 : 1;
    const px = vw / 2, py = vh / 2;
    const fc = { x: (px - from.x) / from.s, y: (py - from.y) / from.s };
    const tc = { x: (px - target.x) / target.s, y: (py - target.y) / target.s };
    const l0 = Math.log(from.s), l1 = Math.log(target.s);
    const lerp = (a, b, e) => a + (b - a) * e;
    const cover = cl.cover.el;
    const clear = () => { cover.style.clipPath = ''; sheet.style.clipPath = ''; sheet.style.opacity = ''; };
    // A close cut short (Back fires popstate + hashchange, the second flies the camera) still puts the panel away.
    const state = { R: R0, op: op0, cancel: () => { morphing = null; if (!opening) done?.(); clear(); } };
    const frame = (e) => {
      cam.s = Math.exp(lerp(l0, l1, e));
      cam.x = px - lerp(fc.x, tc.x, e) * cam.s;
      cam.y = py - lerp(fc.y, tc.y, e) * cam.s;
      apply();
      const R = { x: lerp(R0.x, R1.x, e), y: lerp(R0.y, R1.y, e), w: lerp(R0.w, R1.w, e), h: lerp(R0.h, R1.h, e) };
      const T = tileAt(cam), k = 1 / cam.s;
      cover.style.clipPath = `inset(${(R.y - T.y) * k}px ${(T.x + T.w - R.x - R.w) * k}px ${(T.y + T.h - R.y - R.h) * k}px ${(R.x - T.x) * k}px)`;
      const z = (n) => Math.max(0, n);
      sheet.style.clipPath = `inset(${z(R.y - P.top)}px ${z(P.right - R.x - R.w)}px ${z(P.bottom - R.y - R.h)}px ${z(R.x - P.left)}px)`;
      const op = opening ? lerp(op0, 1, clamp((e - 0.6) / 0.4, 0, 1)) : op0 * clamp(1 - e / 0.4, 0, 1);
      sheet.style.opacity = op.toFixed(3);
      state.R = R; state.op = op;
    };
    morphing = state;
    frame(0);
    const t0 = performance.now();
    moving(true);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / DIVE_MS);
      frame(easeInOut(t));
      if (t < 1) { flyRaf = requestAnimationFrame(step); return; }
      flyRaf = 0;
      morphing = null;
      done?.(); // runs before the clips clear, so the hand-off never flashes
      clear();
      setCam(target, { snap: true });
      settle();
    };
    flyRaf = requestAnimationFrame(step);
  }

  // A slim HUD thumb instead of the browser's scrollbar: it shows while the
  // item scrolls (and briefly on open when there's more below), then fades.
  const thumb = panel.querySelector('.folio-panel-thumb');
  const THUMB_TOP = 64;    // clears the × button
  const THUMB_BOTTOM = 12;
  let thumbTimer = 0;
  function syncThumb() {
    const { scrollTop, scrollHeight, clientHeight } = stageBody;
    thumb.hidden = scrollHeight <= clientHeight + 1;
    if (thumb.hidden) return;
    const track = clientHeight - THUMB_TOP - THUMB_BOTTOM;
    const h = Math.max(24, (clientHeight / scrollHeight) * track);
    const y = THUMB_TOP + (scrollTop / (scrollHeight - clientHeight)) * (track - h);
    thumb.style.height = `${h.toFixed(1)}px`;
    thumb.style.transform = `translateY(${y.toFixed(1)}px)`;
    thumb.classList.add('is-on');
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(() => thumb.classList.remove('is-on'), 900);
  }
  stageBody.addEventListener('scroll', syncThumb, { passive: true });

  // An item that is its own page (ORBIT, the Etherea Loft): the same dive (DIVE_MS, ease in-out, log-scale zoom, the
  // neighbours fade) until the cover's art fills the screen, then the page loads from there, so opening still reads as
  // diving into the cover (JC 2026-10-16: "we seem to have lost the way we designed the portfolio items to open").
  // Back (bfcache) puts the floor as it was.
  function diveToPage(cl) {
    const url = new URL(cl.c.page, document.baseURI).href;
    if (reduced()) { window.location.href = url; return; }
    stopMotion();
    rootRect = root.getBoundingClientRect();
    const back = { ...cam };
    world.classList.add('has-solo');
    clusters.forEach((other) => {
      other.el.classList.toggle('is-exiting', other !== cl);
      other.el.classList.toggle('is-solo', other === cl);
      other.el.classList.remove('is-hot');
    });
    const aw = cl.cw, ah = cl.ch - CAPTION;
    const s1 = Math.min(MAX_S, Math.max(vw / aw, vh / ah));
    const from = { ...cam }, px = vw / 2, py = vh / 2;
    const fc = { x: (px - from.x) / from.s, y: (py - from.y) / from.s };
    const tc = { x: cl.c.x + aw / 2, y: cl.c.y + HEAD + ah / 2 };
    const l0 = Math.log(from.s), l1 = Math.log(s1), t0 = performance.now();
    moving(true);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / DIVE_MS), e = easeInOut(t);
      cam.s = Math.exp(l0 + (l1 - l0) * e);
      cam.x = px - (fc.x + (tc.x - fc.x) * e) * cam.s;
      cam.y = py - (fc.y + (tc.y - fc.y) * e) * cam.s;
      apply();
      if (t < 1) { flyRaf = requestAnimationFrame(step); return; }
      flyRaf = 0;
      window.location.href = url;
    };
    flyRaf = requestAnimationFrame(step);
    window.addEventListener('pageshow', (ev) => {
      if (!ev.persisted) return;
      world.classList.remove('has-solo');
      clusters.forEach((other) => other.el.classList.remove('is-exiting', 'is-solo'));
      setCam(back, { snap: true }); settle();
    }, { once: true });
  }

  function openStage(id, focusKey = null, { hash = true } = {}) {
    const cl = clusters.get(id);
    if (!cl || preview) return;
    if (cl.c.openPage && cl.c.page) { diveToPage(cl); return; }
    // One page, several items (concepts.json `group`, JC 2026-10-19: Etherea, Terra and Solaris share the 719 Studios
    // page). With a sibling already open, the page stays and switches studio; the hash moves so Back walks the switches.
    const was = stageOpen && stageId && stageId !== id ? clusters.get(stageId) : null;
    if (was && cl.c.group && was.c.group === cl.c.group) {
      was.el.classList.remove('is-open', 'is-solo', 'is-solo-open'); was.el.classList.add('is-exiting');
      was.cover.el.classList.remove('is-under-solo'); was.cover.el.setAttribute('aria-expanded', 'false');
      cl.el.classList.remove('is-exiting'); cl.el.classList.add('is-open', 'is-solo', 'is-solo-open');
      cl.cover.el.classList.add('is-under-solo'); cl.cover.el.setAttribute('aria-expanded', 'true');
      open = id; stageId = id;
      try { stageBody.querySelector('.folio-stage-embed')?.contentWindow?.postMessage({ type: 'studio:show', id }, location.origin); } catch (e) {}
      if (hash && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
      if (o.hud.live) o.hud.live.textContent = `Showing ${cl.c.concept}.`;
      return;
    }
    cl.el.dispatchEvent(new CustomEvent('floor:open', { bubbles: true, detail: { id } }));
    expand(id);
    stopMotion();
    rootRect = root.getBoundingClientRect();

    // Neighbors fade as the dive flings them off-screen.
    world.classList.add('has-solo');
    document.documentElement.classList.add('solo-open');
    clusters.forEach((other, oid) => {
      const solo = oid === id;
      other.el.classList.toggle('is-exiting', !solo);
      other.el.classList.toggle('is-solo', solo);
      other.el.classList.toggle('is-solo-open', solo);
      other.el.classList.remove('is-hot');
    });
    // Title-card band yields to the panel (same concept, richer content).
    cl.bandEl?.setAttribute('aria-hidden', 'true');

    stageId = id;
    stageFocus = focusKey;
    setStageMotif(cl.motif);
    panel.classList.toggle('folio-panel--embed', !!cl.c.stageEmbed);
    if (panel.parentElement !== root) root.append(panel);
    stageBody.innerHTML = stageMarkup(cl.c, focusKey, cl.motif);
    hydrateArt(stageBody);
    const stageHost = stageBody.querySelector('[data-stage-carousel]');
    if (stageHost) {
      cl.stageCarousel?.destroy?.();
      cl.stageCarousel = mountCarousel(stageHost, resolveMedia(cl.c), { reduced: reduced() });
    }
    panel.setAttribute('aria-labelledby', 'folio-stage-title');
    panel.hidden = false;
    thumb.hidden = true;
    // Morph the tile into the page; the cover hides once the page covers it.
    const hideCover = () => cl.cover.el.classList.add('is-under-solo');
    if (reduced()) hideCover();
    else morph(cl, diveCam(cl), true, hideCover);
    void panel.offsetWidth;
    panel.classList.add('is-open');
    setTimeout(() => {
      if (!stageOpen || stageId !== id) return;
      syncThumb();
      // An embedded viewer (Etherea) refits to the full-screen panel once the morph lands.
      try { stageBody.querySelector('.folio-stage-embed')?.contentWindow?.dispatchEvent(new Event('resize')); } catch (e) {}
    }, DIVE_MS + 200);
    stageOpen = true;
    if (hash) {
      const h = focusKey ? `#${focusKey}` : `#${id}`;
      if (location.hash !== h) history.pushState(null, '', h);
    }
    if (o.hud.live) o.hud.live.textContent = `Opened ${cl.c.concept} on the canvas.`;
    stageBody.scrollTo(0, 0);
    const focusEl = focusKey && stageBody.querySelector('[data-asset-key="' + focusKey.replace(/"/g, '') + '"]');
    (panel.querySelector('[data-stage-close]') || stageBody).focus?.({ preventScroll: true });
    if (focusEl) focusEl.setAttribute('aria-current', 'true');
  }

  function closeStage(user = true) {
    if (!stageOpen) return;
    stageOpen = false;
    const id = stageId;
    const cl = id ? clusters.get(id) : null;
    // The morph runs backwards and flies the camera home itself.
    const home = savedCam;
    savedCam = null;
    panel.classList.remove('is-open');
    world.classList.remove('has-solo');
    document.documentElement.classList.remove('solo-open');
    clusters.forEach((other) => {
      other.el.classList.remove('is-exiting', 'is-solo', 'is-solo-open');
      other.cover.el.classList.remove('is-under-solo');
    });
    if (cl && open === id) cl.bandEl?.removeAttribute('aria-hidden');
    if (id) clusters.get(id)?.stageCarousel?.destroy?.();
    if (id && clusters.get(id)) clusters.get(id).stageCarousel = null;
    stageId = null;
    stageFocus = null;
    const hidePanel = () => {
      if (stageOpen) return;
      panel.hidden = true;
      setStageMotif(null);
      if (panel.parentElement) panel.remove();
    };
    if (cl && !reduced()) morph(cl, home || cam, false, hidePanel);
    else { hidePanel(); if (home) setCam(home); }
    // Collapse clears the hash and returns key focus (the morph owns the camera).
    if (user && id) collapse(true);
  }

  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-stage-close]')) { closeStage(true); return; }
    const asset = e.target.closest('[data-asset-key]');
    if (asset) {
      e.preventDefault();
      stageBody.querySelectorAll('.folio-asset').forEach((n) => n.classList.toggle('is-focus', n === asset));
      const key = asset.dataset.assetKey;
      stageFocus = key;
      if (location.hash !== `#${key}`) history.pushState(null, '', `#${key}`);
    }
  });

  /* ── Expand: the open cluster ───────────────────────────────────
     Only the full-screen item opens one now (openStage); captions carry the
     info on the floor, so the title-card band is never shown there. Esc /
     Close / outside restores the camera from before the item opened. */
  let open = null;        // expanded cluster id
  let savedCam = null;    // camera before the item opened — restored on collapse

  // Fit open cover+band so the title card paints ~half the viewport (readable, sexy).
  const titleFitCam = (c) => fitCam(openRect(c), 56, 2.2);

  function expand(id) {
    const cl = clusters.get(id);
    if (!cl) return;
    if (open !== id) {
      // Switch clusters without restoring — savedCam stays the pre-open view.
      if (open) collapse(false, { restore: false });
      if (!savedCam) savedCam = { x: cam.x, y: cam.y, s: cam.s };
      open = id;
      cl.el.classList.add('is-open');
      world.classList.add('has-open');
      cl.cover.el.setAttribute('aria-expanded', 'true');
      cl.bandEl?.removeAttribute('aria-hidden');
      if (o.hud.live) o.hud.live.textContent = `${cl.c.concept}: title card.`;
      schedule();
    }
  }

  function collapse(user = false, { restore = true } = {}) {
    if (!open) return;
    const cl = clusters.get(open);
    if (stageOpen) closeStage(false);
    if (selected && selected.c.id === open) closeDrawer(false);
    open = null;
    cl.el.classList.remove('is-open');
    world.classList.remove('has-open');
    cl.cover.el.setAttribute('aria-expanded', 'false');
    cl.bandEl?.setAttribute('aria-hidden', 'true');
    const prior = savedCam;
    if (restore) savedCam = null;
    if (user) {
      if (!preview && location.hash.replace(/^#/, '').split('/')[0] === cl.c.id) history.replaceState(null, '', location.pathname + location.search);
      if (o.hud.live) o.hud.live.textContent = `${cl.c.concept} closed.`;
      if (lastInput === 'key') cl.cover.el.focus({ preventScroll: true });
    }
    schedule();
    if (restore && prior) flyTo(prior);
  }

  /* ── Motion ──────────────────────────────────────────────────── */
  let flyRaf = 0;
  let inertiaRaf = 0;
  let movingTimer = 0;

  function moving(on) {
    clearTimeout(movingTimer);
    if (on) world.classList.add('is-moving');
    else movingTimer = setTimeout(() => world.classList.remove('is-moving'), 140);
  }

  function stopMotion() {
    cancelAnimationFrame(flyRaf);
    cancelAnimationFrame(inertiaRaf);
    flyRaf = inertiaRaf = 0;
    morphing?.cancel();
  }

  function setCam(c, { snap = false } = {}) {
    Object.assign(cam, snap ? snapCam(c, { quantizeS: true }) : c);
    raw = { ...cam };
    schedule();
  }

  function flyTo(target, ms = FLY_MS) {
    stopMotion();
    target = clampCam(target);
    if (reduced() || ms === 0) { setCam(target); settle(); return; }
    const from = { ...cam };
    const px = vw / 2, py = vh / 2;
    const fc = { x: (px - from.x) / from.s, y: (py - from.y) / from.s };
    const tc = { x: (px - target.x) / target.s, y: (py - target.y) / target.s };
    const l0 = Math.log(from.s), l1 = Math.log(target.s);
    const t0 = performance.now();
    moving(true);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      const e = easeOut(t);
      const s = Math.exp(l0 + (l1 - l0) * e);
      cam.s = s;
      cam.x = px - (fc.x + (tc.x - fc.x) * e) * s;
      cam.y = py - (fc.y + (tc.y - fc.y) * e) * s;
      apply();
      if (t < 1) flyRaf = requestAnimationFrame(step);
      else { flyRaf = 0; setCam(target, { snap: true }); settle(); }
    };
    flyRaf = requestAnimationFrame(step);
  }

  function inertia(vx, vy) {
    let last = performance.now();
    moving(true);
    const step = (now) => {
      const dt = Math.min(32, now - last);
      last = now;
      cam.x += vx * dt;
      cam.y += vy * dt;
      const decay = Math.pow(0.94, dt / 16);
      vx *= decay;
      vy *= decay;
      const hard = clampCam(cam);
      const hit = Math.abs(hard.x - cam.x) > 0.5 || Math.abs(hard.y - cam.y) > 0.5;
      if (hit) { Object.assign(cam, hard); vx = vy = 0; }
      apply();
      if (Math.hypot(vx, vy) > 0.015) inertiaRaf = requestAnimationFrame(step);
      else { inertiaRaf = 0; raw = { ...cam }; settle(); }
    };
    inertiaRaf = requestAnimationFrame(step);
  }

  let lastSpoken = -1;
  let speakTimer = 0;
  function settle() {
    moving(false);
    // Pixel-lock after pan/zoom/inertia so cover edges sit on device pixels.
    Object.assign(cam, snapCam(clampCam(cam), { quantizeS: true }));
    raw = { ...cam };
    schedule();
    clearTimeout(speakTimer);
    speakTimer = setTimeout(() => {
      const pct = Math.round(cam.s * 100);
      if (o.hud.live && pct !== lastSpoken && !drawerOpen) {
        lastSpoken = pct;
        o.hud.live.textContent = `Zoom ${pct} percent`;
      }
    }, 500);
  }

  function zoomAt(px, py, k, ms = 0) {
    const s = clamp(cam.s * k, MIN_S, MAX_S);
    const target = { s, x: px - (px - cam.x) * (s / cam.s), y: py - (py - cam.y) * (s / cam.s) };
    if (ms) flyTo(target, ms);
    else { setCam(clampCam(target)); moving(true); settle(); }
  }

  function zoomBy(k) {
    const I = insets();
    zoomAt(I.l + (vw - I.l - I.r) / 2, I.t + (vh - I.t - I.b) / 2, k, 240);
  }

  const fitAll = (fly = true) => flyTo(fitCam(allRect(), 40, 1), fly ? FLY_MS : 0);
  // An item centred at 100%, or fitted when the screen is too small for that.
  const itemCam = (id) => fitCam(conceptRect(clusters.get(id).c), 24, 1);
  // Landing view (2026-10-08, JC: "default zoom ... about what you see in this pic": a moodboard where three and a bit
  // covers sit across the screen). Covers land about 27% of the width on desktop, 42% on a tablet, 78% on a phone; the
  // start concept (layout.start, else the first) sits top left with a gutter, or centred across on a phone.
  const startCam = () => {
    const id = clusters.has(data.layout.start) ? data.layout.start : clusters.keys().next().value;
    const c = clusters.get(id).c;
    const I = insets();
    const frac = vw >= 900 ? 0.27 : vw >= 600 ? 0.42 : 0.78;
    const s = clamp((vw * frac) / coverOf(c).w, MIN_S, 1);
    // When every cover fits across the screen (one item on the public site, 2026-10-19: "center the 719 cover"), the
    // whole set sits centred instead of top left.
    const all = allRect(), aw = vw - I.l - I.r, ah = vh - I.t - I.b;
    if (all.w * s <= aw) {
      const y = all.h * s <= ah ? I.t + (ah - all.h * s) / 2 - all.y * s : I.t + 24 - c.y * s;
      return snapCam({ s, x: I.l + (aw - all.w * s) / 2 - all.x * s, y }, { quantizeS: true });
    }
    const x = vw >= 600 ? I.l + 32 - (c.x - GRID * 2) * s : (vw - coverOf(c).w * s) / 2 - c.x * s;
    return snapCam({ s, x, y: I.t + 24 - c.y * s }, { quantizeS: true });
  };
  function fitConcept(id, fly = true) {
    const cl = clusters.get(id);
    if (!cl) return;
    // Title card → ~half viewport; else the cover.
    const target = open === id ? titleFitCam(cl.c) : fitCam(conceptRect(cl.c), 56, 2.2);
    flyTo(target, fly ? FLY_MS : 0);
  }

  /* ── Pointer: pan, pinch, click-vs-drag ──────────────────────── */
  const pts = new Map();
  let drag = null;
  let pinch = null;
  let suppress = false;
  let lastTap = { t: 0, x: 0, y: 0 };

  const local = (e) => ({ x: e.clientX - rootRect.left, y: e.clientY - rootRect.top });

  function pinchState() {
    const [a, b] = [...pts.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }

  root.addEventListener('pointerdown', (e) => {
    if (!unlocked || view !== 'canvas') return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    if (e.target.closest('[data-floor-ui]')) return;
    stopMotion();
    rootRect = root.getBoundingClientRect();
    suppress = false;
    const p = local(e);
    pts.set(e.pointerId, p);
    raw = { ...cam };
    if (pts.size === 1) {
      drag = { id: e.pointerId, moved: false, sx: p.x, sy: p.y, type: e.pointerType, samples: [{ t: e.timeStamp, x: p.x, y: p.y }] };
    } else if (pts.size === 2) {
      pinch = pinchState();
      for (const id of pts.keys()) { try { root.setPointerCapture(id); } catch (_) { /* pointer gone */ } }
      if (drag) drag.moved = true;
      moving(true);
    }
  });

  root.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || stageOpen) return; // camera locked under an open item
    const p = local(e);
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, p);

    if (pts.size >= 2 && pinch) {
      const now = pinchState();
      const k = now.d / pinch.d;
      const s = clamp(raw.s * k, MIN_S, MAX_S);
      raw.x = now.m.x - (pinch.m.x - raw.x) * (s / raw.s);
      raw.y = now.m.y - (pinch.m.y - raw.y) * (s / raw.s);
      raw.s = s;
      pinch = now;
      Object.assign(cam, rubberize(raw));
      schedule();
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved) {
      if (Math.hypot(p.x - drag.sx, p.y - drag.sy) < (drag.type === 'mouse' ? 4 : 8)) return;
      drag.moved = true;
      try { root.setPointerCapture(e.pointerId); } catch (_) { /* pointer gone */ }
      root.classList.add('is-panning');
      moving(true);
    }
    raw.x += p.x - prev.x;
    raw.y += p.y - prev.y;
    Object.assign(cam, rubberize(raw));
    drag.samples.push({ t: e.timeStamp, x: p.x, y: p.y });
    while (drag.samples.length > 2 && e.timeStamp - drag.samples[0].t > 100) drag.samples.shift();
    schedule();
  });

  function release(withInertia, samples, t) {
    root.classList.remove('is-panning');
    const hard = clampCam(cam);
    if (Math.abs(hard.x - cam.x) > 0.5 || Math.abs(hard.y - cam.y) > 0.5 || Math.abs(hard.s - cam.s) > 0.001) {
      flyTo(hard, 320);
      return;
    }
    raw = { ...cam };
    // Throw only if the pointer was still moving when let go (a move in its last 60 ms); held still, the samples are stale.
    if (withInertia && !reduced() && samples && samples.length > 1 && t - samples[samples.length - 1].t < 60) {
      const a = samples[0];
      const b = samples[samples.length - 1];
      const dt = Math.max(1, b.t - a.t);
      const vx = (b.x - a.x) / dt;
      const vy = (b.y - a.y) / dt;
      if (Math.hypot(vx, vy) > 0.08) { inertia(vx, vy); return; }
    }
    settle();
  }

  function endPointer(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pinch) {
      if (pts.size === 1) {
        const [id, p] = [...pts.entries()][0];
        drag = { id, moved: true, sx: p.x, sy: p.y, type: 'touch', samples: [] };
        pinch = null;
        raw = { ...cam };
      } else if (pts.size === 0) {
        pinch = null;
        drag = null;
        suppress = true;
        release(false);
      }
      return;
    }
    if (drag && drag.id === e.pointerId) {
      const d = drag;
      drag = null;
      if (d.moved) { suppress = true; release(e.type === 'pointerup', d.samples, e.timeStamp); return; }
      // Tap / click on empty floor: close solo panel first, else collapse title card.
      if (!preview && open && e.type === 'pointerup' && !e.target.closest('.cluster, [data-floor-ui]')) {
        if (stageOpen) closeStage(true);
        else collapse(true);
      }
      // Double-tap on empty floor zooms in at the tap (touch only; mouse uses dblclick).
      if (d.type !== 'mouse' && !e.target.closest('.frame')) {
        const p = local(e);
        const now = e.timeStamp;
        if (now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 24) { zoomAt(p.x, p.y, 2, 240); lastTap.t = 0; }
        else lastTap = { t: now, x: p.x, y: p.y };
      }
    }
  }
  root.addEventListener('pointerup', endPointer);
  root.addEventListener('pointercancel', endPointer);

  root.addEventListener('click', (e) => {
    if (suppress) { e.preventDefault(); e.stopPropagation(); suppress = false; }
  }, true);

  root.addEventListener('dblclick', (e) => {
    if (!unlocked || preview || stageOpen || e.target.closest('.frame')) return;
    rootRect = root.getBoundingClientRect();
    const p = local(e);
    zoomAt(p.x, p.y, e.shiftKey ? 0.5 : 2, 240);
  });

  world.addEventListener('dragstart', (e) => e.preventDefault());

  // Frame selection (full mode). Preview frames are plain links into /work.
  world.addEventListener('click', (e) => {
    if (preview) return;
    const link = e.target.closest('a');
    if (!link || link.hasAttribute('data-world-link')) return;
    const fe = link.closest('.frame');
    if (!fe || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const r = frames.find((x) => x.el === fe);
    if (r.tiny && e.detail > 0) {
      rootRect = root.getBoundingClientRect();
      const p = local(e);
      zoomAt(p.x, p.y, 2.5, 240);
      return;
    }
    // Cover: click/tap/Enter opens the full-screen item; with one open, closes it. On a touch screen the first tap locks
    // on (brackets, a scan, the facts) and the second opens: a phone has no hover to say "this opens" first.
    if (r.cover) {
      const cl = clusters.get(r.c.id);
      if (stageOpen) closeStage(true);
      else if ((coverPointer === 'touch' || coverPointer === 'pen') && e.detail > 0 && cl && !cl.el.classList.contains('is-hot')) {
        clusters.forEach((other) => { if (other !== cl) lockOn(other, false); });
        lockOn(cl, true, coverPointer);
      }
      else openStage(r.c.id);
      return;
    }
    go(`#${r.key}`, { kb: e.detail === 0 });
  });

  // Tile hover (mouse) and key focus: a HUD lock-on that says "this opens".
  // The corner ticks snap in (CSS on .is-hot), a scanline sweeps the art and
  // the caption flips to Open →.
  initSplitFlap(world);
  // Each lock-on tells the page (floor:lock, a block in play.js), whatever the input: mouse, keys or a first tap.
  function lockOn(cl, on, how = '') {
    cl.el.classList.toggle('is-hot', on);
    cl.lockedBy = on ? how : '';
    if (!on) return;
    scan(cl.cover.el);
    cl.cover.el.querySelector('.frame-caption-open')?.flap?.();
    cl.cover.el.dispatchEvent(new CustomEvent('floor:lock', { bubbles: true, detail: { id: cl.cover.c.id, how } }));
  }
  clusters.forEach((cl) => {
    const cover = cl.cover.el;
    cover.addEventListener('pointerdown', (e) => { coverPointer = e.pointerType; });
    cover.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' && !stageOpen && !drag?.moved) lockOn(cl, true, 'mouse');
    });
    cover.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') lockOn(cl, false); });   // a lifted finger leaves too: touch keeps its lock
    cover.addEventListener('focus', () => { if (cover.matches(':focus-visible') && !stageOpen) lockOn(cl, true, 'key'); });
    cover.addEventListener('blur', () => { if (cl.lockedBy !== 'touch' && cl.lockedBy !== 'pen') lockOn(cl, false); });
  });
  // A touch anywhere else lets a touch lock go.
  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    clusters.forEach((cl) => { if (cl.el.classList.contains('is-hot') && !cl.cover.el.contains(e.target)) lockOn(cl, false); });
  }, true);

  // Scanline Reveal on frame hover (mouse, not mid-pan).
  let hoverEl = null;
  world.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || drag?.moved) return;
    const fe = e.target.closest('.frame[data-scan]');
    if (fe && fe !== hoverEl && !fe.classList.contains('is-loading')) scan(fe);
    hoverEl = fe;
  });

  /* ── Wheel / trackpad (full mode only; the preview never captures) ── */
  if (!preview) {
    root.addEventListener('wheel', (e) => {
      if (view !== 'canvas') return;
      // Native scroll inside the open item; the floor stays put around it.
      if (e.target.closest('[data-stage-body], .folio-panel-scroll')) return;
      e.preventDefault();
      if (stageOpen) return;
      stopMotion();
      rootRect = root.getBoundingClientRect();
      let dx = e.deltaX, dy = e.deltaY;
      if (e.deltaMode === 1) { dx *= 16; dy *= 16; } else if (e.deltaMode === 2) { dx *= vw; dy *= vh; }
      if (e.ctrlKey || e.metaKey) {
        const p = local(e);
        zoomAt(p.x, p.y, Math.exp(-clamp(dy, -50, 50) * 0.0075)); // cap mouse-wheel notches; trackpads send small deltas
      } else {
        if (e.shiftKey && !dx) { dx = dy; dy = 0; }
        setCam(clampCam({ s: cam.s, x: cam.x - dx, y: cam.y - dy }));
        moving(true);
        settle();
      }
    }, { passive: false });

    // Safari trackpad pinch arrives as gesture events.
    let g0 = 1;
    root.addEventListener('gesturestart', (e) => { e.preventDefault(); g0 = cam.s; });
    root.addEventListener('gesturechange', (e) => {
      e.preventDefault();
      if (stageOpen) return;
      if (pts.size >= 2) return; // touch pinch already handled by pointers
      rootRect = root.getBoundingClientRect();
      const p = local(e);
      zoomAt(p.x, p.y, (g0 * e.scale) / cam.s);
    });
  }

  /* ── Keyboard ────────────────────────────────────────────────── */
  document.addEventListener('keydown', () => { lastInput = 'key'; }, true);
  document.addEventListener('pointerdown', () => { lastInput = 'pointer'; }, true);

  function onKey(e) {
    if (view !== 'canvas' || e.defaultPrevented) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (preview && !(unlocked && (o.keyScope || root).contains(document.activeElement))) return;
    const inDrawer = o.drawer && o.drawer.contains(e.target);
    const k = e.key;
    if (k === 'Escape') {
      if (stageOpen) { e.preventDefault(); closeStage(true); }
      else if (drawerOpen) { e.preventDefault(); closeDrawer(true); }
      else if (open) { e.preventDefault(); collapse(true); }
      else if (preview && unlocked) { e.preventDefault(); lock(); }
      return;
    }
    if (inDrawer || stageOpen || e.metaKey || e.ctrlKey || e.altKey) return; // arrows scroll an open item
    const step = e.shiftKey ? 240 : 64;
    const pan = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[k];
    if (pan) {
      e.preventDefault();
      stopMotion();
      setCam(clampCam({ s: cam.s, x: cam.x + pan[0], y: cam.y + pan[1] }));
      settle();
    } else if (k === '+' || k === '=') { e.preventDefault(); zoomBy(1.25); }
    else if (k === '-' || k === '_') { e.preventDefault(); zoomBy(0.8); }
    else if (k === '0' && !preview) { e.preventDefault(); fitAll(); }
  }
  document.addEventListener('keydown', onKey);

  // Camera follows keyboard focus through frames (Tab walks reading order).
  world.addEventListener('focusin', (e) => {
    if (lastInput !== 'key' || preview || morphing) return;
    const fe = e.target.closest('.frame');
    if (!fe) return;
    const r = frames.find((x) => x.el === fe);
    const I = insets();
    const sx = r.x * cam.s + cam.x, sy = r.y * cam.s + cam.y;
    const inView = sx >= I.l && sy >= I.t && sx + r.w * cam.s <= vw - I.r && sy + r.h * cam.s <= vh - I.b;
    if (!inView || r.tiny) flyTo(fitCam(r, 72, Math.max(cam.s, 0.7)));
  });

  /* ── Routing: #sc-01 · #sc-01/tokens · #index ────────────────── */
  function go(hash, { kb = false } = {}) {
    if (location.hash !== hash) history.pushState(null, '', hash);
    route(hash, { kb });
  }

  function route(hash, { fly = true, kb = false } = {}) {
    const h = decodeURIComponent((hash || '').replace(/^#/, ''));
    if (h === 'index') { setView('index', fly); return; }
    if (view !== 'canvas') setView('canvas', false);
    const [cid, fid] = h.split('/');
    const r = byKey.get(h);
    if (r && !r.plan) {
      if (!stageOpen) flyTo(itemCam(r.c.id), 0);
      openStage(r.c.id, r.key, { hash: false });
      return;
    }
    closeDrawer(false);
    const sib = stageOpen && cid && clusters.get(cid)?.c.group && clusters.get(cid).c.group === clusters.get(stageId)?.c.group;   // a sibling switches in place
    if (stageOpen && cid && stageId !== cid && !sib) closeStage(false);
    if (clusters.has(cid)) {
      // Concept hash = the full-screen item, same as a cover click (keeps one
      // already open). Frame hashes open/focus it too. Esc/closeStage handles exit.
      // Deep links / history: centre the item first, so closing lands somewhere sensible.
      if (!(stageOpen && stageId === cid)) {
        if (!stageOpen) flyTo(itemCam(cid), 0);
        openStage(cid, null, { hash: false });
      }
    } else if (!h) {
      // Bare floor: back to the view an item was opened from, else the landing view.
      // Read before closeStage clears it, so Back runs the item's own close morph instead of cutting it off mid-way.
      const back = savedCam;
      if (stageOpen) closeStage(false);
      collapse();
      if (!back) flyTo(startCam(), fly ? FLY_MS : 0);
    }
  }

  function select(r) {
    openStage(r.c.id, r.plan ? null : r.key);
  }

  /* ── Drawer ──────────────────────────────────────────────────── */
  const drawer = o.drawer;
  const drawerBody = drawer?.querySelector('[data-drawer-body]');

  function openDrawer(r, kb) {
    if (!drawer) return;
    const { c, f } = r;
    const list = c.frames.filter((x) => x.kind !== 'plan');
    const idx = list.indexOf(f);
    drawerBody.innerHTML = `
      <header class="drawer-top">
        <span class="chip chip--tag">${esc(c.tag)}</span>
        <span class="hud mute">${esc(c.id.toUpperCase())} · ${esc(data.kinds[c.kind])}</span>
      </header>
      <p class="hud drawer-frame">${esc(f.label)}</p>
      <h2 class="drawer-title" id="drawer-title" tabindex="-1">${esc(c.concept)}</h2>
      <p class="drawer-member">${esc(c.member)}</p>
      <div class="drawer-thumb" style="aspect-ratio:${f.w} / ${f.h}" aria-hidden="true">
        ${f.src ? `<img src="${esc(f.src)}" alt="">` : `<span class="thumb-label hud">${esc(f.label)}</span>`}
        <span class="thumb-tag hud">${f.w} × ${f.h} · placeholder</span>
      </div>
      <p class="drawer-note">${esc(f.note)}</p>
      <dl class="drawer-meta">
        <div><dt class="hud">The ask</dt><dd>“${esc(c.asked)}”</dd></div>
        <div><dt class="hud">Shipped</dt><dd><ul>${c.shipped.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></dd></div>
      </dl>
      <nav class="drawer-frames" aria-label="Frames in ${esc(c.concept)}">
        ${list.map((x) => `<a class="chip" href="#${c.id}/${x.id}"${x === f ? ' aria-current="true"' : ''}>${esc(x.label.split('/').pop().trim())}</a>`).join('')}
      </nav>
      <div class="drawer-pager">
        <a class="btn btn--ghost btn--sm" href="#${c.id}/${list[(idx - 1 + list.length) % list.length].id}"><span aria-hidden="true">←</span> Prev</a>
        <span class="hud mute">${String(idx + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}</span>
        <a class="btn btn--ghost btn--sm" href="#${c.id}/${list[(idx + 1) % list.length].id}">Next <span aria-hidden="true">→</span></a>
      </div>`;
    drawer.hidden = false;
    drawer.dataset.concept = c.id;
    void drawer.offsetWidth;
    drawer.classList.add('is-open');
    drawer.style.transform = '';
    drawerOpen = true;
    document.documentElement.classList.add('drawer-open');
    if (o.hud.live) o.hud.live.textContent = `Opened ${f.label}, ${c.concept}. ${kindOf(c)}.`;
    drawer.querySelector('.drawer-scroll')?.scrollTo(0, 0);
    if (kb) drawer.querySelector('#drawer-title').focus({ preventScroll: true });
  }

  let hideTimer = 0;
  function closeDrawer(user) {
    if (!drawer || !drawerOpen) return;
    drawerOpen = false;
    drawer.classList.remove('is-open');
    drawer.style.transform = '';
    document.documentElement.classList.remove('drawer-open');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (!drawerOpen) drawer.hidden = true; }, reduced() ? 0 : 320);
    const prev = selected;
    if (selected) { selected.el.classList.remove('is-selected'); selected.el.removeAttribute('aria-current'); selected = null; }
    if (user && prev) {
      history.replaceState(null, '', `#${prev.c.id}`);
      if (o.hud.live) o.hud.live.textContent = 'Details closed';
      if (lastInput === 'key') prev.el.focus({ preventScroll: true });
    }
  }

  if (drawer) {
    drawer.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeDrawer(true);
    });
    // Bottom sheet: drag the grip down to dismiss.
    const grip = drawer.querySelector('.drawer-grip');
    if (grip) {
      let y0 = null, dy = 0;
      grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; grip.setPointerCapture(e.pointerId); drawer.classList.add('is-dragging'); });
      grip.addEventListener('pointermove', (e) => {
        if (y0 === null) return;
        dy = Math.max(0, e.clientY - y0);
        drawer.style.transform = `translateY(${dy}px)`;
      });
      const end = () => {
        if (y0 === null) return;
        y0 = null;
        drawer.classList.remove('is-dragging');
        if (dy > 90) closeDrawer(true); else drawer.style.transform = '';
      };
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);
    }
  }

  /* ── Filter rail (applies to canvas clusters + Grid/List cards) ─ */
  let filterKind = 'all';
  function filter(kind) {
    filterKind = kind;
    closeDrawer(false);
    collapse();
    const match = [];
    clusters.forEach(({ c, el }) => {
      const on = kind === 'all' || c.kind === kind;
      el.classList.toggle('is-dim', !on);
      if (on) match.push(conceptRect(c));
    });
    document.querySelectorAll('.folio-item').forEach((el) => {
      const on = kind === 'all' || el.dataset.kind === kind;
      el.hidden = !on;
      el.classList.toggle('is-dim', !on);
    });
    (o.hud.filters || []).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === kind)));
    if (view === 'canvas' && match.length) flyTo(fitCam(boundsOf(match), 40, 1));
    if (o.hud.live) o.hud.live.textContent = kind === 'all' ? 'Showing all concepts' : `Showing ${data.kinds[kind]} concepts`;
  }
  (o.hud.filters || []).forEach((b) => b.addEventListener('click', () => filter(b.dataset.filter)));

  /* ── Grid | List | Canvas (+ Index keep for #index / no-JS) ──── */
  const VIEWS = new Set(['canvas', 'grid', 'list', 'index']);
  const VIEW_KEY = 'jcg-work-view';
  function setView(v, animate = true) {
    if (!VIEWS.has(v) || v === view) return;
    if (v === 'index' && !o.index) return;
    if (v === 'grid' && !o.grid) return;
    if (v === 'list' && !o.list) return;
    const swap = () => {
      view = v;
      closeDrawer(false);
      if (v !== 'canvas') collapse();
      root.hidden = v !== 'canvas';
      if (o.index) o.index.hidden = v !== 'index';
      if (o.grid) o.grid.hidden = v !== 'grid';
      if (o.list) o.list.hidden = v !== 'list';
      document.documentElement.dataset.view = v;
      (o.hud.views || []).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
      if (v === 'canvas') resize();
      try {
        // Persist the three portfolio modes; Index stays a deep-link/a11y path.
        if (v !== 'index') sessionStorage.setItem(VIEW_KEY, v);
      } catch (_) { /* private mode */ }
    };
    if (animate && document.startViewTransition && !reduced()) {
      const vt = document.startViewTransition(swap);
      vt.ready.catch(() => {}); // skipped transitions (e.g. hidden tab) still swap
    } else swap();
    if (v === 'index' && location.hash !== '#index') history.replaceState(null, '', '#index');
    // Grid/List (and Canvas with no pin) drop concept hashes so reload restores the view.
    if (v === 'grid' || v === 'list') {
      if (location.hash && location.hash !== '#index') history.replaceState(null, '', location.pathname + location.search);
    } else if (v === 'canvas' && location.hash === '#index') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }
  (o.hud.views || []).forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

  /* ── HUD buttons ─────────────────────────────────────────────── */
  o.hud.zoomIn?.addEventListener('click', () => zoomBy(1.25));
  o.hud.zoomOut?.addEventListener('click', () => zoomBy(0.8));
  o.hud.fit?.addEventListener('click', () => (selected ? flyTo(fitCam(selected, 56, 1.6)) : fitAll()));

  /* ── Resize: keep the view centre fixed ──────────────────────── */
  function resize() {
    const cx = (vw / 2 - cam.x) / cam.s;
    const cy = (vh / 2 - cam.y) / cam.s;
    vw = root.clientWidth || vw;
    vh = root.clientHeight || vh;
    rootRect = root.getBoundingClientRect();
    cam.x = vw / 2 - cx * cam.s;
    cam.y = vh / 2 - cy * cam.s;
    setCam(cam);
  }
  new ResizeObserver(() => { if (!root.hidden) resize(); }).observe(root);

  /* ── Preview: Explore unlock (desktop) or hand-off to /work (touch) ── */
  let home = null;
  function lock() {
    unlocked = false;
    root.classList.remove('is-unlocked');
    o.explore?.setAttribute('aria-pressed', 'false');
    if (o.explore) o.explore.querySelector('[data-label]').textContent = 'Explore';
    if (home) flyTo(home, 320);
  }
  if (preview) {
    const cl = clusters.get(o.focus) || [...clusters.values()][0];
    clusters.forEach((x) => x.el.classList.toggle('is-away', x !== cl)); // one big tile; its band peeks past the window edge
    const fit = fitCam(conceptRect(cl.c), 16, 1);
    const s = Math.min(o.scale ?? 0.6, fit.s);
    const r = conceptRect(cl.c);
    home = { s, x: vw / 2 - (r.x + r.w / 2) * s, y: vh / 2 - (r.y + r.h / 2) * s };
    setCam(home);
    o.explore?.addEventListener('click', () => {
      const touch = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
      if (touch) { window.location.href = `${o.work}#${cl.c.id}`; return; }
      if (unlocked) { lock(); return; }
      unlocked = true;
      root.classList.add('is-unlocked');
      o.explore.setAttribute('aria-pressed', 'true');
      o.explore.querySelector('[data-label]').textContent = 'Lock';
    });
    new IntersectionObserver(([e]) => { if (!e.isIntersecting && unlocked) lock(); }).observe(root);
    // Re-centre the preview when the window resizes (it is a framed view, not a free camera).
    new ResizeObserver(() => {
      if (unlocked) return;
      const s2 = Math.min(o.scale ?? 0.6, fitCam(conceptRect(cl.c), 16, 1).s);
      home = { s: s2, x: vw / 2 - (r.x + r.w / 2) * s2, y: vh / 2 - (r.y + r.h / 2) * s2 };
      setCam(home);
    }).observe(root);
  } else {
    // The 719 Studios page asks to switch studio (its 3-way control): same path as a cover click, so the hash follows.
    window.addEventListener('message', (e) => {
      if (e.origin !== location.origin || e.data?.type !== 'studio:switch' || !stageOpen) return;
      if (clusters.has(e.data.id) && e.data.id !== stageId) openStage(e.data.id);
    });
    window.addEventListener('popstate', () => route(location.hash));
    window.addEventListener('hashchange', () => route(location.hash));
    route(location.hash, { fly: false });
    // Restore Grid/List when the URL isn't pinning Index or a concept.
    if (!location.hash) {
      try {
        const saved = sessionStorage.getItem(VIEW_KEY);
        if (saved && saved !== 'canvas' && VIEWS.has(saved)) setView(saved, false);
        else document.documentElement.dataset.view = 'canvas';
      } catch (_) {
        document.documentElement.dataset.view = 'canvas';
      }
    } else if (view === 'canvas') {
      document.documentElement.dataset.view = 'canvas';
    }
  }

  root.classList.add('is-ready');
  apply();

  return {
    cam: () => ({ ...cam }),
    onCamera: (fn) => { listeners.add(fn); fn(cam); return () => listeners.delete(fn); },
    flyTo, fitAll, fitConcept, zoomBy, filter, setView, route,
    select: (key) => byKey.has(key) && select(byKey.get(key)),
    expand, collapse, openStage, closeStage,
  };
}
