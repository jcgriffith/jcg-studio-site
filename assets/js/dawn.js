// Dawn (2026-10-19, JC: the X header's "dawning sunrise ... ushering in the new, focusing on the light, optimistic
// without ignoring the dark"; "would be cool if the graphics also animated"). The same drawing as the X header
// (branding/x-header, study "dawn"): an ordered-dither glow made of the mark's square blocks, the one orange at its core,
// warm grey, then chrome, rising out of the void. The dark always outweighs the light.
//   <div class="dawn" data-dawn data-x=".69" data-y="1.26" data-reach=".35"></div>   (x, y as fractions of the box)
// Two kinds of band:
// - a header (default): on first view the sun rises into place over 2.6 s; the glow's skirt reaches both edges.
// - data-rise="scroll" (footers and closing bands, JC 2026-10-20: "let the sun gradients fully fan out without being
//   cropped ... it'd be cool if it animates up, like it's actually the sun rising and setting"): the whole glow fits the
//   box and fades to black before the top and both sides (no clip line); the sun sits lower, under the horizon (the
//   box's bottom edge); and it rises with the scroll as the band comes into view and sets again as you scroll back up.
//   The rise moves and fades the sun's own layer (transform and opacity only); the stars stay put.
// After that the light breathes, its edge pixels shimmer and a few stars twinkle. It pauses off screen and in hidden
// tabs; with reduced motion it is drawn once, risen.
const BAYER = [0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const rng = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function mount(el) {
  const scroll = el.dataset.rise === 'scroll';
  const layer = () => { const c = document.createElement('canvas'); c.setAttribute('aria-hidden', 'true'); return c; };
  const canvas = layer(), sky = scroll ? layer() : canvas;   // scroll bands: the sun on its own layer, the stars on another
  if (scroll) { sky.className = 'dawn-sky'; canvas.className = 'dawn-sun'; el.prepend(canvas); el.prepend(sky); } else el.prepend(canvas);
  const g = canvas.getContext('2d'), gs = sky.getContext('2d');
  const fx = parseFloat(el.dataset.x ?? '.69'), fy = parseFloat(el.dataset.y ?? '1.26'), fr = parseFloat(el.dataset.reach ?? '.35');
  let W = 0, H = 0, dpr = 1, cell = 5, stars = [], seen = false, t0 = 0, raf = 0, last = 0, onScreen = false;
  // scroll bands: the glow's geometry, fitted to the box
  const DEPTH = 0.24;            // the sun's centre sits this far (of its reach) below the horizon
  let fit = { cx: 0, cy: 0, reach: 1, sx: 1.5, lift: 0 }, cur = reduce.matches ? 1 : 0, aim = cur, sraf = 0;

  function size() {
    const r = el.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    for (const c of new Set([canvas, sky])) { c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px'; }
    cell = W < 600 ? 4 : 5;
    const rand = rng(9); stars = Array.from({ length: Math.round(W * H / 9000) }, () => [rand() * W, rand() * H * 0.6, 0.15 + rand() * 0.35, rand() * 6.28]);
    if (scroll) {
      // wide and low: an ellipse, sx times wider than tall. It stops short of both sides (and of the top, with room for
      // the breathing), so it fades to black on every edge but the horizon.
      const narrow = W < 600, sx = narrow ? 1.3 : 1.6, cx = (narrow ? 0.5 : fx) * W;
      const top = Math.max(28, H * 0.12), byW = ((narrow ? 0.95 : 0.9) * Math.min(cx, W - cx)) / sx, byH = (H - top) / (1 - DEPTH) / 1.02;
      const reach = Math.max(40, Math.min(byW, byH));
      fit = { cx, cy: H + DEPTH * reach, reach, sx, lift: reach * (1 - DEPTH) + cell * 3 };   // lift: how far it travels to set
    }
  }

  function drawSun(idle, rise) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    let cx, cy, reach, sxL, sxR;
    if (scroll) {
      ({ cx, cy } = fit); reach = fit.reach * (1 + 0.012 * Math.sin(idle * 0.6)); sxL = sxR = fit.sx;
    } else {
      const e = 1 - Math.pow(1 - rise, 3), narrow = W < 600;
      // the glow scales with the band's width, so on a tall phone band it stays a sunrise at the bottom, not a wall of light
      cx = (narrow ? 0.5 : fx) * W; reach = fr * Math.max(W, H * 1.6) * (0.82 + 0.18 * e) * (1 + 0.018 * Math.sin(idle * 0.6));
      cy = H * ((narrow ? Math.min(fy, 1.1) : fy) + (1 - e) * 0.7);   // on a phone the sun sits just under the band's edge
      // header bands are full bleed: the glow's skirt stretches sideways toward a far edge, so the lowest rows reach both edges
      const base = 0.86; sxL = Math.max(1.6, cx / (reach * base)); sxR = Math.max(1.6, (W - cx) / (reach * base));
    }
    const x0 = -((cell - (W % cell)) % cell) / 2;   // the grid is centred, so both edges get the same part-cell
    const y0 = Math.max(0, Math.floor((cy - reach) / cell) * cell);   // nothing to draw above the glow
    for (let y = y0, j = y0 / cell; y < H; y += cell, j++) for (let x = x0, i = 0; x < W; x += cell, i++) {
      const v = Math.max(0, 1 - Math.hypot((x - cx) / (x < cx ? sxL : sxR), y - cy) / reach);
      if (v <= 0) continue;
      const shimmer = 0.03 * Math.sin(idle * 1.3 + ((i * 73856093) ^ (j * 19349663)) % 628 / 100);
      const th = (BAYER[(j % 8) * 8 + (i % 8)] + 0.5) / 64 + shimmer;
      if (v > th) { g.fillStyle = v > 0.62 ? '#FF5B35' : v > 0.38 ? '#C9845F' : 'rgba(230,233,237,.55)'; g.fillRect(x, y, cell - 1, cell - 1); }
    }
  }
  function drawStars(idle) {
    if (scroll) { gs.setTransform(dpr, 0, 0, dpr, 0, 0); gs.clearRect(0, 0, W, H); }
    for (const [x, y, a, p] of stars) { gs.fillStyle = `rgba(230,233,237,${(a * (0.6 + 0.4 * Math.sin(idle * 0.9 + p))).toFixed(3)})`; gs.fillRect(Math.round(x), Math.round(y), 2, 2); }
  }
  function draw(now) {
    const idle = reduce.matches ? 0 : now / 1000;
    drawSun(idle, reduce.matches ? 1 : clamp01((now - t0) / 2600));
    drawStars(idle);
  }

  // ---- scroll bands: rise and set with the scroll. The aim is how far the band has come up the screen (0 as its top
  // enters, 1 once its bottom is on screen); the sun eases toward it, so a flick of the page still glides.
  function place() {
    const e = cur * cur * (3 - 2 * cur);   // smoothstep
    canvas.style.transform = `translate3d(0, ${(fit.lift * (1 - e)).toFixed(1)}px, 0)`;
    canvas.style.opacity = (0.15 + 0.85 * e).toFixed(3);
  }
  function aimNow() { const r = el.getBoundingClientRect(); aim = reduce.matches ? 1 : clamp01((innerHeight - r.top) / Math.max(1, Math.min(r.height, innerHeight))); }
  function glide() {
    sraf = 0; const d = aim - cur;
    cur = Math.abs(d) < 0.002 ? aim : cur + d * 0.16; place();
    if (cur !== aim) sraf = requestAnimationFrame(glide);
  }
  const onScroll = () => { aimNow(); if (!sraf) sraf = requestAnimationFrame(glide); };

  function loop(now) {
    raf = 0;
    if (!onScreen || document.hidden) return;
    if (now - last >= 33) { last = now; draw(now); }   // ~30 fps is plenty for a slow glow
    raf = requestAnimationFrame(loop);
  }
  const start = () => { if (!raf && !reduce.matches) raf = requestAnimationFrame(loop); };

  new ResizeObserver(() => { size(); draw(performance.now()); if (scroll) { aimNow(); cur = aim; place(); } }).observe(el);
  new IntersectionObserver((es) => {
    onScreen = es.some((x) => x.isIntersecting);
    if (onScreen && !seen) { seen = true; t0 = performance.now(); }
    if (scroll) { if (onScreen) { addEventListener('scroll', onScroll, { passive: true }); onScroll(); } else removeEventListener('scroll', onScroll); }
    if (onScreen) { if (reduce.matches) draw(performance.now()); else start(); }
  }, { rootMargin: scroll ? '0px' : '0px 0px -10% 0px' }).observe(el);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  addEventListener('resize', () => { if (scroll) onScroll(); });
  size(); if (!scroll) t0 = performance.now() + 1e9;   // a header waits below the horizon until it is seen
  draw(performance.now());
  if (scroll) { aimNow(); cur = aim; place(); }
}

document.querySelectorAll('[data-dawn]').forEach(mount);
