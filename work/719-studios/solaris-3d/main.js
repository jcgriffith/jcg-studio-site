import * as THREE from 'three';
import { coverSun, coverTurn } from '../3d/cover-sun.js?v=20261022g';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { warmBackdrop, paintBackdrop } from '../3d/surfaces.js?v=20261015-world';   // shared with Etherea (read-only)
import { finishSolaris, windowBackdrop } from './finishes.js?v=20261019-2';
import { addPendants } from './pendants.js?v=20261019-2';
import { dressSolaris } from './set-dressing.js?v=20261019-2';

// Solaris Loft 3D (2026-10-19). The Etherea viewer's renderer, light rig, presets, controls and on-demand rendering,
// fitted to Solaris's 12.2 x 6.1 m footprint, its south and east window walls, and its own fixtures from the Blender file.
const HERE = new URL('./', import.meta.url).href;
const params = new URLSearchParams(location.search);
const startedAt = performance.now(), debug = params.has('debug');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = matchMedia('(max-width: 760px)').matches;
const cover = params.has('cover');   // ?cover: a live grid cover (no UI, transparent, slow turn while on screen)
if (cover) document.documentElement.classList.add('is-cover');
const B = (x, y, z) => new THREE.Vector3(x, z, -y);   // Blender (x, y, z) -> three

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: cover, powerPreference: cover ? 'default' : 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 1.75));
renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
const scene = new THREE.Scene(); scene.background = cover ? null : warmBackdrop();
{ const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture; scene.environmentIntensity = 0.45; room.dispose(); pmrem.dispose(); }

const camera = new THREE.PerspectiveCamera(phone ? 50 : 38, 1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
const TARGET = new THREE.Vector3(0, 0.9, 0);
controls.target.copy(TARGET); controls.enableDamping = !reduce; controls.dampingFactor = 0.08;
controls.minDistance = 3.5; controls.maxDistance = 30; controls.maxPolarAngle = Math.PI * 0.47; controls.enablePan = false;
controls.rotateSpeed = 0.7;
let coverSeen = false;
if (cover) { controls.enabled = false; controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.6; }

// Light rig (as Etherea): sky + one shadowed sun through the windows. Solaris's windows face south and east, so the sun
// comes in from there. The four practicals are the Blender file's own lights: three ceiling area lights over the long
// axis and the vanity mirror's light, unshadowed.
const hemi = new THREE.HemisphereLight('#f4f1ec', '#6b5f55', 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffd9b3', 2.6); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(phone || cover ? 1024 : 2048, phone || cover ? 1024 : 2048);   // a cover is small: half the shadow detail
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.025;
const sunSweep = cover && !reduce ? coverSun(sun, camera, controls.target, renderer) : null;
if (cover) coverTurn(camera, controls, invalidate, { reduce });
const lamps = new THREE.Group(); scene.add(lamps);
for (const [x, y, z, power, night] of [[3.79, -0.03, 3.55, 2.4, 0], [0.21, -0.01, 3.55, 2.0, 0], [-3.32, -0.02, 3.55, 2.0, 0], [-5.32, -0.62, 2.15, 0.9, 1]]) {
  const l = new THREE.PointLight('#ffe2bf', power, 7, 2); l.position.copy(B(x, y, z)); l.userData.power = power; l.userData.nightOnly = !!night; lamps.add(l);
}
let glowMats = [];
const walls = []; let rootObj = null;
const windowMaterial = windowBackdrop(scene, walls);
window.__v = { hemi, sun, lamps, scene, renderer, camera, controls };

let renderUntil = 0;
function invalidate(duration = 1500) { renderUntil = Math.max(renderUntil, performance.now() + duration); renderer.shadowMap.needsUpdate = true; }
controls.addEventListener('change', () => invalidate(180));
controls.addEventListener('start', () => { invalidate(); intro = null; });

// Fit: back the camera off along its view direction until the whole loft (slab included) is inside the frame.
// fitted on the walls (12.2 x 6.1 m, 3.5 m tall), as Etherea fits its 14 m width; the slab's outer lip may crop a little
const LOFT = new THREE.Box3(B(-6.1, -3.05, 0.15).min(B(6.1, 3.05, 3.5)), B(-6.1, -3.05, 0.15).max(B(6.1, 3.05, 3.5)));
const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? LOFT.max.x : LOFT.min.x, i & 2 ? LOFT.max.y : LOFT.min.y, i & 4 ? LOFT.max.z : LOFT.min.z));
// desktop: from the south (through the window wall, which hides), a little east; phone: a steeper three-quarter view
// from the south-east, so the long room runs corner to corner on a tall screen
const START_DIR = (phone ? B(7.2, -5.6, 8.6) : B(2.2, -12, 7.4)).normalize();
function fitDistance(dir, margin = phone ? 0.92 : 1.03) {
  const cam = camera.clone(), tmp = new THREE.Vector3();
  for (let d = 6; d < 60; d += 0.1) {
    cam.position.copy(TARGET).addScaledVector(dir, d); cam.lookAt(TARGET); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    if (corners.every((c) => { tmp.copy(c).project(cam); return Math.abs(tmp.x) * margin <= 1 && Math.abs(tmp.y) * margin <= 1 && tmp.z < 1; })) return d;
  }
  return 30;
}
let home = null, intro = null;
function setHome() {
  const d = fitDistance(START_DIR) * (cover ? (camera.aspect < 1 ? 1.11 : 1.25) : 1);   // a tall grid card: a little bigger
  home = TARGET.clone().addScaledVector(START_DIR, d);
  controls.maxDistance = Math.max(30, d * 1.2);
}
function flyHome(fromFar) {
  if (reduce || !fromFar) { camera.position.copy(home); controls.target.copy(TARGET); controls.update(); invalidate(); return; }
  intro = { from: camera.position.clone(), fromT: controls.target.clone(), t0: performance.now(), dur: 1400 };
  invalidate(1600);
}
function applyIntro(now) {
  if (!intro) return;
  const k = Math.min((now - intro.t0) / intro.dur, 1), e = 1 - Math.pow(1 - k, 3);
  camera.position.lerpVectors(intro.from, home, e); controls.target.lerpVectors(intro.fromT, TARGET, e);
  if (k >= 1) intro = null;
}

