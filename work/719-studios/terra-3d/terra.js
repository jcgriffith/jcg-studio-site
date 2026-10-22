// Terra Loft viewer (2026-10-19). Same viewer as Etherea (../3d/index.html): AgX, warm low sun through the windows plus
// sky, the three lighting presets, cutaway walls that hide when they face the camera, on-demand rendering, optional
// finishing effects (?post). Shares Etherea's modules from ../3d/ instead of copying them; only Terra-specific parts
// (window cards, practical lights, plaster/floor tuning) live here and in terra-finishes.js.
import * as THREE from 'three';
import { coverSun, coverTurn } from '../3d/cover-sun.js?v=20261022g';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { warmBackdrop, paintBackdrop } from '../3d/surfaces.js?v=20261015-world';
import { finishFoliage } from '../3d/foliage.js';
import { finishTerra, terraWindows, terraPracticals, terraBacklights } from './terra-finishes.js?v=20261019-7';

const MODEL = './terra-lowres.glb?v=20261019-shelves';
const startedAt = performance.now(), params = new URLSearchParams(location.search), debug = params.has('debug');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = matchMedia('(max-width: 760px)').matches;
const cover = params.has('cover');
if (cover) document.documentElement.classList.add('is-cover');
const B = (x, y, z) => new THREE.Vector3(x, z, -y);   // Blender (x, y, z) -> three

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: cover, powerPreference: cover ? 'default' : 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 1.75));
renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
const scene = new THREE.Scene(); scene.background = cover ? null : warmBackdrop();
{
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture; scene.environmentIntensity = 0.45;
  room.dispose(); pmrem.dispose();
}

// Opening view: from the entrance end (-X, like the file's own render camera) and the +Y side, high enough to look over
// the full-height arch walls onto the curved steps, with the window wall (+X) in view.
const camera = new THREE.PerspectiveCamera(phone ? 50 : 38, 1, 0.1, 200);
const HOME = { dir: phone ? B(-12, 11, 17).normalize() : B(-11, 10, 13.5).normalize(), target: new THREE.Vector3(0, 0.6, 0) };
camera.position.copy(HOME.target).addScaledVector(HOME.dir, 16);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME.target); controls.enableDamping = !reduce; controls.dampingFactor = 0.08;
controls.minDistance = 3; controls.maxDistance = 24; controls.maxPolarAngle = Math.PI * 0.47; controls.enablePan = false;
controls.rotateSpeed = 0.7;
let coverSeen = false;
if (cover) {
  controls.enabled = false; controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.6;
  new IntersectionObserver((e) => { coverSeen = e.some((x) => x.isIntersecting); }).observe(canvas);
}

