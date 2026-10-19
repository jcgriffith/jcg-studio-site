// Queue Pulse — the hero board advances Queued → In progress → Delivered on a
// ~2.8s tick. Delivered rows roll off the top; new requests join the bottom.
// Thumbs are absent until Delivered (no ghost/reserved slot); then product art
// appears. Runs only while on screen and the tab is visible.
// Reduced motion: static board; thumbs still only on Delivered rows.
import { reduced } from './reduce-motion.js';

const TICK = 2800;
const MAX_ROWS = 5;

const POOL = [
  ['Empty states, 4 screens', 'Design system · chunk 3 of 4'],
  ['Investor update email template', 'Collateral'],
  ['Changelog page', 'Marketing site'],
  ['Conference one-pager', 'Collateral'],
  ['DESIGN.md rules pass', 'Design system · chunk 4 of 4'],
  ['Pricing page variant B', 'Marketing site'],
  ['Hiring deck refresh', 'Collateral'],
  ['Data-table density tokens', 'Design system'],
  ['Webinar social set, 4 formats', 'Collateral'],
  ['Docs landing page', 'Marketing site'],
];

const LABEL = { queued: 'Queued', active: 'In progress', done: 'Delivered' };

// Miniature deliverable product shots (ink-on-void). Not letter badges.
const ART = {
  SYS: `<svg class="q-art" viewBox="0 0 36 36" fill="none" aria-hidden="true"><rect width="36" height="36" fill="#1A1E24"/><rect x="4" y="4" width="7" height="7" fill="#3A404A"/><rect x="13" y="4" width="7" height="7" fill="#4E5561"/><rect x="22" y="4" width="10" height="7" fill="#2A2E35"/><rect x="4" y="14" width="28" height="2.5" fill="#8A919B"/><rect x="4" y="19" width="18" height="2" fill="#4E5561"/><rect x="4" y="24" width="12" height="8" rx="1" stroke="#8A919B" stroke-width="1"/><rect x="8" y="27" width="4" height="2" fill="#E6E9ED"/><rect x="19" y="24" width="13" height="8" fill="#2A2E35"/><rect x="21" y="26" width="9" height="1.5" fill="#4E5561"/><rect x="21" y="29" width="6" height="1.5" fill="#3A404A"/></svg>`,
  SITE: `<svg class="q-art" viewBox="0 0 36 36" fill="none" aria-hidden="true"><rect width="36" height="36" fill="#1A1E24"/><rect x="3" y="5" width="30" height="26" rx="1.5" fill="#111418" stroke="#3A404A" stroke-width="1"/><rect x="3" y="5" width="30" height="5" fill="#2A2E35"/><circle cx="7" cy="7.5" r="1" fill="#4E5561"/><circle cx="10.5" cy="7.5" r="1" fill="#4E5561"/><circle cx="14" cy="7.5" r="1" fill="#4E5561"/><rect x="18" y="6.5" width="12" height="2" rx=".5" fill="#181C22"/><rect x="6" y="13" width="14" height="2.5" fill="#E6E9ED"/><rect x="6" y="17.5" width="10" height="1.5" fill="#4E5561"/><rect x="6" y="21" width="11" height="7" fill="#2A2E35"/><rect x="19" y="21" width="11" height="7" fill="#2A2E35"/><rect x="7.5" y="23" width="8" height="1" fill="#4E5561"/><rect x="20.5" y="23" width="8" height="1" fill="#4E5561"/></svg>`,
  SOC: `<svg class="q-art" viewBox="0 0 36 36" fill="none" aria-hidden="true"><rect width="36" height="36" fill="#1A1E24"/><rect x="5" y="3" width="26" height="30" rx="2" fill="#111418" stroke="#3A404A" stroke-width="1"/><rect x="5" y="3" width="26" height="18" fill="#2A2E35"/><path d="M12 14.5l4-4 3 3 5-6 5 7H12z" fill="#4E5561"/><circle cx="11" cy="8" r="2" fill="#4E5561"/><rect x="8" y="24" width="14" height="1.5" fill="#E6E9ED"/><rect x="8" y="27.5" width="10" height="1.2" fill="#4E5561"/><rect x="8" y="30.5" width="7" height="1.2" fill="#3A404A"/></svg>`,
  DECK: `<svg class="q-art" viewBox="0 0 36 36" fill="none" aria-hidden="true"><rect width="36" height="36" fill="#1A1E24"/><rect x="3" y="7" width="30" height="22" rx="1" fill="#111418" stroke="#3A404A" stroke-width="1"/><rect x="3" y="7" width="30" height="5" fill="#2A2E35"/><rect x="6" y="9" width="10" height="1.5" fill="#E6E9ED"/><rect x="6" y="16" width="12" height="2" fill="#8A919B"/><rect x="6" y="20" width="8" height="1.2" fill="#4E5561"/><rect x="6" y="23" width="6" height="1.2" fill="#3A404A"/><path d="M22 15h8v11H22z" fill="#2A2E35"/><path d="M22 26l4-6 4 6H22z" fill="#4E5561"/></svg>`,
  MAIL: `<svg class="q-art" viewBox="0 0 36 36" fill="none" aria-hidden="true"><rect width="36" height="36" fill="#1A1E24"/><rect x="4" y="5" width="28" height="26" rx="1" fill="#111418" stroke="#3A404A" stroke-width="1"/><rect x="4" y="5" width="28" height="7" fill="#2A2E35"/><circle cx="10" cy="8.5" r="2.2" fill="#4E5561"/><rect x="14" y="7" width="12" height="1.4" fill="#E6E9ED"/><rect x="14" y="9.5" width="8" height="1.1" fill="#4E5561"/><rect x="7" y="16" width="22" height="1.3" fill="#4E5561"/><rect x="7" y="19.5" width="18" height="1.3" fill="#3A404A"/><rect x="7" y="23" width="20" height="1.3" fill="#3A404A"/><rect x="7" y="26.5" width="12" height="1.3" fill="#2A2E35"/></svg>`,
  PAGE: `<svg class="q-art" viewBox="0 0 36 36" fill="none" aria-hidden="true"><rect width="36" height="36" fill="#1A1E24"/><rect x="7" y="3" width="22" height="30" rx="1" fill="#111418" stroke="#3A404A" stroke-width="1"/><rect x="10" y="6" width="16" height="2.5" fill="#E6E9ED"/><rect x="10" y="11" width="16" height="1.2" fill="#4E5561"/><rect x="10" y="14" width="16" height="1.2" fill="#4E5561"/><rect x="10" y="17" width="10" height="1.2" fill="#3A404A"/><rect x="10" y="21" width="7" height="9" fill="#2A2E35"/><rect x="19" y="21" width="7" height="9" fill="#2A2E35"/></svg>`,
  FILE: `<svg class="q-art" viewBox="0 0 36 36" fill="none" aria-hidden="true"><rect width="36" height="36" fill="#1A1E24"/><path d="M10 6h10l6 6v18H10V6z" fill="#111418" stroke="#3A404A" stroke-width="1"/><path d="M20 6v6h6" stroke="#4E5561" stroke-width="1" fill="#2A2E35"/><rect x="13" y="16" width="12" height="1.3" fill="#8A919B"/><rect x="13" y="20" width="10" height="1.2" fill="#4E5561"/><rect x="13" y="24" width="8" height="1.2" fill="#3A404A"/></svg>`,
};

