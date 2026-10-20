// Forms and controls (assets/css/controls.css): the behaviour that needs script. Every control works as plain HTML;
// this adds what HTML can't do alone:
//   - character counters (.field-meta[data-counter] next to an input or textarea with maxlength), padded so they never jitter
//   - slider readouts and fill (.range: the <output> in its field, --f for the fill, --n for the dots)
//   - the stepper's buttons (.stepper: tap to step, hold to repeat, ends disabled at min and max)
//   - the upload list (.dropzone[data-dropzone]: drop or choose, remove, one scan when files land)
//   - password reveal ([data-show-password] in a control)
//   - validation for form[data-validate]: nothing is wrong until you leave a field that has something in it, or send.
//     Then each field says what to do, an error summary at the top lists them, and fixing a field clears it at once.
//   - form[data-confirm="QUEUED"]: a valid send blinks the button's lamp and raises the chip (Signal Confirm), then
//     fires "controls:sent" (detail.data is the FormData) for the page to act on.
// initControls(root) wires everything under root (a document or a shadow root), once per element.
import { reduced } from './reduce-motion.js';
import { scan } from './scanline.js';
import { markD, FINAL_D, MARK_END, FPS } from './jcg-bud.js';
import { fuse } from './press.js';

const fieldOf = (el) => el.closest('.field');
const valueOf = (el) => (el.type === 'radio' || el.type === 'checkbox' ? el.checked : el.type === 'file' ? el.files.length > 0 : el.value !== '');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let uid = 0;
const ensureId = (el) => el.id || (el.id = `ctl-${++uid}`);

// ── Counter ───────────────────────────────────────────────────────────
function initCounter(meta) {
  const el = fieldOf(meta)?.querySelector('input[maxlength], textarea[maxlength]');
  if (!el) return;
  const max = el.maxLength, width = String(max).length;
  const update = () => {
    const n = el.value.length;
    meta.textContent = `${String(n).padStart(width, '0')} / ${max}`;
    meta.classList.toggle('is-near', n >= max * 0.9);
  };
  el.addEventListener('input', update);
  el.form?.addEventListener('reset', () => requestAnimationFrame(update));
  update();
}

// ── Range ─────────────────────────────────────────────────────────────
function initRange(input) {
  const out = fieldOf(input)?.querySelector('output');
  const min = input.min === '' ? 0 : +input.min, max = input.max === '' ? 100 : +input.max;
  const step = input.step === 'any' ? 0 : +input.step || 1;
  const steps = step ? Math.round((max - min) / step) : 0;
  if (steps) input.style.setProperty('--n', steps);
  const unit = input.dataset.unit || '';
  const field = fieldOf(input);
  const update = () => {
    const f = ((+input.value - min) / (max - min || 1)).toFixed(4);
    input.style.setProperty('--f', f);
    field?.style.setProperty('--f', f);                                // for the handle's bracket, a sibling of the input
    if (out) out.textContent = `${input.value}${unit}`;
  };
  input.addEventListener('input', update);
  input.form?.addEventListener('reset', () => requestAnimationFrame(update));
  update();
  // The handle's bracket (play layer): corner brackets round the needle that follow it from step to step on the HUD
  // overshoot (controls.css .range-thumb; left comes from --f, so the transition does the snapping).
  const bracket = document.createElement('span');
  bracket.className = 'range-thumb ticks';
  bracket.setAttribute('aria-hidden', 'true');
  input.after(bracket);
  const sit = () => { bracket.style.top = `${input.offsetTop + input.offsetHeight / 2}px`; };
  sit();
  new ResizeObserver(() => { sit(); if (steps) input.classList.toggle('range--dense', (input.clientWidth - 10) / steps < 6); }).observe(input);
}

