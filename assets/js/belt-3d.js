// The JCG Belt, live (2026-10-11, reworked 2026-10-12). The belt holds still and its kit walks round it: every piece
// follows the band's ellipse by arc length (<model>-loop.json, written with the model by export_belt_glb.py), as in
// carousel_turn.py. Two moods:
//   card: the work page's cover, in the drone's cover language (JC: "each product to come alive on hover, and look
//         extremely sexy even when not hovered on - like we did with the drone"). At rest, a close studio shot with the
//         Drone front and centre and the lights dimmed, under the HUD (product-3d.js hud()). Hover wakes it: the
//         lights come up, the HUD reads AWAKE, the kit walks round and follows the pointer sideways. On a phone, being
//         in view wakes it.
//   hero: the Belt page, close in, full width (JC: "the belt should be zoom in and it stays in place while I'm able to
//         rotate the items around it"): drag sideways to send the kit round; it coasts, then settles into a slow walk.
// The static render under it stays until the model has loaded, and is all you get with reduced motion or without WebGL.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const DRACO = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/';
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let modelPromise = null;

function loadModel(url) {
  if (!modelPromise) {
    const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath(DRACO));
    modelPromise = new Promise((res, rej) => loader.load(url, (g) => res(g.scene), undefined, rej));
  }
  return modelPromise.then((s) => s.clone(true));
}

