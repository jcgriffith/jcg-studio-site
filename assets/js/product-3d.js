// Live product models (2026-10-08). JC: "on the portfolio page, each product showed up as its own portfolio item. And
// then when you hover or click on it, it like animates to showing it in its active state ... the drone, when you hover
// on it, it like hovers off the card and turns sideways and kind of flies around the screen a little bit. Or when you
// click into it ... it flies around and animates larger on the screen as the portfolio item expands."
//
// One fixed WebGL canvas over the page draws each product wherever it belongs this frame: on its floor cover, on its
// Grid card, or in its item page's hero (the empty [data-product-stage] productMarkup() leaves). It can leave the card,
// so a spring carries it between places: the item opening is a flight from the card to the hero.
// Wisp: asleep (tilted, eyes dark, rotors still, the camera covered) until you hover its cover or card (on a phone, when the card is in
// view), then its eyes open, the rotors spin, the ring lights and it flies a banking figure of eight round the card.
// In its page it bobs and turns toward the pointer. The model is the Blender master (3d/export_wisp_glb.py).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { reduced as reducedPref } from './reduce-motion.js';

const FOV = 22, DIST = 1.2;
const MOODS = {                       // Wisp v13's eyes: 4 x 5 dots on its face strip (wisp_v13.py)
  open: ['.##.', '####', '####', '####', '.##.'],
  line: ['....', '....', '....', '####', '....'],
  sleepy: ['....', '....', '####', '.##.', '....'],
  happy: ['....', '.##.', '#..#', '....', '....'],
  off: ['....', '....', '....', '....', '....'],
};
// The eyes at full strength (JC: "the eye color seems very faint ... like it's a somewhat transparent orange"): unlit
// and outside the tone mapping, which otherwise washes a bright orange toward peach.
const EYE_GLOW = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FF4A12'), toneMapped: false, side: THREE.DoubleSide });
// Wisp v13's face band goes all the way round, so the page draws the eyes itself and they can slide round it to look at
// things on their own (JC: "if the purpose of the black section being so wide is so that the eyes can move around it
// independently of the camera, then i'd rather the black ring go all the way around it"). Geometry as wisp_v13.py (mm).
const EYE = { R: 23.03, WIN: Math.PI / 2, U: 4.3, Z: 2.0, PITCH: 0.8, DOT: 0.33 };
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// The grilles' holes: 2 mm on a 2.5 mm grid (as in Blender), punched with a texture.
function holeTexture() {
  const n = 1024, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, n, n);
  g.fillStyle = '#000';
  const pitch = (n * 2.5) / 38.8, r = n / 38.8;
  for (let y = pitch / 2; y < n; y += pitch) for (let x = pitch / 2; x < n; x += pitch) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

// The cover's art direction (2026-10-08, from JC's pins: product shots under a technical HUD, the product sitting in
// front of its big, bulky name). An SVG over the cover's backdrop, in the cover's own units (720 x 960, so it scales
// with the floor's zoom and fits the Grid card exactly): a hairline frame with crosshair corners, mono labels, a
// construction circle and level line where the product hovers, a tick ruler (every fifth long, as the brand's dot
// grid), the name huge behind it, and a status that reads ASLEEP or AWAKE (orange only when it's awake).
// The name, huge: one line per word, sized so the longest fills the frame (DRONE / BOT), the last line's baseline at 470.
function nameLines(name) {
  const words = name.replace(/^JCG\s+/i, '').toUpperCase().split(/\s+/);   // the brand reads small in the labels
  const longest = Math.max(...words.map((w) => w.length));
  const size = Math.min(236, 630 / (longest * 1.02));        // Archivo 800 at 125% width runs about 1em a letter
  const lead = size * 0.88;
  const base = 350;                 // two lines sit higher, so the drone covers only the last one's foot
  return words.map((w, i) => `<text class="ph-name" x="360" y="${(base - (words.length - 1 - i) * lead).toFixed(1)}" text-anchor="middle"
    ${w.length === longest ? 'textLength="630" lengthAdjust="spacingAndGlyphs"' : ''} style="font-size:${size.toFixed(1)}px">${w}</text>`).join('');
}