// Load the model only once the canvas is on screen (a cover iframe below the fold loads nothing).
const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);
const fill = document.getElementById('fill'), load = document.getElementById('load');
let loading = false;
function startLoad() {
  if (loading) return; loading = true;
  load?.setAttribute('aria-busy', 'true');
  loader.load(HERE + 'assets/solaris.glb?v=20261019-1', (gltf) => {
    const root = gltf.scene; scene.add(root); rootObj = root; root.updateMatrixWorld(true);
    glowMats = finishSolaris(root, renderer, HERE + 'assets/solaris-floor-contact.png?v=20261019-1', invalidate);
    glowMats.forEach((m) => { m.userData.nightOnly = true; });
    dressSolaris(root, scene, invalidate);   // the pieces from the studio photos that the Blender file lacks
    glowMats.push(...addPendants(scene, lamps));   // the two wabi-sabi pendants over the sofa (not in the Blender file)
    const box = new THREE.Box3();
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      [].concat(o.material || []).forEach((m) => { m.dithering = true; m.needsUpdate = true; });   // no banded rings where a lamp fades across the floor (JC 2026-10-22)
      box.setFromObject(o); const sz = box.getSize(new THREE.Vector3());
      if (Math.min(sz.x, sz.y, sz.z) < 0.03 || /^Furniture_i2k/.test(o.name) || o.material?.transparent) o.castShadow = false;   // thin strips, curtains and glass only made shadow acne
      // perimeter walls and what stands against them (curtains, the vanity, the slatted feature wall) hide with that side
      // when it faces the camera; Solaris is 12.2 x 6.1 m, so the edge bands are 35 cm inside each wall
      const c = box.getCenter(new THREE.Vector3());
      if (Math.abs(c.x) > 5.75) walls.push({ o, n: new THREE.Vector3(Math.sign(c.x), 0, 0) });
      else if (Math.abs(c.z) > 2.75) walls.push({ o, n: new THREE.Vector3(0, 0, Math.sign(c.z)) });
    });
    load.style.opacity = 0; load.removeAttribute('aria-busy'); setTimeout(() => load.remove(), 600);
    // in cover mode inside another page (the 719 hero), say when the model is on screen, so the still in front can fade
    if (cover && window.parent !== window) setTimeout(() => window.parent.postMessage({ type: 'viewer:ready' }, location.origin), 400);
    document.getElementById('overview').disabled = false;
    setMode('golden', true); flyHome(!reduce && !cover); invalidate();
    draco.dispose();
    window.__solaris = { ready: true, loadMs: Math.round(performance.now() - startedAt) };
    if (debug) {
      console.info('Solaris ready', window.__solaris.loadMs, 'ms');
      setTimeout(() => { const before = renderer.info.render.frame; setTimeout(() => console.info('Solaris idle check', JSON.stringify({ framesInOneSecond: renderer.info.render.frame - before, triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls })), 1000); }, 4000);
    }
  }, (e) => { if (e.total) fill.style.width = (100 * e.loaded / e.total) + '%'; },
  () => { load.innerHTML = '<span>The loft could not load.</span><button type="button" onclick="location.reload()">Try again</button>'; });
}
new IntersectionObserver((entries) => {
  coverSeen = entries.some((x) => x.isIntersecting);
  if (coverSeen) (window.requestIdleCallback || setTimeout)(startLoad, { timeout: 300 });
}).observe(canvas);

