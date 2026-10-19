import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// One two-material mesh per can; shared geometry and small generated paper labels.
export function finishPaintCans(root, renderer) {
  const metal = new THREE.MeshStandardMaterial({color:'#b9bcba',metalness:.78,roughness:.3});
  const pieces = [new THREE.CylinderGeometry(.085,.085,.19,32)];
  for (const y of [-.09,.092]) {
    const rim = new THREE.TorusGeometry(.084,.004,6,32);
    rim.rotateX(Math.PI/2);rim.translate(0,y,0);pieces.push(rim);
  }
  const lid = new THREE.CylinderGeometry(.077,.077,.003,32);
  lid.translate(0,.097,0);pieces.push(lid);
  const lidGroove = new THREE.TorusGeometry(.068,.0018,4,32);
  lidGroove.rotateX(Math.PI/2);lidGroove.translate(0,.099,0);pieces.push(lidGroove);
  // Raised wire bail gives the small silhouette a recognizable paint-tin profile.
  const bail = new THREE.TorusGeometry(.088,.0027,5,24,Math.PI);
  bail.translate(0,.035,0);pieces.push(bail);
  for (const x of [-.086,.086]) {
    const lug=new THREE.SphereGeometry(.006,8,6);lug.translate(x,.035,0);pieces.push(lug);
  }
  const shell=mergeGeometries(pieces);
  const label=new THREE.CylinderGeometry(.0856,.0856,.139,32,1,true);
  const geometry=mergeGeometries([shell,label],true);
  pieces.forEach(g=>g.dispose());shell.dispose();label.dispose();
  const colors=['#b3654b','#64877c','#d4b56e','#7a8eaa','#ad7c81','#66858a','#a89b7c'];
  let i=0;
  const cans=[];root.traverse(o=>{if(o.isMesh && /^Paint[_ ]can[_ ]\d+$/i.test(o.name))cans.push(o);});
  for(const can of cans){
    const color=colors[i++%colors.length],c=document.createElement('canvas');c.width=512;c.height=128;
    const ctx=c.getContext('2d');ctx.fillStyle='#eee7d7';ctx.fillRect(0,0,512,128);
    ctx.fillStyle=color;ctx.fillRect(0,0,512,28);ctx.fillRect(0,91,512,37);
    // Repeat on both sides so the label stays legible as the viewer orbits.
    for(const x of [128,384]){
      ctx.textAlign='center';ctx.fillStyle='#323d3a';ctx.font='bold 25px sans-serif';ctx.fillText('PAINT',x,58);
      ctx.font='11px sans-serif';ctx.fillText('INTERIOR · MATTE',x,78);
      ctx.fillStyle='#fff7e8';ctx.font='bold 13px sans-serif';ctx.fillText('STUDIO COLOR',x,113);
    }
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
    map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    const paper=new THREE.MeshStandardMaterial({map,roughness:.82});
    can.geometry=geometry;can.material=[metal,paper];
  }
}
