// The Work canvas's camera and dot grid, for video. Ported from assets/js/canvas.js (flyTo, morph, apply) so a video
// zooms the way the site does when an item opens: zoom runs in log space (a constant perceived speed), the centre of the
// frame moves in a straight line through the world, both on one ease, and the grid under it follows the camera.
//
// Units are the site's: a world unit is a CSS px at 100% zoom (z = 1), and the grid is 24 of them. A video px is
// K = 2.5 CSS px on the videos' 60 px grid (24 x 2.5 = 60: a 24 px block is the lockup at 60 px blocks), so every screen
// length here is a CSS length times K. A camera is { z, cx, cy }: the zoom and the world point at the centre of the frame.
export const GRID = 24;
export const K = 2.5;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // canvas.js easeInOut: the item morph, 700 ms
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);                                            // canvas.js easeOut: Fit and the other flights, 450 ms

/** A camera between a and b at progress e: zoom in log space, centre linear in the world. */
export function camLerp(a, b, e) {
  return { z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), e)), cx: lerp(a.cx, b.cx, e), cy: lerp(a.cy, b.cy, e) };
}

/** A world rect on screen under a camera, in video px. */
export function rectOn(cam, W, H, r, k = K) {
  const s = cam.z * k;
  return { x: W / 2 + (r.x - cam.cx) * s, y: H / 2 + (r.y - cam.cy) * s, w: r.w * s, h: r.h * s };
}

/** The painted step of the floor grid, in CSS px: 24 x zoom, multiplied by 4 until it clears 14 px (canvas.js apply()). */
export function gridStep(z) {
  let step = GRID * z, mult = 1;
  while (step < 14) { step *= 4; mult *= 4; }
  return { step, mult };
}

const GRID_MINOR = 'rgba(230,233,237,.11)', GRID_FIFTH = 'rgba(230,233,237,.24)';
/** The floor grid under a camera. The site's two layers (a faint dot every step, a brighter one every fifth) at its sizes:
    the dot is 1 CSS px (1.2 for the fifth) at every zoom, the pitch follows the camera. phase 'edges' puts the dots on
    multiples of the step (the videos' rule: the lattice runs through block edges, so a lockup's rows sit on dot rows);
    'centres' puts them half a step off, as the Work canvas does today. */
export function drawFloorGrid(ctx, W, H, cam, { k = K, phase = 'edges' } = {}) {
  const { step } = gridStep(cam.z), minor = step * k, fifth = minor * 5, s = cam.z * k;
  const ox = W / 2 - cam.cx * s, oy = H / 2 - cam.cy * s;
  const layer = (pitch, r, color) => {
    const off = phase === 'centres' ? pitch / 2 : 0;
    const sx = (((ox + off) % pitch) + pitch) % pitch, sy = (((oy + off) % pitch) + pitch) % pitch;
    ctx.fillStyle = color; ctx.beginPath();
    for (let y = sy; y <= H + r; y += pitch) for (let x = sx; x <= W + r; x += pitch) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
    ctx.fill();
  };
  layer(minor, 1 * k, GRID_MINOR);
  layer(fifth, 1.2 * k, GRID_FIFTH);
}
