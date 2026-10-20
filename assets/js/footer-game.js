// Footer game: Breakout on the JCG STUDIO logo, full page width, at the foot of every page with a footer.
// Hits knock out chunks (a quarter block, a letter corner), and knocked-out bricks fade to a ghost instead of vanishing.
// The wall is the lockup on its grid: each logo block is 8 x 8 bricks, two per grid unit (rounded corners and fillets
// included). STUDIO's drawn letters are cut into bricks of the same size, one per grid unit of the letters: the live
// bricks are a clip, and the smooth letters show through it, so a hit takes a chunk out of a letter. Tap or click to play;
// drag or move to steer (the arrow keys work too). Clear the wall and the mark buds back from one block, then STUDIO types back in.
// It pauses off-screen and only takes over touch scrolling once a game is under way. The orange ball is the one live
// thing on screen.
// Play layer (PLAY-BREAKDOWN.md item 3, JC, 2026-10-05): a bar over the canvas reads the score, this device's best, the
// bricks left and the balls left (three a game), with a Play button you hold (press.js fuse). Clear the logo and, after
// it buds back, the second wall is the page's own word (the host's data-wall) in Departure Mono's pixels; clear that and
// the logo returns. The game tells the page when one starts and when a wall falls (game:start, game:cleared, bubbling from
// the host; play.js turns them into blocks). mountGame(host) mounts one on any host (the Work floor's Play sheet).
import { markBricks, glyphCells, drawGlyph, drawMark, MARK_END, FPS, UNITS, BLOCKS } from './jcg-bud.js';
import './creed.js';
import { best, record } from './play-store.js';
import { fuse } from './press.js';

const PER = 2, BLOCK = UNITS * PER;   // bricks per grid unit, and per block (the mark is 60 x 24 bricks)

const K = 0.5522847498, CH = '#E6E9ED', GREY = 'rgba(230,233,237,.72)', DIM = '#8A919B', SIG = '#FF5B35';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const OUT = { tl: [0, 0], tr: [1, 0], bl: [0, 1], br: [1, 1] }, IN = { tl: [1, 1], tr: [-1, 1], bl: [1, -1], br: [-1, -1] };

// Brick shapes, clockwise, at brick size b with the brick's top-left at (x, y).
function brickPath(p, br, x, y, b) {
  if (br.kind === 'full') { p.rect(x, y, b, b); return; }
  const ox = x + b * OUT[br.k][0], oy = y + b * OUT[br.k][1], sx = IN[br.k][0], sy = IN[br.k][1];
  const ax = ox + b * sx, ay = oy, bx = ox, by = oy + b * sy;                 // the arc runs from A to B around the inner corner
  const c1x = ax - K * b * sx, c1y = ay, c2x = bx, c2y = by - K * b * sy;
  const sx0 = br.kind === 'round' ? ox + b * sx : ox, sy0 = br.kind === 'round' ? oy + b * sy : oy;   // quarter disc: from the inner corner; fillet: from the outer
  const cw = br.kind === 'round' ? (sx * sy < 0) : (sx * sy > 0);
  p.moveTo(sx0, sy0);
  if (cw) { p.lineTo(ax, ay); p.bezierCurveTo(c1x, c1y, c2x, c2y, bx, by); }
  else { p.lineTo(bx, by); p.bezierCurveTo(c2x, c2y, c1x, c1y, ax, ay); }
  p.closePath();
}