function thumbMeta(title, sub) {
  const blob = `${title} ${sub}`.toLowerCase();
  if (/social/.test(blob)) return ['collateral', 'SOC'];
  if (/email/.test(blob)) return ['collateral', 'MAIL'];
  if (/one-?pager/.test(blob)) return ['collateral', 'PAGE'];
  if (/deck|board update|hiring/.test(blob)) return ['collateral', 'DECK'];
  if (/design system|token|component|design\.md|empty state|data-table/.test(blob)) return ['system', 'SYS'];
  if (/marketing site|pricing|changelog|docs landing|page/.test(blob)) return ['site', 'SITE'];
  if (/collateral/.test(sub.toLowerCase())) return ['collateral', 'FILE'];
  return ['other', 'FILE'];
}

function thumbMarkup(kind, type) {
  return `<span class="q-thumb" data-kind="${kind}" data-type="${type}" aria-hidden="true">${ART[type] || ART.FILE}</span>`;
}

// Status language for In progress: what the active request is going through.
const VERBS = [[0.34, 'drafting'], [0.7, 'building'], [1.01, 'reviewing']];

function setState(row, state, { flash = false } = {}) {
  const prev = row.dataset.state;
  row.dataset.state = state;
  const label = row.querySelector('.q-label');
  label.innerHTML = state === 'done' ? `<span class="check" aria-hidden="true"></span>${LABEL.done}` : LABEL[state];
  row.querySelector('.q-verb')?.remove();
  if (state === 'done') {
    const art = row.querySelector('.q-art');
    if (art) {
      if (prev === 'active') { art.classList.remove('is-in'); void art.offsetWidth; }
      art.classList.add('is-in');
    }
    // Flash the stage only when a live in-progress row finishes.
    syncStage(row, { flash: flash || prev === 'active' });
  }
}

