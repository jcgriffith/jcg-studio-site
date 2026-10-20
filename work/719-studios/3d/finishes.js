import * as THREE from 'three';
import { architecturalSurfaces } from './surfaces.js?v=20261017-grout';
import { finishPaintCans } from './paint-cans.js';

// Small shared procedural maps: no additional texture downloads.
function surfaceMap(kind, repeat) {
  const size = 128, data = new Uint8Array(size * size * 4);
  let seed = 719;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const weave = kind === 'fabric' ? 14 * Math.sin(x * Math.PI / 2) * Math.sin(y * Math.PI / 2) : 0;
    const value = Math.round(218 + random() * 30 + weave);
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat); texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true; return texture;
}

export function finishMaterials(root, renderer, assetRoot, invalidate) {
  const grain = surfaceMap('stone', 12), fabric = surfaceMap('fabric', 24);
  grain.anisotropy = fabric.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const seen = new Set(), floors = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m?.isMeshStandardMaterial || seen.has(m)) continue;
      seen.add(m); const n = m.name.toLowerCase();
      if (/chrome|steel|alumin|laptop|paint can/.test(n)) {
        m.metalness = /black|paint|shelf/.test(n) ? .45 : .92;
        m.roughness = /chrome/.test(n) ? .2 : .36;
      } else if (/velvet|cushion|curtain|leather|rattan/.test(n)) {
        m.roughness = /leather/.test(n) ? .66 : .92;
        m.bumpMap = fabric; m.bumpScale = .006;
      } else if (/desert pink|cream_matte|farm green|white/.test(n) && !m.emissive?.getHex()) {
        m.roughness = .87; m.bumpMap = grain; m.bumpScale = .004;
      } else if (/terrazzo|pebble|subway/.test(n)) {
        m.roughness = /subway/.test(n) ? .3 : .6;
        m.bumpMap = grain; m.bumpScale = .008;
      } else if (/ceramic|sculpture/.test(n)) {
        m.roughness = .24;
      }
      if (/polished concrete/.test(n)) {
        m.color.setRGB(.31, .29, .26); m.roughness = .72;
        m.bumpMap = grain; m.bumpScale = .018;
      }
      if (n.includes('78246d9e')) { // Existing pool water material, retained geometry.
        m.color.setRGB(.018, .09, .095); m.roughness = .13; m.metalness = .12;
        m.envMapIntensity = 1.4; m.bumpMap = grain; m.bumpScale = .006;
      }
      m.needsUpdate = true;
    }
    if ((Array.isArray(o.material) ? o.material : [o.material]).some(m => /polished concrete/i.test(m.name))) floors.push(o);
  });
  const applySurface = architecturalSurfaces(renderer);
  root.traverse(o => { if(o.isMesh)applySurface(o); });
  finishPaintCans(root, renderer);
  // Fill the entire rectangular recess, below the tiled lip (y=.281).
  // The imported landscape was a rounded island, exposing tile in all four corners.
  const sand=root.getObjectByName('Landscape001');
  if(sand){
    const x0=3.822,x1=4.990,z0=2.616,z1=4.597;
    // JC 2026-10-17: "the sand pit also looks overly flat". Soft mounds and hollows (up to ~7 cm) from layered value noise,
    // faint raked ridges, all eased below the tile lip at the edges; a speckled grain map so it reads as sand up close.
    const g=new THREE.PlaneGeometry(x1-x0,z1-z0,120,200);
    g.rotateX(-Math.PI/2);
    const p=g.attributes.position;
    const hash=(i,j)=>{const s=Math.sin(i*127.1+j*311.7)*43758.5453;return s-Math.floor(s);};
    const vnoise=(x,y)=>{const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(i,j),hash(i+1,j),u),THREE.MathUtils.lerp(hash(i,j+1),hash(i+1,j+1),u),v);};
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i);
      const edge=Math.min((x1-x0)/2-Math.abs(x),(z1-z0)/2-Math.abs(z));
      const fade=THREE.MathUtils.smoothstep(edge,0,.22);
      const mounds=.052*vnoise(x*2.4+3,z*2.4)+.022*vnoise(x*6,z*6+7)+.006*vnoise(x*15,z*15);
      const raked=.0025*Math.sin(z*42+1.5*Math.sin(x*3));
      p.setY(i,.178+fade*(.014+mounds+raked));
    }
    g.computeVertexNormals();
    // the pit sits in the set wall's shade, so light alone can't show the mounds: hollows a touch darker, crests lighter
    {const n=g.attributes.normal,col=new Float32Array(p.count*3);let lo=1e9,hi=-1e9;
     for(let i=0;i<p.count;i++){const y=p.getY(i);lo=Math.min(lo,y);hi=Math.max(hi,y);}
     for(let i=0;i<p.count;i++){const h=(p.getY(i)-lo)/(hi-lo||1),k=.78+.34*h-.5*(1-n.getY(i));col[i*3]=col[i*3+1]=col[i*3+2]=k;}
     g.setAttribute('color',new THREE.BufferAttribute(col,3));}
    sand.geometry=g;
    sand.position.set((x0+x1)/2,0,(z0+z1)/2);sand.rotation.set(0,0,0);sand.scale.set(1,1,1);
    const sc=document.createElement('canvas');sc.width=sc.height=256;const sx=sc.getContext('2d'),img=sx.createImageData(256,256);
    for(let k=0;k<256*256;k++){const r=Math.random(),v=r<.06?150+Math.random()*40:r>.97?255:215+Math.random()*30;img.data[k*4]=v;img.data[k*4+1]=v*.97;img.data[k*4+2]=v*.9;img.data[k*4+3]=255;}
    sx.putImageData(img,0,0);
    const speck=new THREE.CanvasTexture(sc);speck.wrapS=speck.wrapT=THREE.RepeatWrapping;speck.repeat.set(5,8);speck.colorSpace=THREE.SRGBColorSpace;
    speck.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    sand.material=sand.material.clone();sand.material.color.set('#b49d70');sand.material.roughness=1;sand.material.vertexColors=true;sand.material.map=speck;   // khaki-tan, from the stage photos
    sand.material.bumpMap=speck;sand.material.bumpScale=.003;
    sand.updateMatrixWorld(true);
  }
  new THREE.TextureLoader().load(assetRoot + '3d/etherea-floor-contact-v2.png?v=20261015-pots', (ao) => {
    ao.channel = 1; ao.colorSpace = THREE.NoColorSpace;
    for (const o of floors) {
      const g = o.geometry = o.geometry.clone(), positions = g.attributes.position;
      const uv = new Float32Array(positions.count * 2), p = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        p.fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld);
        uv[i * 2] = (p.x + 7) / 14; uv[i * 2 + 1] = (-p.z + 7) / 14;
      }
      g.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => { m.aoMap = ao; m.aoMapIntensity = .85; m.needsUpdate = true; });
    }
    invalidate();
  });
}

export function windowBackdrop(scene, walls) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const ctx = c.getContext('2d'), gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, '#b5d0df'); gradient.addColorStop(.6, '#e8e7dc'); gradient.addColorStop(1, '#afb6a7');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 4, 128);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(12.2, 3.22), material);
  back.position.set(-.04, 1.744, -6.15); scene.add(back);
  walls.push({ o: back, n: new THREE.Vector3(0, 0, -1) });
  const left = new THREE.Mesh(new THREE.PlaneGeometry(12.2, 3.22), material);
  left.rotation.y = Math.PI / 2; left.position.set(-6.18, 1.744, 0); scene.add(left);
  walls.push({ o: left, n: new THREE.Vector3(-1, 0, 0) });
  return material;
}
