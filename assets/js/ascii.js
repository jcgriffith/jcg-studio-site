// Scope ASCII diagrams "compile" on hover / tap / focus: glyphs resolve from
// noise in a diagonal sweep, then the status line reports BUILD OK.
// Reduced motion: the diagram is static and already compiled.
import { reduced } from './reduce-motion.js';

const NOISE = '░▒▓·-/+:';
const KEEP = /[\s]/;

export function initAscii(root = document) {
  root.querySelectorAll('.ascii').forEach((box) => {
    const pre = box.querySelector('pre');
    const st = box.querySelector('.st');
    const ms = box.querySelector('.ms');
    const source = pre.innerHTML;
    const text = pre.textContent;
    const lines = text.split('\n');
    let running = false;

    const finish = (t) => {
      pre.innerHTML = source;
      box.dataset.state = 'ok';
      st.textContent = 'BUILD OK';
      if (ms) ms.textContent = `${t.toFixed(2)}S`;
      running = false;
    };

    if (reduced()) { box.dataset.state = 'ok'; return; }
    box.dataset.state = 'idle';

    const run = () => {
      if (running) return;
      running = true;
      box.dataset.state = 'compiling';
      st.textContent = 'COMPILING';
      const t0 = performance.now();
      const span = lines.reduce((m, l) => Math.max(m, l.length), 0) + lines.length * 2;
      const DUR = 640;
      const frame = (now) => {
        const p = (now - t0) / DUR;
        if (p >= 1) return finish((now - t0) / 1000);
        const front = p * (span + 8);
        pre.textContent = lines.map((l, y) => [...l].map((c, x) => {
          if (KEEP.test(c)) return c;
          const d = x + y * 2;
          if (d < front - 6) return c;
          if (d < front) return NOISE[(Math.random() * NOISE.length) | 0];
          return ' ';
        }).join('')).join('\n');
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };

    box.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') run(); });
    box.addEventListener('click', run);
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); } });
  });
}
