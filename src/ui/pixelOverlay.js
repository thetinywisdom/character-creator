// The world layer of the interaction UI drawn as real pixels: floating speech,
// hit bursts, the "?" box and the slap charge dial are painted on
// a small canvas (screen size / pixel size, the same pixel size as the PS1
// picture) and stretched back up with hard edges, so they are pixelated the
// way the 3D scene is, not drawn in a pixel "style".
//
// Each line of speech and each burst is drawn once into a sprite, its edges made hard
// (alpha 0 or 1) and its colours snapped to the few UI inks, then reused.
// Layout (keeping lines apart) works in low-res pixels.

const INK = '#2f3236', PAPER = '#f2efe8', BRICK = '#9e6c60', YELLOW = '#ffd23f', PINK = '#f4508c', WHITE = '#f2efe8';
const SNAP = [INK, PAPER, BRICK, YELLOW, PINK].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const FONT = "'Silkscreen', ui-monospace, monospace";
const STAR = [[50, 0], [60, 24], [84, 6], [78, 32], [100, 34], [82, 54], [98, 78], [70, 70], [64, 100], [50, 78], [34, 98], [30, 72], [2, 82], [18, 56], [0, 34], [24, 30], [14, 4], [40, 22]];
const CORE = [[50, 0], [62, 30], [96, 22], [74, 50], [98, 84], [62, 70], [50, 100], [38, 70], [4, 84], [26, 50], [2, 22], [38, 30]];

/** Hard edges and the UI's own inks only: what makes a sprite read as pixels. */
function crisp(cv) {
  const g = cv.getContext('2d'), img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
    d[i + 3] = 255;
    let best = SNAP[0], bd = Infinity;
    for (const c of SNAP) { const e = (c[0] - d[i]) ** 2 + (c[1] - d[i + 1]) ** 2 + (c[2] - d[i + 2]) ** 2; if (e < bd) { bd = e; best = c; } }
    d[i] = best[0]; d[i + 1] = best[1]; d[i + 2] = best[2];
  }
  g.putImageData(img, 0, 0);
  return cv;
}
function sprite(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h));
  return cv;
}
/** A box with stepped (pixel) corners. */
function box(g, x, y, w, h, r, fill) {
  g.fillStyle = fill;
  g.fillRect(x + r, y, w - 2 * r, h);
  g.fillRect(x, y + r, w, h - 2 * r);
  for (let k = 1; k < r; k++) { const s = r - Math.round(Math.sqrt(r * r - (r - k) ** 2)); g.fillRect(x + s, y + k, w - 2 * s, 1); g.fillRect(x + s, y + h - 1 - k, w - 2 * s, 1); }
}
function wrap(g, text, max) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > max && line) { lines.push(line); line = word; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
/** Text with an ink outline one pixel all round. */
function outlined(g, text, x, y, fill) {
  g.fillStyle = INK;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [1, 2], [2, 2]]) g.fillText(text, x + dx, y + dy);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

export class PixelOverlay {
  constructor(parent) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'pixelOverlay';
    parent.prepend(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.sprites = new Map(); // key -> sprite
  }
  set visible(v) { this.canvas.hidden = !v; }

