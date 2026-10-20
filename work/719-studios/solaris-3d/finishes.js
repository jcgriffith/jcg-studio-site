import * as THREE from 'three';

// Solaris material finish (2026-10-19). Same approach as Etherea's ../3d/finishes.js: the GLB carries flat
// web_* materials (each Blender texture reduced to its mean colour), and the page adds small shared procedural maps for
// grain and weave, corrected metal / glass, the vanity's glowing LED frame, and the baked floor contact. No extra
// texture downloads beyond the one 30 KB contact map.
function surfaceMap(kind, repeat) {
  const size = 128, data = new Uint8Array(size * size * 4);
  let seed = 719;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const weave = kind === 'fabric' ? 14 * Math.sin(x * Math.PI / 2) * Math.sin(y * Math.PI / 2) : 0;
    const grain = kind === 'wood' ? 18 * Math.sin(y * .9 + 3 * Math.sin(x * .05)) : 0;
    const value = Math.round(Math.min(255, 214 + random() * 30 + weave + grain));
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat); texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true; return texture;
}

export function finishSolaris(root, renderer, contactUrl, invalidate) {
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const grain = surfaceMap('stone', 12), fabric = surfaceMap('fabric', 24), wood = surfaceMap('wood', 6);
  grain.anisotropy = fabric.anisotropy = wood.anisotropy = aniso;
  const seen = new Set(), floors = [], glow = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => /concrete/i.test(m.name))) floors.push(o);
    for (const m of mats) {
      if (!m?.isMeshStandardMaterial || seen.has(m)) continue;
      seen.add(m); const n = m.name.toLowerCase();
      if (/concrete/.test(n)) { m.color.multiply(new THREE.Color(.93, .9, .85)); m.roughness = .62; m.bumpMap = grain; m.bumpScale = .016; }
      else if (/driftwood|bois/.test(n)) { m.roughness = .78; m.bumpMap = wood; m.bumpScale = .006; }
      else if (/white wall|white\.001|80405c3d|4f065246|59352130|a9318bdf/.test(n)) { m.roughness = .87; m.bumpMap = grain; m.bumpScale = .004; }
      else if (/boucle|velvet|protextil|carpet|tex_u1|rug/.test(n)) { m.roughness = .94; m.metalness = 0; m.bumpMap = fabric; m.bumpScale = .007; }
      else if (/métal|metal|2145970781/.test(n)) { m.metalness = .9; m.roughness = /2145970781/.test(n) ? .42 : .3; }
      else if (/rubber/.test(n)) { m.roughness = .7; }
      if (/verre/.test(n)) {   // the coffee table's glass: thin, clear, a little reflection
        m.transparent = true; m.opacity = .18; m.roughness = .04; m.metalness = 0; m.depthWrite = false; m.envMapIntensity = 1.4;
      }
      if (m.emissive && m.emissive.getHex() !== 0) {   // the vanity mirror's LED frame (Material.046, an emission shader in Blender)
        m.color.set('#fff8ed'); m.emissive.set('#fff1dc'); m.userData.practicalStrength = 1; glow.push(m);
      }
      m.needsUpdate = true;
    }
  });
  new THREE.TextureLoader().load(contactUrl, (ao) => {
    ao.channel = 1; ao.colorSpace = THREE.NoColorSpace;
    // the bake covers Blender x -7..7, y -4..4 (bake_solaris_floor_contact.py)
    for (const o of floors) {
      const g = o.geometry = o.geometry.clone(), positions = g.attributes.position;
      const uv = new Float32Array(positions.count * 2), p = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        p.fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld);
        uv[i * 2] = (p.x + 7) / 14; uv[i * 2 + 1] = (-p.z + 4) / 8;
      }
      g.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.aoMap = ao; m.aoMapIntensity = .85; m.needsUpdate = true; });
    }
    invalidate();
  });
  return glow;
}

// Sky cards outside Solaris's two window walls (south: Blender y = -3.05, east: x = 6.1); each hides with its wall.
export function windowBackdrop(scene, walls) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const ctx = c.getContext('2d'), gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, '#b5d0df'); gradient.addColorStop(.6, '#e8e7dc'); gradient.addColorStop(1, '#afb6a7');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 4, 128);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
  const south = new THREE.Mesh(new THREE.PlaneGeometry(12.2, 3.2), material);
  south.position.set(0, 1.83, 3.25); scene.add(south);
  walls.push({ o: south, n: new THREE.Vector3(0, 0, 1) });
  const east = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 3.2), material);
  east.rotation.y = Math.PI / 2; east.position.set(6.3, 1.83, 0); scene.add(east);
  walls.push({ o: east, n: new THREE.Vector3(1, 0, 0) });
  return material;
}
