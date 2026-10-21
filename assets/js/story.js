// Journal stories (JC 2026-10-20): the shared renderer for a long-form story page (first entry: journal/719-studios/).
// The chapters come from one source (work/719-studios/3d/experience.js, also the 3D tour's story); this lays them out as a
// magazine: an opening spread, then each chapter in its own layout. Styles: assets/css/story.css.
// The 3D lives on the case study: chapters link to it (exploreHref), they do not embed it.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const words = (arr) => arr.map((x) => `<p data-reveal>${esc(x)}</p>`).join('');

export function mountStory({ stops, MOOD = [], sets, IMG, root, hero, exploreHref }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SETS = new URL(`${IMG}sets/`, location.href), url = (src) => new URL(src, SETS).href;

  // ---- full-screen photos: one list per chapter
  if (!document.getElementById('lightbox')) document.body.insertAdjacentHTML('beforeend', `<dialog class="lightbox" id="lightbox" aria-label="Photo">
    <header><span class="hud" id="lb-count"></span><button type="button" class="hud" id="lb-close" aria-label="Close">✕</button></header>
    <img id="lb-img" alt=""><footer><button type="button" id="lb-prev" aria-label="Previous">←</button><p id="lb-cap"></p><button type="button" id="lb-next" aria-label="Next">→</button></footer></dialog>`);
  const lists = [], lb = { list: [], i: 0 }, lbEl = document.getElementById('lightbox'), lbImg = document.getElementById('lb-img');
  const reg = (items) => { lists.push(items); return lists.length - 1; };
  const show = (i) => { lb.i = (i + lb.list.length) % lb.list.length; const [src, cap] = lb.list[lb.i]; lbImg.src = src; lbImg.alt = cap || '';
    document.getElementById('lb-cap').textContent = cap || ''; document.getElementById('lb-count').textContent = `${String(lb.i + 1).padStart(2, '0')} / ${String(lb.list.length).padStart(2, '0')}`; };
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (!b) return; lb.list = lists[Number(b.dataset.l)]; show(Number(b.dataset.i)); lbEl.showModal(); });
  document.getElementById('lb-close').onclick = () => lbEl.close();
  document.getElementById('lb-prev').onclick = () => show(lb.i - 1);
  document.getElementById('lb-next').onclick = () => show(lb.i + 1);
  lbEl.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(lb.i + 1); if (e.key === 'ArrowLeft') show(lb.i - 1); });

  const tile = (l, i, p) => `<button type="button" data-l="${l}" data-i="${i}" aria-label="Open photo: ${esc(p.alt)}"><img src="${p.src}" width="${p.w}" height="${p.h}" alt="${esc(p.alt)}" loading="lazy" decoding="async"></button>`;
  const fig = (l, i, p, cls = '', cap = '') => `<figure class="f ${cls}" data-reveal style="--ar:${p.w} / ${p.h}">${tile(l, i, p)}${cap ? `<figcaption class="hud">${cap}</figcaption>` : ''}</figure>`;
  const film = (v, label, badge = '') => `<figure class="f vidfig" data-reveal>${badge ? `<span class="badge">${badge}</span>` : ''}<video src="${v.video}" poster="${v.src}" muted loop playsinline controls preload="none" aria-label="${esc(label)}"></video></figure>`;
  const quote = (q) => (q ? `<blockquote class="pull" data-reveal><p>${esc(q)}</p></blockquote>` : '');
  const go3d = (pairs) => `<p class="links" data-reveal>${pairs.map(([id, label]) => `<a class="cta" href="${exploreHref(id)}">${label} <span aria-hidden="true">↗</span></a>`).join('')}</p>`;
  const AWARD = `<a class="card" data-reveal href="https://web.archive.org/web/20230929030652/https://madein.peerspace.com/awards/los-angeles/production" target="_blank" rel="noopener"><img src="${IMG}peerspace-open-door-2023.webp" width="285" height="400" alt="Peerspace Open Door Awards 2023 winner badge"><span><b>Open Door Awards 2023</b>No. 9 of the top 10 production spaces in Los Angeles<i>See the winners ↗</i></span></a>`;
  const BOARD = `<a class="card" data-reveal href="https://www.pinterest.com/jc_griffith/etherea/" target="_blank" rel="noopener"><span><b>The Etherea board</b>Hundreds of pins: the dreamscapes the studio was designed from<i>See the board on Pinterest ↗</i></span></a>`;
  const MARQUEE = (() => { const pins = MOOD.map(([id, img, alt]) => `<a href="https://www.pinterest.com/pin/${id}/" target="_blank" rel="noopener"><img src="https://i.pinimg.com/736x/${img}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>`);
    const half = Math.ceil(pins.length / 2), row = (a) => `<div class="row">${a.join('')}${a.join('').replace(/<a /g, '<a tabindex="-1" aria-hidden="true" ')}</div>`;
    return pins.length ? `<div class="marquee" data-reveal>${row(pins.slice(0, half))}${row(pins.slice(half))}</div>` : ''; })();

  const paragraphs = (s) => { if (s.paras) return s.paras; const parts = s.detail.split(/(?<=[.!?])(?<!\bNo\.)\s+(?=[A-Z“"])/);
    if (parts.length < 3) return [s.detail]; const half = Math.ceil(parts.length / 2); return [parts.slice(0, half).join(' '), parts.slice(half).join(' ')]; };
  const LAYOUT = { intro: 'opening', sign: 'split', dreamscape: 'board', build: 'film', stage: 'diptych', proof: 'statement', expand: 'reel', end: 'quiet' };
  const QUOTE = { sign: 'We took it as a sign.', dreamscape: 'I grew up working in renovation and construction, so building one felt possible.' };
  const TINT = { intro: '#0B0C0E', sign: '#15100f', dreamscape: '#1a110e', build: '#060708', stage: '#11150f', proof: '#0f1210', expand: '#16130f', end: '#0B0C0E' };
  const NO_DEK = new Set(['expand', 'end']);
  // the sets and the blank-canvas corner read as one chapter here (desert | forest, then the pool and the paper corner)
  const corner = stops.find((s) => s.id === 'photo-corner');
  const SET_PHOTOS = { stage: [sets.stage[0], sets['green-wall'][0], sets.pool[0], sets['photo-corner'][0]] };
  const list = (s) => (s.photos || SET_PHOTOS[s.id] || []).map((p) => ({ ...p, src: url(p.src), video: p.video && url(p.video), alt: p.alt || s.title }));

  // ---- the opening spread: the first chapter's first photograph, the story's title on it
  const intro = stops[0], introList = list(intro), li = reg(introList.filter((p) => !p.video).map((p) => [p.src, p.alt]));
  const lead = introList[0];
  let html = `<header class="bleed" data-reveal>${lead ? `<button type="button" data-l="${li}" data-i="0" aria-label="Open photo: ${esc(lead.alt)}"><img src="${lead.src}" alt="${esc(lead.alt)}" width="${lead.w}" height="${lead.h}" fetchpriority="high" decoding="async"></button>` : ''}
    <div class="j-head"><p class="hud">${esc(hero.label)}</p><h1 id="j-title">${esc(hero.title)}</h1><p class="hud">${esc(hero.byline)}</p></div></header>`;

  const chapter = (s) => {
    const lay = LAYOUT[s.id] || 'split', q = QUOTE[s.id];
    let paras = paragraphs(s); if (s.id === 'stage' && corner) paras = [...paras, ...paragraphs(corner)];
    const all = s.id === 'intro' ? introList : list(s), stills = all.filter((p) => !p.video), videos = all.filter((p) => p.video);
    const l = s.id === 'intro' ? li : reg(stills.map((p) => [p.src, p.alt])), at = (p) => stills.indexOf(p);
    const head = `<div class="ch-head" data-reveal>${s.chip === s.title ? '' : `<p class="hud">${esc(s.chip)}</p>`}<h3 id="t-${s.id}">${esc(s.title)}</h3></div>`;
    const dek = s.sum && !NO_DEK.has(s.id) && !s.detail.startsWith(s.sum) ? `<p class="dek" data-reveal>${esc(s.sum)}</p>` : '';
    let body;
    switch (lay) {
      case 'opening': body = `<div class="wrap cols"><div>${head}${dek}</div><div>${words(paras)}${stills[1] ? fig(l, 1, stills[1], 'inset') : ''}</div></div>`; break;
      case 'split': body = `<div class="wrap split"><div>${head}${dek}${words(paras)}${quote(q)}</div><div class="split-media">${videos.map((v) => film(v, s.title)).join('')}${stills.map((p, k) => fig(l, k, p)).join('')}</div></div>`; break;
      case 'board': {
        const plan = stills.find((p) => /eth-plan/.test(p.src));
        const pair = [stills.find((p) => p.src.includes('eth-stage-render')), stills.find((p) => p.src.includes('eth-stage-built'))].filter(Boolean);
        body = `<div class="wrap">${head}${dek}${words(paras.slice(0, 1))}</div>${MARQUEE}
          <div class="wrap">${MARQUEE ? '<p class="hud" data-reveal>From my Etherea board on Pinterest · tap a pin to see it there</p>' : ''}${quote(q)}
          ${plan ? fig(l, at(plan), plan, '', 'An early 3D layout') : ''}
          <p data-reveal>These are early iterations. The design kept changing until we built it.</p>
          ${pair.length === 2 ? `<div class="pair">${fig(l, at(pair[0]), pair[0], '', 'Early 3D concept')}${fig(l, at(pair[1]), pair[1], '', 'As built')}</div>` : ''}
          ${go3d([['etherea', 'See the final design in 3D']])}
          ${videos.length ? videos.map((v) => `<div class="film-grid" style="margin-top:48px">${film(v, 'From the 3D render to the real room')}<div>${words(paras.slice(1))}${BOARD}</div></div>`).join('') : words(paras.slice(1)) + BOARD}</div>`;
        break;
      }
      case 'film': body = `<div class="wrap film-grid"><div>${head}${dek}${words(paras)}</div>${videos.map((v) => film(v, s.title)).join('')}</div>`; break;
      case 'diptych': body = `<div class="wrap">${head}${dek}<div class="dip">${stills.slice(0, 2).map((p, k) => fig(l, k, p)).join('')}</div>${words(paras)}<div class="dip">${stills.slice(2, 4).map((p, k) => fig(l, k + 2, p)).join('')}</div>${go3d([['etherea', 'See it in 3D']])}</div>`; break;
      case 'reel': body = `<div class="wrap">${head}${dek}${words(paras.slice(0, 2))}<div class="reel-grid">${videos.map((v) => film(v, 'The Terra build, sped up', '3.2M views on Instagram')).join('')}${stills.map((p, k) => fig(l, k, p)).join('')}</div>${words(paras.slice(2))}${go3d([['terra', 'See Terra in 3D'], ['solaris', 'See Solaris in 3D']])}</div>`; break;
      case 'statement': body = `<div class="wrap">${head}${dek}${words(paras)}${s.award ? AWARD : ''}</div>`; break;
      default: body = `<div class="wrap">${head}${dek}${stills.map((p, k) => fig(l, k, p, 'end-photo')).join('')}${words(paras)}</div>`;
    }
    return `<article class="ch ch--${lay}" id="ch-${s.id}" data-tint="${TINT[s.id] || '#0B0C0E'}" aria-labelledby="t-${s.id}">${body}</article>`;
  };
  html += stops.filter((s) => s.id !== 'photo-corner').map(chapter).join('');
  root.innerHTML = html;

  // ---- the background drifts to each chapter's tint; things arrive as they come on screen; videos play while on screen
  const tio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) (root.closest('.story') || root).style.setProperty('--tint', e.target.dataset.tint); }), { rootMargin: '-45% 0px -45% 0px' });
  root.querySelectorAll('.ch').forEach((c) => tio.observe(c));
  const rio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach((el) => rio.observe(el));
  if (!reduce) {
    const vio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }), { threshold: 0.6 });
    root.querySelectorAll('video').forEach((v) => vio.observe(v));
    const bleeds = [...root.querySelectorAll('.bleed img')]; let raf = 0;
    const par = () => { raf = 0; bleeds.forEach((im) => { const r = im.closest('.bleed').getBoundingClientRect(); im.style.setProperty('--py', `${(-((r.top + r.height / 2 - innerHeight / 2) / innerHeight) * 6).toFixed(2)}%`); }); };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(par); }, { passive: true }); par();
  }
  return { words: root.innerText.trim().split(/\s+/).length };
}
