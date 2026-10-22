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
// THE SALE DATE (JC confirmed 2026-10-19): the one place it lives. Change it here and the tour's last chapter follows.
export const SOLD = { date: 'June 15, 2026', year: '2026' };
// One story across all three lofts (JC 2026-10-19): Etherea in 2021, Terra and Solaris in 2023, the sale. `studio` marks
// the chapter the 719 Studios page opens the tour at from that studio (work/719-studios/, ?tour=<id>).
const T = (n) => ({ src: `../${n}.webp`, w: 1600, h: 1068 });
const stops = [
  { id:'intro', sum:'My wife Kristi and I built Etherea, then kept going.',  chip:'The dream team', title:'The dream team',   // JC 2026-10-19: "Dream team", more playful
    detail:'Kristi and I co-founded 719 Studios in Los Angeles: Etherea, Terra and Solaris. We designed and built them together, and Kristi ran them day to day. Etherea came first. Before the studios, we shot all over downtown LA. Kristi came from dance, so her portraits move; I came from marketing and graphic design, so mine look like movie stills. Friends with thriving studios on Peerspace kept telling us to build one, and eventually we listened.',
    paras:['Kristi and I co-founded 719 Studios in Los Angeles: Etherea, Terra and Solaris. We designed and built them together, and Kristi ran them day to day. Etherea came first.',
           'Before the studios, we shot all over downtown LA. Kristi came from dance, so her portraits move; I came from marketing and graphic design, so mine look like movie stills. Friends with thriving studios on Peerspace kept telling us to build one, and eventually we listened.'],
    photos:[{ src:'../jc-and-kristi-etherea.webp', srcset:'../jc-and-kristi-etherea-1200.webp 1200w, ../jc-and-kristi-etherea.webp 1600w, ../jc-and-kristi-etherea-2400.webp 2400w', w:1600, h:1067,
              alt:'JC and Kristi Griffith inside Etherea, their Los Angeles production studio.' },   // JC (right) and Kristi in Etherea (added 2026-10-19; original in website/assets/)
            { src:'../jc-and-kristi.webp', w:1281, h:1600 }] },   // JC and Kristi in the studio mirror (@kmo_18, July 2024)
  { id:'sign', sum:'In 2021, an address helped us choose our first loft.',  chip:'2021 · Etherea', title:'A sign at 719', studio:'etherea',
    detail:'Kristi fell for the loft, and the address sealed it. 719 is the area code of Colorado Springs, where she grew up, and it was still the area code of her phone number. We took it as a sign. We started in 2021 with units 902 and 903, combined into one big space. That became the Etherea Loft.',
    paras:['Kristi fell for the loft, and the address sealed it. 719 is the area code of Colorado Springs, where she grew up, and it was still the area code of her phone number. We took it as a sign.',
           'We started in 2021 with units 902 and 903, combined into one big space. That became the Etherea Loft.'],
    photos:[V('01-etherea-empty-studio'),P('hero')] },
  { id:'dreamscape', sum:'I wanted to turn those saved images into a real studio.',  chip:'The dreamscape', title:'From Blender to building materials',
    detail:'Surreal dreamscapes filled the feed. Most only existed in Blender. I pinned hundreds: pink and terracotta arches, stairs running into pools, moss walls and portraits against a big orange sun. I grew up working in renovation and construction, so building one felt possible. Every set was designed in 3D first, pairing natural tones with bright white subway tile.',
    paras:['Surreal dreamscapes filled the feed. Most only existed in Blender. I pinned hundreds: pink and terracotta arches, stairs running into pools, moss walls and portraits against a big orange sun.',
           'I grew up working in renovation and construction, so building one felt possible. Every set was designed in 3D first, pairing natural tones with bright white subway tile.'], board:true,
    photos:[V('02-etherea-render-to-real'),...['eth-plan','eth-stage-render','eth-stage-built','eth-lounge-render','eth-lounge-built','eth-pool-render','eth-pool-built'].map(P)] },
  { id:'build', sum:'The fire code had a say in the design.',  chip:'The build', title:'Studs, sprinklers and tile',
    detail:'Then we built it: steel studs instead of wood, plus fire-treated lumber. We added new sprinklers and kept the set walls low so the water could reach over them. That is why the pink wall stops short of the ceiling.',
    paras:['Then we built it: steel studs instead of wood, plus fire-treated lumber.',
           'We added new sprinklers and kept the set walls low so the water could reach over them. That is why the pink wall stops short of the ceiling.'],
    photos:[V('03-etherea-build-timelapse')] },
  { id:'stage', sum:'We put desert on one side and forest on the other.',  chip:'The sets', title:'Two worlds, one loft',
    detail:'For the Desert Set: arches, warm plaster and sculptural steps. For the Forest Set: greenery, water and layered platforms. We tied them together with a lounge in between.',
    paras:['For the Desert Set: arches, warm plaster and sculptural steps. For the Forest Set: greenery, water and layered platforms.',
           'We tied them together with a lounge in between.'], position:B(-3.5,-5.5,5), target:B(4.5,-2.2,1.2) },
  { id:'photo-corner', sum:'We left a seamless paper corner open to whatever came next.',  chip:'Blank canvas', title:'Room for anything', position:B(.4,-.6,3.2), target:B(4.5,4.2,1.2),
    detail:'The best studios we knew offered several looks in one booking. Beside the sets, we kept a seamless paper corner with nothing in the way.',
    paras:['The best studios we knew offered several looks in one booking. Beside the sets, we kept a seamless paper corner with nothing in the way.'] },
  { id:'proof', sum:'We were booked from day one.',  chip:'What it became', title:'Booked from the start',
    detail:'Etherea booked right away, with celebrities on set. In the Peerspace Open Door Awards 2023, Etherea ranked No. 9 of the top 10 production spaces in LA.',
    paras:['Etherea booked right away, with celebrities on set. In the Peerspace Open Door Awards 2023, Etherea ranked No. 9 of the top 10 production spaces in LA.'], award:true },
  { id:'expand', sum:'In 2023, we added Terra and Solaris on the same floor.',  chip:'2023 · Terra + Solaris', title:'Two more lofts', studio:'terra solaris',
    detail:'We expanded in 2023 with Terra and Solaris, on the same floor as Etherea: the 9th floor of a 1927 building in the Fashion District. Our timelapse of the Terra build went viral: 3.2 million views on Instagram. We gave Terra a natural earth-tone palette and multiple sets: the circle, a U-shaped cut-out and semi-circles. Southeast-facing loft windows complete the space. Solaris is a bright corner studio with tall loft windows on two walls, limewash walls and archway textures. We designed it in 3D first, like the others, but it needed far less build-out. The windows were the draw, so we kept it clean and simple. Across the three lofts, we earned more than 1,000 reviews with a 5.0 average.',
    paras:['We expanded in 2023 with Terra and Solaris, on the same floor as Etherea: the 9th floor of a 1927 building in the Fashion District.',
           'Our timelapse of the Terra build went viral: 3.2 million views on Instagram.',   // JC 2026-10-19
           'We gave Terra a natural earth-tone palette and multiple sets: the circle, a U-shaped cut-out and semi-circles. Southeast-facing loft windows complete the space.',
           'Solaris is a bright corner studio with tall loft windows on two walls, limewash walls and archway textures. We designed it in 3D first, like the others, but it needed far less build-out. The windows were the draw, so we kept it clean and simple.',
           'Across the three lofts, we earned more than 1,000 reviews with a 5.0 average.'],
    photos:[V('04-terra-build-timelapse'),...['terra-01','solaris-01','terra-02','solaris-02','terra-03','solaris-04'].map(T)] },   // the Terra build timelapse: the reel that went viral (JC)
  { id:'end', sum:`We sold 719 Studios on ${SOLD.date}.`,  chip:`${SOLD.year} · Home`, title:'Home to Colorado',
    detail:`In January 2025, we moved home to Colorado to start our family, and Kristi ran the lofts from there. On ${SOLD.date}, we sold 719 Studios to new owners. We owned the studios from 2021 to ${SOLD.year}.`,
    photos:[{ src:'../colorado-family.webp', w:480, h:640, alt:'JC, Kristi and their baby by a mountain lake in Colorado.' }] },   // JC 2026-10-19: the closing Colorado image
];
// Twelve pins from JC's Etherea board, one row per set it fed: the desert's pink arches, the pool, the forest's moss, and the
// red-sun portraits. Shown from Pinterest and linked to each pin (other people's work: credited, not copied).
// [pin id, image, alt, original artist?, original source?]: credits only where the source names the maker (2026-10-22)
export const MOOD=[
  ['387591111696360805','35/b9/5a/35b95aa0eca3305c939b57377b755758.jpg','Pink arches and stairs with two white spheres','Charlotte Taylor','https://us.gestalten.com/blogs/journal/reverie-in-charlotte-taylor-serene-digital-worlds'],
  ['387591111693548159','3f/0d/7f/3f0d7fb55e9ff67039d05fbcfcb14674.jpg','A pink tunnel of arches','Simon Kämpfer','https://holmandhimmel.com/products/simon-kaempfer-opportunities-2019'],
  ['387591111692933351','6b/4a/7b/6b4a7b0a76a8e8275c4f292ebb6f00bb.jpg','A pink building of arches and steps'],
  ['387591111692380251','f0/d2/1f/f0d21fa9e58edbe14b437e30a2fe923f.jpg','Arches over a pool, rendered','@PeterTarka','https://twitter.com/PeterTarka/status/1423383395191730178'],
  ['387591111696360761','16/16/d0/1616d000752a10779008f270653dc0ae.jpg','An arch over water and trees'],
  ['387591111692424623','25/5c/91/255c910b1a319efd7b62d59adf22c832.jpg','An indoor pool among rocks'],
  ['387591111692866683','67/2d/b2/672db23ee2005d9ac53910b405e5d864.jpg','Curtains framing a path to a tree','James Tralie','https://www.reddit.com/r/Art/comments/kw5g4o/stairway_to_relaxation_james_tralie_me_3d_2021/'],
  ['387591111692933336','f3/14/4b/f3144b13c2306f76bee41ecbfb3fe239.jpg','A moss-covered wall piece'],
  ['387591111691892203','ce/f6/e5/cef6e54d6fc53e2adfe5857fc3906c9c.jpg','A living green wall'],
  ['387591111691632275','74/97/df/7497dff87eac89529cabc8710093b71a.jpg','Moss growing indoors by a window'],
  ['387591111692062229','00/0d/50/000d50f47939491c3f92119afa4363be.jpg','A silhouette against a red sun'],
  ['387591111691967033','47/6e/26/476e2622e9c4463cb30865f5c3c0a388.jpg','A portrait in front of a red sun']];
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
  const media=(p,i,cls,total)=>`<button type="button" class="art-media ${cls}" data-i="${i}" aria-label="${p.video?'Play the video':'Open the photo'} (${i+1} of ${total})"><img src="${assetRoot}img/work/719/sets/${p.src}"${p.srcset?` srcset="${p.srcset.replace(/(^|, )/g,`$1${assetRoot}img/work/719/sets/`)}" sizes="(max-width: 760px) 100vw, 400px"`:''} alt="${p.alt?esc(p.alt):''}" loading="${i?'lazy':'eager'}" decoding="async">${p.video?'<span class="play" aria-hidden="true"></span>':''}<span class="expand" aria-hidden="true">${icon}${i===0&&total>1?total:''}</span></button>`;
  function paragraphs(s){                                 // a story of three or more sentences splits around its media
    if(s.paras)return s.paras;
    const parts=s.detail.split(/(?<=[.!?])(?<!\bNo\.)\s+(?=[A-Z“"])/);   // sentence ends only: not "5.0", not "No. 9"
    if(parts.length<3)return [s.detail];
    const half=Math.ceil(parts.length/2);
    return [parts.slice(0,half).join(' '),parts.slice(half).join(' ')];
  }
  // The Peerspace award (JC 2026-10-18: part of the story, not a badge on the page): links to the archived winners list.
  const MOODBOARD=`<div class="art-mood">${MOOD.map(([id,img,alt])=>`<a href="https://www.pinterest.com/pin/${id}/" target="_blank" rel="noopener"><img src="https://i.pinimg.com/736x/${img}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>`).join('')}</div><p class="art-count">From my Etherea board on Pinterest · tap a pin to see it there</p>`;
  // The Etherea inspiration board (JC 2026-10-19): linked, not copied; the pins are other people's work.
  const BOARD=`<a class="art-award art-board" href="https://www.pinterest.com/jc_griffith/etherea/" target="_blank" rel="noopener"><span><b>The Etherea board</b>Hundreds of pins: the dreamscapes the studio was designed from<i>See the board on Pinterest ↗</i></span></a>`;
  const AWARD=`<a class="art-award" href="https://web.archive.org/web/20230929030652/https://madein.peerspace.com/awards/los-angeles/production" target="_blank" rel="noopener"><img src="../../../assets/img/work/719/peerspace-open-door-2023.webp" width="285" height="400" alt="Peerspace Open Door Awards 2023 winner badge"><span><b>Open Door Awards 2023</b>No. 9 of the top 10 production spaces in Los Angeles<i>See the winners ↗</i></span></a>`;
  function renderArticle(s){
    const list=photos(s.id),paras=paragraphs(s),rest=list.slice(1);
    let h=`<h1>${esc(s.title)}</h1>`;
    if(list[0])h+=media(list[0],0,'art-lead',list.length);
    if(s.sum&&!s.detail.startsWith(s.sum))h+=`<p class="art-dek">${esc(s.sum)}</p>`;   // no dek when the story already opens with it
    h+=`<p>${esc(paras[0])}</p>`;
    if(s.board)h+=MOODBOARD;   // right after "I pinned hundreds of them"
    if(rest.length>1)h+=`<div class="art-carousel">${rest.map((p,k)=>media(p,k+1,'',list.length)).join('')}</div><p class="art-count">${rest.length} more · swipe</p>`;
    else if(rest.length===1)h+=media(rest[0],1,'art-wide',list.length);
    paras.slice(1).forEach(x=>{h+=`<p>${esc(x)}</p>`;});
    if(s.award)h+=AWARD;
    if(s.board)h+=BOARD;
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
  // The 719 Studios page (JC 2026-10-19) opens the shared tour at a chapter: ?tour=<chapter id>, or a 'tour:open' message.
  let isReady=false,pending=new URLSearchParams(location.search).get('tour');
  function openAt(id){const i=Math.max(0,stops.findIndex(s=>s.id===id));closeGallery(false);showStop(i);}
  addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='tour:open')return;if(isReady)openAt(e.data.chapter);else pending=e.data.chapter;});
  return {
    ready(){ home={position:camera.position.clone(),target:controls.target.clone(),fov:camera.fov};document.getElementById('start-tour').disabled=false;document.getElementById('overview').disabled=false;isReady=true;if(pending!=null){openAt(pending);pending=null;} },
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

// The case study's inspiration rows (JC 2026-10-22: "only pull ones you can verify"): pins from the Etherea board whose
// maker is named by Pinterest's own creator credit or by the source itself. [pin id, image, alt, maker, maker's page]
export const INSPO=[
  ['387591111696360805','35/b9/5a/35b95aa0eca3305c939b57377b755758.jpg','Pink arches and stairs with two white spheres','Charlotte Taylor','https://us.gestalten.com/blogs/journal/reverie-in-charlotte-taylor-serene-digital-worlds'],
  ['387591111692866683','67/2d/b2/672db23ee2005d9ac53910b405e5d864.jpg','Curtains framing a path to a tree','James Tralie','https://www.reddit.com/r/Art/comments/kw5g4o/stairway_to_relaxation_james_tralie_me_3d_2021/'],
  ['387591111691101016','17/58/ee/1758ee0c934910d91c24a290ce4b9857.jpg','Arches and a lounge in green light','Rafael Eifler','https://www.behance.net/rafaeleifler'],
  ['387591111691867326','16/9e/d1/169ed1c01d32eeb2d41c3fdd0137eeb3.jpg','A figure in front of a red sun','India Gorokhova','https://www.behance.net/indiagorokhova'],
  ['387591111691044527','b6/1a/2c/b61a2c42cdc8b8224363c6a9f6ad05bf.jpg','A red room with a white moon','Timur Mitin','https://www.behance.net/timurmitin'],
  ['387591111693548159','3f/0d/7f/3f0d7fb55e9ff67039d05fbcfcb14674.jpg','A pink tunnel of arches','Simon Kämpfer','https://holmandhimmel.com/products/simon-kaempfer-opportunities-2019'],
  ['387591111692380251','f0/d2/1f/f0d21fa9e58edbe14b437e30a2fe923f.jpg','Arches over a pool','Peter Tarka','https://twitter.com/PeterTarka/status/1423383395191730178'],
  ['387591111691057698','56/8a/ac/568aac707b4970815d53a5e60d6813ef.jpg','A round mirror in a dark plaster room','Liam Pitchford','https://www.behance.net/LiamPitchford'],
  ['387591111690480874','91/80/87/9180870e928a627f4e2992386019a67b.jpg','A pink tree on a pink island','mbsjq','https://www.behance.net/JonathanQuintin'],
  ['387591111690852445','70/a2/04/70a20454155d9819a525cdf130c8f2c2.jpg','A lounge under arched palm windows','Peter Tarka','https://www.behance.net/trk'],
  ['387591111690480857','f1/a8/60/f1a8607cf4ff6938f653d31ed9700320.jpg','Flowers hanging from a mossy ceiling','PicturesSG','https://www.flickr.com/photos/snapsg/'],
  ['387591111691460389','98/99/de/9899de3315a8698e8a0e7a108c7322be.jpg','A woman on a swing above the clouds','Vladimir Zotov','https://500px.com/VladimirZotov']];