const BALLS = 3;
// Chunks (JC, 2026-10-13): a hit knocks out a whole chunk, a quarter of a logo block (4 x 4 bricks), a corner of a
// letter, or 2 x 2 pixels of the word. Now one brick per block, ten in all; a hit block fades out quickly.
// The payoff (JC, 2026-10-13; win line 2026-10-19): clear the mark and it bursts into confetti, a new win line types itself huge across the game
// with a random slang combo, +1,000 points, and a Post-it-on-X link; then the mark buds back.
// Win lines (JC, 2026-10-19): a new one every win, never the same twice in a row; then the logo comes back and the game resets.
const WINS = ['WALL DOWN.', 'CLEAN SWEEP.', 'NAILED IT.', 'TOO EASY.', 'SENT IT.', 'NO NOTES.', 'CERTIFIED.', 'LEGENDARY.', 'BIG MOVE.', 'CALM. PRECISE.', 'GG.', 'RUN IT BACK?'];
function nextWin() {
  let last = -1; try { last = +(localStorage.getItem('jcg-win-last') ?? -1); } catch (e) {}
  let i = Math.floor(Math.random() * (WINS.length - 1)); if (i >= last && last >= 0) i += 1;   // any line but the last one
  try { localStorage.setItem('jcg-win-last', String(i)); } catch (e) {}
  return WINS[i];
}
const PARTY = 4200, BONUS = 1000;
const LETTER_CHUNK = 4, GHOST = 0, FADE = 220;   // a hit brick fades to black (JC, 2026-10-13)
function chunkKey(br) {
  if (br.word) return 'w:' + Math.floor(br.x / 2) + ',' + Math.floor(br.y / 2);
  if (br.letter) return 'l' + br.li + ':' + Math.floor(br.lx / LETTER_CHUNK) + ',' + Math.floor(br.y / LETTER_CHUNK);
  const s = 15 / PER;
  let id = null, d = Infinity;
  for (const [k, b] of Object.entries(BLOCKS)) {      // the block the brick belongs to (fillets join their nearest block)
    const [X, Y, W, H] = b.r.map((v) => v / s), dx = Math.max(X - br.x, 0, br.x - (X + W - 1)), dy = Math.max(Y - br.y, 0, br.y - (Y + H - 1)), dd = dx + dy;
    if (dd < d) { d = dd; id = k; }
  }
  return id;                                            // one brick per block: the mark's ten blocks are the ten bricks (JC, 2026-10-13)
}
const pad = (n) => String(n).padStart(4, '0');

// The page's word in Departure Mono at 11 px, one brick per pixel of the font (its pixel grid at that size).
function wordBricks(word) {
  const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
  x.font = '11px "Departure Mono"';
  const w = Math.ceil(x.measureText(word).width) + 2, h = 16;
  c.width = w; c.height = h;
  x.font = '11px "Departure Mono"'; x.textBaseline = 'top'; x.fillStyle = '#000';
  x.fillText(word, 1, 2);
  const d = x.getImageData(0, 0, w, h).data, cells = [];
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 127) cells.push({ x: i, y, kind: 'full', word: true });
  if (!cells.length) return null;
  const x0 = Math.min(...cells.map((q) => q.x)), y0 = Math.min(...cells.map((q) => q.y));
  return cells.map((q) => ({ ...q, x: q.x - x0, y: q.y - y0 }));
}

class FooterGame {
  constructor(host) {
    this.host = host;
    host._game = this;
    this.word = (host.dataset.wall || '').toUpperCase().slice(0, 14);
    this.bar = document.createElement('div');
    this.bar.className = 'game-bar hud';
    this.bar.innerHTML = '<span>Score <b data-g="score">0000</b></span><span>Best <b data-g="best">----</b></span>' +
      '<span>Bricks <b data-g="bricks">0</b></span><span>Balls <b data-g="balls">' + BALLS + '</b></span>' +
      '<a class="btn btn--ghost btn--sm game-share" data-g="share" target="_blank" rel="noopener" hidden>Post it on X</a>' +
      '<button class="btn btn--ghost btn--sm game-play" type="button"><span data-g="play">Play</span></button>';
    host.append(this.bar);
    this.out = Object.fromEntries([...this.bar.querySelectorAll('[data-g]')].map((el) => [el.dataset.g, el]));
    this.playBtn = this.bar.querySelector('.game-play');
    fuse(this.playBtn, { ms: 500, onConfirm: () => { this.canvas.focus({ preventScroll: true }); this.tap(); }, active: () => this.state === 'idle' || this.state === 'serve' || this.state === 'over' });
    this.canvas = document.createElement('canvas');
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', 'The JCG Studio logo as a Breakout wall. Tap or click to play, or hold Play; drag, move or use the arrow keys to steer. Three balls a game.');
    host.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.state = 'idle'; this.score = 0; this.keys = 0; this.visible = true; this.raf = 0; this.layout = null;
    this.balls = BALLS; this.level = 0;
    new ResizeObserver(() => this.resize()).observe(host);
    new IntersectionObserver(([e]) => { this.visible = e.intersectionRatio > 0.25; if (this.visible) this.kick(); }, { threshold: [0, 0.25, 0.5] }).observe(this.canvas);
    this.bindInput();
    this.resize();
  }

