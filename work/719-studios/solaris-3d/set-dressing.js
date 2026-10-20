import * as THREE from 'three';

// Solaris as dressed in the studio photos (JC 2026-10-19: "compare each studio to real life photos and make sure we're
// not missing anything"; Marketing/Photos 2/The Solaris Loft/Empty Studio). Built here, not in Blender, because this
// GLB came from an export with its own textures and wall material that the Blender file does not record; re-exporting
// would lose them. Every piece is placed by casting rays at the loaded model (floor below, wall behind).
//   the coffee table: a glass top on two split-stone drums with stone spheres (719_2438, 3093) - replaces the file's
//     glass waterfall table
//   two dark wood hourglass side tables at the sofa's ends (3086, 3089)
//   the plaster wall with arches: a three-step limestone plinth with a round vase and branches, a tall textured vase
//     with branches, small stone spheres (1827, 1829, 2403, 3098)
//   an arched gold floor mirror leaning between two windows (2433, 2435)
//   the living rug: cream woven, not the file's speckled blue (all living-room photos)
const B = (x, y, z) => new THREE.Vector3(x, z, -y);   // Blender (x, y, z) -> three

let seed = 1926;
const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);

function grainMap(base, spread, size = 128) {   // a small mottled map for stone and plaster
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = base + (rnd() - 0.5) * spread + 10 * Math.sin(i * 0.013) * Math.sin(i * 0.0007);
    data.set([v, v, v, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, size, size); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t;
}

function lathe(prof, segs = 48, rib = null) {
  const pts = prof.map(([r, z]) => new THREE.Vector2(Math.max(r, 1e-4), z));
  const g = new THREE.LatheGeometry(pts, segs);
  if (rib) {
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), k = 1 + rib(a, v.y);
      p.setXYZ(i, v.x * k, v.y, v.z * k);
    }
  }
  g.computeVertexNormals(); return g;
}

function branch(from, len, bend, color) {   // a thin tapering twig on a soft curve, with a few side shoots
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const dir = new THREE.Vector3(Math.cos(bend) * 0.45, 1, Math.sin(bend) * 0.45).normalize();
  const pts = [from.clone()];
  for (let i = 1; i <= 4; i++) {
    const p = pts[i - 1].clone().addScaledVector(dir, len / 4);
    p.x += (rnd() - 0.5) * 0.06; p.z += (rnd() - 0.5) * 0.06; dir.x *= 1.15; dir.z *= 1.15; dir.normalize();
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.006, 5), mat));
  for (let k = 0; k < 4; k++) {
    const t = 0.35 + k * 0.15, o = curve.getPoint(t), d = curve.getTangent(t).add(new THREE.Vector3(rnd() - 0.5, 0.2, rnd() - 0.5)).normalize();
    const c2 = new THREE.CatmullRomCurve3([o, o.clone().addScaledVector(d, len * 0.12), o.clone().addScaledVector(d, len * 0.22).add(new THREE.Vector3(0, 0.03, 0))]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c2, 8, 0.0035, 4), mat));
  }
  return g;
}

