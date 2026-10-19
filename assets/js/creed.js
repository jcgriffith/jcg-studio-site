// The creed in the footer: "The future is gonna be ___". The orange cursor types the slang, holds, deletes, and loops
// (an approved exception to the no-loop rule; it pauses off-screen and while the tab is hidden, and reduced motion
// keeps the first combo still). Same words as branding/taglines/future-is.html. Mounts on every [data-creed].
const WORDS = ['rad, bruh', 'lowkey lit', 'hella dope', 'such a vibe', 'bussin’, fr', 'epic sauce', 'so wild', 'pure magic', 'so fetch', 'mad fresh', 'friggin’ sick'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mount(el) {
  if (el._creed) return; el._creed = true;
  const line = el.closest('.foot-creed') || el.parentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = WORDS[0]; return; }
  let onScreen = false, wake = null;
  const live = () => onScreen && !document.hidden;
  const resume = () => { if (live() && wake) { wake(); wake = null; } };
  const wait = async (ms) => { await sleep(ms); if (!live()) await new Promise((r) => { wake = r; }); };
  document.addEventListener('visibilitychange', resume);
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; resume(); }).observe(line);
  (async () => {
    for (let k = 0; ; k = (k + 1) % WORDS.length) {
      const word = WORDS[k];
      line.classList.add('typing');
      for (let i = el.textContent.length ? 0 : 1; i <= word.length; i++) { el.textContent = word.slice(0, i); await wait(70); }
      line.classList.remove('typing'); await wait(900); line.classList.add('typing');
      for (let i = word.length - 1; i >= 0; i--) { el.textContent = word.slice(0, i); await wait(32); }
      await wait(180);
    }
  })();
}
document.querySelectorAll('[data-creed]').forEach(mount);
