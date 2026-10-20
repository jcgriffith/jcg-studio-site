// Frame interiors for Studio Concept tiles.
// Portfolio tiles are FLAT GREY until real media lands: no drawn "art", fake UI,
// or procedural content inside a portfolio rect (real work will be JPG/GIF/MP4
// via `poster` / `src` in concepts.json). canvas.js renders the grey tile plus a
// quiet mono label itself. The only live interior is the end-of-floor plan card,
// which is real HTML (Membership plans), not pretend portfolio media.

const T = {
  plan: (c, f, o) => `
    <div class="wf wf-plan">
      <div class="wf-plan-top"><span class="hud">End of floor</span><span class="hud mute">${c.id.toUpperCase()}</span></div>
      <p class="wf-plan-h">Get this in your queue.</p>
      <a class="wf-plan-row" href="${o.home}#subscribe" data-world-link><span>Standard</span><b>$5,000<small>/mo</small></b><span class="hud mute">1 active</span></a>
      <a class="wf-plan-row" href="${o.home}#subscribe" data-world-link><span>Pro</span><b>$7,500<small>/mo</small></b><span class="hud mute">2 actives</span></a>
      <a class="btn btn--sm wf-plan-cta" href="${o.home}#subscribe" data-world-link>Subscribe <span class="arr" aria-hidden="true">→</span></a>
    </div>`,
};

export function renderFrame(concept, frame, opts) {
  const fn = T[frame.kind];
  return fn ? fn(concept, frame, opts) : '';
}
