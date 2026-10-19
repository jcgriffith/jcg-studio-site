import * as THREE from 'three';

function texture(canvas, color, renderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
function canvas(w,h) { const c=document.createElement('canvas');c.width=w;c.height=h;return c; }
function randomGenerator(seed) { return () => ((seed=(1664525*seed+1013904223)>>>0)/4294967296); }

function subway(renderer) {
  const color=canvas(512,256),height=canvas(512,256),rough=canvas(512,256);
  const c=color.getContext('2d'),h=height.getContext('2d'),r=rough.getContext('2d');
  c.fillStyle='#a8a399';c.fillRect(0,0,512,256);   // grout: a shade darker and ~3.5 mm wide so the pattern reads from the overview (JC 2026-10-17)
  h.fillStyle='#303030';h.fillRect(0,0,512,256);
  r.fillStyle='#ededed';r.fillRect(0,0,512,256);
  const random=randomGenerator(719);
  const tints=Array.from({length:16},()=>Math.floor(random()*5));
  // Four 6-inch tiles across, four 3-inch courses. Half-bond stagger repeats seamlessly.
  for(let row=0;row<4;row++)for(let col=-1;col<5;col++) {
    const x=col*128+(row%2)*64,y=row*64,tint=tints[row*4+((col%4)+4)%4];
    c.fillStyle=`rgb(${239-tint},${237-tint},${230-tint})`;
    c.beginPath();c.roundRect(x+2.6,y+2.6,122.8,58.8,2.6);c.fill();
    h.fillStyle='#b0b0b0';h.beginPath();h.roundRect(x+2.6,y+2.6,122.8,58.8,2.6);h.fill();
    h.fillStyle='#dedede';h.beginPath();h.roundRect(x+3,y+3,122,58,2);h.fill();
    h.fillStyle='#e8e8e8';h.fillRect(x+5,y+5,118,54);
    r.fillStyle=`rgb(${105+tint*2},${105+tint*2},${105+tint*2})`;r.fillRect(x+2,y+2,124,60);
  }
  return {map:texture(color,true,renderer),bumpMap:texture(height,false,renderer),roughnessMap:texture(rough,false,renderer),bumpScale:.003,roughness:.85,period:[.6096,.3048]};
}
// look (optional): palette, grout, cells, seed, stretch (flat river pebbles: each cell elongated along its own angle)
function pebble(renderer, look={}) {
  const size=512,cells=look.cells||28,random=randomGenerator(look.seed||2026719),sites=[];
  const palette=look.palette||[[224,218,201],[236,232,218],[205,198,178],[239,235,222],[218,214,199],[195,191,177]];
  for(let y=0;y<cells;y++)for(let x=0;x<cells;x++){const s={x:x+.2+random()*.6,y:y+.2+random()*.6,color:palette[Math.floor(random()*palette.length)],lift:.76+random()*.2};if(look.stretch){s.ang=random()*Math.PI;s.asp=1+random()*look.stretch;}sites.push(s);}
  const color=canvas(size,size),height=canvas(size,size),rough=canvas(size,size);
  const ctx=color.getContext('2d'),hc=height.getContext('2d'),rc=rough.getContext('2d');
  const colors=ctx.createImageData(size,size),heights=hc.createImageData(size,size),roughness=rc.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const px=(x+.5)/size*cells,py=(y+.5)/size*cells,gx=Math.floor(px),gy=Math.floor(py);
    let first=Infinity,second=Infinity,stone;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
      const ix=gx+dx,iy=gy+dy,s=sites[((iy+cells)%cells)*cells+(ix+cells)%cells];
      const sx=s.x+Math.floor(ix/cells)*cells,sy=s.y+Math.floor(iy/cells)*cells;
      let d=(px-sx)**2+(py-sy)**2;
      if(s.asp){const c=Math.cos(s.ang),n=Math.sin(s.ang),u=(px-sx)*c+(py-sy)*n,w=-(px-sx)*n+(py-sy)*c;d=u*u/s.asp+w*w*s.asp;}
      if(d<first){second=first;first=d;stone=s;}else if(d<second)second=d;
    }
    const edge=Math.sqrt(second)-Math.sqrt(first);
    const bevel=THREE.MathUtils.smoothstep(edge,.025,.19);
    const grain=(random()-.5)*9,offset=(y*size+x)*4;
    for(let k=0;k<3;k++)colors.data[offset+k]=THREE.MathUtils.lerp((look.grout||[176,170,153])[k],stone.color[k]+grain,bevel);
    const elevation=45+bevel*(170*stone.lift-24*Math.sqrt(first))+(random()-.5)*9;
    for(let k=0;k<3;k++){heights.data[offset+k]=elevation;roughness.data[offset+k]=220+(1-bevel)*25;}
    colors.data[offset+3]=heights.data[offset+3]=roughness.data[offset+3]=255;
  }
  ctx.putImageData(colors,0,0);hc.putImageData(heights,0,0);rc.putImageData(roughness,0,0);
  return {map:texture(color,true,renderer),bumpMap:texture(height,false,renderer),roughnessMap:texture(rough,false,renderer),bumpScale:.012,roughness:.95,period:[.56,.56]};
}