  // ── layout: horizontal lockup on wide screens, stacked on narrow ones ──
  buildWall(kind) {
    const bricks = [];
    const mx = 0;
    for (const b of markBricks(PER)) if (b.kind !== 'web') bricks.push({ ...b, x: b.x + mx, letter: false });   // no fillets: with seams the wall is plain blocks
    const sx = kind === 'stacked' ? 6 : 67, sy = kind === 'stacked' ? 32 : 8;      // STUDIO, 8-brick (one block) caps: centred one empty block under the 60 x 24-brick mark, or on its middle block row and one block after it
    // a letter's ink box sits one brick into its 8-brick cell; its bricks are the cells its strokes touch
    // JCG only (JC, 2026-10-13): STUDIO is no longer part of the wall
    const w = Math.max(...bricks.map(b => b.x)) + 1, h = Math.max(...bricks.map(b => b.y)) + 1;
    return { bricks, w, h, markX: mx, sx, sy, hasLetters: false };
  }
  resize() {
    const W = Math.round(this.host.clientWidth); if (!W) return;
    const kind = W >= 720 ? 'horizontal' : 'stacked';
    if (!this.logo || this.logo.kind !== kind) {
      this.logo = { kind, ...this.buildWall(kind) };
      const cells = this.word && wordBricks(this.word);
      this.wordWall = cells ? { kind: 'word', bricks: cells, w: Math.max(...cells.map((q) => q.x)) + 1, h: Math.max(...cells.map((q) => q.y)) + 1, markX: 0, sx: 0, sy: 0 } : null;
      this.wall = this.level && this.wordWall ? this.wordWall : this.logo;
      this.reset();
    }
    const b0 = Math.max(3, Math.floor(Math.min(W * 0.62 / this.logo.w, 11)));                 // the canvas is sized by the logo,
    const H = Math.round(this.logo.h * b0 * 2.4 + 72);                                      // so a wall change never moves the page
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr); this.canvas.style.height = H + 'px';
    this.dpr = dpr; this.W = W; this.H = H; this.b0 = b0;
    this.place();
    const b = b0;
    this.pw = Math.max(64, 14 * b); this.ph = Math.max(6, b); this.py = H - 28 - this.ph;
    this.r = Math.max(4, Math.round(b * 0.7));
    this.speed = Math.max(260, H * 0.78);   // slower ball (JC, 2026-10-13)
    if (this.px === undefined) this.px = (W - this.pw) / 2;
    this.px = Math.min(Math.max(0, this.px), W - this.pw); this.target = this.px;
    if (this.state !== 'play') this.parkBall();
    this.draw();
  }
  // Brick size and place for the wall in play: the logo's own, or the word's, as large as fits the logo's box.
  place() {
    const { W, b0, logo, wall } = this;
    const b = wall === logo ? b0 : Math.max(3, Math.floor(Math.min(W * 0.9 / wall.w, (logo.h * b0) / wall.h, 16)));
    this.b = b;
    this.wx = Math.round((W - wall.w * b) / 2);
    this.wy = 40 + Math.round((logo.h * b0 - wall.h * b) / 2);
  }
  reset() {
    this.alive = new Map(this.wall.bricks.map(b => [b.x + ',' + b.y, b]));
    this.chunks = new Map(); this.chunkOf = new Map(); this.ghosts = new Map();
    for (const [key, br] of this.alive) {
      const ck = chunkKey(br);
      this.chunkOf.set(key, ck);
      if (!this.chunks.has(ck)) this.chunks.set(ck, []);
      this.chunks.get(ck).push(key);
    }
    this.total = this.chunks.size;
    this.show();
  }
  // The bar: score, best, bricks, balls, and what Play does now.
  show() {
    if (!this.out) return;
    const bst = best('wall');
    this.out.score.textContent = pad(this.score);
    this.out.best.textContent = bst ? pad(bst) : '----';
    this.out.bricks.textContent = String(this.chunks?.size ?? 0);
    this.out.balls.textContent = String(this.balls);
    const label = this.state === 'serve' ? 'Launch' : this.state === 'over' || (this.state === 'idle' && this.played) ? 'Again' : 'Play';
    this.out.play.textContent = label;
    const idle = this.state === 'idle' || this.state === 'serve' || this.state === 'over';
    if (idle) this.playBtn.removeAttribute('aria-disabled'); else this.playBtn.setAttribute('aria-disabled', 'true');
  }
  emit(type, detail = {}) { this.host.dispatchEvent(new CustomEvent(type, { bubbles: true, detail })); }
  parkBall() { this.bx = this.px + this.pw / 2; this.by = this.py - this.r - 1; this.vx = 0; this.vy = 0; }

  // ── input ──
  bindInput() {
    const c = this.canvas;
    const toX = e => e.clientX - c.getBoundingClientRect().left;
    let downX = null;
    // The paddle sits exactly under the pointer (JC, 2026-10-13: it lagged behind the mouse). While a game is on, it
    // follows the mouse anywhere on the page, not only over the canvas.
    const follow = (e) => {
      this.target = toX(e) - this.pw / 2; this.direct = true;
      this.px = Math.min(Math.max(0, this.target), this.W - this.pw);    // move now, not on the next frame
      if (this.state !== 'play' && this.state !== 'party' && this.state !== 'rebuild') { this.parkBall(); this.draw(); }
      this.kick();
    };
    c.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || downX !== null) follow(e); });
    window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && e.target !== c && (this.state === 'play' || this.state === 'serve')) follow(e); }, { passive: true });
    c.addEventListener('pointerdown', e => { downX = toX(e); if (this.state !== 'idle') { this.target = downX - this.pw / 2; this.kick(); } });
    c.addEventListener('pointerup', e => { const moved = downX === null ? 0 : Math.abs(toX(e) - downX); downX = null; if (moved < 12) this.tap(); });
    c.addEventListener('pointercancel', () => { downX = null; });
    c.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.direct = false;
      if (e.key === 'ArrowLeft') { this.keys = -1; e.preventDefault(); this.kick(); }
      else if (e.key === 'ArrowRight') { this.keys = 1; e.preventDefault(); this.kick(); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.tap(); }
    });
    c.addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.keys = 0; });
  }
  tap() {
    if (this.state === 'rebuild' || this.state === 'play' || this.state === 'party') return;
    if (this.state === 'idle' || this.state === 'serve' || this.state === 'over') {
      if (this.state !== 'serve') {                                       // a new game: the logo, three balls, no score
        this.score = 0; this.balls = BALLS; this.played = true; this.out.share.hidden = true;
        if (this.level) { this.level = 0; this.wall = this.logo; this.place(); }
        if (this.state === 'over' || this.alive.size !== this.wall.bricks.length) this.reset();
        this.emit('game:start');
      }
      this.state = 'play'; this.canvas.style.touchAction = 'none';
      this.show();
      const a = (Math.random() * 0.6 - 0.3);
      this.vx = Math.sin(a) * this.speed; this.vy = -Math.cos(a) * this.speed;
      this.kick();
    }
  }

  // ── loop ──
  kick() { if (!this.raf && this.visible) { this.last = performance.now(); this.raf = requestAnimationFrame(t => this.tick(t)); } }
  tick(now) {
    this.raf = 0;
    const dt = Math.min(1 / 30, (now - this.last) / 1000); this.last = now;
    if (!this.visible) return;
    if (this.keys) this.target = this.px + this.keys * this.W * 0.9 * dt;
    const goal = Math.min(Math.max(0, this.target), this.W - this.pw);
    this.px = this.direct ? goal : this.px + (goal - this.px) * Math.min(1, dt * 18);   // pointer: exact; keys: eased
    if (this.state === 'play') this.physics(dt);
    else if (this.state === 'serve' || this.state === 'idle') this.parkBall();
    this.draw(now);
    const fading = [...(this.ghosts?.values() || [])].some((g) => now - g.t < FADE);
    const moving = this.state === 'play' || this.state === 'rebuild' || this.state === 'party' || this.keys || fading || Math.abs(this.target - this.px) > 0.5;
    if (moving) this.raf = requestAnimationFrame(t => this.tick(t));
  }
  physics(dt) {
    const steps = Math.max(1, Math.ceil(Math.hypot(this.vx, this.vy) * dt / (this.r * 0.5)));
    for (let s = 0; s < steps; s++) {
      const h = dt / steps, ox = this.bx, oy = this.by;
      this.bx += this.vx * h; this.by += this.vy * h;
      if (this.bx < this.r) { this.bx = this.r; this.vx = Math.abs(this.vx); }
      if (this.bx > this.W - this.r) { this.bx = this.W - this.r; this.vx = -Math.abs(this.vx); }
      if (this.by < this.r) { this.by = this.r; this.vy = Math.abs(this.vy); }
      // paddle
      if (this.vy > 0 && this.by + this.r >= this.py && oy + this.r <= this.py + 1 && this.bx >= this.px - this.r && this.bx <= this.px + this.pw + this.r) {
        const rel = Math.max(-1, Math.min(1, (this.bx - (this.px + this.pw / 2)) / (this.pw / 2)));
        const v = Math.min(Math.hypot(this.vx, this.vy) * 1.015, this.speed * 1.3), a = rel * 1.05;
        this.vx = Math.sin(a) * v; this.vy = -Math.cos(a) * v; this.by = this.py - this.r;
      }
      if (this.by - this.r > this.H) { this.lose(); return; }
      // bricks: test the cells under the ball's box, nearest first
      const b = this.b, gx0 = Math.floor((this.bx - this.r - this.wx) / b), gx1 = Math.floor((this.bx + this.r - this.wx) / b);
      const gy0 = Math.floor((this.by - this.r - this.wy) / b), gy1 = Math.floor((this.by + this.r - this.wy) / b);
      let hit = null, best = Infinity;
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
        const br = this.alive.get(gx + ',' + gy); if (!br) continue;
        const cx = this.wx + (gx + 0.5) * b, cy = this.wy + (gy + 0.5) * b, d = Math.hypot(cx - this.bx, cy - this.by);
        if (d < best) { best = d; hit = { br, gx, gy }; }
      }
      if (hit) {
        const ck = this.chunkOf.get(hit.gx + ',' + hit.gy), t = performance.now();
        for (const k of this.chunks.get(ck) || []) { const br = this.alive.get(k); if (br) { this.ghosts.set(k, { br, t }); this.alive.delete(k); } }
        this.chunks.delete(ck); this.score += 50; this.show();
        const pgx = Math.floor((ox - this.wx) / b), pgy = Math.floor((oy - this.wy) / b);
        if (pgx !== hit.gx && pgy === hit.gy) this.vx = -this.vx; else this.vy = -this.vy;
        this.bx = ox; this.by = oy;
        if (!this.chunks.size) { this.startRebuild(); return; }
      }
    }
  }
  lose() {
    this.canvas.style.touchAction = '';
    this.balls -= 1;
    if (this.balls > 0) { this.state = 'serve'; this.parkBall(); this.show(); return; }
    this.state = 'over'; this.overAt = performance.now(); this.parkBall();
    this.newBest = record('wall', this.score);
    this.show();
  }
  // A wall falls. The logo buds back and the page's word goes up; the word falls and the logo comes back.
  startRebuild() {
    this.canvas.style.touchAction = '';
    if (this.level === 0) {                                                  // the payoff
      this.score += BONUS; this.combo = nextWin();
      const text = `I cleared the JCG wall: ${this.score} points. ${this.combo.charAt(0) + this.combo.slice(1).toLowerCase()}`;
      this.out.share.href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent('https://jcg.studio');
      this.out.share.hidden = false;
      const b = this.b; this.bits = this.wall.bricks.filter((q) => q.kind !== 'web').map((q) => {
        const a = Math.random() * Math.PI * 2, v = 180 + Math.random() * 520;
        return { x: this.wx + q.x * b, y: this.wy + q.y * b, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 420, s: b * (0.6 + Math.random() * 0.5), r: Math.random() * 6, vr: (Math.random() - 0.5) * 9, o: Math.random() < 0.14 };
      });
      this.emit('game:cleared', { wall: 'logo', score: this.score });
      this.state = 'party'; this.t0 = performance.now(); this.lastP = this.t0; this.parkBall(); this.show(); this.kick(); return;
    }
    this.emit('game:cleared', { wall: this.level ? 'word' : 'logo', score: this.score });
    if (this.level === 0 && !reduce.matches) { this.state = 'rebuild'; this.t0 = performance.now(); this.parkBall(); this.show(); return; }
    this.nextWall();
  }
  // After the win the logo is back and the game is reset: the next tap starts a fresh game (2026-10-19: no word wall).
  nextWall() {
    this.level = 0; this.wall = this.logo;
    this.place(); this.reset();
    this.state = 'idle'; this.played = true; this.balls = BALLS; this.parkBall(); this.show();
  }

  // The payoff: confetti from the wall's own bricks, then the creed typed big.
  party(ctx, t, now) {
    const dt = Math.min(1 / 30, (now - this.lastP) / 1000); this.lastP = now;
    if (!reduce.matches) for (const p of this.bits) {
      p.vy += 1500 * dt; p.vx *= 0.995; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y > this.H + 40) continue;
      ctx.save(); ctx.translate(p.x + p.s / 2, p.y + p.s / 2); ctx.rotate(p.r);
      ctx.fillStyle = p.o ? SIG : CH; ctx.globalAlpha = Math.max(0, 1 - t / PARTY); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore();
    }
    const combo = this.combo || WINS[0];
    const size = Math.max(18, Math.min(72, Math.floor(this.W * 0.9 / (combo.length * 0.62 + 1)))), small = Math.round(size * 0.36);
    const cy = this.wy + (this.logo.h * this.b0) / 2, typed = reduce.matches ? combo.length : Math.max(0, Math.floor((t - 600) / 70));
    ctx.textAlign = 'center';
    ctx.font = `${size}px "Departure Mono"`; ctx.fillStyle = CH;
    const shown = combo.slice(0, Math.min(combo.length, typed)); ctx.fillText(shown, this.W / 2, cy + size * 0.35);
    const w = ctx.measureText(combo).width, cx = this.W / 2 - w / 2 + ctx.measureText(shown).width;
    if (typed <= combo.length || Math.floor(t / 500) % 2) { ctx.fillStyle = SIG; ctx.fillRect(cx + size * 0.08, cy + size * 0.35 - size * 0.78, size * 0.5, size * 0.9); }
    ctx.font = '11px "Departure Mono"'; ctx.fillStyle = DIM; ctx.fillText(`WALL CLEARED · +${BONUS}`, this.W / 2, cy + size * 1.4);
    ctx.textAlign = 'start';
  }

  // ── drawing ──
  letters(ctx, n) {
    if (this.wall.hasLetters === false) return;      // the first n letters of STUDIO, whole, on the brick grid (a grid unit is one brick; the ink box sits one brick into its cell)
    const { b } = this, { sx, sy } = this.wall;
    for (let i = 0; i < n; i++) drawGlyph(ctx, 'STUDIO'[i], this.wx + (sx + 8 * i + 1) * b, this.wy + sy * b, b, 1, GREY);
  }
  draw(now = performance.now()) {
    const { ctx, dpr, b } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '11px "Departure Mono"'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = DIM;
    if (this.state === 'party') {
      const t = now - this.t0;
      if (t > PARTY) { if (reduce.matches) { this.nextWall(); } else { this.state = 'rebuild'; this.t0 = now; } return this.draw(now); }
      this.party(ctx, t, now);
      const pr = this.ph / 2;
      ctx.fillStyle = CH; ctx.beginPath(); ctx.roundRect(this.px, this.py, this.pw, this.ph, pr); ctx.fill();
      ctx.fillStyle = SIG; ctx.beginPath(); ctx.arc(this.bx, this.by, this.r, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const typing = MARK_END + 12, f = (now - this.t0) / 1000 * FPS;
    if (this.state === 'rebuild' && f > typing + 6 * 4 + 20) { this.nextWall(); return this.draw(now); }   // the bud is done: the next wall
    if (this.state === 'rebuild') {
      const cell = BLOCK * b;
      drawMark(ctx, f, this.wx + this.wall.markX * b, this.wy, cell);
      const n = Math.max(0, Math.min(6, Math.floor((f - typing) / 4)));
      this.letters(ctx, n);
    } else {
      // ghosts: knocked-out bricks, fading to a whisper of the wall
      const groups = new Map();
      for (const g of this.ghosts.values()) {
        const a = GHOST + (1 - GHOST) * Math.max(0, 1 - (now - g.t) / FADE), key = a.toFixed(2);
        if (!groups.has(key)) groups.set(key, { a, mark: new Path2D(), cells: new Path2D(), any: false });
        const gr = groups.get(key), x = this.wx + g.br.x * b, y = this.wy + g.br.y * b;
        if (g.br.letter) { gr.cells.rect(x, y, b, b); gr.any = true; } else brickPath(gr.mark, g.br, x, y, b);
      }
      for (const gr of groups.values()) {
        ctx.globalAlpha = gr.a; ctx.fillStyle = CH; ctx.fill(gr.mark);
        if (gr.any && this.wall === this.logo) { ctx.save(); ctx.clip(gr.cells); this.letters(ctx, 6); ctx.restore(); }
      }
      ctx.globalAlpha = 1;
      const mark = new Path2D(), cells = new Path2D(), word = new Path2D();
      for (const br of this.alive.values()) {
        const x = this.wx + br.x * b, y = this.wy + br.y * b;
        if (br.word) word.rect(x, y, b, b); else if (br.letter) cells.rect(x, y, b, b); else brickPath(mark, br, x, y, b);
      }
      ctx.fillStyle = CH; ctx.fill(mark); ctx.fill(word);
      if (this.wall === this.logo) { ctx.save(); ctx.clip(cells); this.letters(ctx, 6); ctx.restore(); }   // the live letter bricks are the window the smooth letters show through
      // no seams: with one brick per block, the logo reads as itself (JC, 2026-10-13)
    }
    // paddle and ball
    const pr = this.ph / 2;
    ctx.fillStyle = CH; ctx.beginPath(); ctx.roundRect(this.px, this.py, this.pw, this.ph, pr); ctx.fill();
    ctx.fillStyle = SIG; ctx.beginPath(); ctx.arc(this.bx, this.by, this.r, 0, Math.PI * 2); ctx.fill();
    if (this.state === 'idle' || this.state === 'serve' || this.state === 'over') {
      const msg = this.state === 'over' ? `GAME OVER · ${pad(this.score)}${this.newBest ? ' · NEW BEST' : ''}` : this.state === 'idle' ? 'TAP TO PLAY' : 'TAP TO LAUNCH';
      ctx.fillStyle = DIM; ctx.textAlign = 'center'; ctx.fillText(msg, this.W / 2, this.py - 28); ctx.textAlign = 'start';
    }
    window.__footerGame = { state: this.state, bricks: this.chunks?.size ?? 0, total: this.total, b, layout: this.wall.kind, bx: this.bx, score: this.score, balls: this.balls, level: this.level };
  }
}

/** Mounts the game on a host (once). The pages' footers mount themselves; the Work floor's Play sheet calls this. */
export function mountGame(host) {
  if (!host || host._game || host._mounting) return host?._mounting || Promise.resolve(host?._game);
  host._mounting = document.fonts.load('11px "Departure Mono"').then(() => (host._game || new FooterGame(host)));
  return host._mounting;
}
document.querySelectorAll('[data-footer-game]').forEach(mountGame);
