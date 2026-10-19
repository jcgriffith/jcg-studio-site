/* JCG mark, still: the final logo (JC, 2026-10-05: the block mark) as SVG and lockups, for pages that show it
   at rest (the brand page's Logo tab).

   The geometry lives in jcg-bud.js, the same code that buds the mark on the Motion tab and in the nav:
   BLOCKS lists the nine blocks on the 30 × 12 unit grid (a block is 4 × 4 units, one unit of air between
   letters) and the corners each one rounds, and FINAL_D is the settled logo as one path (one block = 60 units,
   corners 12 = a fifth of a block, fillets where two blocks of one letter meet corner to corner). STUDIO's letters
   (JC's "Departure, redrawn") live there too: strokes on a 5 × 8 grid, drawn here as SVG. Nothing is redrawn in this
   file, so the still logo can't drift from the moving one.

   Lockups are measured in blocks (one grid row is one block) and are one SVG: the mark plus STUDIO's drawn letters,
   capitals exactly one block tall, so a stroke is an eighth of a block. Beside the mark the capitals fill its middle
   row, one block after it; stacked, they sit one empty row below it. Use blocks in multiples of 8 px: every stroke is
   then a whole number of pixels and the mark's corners stay at least 1.6 px. (The site's 12 px blocks are the one
   half-step: 1.5 px strokes, whole device pixels on a 2x screen.) JC chose this over two-thirds-block capitals on
   2026-10-05. */
import { FINAL_D, BLOCKS, MARK_W, MARK_H, UNITS, wordGroups, wordInk } from "./jcg-bud.js";

export { BLOCKS, UNITS };
export const COLS = MARK_W / 60; // 7.5 blocks
export const ROWS = MARK_H / 60; // 3 blocks
const n2 = (v) => +v.toFixed(2);
const n4 = (v) => +v.toFixed(4);

/** The mark as an SVG string. `cell` is px per block; `pad` adds empty blocks around it. */
export function markSVG({ cell = 12, pad = 0, label = "JCG Studio" } = {}) {
  const w = COLS + pad * 2;
  const h = ROWS + pad * 2;
  const a11y = label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad * 60} ${-pad * 60} ${w * 60} ${h * 60}" width="${w * cell}" height="${h * cell}" fill="currentColor" ${a11y}><path d="${FINAL_D}"/></svg>`;
}

/** A word in the logo's letters as an SVG group at (x, y) px, `unit` px per grid unit, in the label's 72% ink. */
const wordG = (text, x, y, unit) =>
  `<g transform="translate(${n2(x)} ${n2(y)}) scale(${n4(unit)})" fill="none" stroke="currentColor" stroke-opacity=".72" stroke-width="1" stroke-linecap="butt">${wordGroups(text)}</g>`;

/** A lockup as an HTML string: "mark", "horizontal", "stacked", or "wordmark". */
export function lockup(kind = "horizontal", { cell = 12 } = {}) {
  const open = (name, label = true) =>
    `<span class="jcg-lockup jcg-lockup--${name}" style="--cell:${cell}px"${label ? ' role="img" aria-label="JCG Studio"' : ""}>`;
  const unit = cell / 8;                            // px per grid unit of the type: capitals (8 units) are one block
  const cap = 8 * unit, W = COLS * cell, H = ROWS * cell, k = cell / 60;
  const svg = (w, h, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n2(w)} ${n2(h)}" width="${n2(w)}" height="${n2(h)}" aria-hidden="true">${body}</svg>`;
  const mark = `<g transform="scale(${n2(k)})" fill="currentColor"><path d="${FINAL_D}"/></g>`;
  switch (kind) {
    case "mark":
      return `${open("mark", false)}${markSVG({ cell })}</span>`;
    case "horizontal": {
      // The mark reads as JCG, so STUDIO completes the name. Never spell JCG beside it.
      // Capitals fill the mark's middle block row, the ink one block after it.
      const gap = cell, ink = wordInk("STUDIO") * unit;
      return `${open(kind)}${svg(W + gap + ink, H, mark + wordG("STUDIO", W + gap, (H - cap) / 2, unit))}</span>`;
    }
    case "stacked": {
      // STUDIO one empty block row below the mark, centred under it.
      const ink = wordInk("STUDIO") * unit;
      return `${open(kind)}${svg(W, H + cell + cap, mark + wordG("STUDIO", (W - ink) / 2, H + cell, unit))}</span>`;
    }
    case "wordmark":
      return `${open("wordmark", false)}${svg(wordInk("JCG STUDIO") * unit, cap, wordG("JCG STUDIO", 0, 0, unit))}</span>`;
    default:
      throw new Error(`Unknown JCG lockup: ${kind}`);
  }
}

/** Render every [data-jcg] element, e.g. <span data-jcg="horizontal" data-cell="12">. */
export function renderAll(root = document) {
  root.querySelectorAll("[data-jcg]").forEach((el) => {
    el.innerHTML = lockup(el.dataset.jcg, { cell: Number(el.dataset.cell) || 12 });
  });
}