// ── Stepper ───────────────────────────────────────────────────────────
function initStepper(box) {
  const input = box.querySelector('input');
  if (!input) return;
  const bound = (k, fallback) => (input[k] === '' ? fallback : +input[k]);
  const sync = () => {
    const v = +input.value;
    box.querySelector('[data-step="-1"]')?.setAttribute('aria-disabled', String(v <= bound('min', -Infinity)));
    box.querySelector('[data-step="1"]')?.setAttribute('aria-disabled', String(v >= bound('max', Infinity)));
  };
  const bump = (d) => {
    if (d < 0) input.stepDown(); else input.stepUp();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    sync();
  };
  box.querySelectorAll('[data-step]').forEach((btn) => {
    const d = +btn.dataset.step, off = () => btn.getAttribute('aria-disabled') === 'true';
    let wait = 0, repeat = 0, pressed = false;
    const stop = () => { clearTimeout(wait); clearInterval(repeat); };
    // Pointer: step on press, hold to repeat (after 400 ms, every 80 ms). Keyboard: Enter and Space step once.
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || off()) return;
      pressed = true;
      bump(d);
      wait = setTimeout(() => { repeat = setInterval(() => (off() ? stop() : bump(d)), 80); }, 400);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => btn.addEventListener(t, stop));
    btn.addEventListener('click', () => {
      if (pressed) { pressed = false; return; }
      if (!off()) bump(d);
    });
  });
  input.addEventListener('input', sync);
  input.form?.addEventListener('reset', () => requestAnimationFrame(sync));
  sync();
}

// ── Upload ────────────────────────────────────────────────────────────
const size = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
function initDropzone(zone) {
  const input = zone.querySelector('input[type="file"]');
  const field = fieldOf(zone);
  if (!input || !field) return;
  let list = field.querySelector('.file-list');
  if (!list) { list = document.createElement('ul'); list.className = 'file-list'; list.hidden = true; zone.after(list); }
  const host = zone.querySelector('.dropzone-scan');
  const held = new DataTransfer();                     // the files the field holds; the input mirrors it
  const render = () => {
    input.files = held.files;
    list.innerHTML = [...held.files].map((f, i) =>
      `<li class="file-row"><span class="file-name">${esc(f.name)}</span><span class="file-size">${size(f.size)}</span>` +
      `<button class="file-remove" type="button" data-i="${i}" aria-label="Remove ${esc(f.name)}"></button></li>`).join('');
    list.hidden = held.files.length === 0;
  };
  const add = (files) => {
    let added = 0;
    for (const f of files) {
      if ([...held.files].some((g) => g.name === f.name && g.size === f.size)) continue;
      held.items.add(f); added++;
    }
    render();
    if (added && host) scan(host);                    // one sweep: the files landed
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  input.addEventListener('change', () => add([...input.files]));
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.file-remove');
    if (!btn) return;
    held.items.remove(+btn.dataset.i);
    render();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    (list.querySelector('.file-remove') || input).focus();
  });
  ['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.add('is-over'); }));
  zone.addEventListener('dragleave', (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('is-over'); });
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('is-over'); add([...e.dataTransfer.files]); });
  input.form?.addEventListener('reset', () => { held.items.clear(); requestAnimationFrame(render); });
}

// ── Password ──────────────────────────────────────────────────────────
function initShowPassword(btn) {
  const input = btn.closest('.control')?.querySelector('input');
  if (!input) return;
  btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    btn.textContent = show ? 'Hide' : 'Show';
  });
}