// A soft round contact shadow, drawn once.
function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  r.addColorStop(0, 'rgba(11,12,14,.34)');
  r.addColorStop(.55, 'rgba(11,12,14,.12)');
  r.addColorStop(1, 'rgba(11,12,14,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function mount(host, { model, mode = 'card', fallback = null } = {}) {
  let gl;
  try {
    gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: mode === 'hero' ? 'high-performance' : 'default' });
  } catch (e) {
    return null;
  }
  gl.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  gl.toneMapping = THREE.AgXToneMapping;
  gl.toneMappingExposure = 1.15;
  gl.outputColorSpace = THREE.SRGBColorSpace;
  const cv = gl.domElement;
  cv.className = `belt3d belt3d--${mode}`;
  cv.setAttribute('aria-hidden', 'true');
  host.append(cv);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(gl);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-0.4, 1, 0.6);
  scene.add(key, new THREE.HemisphereLight(0xf2f4f7, 0x9aa0a8, 0.6));
  const cam = new THREE.PerspectiveCamera(24, 1, 0.01, 10);
  const rig = new THREE.Group();          // the lean and lift act here; the model sits centred inside
  scene.add(rig);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  // state: ds is how far the kit has walked round the loop (metres); the card's pointer adds a nudge (dsP) on top
  const s = { ds: 0, dsV: 0, dsP: 0, dsPT: 0, pitch: 0, lean: 0, lift: 0, glow: mode === 'hero' ? 1 : 0.06, awake: mode === 'hero', drag: null };
  const WALK = mode === 'hero' ? 0.009 : 0.03;   // metres a second: the hero's idle walk; the awake card's livelier one
  const hud = host.querySelector('.product-hud');
  let loop = null, pieces = [], glows = [], rest = 0;
  let w = 0, h = 0, size = 0.4, dims = new THREE.Vector3(0.37, 0.05, 0.29), visible = true, raf = 0, last = performance.now(), ready = false;

  const resize = () => {
    const r = host.getBoundingClientRect();
    w = Math.max(1, host.clientWidth || r.width);
    h = Math.max(1, host.clientHeight || r.height);
    if (mode === 'hero') {                 // close in, the belt runs the page's full width (the hero clips it at the edges)
      w = document.documentElement.clientWidth;
      cv.style.left = `${-r.left}px`;
      cv.style.maxWidth = "none";
    }
    gl.setSize(w, h, false);
    cv.style.width = mode === 'hero' ? `${w}px` : '100%';
    cv.style.height = '100%';
    cam.aspect = w / h;
    frame();
    cam.updateProjectionMatrix();
  };
  // fit: the belt's width fills a share of the frame's width, unless its tipped depth needs more room. The hero sits
  // close, a little above the front of the loop, so the kit passes right by the lens.
  const frame = () => {
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const narrow = cam.aspect < 1.3;                                  // phones and portrait cards: the front few pieces
    const span = mode === 'card' ? 0.26 : narrow ? 0.19 : Math.min(dims.x * 0.78, 0.30);   // frame width at the front
    const d = span / (2 * t * cam.aspect) + 0.04;
    const front = dims.z * 0.32, el = THREE.MathUtils.degToRad(mode === 'card' ? 32 : narrow ? 24 : 20);
    cam.position.set(0, Math.sin(el) * d, front + Math.cos(el) * d);
    cam.lookAt(0, mode === 'card' ? 0.075 : 0.012, front * 0.55);   // hero: the far rim clears the wordmark; card: it sits low, under the name
  };

  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const e = (k) => Math.min(1, dt * k);
    if (mode === 'hero') {
      if (!s.drag) {
        s.ds += s.dsV * dt;
        s.dsV += (WALK - s.dsV) * e(2.2);                              // a fling coasts, then settles to the walk
      }
    } else if (s.awake) {
      s.dsV += (WALK - s.dsV) * e(2);
      s.ds += s.dsV * dt;
    } else {                                                          // asleep: ease onto the nearest link and stop
      const link = loop ? loop.loop / loop.links : 0.036;
      const to = rest + Math.round((s.ds - rest) / link) * link;
      s.dsV = 0;
      s.ds += (to - s.ds) * e(2.5);
    }
    s.dsP += (s.dsPT - s.dsP) * e(4);
    s.glow += ((s.awake ? 1 : 0.06) - s.glow) * e(4);
    for (const g of glows) g.mat.emissiveIntensity = g.base * s.glow;
    s.pitch += ((s.awake ? s.lean * 0.05 : 0) - s.pitch) * e(5);
    s.lift += ((s.awake && mode === 'card' ? 0.006 : 0) - s.lift) * e(5);
    rig.rotation.set(s.pitch, 0, 0);
    rig.position.y = s.lift;
    shadow.position.y = -0.03;
    shadow.material.opacity = 1 - s.lift * 30;
    if (loop) walk();
    gl.render(scene, cam);
    if (visible && !still()) raf = requestAnimationFrame(tick);
  };
  // the loop: arc length -> [x, z, tangent angle], sampled evenly; a piece that sat at s0 is turned about Y by the change
  // in tangent angle about its old loop point and set down on the new one
  const at = (sArc) => {
    const n = loop.samples.length, f = (((sArc / loop.loop) % 1) + 1) % 1 * n, i = Math.floor(f) % n, k = f - Math.floor(f);
    const a = loop.samples[i], b = loop.samples[(i + 1) % n];
    let dth = b[2] - a[2];
    dth -= Math.round(dth / (2 * Math.PI)) * 2 * Math.PI;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + dth * k];
  };
  const mA = new THREE.Matrix4(), mB = new THREE.Matrix4();
  const walk = () => {
    for (const p of pieces) {
      const [x1, z1, t1] = at(p.s0 + s.ds + s.dsP);
      p.node.matrix.makeTranslation(x1, 0, z1)
        .multiply(mA.makeRotationY(t1 - p.t0))
        .multiply(mB.makeTranslation(-p.x0, 0, -p.z0));
    }
  };
  const play = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(tick); };

  const loopReq = fetch(model.replace(/\.glb(\?.*)?$/, '-loop.json')).then((r) => r.json());
  Promise.all([loadModel(model), loopReq]).then(([m, lp]) => {
    const box = new THREE.Box3().setFromObject(m);
    const c = box.getCenter(new THREE.Vector3());
    m.position.sub(c);
    dims = box.getSize(new THREE.Vector3());
    size = dims.length() * 0.92;
    // the lights (the orange glows): their own copies, so dimming this one doesn't dim another mount's
    const seen = new Map();
    m.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const one = (mat) => {
        if (!(mat.emissive && mat.emissiveIntensity > 0 && mat.emissive.getHex())) return mat;
        if (!seen.has(mat)) { const c = mat.clone(); seen.set(mat, c); glows.push({ mat: c, base: mat.emissiveIntensity }); }
        return seen.get(mat);
      };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
    });
    rig.add(m);
    if (lp) {
      loop = lp;
      m.traverse((o) => {
        if (o.name in lp.pieces) {
          const [x0, z0, t0] = at(lp.pieces[o.name]);
          o.matrixAutoUpdate = false;
          pieces.push({ node: o, s0: lp.pieces[o.name], x0, z0, t0 });
        }
      });
      // the resting shot: the Drone front and centre
      const drone = Object.keys(lp.roots || {}).find((k) => lp.roots[k] === 'Wisp flight');
      rest = drone ? -lp.pieces[drone] : 0;
      s.ds = rest;
      walk();
    }
    for (const g of glows) g.mat.emissiveIntensity = g.base * s.glow;
    shadow.scale.set(size * 1.25, size * 0.95, 1);
    resize();
    ready = true;
    gl.render(scene, cam);
    host.classList.add('belt3d-ready');
    if (fallback) fallback.classList.add('belt3d-hidden');
    play();
  }).catch(() => cv.remove());

  new ResizeObserver(resize).observe(host);
  if (mode === 'hero') addEventListener('resize', resize);
  new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
    if (visible && ready) play(); else cancelAnimationFrame(raf);
  }, { rootMargin: '100px' }).observe(host);

  const wake = (on) => {
    s.awake = on;
    host.classList.toggle('is-awake', on);
    hud?.classList.toggle('is-awake', on);
  };
  if (mode === 'card') {
    const hoverEl = host.closest('a, .frame') || host;
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      hoverEl.addEventListener('pointerenter', () => wake(true));
      hoverEl.addEventListener('pointerleave', () => { wake(false); s.dsPT = 0; s.lean = 0; });
      hoverEl.addEventListener('pointermove', (e) => {
        const r = host.getBoundingClientRect();
        s.dsPT = ((e.clientX - r.left) / r.width - 0.5) * 0.1;         // the kit leans after the pointer, ±5 cm round the loop
        s.lean = ((e.clientY - r.top) / r.height - 0.5) * 2;
      });
    } else {                                                          // phones: awake while the card is mostly in view
      new IntersectionObserver(([en]) => wake(en.intersectionRatio > 0.6), { threshold: [0, 0.6, 1] }).observe(host);
    }
  } else {
    // drag sideways: the piece under your finger follows it round the loop (pixels to metres at the front of the loop);
    // vertical drags still scroll the page
    cv.style.touchAction = 'pan-y';
    cv.style.cursor = 'grab';
    const pxPerM = () => {
      const a = new THREE.Vector3(0, 0, dims.z / 2).project(cam), b = new THREE.Vector3(0.01, 0, dims.z / 2).project(cam);
      return Math.max(1, Math.abs(b.x - a.x) / 2 * w / 0.01);
    };
    cv.addEventListener('pointerdown', (e) => {
      s.drag = { x: e.clientX, t: e.timeStamp };
      s.dsV = 0;
      cv.setPointerCapture(e.pointerId);
      cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', (e) => {
      if (!s.drag) return;
      const dx = (e.clientX - s.drag.x) / pxPerM(), dt = Math.max(8, e.timeStamp - s.drag.t) / 1000;
      s.ds += dx;
      s.dsV = Math.max(-0.6, Math.min(0.6, dx / dt));
      s.drag = { x: e.clientX, t: e.timeStamp };
    });
    const up = () => { s.drag = null; cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }
  return { el: cv };
}
