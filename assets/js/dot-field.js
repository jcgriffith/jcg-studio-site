// The field (play layer, PLAY-BREAKDOWN item 18): the dot grid lights where you press, and slowly forgets.
// Press on the Work floor's empty space or a footer's, and the dots around your finger light, the patch spreading while
// you hold; drag with a mouse and it follows. Let go and it fades over a couple of seconds. It answers a press, never a
// passing pointer (so it is not a cursor follower), and each patch is one element that removes itself once it has faded,
// so nothing runs at rest. Holding until the patch has spread (900 ms) fires `field:bloom` on the host (a block,
// play.js). Page scrolling is untouched: a finger that starts a scroll just lets its patch fade.
// initField(host, { layer, toLayer, canStart }): patches go in `layer` (default: the host, behind its content), placed in
// its coordinates by toLayer(event). On the Work floor the layer is the world element, so a patch pans and zooms with
// the floor, and its dots sit on the floor's own lattice: the centres of the 24 px cells, every fifth one brighter.
// Styles: assets/css/play.css (.dot-field). Reduced motion: the patch appears whole and goes when you let go.
const GRID = 24, BLOOM = 900, LIFE = 2600;
const mod = (n, m) => ((n % m) + m) % m;
const EMPTY = 'footer, footer > .wrap, .lanes, .lane, .foot, .xstrip, .xstrip-head, .xstrip-track, .lane .eyebrow';
const local = (el, e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

export function initField(host, { layer = host, toLayer = (e) => local(layer, e), canStart = (e) => !!e.target.closest?.(EMPTY) && e.target.matches(EMPTY) } = {}) {
  if (host._field) return;
  host._field = true;
  host.classList.add('has-field');
  let held = null;

  function patch(p, cells) {
    const size = cells * 2 * GRID, x = p.x - size / 2, y = p.y - size / 2;
    const el = document.createElement('i');
    el.className = 'dot-field';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;` +
      `--bx:${mod(-x, GRID)}px;--by:${mod(-y, GRID)}px;--bx5:${mod(-x, 5 * GRID)}px;--by5:${mod(-y, 5 * GRID)}px`;
    layer.prepend(el);
    return el;
  }
  function fade(el) {
    el.classList.add('is-gone');
    const drop = () => el.remove();
    el.addEventListener('transitionend', (e) => { if (e.propertyName === 'opacity') drop(); });
    setTimeout(drop, LIFE + 200);
  }
  function release() {
    if (!held) return;
    clearTimeout(held.timer);
    fade(held.el);
    held = null;
  }

  host.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.button > 0 || held || !canStart(e)) return;
    if (e.pointerType === 'mouse') e.preventDefault();                  // a mouse drag lights the grid, it doesn't select text
    const p = toLayer(e), el = patch(p, 3.5);
    held = { id: e.pointerId, el, last: p, timer: 0 };
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-held')));
    held.timer = setTimeout(() => { if (held?.el === el) host.dispatchEvent(new CustomEvent('field:bloom', { bubbles: true })); }, BLOOM);
  });
  addEventListener('pointermove', (e) => {
    if (!held || e.pointerId !== held.id || e.pointerType !== 'mouse' || layer !== host) return;   // the floor moves under the finger instead
    const p = toLayer(e);
    if (Math.hypot(p.x - held.last.x, p.y - held.last.y) < GRID / 2) return;
    held.last = p;
    const trail = patch(p, 1.75);
    trail.classList.add('is-held');
    requestAnimationFrame(() => fade(trail));
  });
  addEventListener('pointerup', (e) => { if (held && e.pointerId === held.id) release(); });
  addEventListener('pointercancel', (e) => { if (held && e.pointerId === held.id) release(); });
  addEventListener('blur', release);
}
