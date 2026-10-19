// ORBIT — human-first exhibit. DOM experience stays independent of WebGL.
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const live = (text) => { $('#orbit-live').textContent = text; };
let reply = 'See you in ten.';
$$('[data-reply]').forEach(button => button.addEventListener('click', () => {
  reply = button.dataset.reply;
  $$('[data-reply]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));
$('.reply-options').addEventListener('keydown', event => {
  const buttons=$$('[data-reply]'), current=buttons.indexOf(document.activeElement);
  if(current<0)return;
  const delta=['ArrowRight','ArrowDown'].includes(event.key)?1:['ArrowLeft','ArrowUp'].includes(event.key)?-1:0;
  if(delta){event.preventDefault();const next=buttons[(current+delta+buttons.length)%buttons.length];next.click();next.focus();}
});
$('#hero-send').addEventListener('click', () => {
  $('#hero-message').hidden = true; $('#hero-success').hidden = false;
  $('#hero-sent-copy').textContent = `“${reply}”`;
  $('#hero-replay').focus({preventScroll:true});
  live(`Demo reply: ${reply} No real message was sent.`);
});
$('#hero-replay').addEventListener('click', () => {
  $('#hero-success').hidden = true; $('#hero-message').hidden = false;
  $('[data-reply][aria-pressed="true"]').focus({preventScroll:true});
});
let playground;
const mountPlayground = () => import('./orbit-playground.js?v=1').then(({initPlayground}) => playground ||= initPlayground($('#playground')));
mountPlayground().catch(error => {
  console.warn('ORBIT playground unavailable', error);
  $('#playground').innerHTML = '<div class="no-script"><h2>Your system. Your way.</h2><p>LUMEN + CUE + CORE form the proposed essential setup. DEX adds precision, the keyboard supports long writing, and ION adds power. HALO is optional.</p><p>The interactive builder could not load. Refresh to try again; the hardware and source notes remain available.</p></div>';
});
$$('[data-open]').forEach(link => link.addEventListener('click', async () => {
  $$('dialog[open]').forEach(dialog => dialog.close());
  try { (await mountPlayground()).open(link.dataset.open); } catch { /* Visible fallback above. */ }
}));
const sourceDialog = $('#source-dialog');
$('#source-notes-open').addEventListener('click', () => sourceDialog.showModal());
$$('.orb-dialog').forEach(dialog => {
  dialog.querySelectorAll('.dialog-close,.dialog-close-button').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => { if(event.target === dialog) { const r=dialog.getBoundingClientRect(); if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close(); } });
});
const stories = {
  lumen: {kicker:'P—04 / ORIGINAL GLASSES · PROPOSED SPATIAL UI',title:'Look into your world.',image:'glasses-1-1_00-640.webp',copy:'LUMEN pairs folding glasses with open-ear audio, microphones, cameras, and a carrier holster. ORBIT imagines a visual layer that adapts to your task: a small reply on a train, a larger workspace when you sit down. The display technology is unspecified; the spatial interface is a design proposal.'},
  core: {kicker:'P—03 / ORIGINAL COMPUTE MODULE',title:'Your system, connected.',image:'computer-1-1_00-640.webp',copy:'CORE is the original compute module, with an exposed heat spreader and vent details. ORBIT proposes that it coordinate identity, connectivity, and computing across the devices you choose. Independent operation and pocket or clip-on carry remain new design directions, not validated features.'}
};
$$('[data-device-story]').forEach(button => button.addEventListener('click', () => {
  const story = stories[button.dataset.deviceStory];
  $('#story-kicker').textContent=story.kicker; $('#story-title').textContent=story.title;
  $('#story-image').src=`../../assets/concepts/belt/renders/${story.image}`;
  $('#story-image').alt=`Original ${button.dataset.deviceStory.toUpperCase()} source render`;
  $('#story-copy').textContent=story.copy; $('#device-dialog').showModal();
}));
const products = [
  {id:'halo',name:'HALO',number:'P—00 / CARRIER',roots:[],image:'belt',description:'The band stays with you. The outer carousel moves your tools into reach. Drag to feel the system.',details:['Original Belt concept','Independent outer carousel']},
  {id:'lumen',name:'LUMEN',number:'P—04 / VISUAL INTERFACE',roots:['Holster'],image:'glasses',description:'Folding glasses, open-ear audio, and a dedicated holster. A proposed spatial interface for the moment you’re in.',details:['Folding glasses + holster','Display technology unspecified']},
  {id:'core',name:'CORE',number:'P—03 / COMPUTE',roots:['Core'],image:'computer',description:'Computing and connectivity in a dedicated module. The proposed coordinating layer of your personal system.',details:['Vented compute enclosure','Pocket / clip carry proposed']},
  {id:'dex',name:'DEX',number:'P—02 / PRECISION',roots:['Grip L (mouse)','Grip R (mouse)'],image:'remotes',description:'Two hand-held controllers for precise pointing, play, and desk work. Add control when the task asks for more.',details:['Paired physical controllers','Individual or combined input concept']},
  {id:'keyboard',name:'KEYBOARD',number:'P—06 / LONG-FORM INPUT',roots:['Keys'],image:'keyboard',description:'A six-panel folding keyboard for the words worth sitting down to write. Physical keys still have a place in the future.',details:['Six-panel ortholinear design','Product name to be decided']},
  {id:'wisp',name:'WISP',number:'P—01 / OPTIONAL CAMERA',roots:['Wisp flight'],image:'drone',description:'A camera with a viewpoint independent of yours. Optional capture for shared moments, calls, and hands-busy work.',details:['Original enclosed-rotor design','Perch / Fly modes are extensions']},
  {id:'whisper',name:'WHISPER',number:'P—05 / PRIVATE AUDIO',roots:['Pods'],image:'earbuds',description:'Stemless earbuds and their charging case. A private listening option alongside LUMEN’s open-ear audio.',details:['Earbuds + charging case','WHISPER is a working name']},
  {id:'ion',name:'ION',number:'P—07 / POWER',roots:['Cell A','Cell B'],image:'cells',description:'Modular power cells for the longer day. Extend your kit without making every device permanently larger.',details:['Removable power modules','Uninterrupted swap needs a buffer']}
];
let explorer=null, selected='halo', engineState='idle', pendingSelection=null;
const stage=$('#lab-stage'), lab=$('#hardware-lab'), status=$('#stage-status');
function renderSelection(state,id){
  engineState=state; selected=id || 'halo'; lab.dataset.state=state;
  const product=products.find(item=>item.id===selected) || products[0];
  $('#device-number').textContent=product.number; $('#device-name').textContent=product.name; $('#device-description').textContent=product.description;
  $('#device-details').replaceChildren(...product.details.map((text,index)=>{const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=index?'Concept note':'Design';dd.textContent=text;row.append(dt,dd);return row;}));
  $$('[data-product]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.product===selected)));
  $('#undock').disabled=selected==='halo'||state==='inspecting'; $('#back-system').hidden=selected==='halo';
  $('#back-system').textContent=state==='inspecting'?'← Return to dock':'← Back to system';
  $('#mechanism-note').textContent=state==='inspecting'?'DRAG TO TURN THE SELECTED SOURCE MODEL':selected==='halo'?'Select a module below to bring it forward.':'SOURCE MODEL · ORANGE MARKS THE RELEASE';
  $('#lab-help').textContent=state==='inspecting'?'DRAG TO INSPECT YOUR MODULE':'DRAG TO ROTATE THE CAROUSEL';
  if(!explorer?.ready){$('#stage-fallback').src=`../../assets/concepts/belt/renders/${product.image}-1-1_00-800.webp`;$('#stage-fallback').alt=`Source render of ${product.name}`;}
}
function selectProduct(id){if(explorer?.ready){id==='halo'?explorer.reset():explorer.select(id);}else{pendingSelection=id;renderSelection(id==='halo'?'idle':'selected',id);}}
$$('[data-product]').forEach(button=>button.addEventListener('click',()=>selectProduct(button.dataset.product)));
$('#undock').addEventListener('click',()=>{if(explorer?.ready)explorer.inspect();else{renderSelection('inspecting',selected);status.textContent='SOURCE STILL · 3D UNAVAILABLE';live('Showing the source product render. 3D inspection is unavailable.');}});
$('#back-system').addEventListener('click',()=>{if(explorer?.ready)explorer.back();else renderSelection(engineState==='inspecting'?'selected':'idle',engineState==='inspecting'?selected:'halo');});
$('#reset-view').addEventListener('click',()=>{explorer?.reset();pendingSelection=null;renderSelection('idle','halo');});
$('#rotate-left').addEventListener('click',()=>explorer?.rotate(-1)); $('#rotate-right').addEventListener('click',()=>explorer?.rotate(1));
$('#zoom-in').addEventListener('click',()=>explorer?.zoom(1)); $('#zoom-out').addEventListener('click',()=>explorer?.zoom(-1));
$$('[data-drag]').forEach(button=>button.addEventListener('click',()=>{explorer?.setDragMode(button.dataset.drag);$$('[data-drag]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));$('#lab-help').textContent=button.dataset.drag==='camera'?'DRAG TO ORBIT THE CAMERA':'DRAG TO ROTATE THE CAROUSEL';}));
$('#lab-toggle').addEventListener('click',()=>{const on=$('#lab-toggle').getAttribute('aria-pressed')!=='true';$('#lab-toggle').setAttribute('aria-pressed',String(on));explorer?.setLab(on);});
stage.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Escape','+','-'].includes(event.key)){event.preventDefault();if(event.key==='Escape')explorer?.back();else if(event.key==='+'||event.key==='-')explorer?.zoom(event.key==='+'?1:-1);else explorer?.rotate(event.key==='ArrowLeft'?-1:1);}});
let loading=false;
async function startLab(){
  if(loading)return; loading=true; status.textContent='LOADING ORIGINAL HARDWARE…';
  try{
    const {createExplorer}=await import('./orbit-stage.js?v=1');
    explorer=createExplorer(stage,{model:'../../assets/orbit/halo-source.glb',loopUrl:'../../assets/orbit/halo-source-loop.json',products,frameWidth:.88,on:{
      state:renderSelection,
      progress:value=>{status.textContent=`LOADING SOURCE MODEL · ${Math.round(value*100)}%`;},
      ready:()=>{status.textContent='SOURCE GEOMETRY / DRAG TO EXPLORE';if(pendingSelection)selectProduct(pendingSelection);},
      error:()=>{status.textContent='SOURCE STILL / 3D UNAVAILABLE';live('3D unavailable. Product details and source renders are available.');}
    }});
    if(!explorer)status.textContent='SOURCE STILL / WEBGL UNAVAILABLE';
  }catch(error){console.warn('ORBIT 3D fallback',error);status.textContent='SOURCE STILL / 3D UNAVAILABLE';}
}
new IntersectionObserver((entries,observer)=>{if(entries.some(entry=>entry.isIntersecting)){startLab();observer.disconnect();}},{rootMargin:'300px'}).observe(lab);
