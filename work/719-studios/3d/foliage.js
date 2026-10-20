import * as THREE from 'three';

// Reuse the existing leaf silhouettes; vary their surfaces without adding polygons.
export function finishFoliage(root, renderer) {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#b8b8b8';ctx.fillRect(0,0,256,256);
  const gradient=ctx.createLinearGradient(0,0,256,0);
  gradient.addColorStop(0,'#858585');gradient.addColorStop(.45,'#d2d2d2');gradient.addColorStop(.55,'#c2c2c2');gradient.addColorStop(1,'#858585');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
  ctx.strokeStyle='#dddddd';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(128,0);ctx.lineTo(128,256);ctx.stroke();
  for(let y=-30;y<280;y+=25)for(const side of [-1,1]){
    ctx.strokeStyle='#a2a2a2';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(128,y);ctx.quadraticCurveTo(128+side*55,y+24,128+side*125,y+58);ctx.stroke();
    ctx.strokeStyle='#cdcdcd';ctx.lineWidth=.8;ctx.stroke();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const geometries=new Map(),materials=new Map();let meshes=0;
  root.traverse(o=>{
    if(!o.isMesh||Array.isArray(o.material))return;
    const m=o.material,n=m.name;
    if(n==='web_Procedural Dirt'){o.material=m.clone();o.material.color.set('#35291e');o.material.roughness=1;return;}
    const plantGroup=/Furniture_(BY4Y0|QL3NT|ZrJJ)/.test(o.name+' '+o.parent?.name);
    const leaf=n==='web_calathea_orbifolia_01'||(plantGroup&&m.color.g>m.color.r*1.01&&m.color.g>m.color.b*1.03);
    if(!leaf)return;meshes++;
    if(!materials.has(m.uuid)){
      const next=m.clone(),hsl={};next.color.getHSL(hsl);
      next.color.setHSL(.24+(hsl.h-.24)*.35,Math.min(.52,Math.max(.32,hsl.s)),Math.min(.32,hsl.l*.7));
      next.vertexColors=true;next.roughness=.56;next.metalness=0;next.side=THREE.DoubleSide;
      next.map=map;next.bumpMap=map;next.bumpScale=.0007;
      next.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= vec3(1.08, 1.14, 0.98);');};
      next.customProgramCacheKey=()=> 'leaf-underside-v1';materials.set(m.uuid,next);
    }
    o.material=materials.get(m.uuid);
    if(geometries.has(o.geometry.uuid)){o.geometry=geometries.get(o.geometry.uuid);return;}
    const original=o.geometry,g=original.clone(),p=g.attributes.position,count=p.count;
    const parent=Int32Array.from({length:count},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
    const join=(a,b)=>{parent[find(a)]=find(b);},points=new Map();
    for(let i=0;i<count;i++){
      const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
      if(points.has(key))join(i,points.get(key));else points.set(key,i);
    }
    const idx=g.index,tri=idx?idx.count:count;
    for(let i=0;i<tri;i+=3){const a=idx?idx.getX(i):i;join(a,idx?idx.getX(i+1):i+1);join(a,idx?idx.getX(i+2):i+2);}
    const islands=new Map();
    for(let i=0;i<count;i++){
      const id=find(i);if(!islands.has(id))islands.set(id,{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
      const box=islands.get(id),v=[p.getX(i),p.getY(i),p.getZ(i)];v.forEach((x,k)=>{box.min[k]=Math.min(box.min[k],x);box.max[k]=Math.max(box.max[k],x);});
    }
    for(const box of islands.values())box.axes=[0,1,2].sort((a,b)=>(box.max[b]-box.min[b])-(box.max[a]-box.min[a]));
    const uv=new Float32Array(count*2),colors=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const id=find(i),box=islands.get(id),v=[p.getX(i),p.getY(i),p.getZ(i)],[long,wide]=box.axes;
      uv[i*2]=(v[wide]-box.min[wide])/Math.max(.00001,box.max[wide]-box.min[wide]);
      uv[i*2+1]=(v[long]-box.min[long])/Math.max(.00001,box.max[long]-box.min[long]);
      const variation=.82+((id*2654435761)>>>0)/4294967295*.35;
      colors[i*3]=variation*.96;colors[i*3+1]=variation;colors[i*3+2]=variation*.91;
    }
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geometries.set(original.uuid,g);o.geometry=g;
  });
  return meshes;
}
