import * as THREE from 'three';

// Terra-specific finishing. Same recipe as Etherea's finishes.js (../3d/): small procedural grain and weave maps (no
// texture downloads), roughness by material family. Names are the Blender material names with the export's "web_" prefix.
function surfaceMap(kind, repeat) {
  const size = 128, data = new Uint8Array(size * size * 4);
  let seed = 719;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const weave = kind === 'fabric' ? 14 * Math.sin(x * Math.PI / 2) * Math.sin(y * Math.PI / 2) : 0;
    const value = Math.round(218 + random() * 30 + weave), i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}

const PLASTER = /honey|driftwood|camel|oyster|white|caribbean cream|material\.021/i;
const FABRIC = /cushion|curtain|e55e1354|fe931f07|c0a6c165|fd12e952|material\.008/i;

// Floor contact: baked in Blender from the web GLB (pipeline/bake_terra_floor_contact.py), as Etherea's
// etherea-floor-contact-v2.png. Extent of the map on the floor, in Blender metres: x0, y0, x1, y1.
const CONTACT = { url: './terra-floor-contact.webp?v=20261019-1', xy: [-6.7473, -4.0362, 6.8061, 4.0132] };

// The two rugs from the photos (JC 2026-10-19: "I think it's missing some rugs"), drawn here because the web export keeps
// only flat colours: the north nook's terracotta Moroccan rug with its cream diamond lattice (719_6952-6954) and the south
// nook's woven jute rug with pale zigzag rows (IMG_8719). Each rug's top runs 0-1 in UV, long side along u.
function rugMap(kind) {
  const W = 1024, H = 640, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); let seed = kind === 'moroccan' ? 7 : 19;
  const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  if (kind === 'moroccan') {
    g.fillStyle = '#b9583a'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#ead9c3'; g.lineWidth = 9; g.lineJoin = 'round';
    const cw = 128, ch = 160;                                         // the lattice: long diamonds
    for (let x = -cw; x < W + cw; x += cw) for (let y = -ch; y < H + ch; y += ch) {
      g.beginPath(); g.moveTo(x, y + ch / 2); g.lineTo(x + cw / 2, y); g.lineTo(x + cw, y + ch / 2); g.lineTo(x + cw / 2, y + ch); g.closePath(); g.stroke();
    }
    g.fillStyle = '#7e3622';                                          // small dark marks in each diamond
    for (let x = 0; x < W + cw; x += cw) for (let y = 0; y < H + ch; y += ch) { g.fillRect(x - 6, y - 6, 12, 12); }
    g.strokeStyle = '#ead9c3'; g.lineWidth = 14; g.strokeRect(22, 22, W - 44, H - 44);
  } else {
    g.fillStyle = '#c2a67b'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#e6d6b8'; g.lineWidth = 7;
    for (let y = 70; y < H - 40; y += 70) {                           // rows of zigzags
      g.beginPath(); for (let x = 40, k = 0; x <= W - 40; x += 32, k++) g.lineTo(x, y + (k % 2 ? 16 : -16)); g.stroke();
    }
    g.strokeStyle = '#8f7651'; g.lineWidth = 12; g.strokeRect(18, 18, W - 36, H - 36);
  }
  const img = g.getImageData(0, 0, W, H), d = img.data;              // a woven grain over everything
  for (let i = 0; i < d.length; i += 4) { const k = (rnd() - 0.5) * 26 + ((i / 4) % 2 ? 6 : -6); d[i] += k; d[i + 1] += k; d[i + 2] += k; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function finishTerra(root, renderer, invalidate = () => {}) {
  const grain = surfaceMap('stone', 12), fabric = surfaceMap('fabric', 24);
  grain.anisotropy = fabric.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const seen = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m?.isMeshStandardMaterial || seen.has(m)) continue;
      seen.add(m); const n = m.name.replace(/^web_/, '');
      if (m.emissive?.getHex()) continue;                          // practicals: terraPracticals()
      if (/^Rug /.test(n)) { m.map = rugMap(/moroccan/i.test(n) ? 'moroccan' : 'jute'); m.color.set('#ffffff'); m.roughness = .96; m.metalness = 0; }
      else if (/metal gold|metal black/i.test(n)) { m.roughness = /gold/i.test(n) ? .3 : .36; }
      else if (n === 'Material.007') { m.metalness = 1; m.roughness = .04; m.envMapIntensity = 1.3; }   // the arched mirror's glass
      else if (FABRIC.test(n)) { m.roughness = .92; m.metalness = 0; m.bumpMap = fabric; m.bumpScale = .006; }
      else if (PLASTER.test(n)) { m.roughness = .87; m.metalness = 0; m.bumpMap = grain; m.bumpScale = .004; }
      else if (/^concrete/i.test(n)) {
        // The file's concrete, as Etherea's floor is retinted in finishes.js: its flat average read cold grey and as light
        // as the cream platforms, so the steps vanished. A warm mid beige with a soft sheen, closer to the sealed floor in the photos.
        m.color.setRGB(.36, .30, .245); m.roughness = .42; m.metalness = 0; m.bumpMap = grain; m.bumpScale = .012;
      }
      else if (/ceramic|plastic/i.test(n)) { m.roughness = /ceramic/i.test(n) ? .24 : .5; }
      else if (m.roughness > .85) m.roughness = .8;
      m.needsUpdate = true;
    }
  });
  const floors = []; root.traverse((o) => { if (o.isMesh && /^web_Concrete/.test(o.material?.name)) floors.push(o); });
  new THREE.TextureLoader().load(CONTACT.url, (ao) => {
    ao.channel = 1; ao.colorSpace = THREE.NoColorSpace;
    const [x0, y0, x1, y1] = CONTACT.xy, p = new THREE.Vector3();
    for (const o of floors) {
      const g = o.geometry = o.geometry.clone(), pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        uv[i * 2] = (p.x - x0) / (x1 - x0); uv[i * 2 + 1] = (-p.z - y0) / (y1 - y0);
      }
      g.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
      o.material.aoMap = ao; o.material.aoMapIntensity = .85; o.material.needsUpdate = true;
    }
    invalidate();
  });
}