// ── Validation ────────────────────────────────────────────────────────
// Messages say what to do. A field can override any of them: data-msg-required, data-msg-type, data-msg-pattern.
const MSG = {
  valueMissing: (el) => el.dataset.msgRequired || (el.type === 'radio' ? 'Choose one.' : el.type === 'file' ? 'Add a file.' : el.type === 'checkbox' ? 'Tick this to go on.' : 'This one is needed.'),
  typeMismatch: (el) => el.dataset.msgType || (el.type === 'email' ? 'Enter an email like name@company.com.' : el.type === 'url' ? 'Enter a full link, starting https://' : 'Check the format.'),
  patternMismatch: (el) => el.dataset.msgPattern || 'Check the format.',
  tooLong: (el) => `Keep it to ${el.maxLength} characters.`,
  tooShort: (el) => `Use at least ${el.minLength} characters.`,
  rangeUnderflow: (el) => `Use ${el.min} or more.`,
  rangeOverflow: (el) => `Use ${el.max} or less.`,
  stepMismatch: () => 'Use one of the steps.',
  badInput: () => 'Enter a number.',
};
const controlsOf = (field) => [...field.querySelectorAll('input, select, textarea')].filter((el) => el.willValidate);
function problem(field) {
  for (const el of controlsOf(field)) {
    if (el.validity.valid) continue;
    const key = Object.keys(MSG).find((k) => el.validity[k]);
    return { el, msg: key ? MSG[key](el) : el.validationMessage };
  }
  return null;
}
const labelOf = (field) => (field.querySelector('.field-label')?.textContent || 'Field').trim();
function describe(el, id, on) {
  const ids = new Set((el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  if (on) ids.add(id); else ids.delete(id);
  if (ids.size) el.setAttribute('aria-describedby', [...ids].join(' ')); else el.removeAttribute('aria-describedby');
}
function mark(field, found) {
  const group = field.querySelector('[role="radiogroup"]');
  const targets = group ? [group] : controlsOf(field);
  if (!targets.length) return;
  let err = field.querySelector('.field-error');
  if (!found && !err) return;
  if (!err) {
    err = document.createElement('p');
    err.className = 'field-error';
    err.innerHTML = '<span class="err-tag">Error</span><span data-msg></span>';
    field.append(err);
  }
  if (!err.id) err.id = `${ensureId(targets[0])}-error`;
  if (found) err.querySelector('[data-msg]').textContent = found.msg;
  err.hidden = !found;
  field.classList.toggle('is-invalid', !!found);
  for (const t of targets) {
    if (found) t.setAttribute('aria-invalid', 'true'); else t.removeAttribute('aria-invalid');
    describe(t, err.id, !!found);
  }
}
function summarise(form, bad) {
  let box = form.querySelector(':scope > .form-summary');
  if (!bad.length) { if (box) box.hidden = true; return; }
  if (!box) {
    box = document.createElement('div');
    box.className = 'form-summary ticks snap';
    box.tabIndex = -1;
    box.setAttribute('aria-labelledby', `${ensureId(form)}-summary`);
    form.prepend(box);
  }
  const n = bad.length;
  box.innerHTML = `<p class="form-summary-title" id="${form.id}-summary"><span class="err-tag">Error</span><span>${n} ${n === 1 ? 'thing' : 'things'} to fix</span></p>` +
    `<ul>${bad.map(([f, p], i) => `<li><button type="button" data-i="${i}">${esc(labelOf(f))}: ${esc(p.msg)}</button></li>`).join('')}</ul>`;
  box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    const [f, p] = bad[+b.dataset.i];
    (p.el.type === 'radio' ? f.querySelector('input:checked') || p.el : p.el).focus();
  }));
  box.hidden = false;
  box.classList.remove('is-snapped');
  void box.offsetWidth;
  box.classList.add('is-snapped');
  box.focus();
}
function signal(form) {
  const btn = form.querySelector('[type="submit"]');
  if (!btn) return;
  let chip = btn.querySelector('.confirm-chip');
  if (!chip) {
    chip = document.createElement('span');
    chip.className = 'chip chip--signal confirm-chip';
    chip.setAttribute('aria-hidden', 'true');
    btn.append(chip);
  }
  chip.textContent = form.dataset.confirm || 'Sent';
  btn.classList.remove('is-confirming'); chip.classList.remove('is-on');
  void btn.offsetWidth;
  btn.classList.add('is-confirming');
  setTimeout(() => chip.classList.add('is-on'), reduced() ? 0 : 300);
  let live = form.querySelector('[data-live]');
  if (!live) { live = document.createElement('p'); live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); live.dataset.live = ''; form.append(live); }
  live.textContent = `${chip.textContent}.`;
  clearTimeout(form._signal);
  form._signal = setTimeout(() => { btn.classList.remove('is-confirming'); chip.classList.remove('is-on'); live.textContent = ''; bud.classList.remove('is-on'); }, 2400);
  // The bud (play layer): beside the button, one block grows into the whole mark, the logo's own build.
  let bud = form.querySelector('.send-bud');
  if (!bud) { bud = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); bud.setAttribute('class', 'send-bud'); bud.setAttribute('viewBox', '0 0 450 180'); bud.setAttribute('aria-hidden', 'true'); bud.innerHTML = '<path/>'; btn.after(bud); }
  const path = bud.querySelector('path');
  bud.classList.add('is-on');
  if (reduced()) path.setAttribute('d', FINAL_D);
  else {
    const t0 = performance.now();
    const step = (now) => { const f = ((now - t0) / 1000) * FPS; path.setAttribute('d', f < MARK_END ? markD(f) : FINAL_D); if (f < MARK_END) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  form.dispatchEvent(new CustomEvent('controls:sent', { bubbles: true, detail: { data: new FormData(form) } }));
}
function initForm(form) {
  form.noValidate = true;                              // our messages instead of the browser's bubbles (without JS, the bubbles stay)
  let tried = false;
  const fields = () => [...form.querySelectorAll('.field')].filter((f) => controlsOf(f).length);
  // Punish late: leaving a field that has something in it, or any field after a first send.
  form.addEventListener('focusout', (e) => {
    const field = fieldOf(e.target);
    if (!field || field.contains(e.relatedTarget)) return;
    const found = problem(field);
    if (!found) { mark(field, null); return; }
    if (tried || controlsOf(field).some(valueOf) || field.classList.contains('is-invalid')) mark(field, found);
  });
  // Reward early: a field already marked wrong updates as you fix it.
  const recheck = (e) => { const field = fieldOf(e.target); if (field?.classList.contains('is-invalid')) mark(field, problem(field)); };
  form.addEventListener('input', recheck);
  form.addEventListener('change', recheck);
  form.addEventListener('submit', (e) => {
    tried = true;
    const all = fields().map((f) => [f, problem(f)]);
    all.forEach(([f, p]) => mark(f, p));
    const bad = all.filter(([, p]) => p);
    summarise(form, bad);
    if (bad.length) { e.preventDefault(); return; }
    if (form.dataset.confirm !== undefined) { e.preventDefault(); signal(form); }
  });
  form.addEventListener('reset', () => {
    tried = false;
    requestAnimationFrame(() => { fields().forEach((f) => mark(f, null)); summarise(form, []); });
  });
  // Hold to send (play layer, press.js fuse): once everything checks out, Send is a hold, so a stray tap never sends.
  // While something is wrong, a click sends as before and the form shows what to fix.
  const send = form.querySelector('[type="submit"]');
  if (send && form.dataset.confirm !== undefined) fuse(send, { onConfirm: () => form.requestSubmit(send), active: () => fields().every((f) => !problem(f)) });
}

// ── Wire-up ───────────────────────────────────────────────────────────
export function initControls(root = document) {
  const each = (sel, fn) => root.querySelectorAll(sel).forEach((el) => { if (el._ctl) return; el._ctl = true; fn(el); });
  each('.field-meta[data-counter]', initCounter);
  each('.range', initRange);
  each('.stepper', initStepper);
  each('[data-dropzone]', initDropzone);
  each('[data-show-password]', initShowPassword);
  each('.checkbox[data-indeterminate]', (el) => { el.indeterminate = true; });
  each('form[data-validate]', initForm);
}