function setVerb(row, p) {
  let v = row.querySelector('.q-verb');
  if (!v) {
    v = document.createElement('span');
    v.className = 'q-verb';
    v.setAttribute('aria-hidden', 'true');
    row.querySelector('.q-sub').append(v);
  }
  const verb = VERBS.find(([t]) => p < t)[1];
  v.textContent = ` · ${verb} ${String(Math.round(p * 100)).padStart(2, '0')}%`;
}

function makeRow(id, [title, sub]) {
  const li = document.createElement('li');
  li.className = 'q-row is-entering';
  const [kind, type] = thumbMeta(title, sub);
  li.dataset.title = title;
  li.dataset.sub = sub;
  li.dataset.type = type;
  li.innerHTML =
    `<span class="q-id hud">Q-${String(id).padStart(2, '0')}</span>` +
    thumbMarkup(kind, type) +
    `<span class="q-title"><span></span><span class="q-sub"></span></span>` +
    `<span class="q-status hud"><i class="q-mark" aria-hidden="true"></i><span class="q-label"></span></span>` +
    `<span class="q-bar" aria-hidden="true"></span>`;
  li.querySelector('.q-title > span').textContent = title;
  li.querySelector('.q-sub').textContent = sub;
  setState(li, 'queued');
  return li;
}

function syncStage(row, { flash = false } = {}) {
  const stage = document.getElementById('queue-stage');
  if (!stage || !row) return;
  const type = row.dataset.type || row.querySelector('.q-thumb')?.dataset.type || 'FILE';
  const title = row.dataset.title || row.querySelector('.q-title > span:first-child')?.textContent || '';
  const subEl = row.querySelector('.q-sub');
  const sub = row.dataset.sub || (subEl ? subEl.childNodes[0]?.textContent?.trim() : '') || '';
  const frame = stage.querySelector('.stage-art');
  const tag = stage.querySelector('.stage-tag');
  const tEl = stage.querySelector('.stage-title');
  const sEl = stage.querySelector('.stage-sub');
  if (frame) {
    frame.dataset.type = type;
    frame.innerHTML = ART[type] || ART.FILE;
    if (flash) {
      frame.classList.remove('is-flash');
      void frame.offsetWidth;
      frame.classList.add('is-flash');
    }
  }
  if (tag) tag.textContent = 'Just delivered';
  if (tEl) tEl.textContent = title;
  if (sEl) sEl.textContent = sub;
  stage.dataset.type = type;
}

