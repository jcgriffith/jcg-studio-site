import * as THREE from 'three';

// The lounge's coffee tables (photos): round drums clad in capiz shell, small teardrop tiles in cream, champagne
// and soft gold, set in staggered rows, with a pearly sheen. Drawn once on a canvas; UVs wrap each drum.
function shellTexture(renderer) {
  const W = 512, H = 512, cols = 12, rows = 16, random = ((s) => () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296))(4242);
  const make = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const color = make(), rough = make(), cx = color.getContext('2d'), rx = rough.getContext('2d');
  cx.fillStyle = '#c4ab86'; cx.fillRect(0, 0, W, H);                 // grout
  rx.fillStyle = '#d0d0d0'; rx.fillRect(0, 0, W, H);
  const palette = ['#f2e9d6', '#ecdfc4', '#e4d2ae', '#d9c196', '#cdb07f', '#c19f6c', '#f5eee0', '#dcc7a1', '#b8925f'];
  const tw = W / cols, th = H / rows;
  const drop = (ctx, x, y, w, h) => {                                // a teardrop pointing up, round end down
    ctx.beginPath(); ctx.moveTo(x, y - h / 2);
    ctx.bezierCurveTo(x + w * 0.62, y - h * 0.05, x + w * 0.55, y + h / 2, x, y + h / 2);
    ctx.bezierCurveTo(x - w * 0.55, y + h / 2, x - w * 0.62, y - h * 0.05, x, y - h / 2); ctx.fill();
  };
  for (let r = -1; r <= rows; r++) for (let c = -1; c <= cols; c++) {
    const x = (c + (r % 2 ? 0.5 : 0)) * tw + tw / 2, y = r * th + th / 2;
    const base = palette[Math.floor(random() * palette.length)];
    for (const [ox, oy] of [[0, 0], [W, 0], [-W, 0], [0, H], [0, -H]]) {   // wrap so the tile repeats cleanly
      const g = cx.createLinearGradient(x + ox - tw / 2, y + oy - th, x + ox + tw / 2, y + oy + th);
      g.addColorStop(0, base); g.addColorStop(0.55, '#f7efe0'); g.addColorStop(1, base);   // the shell's lustre band
      cx.fillStyle = g; drop(cx, x + ox, y + oy, tw * 1.0, th * 1.8);
      const v = 62 + Math.floor(random() * 34); rx.fillStyle = `rgb(${v},${v},${v})`; drop(rx, x + ox, y + oy, tw * 1.0, th * 1.8);   // glossy tiles, matte grout
    }
  }
  const tex = (canvas, srgb) => { const t = new THREE.CanvasTexture(canvas); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; };
  return { map: tex(color, true), roughnessMap: tex(rough, false) };
}

export function finishCapiz(root, renderer) {
  const PERIOD = 0.42;                                               // one texture repeat = 42 cm: 12 tiles about 3.5 cm wide, 4 cm tall
  let shell = null, material = null;
  root.traverse((o) => {
    if (!o.isMesh || !/capiz/i.test(o.material?.name || '')) return;
    shell ||= shellTexture(renderer);
    material ||= new THREE.MeshPhysicalMaterial({ name: 'Capiz shell', map: shell.map, roughnessMap: shell.roughnessMap, roughness: 1, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25, iridescence: 0.18, iridescenceIOR: 1.3, sheen: 0.25, sheenColor: new THREE.Color('#fff1d8'), color: new THREE.Color('#fff4e6') });
    o.updateMatrixWorld(true);
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(), p = g.attributes.position;
    const box = new THREE.Box3().setFromObject(o), c = box.getCenter(new THREE.Vector3());
    const uv = new Float32Array(p.count * 2), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(p, i + 1).applyMatrix4(o.matrixWorld); d.fromBufferAttribute(p, i + 2).applyMatrix4(o.matrixWorld);
      n.crossVectors(b.clone().sub(a), d.clone().sub(a)).normalize();
      const tri = [a, b, d];
      if (Math.abs(n.y) > 0.7) tri.forEach((q, j) => { uv[(i + j) * 2] = (q.x - c.x) / PERIOD; uv[(i + j) * 2 + 1] = (q.z - c.z) / PERIOD; });
      else {                                                          // the drum's side: unwrap by arc length, mend the seam
        const us = tri.map((q) => Math.atan2(q.z - c.z, q.x - c.x) * Math.hypot(q.x - c.x, q.z - c.z) / PERIOD);
        const circ = 2 * Math.PI * Math.hypot(tri[0].x - c.x, tri[0].z - c.z) / PERIOD, hi = Math.max(...us);
        tri.forEach((q, j) => { uv[(i + j) * 2] = hi - us[j] > circ / 2 ? us[j] + circ : us[j]; uv[(i + j) * 2 + 1] = q.y / PERIOD; });
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); o.geometry = g; o.material = material;   // keeps the drum's smooth normals
  });
}
