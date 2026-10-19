// Live X strip — curated proof-of-life cards from static JSON, styled as the
// site's own cards (no embed script, no tracking). Native horizontal scroll with
// snap; the ← → buttons page by one card. An empty, failed or illustrative feed
// keeps the static "Follow along" line that ships in the HTML.
import { reduced } from './reduce-motion.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Small placeholder "media" drawn in the site's own vocabulary.
function media(m) {
  if (!m) return '';
  switch (m.type) {
    case 'frames':
      return `<div class="xm xm--frames" aria-hidden="true"><i></i><i></i><i></i><span class="hud">${esc(m.label || '')}</span></div>`;
    case 'status':
      return `<div class="xm xm--status hud" aria-hidden="true"><span><i class="q-mark"></i>Queued</span><span class="on"><i class="q-mark"></i>In progress</span><span class="done"><i class="q-mark"></i><span class="check"></span>Delivered</span></div>`;
    case 'code':
      return `<pre class="xm xm--code" aria-hidden="true">${(m.lines || []).map(esc).join('\n')}</pre>`;
    case 'type':
      return `<div class="xm xm--type" aria-hidden="true"><span class="hud">Departure 11</span><span class="big">Aa</span><span class="run">Archivo · longer runs</span></div>`;
    case 'queue':
      return `<div class="xm xm--queue" aria-hidden="true"><i class="done"></i><i class="on"></i><i></i><i></i><i></i></div>`;
    default:
      return '';
  }
}

function card(p, data) {
  const url = p.url || data.profile;
  const tag = data.illustrative || !p.url ? 'Illustrative' : 'On X';
  return `<article class="xcard is-loading" role="listitem" aria-label="${esc(p.kind)} post">
    <header class="xcard-head">
      <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="xcard-who"><b>JCG Studio</b><span class="mono">@${esc(data.handle)}</span></span>
      <span class="chip">${esc(p.kind)}</span>
    </header>
    <p class="xcard-text">${esc(p.text)}</p>
    ${media(p.media)}
    <footer class="xcard-foot hud">
      <span class="mute">${tag}</span>
      <a href="${esc(url)}" rel="noopener">View on X <span class="arr" aria-hidden="true">→</span></a>
    </footer>
  </article>`;
}

export async function initXStrip(root) {
  if (!root) return;
  const track = root.querySelector('[data-x-track]');
  const ctl = root.querySelector('[data-x-ctl]');
  let data;
  try {
    // Default resolves from this module (assets/js/), not the page, so any page depth finds it.
    const r = await fetch(root.dataset.src || new URL('../data/x-posts.json', import.meta.url));
    if (!r.ok) throw new Error(r.status);
    data = await r.json();
  } catch (err) {
    console.warn('[jcg] x strip: feed unavailable, keeping static line', err);
    root.classList.add('is-empty');
    return;
  }
  // Illustrative drafts are made-up posts: X's rules and the brand's honesty rule keep
  // them off the page until real posts replace them and illustrative is false.
  if (data.illustrative) { root.classList.add('is-empty'); return; }
  const posts = (data.posts || []).filter((p) => p && p.text);
  if (!posts.length) { root.classList.add('is-empty'); return; }

  track.setAttribute('role', 'list');
  track.setAttribute('tabindex', '0');
  track.setAttribute('aria-label', `Posts from @${data.handle}`);
  track.innerHTML = posts.map((p) => card(p, data)).join('');

  // Cards shimmer in (Libraries-style placeholder), staggered, once.
  const cards = [...track.children];
  cards.forEach((c, i) => setTimeout(() => c.classList.remove('is-loading'), reduced() ? 0 : 380 + i * 90));

  // Pager: ← → scroll by one card width. Native scroll does the rest.
  ctl.hidden = false;
  const prev = ctl.querySelector('[data-x-prev]');
  const next = ctl.querySelector('[data-x-next]');
  const step = () => (cards[0].getBoundingClientRect().width + 16);
  const sync = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
    ctl.hidden = max <= 0;
  };
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduced() ? 'auto' : 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduced() ? 'auto' : 'smooth' }));
  track.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  sync();
}