export function initQueue(list) {
  if (!list) return;
  const rows = () => [...list.children].filter((r) => !r.classList.contains('is-leaving'));

  // Hydrate static markup with dataset + ensure art nodes for SSR rows.
  rows().forEach((r) => {
    const thumb = r.querySelector('.q-thumb');
    const type = thumb?.dataset.type || thumbMeta(
      r.querySelector('.q-title > span')?.textContent || '',
      r.querySelector('.q-sub')?.textContent || '',
    )[1];
    const title = r.querySelector('.q-title > span:first-child')?.textContent || '';
    const sub = r.querySelector('.q-sub')?.textContent || '';
    r.dataset.type = type;
    r.dataset.title = title;
    r.dataset.sub = sub;
    if (thumb && !thumb.querySelector('.q-art')) {
      const kind = thumb.dataset.kind || 'other';
      thumb.dataset.type = type;
      thumb.innerHTML = ART[type] || ART.FILE;
      thumb.dataset.kind = kind;
    }
    if (r.dataset.state === 'done') {
      r.querySelector('.q-art')?.classList.add('is-in');
    }
    setState(r, r.dataset.state);
  });

  // Seed stage from the newest delivered row (or first done).
  const seed = rows().filter((r) => r.dataset.state === 'done').at(-1) || rows().find((r) => r.dataset.state === 'done');
  if (seed) syncStage(seed);

  if (reduced()) {
    // Static board: thumbs only on Delivered — no ghost slots.
    rows().forEach((r) => {
      if (r.dataset.state === 'done') r.querySelector('.q-art')?.classList.add('is-in');
    });
    return;
  }

  let nextId = rows().length + 1;
  let poolIdx = 0;
  let timer = 0;
  let startedAt = 0;
  let remaining = TICK;
  let visible = false;

  const active = () => list.querySelector('.q-row[data-state="active"]');
  let verbTimer = 0;
  const readP = (row) => new DOMMatrixReadOnly(getComputedStyle(row.querySelector('.q-bar')).transform).a;
  const verbs = (on) => {
    clearInterval(verbTimer);
    if (on) verbTimer = setInterval(() => { const cur = active(); if (cur) setVerb(cur, readP(cur)); }, 200);
  };

  function runBar(row, from, ms) {
    row.classList.remove('is-running');
    row.style.setProperty('--p', from);
    void row.offsetWidth;
    row.style.setProperty('--run', `${ms}ms`);
    row.classList.add('is-running');
    row.style.setProperty('--p', 1);
  }

  function freezeBar(row) {
    const bar = row.querySelector('.q-bar');
    const m = new DOMMatrixReadOnly(getComputedStyle(bar).transform);
    row.classList.remove('is-running');
    row.style.setProperty('--p', m.a.toFixed(3));
  }

  function tick() {
    const cur = active();
    if (cur) { cur.classList.remove('is-running'); setState(cur, 'done'); }
    const next = list.querySelector('.q-row[data-state="queued"]');
    if (next) { setState(next, 'active'); runBar(next, 0, TICK); }

    // Roll: keep at most two delivered rows visible; recycle from the pool.
    const done = rows().filter((r) => r.dataset.state === 'done');
    if (done.length > 1) {
      const old = done[0];
      old.classList.add('is-leaving');
      setTimeout(() => old.remove(), 440);
      const row = makeRow(nextId++, POOL[poolIdx++ % POOL.length]);
      list.append(row);
      requestAnimationFrame(() => requestAnimationFrame(() => row.classList.remove('is-entering')));
    }
    while (rows().length > MAX_ROWS) rows()[0].remove();
    schedule(TICK);
  }

  function schedule(ms) {
    clearTimeout(timer);
    remaining = ms;
    startedAt = performance.now();
    timer = setTimeout(tick, ms);
  }

  function play() {
    if (timer || !visible || document.hidden) return;
    const cur = active();
    const p = cur ? parseFloat(cur.style.getPropertyValue('--p')) || 0.42 : 0;
    const ms = Math.max(200, (1 - p) * TICK);
    if (cur) runBar(cur, p, ms);
    schedule(ms);
    verbs(true);
  }

  function pause() {
    if (!timer) return;
    clearTimeout(timer);
    timer = 0;
    remaining -= performance.now() - startedAt;
    const cur = active();
    if (cur) freezeBar(cur);
    verbs(false);
  }

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    visible ? play() : pause();
  }, { threshold: 0.2 }).observe(list);

  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
  window.addEventListener('blur', pause);
  window.addEventListener('focus', play);
}
