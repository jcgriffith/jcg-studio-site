import * as THREE from 'three';
const B = (x,y,z) => new THREE.Vector3(x,z,-y);
// Composed viewpoints based on the studio photographs, not surveyed camera locations.
const views = {
  stage: { position: B(1.7,-2.6,1.85), target: B(5.25,-2.65,1.6), fov: 82 },
  pool: { position: B(1.5,-.4,2.1), target: B(-4.4,3.2,.95), fov: 62 },
  forest: { position: B(.1,3.8,2), target: B(-4.9,-1.65,1.8), fov: 60 },
  'green-wall': { position: B(.1,3.8,2), target: B(-4.9,-1.65,1.8), fov: 60 },
  lounge: { position: B(2.2,2.2,2), target: B(-.1,-2,1), fov: 60 },
  'photo-corner': { position: B(.5,.1,1.8), target: B(4.5,4.2,1.4), fov: 60 },
};
// The tour is the studio's story (JC 2026-10-17): chapters, each a camera move, a few lines and (where we have them)
// a photo strip. 'home' = the overview. Story photos sit beside the set photos in img/work/719/ (src relative to sets/).
const P = (n) => ({ src: `../${n}.webp`, w: 1600, h: 1067 });
// The studio's own reels (downloaded 2026-10-17, muted for the web): poster as src, the clip in video. Paths from sets/.
const V = (n) => ({ src: `../../../../video/719/${n}.jpg`, video: `../../../../video/719/${n}.mp4`, w: 540, h: 960 });
const stops = [
  { id:'photographers', sum:'Kristi and I were photographers before we were studio owners.',  chip:'Two photographers', title:'Two photographers',
    detail:'Before the studio, Kristi and I were shooting around downtown LA. She came to photography from dance and loved portraits with movement; I came from marketing and graphic design and leaned cinematic. Friends of ours had opened studios on Peerspace that were doing well, and they talked us into building one.',
    photos:[{ src:'../jc-and-kristi.webp', w:1281, h:1600 }] },   // JC and Kristi in the studio mirror (@kmo_18, July 2024)
  { id:'sign', sum:'719 was the area code of Kristi\'s hometown. We took it as a sign.',  chip:'719', title:'A sign at 719',
    detail:'Kristi fell for this loft, and the address sealed it: 719 is the area code of Colorado Springs, where she grew up, and it was still her phone number. She took it as a sign. We started with units 902 and 903, one big combined space, and it became the Etherea Loft.',
    photos:[V('01-etherea-empty-studio'),P('hero')] },
  { id:'dreamscape', sum:'We built the surreal dreamscapes everyone was pinning, for real.',  chip:'The dreamscape', title:'A dreamscape, for real',
    detail:'We filled a Pinterest board with the surreal dreamscapes taking over the feed. Most only existed in Blender, and people struggled to bring that look into real life. I grew up working in renovation and construction, so building it felt possible. We kept natural tones, cut them with bright white subway tile, and designed every set in 3D first.',
    photos:[V('02-etherea-render-to-real'),...['eth-plan','eth-stage-render','eth-stage-built','eth-lounge-render','eth-lounge-built','eth-pool-render','eth-pool-built'].map(P)] },
  { id:'build', sum:'Steel studs, fire-treated wood and sprinklers: the fire code shaped the sets.',  chip:'The build', title:'Studs, sprinklers and tile',
    detail:'Then we built it, and the fire code had opinions: steel studs instead of wood, fire-treated lumber, new sprinklers, and set walls kept low enough for the sprinklers to reach over them. That is why the pink wall stops short of the ceiling.',
    photos:[V('03-etherea-build-timelapse')] },
  { id:'stage', sum:'Arches, warm plaster and sculptural steps.',  chip:'Desert Set', title:'Desert Set', detail:'Arches, warm plaster and sculptural steps. A collection of backdrops within a single set.', position:B(-3.5,-5.5,5), target:B(4.5,-2.2,1.2) },
  { id:'forest', sum:'Greenery, water and layered platforms.',  chip:'Forest Set', title:'Forest Set', detail:'Greenery, water and layered platforms bring a softer atmosphere to the other side of the loft.', position:B(.6,-1.8,4.6), target:B(-4.1,1.1,1.1) },   // looks past the column, not through it
  { id:'photo-corner', sum:'A seamless-paper corner for open-ended ideas.',  chip:'Blank canvas', title:'A blank canvas', position:B(.4,-.6,3.2), target:B(4.5,4.2,1.2),
    detail:'The best studios we knew offered several looks in one booking, so alongside the sets we kept a seamless-paper corner with nothing in the way: a blank canvas for completely open-ended ideas.' },
  { id:'lounge', sum:'The lounge ties the sets together.',  chip:'The lounge', title:'The space between', detail:'The central lounge connects the sets and creates another place to compose a photograph.', position:B(4,-6,4.5), target:B(-.4,-1.9,.8) },
  { id:'proof', sum:'1,000+ reviews, a 5.0 average and a 2023 Peerspace award.',  chip:'What it became', title:'Booked from the start',
    detail:'It was booked right away. More than 1,000 reviews across our three lofts with a 5.0 average, celebrities on set.', award:true },
  { id:'end', sum:'We sold 719 Studios on June 15, 2026, after moving home to Colorado.',  chip:'The ending', title:'Home to Colorado',
    detail:'In late 2025 we moved back to Colorado to start our family and ran the lofts from there. On June 15, 2026, we sold 719 Studios. Owned and operated 2021\u20132026.' },
];
export function createExperience({ camera, controls, reduce, phone, openGallery, closeGallery, photos, storyPhotos, assetRoot, invalidate }) {
  stops.forEach((s) => { if (s.photos) storyPhotos[s.id] = s.photos; });
  let spinning = false;
  const setSpin = (on) => { spinning = on && !reduce; controls.autoRotate = spinning; controls.autoRotateSpeed = .35; if (spinning) invalidate(); };
  const panel = document.getElementById('tour-panel'), article = document.getElementById('tour-article');
  const count = document.getElementById('tour-count');
  const comparison = document.getElementById('comparison'), shot = document.getElementById('comparison-image');
  const photoLayer = document.getElementById('photo-layer');
  let home, animation = null, stop = -1, photoMode = false;
  function move(view, done) {
    if (phone && view !== home) {
      const factor = view.fov ? 1.35 : 1.55;
      view = {...view, position:view.target.clone().add(view.position.clone().sub(view.target).multiplyScalar(factor))};
    }
    if (phone) framePhone(); else camera.clearViewOffset();
    controls.enabled = false;
    controls.minDistance = .6; controls.maxPolarAngle = Math.PI * .53;
    animation = { p:camera.position.clone(), t:controls.target.clone(), f:camera.fov, view, done, start:performance.now(), duration:reduce?0:1250 };
    invalidate();
  }
  // Phones (JC 2026-10-18): the tour is a drawer that opens at half the screen and drags to any height. The 3D frames
  // its subject in the space left above it (below the top bar), live while dragging.
  const TOPBAR = 90;
  function framePhone() {
    if (panel.hidden) { camera.clearViewOffset(); return; }
    const h = panel.getBoundingClientRect().height;
    camera.setViewOffset(innerWidth, innerHeight, 0, Math.max(0, (h - TOPBAR) / 2), innerWidth, innerHeight);
    camera.updateProjectionMatrix(); invalidate();
  }
  function setSheetHeight(px) {
    panel.style.height = Math.round(Math.max(150, Math.min(innerHeight * .92, px))) + 'px';
    framePhone();
  }
  const touring = (on) => document.documentElement.classList.toggle('touring', on);
  function update(now) {
    if (!animation) return spinning;
    const a=animation, k=a.duration?Math.min(1,(now-a.start)/a.duration):1, e=k*k*(3-2*k);
    camera.position.lerpVectors(a.p,a.view.position,e); controls.target.lerpVectors(a.t,a.view.target,e);
    camera.fov=THREE.MathUtils.lerp(a.f,a.view.fov || (phone?58:48),e);camera.updateProjectionMatrix();controls.update();
    if(k===1){animation=null;controls.enabled=true;a.done?.();}
    return true;
  }
  function hidePhoto() {
    photoMode=false;photoLayer.hidden=true;
    document.getElementById('compare-photo').setAttribute('aria-pressed','false');
    document.getElementById('compare-model').setAttribute('aria-pressed','true');
  }
  function resetComparison() { comparison.hidden=true;hidePhoto(); }
  // Each chapter is a short article: big title, a wide lead image, the one-line dek, then the story with the rest of the
  // photos as a carousel (or one wide image) between its paragraphs. Any photo opens the full-screen gallery.
  const esc=(s)=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const icon='<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>';
  const media=(p,i,cls,total)=>`<button type="button" class="art-media ${cls}" data-i="${i}" aria-label="${p.video?'Play the video':'Open the photo'} (${i+1} of ${total})"><img src="${assetRoot}img/work/719/sets/${p.src}" alt="" loading="${i?'lazy':'eager'}" decoding="async">${p.video?'<span class="play" aria-hidden="true"></span>':''}<span class="expand" aria-hidden="true">${icon}${i===0&&total>1?total:''}</span></button>`;
  function paragraphs(s){                                 // a story of three or more sentences splits around its media
    if(s.paras)return s.paras;
    const parts=s.detail.split(/(?<=[.!?])(?<!\bNo\.)\s+(?=[A-Z“"])/);   // sentence ends only: not "5.0", not "No. 9"
    if(parts.length<3)return [s.detail];
    const half=Math.ceil(parts.length/2);
    return [parts.slice(0,half).join(' '),parts.slice(half).join(' ')];
  }
  // The Peerspace award (JC 2026-10-18: part of the story, not a badge on the page): links to the archived winners list.
  const AWARD=`<a class="art-award" href="https://web.archive.org/web/20230929030652/https://madein.peerspace.com/awards/los-angeles/production" target="_blank" rel="noopener"><img src="../../../assets/img/work/719/peerspace-open-door-2023.webp" width="285" height="400" alt="Peerspace Open Door Awards 2023 winner badge"><span><b>Open Door Awards 2023</b>No. 9 of the top 10 production spaces in Los Angeles<i>See the winners ↗</i></span></a>`;
  function renderArticle(s){
    const list=photos(s.id),paras=paragraphs(s),rest=list.slice(1);
    let h=`<h1>${esc(s.title)}</h1>`;
    if(list[0])h+=media(list[0],0,'art-lead',list.length);
    if(s.sum&&!s.detail.startsWith(s.sum))h+=`<p class="art-dek">${esc(s.sum)}</p>`;   // no dek when the story already opens with it
    h+=`<p>${esc(paras[0])}</p>`;
    if(rest.length>1)h+=`<div class="art-carousel">${rest.map((p,k)=>media(p,k+1,'',list.length)).join('')}</div><p class="art-count">${rest.length} more · swipe</p>`;
    else if(rest.length===1)h+=media(rest[0],1,'art-wide',list.length);
    paras.slice(1).forEach(x=>{h+=`<p>${esc(x)}</p>`;});
    if(s.award)h+=AWARD;
    article.innerHTML=h;article.scrollTop=0;
  }
  article.addEventListener('click',e=>{const b=e.target.closest('.art-media');if(!b)return;const s=stops[stop];openGallery({id:s.id,label:s.title},Number(b.dataset.i));});
  // Chapter chips (desktop) and ticks (phone): tap any chapter.
  const chips=document.getElementById('tour-chapters');
  chips.innerHTML=stops.map((s,i)=>`<button type="button" role="tab" data-i="${i}" aria-selected="false">${s.chip}</button>`).join('');
  chips.addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(b)showStop(Number(b.dataset.i));});
  const pad=(n)=>String(n).padStart(2,'0');
  const ticks=document.getElementById('tour-ticks');
  ticks.innerHTML=stops.map((s,i)=>`<button type="button" data-i="${i}" aria-label="${s.chip}"></button>`).join('');
  ticks.addEventListener('click',e=>{if(performance.now()-dragEnded<350)return;const b=e.target.closest('button[data-i]');if(b)showStop(Number(b.dataset.i));});   // a drag along the ticks is not a tap
  // Phone gestures: drag the drawer's top (grip, ticks, count row) to any height; swipe sideways on the article
  // (not inside a carousel) to change chapter.
  let drag=null,swipe=null,dragEnded=0;
  panel.addEventListener('pointerdown',e=>{
    if(!phone)return;
    if(e.target.closest('.sheet-grip,.tour-ticks,.panel-top')&&!e.target.closest('#tour-close')){
      drag={y:e.clientY,h:panel.getBoundingClientRect().height,moved:false};panel.setPointerCapture(e.pointerId);return;
    }
    if(e.target.closest('.tour-article')&&!e.target.closest('.art-carousel'))swipe={x:e.clientX,y:e.clientY};
  });
  panel.addEventListener('pointermove',e=>{if(!drag)return;const dy=e.clientY-drag.y;if(Math.abs(dy)>3)drag.moved=true;if(drag.moved)setSheetHeight(drag.h-dy);});
  panel.addEventListener('pointerup',e=>{
    if(drag){const moved=drag.moved;drag=null;if(moved){dragEnded=performance.now();return;}}
    if(swipe){const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;
      if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.6){dx<0?(stop<stops.length-1&&showStop(stop+1)):(stop>0&&showStop(stop-1));}}
  });
  panel.addEventListener('pointercancel',()=>{drag=null;swipe=null;});
  function showStop(index) {
    resetComparison(); stop=index;const s=stops[index];panel.hidden=false;
    count.textContent=`${pad(index+1)} / ${pad(stops.length)}`;
    renderArticle(s);
    [...ticks.children].forEach((b,i)=>b.setAttribute('aria-current',String(i===index)));
    [...chips.children].forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));if(i===index)b.scrollIntoView({block:'nearest',inline:'center',behavior:reduce?'instant':'smooth'});});
    touring(true);
    if(phone&&!panel.style.height)setSheetHeight(innerHeight*.5);
    document.getElementById('tour-prev').disabled=index===0;
    document.getElementById('tour-next').textContent=index===stops.length-1?'Finish':'Next →';
    setSpin(false);
    // the camera only flies for chapters about a place in the loft (the sets); story chapters leave the view as it is
    if(s.position)move(s,()=>{if(s.spin)setSpin(true);});
    else if(phone)requestAnimationFrame(framePhone);
  }
  function overview() {
    closeGallery(false);panel.hidden=true;resetComparison();stop=-1;setSpin(false);touring(false);
    if(home)move(home,()=>{controls.minDistance=3.5;controls.maxPolarAngle=Math.PI*.47;});
  }
  document.getElementById('start-tour').addEventListener('click',()=>{closeGallery(false);showStop(0);});
  document.getElementById('overview').addEventListener('click',overview);
  document.getElementById('tour-close').addEventListener('click',()=>{panel.hidden=true;stop=-1;setSpin(false);touring(false);camera.clearViewOffset();camera.updateProjectionMatrix();invalidate();});
  document.getElementById('tour-prev').addEventListener('click',()=>showStop(Math.max(0,stop-1)));
  document.getElementById('tour-next').addEventListener('click',()=>stop===stops.length-1?overview():showStop(stop+1));
  document.getElementById('compare-model').addEventListener('click',()=>{hidePhoto();invalidate();});
  document.getElementById('compare-photo').addEventListener('click',()=>{
    photoMode=true;photoLayer.hidden=false;
    document.getElementById('compare-photo').setAttribute('aria-pressed','true');
    document.getElementById('compare-model').setAttribute('aria-pressed','false');invalidate();
  });
  document.getElementById('comparison-close').addEventListener('click',()=>{resetComparison();invalidate();});
  controls.addEventListener('start',()=>{animation=null;controls.enabled=true;hidePhoto();});
  return {
    ready(){ home={position:camera.position.clone(),target:controls.target.clone(),fov:camera.fov};document.getElementById('start-tour').disabled=false;document.getElementById('overview').disabled=false; },
    update,
    get animating(){return Boolean(animation);},
    get photoMode(){return photoMode;},
    viewPhoto(s,index){
      const p=photos(s.id)[index];if(!p)return;
      closeGallery(false);panel.hidden=true;stop=-1;hidePhoto();
      const src=assetRoot+'img/work/719/sets/'+p.src;
      shot.src=src;shot.alt=`${s.label}, reference photograph`;
      document.getElementById('comparison-title').textContent=s.label;
      comparison.hidden=false;
      // Each set has a composed reference viewpoint. Show the selected photograph without asserting an exact match.
      const viewId=s.id==='forest'?(p.src.startsWith('pool/')?'pool':'green-wall'):s.id;
      move(views[viewId] || views.stage,()=>document.getElementById('compare-photo').focus());
    },
    overview,
  };
}

export { stops };   // read by the story review export (story-review.html)
