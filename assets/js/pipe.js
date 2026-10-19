// Code-drawn pipe for #how and one ruler separator. Draws once in view:
// a hairline with a measured tick track, a signal packet at the head, and
// nodes that light as the head passes. Reduced motion: drawn complete.
import { reduced, onceInView } from './reduce-motion.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let uid = 0;

function animate(ms, onFrame, onDone) {
  if (reduced()) { onFrame(1); onDone && onDone(); return; }
  const t0 = performance.now();
  const f = (now) => {
    const t = Math.min(1, (now - t0) / ms);
    onFrame(ease(t), t);
    if (t < 1) requestAnimationFrame(f); else onDone && onDone();
  };
  requestAnimationFrame(f);
}

export function initPipe(steps) {
  if (!steps) return;
  const nodes = [...steps.querySelectorAll('.pipe-node')];
  const id = `pipe-${++uid}`;
  const svg = svgEl('svg', { class: 'pipe-svg', 'aria-hidden': 'true' });
  const clip = svgEl('clipPath', { id });
  const rect = svgEl('rect', { x: 0, y: 0, width: 0, height: 0 });
  clip.append(rect);
  const defs = svgEl('defs');
  defs.append(clip);
  const g = svgEl('g', { 'clip-path': `url(#${id})` });
  const base = svgEl('path', { fill: 'none', stroke: 'rgba(230,233,237,.24)', 'stroke-width': 1, 'shape-rendering': 'crispEdges' });
  const ticks = svgEl('path', { fill: 'none', stroke: 'rgba(230,233,237,.14)', 'stroke-width': 1, 'shape-rendering': 'crispEdges' });
  g.append(base, ticks);
  const trail = svgEl('rect', { style: 'fill: var(--signal)', opacity: 0 });
  const head = svgEl('rect', { style: 'fill: var(--signal)', width: 5, height: 5, opacity: 0 });
  // Elapsed-time readout riding the packet: the pipe explains "about every two business days".
  const readout = svgEl('text', { class: 'pipe-readout', opacity: 0 });
  svg.append(defs, g, trail, head, readout);
  steps.prepend(svg);

  let geo = null;
  let drawn = false;

  function measure() {
    const box = steps.getBoundingClientRect();
    const pts = nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
    });
    const horiz = Math.abs(pts[0].y - pts[pts.length - 1].y) < 2;
    const W = box.width, H = box.height;
    let d, t = '';
    if (horiz) {
      const y = Math.round(pts[0].y) + 0.5;
      d = `M0 ${y} H${W}`;
      for (let x = 4; x < W; x += 8) {
        const major = x % 64 === 4;
        t += `M${x + 0.5} ${y + 4} v${major ? 7 : 3} `;
      }
    } else {
      const x = Math.round(pts[0].x) + 0.5;
      d = `M${x} 0 V${H}`;
      for (let y = 4; y < H; y += 8) {
        const major = y % 64 === 4;
        t += `M${x + 5} ${y + 0.5} h${major ? 7 : 3} `;
      }
    }
    base.setAttribute('d', d);
    ticks.setAttribute('d', t);
    geo = { horiz, W, H, pts };
  }

  function frame(p) {
    const { horiz, W, H, pts } = geo;
    const L = horiz ? W : H;
    const pos = p * L;
    rect.setAttribute('width', horiz ? pos : W);
    rect.setAttribute('height', horiz ? H : pos);
    const trailLen = Math.min(56, pos);
    if (horiz) {
      trail.setAttribute('x', pos - trailLen); trail.setAttribute('y', Math.round(pts[0].y));
      trail.setAttribute('width', trailLen); trail.setAttribute('height', 1);
      head.setAttribute('x', pos - 2.5); head.setAttribute('y', Math.round(pts[0].y) - 2);
    } else {
      trail.setAttribute('y', pos - trailLen); trail.setAttribute('x', Math.round(pts[0].x));
      trail.setAttribute('height', trailLen); trail.setAttribute('width', 1);
      head.setAttribute('y', pos - 2.5); head.setAttribute('x', Math.round(pts[0].x) - 2);
    }
    const on = p > 0 && p < 1 ? 1 : 0;
    trail.setAttribute('opacity', on * 0.9);
    head.setAttribute('opacity', on);
    readout.textContent = `DAY ${Math.round(p * 2)}`;
    if (horiz) { readout.setAttribute('x', Math.max(0, pos - 40)); readout.setAttribute('y', Math.round(pts[0].y) - 10); }
    else { readout.setAttribute('x', Math.round(pts[0].x) + 16); readout.setAttribute('y', pos + 4); }
    if (on) readout.setAttribute('opacity', 1);
    nodes.forEach((n, i) => {
      const at = horiz ? pts[i].x : pts[i].y;
      if (pos >= at) n.classList.add(i === nodes.length - 1 && p < 1 ? 'is-signal' : 'is-lit');
    });
  }

  function draw() {
    measure();
    animate(1700, frame, () => {
      drawn = true;
      const last = nodes[nodes.length - 1];
      last.classList.add('is-signal');
      setTimeout(() => {
        last.classList.remove('is-signal'); last.classList.add('is-lit');
        readout.style.transition = 'opacity 240ms linear';
        readout.setAttribute('opacity', 0);
      }, reduced() ? 0 : 900);
    });
  }

  measure();
  frame(0);
  onceInView(steps, draw, '0px 0px -20% 0px');
  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { measure(); frame(drawn ? 1 : 0); }, 120);
  });
}

// Ruler separator: one on the page (before #membership).
export function initSeparator(el) {
  if (!el) return;
  const id = `sep-${++uid}`;
  const svg = svgEl('svg', { 'aria-hidden': 'true' });
  const clip = svgEl('clipPath', { id });
  const rect = svgEl('rect', { x: 0, y: 0, width: 0, height: 40 });
  clip.append(rect);
  const defs = svgEl('defs');
  defs.append(clip);
  const g = svgEl('g', { 'clip-path': `url(#${id})`, 'shape-rendering': 'crispEdges' });
  const line = svgEl('path', { stroke: 'rgba(230,233,237,.24)', fill: 'none' });
  const ticks = svgEl('path', { stroke: 'rgba(230,233,237,.16)', fill: 'none' });
  g.append(line, ticks);
  const head = svgEl('rect', { style: 'fill: var(--signal)', width: 5, height: 5, y: 17.5, opacity: 0 });
  svg.append(defs, g, head);
  el.prepend(svg);
  const label = el.querySelector('.sep-label');

  let W = 0;
  const measure = () => {
    W = el.getBoundingClientRect().width;
    line.setAttribute('d', `M0 20.5 H${W}`);
    let t = '';
    for (let x = 0; x <= W; x += 8) t += `M${x + 0.5} ${x % 80 === 0 ? 12 : 16} V20 `;
    ticks.setAttribute('d', t);
  };
  measure();
  if (label) label.style.opacity = reduced() ? 1 : 0;
  onceInView(el, () => {
    animate(1200, (p) => {
      rect.setAttribute('width', p * W);
      head.setAttribute('x', p * W - 2.5);
      head.setAttribute('opacity', p > 0 && p < 1 ? 1 : 0);
    }, () => { if (label) { label.style.transition = 'opacity 240ms linear'; label.style.opacity = 1; } });
  });
  window.addEventListener('resize', () => { measure(); rect.setAttribute('width', W); });
}