// light rig (Etherea's): sky + a warm low sun. Terra's sun comes in through the +X window wall, as in the Blender file.
const hemi = new THREE.HemisphereLight('#f4f1ec', '#6b5f55', 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffd9b3', 2.6);
sun.position.copy(B(10, -3, 6)); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(phone || cover ? 1024 : 2048, phone || cover ? 1024 : 2048);   // a cover is small: half the shadow detail
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.025;
const sunSweep = cover && !reduce ? coverSun(sun, camera, controls.target, renderer) : null;
if (cover) coverTurn(camera, controls, invalidate, { reduce });
const lamps = new THREE.Group(); scene.add(lamps);
const glowMats = [];
window.__v = { hemi, sun, lamps, scene, renderer, camera, controls, get glow() { return glowMats; } };   // debug hook

// finishing effects: opt-in with ?post, as in Etherea (its pipeline still washes out the untoned window cards)
// loaded only when asked for, so the default page skips N8AO and the extra passes (~150 KB)
const post = cover || !params.has('post') ? null : (await import('../3d/post.js?v=5')).createPost(renderer, scene, camera, { phone });
window.__v.post = post;
let fitted = false;

let renderUntil = 0;
function invalidate(duration = 1500) { renderUntil = Math.max(renderUntil, performance.now() + duration); renderer.shadowMap.needsUpdate = true; }
controls.addEventListener('change', () => invalidate(180));
controls.addEventListener('start', () => invalidate());

const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);
const fill = document.getElementById('fill'), loadEl = document.getElementById('load');
const ON_OUTER_WALL = /^(Cube0(01|08|09|10)|Cube0(5[7-9]|6\d)|Curtain00[23]|Plywood\+backing|81221\+Mirror)/;   // the 4 walls, their windows, curtains, vanity
const walls = []; let rootObj = null, windowMaterial = null, room = null;
loader.load(MODEL, (gltf) => {
  const root = gltf.scene; scene.add(root); rootObj = root;
  root.updateMatrixWorld(true);
  finishTerra(root, renderer, invalidate);
  finishFoliage(root, renderer);   // the same Calathea asset as Etherea's: same leaf finish
  terraPracticals(root, lamps, glowMats);
  terraBacklights(lamps, glowMats);
  root.updateMatrixWorld(true);
  // the room: the walls' footprint (the slab runs past them)
  room = new THREE.Box3();
  root.traverse((o) => { if (o.isMesh && /^Cube0(0[189]|1\d|2\d)$/.test(o.name)) room.expandByObject(o); });
  if (room.isEmpty()) room.setFromObject(root);
  const mid = room.getCenter(new THREE.Vector3()), half = room.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  windowMaterial = terraWindows(scene, walls, room);
  const box = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    [].concat(o.material || []).forEach((m) => { m.dithering = true; m.needsUpdate = true; });   // no banded rings where a lamp fades across the floor (JC 2026-10-22)
    box.setFromObject(o); const sz = box.getSize(new THREE.Vector3());
    if (Math.min(sz.x, sz.y, sz.z) < 0.05 || /curtain/i.test(o.name)) { o.castShadow = false; o.receiveShadow = /curtain/i.test(o.name) ? false : o.receiveShadow; }
    if (/^Concrete Slab/.test(o.name)) { o.castShadow = false; return; }
    // only the four outer walls and what hangs on them (window frames, the window curtains, the vanity) hide with that
    // side when it faces the camera; the sets built against them (the seating nooks, the circle, the arches) stay
    // (JC 2026-10-19: "that seating area is kind of its own set")
    if (!ON_OUTER_WALL.test(o.name) && !ON_OUTER_WALL.test(o.parent?.name || '')) return;
    const c = box.getCenter(new THREE.Vector3()).sub(mid);
    if (Math.abs(c.x) > half.x - 0.45) walls.push({ o, n: new THREE.Vector3(Math.sign(c.x), 0, 0) });
    else if (Math.abs(c.z) > half.z - 0.45) walls.push({ o, n: new THREE.Vector3(0, 0, Math.sign(c.z)) });
  });
  HOME.target.copy(mid).setY(0.6); controls.target.copy(HOME.target); fitted = false; resize();
  loadEl.style.opacity = 0; setTimeout(() => loadEl.remove(), 600);
  // in cover mode inside another page (the 719 hero), say when the model is on screen, so the still in front can fade
  if (cover && window.parent !== window) setTimeout(() => window.parent.postMessage({ type: 'viewer:ready' }, location.origin), 400);
  setMode('golden', true); document.getElementById('overview').disabled = false; invalidate();
  draco.dispose();
  window.__v.ready = true;
  if (debug) {
    console.info('Terra model ready', Math.round(performance.now() - startedAt), 'ms');
    setTimeout(() => { const before = renderer.info.render.frame; setTimeout(() => console.info('Terra idle check', JSON.stringify({ framesInOneSecond: renderer.info.render.frame - before, triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls, textures: renderer.info.memory.textures })), 1000); }, 4000);
  }
}, (e) => { if (e.total) fill.style.width = (100 * e.loaded / e.total) + '%'; },
() => { loadEl.innerHTML = '<span>The loft could not load.</span><span class="err"><button onclick="location.reload()">Try again</button></span>'; });