  burstSprite(text) {
    const key = `x|${text}|${document.fonts?.check?.(`8px ${FONT}`)}`;
    let s = this.sprites.get(key);
    if (s) return s;
    const W = 78, H = 54, cv = sprite(W, H), g = cv.getContext('2d');
    const poly = (pts, x, y, w, h, fill) => { g.beginPath(); pts.forEach(([px, py], i) => g[i ? 'lineTo' : 'moveTo'](x + (px / 100) * w, y + (py / 100) * h)); g.closePath(); g.fillStyle = fill; g.fill(); };
    poly(STAR, 0, 0, W, H, INK);
    poly(STAR, 3, 3, W - 6, H - 6, YELLOW);
    poly(CORE, W * 0.22, H * 0.2, W * 0.56, H * 0.6, PINK);
    g.font = `700 ${text.length > 7 ? 8 : 12}px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    outlined(g, text, W / 2, H / 2, WHITE);
    s = { cv: crisp(cv), w: W, h: H };
    this.sprites.set(key, s);
    return s;
  }
  qSprite() {
    let s = this.sprites.get('q');
    if (s) return s;
    const cv = sprite(26, 26), g = cv.getContext('2d');
    box(g, 2, 2, 23, 23, 4, INK); box(g, 0, 0, 23, 23, 4, INK); box(g, 2, 2, 19, 19, 3, PAPER);
    g.font = `700 16px ${FONT}`; g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 12, 12);
    s = { cv: crisp(cv), w: 26, h: 26 };
    this.sprites.set('q', s);
    return s;
  }



  /** A floating line of pixel text (outlined), cached. */
  floatSprite(b) {
    const key = `f|${b.kind}|${b.text}|${document.fonts?.check?.(`8px ${FONT}`)}`;
    let s = this.sprites.get(key);
    if (s) return s;
    const m = sprite(1, 1).getContext('2d');
    m.font = `400 8px ${FONT}`;
    const lines = wrap(m, b.text.toUpperCase(), 92);
    const w = Math.ceil(Math.max(...lines.map((l) => m.measureText(l).width))) + 4, h = lines.length * 9 + 3;
    const cv = sprite(w, h), g = cv.getContext('2d');
    g.font = `400 8px ${FONT}`; g.textBaseline = 'top';
    const col = b.kind === 'shout' ? YELLOW : PAPER;
    lines.forEach((l, i) => {
      const x = Math.round((w - g.measureText(l).width) / 2), y = 1 + i * 9;
      g.fillStyle = INK;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) g.fillText(l, x + dx, y + dy);
      g.fillStyle = col; g.fillText(l, x, y);
    });
    s = { cv: crisp(cv), w, h };
    this.sprites.set(key, s);
    if (this.sprites.size > 300) this.sprites.delete(this.sprites.keys().next().value);
    return s;
  }

  /**
   * Speech as floating text (the owner's pick, design B of the bubble lab): no
   * box, outlined pixel words over the head; talk light, shouts yellow and
   * shaking. Lines never cover each other (the oldest keeps its place, newer
   * ones move up or aside). A line replaced by the same person's next one
   * drifts up, fading, and is gone in half a second.
   */
  drawFloating(speech, pie, L) {
    const g = this.g;
    const placed = [];
    if (pie?.ok) placed.push({ x0: L(pie.x) - 58, x1: L(pie.x) + 58, y0: L(pie.y) - 60, y1: L(pie.y) + 3 });
    const free = (x0, x1, y0, y1) => !placed.some((r) => r.x0 < x1 + 3 && r.x1 > x0 - 3 && r.y0 < y1 + 2 && r.y1 > y0 - 2);
    const now = performance.now() / 1000;
    this.ghosts ??= [];
    const live = new Map();
    speech.sort((a, b) => a.b.id - b.b.id);
    for (const { b, s } of speech) {
      const sp = this.floatSprite(b), w = sp.w, h = sp.h;
      const ax = L(s.x), ay = L(s.y) - 2 - Math.min(3, Math.floor(b.age * 6)); // rises a touch as it appears
      let best = null;
      for (let ring = 0; ring < 14 && !best; ring++) {
        for (const dx of ring ? [0, -w * 0.55, w * 0.55].map(Math.round) : [0]) {
          const x0 = ax - Math.round(w / 2) + dx, y1 = ay - Math.round(ring * (h * 0.6 + 1));
          if (free(x0, x0 + w, y1 - h, y1)) { best = { dx, dy: y1 - ay }; break; }
        }
      }
      best ??= { dx: 0, dy: -14 * h };
      const x0 = ax - Math.round(w / 2) + best.dx, y0 = ay + best.dy - h;
      placed.push({ x0, x1: x0 + w, y0, y1: y0 + h });
      live.set(b.id, { who: b.anchor.who, sp, x0, y0 });
      const shake = b.kind === 'shout' && b.age < 0.6 ? (Math.floor(now * 30) % 2 ? 1 : -1) : 0;
      g.globalAlpha = Math.max(0, Math.min(1, (b.life - b.age) / 0.45)); // fades out
      g.drawImage(sp.cv, x0 + shake, y0);
      g.globalAlpha = 1;
    }
    // lines replaced by the same person: drift up and blink away
    for (const [id, was] of this.lastFloat ?? []) {
      if (live.has(id) || !was.who) continue;
      if ([...live.values()].some((v) => v.who === was.who)) this.ghosts.push({ ...was, t: 0 });
    }
    this.lastFloat = live;
    const dt = Math.min(0.1, now - (this.ghostT ?? now)); this.ghostT = now;
    this.ghosts = this.ghosts.filter((gh) => (gh.t += dt) < 0.5);
    for (const gh of this.ghosts) { g.globalAlpha = Math.max(0, 1 - gh.t / 0.5); g.drawImage(gh.sp.cv, gh.x0, Math.round(gh.y0 - gh.t * 40)); }
    g.globalAlpha = 1;
  }

  /**
   * Draw a frame. items: speech { b, s } and bursts { b, s } with screen
   * points s (CSS px); pie: the open pie menu's screen point; charge:
   * { s, f, col } or null. px: the picture's pixel size.
   */
  draw({ W, H, px, speech, bursts, pie, charge }) {
    const cw = Math.ceil(W / px), ch = Math.ceil(H / px);
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    const g = this.g;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, cw, ch);
    const L = (v) => Math.round(v / px);

    this.drawFloating(speech, pie, L);

    // --- bursts: pop big, settle, fade; tilted (rotated with hard pixels)
    for (const { b, s } of bursts) {
      const u = b.age / b.life;
      const k = u < 0.12 ? 0.2 + (1.35 - 0.2) * (u / 0.12) : u < 0.22 ? 1.35 - 0.4 * ((u - 0.12) / 0.1) : u < 0.32 ? 0.95 + 0.1 * ((u - 0.22) / 0.1) : u < 0.42 ? 1.05 - 0.05 * ((u - 0.32) / 0.1) : 1 + (u > 0.78 ? 0.1 * (u - 0.78) / 0.22 : 0);
      const sp = b.kind === 'confused' ? this.qSprite() : this.burstSprite(b.text);
      b.tilt ??= (Math.random() < 0.5 ? -1 : 1) * (0.1 + Math.random() * 0.14);
      g.save();
      g.globalAlpha = u > 0.78 ? Math.max(0, 1 - (u - 0.78) / 0.22) : 1;
      g.translate(L(s.x), L(s.y) - (b.kind === 'confused' ? 30 : 0));
      g.rotate(b.kind === 'confused' ? 0 : b.tilt);
      g.scale(k, k);
      g.drawImage(sp.cv, -Math.round(sp.w / 2), -Math.round(sp.h / 2));
      g.restore();
    }

    // --- the slap charge: a little dial over the target's head
    if (charge?.s?.ok) {
      // grows through the second round with a slow tremble; full red shakes hard
      const r = Math.round(7 + 6 * (charge.grow ?? 0) + (charge.shake ? 1 : 0));
      const amp = charge.shake ? 3 : (charge.grow ?? 0) > 0 ? 0.6 + 1.4 * charge.grow : 0;
      const jit = () => (amp ? Math.round((Math.random() - 0.5) * 2 * amp * (charge.shake ? 1 : Math.random() < 0.35 ? 1 : 0)) : 0);
      const cx = L(charge.s.x) + jit(), cy = L(charge.s.y) - Math.round(6 * (charge.grow ?? 0)) + jit();
      for (let y = -r - 2; y <= r + 2; y++) {
        for (let x = -r - 2; x <= r + 2; x++) {
          const d = Math.hypot(x + 0.5, y + 0.5);
          if (d > r + 2) continue;
          let col = INK;
          if (d <= r) {
            const a = (Math.atan2(x + 0.5, -(y + 0.5)) + Math.PI * 2) % (Math.PI * 2);
            col = a <= charge.f * Math.PI * 2 ? charge.col : PAPER;
          }
          g.fillStyle = col; g.fillRect(cx + x, cy + y, 1, 1);
        }
      }
    }
  }
}
