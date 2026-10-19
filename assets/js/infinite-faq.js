// Infinite FAQ — an exploratory thread instead of a dead accordion.
// Source of truth is the static <details> list (copy + data-next branch map);
// it stays as the no-JS and reduced-motion experience. Enhanced:
//   · two drifting lanes of every question (pause on hover/focus, Pause button,
//     paused offscreen) — click one to pull it into the thread
//   · a thread: the newest answer is open, earlier ones fold to one line
//   · every answer offers three related questions, unread first, so the thread
//     never dead-ends; once all eleven are read it loops from Q.01
// No scroll capture: the page scrolls normally; a picked answer is brought into
// view with block:'nearest' only.
import { reduced } from './reduce-motion.js';

const LANE_SPEED = 26; // px per second

export function initInfiniteFaq(section) {
  if (!section || reduced()) return; // reduced motion: stacked <details> stay
  const source = section.querySelector('[data-faq-source]');
  const mount = section.querySelector('[data-ifaq]');
  if (!source || !mount) return;

  const Q = [...source.querySelectorAll('details[data-q]')].map((d) => ({
    id: d.dataset.q,
    q: d.querySelector('summary > span:not(.q):not(.pm)').textContent.trim(),
    a: d.querySelector('.answer').innerHTML,
    next: (d.dataset.next || '').split(/\s+/).filter(Boolean),
  }));
  if (!Q.length) return;
  const byId = Object.fromEntries(Q.map((x) => [x.id, x]));
  const read = new Set();

  // The static list hands its deep-link id to the thread.
  const anchorId = source.querySelector('details[id]')?.id;
  const anchorQ = anchorId && source.querySelector(`#${anchorId}`).dataset.q;
  source.querySelector(`#${anchorId}`)?.removeAttribute('id');

  mount.innerHTML = `
    <div class="ifaq-drift">
      <div class="ifaq-lanes" aria-hidden="true">
        <div class="ifaq-lane"><div class="ifaq-track"></div></div>
        <div class="ifaq-lane ifaq-lane--rev"><div class="ifaq-track"></div></div>
      </div>
      <button class="ifaq-pause hud" type="button" aria-pressed="false"><span class="ifaq-pause-ico" aria-hidden="true"></span><span data-pause-label>Pause drift</span></button>
    </div>
    <ol class="ifaq-thread" aria-label="Questions you've opened"></ol>
    <div class="ifaq-next">
      <div class="ifaq-next-head hud"><span>Keep going</span><span class="ifaq-count" data-count>00 / ${String(Q.length).padStart(2, '0')} explored</span></div>
      <span class="ifaq-progress" aria-hidden="true"><i data-progress></i></span>
      <div class="ifaq-branches" role="group" aria-label="Related questions"></div>
      <div class="ifaq-more">
        <button class="ifaq-btn hud" type="button" data-shuffle>Surprise me</button>
        <button class="ifaq-btn hud" type="button" data-index aria-expanded="false" aria-controls="ifaq-index">All ${Q.length} questions</button>
      </div>
      <ol class="ifaq-index" id="ifaq-index" hidden></ol>
      <p class="ifaq-done" data-done hidden>That's all ${Q.length}. The thread loops from here, or ask the twelfth: <a class="link" href="mailto:hello@jcg.studio">hello@jcg.studio</a></p>
    </div>
    <p class="sr-only" aria-live="polite" data-live></p>`;

  const $ = (s) => mount.querySelector(s);
  const thread = $('.ifaq-thread');
  const branches = $('.ifaq-branches');
  const live = $('[data-live]');
  const pad = (n) => String(n).padStart(2, '0');

  // ── Lanes: two marquees, each track holds its set twice for a seamless loop.
  const lanes = [...mount.querySelectorAll('.ifaq-lane')];
  const half = Math.ceil(Q.length / 2);
  const sets = [Q.slice(0, half), Q.slice(half)];
  lanes.forEach((lane, i) => {
    const chips = sets[i].map((x) => `<button type="button" tabindex="-1" class="ifaq-chip" data-open="${x.id}"><span class="hud">Q.${x.id}</span>${x.q}</button>`).join('');
    lane.firstElementChild.innerHTML = chips + chips;
  });
  const sizeLanes = () => lanes.forEach((lane) => {
    const w = lane.firstElementChild.scrollWidth / 2;
    lane.style.setProperty('--lane-dur', `${Math.max(24, w / LANE_SPEED)}s`);
  });
  sizeLanes();
  window.addEventListener('resize', sizeLanes);

  const pauseBtn = $('.ifaq-pause');
  const setPaused = (p) => {
    mount.classList.toggle('is-paused', p);
    pauseBtn.setAttribute('aria-pressed', String(p));
    pauseBtn.querySelector('[data-pause-label]').textContent = p ? 'Resume drift' : 'Pause drift';
  };
  pauseBtn.addEventListener('click', () => setPaused(!mount.classList.contains('is-paused')));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => mount.classList.toggle('is-offscreen', !e.isIntersecting)).observe($('.ifaq-lanes'));
  }

  // ── Index (the keyboard path to every question).
  const index = $('.ifaq-index');
  index.innerHTML = Q.map((x) => `<li><button type="button" class="ifaq-row" data-open="${x.id}"><span class="hud">Q.${x.id}</span><span>${x.q}</span></button></li>`).join('');
  const indexBtn = $('[data-index]');
  indexBtn.addEventListener('click', () => {
    const open = index.hidden;
    index.hidden = !open;
    indexBtn.setAttribute('aria-expanded', String(open));
  });

  // ── Thread
  function entry(x) {
    const li = document.createElement('li');
    li.className = 'ifaq-entry is-new';
    li.dataset.q = x.id;
    if (x.id === anchorQ) li.id = anchorId;
    li.innerHTML = `
      <h3 class="ifaq-q"><button type="button" class="ifaq-head" aria-expanded="true">
        <span class="hud ifaq-qid">Q.${x.id}</span><span class="ifaq-qt">${x.q}</span><span class="pm" aria-hidden="true"></span>
      </button></h3>
      <div class="ifaq-a answer">${x.a}</div>
      <span class="ifaq-scan" aria-hidden="true"></span>`;
    const head = li.querySelector('.ifaq-head');
    head.addEventListener('click', () => fold(li, !li.classList.contains('is-folded')));
    li.addEventListener('animationend', (e) => { if (e.target === li) li.classList.remove('is-new'); });
    return li;
  }
  function fold(li, folded) {
    li.classList.toggle('is-folded', folded);
    li.querySelector('.ifaq-head').setAttribute('aria-expanded', String(!folded));
  }

  function open(id, { focus = true, scroll = true } = {}) {
    const x = byId[id];
    if (!x) return;
    [...thread.children].forEach((li) => fold(li, true));
    let li = thread.querySelector(`[data-q="${id}"]`);
    if (li) { fold(li, false); li.classList.add('is-new'); thread.append(li); }
    else { li = entry(x); thread.append(li); }
    read.add(id);
    renderNext(x);
    live.textContent = `Q.${id} opened. ${read.size} of ${Q.length} explored.`;
    if (scroll) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (focus) li.querySelector('.ifaq-head').focus({ preventScroll: true });
  }

  function renderNext(cur) {
    const unread = Q.filter((x) => !read.has(x.id));
    // Related first (unread), then fill with the next unread in order, then loop.
    const picks = cur.next.filter((id) => !read.has(id) && byId[id]);
    for (const x of unread) { if (picks.length >= 3) break; if (!picks.includes(x.id)) picks.push(x.id); }
    for (const id of cur.next) { if (picks.length >= 3) break; if (!picks.includes(id) && id !== cur.id) picks.push(id); }
    branches.innerHTML = picks.map((id, i) => `<button type="button" class="ifaq-branch" data-open="${id}" style="--i:${i}"><span class="hud">${read.has(id) ? 'Again' : 'Q.' + id}</span><span>${byId[id].q}</span><span class="arr" aria-hidden="true">→</span></button>`).join('');
    const n = read.size;
    $('[data-count]').textContent = `${pad(n)} / ${pad(Q.length)} explored`;
    $('[data-progress]').style.transform = `scaleX(${n / Q.length})`;
    $('[data-done]').hidden = n < Q.length;
    index.querySelectorAll('[data-open]').forEach((b) => b.classList.toggle('is-read', read.has(b.dataset.open)));
    mount.dispatchEvent(new CustomEvent('faq:read', { bubbles: true, detail: { n, total: Q.length } }));   // reading all eleven is a block (play.js)
  }

  mount.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b) { open(b.dataset.open, { focus: !b.classList.contains('ifaq-chip') }); return; }
    if (e.target.closest('[data-shuffle]')) {
      const pool = Q.filter((x) => !read.has(x.id));
      const from = pool.length ? pool : Q;
      open(from[(Math.random() * from.length) | 0].id);
    }
  });

  // Deep links (#faq-scope from the scope section) open their question.
  const followHash = (focus) => {
    if (anchorId && location.hash === `#${anchorId}`) { open(anchorQ, { focus, scroll: false }); thread.querySelector(`#${anchorId}`)?.scrollIntoView({ block: 'start' }); }
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest(`a[href="#${anchorId}"]`);
    if (!a) return;
    e.preventDefault();
    history.pushState(null, '', `#${anchorId}`);
    followHash(true);
  });
  window.addEventListener('hashchange', () => followHash(true));

  // Swap in.
  source.hidden = true;
  mount.hidden = false;
  section.classList.add('is-infinite');
  section.querySelector('[data-ifaq-hint]')?.removeAttribute('hidden');
  open(Q[0].id, { focus: false, scroll: false });
  followHash(false);
}
