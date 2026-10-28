// Grid + List expansion (Task P, 2026-10-28).
//   LIST  a row is one button; it opens IN PLACE as an accordion drawer (media reel + line + Year/Role + buttons).
//         On a mouse, a cover still floats near the cursor while a row is hovered. One row open at a time.
//   GRID  a card opens as a centred panel (FLIP from the card's cover; a full-height sheet on a phone).
//   Neither view ever switches to Canvas. The URL hash (#piece) mirrors what is open, so links and Back/Forward work.
//   Explore 3D / Case study open the project stage OVER the current view (canvas.js openStageOver), never a live
//   iframe inside the drawer or panel. Canvas keeps its own card and fly-to untouched.
import { reduced } from './reduce-motion.js';
import { openLightbox, reelStep, reelGo, reelIndex, wireReel, fullOf, lightboxOpen } from './lightbox.js?v=20261027w';
import { isPhoneClass } from './canvas.js?v=20261027w';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VID = /\.(mp4|webm)(\?|$)/i;
const EASE = 'cubic-bezier(.2, .7, .2, 1)';
const mq = (q) => window.matchMedia(q).matches;
const finePointer = () => mq('(hover: hover) and (pointer: fine)');
const saveData = () => !!navigator.connection?.saveData;
const root = document.documentElement;