export function dressSolaris(root, scene, invalidate = () => {}) {
  const group = new THREE.Group(); group.name = 'Solaris set dressing (photos)'; scene.add(group);
  const ray = new THREE.Raycaster(), solids = [];
  root.traverse((o) => { if (o.isMesh && !o.material?.transparent) solids.push(o); });
  const floorAt = (x, y, from = 1.2) => {   // Blender z of the first surface below
    ray.set(B(x, y, from), new THREE.Vector3(0, -1, 0)); const h = ray.intersectObjects(solids, false)[0];
    return h ? h.point.y : 0.15;
  };
  const wallAt = (x, y, z, dirY) => {      // Blender y of the first wall face from (x, y) toward +-y
    ray.set(B(x, y, z), new THREE.Vector3(0, 0, -dirY)); const h = ray.intersectObjects(solids, false)[0];
    return h ? -h.point.z : y + dirY * 0.5;
  };
  const put = (mesh, x, y, z, rotY = 0) => { mesh.position.copy(B(x, y, z)); mesh.rotation.y = rotY; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };

  const stoneMap = grainMap(214, 60); stoneMap.repeat.set(2, 2);
  const stone = new THREE.MeshStandardMaterial({ name: 'Split stone', color: '#e3d7c3', roughness: 0.95, bumpMap: stoneMap, bumpScale: 0.02 });
  const limestone = new THREE.MeshStandardMaterial({ name: 'Limestone plinth', color: '#e6ddcd', roughness: 0.92, bumpMap: stoneMap, bumpScale: 0.008 });
  const glass = new THREE.MeshPhysicalMaterial({ name: 'Table glass', color: '#e9f1ee', roughness: 0.05, transmission: 0.6, thickness: 0.012, ior: 1.5, transparent: true, opacity: 0.55 });
  const walnut = new THREE.MeshStandardMaterial({ name: 'Dark walnut', color: '#3a2a20', roughness: 0.55 });
  const gold = new THREE.MeshStandardMaterial({ name: 'Brushed gold', color: '#c9a35b', metalness: 1, roughness: 0.32 });
  const mirror = new THREE.MeshStandardMaterial({ name: 'Mirror', color: '#ffffff', metalness: 1, roughness: 0.03, envMapIntensity: 1.3 });
  const plasterVase = new THREE.MeshStandardMaterial({ name: 'Textured vase', color: '#e9e2d6', roughness: 0.95, bumpMap: stoneMap, bumpScale: 0.01 });
  const twig = '#4a3a2e';

  // ---- the coffee table: hide the file's waterfall table, build the real one where it stood --------------------
  const old = ['table002', 'table003', 'support004', 'support005', 'support006', 'support007'];
  const box = new THREE.Box3();
  root.traverse((o) => { if (old.includes(o.name)) { box.expandByObject(o); o.visible = false; } });
  const c = box.isEmpty() ? B(3.38, 0.51, 0) : box.getCenter(new THREE.Vector3());
  const cx = c.x, cy = -c.z, fz = floorAt(cx, cy, 0.4);   // its footprint, on the rug
  const drum = (dx) => {
    const facets = Array.from({ length: 12 }, () => rnd());
    const g = lathe([[0, 0], [0.2, 0], [0.21, 0.02], [0.21, 0.34], [0.2, 0.36], [0, 0.36]], 72, (a) => 0.06 * facets[Math.floor(((a + Math.PI) / (2 * Math.PI)) * 12) % 12] - 0.03);
    put(new THREE.Mesh(g, stone), cx + dx, cy, fz);
    [[-0.08, 0.05], [0.08, -0.05]].forEach(([ox, oy]) => put(new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), stone), cx + dx + ox, cy + oy, fz + 0.36 + 0.05));
  };
  drum(-0.42); drum(0.42);
  put(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.012, 0.72), glass), cx, cy, fz + 0.466);
  put(new THREE.Mesh(lathe([[0, 0], [0.13, 0.005], [0.15, 0.03], [0.14, 0.045], [0, 0.03]], 40), stone), cx - 0.25, cy + 0.08, fz + 0.472);   // the stone bowl

  // ---- side tables at the sofa's ends ---------------------------------------------------------------------------
  const hourglass = lathe([[0, 0], [0.2, 0], [0.2, 0.03], [0.07, 0.26], [0.2, 0.5], [0.2, 0.53], [0, 0.53]], 3);   // three-sided, as in the photos
  [[1.22, 2.35, 0.3], [5.45, 1.45, 1.1]].forEach(([x, y, r]) => put(new THREE.Mesh(hourglass, walnut), x, y, floorAt(x, y), r));

  // ---- the plaster arch wall (north, Cube.119): plinth with vase, tall vase, spheres ---------------------------
  const wy = (x) => wallAt(x, 1.5, 0.9, 1) - 0.02;
  {
    const x = -0.85, back = wy(x), fz2 = floorAt(x, back - 0.4);
    const steps = [[0.62, 0.26, 0.75], [0.62, 0.52, 0.5], [0.62, 0.78, 0.25]];   // width, height, depth (front to back)
    steps.forEach(([w, h, d]) => put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), limestone), x, back - d / 2, fz2 + h / 2));
    const vz = fz2 + 0.78;
    put(new THREE.Mesh(lathe([[0, 0], [0.1, 0], [0.17, 0.1], [0.16, 0.2], [0.08, 0.28], [0.07, 0.3], [0, 0.29]], 48), plasterVase), x, back - 0.12, vz);
    for (let k = 0; k < 4; k++) group.add(branch(B(x + (rnd() - 0.5) * 0.04, back - 0.12, vz + 0.28), 0.75 + rnd() * 0.3, k * 1.6 + rnd(), twig));
    [[0.4, 0.13], [0.62, 0.09]].forEach(([dx, r]) => put(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), stone), x + dx, back - 0.55, fz2 + r * 0.95));
  }
  {
    const x = -4.45, back = wy(x), fz2 = floorAt(x, back - 0.25);
    put(new THREE.Mesh(lathe([[0, 0], [0.12, 0], [0.15, 0.2], [0.15, 0.7], [0.12, 0.82], [0.1, 0.84], [0, 0.82]], 48, (a, z) => 0.02 * Math.sin(a * 9 + z * 30)), plasterVase), x, back - 0.22, fz2);
    for (let k = 0; k < 5; k++) group.add(branch(B(x, back - 0.22, fz2 + 0.82), 0.8 + rnd() * 0.4, k * 1.3 + rnd(), twig));
    put(new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 20), stone), x + 0.32, back - 0.4, fz2 + 0.105);
  }

  // ---- the arched floor mirror, leaning between two south windows -------------------------------------------------
  {
    const x = 1.22, wall = wallAt(x, 0, 1.4, -1), w = 0.7, h = 1.75, lean = 0.12;
    const m = new THREE.Group();
    const shape = new THREE.Shape(); shape.moveTo(-w / 2, 0); shape.lineTo(-w / 2, h - w / 2); shape.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); shape.lineTo(w / 2, 0); shape.closePath();
    const glassM = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), mirror);
    const pts = shape.getPoints(64).map((p) => new THREE.Vector3(p.x, p.y, 0.012));
    const frame = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 256, 0.014, 8, true), gold);
    m.add(glassM, frame);
    m.position.copy(B(x, wall + 0.06 + Math.sin(lean) * h, floorAt(x, wall + 0.3)));
    m.rotation.set(-lean, Math.PI, 0, 'YXZ'); m.traverse((o) => { o.castShadow = true; }); group.add(m);
  }

  // ---- the living rug: cream woven -------------------------------------------------------------------------------
  const weave = grainMap(222, 40, 64); weave.repeat.set(30, 30);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.material?.name || '';
    if (/^web_(tex_u1_v1|Rug_Bottom)$/.test(n)) {
      o.material = o.material.clone(); o.material.map = null; o.material.color.set('#e4d9c5');
      o.material.roughness = 0.97; o.material.bumpMap = weave; o.material.bumpScale = 0.01; o.material.needsUpdate = true;
    }
  });
  invalidate();
  return group;
}