// Etherea's three presets; sun directions moved to Terra's window wall (+X, Blender)
const LIGHTING = {
  day: { hemi:.65, sun:2.5, lamp:.45, glow:1.4, env:.48, exp:1.0, color:'#fff1df', sky:'#dbe9ef', ground:'#8a7865', pos:B(9,-4,10), window:'#ffffff', backdrop:['#afc4ce','#e3e4dc','#b7b9ae'] },
  golden: { hemi:.4, sun:3.3, lamp:.7, glow:1.8, env:.3, exp:1.02, color:'#ffb96c', sky:'#ead7c0', ground:'#715140', pos:B(11,-3,4.2), window:'#ffd6ad', backdrop:['#b58978','#ecd0ac','#a98970'] },
  night: { hemi:.32, sun:.35, lamp:1, glow:2.6, env:.28, exp:1.05, color:'#cad9f1', sky:'#bac9e0', ground:'#6d5548', pos:B(9,-4,10), window:'#45566e', backdrop:['#46505f','#87919c','#4b5361'] },
};
let mode = 'golden', tween = null;
function setMode(next, instant) {
  mode = next; const to = LIGHTING[next];
  document.documentElement.classList.toggle('studio-world', next === 'night');
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === next));
  tween = { to, from: { hemi: hemi.intensity, sun: sun.intensity, lamp: (lamps.children[0]?.intensity ?? 0) / (lamps.children[0]?.userData.power || 1), glow: glowMats[0]?.emissiveIntensity ?? 0, env: scene.environmentIntensity, exp: renderer.toneMappingExposure },
    backdrop: scene.background?.userData.colors.map((c) => c.clone()), backdropTo: to.backdrop.map((c) => new THREE.Color(c)),
    color: sun.color.clone(), sky: hemi.color.clone(), ground: hemi.groundColor.clone(), pos: sun.position.clone(), window: windowMaterial?.color.clone() ?? new THREE.Color(), t0: performance.now(), dur: instant || reduce ? 0 : 900 };
  invalidate();
}
function applyTween(now) {
  if (!tween) return;
  const a = tween, k = a.dur ? Math.min((now - a.t0) / a.dur, 1) : 1, e = k * k * (3 - 2 * k), v = (key) => THREE.MathUtils.lerp(a.from[key], a.to[key], e);
  hemi.intensity = v('hemi'); sun.intensity = v('sun');
  lamps.children.forEach((l) => (l.intensity = v('lamp') * (l.userData.power || 1) * (mode === 'day' && l.userData.nightOnly ? 0 : 1)));
  glowMats.forEach((m) => (m.emissiveIntensity = v('glow') * (m.userData.practicalStrength ?? 0.35) * (mode === 'day' && m.userData.nightOnly ? 0 : 1)));
  scene.environmentIntensity = v('env'); renderer.toneMappingExposure = v('exp');
  sun.color.copy(a.color).lerp(new THREE.Color(a.to.color), e); hemi.color.copy(a.sky).lerp(new THREE.Color(a.to.sky), e); hemi.groundColor.copy(a.ground).lerp(new THREE.Color(a.to.ground), e);
  sun.position.lerpVectors(a.pos, a.to.pos, e); windowMaterial?.color.copy(a.window).lerp(new THREE.Color(a.to.window), e);
  if (scene.background && a.backdrop) {
    const colors = scene.background.userData.colors;
    colors.forEach((c, i) => c.lerpColors(a.backdrop[i], a.backdropTo[i], e));
    paintBackdrop(scene.background, colors);
  }
  renderer.shadowMap.needsUpdate = true; if (k === 1) tween = null;
}
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// overview: glide back to the opening view
let fly = null;
document.getElementById('overview').addEventListener('click', () => {
  const to = HOME.target.clone().addScaledVector(HOME.dir, HOME.dist || 16);
  fly = { from: camera.position.clone(), fromT: controls.target.clone(), to, toT: HOME.target.clone(), t0: performance.now(), dur: reduce ? 0 : 1100 };
  invalidate(1300);
});
function applyFly(now) {
  if (!fly) return;
  const t = fly.dur ? Math.min((now - fly.t0) / fly.dur, 1) : 1, e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  camera.position.lerpVectors(fly.from, fly.to, e); controls.target.lerpVectors(fly.fromT, fly.toT, e);
  if (t >= 1) fly = null;
}

