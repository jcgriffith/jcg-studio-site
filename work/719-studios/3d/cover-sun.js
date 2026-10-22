// Covers only (?cover; JC 2026-10-22: "casting a light source from one direction outside ... so you can see how the
// shadows move as it rotates"; then: "make it above"). The camera circles the loft; the sun keeps a fixed angle to the
// camera, from the top of the screen (a touch to one side, so shadows read), so the walls and arches throw shadows down
// the screen, toward the viewer, and they sweep across the floor as the room turns. Nothing extra downloads. The shadow map redraws
// about 15 times a second instead of every frame, so this costs less than the plain turn did.
// Warmer covers (JC 2026-10-22: "the soft grey and muted model colors is making each card just a tad boring"): on a
// cover the sun is stronger and a touch warmer and the exposure a little brighter, on top of whatever the lighting mode
// set (re-applied if a mode changes them). The explorer's own light is unchanged.
import { Color } from 'three';
const WARM = new Color('#ffc58f');
export function coverSun(sun, camera, target, renderer, { turn = Math.PI - 0.35, elev = 0.62, every = 66, sunGain = 1.45, expGain = 1.1 } = {}) {
  const d = sun.position.distanceTo(sun.target.position);
  let last = -1e9, sunSet = null, expSet = null;
  return (now) => {
    if (sun.intensity !== sunSet) { sun.intensity *= sunGain; sun.color.lerp(WARM, 0.5); sunSet = sun.intensity; }
    if (renderer.toneMappingExposure !== expSet) { renderer.toneMappingExposure *= expGain; expSet = renderer.toneMappingExposure; }
    const a = Math.atan2(camera.position.x - target.x, camera.position.z - target.z) + turn;
    sun.position.set(Math.sin(a) * Math.cos(elev), Math.sin(elev), Math.cos(a) * Math.cos(elev)).multiplyScalar(d).add(sun.target.position);
    const due = now - last >= every;
    renderer.shadowMap.needsUpdate = due;
    if (due) last = now;
  };
}

// Drag to turn (JC 2026-10-22: "turn in 3d ... unless we can enable that, which i'd love"). The page around the cover
// (canvas.js) owns the pointer and posts how far it was dragged, as a fraction of the cover's width; the camera circles
// the loft by that much (one full width is about three quarters of a turn), and the slow turn picks up again a moment
// after the release. The sun follows the camera, so the shadows move with the drag too.
export function coverTurn(camera, controls, invalidate, { reduce = false } = {}) {
  let resume = 0;
  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    const d = e.data || {};
    if (d.type === 'cover:turn') {
      controls.autoRotate = false; clearTimeout(resume);
      const a = -d.dx * Math.PI * 1.5, x = camera.position.x - controls.target.x, z = camera.position.z - controls.target.z;
      camera.position.x = controls.target.x + x * Math.cos(a) + z * Math.sin(a);
      camera.position.z = controls.target.z - x * Math.sin(a) + z * Math.cos(a);
      controls.update(); invalidate(600);
    } else if (d.type === 'cover:release') {
      clearTimeout(resume);
      resume = setTimeout(() => { controls.autoRotate = !reduce; invalidate(); }, 1200);
    }
  });
}