// The same three lighting presets as Etherea; the sun swings to Solaris's south / east windows.
const LIGHTING = {
  day: { hemi: .65, sun: 2.5, lamp: .45, glow: 1.4, env: .48, exp: 1.0, color: '#fff1df', sky: '#dbe9ef', ground: '#8a7865', pos: B(5, -9, 10), window: '#ffffff', backdrop: ['#afc4ce', '#e3e4dc', '#b7b9ae'] },
  golden: { hemi: .4, sun: 3.3, lamp: .7, glow: 1.8, env: .3, exp: 1.02, color: '#ffb96c', sky: '#ead7c0', ground: '#715140', pos: B(9, -6, 4), window: '#ffd6ad', backdrop: ['#b58978', '#ecd0ac', '#a98970'] },
  night: { hemi: .32, sun: .35, lamp: 1, glow: 2.6, env: .28, exp: 1.05, color: '#cad9f1', sky: '#bac9e0', ground: '#6d5548', pos: B(5, -9, 10), window: '#45566e', backdrop: ['#46505f', '#87919c', '#4b5361'] },
};
let mode = 'golden', tween = null;
function setMode(next, instant) {
  mode = next; const to = LIGHTING[next];
  document.documentElement.classList.toggle('studio-world', next === 'night');
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === next));
  tween = { to, from: { hemi: hemi.intensity, sun: sun.intensity, lamp: (lamps.children[0]?.intensity ?? 0) / (lamps.children[0]?.userData.power || 1), glow: glowMats[0]?.emissiveIntensity ?? 0, env: scene.environmentIntensity, exp: renderer.toneMappingExposure },
    backdrop: scene.background?.userData.colors.map((c) => c.clone()), backdropTo: to.backdrop.map((c) => new THREE.Color(c)),
    color: sun.color.clone(), sky: hemi.color.clone(), ground: hemi.groundColor.clone(), pos: sun.position.clone(), window: windowMaterial.color.clone(), t0: performance.now(), dur: instant || reduce ? 0 : 900 };
  invalidate();
}
function applyTween(now) {
  if (!tween) return;
  const a = tween, k = a.dur ? Math.min((now - a.t0) / a.dur, 1) : 1, e = k * k * (3 - 2 * k), v = (key) => THREE.MathUtils.lerp(a.from[key], a.to[key], e);
  hemi.intensity = v('hemi'); sun.intensity = v('sun');
  lamps.children.forEach((l) => (l.intensity = v('lamp') * (l.userData.power || 1) * (mode === 'day' && l.userData.nightOnly ? 0 : 1)));
  glowMats.forEach((m) => (m.emissiveIntensity = v('glow') * (m.userData.practicalStrength ?? .35) * (mode === 'day' && m.userData.nightOnly ? .15 : 1)));
  scene.environmentIntensity = v('env'); renderer.toneMappingExposure = v('exp');
  sun.color.copy(a.color).lerp(new THREE.Color(a.to.color), e); hemi.color.copy(a.sky).lerp(new THREE.Color(a.to.sky), e); hemi.groundColor.copy(a.ground).lerp(new THREE.Color(a.to.ground), e);
  sun.position.lerpVectors(a.pos, a.to.pos, e); windowMaterial.color.copy(a.window).lerp(new THREE.Color(a.to.window), e);
  if (scene.background && a.backdrop) { const colors = scene.background.userData.colors; colors.forEach((c, i) => c.lerpColors(a.backdrop[i], a.backdropTo[i], e)); paintBackdrop(scene.background, colors); }
  renderer.shadowMap.needsUpdate = true; if (k === 1) tween = null;
}
sun.position.copy(LIGHTING.golden.pos);
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.getElementById('overview').addEventListener('click', () => { intro = { from: camera.position.clone(), fromT: controls.target.clone(), t0: performance.now(), dur: reduce ? 0 : 1100 }; invalidate(1300); });
canvas.addEventListener('pointerdown', () => { const h = document.getElementById('hint'); if (h) h.style.opacity = 0; }, { once: true });

