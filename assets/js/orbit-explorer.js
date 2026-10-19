// ORBIT: the HALO workbench (prototype, 2026-10-12; brief V3 §5A, Act IV). The page's one live 3D scene. HALO's fit
// band holds still and its outer carousel turns round it, as the real mechanism does: every piece walks the band's
// ellipse by arc length (belt-loop.json, written with the model by wisp/3d/export_belt_glb.py).
//
// States: idle -> selected -> undocked -> (in-use, owned by the page) and back the same way.
//   idle      drag sideways to turn the carousel; it coasts, then settles on the nearest link (a detent).
//   selected  the carousel takes the shortest way round to bring the module to the front and clicks into place.
//   undocked  the module comes off: for WISP, the modelled release itself (Blender frames 1-92: the release press,
//             the latches, the lift-off and turn); for the rest, a short straight lift clear of the dock. Then it
//             floats to you, its lights wake, and dragging turns it in your hand.
// The page (orbit.js) owns the HTML: rail, panel, buttons, captions. This module draws, moves, and reports.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const DRACO = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/';
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wrapS = (s, P) => ((s % P) + P) % P;

// a damped spring toward a target: interruptible, with a touch of overshoot so a stop lands like a detent
function spring(x = 0, { k = 70, zeta = 0.78 } = {}) {
  return {
    x, v: 0, t: x,
    step(dt) {
      const c = 2 * zeta * Math.sqrt(k);
      this.v += (k * (this.t - this.x) - c * this.v) * dt;
      this.x += this.v * dt;
    },
    jump(v) { this.x = this.t = v; this.v = 0; },
    get busy() { return Math.abs(this.t - this.x) > 1e-3 || Math.abs(this.v) > 1e-3; },
  };
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  r.addColorStop(0, 'rgba(11,12,14,.30)');
  r.addColorStop(0.6, 'rgba(11,12,14,.10)');
  r.addColorStop(1, 'rgba(11,12,14,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/**
 * host: the stage element. products: [{ id, roots: [Blender root names] }] (no roots = HALO itself).
 * on: { state(name, id), pin(x, y, visible), phase(text), ready(), turned(), taught() } callbacks for the page.
 */
export function createExplorer(host, { model: modelUrl, loopUrl, products, on = {} }) {
  let gl;
  try {
    gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  gl.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  gl.toneMapping = THREE.AgXToneMapping;
  gl.toneMappingExposure = 1.15;
  gl.outputColorSpace = THREE.SRGBColorSpace;
  const cv = gl.domElement;
  cv.className = 'ox-canvas';
  cv.setAttribute('aria-hidden', 'true');
  host.append(cv);

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-0.5, 1, 0.7);
  scene.add(key, new THREE.HemisphereLight(0xf4f5f7, 0x9aa0a8, 0.6));
  const cam = new THREE.PerspectiveCamera(26, 1, 0.01, 10);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  // motion: the carousel's walk (metres round the loop), the camera's framing (0 the whole belt, 1 up close), the
  // undocked module's mechanism (mech: 0..1 through its release, linear so a modelled clip plays as modelled),
  // float (0 off the dock, 1 in your hand), its turn in your hand, and its lights
  const walk = spring(0, { k: 60, zeta: 0.74 });
  const frameS = spring(0, { k: 22, zeta: 1 });
  const float = spring(0, { k: 26, zeta: 0.92 });
  const turn = spring(0, { k: 40, zeta: 0.9 });
  const glow = spring(0, { k: 30, zeta: 1 });
  let mech = 0;
  let state = 'idle', sel = null, drag = null, coast = 0, teaching = null, turnedOnce = false;
  let loop = null, pieces = [], byRoot = new Map(), dims = new THREE.Vector3(0.373, 0.054, 0.288), w = 1, h = 1;
  let visible = true, raf = 0, last = 0, ready = false, model = null, phase = '';
  const glows = [];
  const LINK = () => (loop ? loop.loop / loop.links : 0.0362);
  const say = (t) => { if (t !== phase) { phase = t; on.phase?.(t); } };

  const at = (s) => {
    const n = loop.samples.length, f = wrapS(s / loop.loop, 1) * n, i = Math.floor(f) % n, k = f - Math.floor(f);
    const a = loop.samples[i], b = loop.samples[(i + 1) % n];
    let d = b[2] - a[2];
    d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + d * k];
  };
  const anchor = (p) => {
    let x = 0, y = 0;
    for (const n of p.nodes) { const a = (n.s0 / loop.loop) * 2 * Math.PI; x += Math.cos(a); y += Math.sin(a); }
    return wrapS((Math.atan2(y, x) / (2 * Math.PI)) * loop.loop, loop.loop);
  };
  const toFront = (s) => { const P = loop.loop, want = -s; return want + Math.round((walk.x - want) / P) * P; };

  const mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), mC = new THREE.Matrix4(), mD = new THREE.Matrix4(), mT = new THREE.Matrix4();
  const centre = new THREE.Vector3(), v3 = new THREE.Vector3();
  // a module's modelled clip at progress p (0..1): the sampled delta, interpolated between its 24 fps frames
  const clipAt = (clip, p, out) => {
    const f = Math.min(clip.end, Math.max(0, p * clip.end)), i = Math.floor(f), k = f - i;
    const a = clip.frames[i], b = clip.frames[Math.min(clip.end, i + 1)], e = out.elements;
    for (let j = 0; j < 16; j++) e[j] = a[j] + (b[j] - a[j]) * k;
    return out;
  };
  const place = () => {
    for (const n of pieces) {
      const [x1, z1, t1] = at(n.s0 + walk.x);
      n.node.matrix.makeTranslation(x1, 0, z1).multiply(mA.makeRotationY(t1 - n.t0)).multiply(mB.makeTranslation(-n.x0, 0, -n.z0));
    }
    if (!sel || !sel.nodes.length || !sel.mid) return;
    if (sel.clip && mech > 0) sel.clip.node.node.matrix.multiply(clipAt(sel.clip, mech, mD));   // the modelled release
    const lift = sel.clip ? 0 : 0.014 * Math.min(1, mech * 1.5);                              // or a plain lift clear
    const f = float.x;
    if (lift > 0 || f > 1e-4 || Math.abs(turn.x) > 1e-4) {
      v3.set(sel.offset.x * f, sel.offset.y * f + lift, sel.offset.z * f + lift * 0.6);
      mC.makeTranslation(sel.mid.x + v3.x, sel.mid.y + v3.y, sel.mid.z + v3.z)
        .multiply(mA.makeRotationY(turn.x))
        .multiply(mB.makeRotationX(0.32 * f))
        .multiply(mT.makeTranslation(-sel.mid.x, -sel.mid.y, -sel.mid.z));
      for (const n of sel.nodes) n.node.matrix.premultiply(mC);
    }
  };
  const boxOf = (p) => {
    const box = new THREE.Box3();
    for (const n of p.nodes) { n.node.updateMatrixWorld(true); box.expandByObject(n.node); }
    return box;
  };
  // measure the selected module where it will be: docked at the front, and at the end of its release
  const measure = () => {
    const saved = [walk.x, mech, float.x, turn.x];
    walk.x = walk.t; mech = 0; float.x = 0; turn.x = 0;
    sel.mid = null;
    place();
    let box = boxOf(sel);
    box.getCenter(centre);
    model.worldToLocal(centre);
    sel.size = box.getSize(v3).length();
    sel.mid = centre.clone();
    sel.offset = new THREE.Vector3();
    if (sel.clip) {
      mech = 1;
      place();
      box = boxOf(sel);
      box.getCenter(v3);
      model.worldToLocal(v3);
      sel.mid = v3.clone();
    }
    // where it floats to: up and toward the camera, by its size
    sel.offset.set(-sel.mid.x * 0.4, 0.03 + sel.size * 0.25 - (sel.mid.y - centre.y), 0.06 + sel.size * 0.2);
    [walk.x, mech, float.x, turn.x] = saved;
    place();
  };
  // where the selected module is now (for the camera and the pin)
  const focus = (out) => {
    const m = sel.clip ? mech : 0;
    return out.set(centre.x + (sel.mid.x - centre.x) * m + sel.offset.x * float.x,
      centre.y + (sel.mid.y - centre.y) * m + sel.offset.y * float.x,
      centre.z + (sel.mid.z - centre.z) * m + sel.offset.z * float.x);
  };

  // the camera: the whole belt from the front and a little above; closer on a selection; up close when undocked
  const look = new THREE.Vector3(), fv = new THREE.Vector3();
  const aim = () => {
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), narrow = cam.aspect < 1;
    const whole = Math.max(dims.x * 0.98 / (2 * t * cam.aspect), dims.z * 1.25 / (2 * t)) + dims.z * 0.5;
    const el = THREE.MathUtils.degToRad(narrow ? 30 : 24);
    const f = frameS.x, on_ = sel && sel.nodes.length && sel.mid;
    // up close: about two and a half module-widths across (tighter once it's in your hand)
    const span = Math.max(0.09, (sel?.size || 0.08) * (state === 'undocked' ? 1.9 : 2.4));
    const near = on_ ? Math.min(whole * (state === 'undocked' ? 0.42 : 0.62), span / (2 * t * Math.min(1, cam.aspect))) : whole * 0.6;
    const fd = whole + (near - whole) * f;
    if (on_) focus(fv).multiplyScalar(f); else fv.set(0, 0, dims.z * 0.5 * f);
    look.set(fv.x, fv.y - 0.01 * (1 - f), fv.z);
    cam.position.set(look.x, look.y + Math.sin(el) * fd, look.z + Math.cos(el) * fd);
    cam.lookAt(look);
    // on a wide stage the subject sits left of centre, clear of the panel on the right
    if (cam.aspect > 1.25 && state !== 'idle') cam.translateX(0.34 * fd * t * cam.aspect * Math.min(1, f * 3));
  };

  const resize = () => {
    w = Math.max(1, host.clientWidth);
    h = Math.max(1, host.clientHeight);
    gl.setSize(w, h, false);
    cv.style.width = '100%';
    cv.style.height = '100%';
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    aim();
  };

  const pinV = new THREE.Vector3();
  const report = () => {
    if (!on.pin) return;
    if (!sel || !sel.nodes.length || state === 'idle' || !sel.mid) return on.pin(0, 0, false);
    focus(pinV).y += 0.012;
    model.localToWorld(pinV);
    pinV.project(cam);
    on.pin((pinV.x * 0.5 + 0.5) * w, (-pinV.y * 0.5 + 0.5) * h, pinV.z < 1);
  };

  // undock: the release first, then the float. Redock: the float back, then the release in reverse.
  const sequence = (dt) => {
    if (!sel || !sel.nodes.length) return;
    const speed = sel.clip ? sel.clipSpeed : 2;
    if (state === 'undocked') {
      if (mech < 1) {
        mech = Math.min(1, mech + dt * speed);
        const fr = mech * (sel.clip ? sel.clip.end : 30);
        if (sel.clip) say(fr < 26 ? 'Release pressed' : fr < 30 ? 'Latches open' : fr < 64 ? 'Lifting off the dock' : 'Clear of HALO');
        else say(mech < 0.4 ? 'Release pressed' : 'Clear of the dock');
        if (mech >= 1) { float.t = 1; turn.t = -0.45; glow.t = 1; }
      } else if (!float.busy) say('In your hand · drag to turn it');
    } else if (state !== 'in-use' && mech > 0) {
      float.t = 0; turn.t = 0; glow.t = 0;
      if (float.x < 0.03) {
        mech = Math.max(0, mech - dt * speed * 1.4);
        say(mech > 0 ? 'Docking' : 'Docked');
        if (mech === 0 && state === 'idle') sel = null;
      }
    }
  };

  const tick = (now) => {
    const dt = Math.min(0.04, (now - last) / 1000 || 0.016);
    last = now;
    if (teaching) teaching(dt);
    if (!drag && Math.abs(coast) > 0.002) {
      walk.t = walk.x += coast * dt;
      coast *= Math.pow(0.04, dt);
      if (Math.abs(coast) <= 0.002) walk.t = Math.round(walk.x / LINK()) * LINK();
    }
    if (!drag) walk.step(dt);
    sequence(still() ? 10 : dt);
    frameS.step(dt); float.step(dt); turn.step(dt); glow.step(dt);
    for (const g of glows) g.mat.emissiveIntensity = g.base * (0.08 + 0.92 * (g.owner === sel ? glow.x : 0));
    place();
    aim();
    gl.render(scene, cam);
    report();
    if (visible) raf = requestAnimationFrame(tick);
  };
  const play = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(tick); };

  const go = (name) => {
    state = name;
    on.state?.(state, sel?.id || null);
    if (still()) for (const s of [walk, frameS, float, turn, glow]) s.jump(s.t);
  };
  const redockNow = () => { mech = 0; float.jump(0); turn.jump(0); glow.jump(0); };

  const api = {
    get ready() { return ready; },
    get state() { return state; },
    get selected() { return sel?.id || null; },
    select(id) {
      const p = products.find((x) => x.id === id);
      if (!p || !ready) return;
      teaching = null;
      if (sel !== p) redockNow();
      sel = p;
      coast = 0;
      walk.t = p.nodes.length ? toFront(anchor(p)) : Math.round(walk.x / LINK()) * LINK();
      frameS.t = p.nodes.length ? 0.4 : 0.12;
      float.t = 0; turn.t = 0; glow.t = 0;
      if (p.nodes.length) measure();
      say(p.nodes.length ? 'At the front' : '');
      go('selected');
    },
    undock() {
      if (!sel || !sel.nodes.length) return;
      if (walk.busy) walk.jump(walk.t);                  // at the front and docked before it lets go
      if (!mech) measure();
      frameS.t = 1;
      mech = Math.max(mech, 0.0001);
      go('undocked');
    },
    use() { if (sel) go('in-use'); },
    back() {
      if (state === 'in-use') { go(sel?.nodes.length && mech > 0 ? 'undocked' : 'selected'); return; }
      if (state === 'undocked') { frameS.t = 0.4; go('selected'); return; }
      if (state === 'selected') api.reset();
    },
    reset() {
      teaching = null;
      frameS.t = 0;
      if (!(sel && mech > 0)) sel = null;               // an undocked module docks first, then lets go of the selection
      walk.t = Math.round(walk.x / LINK()) * LINK();
      go('idle');
      say('');
    },
    // the opening lesson: the carousel walks three links round the still fit band, then hands over
    teach() {
      if (!ready || teaching || state !== 'idle' || still()) { on.taught?.(); return; }
      let t = 0;
      const start = Math.round(walk.x / LINK()) * LINK();
      teaching = (dt) => {
        t += dt;
        if (t < 1.2) say('The fit band stays still');
        else if (t < 4) { say('The carousel turns round it'); walk.t = start + Math.min(3, Math.floor(((t - 1.2) / 2.8) * 4)) * LINK(); }
        else if (t < 5.4) say('Each link is a detent');
        else { teaching = null; say(''); on.taught?.(); }
      };
    },
  };

  // drag: idle or selected, it turns the carousel; undocked, it turns the module in your hand. Vertical drags scroll.
  cv.style.touchAction = 'pan-y';
  const pxPerM = () => {
    const a = new THREE.Vector3(0, 0, dims.z / 2).project(cam), b = new THREE.Vector3(0.01, 0, dims.z / 2).project(cam);
    return Math.max(1, (Math.abs(b.x - a.x) / 2) * w / 0.01);
  };
  cv.addEventListener('pointerdown', (e) => {
    if (!ready || e.button > 0) return;
    drag = { x: e.clientX, t: e.timeStamp, v: 0, moved: false };
    coast = 0;
    cv.setPointerCapture(e.pointerId);
    host.classList.add('is-dragging');
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dt = Math.max(8, e.timeStamp - drag.t) / 1000;
    if (!drag.moved && Math.abs(dx) < 4) return;
    if (!drag.moved) {
      drag.moved = true;
      teaching = null;
      if (state === 'selected') api.reset();
    }
    if (state === 'undocked') {
      turn.t = turn.x = turn.x + dx * 0.012;
    } else if (state === 'idle') {
      const ds = dx / pxPerM();
      walk.x += ds;
      walk.t = walk.x;
      drag.v = Math.max(-0.5, Math.min(0.5, ds / dt));
      if (!turnedOnce && Math.abs(walk.x) > LINK()) { turnedOnce = true; on.turned?.(); }
    }
    drag.x = e.clientX; drag.t = e.timeStamp;
  });
  const up = () => {
    if (!drag) return;
    if (drag.moved && state === 'idle') {
      coast = drag.v;
      if (Math.abs(coast) <= 0.002) walk.t = Math.round(walk.x / LINK()) * LINK();
    }
    drag = null;
    host.classList.remove('is-dragging');
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  // with the stage focused, the arrow keys step the carousel a link (a convenience: the rail does the same job)
  host.addEventListener('keydown', (e) => {
    if (state !== 'idle' || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    teaching = null;
    walk.t = Math.round(walk.t / LINK()) * LINK() + (e.key === 'ArrowRight' ? LINK() : -LINK());
  });

  const draco = new DRACOLoader().setDecoderPath(DRACO);
  Promise.all([
    new Promise((res, rej) => new GLTFLoader().setDRACOLoader(draco).load(new URL(modelUrl, location.href).href, (g) => res(g.scene), undefined, rej)),
    fetch(loopUrl).then((r) => r.json()),
  ]).then(([m, lp]) => {
    model = m;
    loop = lp;
    const box = new THREE.Box3().setFromObject(m);
    m.position.sub(box.getCenter(new THREE.Vector3()));
    dims = box.getSize(new THREE.Vector3());
    scene.add(m);
    m.traverse((o) => {
      if (o.name in lp.pieces) {
        const [x0, z0, t0] = at(lp.pieces[o.name]);
        o.matrixAutoUpdate = false;
        const n = { node: o, s0: lp.pieces[o.name], x0, z0, t0 };
        pieces.push(n);
        byRoot.set(lp.roots[o.name], n);
      }
    });
    for (const p of products) {
      p.nodes = (p.roots || []).map((r) => byRoot.get(r)).filter(Boolean);
      // a modelled release clip, if the export carried one for this module (WISP's, frames 1-92 at 24 fps, played
      // at 1.6x), else the plain lift
      for (const r of p.roots || []) {
        const c = lp.mech?.[r];
        if (c && byRoot.get(r)) {
          p.clip = { node: byRoot.get(r), frames: c.frames, end: Math.min(c.frames.length - 1, 91) };
          p.clipSpeed = (c.fps * 1.6) / p.clip.end;
        }
      }
      // its lights: its own copies, asleep while docked, awake once it's in your hand
      for (const n of p.nodes) n.node.traverse((o) => {
        if (!o.isMesh) return;
        const one = (mat) => {
          if (!(mat.emissive && mat.emissiveIntensity > 0 && mat.emissive.getHex())) return mat;
          const c = mat.clone();
          glows.push({ mat: c, base: mat.emissiveIntensity, owner: p });
          return c;
        };
        o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
      });
    }
    walk.jump(0);
    shadow.position.y = -dims.y / 2 - 0.004;
    shadow.scale.set(dims.x * 1.5, dims.z * 1.6, 1);
    resize();
    place();
    ready = true;
    gl.render(scene, cam);
    host.classList.add('ox-ready');
    on.ready?.();
    play();
  }).catch((err) => {
    console.warn('[orbit] workbench could not load', err);
    cv.remove();
    host.classList.add('ox-failed');
  });

  new ResizeObserver(resize).observe(host);
  new IntersectionObserver((es) => {
    visible = es.some((x) => x.isIntersecting);
    if (visible && ready) play(); else cancelAnimationFrame(raf);
  }, { rootMargin: '120px' }).observe(host);

  return api;
}
