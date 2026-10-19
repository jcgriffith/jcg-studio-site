// Signal Confirm — plan buttons blink the status lamp twice and raise a mono
// QUEUED chip, then hand off to Stripe. Modified clicks (new tab) pass through.
// Play layer (2026-10-05): you hold a plan button to confirm (press.js fuse: the brackets close in while the lamp fills;
// a quick tap says "Hold"), so a stray tap never sends anyone to checkout. Enter and Space confirm at once.
import { reduced } from './reduce-motion.js';
import { fuse } from './press.js';

export function initConfirm(root = document) {
  root.querySelectorAll('[data-confirm]').forEach((btn) => {
    const chip = document.createElement('span');
    chip.className = 'chip chip--signal confirm-chip';
    chip.setAttribute('aria-hidden', 'true');
    chip.textContent = btn.dataset.confirm || 'QUEUED';
    btn.append(chip);

    const live = document.getElementById('confirm-live');

    const go = () => {
      if (btn.classList.contains('is-confirming')) return;
      const href = btn.href;
      btn.classList.add('is-confirming');
      if (live) live.textContent = `${chip.textContent}. Opening secure checkout.`;
      const wait = reduced() ? 250 : 820;
      setTimeout(() => chip.classList.add('is-on'), reduced() ? 0 : 300);
      setTimeout(() => { window.location.href = href; }, wait);
    };
    fuse(btn, { onConfirm: go });

    // bfcache restore: reset so the button works again after Back.
    window.addEventListener('pageshow', () => {
      btn.classList.remove('is-confirming');
      chip.classList.remove('is-on');
    });
  });
}
