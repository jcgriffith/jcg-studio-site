import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { N8AOPass } from 'n8ao';   // its pmndrs path imports 'postprocessing', stubbed in the import map (unused here)
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// Finishing effects (JC 2026-10-17): ambient occlusion where surfaces meet (desktop), a soft glow on what is brighter
// than white (the lamps), and SMAA edges. Tone mapping moves into OutputPass, so the look matches the plain
// renderer. Phones skip AO and SMAA to stay smooth.
export function createPost(renderer, scene, camera, { phone }) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 0 });
  const composer = new EffectComposer(renderer, target);
  let ao = null;
  if (phone) composer.addPass(new RenderPass(scene, camera));
  else {                                   // N8AOPass draws the scene itself and adds the occlusion: it replaces RenderPass
    ao = new N8AOPass(scene, camera, size.x, size.y);
    ao.setQualityMode('Medium');
    Object.assign(ao.configuration, { aoRadius: 0.6, distanceFalloff: 0.6, intensity: 2.2, gammaCorrection: false });
    composer.addPass(ao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 1.05);   // strength, radius, threshold
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  if (!phone) composer.addPass(new SMAAPass(size.x, size.y));   // clean edges: N8AO draws without multisampling
  return {
    composer, ao, bloom,
    render() { composer.render(); },
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); },
  };
}