// ?debug: tap any part of the model to see its name and size (as in Etherea)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pickEl = document.getElementById('pick'); let pickBox = null, down = null;
function pickAt(cx, cy) {
  if (!rootObj) return null;
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(rootObj.children, true).find((h) => h.object.isMesh && h.object.visible);
  if (pickBox) { scene.remove(pickBox); pickBox = null; }
  if (!hit) { pickEl.hidden = true; return null; }
  const o = hit.object, b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), inch = (m) => Math.round(m / 0.0254);
  pickBox = new THREE.Box3Helper(b, 0xff5b35); scene.add(pickBox);
  pickEl.textContent = `${o.name} · ${inch(s.x)}" × ${inch(s.z)}" × ${inch(s.y)}" tall`; pickEl.hidden = false; invalidate(100);
  return (window.__pick = { name: o.name, material: o.material?.name, at: [hit.point.x, -hit.point.z, hit.point.y].map((n) => +n.toFixed(2)) });
}
window.__v.pickAt = pickAt;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; fly = null; });
canvas.addEventListener('pointerup', (e) => {
  if (debug && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 400) pickAt(e.clientX, e.clientY);
  down = null;
});
canvas.addEventListener('pointerdown', () => { const h = document.getElementById('hint'); if (h) h.style.opacity = 0; }, { once: true });

function resize() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; post?.setSize(w, h);
  if (cover && h > w) camera.setViewOffset(w, h, 0, -h * 0.06, w, h); else camera.clearViewOffset();   // raised a bit on the tall card (JC 2026-10-22)
  camera.updateProjectionMatrix();
  if (!fitted && room) {   // far enough back that the whole loft fits the screen (its footprint's half-diagonal)
    fitted = true;
    const size = room.getSize(new THREE.Vector3()), r = 0.5 * Math.hypot(size.x, size.z) + (phone ? 0.2 : 1.0);
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect), vfov = THREE.MathUtils.degToRad(camera.fov);
    const need = r / Math.tan(Math.min(hfov, vfov * 1.25) / 2) * (cover ? (camera.aspect < 1 ? 1.14 : 1.28) : 1);   // cover: about as big in its card as Etherea (a tall grid card: a little bigger)
    HOME.dist = need; controls.maxDistance = Math.max(controls.maxDistance, need * 1.2);
    camera.position.copy(controls.target).addScaledVector(HOME.dir, need);
  }
}
addEventListener('resize', () => { fitted = !!room && fitted; resize(); invalidate(); }); resize();

const toCam = new THREE.Vector3();
function frame(now) {
  applyFly(now); controls.update(); applyTween(now);
  toCam.copy(camera.position).sub(controls.target).setY(0).normalize();
  walls.forEach((w) => {
    const visible = w.n.dot(toCam) < 0.25;
    w.castsShadow ??= w.o.castShadow;
    if (w.o.visible !== visible) renderer.shadowMap.needsUpdate = true;
    w.o.visible = visible; w.o.castShadow = visible && w.castsShadow;
  });
  lamps.children.forEach((light) => { let visible = true; for (let o = light.userData.fixture; o; o = o.parent) if (!o.visible) { visible = false; break; } light.visible = visible; });
  if (sunSweep) sunSweep(now);   // covers: the sun turns with the camera (3d/cover-sun.js)
  if (post) post.render(); else renderer.render(scene, camera);
}
renderer.setAnimationLoop((now) => {
  if (document.hidden) return;
  if (now < renderUntil || tween || fly || (cover && coverSeen && !reduce)) frame(now);
});
addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });
invalidate();
window.__v.frame = () => frame(performance.now() + 1e5);
