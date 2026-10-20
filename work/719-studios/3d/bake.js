import * as THREE from 'three';

// Test bake (JC 2026-10-17, ?bake): the desert set's golden-hour light, baked in Cycles into one lightmap atlas on the
// objects' second UV map. Those surfaces become unlit and show the bake (times its exposure scale); everything else
// stays live. Shown in every lighting mode for now, since only golden hour is baked.
export async function applyBake(root, assets, invalidate) {
  const info = await fetch(`${assets}3d/bake/desert-bake.json`).then((r) => r.json());
  const map = await new THREE.TextureLoader().loadAsync(`${assets}3d/bake/desert-golden.webp`);
  map.flipY = false; map.colorSpace = THREE.SRGBColorSpace; map.channel = 1;
  map.anisotropy = 8; map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter;
  const material = new THREE.MeshBasicMaterial({ name: 'Desert bake', map, color: new THREE.Color(info.scale, info.scale, info.scale) });
  let hit = 0;
  for (const name of info.objects) {
    const o = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
    if (!o) continue;
    o.traverse((m) => {
      if (!m.isMesh || !m.geometry.attributes.uv1) return;      // only meshes that carry the Bake UV map
      m.material = material; m.castShadow = false; m.receiveShadow = false; hit++;
    });
  }
  invalidate();
  return hit;
}
