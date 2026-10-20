import * as THREE from 'three';

// The two wabi-sabi pendants over the curved sofa (JC 2026-10-19: "it's solaris where its missing over the couch";
// from the studio photos 719_3089 and 719_2433). Not in the Blender file, so they are built here: hand-formed white
// plaster domes, lopsided and a little tilted, hung at two heights, the larger one lower and nearer the room. Each glows
// from underneath and lights the sofa below; on in golden hour and studio light, off in daylight like the other lamps.
const B = (x, y, z) => new THREE.Vector3(x, z, -y);   // Blender (x, y, z) -> three
const CEILING = 3.5;
const HANG = [
  { at: [3.35, 2.25, 2.0], r: 0.27, h: 0.27, yaw: 0.6, seed: 1 },     // bottom of the shade at 2.0 m
  { at: [3.8, 2.62, 2.5], r: 0.22, h: 0.22, yaw: 2.2, seed: 2 },
];

// a dome profile (rim to crown), turned, then pushed out of round so no two look alike
function shade(r, h, seed) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * Math.PI / 2;
    pts.push(new THREE.Vector2(Math.max(r * Math.pow(Math.cos(t), 0.55), 1e-4), h * Math.pow(Math.sin(t), 1.15)));
  }
  const g = new THREE.LatheGeometry(pts.reverse(), 64);   // crown first, so the outside faces out
  const p = g.attributes.position, v = new THREE.Vector3();
  const ph = [seed * 1.7, seed * 2.9, seed * 4.3];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), k = v.y / h;                       // k: 0 at the rim, 1 at the crown
    const s = 1 + 0.07 * Math.sin(2 * a + ph[0]) + 0.04 * Math.sin(3 * a + ph[1]) + 0.025 * Math.sin(5 * a + ph[2]) * (1 - k);
    v.x *= s; v.z *= s * 0.88;                                            // a pebble, not a bowl
    v.x += 0.07 * r * k * k;                                              // the crown sits off centre
    v.y += 0.012 * Math.sin(3 * a + ph[2]) * (1 - k) ** 3;                // a hand-trimmed rim
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function addPendants(scene, lamps) {
  const plaster = new THREE.MeshStandardMaterial({ name: 'Pendant plaster', color: '#f1eee8', roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const cordMat = new THREE.MeshStandardMaterial({ name: 'Pendant cord', color: '#ece9e3', roughness: 0.8 });
  const glowMats = [];
  for (const { at, r, h, yaw, seed } of HANG) {
    const g = new THREE.Group(); g.name = 'Wabi-sabi pendant'; g.position.copy(B(...at)); g.rotation.set(0.05 * seed, yaw, -0.04);
    const outer = new THREE.Mesh(shade(r, h, seed), plaster); outer.castShadow = true; outer.receiveShadow = true;
    // the inside of the shade lit by its bulb: a glow layer just under the plaster, seen from below
    const glow = new THREE.MeshStandardMaterial({ name: 'Pendant glow', color: '#fff6ea', emissive: '#ffd6a6', emissiveIntensity: 1, roughness: 1, side: THREE.BackSide });
    glow.userData.practicalStrength = 0.55; glow.userData.nightOnly = true; glowMats.push(glow);
    const inner = new THREE.Mesh(outer.geometry, glow); inner.scale.setScalar(0.985);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 12), glow); bulb.position.y = h * 0.45; bulb.scale.y = 0.8;
    const cordLen = CEILING - (at[2] + h);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, cordLen, 6), cordMat); cord.position.y = h + cordLen / 2;
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 24), cordMat); canopy.position.y = h + cordLen - 0.01;
    g.add(outer, inner, bulb, cord, canopy);
    scene.add(g);
    const l = new THREE.PointLight('#ffd2a0', 2.2, 3.6, 2); l.position.copy(B(at[0], at[1], at[2] + h * 0.3));
    l.userData.power = 2.2; l.userData.nightOnly = true; lamps.add(l);
  }
  return glowMats;
}
