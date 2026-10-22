// The Work grid's data (assets/data/works.json, 2026-10-21): projects + highlight pieces → floor concepts for canvas.js.
// One cluster per piece; the layout is computed in canvas.js (layoutPieces), so a new piece is one JSON entry, no code.
// status: `live` ships (scripts/build-ship.sh keeps only live), `staged` shows locally with a badge; ?staged=0 hides them.

const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function loadWorks(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`works.json ${res.status}`);
  const w = await res.json();
  const root = new URL('../../', new URL(url, document.baseURI));
  const abs = (p) => (p ? new URL(p, root).href : '');
  const params = new URLSearchParams(location.search);
  const liveOnly = params.get('staged') === '0';
  const L = { col: 480, gap: 48, grid: 24, caption: 96, margin: 96, bandW: 576, ...w.layout };
  if (document.documentElement.classList.contains('t-note') && L.captionNote) L.caption = L.captionNote;   // ?type=note: room for a three-line note
  const snap = (n) => Math.round(n / L.grid) * L.grid;
  const projects = new Map(w.projects.map((p) => [p.id, p]));
  const isLive = (x) => (x.status || 'staged') === 'live';
  const pieces = w.pieces.filter((x) => projects.has(x.project) && (!liveOnly || (isLive(x) && isLive(projects.get(x.project)))));
  const kinds = Object.fromEntries(w.types.map((t) => [slug(t), t]));
  const concepts = pieces.map((x) => {
    const p = projects.get(x.project);
    const m = x.media || {};
    const video = /\.(mp4|webm|mov)(\?|$)/i.test(m.src || '');
    const types = (x.types || []).map(slug);
    return {
      id: x.id,
      concept: x.title,
      label: p.title,
      kind: types[0] || 'all',
      types,
      tag: p.title,
      handle: p.handle || null,   // the project's own account (719: @719studios), shown in place of the tag
      description: (document.documentElement.classList.contains('t-note') && x.note) || x.line || '',   // ?type=note: the sketchbook caption
      member: p.summary,
      date: p.year,
      workType: (x.types || []).join(' · '),
      coverW: L.col,
      coverH: Math.max(L.grid * 4, snap(L.col * (m.h || 3) / (m.w || 4))),
      poster: abs(m.poster || (video ? '' : m.src)),
      src: abs(m.src),
      thumb: abs(m.poster || m.src),
      video,
      page: p.page,
      stageEmbed: p.embed ? p.embed + (x.link || '') : '',
      project: p.id,
      staged: !(isLive(x) && isLive(p)),
      frames: [],
      embed3d: x.embed3d ? abs(x.embed3d) : '',
      coverKind: x.coverKind || '',
      coverFact: x.coverFact || '',
      coverEnd: x.coverEnd || '',
      loft: x.loft || '',
      highlights: (x.highlights || []).map((h) => ({ ...h, src: abs(h.src), poster: abs(h.poster) })),
      cardLine: x.cardLine || '',
      year: x.year || '',
      palette: x.palette || null,
    };
  });
  return {
    version: w.version,
    auto: true,
    world: { w: 2000, h: 2000 },
    kinds,
    types: w.types.filter((t) => concepts.some((c) => c.types.includes(slug(t)))).map((t) => ({ id: slug(t), label: t, n: concepts.filter((c) => c.types.includes(slug(t))).length })),
    projects: Object.fromEntries(w.projects.map((p) => [p.id, { ...p, pieces: concepts.filter((c) => c.project === p.id).map((c) => c.id) }])),
    concepts,
    liveOnly,
    layout: { ...L, auto: true, cover: { w: L.col, h: L.col }, cell: { w: L.col, h: L.col }, gutter: L.grid, cols: 0, head: 0, start: concepts[0]?.id },
  };
}
