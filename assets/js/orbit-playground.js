/* ORBIT's playable concept: ordinary tasks first, optional hardware second. */
const ASSETS = new URL('../concepts/belt/renders/', import.meta.url).href;
const DEVICES = [
  {id:'lumen', name:'LUMEN', role:'Your visual layer', place:'On your face', image:'glasses-1-1_00-320.webp', source:'Original design'},
  {id:'cue', name:'CUE', role:'A subtle way to respond', place:'On your finger', source:'Proposed ring'},
  {id:'core', name:'CORE', role:'The computer behind it', place:'In your pocket', image:'computer-1-1_00-320.webp', source:'Original design'},
  {id:'dex', name:'DEX', role:'Precision, when it matters', place:'Ready in your bag', image:'remotes-1-1_00-320.webp', source:'Original design'},
  {id:'keyboard', name:'KEYBOARD', role:'Room for longer thoughts', place:'Ready in your bag', image:'keyboard-1-1_00-320.webp', source:'Original design'},
  {id:'ion', name:'ION', role:'Take a little more power', place:'Ready in your bag', image:'cells-1-1_00-320.webp', source:'Original design'},
  {id:'wisp', name:'WISP', role:'A different point of view', place:'Ready in your bag', image:'drone-1-1_00-320.webp', source:'Original design'},
  {id:'whisper', name:'WHISPER', role:'Keep the sound to yourself', place:'In your ears / case', image:'earbuds-1-1_00-320.webp', source:'Working name'},
];
const CARRIERS = {none:['Just the essentials','Pocket + everyday bag'],belt:['HALO Belt','Original carrier'],sling:['HALO Sling','Proposed carrier'],pack:['HALO Pack','Proposed carrier'],apparel:['HALO Apparel','Proposed carrier']};
const PRESETS = {essential:{carrier:'none',devices:['lumen','cue','core']},studio:{carrier:'none',devices:['lumen','cue','core','dex','keyboard']},travel:{carrier:'pack',devices:['lumen','cue','core','ion','whisper']}};
const SCENARIOS = [
  {id:'commute',name:'Quiet commute',desc:'A message. A small gesture. Back to the world.',needs:['lumen','cue','core']},
  {id:'create',name:'Create anywhere',desc:'Give a longer thought the space it needs.',needs:['lumen','core','dex','keyboard']},
  {id:'capture',name:'A new perspective',desc:'Put a camera in the scene, and yourself in the picture.',needs:['core','wisp']},
];
const STORE = 'jcg-orbit-kit-v1';
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = x => ({carrier:x.carrier, devices:[...x.devices]});
function valid(raw) {
  if (!raw || !Object.hasOwn(CARRIERS,raw.carrier) || !Array.isArray(raw.devices)) return null;
  return {carrier:raw.carrier,devices:DEVICES.filter(d=>raw.devices.includes(d.id)).map(d=>d.id)};
}
function decode(value) { const [carrier,...devices] = value.split('.'); return valid({carrier,devices}); }
function initialConfig() {
  try { const value = new URL(location.href).searchParams.get('kit'); if(value) { const v = decode(value); if(v) return v; } } catch {}
  try { const v = valid(JSON.parse(localStorage.getItem(STORE))); if(v) return v; } catch {}
  return clone(PRESETS.essential);
}
function wearDiagram(config) {
  const has=id=>config.devices.includes(id);
  const line=(x,y,name,side='left')=>`<g class="op-body-point"><circle cx="${x}" cy="${y}" r="4"/><path d="M${x} ${y}H${side==='left'?42:340}"/><text x="${side==='left'?42:340}" y="${y-10}" text-anchor="${side==='left'?'start':'end'}">${name}</text></g>`;
  const carrier = config.carrier;
  return `<svg class="op-body-svg" viewBox="0 0 380 460" role="img" aria-label="Schematic placement of your kit: glasses on face, ring on finger, CORE at pocket. Optional carrier positions are conceptual."><defs><linearGradient id="op-body-shade" x1="0" x2="1"><stop stop-color="#222b30"/><stop offset=".5" stop-color="#10191d"/><stop offset="1" stop-color="#283238"/></linearGradient></defs><g class="op-body-guides"><path d="M190 15V446M28 221H352"/><ellipse cx="190" cy="427" rx="115" ry="17"/><ellipse cx="190" cy="221" rx="115" ry="39"/></g><g class="op-body-shape"><path d="M168 83V108L131 123Q114 133 108 166L91 263L105 291L118 282L120 254L139 185L141 259L134 317L139 412L126 427Q142 433 159 423L171 327L189 273L207 327L220 423Q237 433 253 427L240 412L245 317L238 259L240 185L259 254L261 282L274 291L288 263L271 166Q265 133 248 123L211 108V83Z"/><path d="M166 49Q166 22 189 22Q214 22 214 49L211 79Q204 98 190 98Q174 96 168 79Z"/><path class="op-body-seam" d="M141 259Q189 272 238 259M139 185L145 140M240 185L234 140M171 327L181 263M207 327L197 263"/></g>${carrier==='belt'?'<path class="op-carrier-line" d="M139 235Q190 250 240 235M139 248Q190 263 240 248"/>':''}${carrier==='sling'?'<path class="op-carrier-line op-carrier-concept" d="M232 118L144 239M242 125L154 247"/>':''}${carrier==='pack'?'<path class="op-carrier-line op-carrier-concept" d="M155 118Q137 149 149 200M225 118Q243 149 231 200"/>':''}${carrier==='apparel'?'<path class="op-carrier-line op-carrier-concept" d="M151 164H174M209 164H232M142 237H165M215 237H238"/>':''}${has('lumen')?line(190,61,'LUMEN'):''}${has('cue')?line(108,274,'CUE'):''}${has('core')?line(carrier==='sling'?167:220,carrier==='sling'?199:265,'CORE','right'):''}${has('whisper')?line(211,74,'WHISPER','right'):''}${config.devices.some(d=>['dex','keyboard','ion','wisp'].includes(d))?line(234,carrier==='none'?343:230,carrier==='none'?'OPTIONAL TOOLS':'CARRY ZONE','right'):''}</svg>`;
}
export function initPlayground(host) {
  if (!host) return null;
  let config=initialConfig(), mode='commute', stage='inbox', text='', sent='', focusRow=0, focusCol=0, detail='';
  host.classList.add('op-playground');
  host.innerHTML=`<div class="op-heading"><div><p class="op-kicker">02 / A FUTURE YOU CAN TRY</p><h2>Make yourself<br>at home in tomorrow.</h2></div><p>Start with a small, everyday moment.<br>Then make the system your own.</p></div><div class="op-tabs" role="tablist" aria-label="ORBIT experiences"><button type="button" role="tab" id="op-tab-commute" aria-controls="op-commute" data-mode="commute">01 <span>Quiet commute</span><span aria-hidden="true">↗</span></button><button type="button" role="tab" id="op-tab-build" aria-controls="op-build" data-mode="build">02 <span>Build your ORBIT</span><span aria-hidden="true">↗</span></button></div><div id="op-commute" role="tabpanel" aria-labelledby="op-tab-commute"></div><div id="op-build" role="tabpanel" aria-labelledby="op-tab-build" hidden></div><p class="op-live" aria-live="polite" role="status"></p>`;
  const build=host.querySelector('#op-build'), commute=host.querySelector('#op-commute'), live=host.querySelector('.op-live');
  const announce = message => { live.textContent=message; };
  const kit = () => clone(config);
  const missing = scenario => scenario.needs.filter(id=>!config.devices.includes(id));
  function persist(message) {
    try { localStorage.setItem(STORE,JSON.stringify(config)); } catch {}
    host.dispatchEvent(new CustomEvent('orbit:kit',{bubbles:true,detail:kit()}));
    if (message) announce(message);
    renderBuild(); renderCommute();
  }
  function setMode(next,scroll=false) {
    mode=['build','builder','configure','configurator'].includes(next)?'build':'commute';
    build.hidden=mode!=='build'; commute.hidden=mode!=='commute';
    host.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===mode;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
    if (scroll) host.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  function renderBuild() {
    const matches=Object.entries(PRESETS).find(([,p])=>p.carrier===config.carrier&&p.devices.length===config.devices.length&&p.devices.every(id=>config.devices.includes(id)));
    build.innerHTML=`<div class="op-kit-top"><p class="op-kicker">YOUR ORBIT / <span>${String(config.devices.length).padStart(2,'0')} PIECES</span></p><div class="op-presets" aria-label="Kit presets">${Object.keys(PRESETS).map(p=>`<button type="button" data-preset="${p}" aria-pressed="${matches?.[0]===p}">${p[0].toUpperCase()+p.slice(1)}</button>`).join('')}</div></div><div class="op-builder-grid"><div class="op-kit-editor"><h3>Only what you need.<br>Everything you want.</h3><p class="op-muted">Three pieces make a quiet reply possible in this concept. Add tools for the moments that ask for more.</p><div class="op-device-grid">${DEVICES.map(d=>`<button type="button" class="op-device ${config.devices.includes(d.id)?'is-equipped':''}" data-device="${d.id}" aria-pressed="${config.devices.includes(d.id)}" aria-label="${config.devices.includes(d.id)?'Remove':'Add'} ${d.name}"><span class="op-device-state" aria-hidden="true">${config.devices.includes(d.id)?'✓':'+'}</span>${d.image?`<img src="${ASSETS+d.image}" alt="" loading="lazy" width="160" height="120">`:'<span class="op-cue-symbol" aria-hidden="true">↔<i>CLICK</i>↕</span>'}<span class="op-device-name">${d.name}</span><span class="op-device-role">${d.role}</span><small>${d.source}</small></button>`).join('')}</div><details class="op-carrier-details"${config.carrier!=='none'?' open':''}><summary>Choose how you carry it <span>${CARRIERS[config.carrier][0]} <b>+</b></span></summary><div class="op-carriers">${Object.entries(CARRIERS).map(([id,[name,note]])=>`<label><input type="radio" name="orbit-carrier" value="${id}" ${id===config.carrier?'checked':''}><span>${name}<small>${note}</small></span></label>`).join('')}</div><p class="op-fine">HALO is optional. Sling, Pack and Apparel are schematic explorations; their mounts and power systems are not yet engineered.</p></details></div><aside class="op-kit-body"><div class="op-body-top"><span class="op-kicker">PERSONAL SYSTEM</span><span class="op-kicker">01:01</span></div>${wearDiagram(config)}<div class="op-kit-summary"><h4>${config.devices.length===0?'A blank canvas.':matches?.[0]==='essential'?'A little goes a long way.':config.devices.length<=3?'A lighter kind of computing.':'Ready for a different kind of day.'}</h4><p>${config.carrier==='none'?'Face. Finger. Pocket. Your everyday clothes are a place to start.':CARRIERS[config.carrier][0]+'. A proposed way to keep your extra tools within reach.'}</p><span class="op-kicker">PLACEMENT SCHEMATIC · NOT A FIT SIMULATION</span></div></aside></div><div class="op-scenarios"><div class="op-scenario-heading"><p class="op-kicker">WHAT COULD YOU DO WITH IT?</p><span>Capabilities respond to your kit.</span></div>${SCENARIOS.map(s=>{const needs=missing(s);return `<div class="op-scenario"><span class="op-scenario-number">${String(SCENARIOS.indexOf(s)+1).padStart(2,'0')}</span><div><h4>${s.name}</h4><p>${s.desc}</p></div><span class="op-scenario-state">${needs.length?`Add ${needs.map(id=>DEVICES.find(d=>d.id===id).name).join(' + ')}`:s.id==='commute'?'Ready to try':'Concept setup ready'}</span><button type="button" class="op-button ${s.id==='commute'?'op-button-primary':''}" data-scenario="${s.id}">${needs.length?'Add & explore':s.id==='commute'?'Try this setup':'Explore setup'} <span aria-hidden="true">↗</span></button></div>`;}).join('')}</div>${detail?`<div class="op-scenario-detail"><button type="button" data-close-detail aria-label="Close scenario details">×</button><p class="op-kicker">${detail==='create'?'CREATE ANYWHERE':'A NEW PERSPECTIVE'} / CONCEPT STUDY</p><h4>${detail==='create'?'Same thought. More room.':'Be part of the moment.'}</h4><p>${detail==='create'?'LUMEN holds your workspace. CORE carries the computing. DEX adds precision, and the six-panel keyboard gives longer writing a physical home. This kit sketches the change of interface; the interactive workspace is a future study.':'WISP offers an independent camera perspective. A proposed stationary perch could bring you into a call or a group moment. Flight is optional and is not simulated here.'}</p></div>`:''}<div class="op-save-bar"><div><span class="op-kicker">THIS CONFIGURATION IS YOURS.</span><p>Saved on this browser. Take the idea with you.</p></div><div class="op-save-actions"><button type="button" class="op-button" data-reset-kit>Reset kit</button><button type="button" class="op-button" data-share>Share setup ↗</button><button type="button" class="op-button op-button-primary" data-save>Save kit card ↓</button></div></div><div class="op-share-link" hidden><label for="op-share-url">Your shareable configuration</label><input id="op-share-url" readonly><button type="button" data-close-share aria-label="Close share link">×</button></div>`;
  }
  function keyRows() {
    if(stage==='inbox')return [[{label:'Reply',value:'reply'},{label:'Not now',value:'dismiss'}]];
    if(stage!=='typing')return [];
    return [
      [{label:'On my way.',value:'phrase:On my way.'},{label:'See you soon.',value:'phrase:See you soon.'},{label:'Give me 10 min.',value:'phrase:Give me 10 min.'}],
      [...'QWERTYUIOP'].map(c=>({label:c,value:c})), [...'ASDFGHJKL'].map(c=>({label:c,value:c})),[...'ZXCVBNM'].map(c=>({label:c,value:c})),
      [{label:'Space',value:'space'},{label:'.',value:'.'},{label:'⌫',value:'delete'},{label:'Send ↗',value:'send'}],
    ];
  }
  function panelMarkup() {
    if(stage==='sent')return `<div class="op-message-done"><span class="op-done-mark">✓</span><p class="op-kicker">REPLY SENT IN THIS DEMO</p><h4>Back to being here.</h4><p class="op-sent-text">“${esc(sent)}”</p><button type="button" class="op-button" data-replay>Try another reply ↗</button></div>`;
    if(stage==='dismissed')return `<div class="op-message-done"><p class="op-kicker">MESSAGE DISMISSED</p><h4>It can wait.</h4><p>The world still has your attention.</p><button type="button" class="op-button" data-replay>Bring message back ↗</button></div>`;
    const rows=keyRows();
    return `<div class="op-message-head"><span class="op-avatar" aria-hidden="true">J</span><div><b>Jamie</b><span>Message · just now</span></div><span class="op-message-indicator" aria-hidden="true"></span></div><p class="op-message-copy">Coffee at our usual place?<br>I'm about 10 minutes away.</p>${stage==='typing'?`<label class="op-reply-label" for="op-reply">YOUR REPLY</label><textarea id="op-reply" rows="2" maxlength="240" placeholder="Compose a quiet reply…" aria-describedby="op-input-note">${esc(text)}</textarea><div class="op-keyboard" aria-label="Virtual keyboard prototype">`: '<div class="op-inbox-actions">'}${rows.map((row,r)=>`<div class="op-key-row ${r===0&&stage==='typing'?'op-predictions':''}">${row.map((key,c)=>`<button type="button" data-key="${esc(key.value)}" data-r="${r}" data-c="${c}" class="op-key ${r===focusRow&&c===focusCol?'is-selected':''}"${key.value==='send'&&!text.trim()?' disabled':''} aria-label="${key.value==='delete'?'Delete last character':esc(key.label)}">${key.label}</button>`).join('')}</div>`).join('')}</div>${stage==='typing'?'<p class="op-input-note" id="op-input-note">Use CUE, tap a key, or type your own reply above.</p>':''}`;
  }
  function renderCommute() {
    const needs=missing(SCENARIOS[0]);
    commute.innerHTML=`<div class="op-commute-shell"><div class="op-commute-stage"><div class="op-commute-top"><span class="op-kicker"><i></i> THROUGH LUMEN</span><span class="op-kicker">08:42 / ON YOUR WAY</span></div><div class="op-world-lines" aria-hidden="true"></div><div class="op-pov-caption"><span class="op-kicker">QUIET COMMUTE</span><h3>The world stays.<br>The interface adapts.</h3></div><div class="op-message ${stage==='sent'||stage==='dismissed'?'is-done':''}">${needs.length?`<div class="op-message-done"><p class="op-kicker">YOUR KIT, YOUR POSSIBILITIES</p><h4>A small addition.</h4><p>This concept uses LUMEN, CUE and CORE for a quiet reply. Your kit is missing ${needs.map(id=>DEVICES.find(d=>d.id===id).name).join(', ')}.</p><button type="button" class="op-button op-button-primary" data-add-commute>Add ${needs.length===1?DEVICES.find(d=>d.id===needs[0]).name:'missing pieces'} & try ↗</button></div>`:panelMarkup()}</div><div class="op-commute-bottom"><span class="op-kicker">ILLUSTRATIVE ENVIRONMENT / CONCEPT INTERFACE</span><span class="op-kicker">LUMEN + CUE + CORE</span></div></div><div class="op-commute-controls"><div class="op-control-story"><p class="op-kicker">${stage==='sent'?'SILENT WHEN YOU NEED IT.':'A SMALL GESTURE. A REAL RESPONSE.'}</p><h4>${stage==='sent'?'A reply without leaving the moment.':'Your thumb does the talking.'}</h4><p>${stage==='sent'?'You just used the proposed minimum kit. No extra tools required.':'Move with the arrows. Click to choose. Try a suggestion, or compose something of your own.'}</p><span class="op-prototype-note">CUE + virtual text entry are interaction prototypes. Directional typing is a design question, not a proven speed claim. Messages stay in this page.</span></div><div class="op-cue-controller" tabindex="0" role="group" aria-label="CUE gesture controller. Arrow keys move selection; Enter chooses." aria-describedby="op-pad-help"><span class="op-kicker">CUE / THUMB INPUT</span><div class="op-dpad"><button type="button" class="op-pad-up" data-move="up" aria-label="Move selection up">↑</button><button type="button" class="op-pad-left" data-move="left" aria-label="Move selection left">←</button><button type="button" class="op-pad-click" data-select aria-label="Click selected option">CLICK</button><button type="button" class="op-pad-right" data-move="right" aria-label="Move selection right">→</button><button type="button" class="op-pad-down" data-move="down" aria-label="Move selection down">↓</button></div><span id="op-pad-help" class="op-fine">Arrow keys + enter also work here.</span></div><div class="op-commute-actions"><button type="button" class="op-button" data-back-demo>← ${stage==='typing'?'Back to message':'Build your kit'}</button><button type="button" class="op-text-button" data-replay>Reset scene ↺</button></div></div></div>`;
  }
  function refreshMessage() {
    const box=commute.querySelector('.op-message'); if(!box)return;
    box.innerHTML=panelMarkup(); box.classList.toggle('is-done',stage==='sent'||stage==='dismissed');
  }
  function move(direction) {
    if(missing(SCENARIOS[0]).length)return;
    const rows=keyRows();if(!rows.length)return;
    if(direction==='up'||direction==='down') {focusRow=(focusRow+(direction==='up'?-1:1)+rows.length)%rows.length;focusCol=Math.min(focusCol,rows[focusRow].length-1);}
    else focusCol=(focusCol+(direction==='left'?-1:1)+rows[focusRow].length)%rows[focusRow].length;
    commute.querySelectorAll('[data-key]').forEach(b=>b.classList.toggle('is-selected',+b.dataset.r===focusRow&&+b.dataset.c===focusCol));
    announce('Selected '+rows[focusRow][focusCol].label);
  }
  function activate(value) {
    if(missing(SCENARIOS[0]).length)return;
    if(value==='reply'){stage='typing';focusRow=1;focusCol=0;refreshMessage();announce('Reply keyboard open. Choose a suggestion or compose your message.');return;}
    if(value==='dismiss'){stage='dismissed';renderCommute();announce('Message dismissed.');return;}
    if(value==='send') {if(!text.trim()){announce('Write a reply before sending.');return;}sent=text.trim();stage='sent';renderCommute();announce('Reply sent locally: '+sent);return;}
    if(stage!=='typing')return;
    if(value.startsWith('phrase:'))text=value.slice(7);
    else if(value==='delete')text=text.slice(0,-1);
    else text=(text+(value==='space'?' ':value.toLowerCase())).slice(0,240);
    refreshMessage(); announce(text||'Reply cleared.');
  }
  function share() {
    const url=new URL(location.href);url.searchParams.set('kit',[config.carrier,...config.devices].join('.'));url.hash='playground';
    const wrap=build.querySelector('.op-share-link'), input=wrap.querySelector('input');wrap.hidden=false;input.value=url.href;input.focus();input.select();
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(url.href).then(()=>announce('Your setup link is copied.')).catch(()=>announce('Your setup link is ready to copy.'));
    else announce('Your setup link is ready to copy.');
  }
  function saveCard() {
    const names=config.devices.map(id=>DEVICES.find(d=>d.id===id));
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#0d1114"/><circle cx="1020" cy="170" r="250" fill="none" stroke="#253239"/><circle cx="1020" cy="170" r="190" fill="none" stroke="#253239"/><g font-family="Arial,sans-serif" fill="#eeeee9"><text x="72" y="80" font-size="15" letter-spacing="4">JCG STUDIO / A VISION FOR 2035</text><text x="65" y="210" font-size="130" font-weight="700" letter-spacing="-7">MY ORBIT.</text><text x="72" y="262" font-size="24" fill="#aab6b8">The next era of personal computing. Made personal.</text><path d="M72 305H1128" stroke="#415058"/><text x="72" y="358" font-size="17" fill="#ff663d">${esc(CARRIERS[config.carrier][0].toUpperCase())} / ${names.length} PIECES</text>${names.map((d,i)=>`<text x="${72+(i%2)*548}" y="${420+Math.floor(i/2)*84}" font-size="27" font-weight="700">${d.name}</text><text x="${72+(i%2)*548}" y="${447+Math.floor(i/2)*84}" font-size="16" fill="#aab6b8">${esc(d.role)} · ${esc(d.source)}</text>`).join('')}<path d="M72 790H1128" stroke="#415058"/><text x="72" y="831" font-size="17">Use only what you need. Add what you want.</text><text x="72" y="863" font-size="13" fill="#aab6b8">A speculative design concept. Placement and independent operation are proposed.</text></g></svg>`;
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download='my-orbit-kit.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Your ORBIT kit card is saved as an SVG.');
  }
  host.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||!host.contains(b))return;
    const focusToken=b.dataset.device?'[data-device="'+b.dataset.device+'"]':b.dataset.preset?'[data-preset="'+b.dataset.preset+'"]':null;
    if(b.dataset.mode)setMode(b.dataset.mode);
    else if(b.dataset.preset){config=clone(PRESETS[b.dataset.preset]);persist(b.textContent+' kit selected.');}
    else if(b.dataset.device){const id=b.dataset.device;config.devices=config.devices.includes(id)?config.devices.filter(d=>d!==id):[...config.devices,id];persist(DEVICES.find(d=>d.id===id).name+(config.devices.includes(id)?' added to':' removed from')+' your kit.');}
    else if(b.dataset.scenario){const s=SCENARIOS.find(s=>s.id===b.dataset.scenario);config.devices=[...new Set([...config.devices,...s.needs])];detail=s.id==='commute'?'':s.id;persist();if(s.id==='commute'){stage='inbox';text='';renderCommute();setMode('commute');}else build.querySelector('.op-scenario-detail')?.scrollIntoView({behavior:'smooth',block:'nearest'});}
    else if(b.hasAttribute('data-add-commute')){config.devices=[...new Set([...config.devices,...SCENARIOS[0].needs])];persist('Your quiet commute kit is ready.');}
    else if(b.hasAttribute('data-reset-kit')){config=clone(PRESETS.essential);detail='';persist('Essential kit restored.');}
    else if(b.hasAttribute('data-share'))share();
    else if(b.hasAttribute('data-save'))saveCard();
    else if(b.hasAttribute('data-close-share'))build.querySelector('.op-share-link').hidden=true;
    else if(b.hasAttribute('data-close-detail')){detail='';renderBuild();}
    else if(b.dataset.move)move(b.dataset.move);
    else if(b.hasAttribute('data-select')){const k=keyRows()[focusRow]?.[focusCol];if(k)activate(k.value);}
    else if(b.dataset.key){focusRow=+b.dataset.r;focusCol=+b.dataset.c;activate(b.dataset.key);}
    else if(b.hasAttribute('data-replay')){stage='inbox';text='';sent='';focusRow=0;focusCol=0;renderCommute();announce('Scene reset. A message from Jamie has arrived.');}
    else if(b.hasAttribute('data-back-demo')){if(stage==='typing'){stage='inbox';focusRow=0;focusCol=0;renderCommute();}else setMode('build');}
    if(focusToken)build.querySelector(focusToken)?.focus({preventScroll:true});
  });
  host.addEventListener('change',e=>{if(e.target.name==='orbit-carrier'){config.carrier=e.target.value;persist(CARRIERS[config.carrier][0]+' selected.');build.querySelector(`input[value="${config.carrier}"]`)?.focus({preventScroll:true});}});
  host.addEventListener('input',e=>{if(e.target.id==='op-reply'){text=e.target.value;const send=commute.querySelector('[data-key="send"]');if(send)send.disabled=!text.trim();}});
  host.addEventListener('keydown',e=>{
    const tab=e.target.closest('[data-mode]');
    if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setMode(e.key==='Home'?'commute':e.key==='End'?'build':mode==='build'?'commute':'build');host.querySelector(`[data-mode="${mode}"]`).focus();return;}
    const controller=e.target.closest('.op-cue-controller');if(!controller)return;
    const directions={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
    if(directions[e.key]){e.preventDefault();move(directions[e.key]);}
    else if(e.key==='Enter'&&(e.target===controller||e.target.hasAttribute('data-select'))){e.preventDefault();const k=keyRows()[focusRow]?.[focusCol];if(k)activate(k.value);}
    else if(e.key==='Escape'){e.preventDefault();stage='inbox';focusRow=0;focusCol=0;renderCommute();commute.querySelector('.op-cue-controller')?.focus();}
  });
  renderBuild();renderCommute();setMode(mode);
  return {open(next='commute'){setMode(next,true);},getConfig:kit};
}