export function hud(c) {
  const [no] = c.label.split(' / ');
  const ticks = Array.from({ length: 31 }, (_, i) => {
    const y = 120 + i * 24, long = i % 5 === 0;
    return `<line x1="${long ? 652 : 660}" y1="${y}" x2="672" y2="${y}"/>`;
  }).join('');
  const corner = (x, y) => `<path d="M${x - 14} ${y}H${x + 14}M${x} ${y - 14}V${y + 14}"/>`;
  return `
    <svg class="product-hud" viewBox="0 0 720 960" preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-product-hud="${c.id}">
      ${nameLines(c.concept)}
      <g class="ph-line">
        <rect x="36" y="36" width="648" height="888"/>
        <circle cx="360" cy="557" r="262"/>
        <line class="ph-dash" x1="60" y1="557" x2="640" y2="557"/>
      </g>
      <g class="ph-ink">${corner(36, 36)}${corner(684, 36)}${corner(36, 924)}${corner(684, 924)}${ticks}</g>
      <g class="ph-text">
        <text x="60" y="84">${no} / ${c.concept.toUpperCase()}</text>
        <text x="652" y="84" text-anchor="end">${(c.coverKind || c.member.split(' that ')[0] || '').replace(/^an? /i, '').toUpperCase()}</text>
        <text x="60" y="896">${(c.product?.facts?.[0]?.[1] || c.coverFact || '').toUpperCase()}</text>
        <g class="ph-status"><circle cx="532" cy="889" r="7"/><text x="652" y="896" text-anchor="end"><tspan class="ph-asleep">ASLEEP</tspan><tspan class="ph-awake">AWAKE</tspan></text></g>
      </g>
    </svg>`;
}

