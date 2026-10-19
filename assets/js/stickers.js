// The sticker sheet (play layer: a reward for all nine blocks, PLAY-BREAKDOWN.md, JC, 2026-10-05): the mark, STUDIO, the
// lamp, a corner bracket and "24 px", drawn from the real geometry (jcg-bud.js) and the live colour tokens, each on its own
// die-cut backing over the dot grid. download('svg' | 'png') makes the sheet on this device and hands it to the browser's
// download; nothing is sent anywhere. Text is Departure Mono's own pixels, read from the font at 11 px and drawn as squares,
// so the SVG needs no font.
import { FINAL_D, MARK_W, MARK_H, wordSVG } from './jcg-bud.js';

const SW = 1200, SH = 720;
const tok = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// A word as pixel squares: the font at 11 px, one square per lit pixel, each `px` units wide.
function pixelText(text, x0, y0, px, fill) {
  const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
  g.font = '11px "Departure Mono"';
  const w = Math.ceil(g.measureText(text).width) + 2, h = 16;
  c.width = w; c.height = h;
  g.font = '11px "Departure Mono"'; g.textBaseline = 'top'; g.fillText(text, 1, 2);
  const d = g.getImageData(0, 0, w, h).data, rects = [];
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 127) { rects.push([x, y]); minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const out = rects.map(([x, y]) => `<rect x="${x0 + (x - minX) * px}" y="${y0 + (y - minY) * px}" width="${px}" height="${px}"/>`).join('');
  return { svg: `<g fill="${fill}">${out}</g>`, w: (maxX - minX + 1) * px, h: (maxY - minY + 1) * px };
}

async function sheet() {
  await document.fonts.load('11px "Departure Mono"');
  const VOID = tok('--void', '#0B0C0E'), VOID2 = tok('--void-2', '#111418'), CHROME = tok('--chrome', '#E6E9ED'), SIGNAL = tok('--signal', '#FF5B35');
  const cut = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="${VOID2}" stroke="${CHROME}" stroke-opacity=".24" stroke-width="2"/>`;
  const parts = [];
  // 1 · the mark
  const mk = 0.84, mw = MARK_W * mk, mh = MARK_H * mk;
  parts.push(cut(60, 60, 520, 260), `<path transform="translate(${60 + (520 - mw) / 2} ${60 + (260 - mh) / 2}) scale(${mk})" fill="${CHROME}" d="${FINAL_D}"/>`);
  // 2 · STUDIO
  const unit = 7, sw = 45 * unit, sh = 8 * unit;
  parts.push(cut(60, 360, 520, 160), `<g transform="translate(${60 + (520 - sw) / 2} ${360 + (160 - sh) / 2})" color="${CHROME}">${wordSVG('STUDIO', unit).replace('<svg ', '<svg overflow="visible" ')}</g>`);
  // 3 · the lamp: the signal square in its halo, as .lamp-dot draws it, eight times over
  parts.push(cut(640, 60, 220, 220), `<rect x="${750 - 48}" y="${170 - 48}" width="96" height="96" fill="${SIGNAL}" fill-opacity=".22"/>`, `<rect x="${750 - 24}" y="${170 - 24}" width="48" height="48" fill="${SIGNAL}"/>`);
  // 4 · a corner bracket: four arms around nothing, the frame the interface puts on what matters
  const bx = 920, by = 80, bw = 180, a = 44, t = 5;
  parts.push(cut(900, 60, 220, 220), `<g fill="${CHROME}">` +
    `<rect x="${bx}" y="${by}" width="${a}" height="${t}"/><rect x="${bx}" y="${by}" width="${t}" height="${a}"/>` +
    `<rect x="${bx + bw - a}" y="${by}" width="${a}" height="${t}"/><rect x="${bx + bw - t}" y="${by}" width="${t}" height="${a}"/>` +
    `<rect x="${bx}" y="${by + bw - t}" width="${a}" height="${t}"/><rect x="${bx}" y="${by + bw - a}" width="${t}" height="${a}"/>` +
    `<rect x="${bx + bw - a}" y="${by + bw - t}" width="${a}" height="${t}"/><rect x="${bx + bw - t}" y="${by + bw - a}" width="${t}" height="${a}"/></g>`);
  // 5 · "24 PX", in the font's pixels
  const px = pixelText('24 PX', 0, 0, 10, CHROME);
  parts.push(cut(640, 320, 480, 200), `<g transform="translate(${640 + (480 - px.w) / 2} ${320 + (200 - px.h) / 2})">${px.svg}</g>`);
  // the sheet's caption
  const cap = pixelText('JCG STUDIO STICKERS', 0, 0, 3, CHROME);
  parts.push(`<g transform="translate(60 ${SH - 60 - cap.h})" opacity=".55">${cap.svg}</g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">` +
    `<defs><pattern id="g" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.1" fill="${CHROME}" fill-opacity=".14"/></pattern>` +
    `<pattern id="g5" width="120" height="120" patternUnits="userSpaceOnUse"><circle cx="60" cy="60" r="1.5" fill="${CHROME}" fill-opacity=".3"/></pattern></defs>` +
    `<rect width="${SW}" height="${SH}" fill="${VOID}"/><rect width="${SW}" height="${SH}" fill="url(#g)"/><rect width="${SW}" height="${SH}" fill="url(#g5)"/>` +
    parts.join('') + '</svg>';
}

function save(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function download(kind = 'png') {
  const svg = await sheet();
  if (kind === 'svg') { save(new Blob([svg], { type: 'image/svg+xml' }), 'jcg-studio-stickers.svg'); return; }
  const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = SW * 2; c.height = SH * 2;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  await new Promise((resolve) => c.toBlob((b) => { if (b) save(b, 'jcg-studio-stickers.png'); resolve(); }, 'image/png'));
}

/** The sheet's SVG text, for tests and the brand page. */
export const stickerSheet = sheet;