// Sky cards behind the window wall (Blender +X), like Etherea's windowBackdrop: untoned, so the windows read bright.
export function terraWindows(scene, walls, room) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const ctx = c.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#b5d0df'); g.addColorStop(.6, '#e8e7dc'); g.addColorStop(1, '#afb6a7');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 128);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
  const size = room.getSize(new THREE.Vector3()), mid = room.getCenter(new THREE.Vector3());
  const card = new THREE.Mesh(new THREE.PlaneGeometry(size.z, size.y * .96), material);
  card.rotation.y = Math.PI / 2; card.position.set(room.max.x + .08, room.min.y + size.y * .5, mid.z); scene.add(card);
  walls.push({ o: card, n: new THREE.Vector3(1, 0, 0) });
  return material;
}

// The file's practical lights: three bulbs in the rattan pendant, the floor lamp, the vanity's LED strips.
export function terraPracticals(root, lamps, glowMats) {
  const glow = (o, color, strength, nightOnly) => {
    const m = o.material = o.material.clone(); m.color.set('#fff8ed'); m.emissive.set(color);
    m.emissiveIntensity = 1.6 * strength; m.roughness = .45; m.metalness = 0;
    m.userData.practicalStrength = strength; m.userData.nightOnly = nightOnly; glowMats.push(m);
  };
  const light = (objs, color, power, nightOnly, distance = 3.2) => {
    if (!objs.length) return;
    const b = new THREE.Box3(); objs.forEach((o) => b.expandByObject(o));
    const l = new THREE.PointLight(color, power, distance, 2); l.position.copy(b.getCenter(new THREE.Vector3()));
    l.userData.fixture = objs[0]; l.userData.power = power; l.userData.nightOnly = nightOnly; lamps.add(l);
  };
  const bulbs = [], strips = [], lamp = [];
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || !o.material.emissive?.getHex()) return;
    const n = o.material.name;
    if (/Light Bulb/.test(n)) { glow(o, '#ffd9a6', 1, true); bulbs.push(o); }
    else if (/Material\.046/.test(n)) { glow(o, '#fff5e5', 1.25, false); strips.push(o); }
    else { glow(o, '#ffd7a0', 1.2, true); lamp.push(o); }
  });
  light(bulbs, '#ffcf96', 2.6, true);
  light(lamp, '#ffcf96', 2.4, true);
  light(strips, '#fff0db', 2.2, false, 2.6);
}