export function initFolioViews({ data, floor, grid, list }) {
  const byId = new Map(data.concepts.map((c) => [c.id, c]));
  const proj = (c) => data.projects?.[c.project] || {};
  const url = (p) => new URL(p, document.baseURI).href;
  const bare = () => location.pathname + location.search;

  /* ── The shared card: media reel, line, Year/Role, buttons ──────────────────────────────────────────────── */
  const slidesOf = (c) => {
    if (c.highlights?.length) return c.highlights;
    const s = c.phoneCover || c.thumb;
    return s ? [{ src: s, w: 960, h: 720 }] : [];
  };
  function cardHtml(c, { panel }) {
    const p = proj(c);
    const slides = slidesOf(c);
    const reel = slides.length ? `
      <div class="fx-reel" role="group" aria-roledescription="carousel" aria-label="${esc(c.concept)}: highlights">
        <div class="fx-track">${slides.map((h, i, all) => {
          const vid = VID.test(h.src), ar = (Number(h.w) || 4) / (Number(h.h) || 3);
          return `<button type="button" class="fx-slide" data-lb="${i}" data-fit="${ar >= 1.2 ? 'cover' : 'contain'}" aria-label="Enlarge ${vid ? 'video' : 'image'} ${i + 1} of ${all.length}">${vid
            ? `<video src="${esc(h.src)}" poster="${esc(h.poster || '')}" width="${h.w}" height="${h.h}" muted loop playsinline preload="none" tabindex="-1" aria-hidden="true"></video><span class="fx-badge" aria-hidden="true">▶ Video</span>`
            : `<img src="${esc(h.src)}" width="${h.w}" height="${h.h}" alt="" loading="lazy" decoding="async">`}</button>`;
        }).join('')}</div>
        ${slides.length > 1 ? `<div class="fx-nav"><span class="fx-count" data-reel-count aria-live="polite">1 / ${slides.length}</span><button type="button" data-reel="-1" aria-label="Previous">←</button><button type="button" data-reel="1" aria-label="Next">→</button></div>` : ''}
      </div>` : '';
    const ctas = c.loft ? `
      <button type="button" class="btn title-card-open" data-fx-act="stage" data-jump="explore-${esc(c.loft)}">Explore 3D <span aria-hidden="true">↗</span></button>
      <button type="button" class="btn btn--ghost" data-fx-act="stage" data-jump="snapshot">Case study <span aria-hidden="true">→</span></button>
      ${p.journal ? `<a class="btn btn--ghost" href="${esc(url(p.journal))}">Story <span aria-hidden="true">→</span></a>` : ''}`
      : `<button type="button" class="btn title-card-open" data-fx-act="stage" data-jump="">View full project <span aria-hidden="true">→</span></button>`;
    return `
      <div class="fx-card" data-id="${esc(c.id)}">
        <div class="fx-media">${reel}</div>
        <div class="fx-info">
          <p class="fx-meta hud"><span>${esc(p.title || '')}</span>${c.staged ? '<span class="chip chip--staged">Staged</span>' : ''}</p>
          ${panel ? `<h2 class="fx-title" id="fx-panel-title">${esc(c.concept)}</h2>` : ''}
          <p class="fx-desc">${esc(c.cardLine || p.summary || c.description || '')}</p>
          <dl class="fx-facts hud">
            <div><dt>Year</dt><dd>${esc(c.year || p.year || '—')}</dd></div>
            <div><dt>Role</dt><dd>${esc(p.role || '—')}</dd></div>
          </dl>
          <div class="piece-ctas fx-ctas">${ctas}</div>
        </div>
      </div>`;
  }

  // videos play (muted) only for the slide in view, only with a mouse, and never under reduced motion / data saver
  function playMedia(host) {
    const track = host?.querySelector('.fx-track');
    if (!track) return;
    const go = !reduced() && finePointer() && !saveData();
    const i = reelIndex(track);
    [...track.children].forEach((s, k) => { const v = s.querySelector('video'); if (!v) return; if (go && k === i) v.play().catch(() => {}); else v.pause(); });
  }
  const stopMedia = (host) => host?.querySelectorAll('video').forEach((v) => v.pause());
  let scrollT = 0;
  document.addEventListener('scroll', (e) => {
    if (!e.target.classList?.contains('fx-track')) return;
    clearTimeout(scrollT); scrollT = setTimeout(() => playMedia(e.target.closest('.fx-card')), 140);
  }, { capture: true, passive: true });
  wireReel(document);

  /* in-card clicks (list drawer + grid panel): arrows, enlarge, buttons */
  let lastCta = null;
  function cardClick(e) {
    const card = e.target.closest('.fx-card');
    if (!card) return;
    const c = byId.get(card.dataset.id);
    const r = e.target.closest('[data-reel]');
    if (r) { reelStep(r); return; }
    const lb = e.target.closest('[data-lb]');
    if (lb && c) {
      const track = lb.closest('.fx-track');
      openLightbox({
        items: floor.lightboxItems ? floor.lightboxItems(c) : [], index: Number(lb.dataset.lb) || 0, title: c.concept, opener: lb,
        phone: isPhoneClass() || saveData(),
        onClose: (i) => { if (track && document.contains(track) && reelIndex(track) !== i) reelGo(track, i, false); },
      });
      return;
    }
    const b = e.target.closest('[data-fx-act="stage"]');
    if (b && c) { lastCta = b; stopMedia(card); floor.openStageOver(c.id, b.dataset.jump || ''); }
  }
  list.addEventListener('click', cardClick);

  /* ── State + hash ──────────────────────────────────────────────────────────────────────────────────────── */
  let cur = null;               // { kind, id, trigger, ... }
  const view = () => root.dataset.view;
  const parse = () => {
    const [cid, fid] = decodeURIComponent(location.hash.replace(/^#/, '')).split('/');
    let id = byId.has(cid) ? cid : null;
    if (!id && data.projects?.[cid]?.pieces?.length) id = data.projects[cid].pieces[0];
    return { id, project: !!id && (fid === 'project' || (!byId.has(cid) && !!data.projects?.[cid])) };
  };
  function userOpen(id, trigger) {
    if (cur?.id === id) { userClose(); return; }
    const was = !!cur;
    if (was) history.replaceState(history.state || { fx: 1 }, '', `#${id}`); else history.pushState({ fx: 1 }, '', `#${id}`);
    openId(id, { trigger });
  }
  function userClose() {
    if (!cur) return;
    if (history.state?.fx && location.hash) { history.back(); return; }   // popstate -> sync() closes it, one Back step undone
    history.replaceState(null, '', bare());
    closeCur({});
  }
  const openId = (id, o) => (view() === 'list' ? openList(id, o) : openGrid(id, o));
  const closeCur = (o) => { if (!cur) return; if (cur.kind === 'list') closeList(o); else closeGrid(o); };
  let first = true;
  function sync() {
    const v = view();
    if (v !== 'grid' && v !== 'list') { if (cur) closeCur({ instant: true }); return; }
    const { id, project } = parse();
    const instant = first; first = false;
    if (!id) { if (floor.stageOver()) floor.closeStageOver(false); if (cur) closeCur({}); return; }
    if (cur && cur.kind !== v) closeCur({ instant: true });
    if (!cur || cur.id !== id) openId(id, { instant });
    if (project) { if (!floor.stageOver()) floor.openStageOver(id, ''); }
    else if (floor.stageOver()) floor.closeStageOver(false);
  }
  window.addEventListener('popstate', sync);
  window.addEventListener('hashchange', sync);
  // a view switch or a filter: whatever is open closes at once, and the piece hash goes (so a reload restores the view)
  document.addEventListener('jcg:view', (e) => {
    if (cur) closeCur({ instant: true });
    if (location.hash && location.hash !== '#index' && e.detail?.view !== 'index') history.replaceState(null, '', bare());
  });
  document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    if (cur) { closeCur({ instant: true }); if (location.hash && location.hash !== '#index') history.replaceState(null, '', bare()); }
  }));
  document.addEventListener('jcg:stageover', (e) => {
    if (e.detail?.on !== false) return;
    const t = lastCta && document.contains(lastCta) && lastCta.offsetParent ? lastCta : cur?.trigger;
    lastCta = null;
    t?.focus?.({ preventScroll: true });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || lightboxOpen()) return;
    const v = view(); if (v !== 'grid' && v !== 'list') return;
    if (floor.stageOver()) { e.preventDefault(); floor.closeStageOver(true); return; }
    if (cur) { e.preventDefault(); userClose(); }
  });

  /* ── LIST ──────────────────────────────────────────────────────────────────────────────────────────────── */
  const entryOf = (id) => list.querySelector(`.folio-entry[data-id="${CSS.escape(id)}"]`);
  function anim(drawer, open, instant) {
    drawer._a?.cancel();
    drawer.style.overflow = '';
    if (instant || reduced()) { drawer.hidden = !open; return; }
    drawer.hidden = false;
    drawer.style.overflow = 'hidden';
    const h = open ? drawer.scrollHeight : drawer.offsetHeight;
    const frames = open ? [{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }] : [{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }];
    const a = drawer._a = drawer.animate(frames, { duration: open ? 400 : 300, easing: EASE });
    a.onfinish = () => { if (drawer._a !== a) return; drawer.style.overflow = ''; if (!open) drawer.hidden = true; drawer._a = null; };
  }
  function openList(id, { instant = false, trigger } = {}) {
    const entry = entryOf(id), c = byId.get(id);
    if (!entry || !c || entry.hidden) return;
    let above = 0;
    if (cur) {
      if (cur.kind === 'list' && cur.entry.compareDocumentPosition(entry) & Node.DOCUMENT_POSITION_FOLLOWING) above = cur.drawer.offsetHeight;
      closeCur({ instant, keepFocus: true });
    }
    peekHide();
    const row = entry.querySelector('.folio-row'), drawer = entry.querySelector('.fx-drawer');
    if (!drawer.firstElementChild) drawer.innerHTML = cardHtml(c, { panel: false });
    entry.classList.add('is-open'); row.setAttribute('aria-expanded', 'true');
    cur = { kind: 'list', id, entry, row, drawer, trigger: trigger || row };
    anim(drawer, true, instant);
    playMedia(drawer);
    // bring the whole drawer into view if it would end below the fold (measured on the final layout)
    const scroller = list, h = drawer.scrollHeight, top = entry.getBoundingClientRect().top - above, rowH = row.offsetHeight;
    const over = top + rowH + h - (innerHeight - 24), room = top - (parseFloat(getComputedStyle(root).getPropertyValue('--edge')) || 24) - 64;
    const dy = Math.min(over, room);
    if (dy > 4) scroller.scrollBy({ top: dy, behavior: instant || reduced() ? 'auto' : 'smooth' });
    else if (top < 70) scroller.scrollBy({ top: top - 72, behavior: instant || reduced() ? 'auto' : 'smooth' });
  }
  function closeList({ instant = false, keepFocus = false } = {}) {
    const { entry, row, drawer } = cur;
    cur = null;
    entry.classList.remove('is-open'); row.setAttribute('aria-expanded', 'false');
    stopMedia(drawer);
    const hadFocus = drawer.contains(document.activeElement);
    anim(drawer, false, instant);
    if (!keepFocus && (hadFocus || document.activeElement === document.body)) row.focus({ preventScroll: true });
  }
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.folio-row'); if (!row) return;
    userOpen(row.closest('.folio-entry').dataset.id, row);
  });

  /* hover preview: a cover still near the pointer, easing after it (mouse only) */
  const peek = document.createElement('div');
  peek.className = 'fx-peek'; peek.setAttribute('aria-hidden', 'true');
  document.body.append(peek);
  const peekImgs = new Map();
  let px = 0, py = 0, tx = 0, ty = 0, raf = 0, peekId = null, placed = false;
  const stillOf = (c) => c.phoneCover || c.thumb || (c.highlights || []).map((h) => h.poster || (VID.test(h.src) ? '' : h.src)).find(Boolean) || '';
  function peekShow(id) {
    if (peekId === id) return;
    const c = byId.get(id), src = c && stillOf(c);
    if (!src) { peekHide(); return; }
    let im = peekImgs.get(id);
    if (!im) { im = new Image(); im.decoding = 'async'; im.alt = ''; im.src = src; peek.append(im); peekImgs.set(id, im); }
    peekImgs.forEach((x, k) => x.classList.toggle('is-on', k === id));
    peekId = id; peek.classList.add('is-on');
  }
  function peekHide() { peekId = null; placed = false; peek.classList.remove('is-on'); peekImgs.forEach((x) => x.classList.remove('is-on')); }
  function peekFrame() {
    raf = 0;
    const W = peek.offsetWidth || 300, H = peek.offsetHeight || 400;
    const gx = tx + 36 + W > innerWidth - 12 ? tx - 36 - W : tx + 36;
    const gy = Math.max(12, Math.min(innerHeight - H - 12, ty - H / 2));
    const k = reduced() ? 1 : 0.16;
    px += (gx - px) * k; py += (gy - py) * k;
    peek.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
    if (peekId && (Math.abs(gx - px) > 0.4 || Math.abs(gy - py) > 0.4)) raf = requestAnimationFrame(peekFrame);
  }
  list.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !finePointer()) { if (peekId) peekHide(); return; }
    const entry = e.target.closest('.folio-entry');
    if (!entry || entry.classList.contains('is-open') || e.target.closest('.fx-drawer')) { peekHide(); return; }
    tx = e.clientX; ty = e.clientY;
    if (!placed) { placed = true; px = tx + 36; py = ty - 200; }
    peekShow(entry.dataset.id);
    if (!raf) raf = requestAnimationFrame(peekFrame);
  });
  list.addEventListener('pointerleave', peekHide);
  list.addEventListener('scroll', peekHide, { passive: true });

  /* ── GRID ──────────────────────────────────────────────────────────────────────────────────────────────── */
  const layer = document.createElement('div');
  layer.className = 'fx-layer'; layer.hidden = true;
  layer.innerHTML = `<div class="fx-backdrop"></div>
    <section class="fx-panel" role="dialog" aria-modal="true" aria-labelledby="fx-panel-title" tabindex="-1">
      <button type="button" class="fx-close" aria-label="Close"><span aria-hidden="true">×</span></button>
      <div class="fx-body"></div>
    </section>`;
  document.body.append(layer);
  const panel = layer.querySelector('.fx-panel'), body = layer.querySelector('.fx-body'), backdrop = layer.querySelector('.fx-backdrop');
  let anims = [], ghost = null, closing = 0;
  const cardOf = (id) => grid.querySelector(`.folio-card[data-id="${CSS.escape(id)}"]`);
  const cancelAnims = () => { anims.forEach((a) => a.cancel()); anims = []; ghost?.remove(); ghost = null; };
  const insetOf = (r, p) => `inset(${r.top - p.top}px ${p.right - r.right}px ${p.bottom - r.bottom}px ${r.left - p.left}px)`;
  const box = (r) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  function makeGhost(card, from) {
    const cover = card.querySelector('.folio-cover'), c = byId.get(card.dataset.id);
    const src = (c && c.phoneCover) || cover?.querySelector('img')?.currentSrc || cover?.querySelector('img')?.src;
    if (!src) return null;
    const g = document.createElement('img');
    g.className = 'fx-ghost'; g.alt = ''; g.src = src;
    Object.assign(g.style, box(from));
    document.body.append(g);
    return g;
  }
  function openGrid(id, { instant = false, trigger } = {}) {
    const card = cardOf(id), c = byId.get(id);
    if (!card || !c || card.hidden) return;
    if (cur) closeCur({ instant: true, keepFocus: true });
    cancelAnims(); closing++;
    const phone = isPhoneClass();
    body.innerHTML = cardHtml(c, { panel: true });
    layer.classList.toggle('is-sheet', phone);
    root.classList.add('fx-open'); root.classList.toggle('fx-sheet', phone);
    layer.hidden = false; layer.classList.remove('is-in');
    card.setAttribute('aria-expanded', 'true');
    cur = { kind: 'grid', id, card, trigger: trigger || card };
    panel.scrollTop = 0;
    const animate = !instant && !phone && !reduced();
    let from = null, g = null, media = null, pr = null, mr = null;
    if (animate) {
      from = card.querySelector('.folio-cover').getBoundingClientRect();
      pr = panel.getBoundingClientRect();
      media = body.querySelector('.fx-media'); mr = media.getBoundingClientRect();
      g = makeGhost(card, from);
    }
    layer.classList.add('is-in');
    panel.focus({ preventScroll: true });
    playMedia(body);
    if (!animate) return;
    ghost = g;
    const d = 520, o = { duration: d, easing: EASE };
    anims.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'linear' }));
    anims.push(panel.animate([{ clipPath: insetOf(from, pr) }, { clipPath: 'inset(0px 0px 0px 0px)' }], o));
    anims.push(body.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], o));
    if (g) {
      anims.push(g.animate([box(from), box(mr)], o));
      const fade = g.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], o);
      fade.onfinish = () => { g.remove(); if (ghost === g) ghost = null; };
      anims.push(fade);
    }
  }
  function closeGrid({ instant = false, keepFocus = false } = {}) {
    const { card, id } = cur;
    cur = null;
    const my = ++closing;
    stopMedia(body);
    const done = () => {
      if (my !== closing) return;
      cancelAnims();
      layer.hidden = true; layer.classList.remove('is-in', 'is-sheet'); root.classList.remove('fx-open', 'fx-sheet');
      body.innerHTML = '';
      card.setAttribute('aria-expanded', 'false');
      if (!keepFocus) card.focus({ preventScroll: true });
    };
    const phone = layer.classList.contains('is-sheet');
    if (instant || phone || reduced() || !card.isConnected || card.hidden) { done(); return; }
    cancelAnims();
    const to = card.querySelector('.folio-cover').getBoundingClientRect(), pr = panel.getBoundingClientRect(), media = body.querySelector('.fx-media');
    const mr = media ? media.getBoundingClientRect() : null;
    const o = { duration: 380, easing: EASE, fill: 'forwards' };
    anims.push(backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'linear', fill: 'forwards' }));
    anims.push(panel.animate([{ clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: insetOf(to, pr) }], o));
    anims.push(body.animate([{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], o));
    const g = makeGhost(card, mr || to);
    if (g && mr) {
      ghost = g; g.style.opacity = '0';
      anims.push(g.animate([{ ...box(mr), opacity: 0 }, { ...box(mr), opacity: 1, offset: 0.25 }, { ...box(to), opacity: 1 }], o));
    }
    setTimeout(done, 400);
  }
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('a.folio-card');
    if (!card?.dataset.id || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!(card.getAttribute('href') || '').startsWith('#')) return;   // a piece with its own page navigates there
    e.preventDefault();
    userOpen(card.dataset.id, card);
  });
  layer.addEventListener('click', (e) => {
    if (e.target.closest('.fx-close') || (!e.target.closest('.fx-panel') && e.target !== panel)) { userClose(); return; }
    cardClick(e);
  });
  // keep Tab inside the dialog
  layer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...panel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null && !n.disabled);
    if (!f.length) return;
    const a = document.activeElement, i = f.indexOf(a);
    if (e.shiftKey && (i <= 0 || a === panel)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  });
  document.addEventListener('focusin', (e) => {
    if (cur?.kind === 'grid' && !layer.hidden && !layer.contains(e.target) && !floor.stageOver() && !lightboxOpen() && !e.target.closest?.('.lb')) panel.focus({ preventScroll: true });
  });

  // a hash that was in the URL before this module loaded (a deep link) or a view that booted straight into Grid/List
  sync();
  return { sync };
}
