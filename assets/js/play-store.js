// The play layer's memory (Phase 1, JC, 2026-10-05): the blocks this device has found, its best scores and times, its
// visits and a couple of settings. All of it lives in this browser's localStorage under one key and is never sent
// anywhere. If storage is blocked (site data off, a private window that refuses it) everything still works for the page
// you are on, in memory, and nothing is kept.
//   find(id)            records a block once and fires `jcg:find` on window (detail: { id, n, label }). When the other
//                       eight are in, the ninth ('all') is recorded with them.
//   count(), has(id), list()   what has been found (list() is in the order found)
//   best(key), record(key, value, { lower })   a best score (higher wins) or time (lower wins) on this device
//   visit(), visits()   counts a visit once per browser session
//   pref(key[, value])  a per-device setting (Blueprint on or off)
//   kept                false when storage is blocked
export const BLOCKS = [
  { id: 'wall', label: 'Cleared the wall' },
  { id: 'build', label: 'Built the mark' },
  { id: 'home', label: 'Played on the floor' },
  { id: 'lock', label: 'Target acquired' },
  { id: 'faq', label: 'Read all eleven' },
  { id: 'case', label: 'Opened a case study' },
  { id: 'field', label: 'Pressed the field' },
  { id: 'sunset', label: 'After sunset in Colorado Springs' },
  { id: 'all', label: 'Found the other eight' },
];
export const TOTAL = BLOCKS.length;
const LABEL = Object.fromEntries(BLOCKS.map((b) => [b.id, b.label]));
const KEY = 'jcg-play', SESSION = 'jcg-visit';
const blank = () => ({ v: 1, found: [], visits: 0, best: {}, prefs: {} });

export let kept = true;
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.v === 1 && Array.isArray(s.found)) return { ...blank(), ...s };
  } catch (e) { kept = false; }
  return blank();
}
let mem = load();
function save() {
  if (!kept) return;
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { kept = false; }
}
try { addEventListener('storage', (e) => { if (e.key === KEY) mem = load(); }); } catch (e) { /* no window events */ }

export const list = () => mem.found.map(([id]) => id);
export const has = (id) => mem.found.some(([f]) => f === id);
export const count = () => mem.found.length;
export const labelOf = (id) => LABEL[id] || id;

export function find(id) {
  if (!LABEL[id] || has(id)) return false;
  mem.found.push([id, Date.now()]);
  const got = [{ id, n: count() }];
  if (id !== 'all' && count() === TOTAL - 1 && !has('all')) { mem.found.push(['all', Date.now()]); got.push({ id: 'all', n: count() }); }
  save();
  for (const g of got) dispatchEvent(new CustomEvent('jcg:find', { detail: { ...g, label: LABEL[g.id] } }));
  return true;
}

export const best = (key) => mem.best[key] ?? null;
/** Keeps value if it beats the best so far. Returns true for a new best. */
export function record(key, value, { lower = false } = {}) {
  const b = best(key);
  if (b !== null && (lower ? value >= b : value <= b)) return false;
  mem.best[key] = value;
  save();
  return true;
}

export const visits = () => mem.visits;
export function visit() {
  let fresh = true;
  try { fresh = !sessionStorage.getItem(SESSION); sessionStorage.setItem(SESSION, '1'); } catch (e) { fresh = !mem.visits; }
  if (fresh) { mem.visits += 1; save(); }
  return mem.visits;
}

export function pref(key, value) {
  if (value === undefined) return mem.prefs[key];
  mem.prefs[key] = value;
  save();
  return value;
}