// Backlit niches (JC 2026-10-19: "the circle and archways are all backlit"). In the studio an LED strip hides behind the
// front lip of each niche and washes its recessed back wall evenly, with a glowing line at the foot of the floor-level
// arches (photo IMG_8876). Here each niche gets a soft glow on its back wall (seen only through the opening), a dim warm
// light just behind the lip for the spill, and the LED line at the arches' feet. Off in daylight, like the other
// practical lights. Blender coordinates, from the openings in walls Cube.020 (circle), Cube.022 (arch), Cube.024 (arch, U);
// the back walls' inner faces are at y = +-3.20.
const NICHES = [
  { name: 'Circle', x: [1.98, 3.5], z: [1.52, 3.04], side: 1, lip: 2.72, wash: 'top' },
  { name: 'Arch, north', x: [4.55, 5.63], z: [0.15, 3.04], side: 1, lip: 3.08, wash: 'top', foot: 0.157 },
  { name: 'Arch, south', x: [1.19, 2.75], z: [0.15, 3.06], side: -1, lip: -2.94, wash: 'top', foot: 0.307 },   // its foot is on the raised floor (Right Lower, 30 cm)
  { name: 'U', x: [3.59, 5.11], z: [0.92, 3.5], side: -1, lip: -2.94, wash: 'bottom' },
];
function washMap(from) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'), v = g.createLinearGradient(0, 0, 0, 256);
  const stops = from === 'top' ? [[0, 1], [0.35, 0.62], [0.8, 0.42], [1, 0.62]] : [[0, 0.35], [0.6, 0.6], [1, 1]];
  stops.forEach(([o, a]) => v.addColorStop(o, `rgba(255,255,255,${a})`));
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 256); g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  const h = g.createLinearGradient(0, 0, 64, 0);                      // a little softer toward the sides
  h.addColorStop(0, 'rgba(0,0,0,.35)'); h.addColorStop(0.25, 'rgba(0,0,0,0)'); h.addColorStop(0.75, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function terraBacklights(lamps, glowMats) {
  const B = (x, y, z) => new THREE.Vector3(x, z, -y);
  const led = new THREE.MeshStandardMaterial({ name: 'Niche LED', color: '#fff3e2', emissive: '#ffbf80', emissiveIntensity: 1, roughness: 1 });
  led.userData.practicalStrength = 1.2; led.userData.nightOnly = true; glowMats.push(led);
  const maps = { top: washMap('top'), bottom: washMap('bottom') };
  for (const n of NICHES) {
    const cx = (n.x[0] + n.x[1]) / 2, cz = (n.z[0] + n.z[1]) / 2, w = n.x[1] - n.x[0] + 0.3, h = n.z[1] - n.z[0] + 0.2;
    // the glow on the back wall: added light only (black base, additive), so the plaster still shows through
    const m = new THREE.MeshStandardMaterial({ name: 'Niche wash', color: '#000', emissive: '#ffb878', emissiveMap: maps[n.wash], emissiveIntensity: 1,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, roughness: 1 });
    m.userData.practicalStrength = 0.17; m.userData.nightOnly = true; glowMats.push(m);
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); wash.name = `Niche wash: ${n.name}`;
    wash.position.copy(B(cx, n.side * 3.19, cz)); if (n.side < 0) wash.rotation.y = Math.PI;
    lamps.add(wash);
    const ly = n.wash === 'top' ? n.z[1] - 0.2 : n.z[0] + 0.15;
    const l = new THREE.PointLight('#ffbf80', 0.7, 1.8, 2); l.name = `Niche backlight: ${n.name}`;
    l.position.copy(B(cx, n.lip, ly)); l.userData.power = 0.7; l.userData.nightOnly = true; lamps.add(l);
    if (!n.foot) continue;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(n.x[1] - n.x[0], 0.012, 0.025), led); strip.name = `Niche LED: ${n.name}`;
    strip.position.copy(B(cx, n.side * 3.17, n.foot)); lamps.add(strip);
  }
}
