import * as THREE from 'three';

// The pampas vase keeps its real stoneware maps (diffuse, roughness, normal) from the Blender asset, at 1K.
export function finishVase(root, renderer, assets, invalidate) {
  const vase = root.getObjectByName('ceramic_vase_02');
  if (!vase?.isMesh) return;
  const loader = new THREE.TextureLoader(), anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const load = (name, srgb) => loader.load(`${assets}3d/tex/vase_${name}.webp`, (t) => { t.flipY = false; t.anisotropy = anisotropy; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; invalidate(); });
  vase.material = new THREE.MeshStandardMaterial({
    name: 'Vase stoneware', map: load('diff', true), roughnessMap: load('rough'), normalMap: load('nor'),
    roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1, 1),
  });
}