export function initProducts(data, floor) {
  const products = data.concepts.filter((c) => c.product?.model);
  if (!products.length) return;
  for (const c of products) {
    for (const host of [document.querySelector(`.cluster[data-id="${c.id}"] .frame--cover .frame-body`),
      document.querySelector(`.folio-card[data-id="${c.id}"] .folio-cover`)]) host?.insertAdjacentHTML('beforeend', hud(c));
  }
  const reduced = () => reducedPref();
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'product-gl';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    canvas.remove();
    console.warn('[jcg] no WebGL; product covers stay stills:', err);
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(0.6, 1, 0.8);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 10);
  camera.position.set(0, 0, DIST);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();
  const pxScale = () => (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * DIST) / innerHeight;   // world metres per px

  const pointer = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => { pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

  const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const holes = holeTexture();
  const rigs = products.map((c) => rig(c));

  function rig(c) {
    const id = c.id;
    const drone = new THREE.Group(), body = new THREE.Group();
    drone.add(body);
    drone.visible = false;
    scene.add(drone);
    const eyes = new Map(), glows = [];
    const rotors = { upper: new THREE.Group(), lower: new THREE.Group() };
    const r = {
      c, drone, awake: false, hot: false, seen: false, spin: 0, posed: false, blinkAt: 0, seq: 0, loaded: false,
      pose: { x: 0, y: 0, s: 0, rx: 1.05, ry: 0, rz: 0, vx: 0, vy: 0, vs: 0 },
      cover: () => document.querySelector(`.cluster[data-id="${id}"] .frame--cover .frame-body`),
      card: () => document.querySelector(`.folio-card[data-id="${id}"] .folio-cover`),
      stage: () => document.querySelector(`.folio-panel.is-open [data-product-stage="${id}"]`),
      rows: MOODS.off, gaze: 0,
      mood(name) { r.rows = MOODS[name]; },
      sequence(steps) {
        const s = ++r.seq;
        let t = 0;
        for (const [m, ms] of steps) { setTimeout(() => { if (s === r.seq) r.mood(m); }, t); t += ms; }
      },
      rotors, glows, shutter: null, tilt: null, cam: 0,
    };
    loader.load(new URL(c.product.model, document.baseURI).href, (gltf) => {
      const model = gltf.scene;
      body.add(model);
      body.rotation.y = Math.PI;          // Blender's +Y (the eyes, the camera window) comes in as -Z
      body.add(rotors.upper, rotors.lower);
      const meshes = [];
      model.traverse((o) => {
        if (o.isMesh) meshes.push(o);
        if (/v10_shutter/.test(o.name)) r.shutter = o;          // slides 12 degrees round the ring to uncover the camera
        if (/mirror_tilt/.test(o.name)) r.tilt = o;             // the periscope mirror: parked at 180, level at 0
      });
      for (const o of meshes) {
        const n = o.name;
        const eye = n.match(/eye_([AB])_(\d)_(\d)/);
        if (eye) { o.visible = false; eyes.set(eye[1] + eye[2] + eye[3], o); continue; }   // the page draws them (below)
        if (o.userData.wisp_grille || /top_mesh|bottom_mesh/.test(n)) {
          o.material = new THREE.MeshStandardMaterial({ color: 0xa8a8a4, roughness: 0.5, alphaMap: holes, alphaTest: 0.5, side: THREE.DoubleSide });
        }
        if (/upper_rotor/.test(n)) rotors.upper.attach(o);
        else if (/lower_rotor/.test(n)) rotors.lower.attach(o);
        if (/light_ring|status_arc|rotor_blade/.test(n) && o.material.emissive) { o.material = o.material.clone(); glows.push(o.material); }   // v14: no ring; the rotors glow through the grilles in flight
      }
      r.dots = new THREE.InstancedMesh(new THREE.CircleGeometry(EYE.DOT / 1000, 16), EYE_GLOW, 40);
      r.dots.frustumCulled = false;
      model.add(r.dots);
      r.mood('off');
      r.loaded = true;
      document.documentElement.classList.add(`has-live-${id}`);
    }, undefined, (err) => console.warn(`[jcg] ${id} model failed:`, err));

    // Wake on hover (the floor cover and the Grid card), or on a phone when the card is well in view.
    const wake = (on) => {
      if (on === r.hot) return;
      r.hot = on;
      document.querySelectorAll(`[data-product-hud="${id}"]`).forEach((h) => h.classList.toggle('is-awake', on));
      if (on) { r.sequence([['line', 140], ['sleepy', 140], ['open', 600]]); r.blinkAt = performance.now() + 2200; }
      else if (!r.stage()) r.sequence([['sleepy', 260], ['line', 220], ['off', 10]]);
    };
    r.wake = wake;
    const coverLink = document.querySelector(`.cluster[data-id="${id}"] .frame--cover`);
    const cardLink = document.querySelector(`.folio-card[data-id="${id}"]`);
    if (canHover) {
      for (const el of [coverLink, cardLink]) {
        el?.addEventListener('pointerenter', () => wake(true));
        el?.addEventListener('pointerleave', () => wake(false));
      }
    } else if (cardLink && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { r.seen = e.intersectionRatio > 0.6; }, { threshold: [0, 0.6, 1] }).observe(cardLink.querySelector('.folio-cover'));
    }
    return r;
  }

  // The suite row links to products that have no page yet: keep the click quiet.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-suite]');
    if (a && !data.concepts.some((c) => c.id === a.dataset.suite)) e.preventDefault();
  });

  const visible = (rect) => rect && rect.width > 2 && rect.height > 2;
  // Where each product should be this frame, and how it should hold itself.
  function target(r, t) {
    const view = document.documentElement.dataset.view || 'canvas';
    const st = r.stage();
    if (st) {
      const b = st.getBoundingClientRect();
      if (!r.opened) { r.opened = true; r.spin += Math.PI * 2; r.sequence([['open', 500], ['happy', 900], ['open', 10]]); }
      const s = Math.min(b.width, b.height) * 0.8;
      return { show: visible(b), x: b.left + b.width / 2, y: b.top + b.height / 2 + (reduced() ? 0 : Math.sin(t * 1.6) * s * 0.03), s,
        rx: 0.28 + pointer.y * 0.35, ry: pointer.x * 0.35 + r.spin, rz: -pointer.x * 0.08, flying: true, gaze: pointer.x * 0.55 };
    }
    if (r.opened) {                      // just closed: one turn back, and to sleep unless still hovered
      r.opened = false;
      r.spin -= Math.PI * 2;
      if (!r.hot) r.sequence([['sleepy', 400], ['line', 220], ['off', 10]]);
    }
    const el = view === 'grid' ? r.card() : view === 'canvas' ? r.cover() : null;
    const b = el?.getBoundingClientRect();
    if (!visible(b)) return { show: false };
    if (!canHover) {                     // phones: awake when the card (or the cover, zoomed in) is well in view
      const inView = view === 'grid' ? r.seen
        : b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight && b.width > innerWidth * 0.35;
      r.wake(inView);
    }
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2, s = b.width * 0.6;   // big: the cover is the product
    if (!r.hot || reduced()) {
      return { show: true, x: cx, y: cy + (r.hot ? -b.height * 0.1 : b.height * 0.08), s, rx: r.hot ? 0.35 : 1.05, ry: r.spin, rz: 0, flying: r.hot };
    }
    const a = t * 0.9;                   // a figure of eight round the card, banking into the turns
    return { show: true, x: cx + Math.sin(a) * b.width * 0.3, y: cy - b.height * 0.08 + Math.sin(a * 2) * b.height * 0.12, s: s * 0.85,
      rx: 0.3, ry: Math.cos(a) * 0.55 + r.spin, rz: -Math.cos(a) * 0.32, flying: true };
  }

  function tick(dt, t) {
    const ps = pxScale();
    for (const r of rigs) {
      if (!r.loaded) continue;
      const g = target(r, t);
      r.drone.visible = !!g.show;
      if (!g.show) { r.posed = false; continue; }
      const p = r.pose;
      if (!r.posed) { Object.assign(p, g, { vx: 0, vy: 0, vs: 0 }); r.posed = true; }
      const k = reduced() ? 400 : 34, damp = reduced() ? 40 : 10.5;   // a lively spring: a touch of overshoot, like flight
      for (const [q, v] of [['x', 'vx'], ['y', 'vy'], ['s', 'vs']]) {
        p[v] += (k * (g[q] - p[q]) - damp * p[v]) * dt;
        p[q] += p[v] * dt;
      }
      const e = 1 - Math.exp(-(reduced() ? 30 : 4.5) * dt);
      p.rx += (g.rx - p.rx) * e;
      p.ry += (g.ry - p.ry) * e;
      p.rz += (g.rz - p.rz) * e - p.vx * 0.00004;                    // lean into sideways speed
      r.drone.position.set((p.x - innerWidth / 2) * ps, -(p.y - innerHeight / 2) * ps, 0);
      r.drone.scale.setScalar(Math.max(p.s, 1) * ps / 0.046);
      r.drone.rotation.set(p.rx, p.ry, p.rz, 'YXZ');
      r.rotors.upper.rotation.y += (g.flying ? 38 : 0) * dt;
      r.rotors.lower.rotation.y -= (g.flying ? 31 : 0) * dt;
      for (const m of r.glows) m.emissiveIntensity += ((g.flying ? 1 : 0.05) - m.emissiveIntensity) * e;
      // The camera: covered while it sleeps (you can see it isn't filming); awake, the shutter slides open and the mirror
      // unparks; in its page the mirror tips toward the pointer.
      r.cam += ((g.flying ? 1 : 0) - r.cam) * (1 - Math.exp(-3 * dt));
      if (r.shutter) r.shutter.rotation.y = THREE.MathUtils.degToRad(12) * r.cam;
      if (r.tilt) r.tilt.rotation.set(Math.PI * (1 - r.cam) + (r.stage() ? pointer.y * 0.45 * r.cam : 0), 0, 0);
      // The eyes: where they look round the band (toward the pointer in its page, ahead as it flies), then each lit dot.
      const look = g.gaze ?? (g.flying ? THREE.MathUtils.clamp(p.vx * 0.0016, -0.6, 0.6) : 0);
      r.gaze += (look - r.gaze) * (1 - Math.exp(-6 * dt));
      if (r.dots) {
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), nrm = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
        let i = 0;
        for (const sgn of [1, -1]) {
          for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 4; col++) {
              if (r.rows[row][col] !== '#') continue;
              const a = EYE.WIN + r.gaze + (sgn * EYE.U + (col - 1.5) * EYE.PITCH) / 23.0;
              const z = EYE.Z + (2 - row) * EYE.PITCH;
              pos.set(EYE.R * Math.cos(a), z, -EYE.R * Math.sin(a)).multiplyScalar(0.001);   // Blender (x, y, z) -> glTF (x, z, -y)
              nrm.set(Math.cos(a), 0, -Math.sin(a));
              q.setFromUnitVectors(Z_AXIS, nrm);
              r.dots.setMatrixAt(i++, m4.compose(pos, q, one));
            }
          }
        }
        r.dots.count = i;
        r.dots.instanceMatrix.needsUpdate = true;
      }
      if (g.flying && performance.now() > r.blinkAt) {          // a blink every few seconds
        r.sequence([['line', 110], ['open', 10]]);
        r.blinkAt = performance.now() + 2600 + Math.random() * 2600;
      }
    }
    renderer.render(scene, camera);
  }
  const clock = new THREE.Clock();
  const frame = () => { tick(Math.min(clock.getDelta(), 0.05), clock.elapsedTime); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  let simT = 0;
  window.__products = { rigs, step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) { simT += dt; tick(dt, clock.elapsedTime + simT); } } };   // checks
}
