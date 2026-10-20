import * as THREE from 'three';

export function fixtureDetails(root, lamps) {
  const emitters=[],rackLenses=[];
  const woodCanvas=document.createElement('canvas');woodCanvas.width=512;woodCanvas.height=128;
  const wc=woodCanvas.getContext('2d');wc.fillStyle='#ac8056';wc.fillRect(0,0,512,128);
  for(let y=0;y<128;y++){
    const shade=128+Math.round(15*Math.sin(y*1.8)+8*Math.sin(y*.31));
    wc.strokeStyle=`rgba(${shade},${shade*.66},${shade*.39},.38)`;wc.beginPath();
    for(let x=0;x<=512;x+=8){const yy=y+1.4*Math.sin(x*.018+y*.14);x?wc.lineTo(x,yy):wc.moveTo(x,yy);}wc.stroke();
  }
  const wood=new THREE.CanvasTexture(woodCanvas);wood.colorSpace=THREE.SRGBColorSpace;
  wood.wrapS=wood.wrapT=THREE.RepeatWrapping;wood.anisotropy=4;
  const glow=(o,color='#fff1dc',strength=1)=>{
    const m=o.material=o.material.clone();m.color.set('#fff8ed');m.emissive.set(color);
    m.emissiveIntensity=1.6*strength;m.roughness=.45;m.metalness=0;
    m.userData.practicalStrength=strength;emitters.push(m);
  };
  const light=(o,color,power,offset=new THREE.Vector3(),aim=null)=>{
    const at=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).add(offset);
    const l=aim?new THREE.SpotLight(color,power,4,Math.PI*.38,.85,2):new THREE.PointLight(color,power,2.8,2);
    l.position.copy(at);l.userData.fixture=o;l.userData.power=power;
    if(aim){l.target.position.copy(at).add(aim);root.add(l.target);}
    lamps.add(l);
  };
  const rolls=['#eee5d5','#b9a086','#79604e','#cfb99a','#a17f67','#939883','#d3c9b7'];
  root.traverse(o=>{
    if(!o.isMesh)return;
    const n=o.name,m=o.material;
    const roll=n.match(/^Paper_roll_(\d+)$/);
    const highRoll=/Furniture_(LqD1oB7|ZUKrwk|cIdyBo9)/.test(o.parent?.name||n) && m?.name?.includes('4c8f239a');
    if(roll||highRoll){o.material=m.clone();o.material.color.set(roll?rolls[(+roll[1]-1)%7]:n.includes('ZUK')||o.parent?.name?.includes('ZUK')?'#816653':n.includes('cId')||o.parent?.name?.includes('cId')?'#c4ad8e':'#e6dbc7');o.material.roughness=.9;}
    // The plywood backing is not the luminous face of the vanity.
    if(n.startsWith('Plywood')){
      o.material=m.clone();o.material.emissive.set(0);o.material.color.set('#ffffff');o.material.map=wood;o.material.roughness=.62;
      const g=o.geometry=o.geometry.clone(),p=g.attributes.position,uv=new Float32Array(p.count*2),v=new THREE.Vector3();
      for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);uv[i*2]=v.x/1.5;uv[i*2+1]=(v.z+v.y*.12)/.32;}
      g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    }
    if(m?.name==='web_material_1.001'){
      const p=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      if(p.x < -3.5 && p.y>3 && p.z<2){glow(o,'#fff1d6',2);o.material.userData.nightOnly=true;rackLenses.push({o,p});}
    }
    if(n==='Mirror_LIght'){glow(o,'#fff5e5',1.25);light(o,'#fff0db',3,new THREE.Vector3(0,0,-.08),new THREE.Vector3(0,0,-1));}
    // Every hanging light reads the same (JC 2026-10-17): one warm glow and one strength, off by day, on in golden hour and studio.
    const pendant=(offset)=>{glow(o,'#ffd9a6',1);light(o,'#ffcf96',2.6,offset);o.material.userData.nightOnly=lamps.children.at(-1).userData.nightOnly=true;};
    // Pool: the rattan globes either side of the green arch also wash the green wall just behind them.
    if(m?.name==='web_Rattan globe'&&new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).x<-4.5)pendant(new THREE.Vector3(-.06,0,0));
    if(n==='Lounge_pendant_drum')pendant();
    // The table lamp beside the green sofa.
    if(/^Furniture_3vVXyY7/.test(n)||/^Furniture_3vVXyY7/.test(o.parent?.name||'')){glow(o,'#ffd7a0',1.2);light(o,'#ffcf96',2.4);o.material.userData.nightOnly=lamps.children.at(-1).userData.nightOnly=true;}
    if(m?.name==='web_Material.003'){
      const p=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      if(p.x>3)pendant();   // the desert set's four globes
    }
    if(/^Plane00[12]$/.test(n)||/^Plane\.00[12]$/.test(n)){
      glow(o,'#fff9ef',2.2);
      // Put the source just in front of the diffuser and aim at the seamless paper.
      light(o,'#fff8ed',32,new THREE.Vector3(.12,0,0),new THREE.Vector3(1,-.28,0));
    }
    if(m?.name==='web_desert curtain'){
      if(n.startsWith('Curtain_backing')){
        o.position.x-=.128;o.scale.y*=1.049;o.position.y-=.0026;
      }else{
        o.position.x=5.50;o.scale.z*=.55;o.scale.y*=1.049;
      }
    }
  });
  // Four broad washes, anchored to real lenses, cover the two racks economically.
  rackLenses.sort((a,b)=>a.p.z-b.p.z||a.p.x-b.p.x);
  rackLenses.forEach(({o,p},i)=>{
    if(i%2===0){light(o,'#fff1d8',4.5,new THREE.Vector3(0,-.04,0),new THREE.Vector3(p.x<-5.2?-.18:0,-1,p.z>1.5?.12:0));lamps.children.at(-1).userData.nightOnly=true;}   // the green wall's track lights: golden hour and studio only
  });
  root.updateMatrixWorld(true);
  // Two concealed sources wash the rear wall through the circular opening.
  const wall=root.getObjectByName('New_Desert_Wall');
  // Placed symmetrically either side of the circle (centre z 1.0446, height 1.76, radius .762), just outside its edge,
  // and invisible: only their light shows, never the fixture (JC 2026-10-16).
  for(const z of [1.0446-.86,1.0446+.86]){
    const source=new THREE.Mesh(new THREE.BoxGeometry(.018,.20,.045),new THREE.MeshStandardMaterial({color:'#fff3dd'}));
    source.name='Desert_backlight';source.position.set(5.50,1.76,z);source.visible=false;root.add(source);source.updateMatrixWorld(true);
    glow(source,'#ffddaa',1.2);light(source,'#ffdfb4',2.5,new THREE.Vector3(.025,0,0),new THREE.Vector3(1,0,0));
    // Follow the set wall's visibility, including cutaway mode.
    if(wall)lamps.children.at(-1).userData.fixture=wall;
  }
  return emitters;
}