export function architecturalSurfaces(renderer) {
  const tile=subway(renderer),stone=pebble(renderer),materials=new Map();
  // The green-wall corner's top level (photo): flat white-to-charcoal river pebbles in grey grout, larger than the desert set's.
  const grey=pebble(renderer,{cells:18,seed:91,stretch:1.4,grout:[172,171,167],palette:[[242,241,237],[242,241,237],[236,235,231],[236,235,231],[226,226,222],[226,226,222],[214,214,210],[200,200,196],[184,184,180],[150,150,147],[118,118,115]]});
  const pick=(name)=>/subway/i.test(name)?tile:/charcoal/i.test(name)?grey:stone;
  return (o)=>{
    const original=Array.isArray(o.material)?o.material:[o.material];
    if(!original.some(m=>/subway|pebble mosaic/i.test(m.name)))return;
    // Independent face UVs use world metres, so tops and risers share the same real tile size.
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();o.geometry=g;
    const positions=g.attributes.position,uv=new Float32Array(positions.count*2);
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3();
    for(let i=0;i<positions.count;i+=3){
      a.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(positions,i+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(positions,i+2).applyMatrix4(o.matrixWorld);
      n.crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();
      const group=g.groups.find(group=>i>=group.start && i<group.start+group.count);
      const material=original[group?.materialIndex||0],finish=pick(material.name);
      for(const [j,p] of [a,b,c].entries()){
        let u,v;
        if(Math.abs(n.y)>.7){u=-p.z;v=p.x;}
        else if(Math.abs(n.x)>Math.abs(n.z)){u=-p.z;v=p.y;}
        else {u=p.x;v=p.y;}
        uv[(i+j)*2]=u/finish.period[0];uv[(i+j)*2+1]=v/finish.period[1];
      }
    }
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    const updated=original.map(m=>{
      if(!/subway|pebble mosaic/i.test(m.name))return m;
      if(materials.has(m.uuid))return materials.get(m.uuid);
      const result=m.clone(),finish=pick(m.name);
      for(const key of ['map','bumpMap','roughnessMap','bumpScale','roughness'])result[key]=finish[key];
      result.color.set('#ffffff');result.metalness=0;result.needsUpdate=true;materials.set(m.uuid,result);return result;
    });
    o.material=Array.isArray(o.material)?updated:updated[0];
  };
}

export function paintBackdrop(texture, colors) {
  const c=texture.image,ctx=c.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,c.height);
  colors.forEach((color,i)=>gradient.addColorStop([0,.48,1][i],color.getStyle()));
  ctx.fillStyle=gradient;ctx.fillRect(0,0,c.width,c.height);texture.needsUpdate=true;
}

export function warmBackdrop() {
  const t=new THREE.CanvasTexture(canvas(16,256));t.colorSpace=THREE.SRGBColorSpace;
  t.generateMipmaps=false;t.minFilter=THREE.LinearFilter;
  t.userData.colors=['#afc4ce','#e3e4dc','#b7b9ae'].map(c=>new THREE.Color(c));
  paintBackdrop(t,t.userData.colors);return t;
}
