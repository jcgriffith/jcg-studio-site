// ORBIT's optional HALO lab. The fit band stays put while the source-model
// components travel along its measured rail. The page owns copy and controls.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const DRACO = new URL('../vendor/three/examples/jsm/libs/draco/gltf/', import.meta.url).href;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const wrap = (n, p) => ((n % p) + p) % p;
const TAU = Math.PI * 2;
function spring(value, k = 52, damping = 0.92) {
  return {
    x: value, t: value, v: 0,
    jump(n) { this.x = this.t = n; this.v = 0; },
    step(dt) {
      this.v += (k * (this.t - this.x) - 2 * damping * Math.sqrt(k) * this.v) * dt;
      this.x += this.v * dt;
      const moving = Math.abs(this.t - this.x) + Math.abs(this.v) > 0.000015;
      if (!moving) this.jump(this.t);
      return moving;
    },
  };
}

/**
 * Returns an imperative controller, or null if WebGL cannot start.
 * rotate(delta): number of rail detents, or radians of the inspected object.
 * zoom(delta): positive values zoom in, negative values zoom out (1 = one step).
 * on.progress receives 0..1. on.error permits the page to retain its static image.
 * Nothing captures wheel events; vertical touch gestures keep scrolling the page.
 */
export function createExplorer(host, { model: modelUrl, loopUrl, products = [], on = {}, frameWidth = 0.88 }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    on.error?.(error);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.setClearColor(0x0d1114, 0);
  const canvas = renderer.domElement;
  canvas.className = 'ox-canvas orbit-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab';
  host.append(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.035);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.72;
  room.dispose();
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xfff4e8, 3.1);
  key.position.set(-0.6, 0.9, 0.8);
  const edge = new THREE.DirectionalLight(0xd6e9ff, 2.3);
  edge.position.set(0.4, 0.5, -0.6);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(0.8, 0.1, 0.4);
  scene.add(key, edge, fill, new THREE.HemisphereLight(0xe6f0fa, 0x22252d, 0.55));
  const camera = new THREE.PerspectiveCamera(29, 1, 0.005, 20);
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const aborter = new AbortController();
  const entries = products.map((p) => ({ ...p, nodes: [], center: new THREE.Vector3(), size: new THREE.Vector3() }));
  const pieces = [];
  const originalMaterials = new Map();
  const labMaterials = new Map();
  const disposers = [];
  const walk = spring(0, 62, 0.8);
  const framing = spring(0, 28, 1);
  const lift = spring(0, 36, 0.95);
  const turn = spring(0, 48, 0.9);
  const yaw = spring(-0.10, 38, 1);
  const pitch = spring(0.55, 38, 1);
  const magnify = spring(1, 40, 1);
  const springs = [walk, framing, lift, turn, yaw, pitch, magnify];
  let model = null, loop = null, ready = false, disposed = false, lost = false;
  let visible = true, paused = false, lab = false, dragMode = 'carousel';
  let selected = null, active = null, pending = undefined, inspectRequested = false;
  let state = 'idle', drag = null, coast = 0, raf = 0, last = 0;
  let width = 1, height = 1, dimensions = new THREE.Vector3(0.38, 0.06, 0.3);
  const instant = () => paused || motionPreference.matches;
  const detent = () => loop.loop / loop.links;
  const listen = (node, event, listener, options) => {
    node.addEventListener(event, listener, options);
    disposers.push(() => node.removeEventListener(event, listener, options));
  };
  const wake = () => {
    if (disposed || lost || !ready || !visible || document.hidden || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
  const notify = () => on.state?.(state, selected?.id || null);
  const at = (s) => {
    const n = loop.samples.length;
    const f = wrap(s / loop.loop, 1) * n;
    const i = Math.floor(f), fraction = f - i;
    const a = loop.samples[i % n], b = loop.samples[(i + 1) % n];
    let angle = b[2] - a[2];
    angle -= Math.round(angle / TAU) * TAU;
    return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction, a[2] + angle * fraction];
  };
  const aMatrix = new THREE.Matrix4(), bMatrix = new THREE.Matrix4(), cMatrix = new THREE.Matrix4();
  const dMatrix = new THREE.Matrix4(), liftMatrix = new THREE.Matrix4();
  const setPiece = (piece, distance) => {
    const [x, z, angle] = at(piece.s0 + distance);
    piece.node.matrix.makeTranslation(x, 0, z)
      .multiply(aMatrix.makeRotationY(angle - piece.t0))
      .multiply(bMatrix.makeTranslation(-piece.x0, 0, -piece.z0))
      .multiply(piece.base);
    piece.node.matrixWorldNeedsUpdate = true;
  };
  const offset = new THREE.Vector3();
  const place = () => {
    if (!model) return;
    for (const piece of pieces) setPiece(piece, walk.x);
    if (active?.nodes.length && (lift.x > 0.000001 || Math.abs(turn.x) > 0.000001)) {
      const release = Math.min(1, lift.x * 4);
      const float = Math.max(0, (lift.x - 0.25) / 0.75);
      offset.set(0, active.rise * float, 0.015 * release + active.out * float);
      const center = active.center;
      liftMatrix.makeTranslation(center.x + offset.x, center.y + offset.y, center.z + offset.z)
        .multiply(cMatrix.makeRotationY(turn.x))
        .multiply(dMatrix.makeRotationX(0.22 * float))
        .multiply(aMatrix.makeTranslation(-center.x, -center.y, -center.z));
      for (const piece of active.nodes) {
        piece.node.matrix.premultiply(liftMatrix);
        piece.node.matrixWorldNeedsUpdate = true;
      }
    }
    model.updateMatrixWorld(true);
  };
  const anchor = (product) => {
    let x = 0, y = 0;
    for (const piece of product.nodes) {
      const angle = piece.s0 / loop.loop * TAU;
      x += Math.cos(angle); y += Math.sin(angle);
    }
    return wrap(Math.atan2(y, x) / TAU * loop.loop, loop.loop);
  };
  const front = (product) => {
    if (!product.nodes.length) return Math.round(walk.x / detent()) * detent();
    const target = -anchor(product);
    return target + Math.round((walk.x - target) / loop.loop) * loop.loop;
  };
  const measure = (product) => {
    if (!product.nodes.length) return;
    for (const piece of product.nodes) setPiece(piece, walk.t);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const piece of product.nodes) box.expandByObject(piece.node);
    box.getCenter(product.center);
    model.worldToLocal(product.center);
    box.getSize(product.size);
    const length = product.size.length();
    product.rise = 0.04 + length * 0.18;
    product.out = 0.06 + length * 0.13;
    place();
  };
  const bindPending = () => {
    if (pending === undefined) return;
    active = pending;
    pending = undefined;
    lift.jump(0); turn.jump(0);
    if (active) {
      walk.t = front(active);
      measure(active);
      framing.t = active.nodes.length ? 0.12 : 0;
      yaw.t = -0.035;
    } else {
      framing.t = 0;
      walk.t = Math.round(walk.x / detent()) * detent();
    }
  };
  const advance = () => {
    if (pending !== undefined && Math.abs(lift.x) < 0.001 && Math.abs(turn.x) < 0.002) bindPending();
    if (inspectRequested && active && pending === undefined && Math.abs(walk.t - walk.x) < 0.001 && Math.abs(walk.v) < 0.004) {
      framing.t = active.nodes.length ? 1 : 0.15;
      lift.t = active.nodes.length ? 1 : 0;
      turn.t = active.nodes.length ? -0.28 : 0;
      inspectRequested = false;
    }
  };
  const settle = () => {
    // State-machine transitions get their own settle pass, including queued return -> select -> undock.
    for (let i = 0; i < 3; i++) { for (const s of springs) s.jump(s.t); advance(); }
    for (const s of springs) s.jump(s.t);
  };
  const look = new THREE.Vector3(), worldCenter = new THREE.Vector3();
  const aim = () => {
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const narrow = camera.aspect < 0.9;
    const fillWidth = narrow ? 0.92 : clamp(frameWidth, 0.45, 0.96);
    const elevation = pitch.x;
    const projectedHeight = dimensions.z * Math.sin(elevation) + dimensions.y * Math.cos(elevation);
    const whole = Math.max(dimensions.x / (2 * tangent * camera.aspect * fillWidth), projectedHeight / (2 * tangent * 0.76)) + dimensions.z * 0.26;
    let near = whole * 0.84;
    look.set(0, -0.004, 0);
    if (active?.nodes.length) {
      worldCenter.copy(active.center);
      const floating = Math.max(0, (lift.x - 0.25) / 0.75);
      worldCenter.y += active.rise * floating;
      worldCenter.z += 0.015 * Math.min(1, lift.x * 4) + active.out * floating;
      model.localToWorld(worldCenter);
      look.lerp(worldCenter, framing.x);
      const objectWidth = Math.max(active.size.x, active.size.z, 0.055);
      near = Math.max(objectWidth / (2 * tangent * camera.aspect * 0.57), active.size.length() / (2 * tangent * 0.83));
      near = Math.min(whole * 0.82, Math.max(0.2, near));
    }
    const distance = (whole + (near - whole) * framing.x) / magnify.x;
    camera.position.set(
      look.x + Math.sin(yaw.x) * Math.cos(elevation) * distance,
      look.y + Math.sin(elevation) * distance,
      look.z + Math.cos(yaw.x) * Math.cos(elevation) * distance,
    );
    camera.lookAt(look);
    camera.updateMatrixWorld();
  };
  const pin = new THREE.Vector3();
  const render = () => {
    place(); aim();
    renderer.render(scene, camera);
    if (on.pin) {
      if (!selected || !active?.nodes.length || state === 'idle') on.pin(0, 0, false);
      else {
        pin.copy(active.center);
        pin.y += active.rise * lift.x; pin.z += (active.out + 0.015) * lift.x;
        model.localToWorld(pin); pin.project(camera);
        on.pin((pin.x + 1) * width / 2, (1 - pin.y) * height / 2, Math.abs(pin.x) < 1 && Math.abs(pin.y) < 1 && pin.z < 1);
      }
    }
  };
  function tick(now) {
    raf = 0;
    if (disposed || lost || !ready || !visible || document.hidden) return;
    const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
    last = now;
    let moving = false;
    if (instant()) { coast = 0; settle(); }
    else {
      if (!drag && Math.abs(coast) > 0.001) {
        walk.x += coast * dt; walk.t = walk.x;
        coast *= Math.pow(0.025, dt);
        if (Math.abs(coast) <= 0.001) { coast = 0; walk.t = Math.round(walk.x / detent()) * detent(); }
        moving = true;
      }
      advance();
      for (const s of springs) moving = s.step(dt) || moving;
      advance();
    }
    render();
    if (moving || pending !== undefined || inspectRequested) raf = requestAnimationFrame(tick);
  }
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    wake();
  };
  const change = () => { if (instant()) settle(); notify(); wake(); };
  const returnActive = (next) => {
    coast = 0;
    inspectRequested = false;
    pending = next;
    lift.t = 0; turn.t = 0;
    framing.t = 0;
    if (lift.x < 0.001 && Math.abs(turn.x) < 0.002) bindPending();
  };
  const applyLab = () => {
    if (!model) return;
    model.traverse((node) => {
      if (!node.isMesh) return;
      const originals = originalMaterials.get(node);
      node.material = lab ? labMaterials.get(node) : originals;
    });
    wake();
  };
  const api = {
    get ready() { return ready && !lost; },
    get state() { return state; },
    get selected() { return selected?.id || null; },
    select(id) {
      if (!ready || lost) return;
      const product = entries.find((p) => p.id === id);
      if (!product) return;
      if (selected === product && state === 'selected') return;
      selected = product; state = 'selected';
      returnActive(product);
      change();
    },
    inspect() {
      if (!ready || !selected) return;
      state = 'inspecting'; inspectRequested = true;
      change();
    },
    use() { if (ready && selected) { state = 'in-use'; change(); } },
    back() {
      if (state === 'inspecting' || state === 'in-use') {
        state = 'selected'; inspectRequested = false;
        lift.t = 0; turn.t = 0; framing.t = active?.nodes.length ? 0.12 : 0;
        change();
      } else api.reset();
    },
    reset() {
      if (!ready) return;
      state = 'idle'; selected = null;
      returnActive(null);
      yaw.t = -0.1; pitch.t = 0.55; magnify.t = 1;
      change();
    },
    rotate(delta) {
      if (!ready || !Number.isFinite(delta)) return;
      if (state === 'inspecting' || state === 'in-use') turn.t += delta * 0.35;
      else {
        if (selected) { selected = null; state = 'idle'; active = null; pending = undefined; framing.t = 0; notify(); }
        coast = 0;
        walk.t += detent() * delta;
      }
      wake();
    },
    zoom(delta) {
      if (!Number.isFinite(delta)) return;
      magnify.t = clamp(magnify.t * Math.pow(1.14, delta), 0.72, 1.85);
      wake();
    },
    setDragMode(mode) { dragMode = mode === 'camera' ? 'camera' : 'carousel'; },
    setLab(value) { lab = Boolean(value); applyLab(); },
    setPaused(value) { paused = Boolean(value); if (paused) { coast = 0; settle(); } wake(); },
    destroy() {
      if (disposed) return;
      disposed = true; ready = false;
      cancelAnimationFrame(raf); aborter.abort();
      resizeObserver.disconnect(); intersectionObserver.disconnect();
      for (const dispose of disposers) dispose();
      disposeModel(model);
      for (const material of new Set([...labMaterials.values()].flat())) material.dispose();
      environment.dispose(); draco.dispose(); renderer.dispose(); canvas.remove();
      host.classList.remove('ox-ready', 'is-dragging');
    },
  };

  // The canvas is an optional pointer surface; the page supplies equivalent named buttons.
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const pick = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(model, true);
    if (!hits.length) return null;
    let node = hits[0].object;
    while (node && !node.userData.orbitProduct) node = node.parent;
    return node?.userData.orbitProduct || (entries.some((p) => p.id === 'halo') ? 'halo' : null);
  };
  const pixelsPerMetre = () => {
    const a = new THREE.Vector3(0, 0, dimensions.z / 2).project(camera);
    const b = new THREE.Vector3(0.01, 0, dimensions.z / 2).project(camera);
    return Math.max(1, Math.abs(b.x - a.x) * width * 50);
  };
  listen(canvas, 'pointerdown', (event) => {
    if (!ready || lost || event.button > 0 || drag) return;
    drag = { id: event.pointerId, initialX: event.clientX, initialY: event.clientY, x: event.clientX, y: event.clientY, time: event.timeStamp, velocity: 0, moved: false, touch: event.pointerType === 'touch' };
    coast = 0;
  });
  listen(canvas, 'pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const totalX = event.clientX - drag.initialX, totalY = event.clientY - drag.initialY;
    if (!drag.moved) {
      if (Math.max(Math.abs(totalX), Math.abs(totalY)) < 5) return;
      if (drag.touch && Math.abs(totalY) > Math.abs(totalX) * 1.2) { drag = null; return; }
      drag.moved = true;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing'; host.classList.add('is-dragging');
      if (state === 'selected' && dragMode === 'carousel') {
        selected = null; state = 'idle'; inspectRequested = false;
        // A partially returning object finishes before rail manipulation starts.
        if (lift.x > 0.001) { lift.jump(0); turn.jump(0); }
        active = null; pending = undefined; framing.t = 0; notify();
      }
    }
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    const dt = Math.max(10, event.timeStamp - drag.time) / 1000;
    if (dragMode === 'camera') {
      yaw.t += dx * 0.007;
      pitch.t = clamp(pitch.t + dy * 0.005, 0.12, 1.28);
    } else if (state === 'inspecting' || state === 'in-use') {
      turn.jump(turn.x + dx * 0.012);
    } else {
      const distance = dx / pixelsPerMetre();
      walk.jump(walk.x + distance);
      drag.velocity = clamp(distance / dt, -0.45, 0.45);
    }
    drag.x = event.clientX; drag.y = event.clientY; drag.time = event.timeStamp;
    wake();
  });
  const release = (event, canceled = false) => {
    if (!drag || event.pointerId !== drag.id) return;
    const end = drag;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = 'grab'; host.classList.remove('is-dragging');
    if (!canceled && !end.moved) {
      const id = pick(event);
      if (id) api.select(id);
    } else if (end.moved && dragMode === 'carousel' && state !== 'inspecting' && state !== 'in-use') {
      coast = canceled || instant() || event.timeStamp - end.time > 100 ? 0 : end.velocity;
      if (Math.abs(coast) <= 0.001) walk.t = Math.round(walk.x / detent()) * detent();
    }
    wake();
  };
  listen(canvas, 'pointerup', (event) => release(event));
  listen(canvas, 'pointercancel', (event) => release(event, true));
  listen(canvas, 'lostpointercapture', (event) => release(event, true));
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else wake();
  });
  listen(motionPreference, 'change', () => { if (instant()) settle(); wake(); });
  listen(canvas, 'webglcontextlost', (event) => {
    event.preventDefault(); lost = true;
    cancelAnimationFrame(raf); raf = 0;
    host.classList.remove('ox-ready'); host.classList.add('ox-failed');
    canvas.hidden = true;
    on.error?.(new Error('The 3D graphics context was interrupted. The product image remains available.'));
  });
  listen(canvas, 'webglcontextrestored', () => {
    if (disposed) return;
    lost = false; canvas.hidden = false;
    host.classList.remove('ox-failed'); host.classList.add('ox-ready');
    wake(); on.ready?.();
  });
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake(); else { cancelAnimationFrame(raf); raf = 0; }
  }, { rootMargin: '60px' });
  intersectionObserver.observe(host);

  const disposeModel = (object) => {
    if (!object) return;
    const materials = new Set(), textures = new Set();
    object.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      for (const material of [].concat(originalMaterials.get(node) || node.material)) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
  };
  const draco = new DRACOLoader().setDecoderPath(DRACO);
  on.progress?.(0);
  Promise.all([
    new Promise((resolve, reject) => new GLTFLoader().setDRACOLoader(draco).load(
      new URL(modelUrl, location.href).href,
      (gltf) => resolve(gltf.scene),
      (event) => on.progress?.(event.total ? Math.min(0.93, event.loaded / event.total * 0.93) : 0.15),
      reject,
    )),
    fetch(new URL(loopUrl, location.href).href, { signal: aborter.signal }).then((response) => {
      if (!response.ok) throw new Error(`HALO rail data could not load (${response.status}).`);
      return response.json();
    }),
  ]).then(([object, path]) => {
    if (disposed) { disposeModel(object); return; }
    if (!Array.isArray(path.samples) || path.samples.length < 3 || !path.pieces || !(path.loop > 0) || !(path.links > 0)) {
      disposeModel(object); throw new Error('HALO rail data is incomplete.');
    }
    model = object; loop = path;
    const box = new THREE.Box3().setFromObject(model);
    model.position.sub(box.getCenter(new THREE.Vector3()));
    box.getSize(dimensions);
    scene.add(model);
    const roots = new Map();
    model.traverse((node) => {
      if (Object.prototype.hasOwnProperty.call(path.pieces, node.name)) {
        const s0 = path.pieces[node.name], [x0, z0, t0] = at(s0);
        node.updateMatrix();
        const piece = { node, s0, x0, z0, t0, base: node.matrix.clone() };
        node.matrixAutoUpdate = false; pieces.push(piece);
        const root = path.roots[node.name];
        if (!roots.has(root)) roots.set(root, []);
        roots.get(root).push(piece);
      }
      if (node.isMesh) {
        originalMaterials.set(node, node.material);
        const wire = (material) => {
          const next = material.clone();
          next.wireframe = true; next.color.set(0x88b8b9);
          next.transparent = true; next.opacity = 0.38; next.depthWrite = false;
          if ('transmission' in next) next.transmission = 0;
          if ('emissive' in next) { next.emissive.set(0x234546); next.emissiveIntensity = 0.28; }
          return next;
        };
        labMaterials.set(node, Array.isArray(node.material) ? node.material.map(wire) : wire(node.material));
      }
    });
    for (const product of entries) {
      product.nodes = (product.roots || []).flatMap((root) => roots.get(root) || []);
      for (const piece of product.nodes) piece.node.userData.orbitProduct = product.id;
    }
    ready = true;
    resize(); place(); aim(); applyLab();
    renderer.render(scene, camera);
    host.classList.remove('ox-failed'); host.classList.add('ox-ready');
    on.progress?.(1); on.ready?.(); wake();
  }).catch((error) => {
    if (disposed || error.name === 'AbortError') return;
    ready = false; cancelAnimationFrame(raf); raf = 0;
    host.classList.remove('ox-ready'); host.classList.add('ox-failed');
    canvas.hidden = true;
    console.warn('[orbit-stage] Interactive model unavailable:', error);
    on.error?.(error);
  });
  return api;
}