// debug: tap a part to see its name (?debug)
if (debug) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('click', (e) => {
    if (!rootObj) return; ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(rootObj.children, true).find((h) => h.object.visible); if (hit) console.info('pick', hit.object.name, hit.object.material?.name);
  });
}

// Finishing effects stay opt-in (?post), exactly as on Etherea, until the tone-mapped backdrop issue is solved there.
let post = null;
if (!cover && params.has('post')) import('../3d/post.js?v=5').then(({ createPost }) => { post = createPost(renderer, scene, camera, { phone }); resize(); invalidate(); });

let fitted = false;
function resize() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; post?.setSize(w, h);
  if (cover && h > w) camera.setViewOffset(w, h, 0, -h * 0.06, w, h); else camera.clearViewOffset();   // raised a bit on the tall card (JC 2026-10-22)
  camera.updateProjectionMatrix();
  const wasHome = home && camera.position.distanceTo(home) < 0.01;
  setHome();
  if (!fitted) { fitted = true; camera.position.copy(TARGET).addScaledVector(START_DIR, home.distanceTo(TARGET) * (reduce || cover ? 1 : 1.3)); if (!reduce && !cover) camera.position.y += 1.5; controls.update(); }
  else if (wasHome) camera.position.copy(home);
}
addEventListener('resize', () => { resize(); invalidate(); }); resize();

const toCam = new THREE.Vector3();
function frame(now) {
  applyIntro(now); controls.update(); applyTween(now);
  toCam.copy(camera.position).sub(controls.target).setY(0).normalize();
  walls.forEach((w) => {
    const visible = w.n.dot(toCam) < 0.25;
    w.castsShadow ??= w.o.castShadow;
    if (w.o.visible !== visible) renderer.shadowMap.needsUpdate = true;
    w.o.visible = visible; w.o.castShadow = visible && w.castsShadow;
  });
  if (sunSweep) sunSweep(now);   // covers: the sun turns with the camera (3d/cover-sun.js)
  if (post) post.render(); else renderer.render(scene, camera);
}
renderer.setAnimationLoop((now) => {
  if (document.hidden) return;
  if (now < renderUntil || tween || intro || (cover && coverSeen && !reduce)) frame(now);
});
addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });
invalidate();
window.__v.frame = () => frame(performance.now() + 1e5);
