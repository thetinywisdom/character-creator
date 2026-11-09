// The world layer of the interaction UI drawn as real pixels: speech bubbles,
// their tails, hit bursts, the "?" box and the slap charge dial are painted on
// a small canvas (screen size / pixel size, the same pixel size as the PS1
// picture) and stretched back up with hard edges, so they are pixelated the
// way the 3D scene is, not drawn in a pixel "style".
//
// Each bubble and burst is drawn once into a sprite, its edges made hard
// (alpha 0 or 1) and its colours snapped to the few UI inks, then reused.
// Layout (stacking, tails) works in low-res pixels.

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
    this.state = new Map();   // bubble id -> { ox, oy } (stacking, eased)
  }
  set visible(v) { this.canvas.hidden = !v; }

  bubbleSprite(b) {
    const key = `b|${b.kind}|${b.name}|${b.text}|${document.fonts?.check?.(`8px ${FONT}`)}`;
    let s = this.sprites.get(key);
    if (s) return s;
    const shout = b.kind === 'shout';
    const m = sprite(1, 1).getContext('2d');
    m.font = `400 8px ${FONT}`;
    const lines = wrap(m, b.text.toUpperCase(), 104);
    const tw = Math.max(...lines.map((l) => m.measureText(l).width), b.name ? m.measureText(b.name.toUpperCase()).width : 0);
    const pad = 4, B = 2, lh = 9, nameH = b.name ? 10 : 0;
    const w = Math.round(tw + pad * 2 + B * 2), h = Math.round(lines.length * lh + nameH + pad * 2 + B * 2 - 1);
    const cv = sprite(w + 2, h + 2), g = cv.getContext('2d');
    box(g, 2, 2, w, h, 4, INK);          // hard shadow
    box(g, 0, 0, w, h, 4, INK);          // outline
    box(g, B, B, w - 2 * B, h - 2 * B, 3, PAPER);
    g.textBaseline = 'top';
    g.font = `400 8px ${FONT}`;
    if (b.name) { g.fillStyle = BRICK; g.fillText(b.name.toUpperCase(), B + pad, B + pad); }
    // whole-pixel positions keep the pixel font sharp
    g.fillStyle = shout ? BRICK : INK;
    lines.forEach((l, i) => g.fillText(l, Math.round((w - g.measureText(l).width) / 2), B + pad + nameH + i * lh));
    s = { cv: crisp(cv), w, h };
    this.sprites.set(key, s);
    if (this.sprites.size > 300) this.sprites.delete(this.sprites.keys().next().value);
    return s;
  }
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

  /** A long tail from (bx, by) on a bubble's bottom edge to the speaker at (tx, ty): paper inside, ink edges, row by row. */
  tail(bx, by, tx, ty) {
    const g = this.g, rows = Math.max(1, Math.round(ty - by));
    const cx = bx + (tx - bx) * 0.25 + 3, cy = by + (ty - by) * 0.5; // a gentle curve
    for (let k = 0; k <= rows; k++) {
      const t = k / rows, y = Math.round(by + k);
      const x = Math.round((1 - t) ** 2 * bx + 2 * (1 - t) * t * cx + t * t * tx);
      const hw = Math.round(5 * (1 - t));
      g.fillStyle = INK; g.fillRect(x - hw - 2, y, hw * 2 + 4, 1);
      if (hw > 0) { g.fillStyle = PAPER; g.fillRect(x - hw, y, hw * 2, 1); }
    }
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

    // --- speech: stack so nothing covers anything (the oldest keeps its place)
    const placed = [];
    if (pie?.ok) placed.push({ x0: L(pie.x) - 58, x1: L(pie.x) + 58, y0: L(pie.y) - 60, y1: L(pie.y) + 3 });
    const free = (x0, x1, y0, y1) => !placed.some((r) => r.x0 < x1 && r.x1 > x0 && r.y0 < y1 && r.y1 > y0);
    const live = new Set(), drawn = [];
    speech.sort((a, b) => a.b.id - b.b.id);
    for (const { b, s } of speech) {
      live.add(b.id);
      const sp = this.bubbleSprite(b), w = sp.w, h = sp.h;
      const fx = b.side === 'left' ? 0.88 : b.side === 'right' ? 0.12 : 0.5;
      const sx = L(s.x), sy = L(s.y), nx0 = sx - Math.round(w * fx), ny1 = sy - 5;
      let best = { dx: 0, dy: 0 };
      if (!free(nx0 - 2, nx0 + w + 2, ny1 - h - 2, ny1)) {
        best = null;
        for (let ring = 1; ring < 14 && !best; ring++) {
          const dy = -Math.round(ring * h * 0.55);
          for (const dx of [0, -w * 0.45, w * 0.45, -w * 0.8, w * 0.8].map(Math.round)) {
            if (free(nx0 + dx - 2, nx0 + dx + w + 2, ny1 + dy - h - 2, ny1 + dy)) { best = { dx, dy }; break; }
          }
        }
        best ??= { dx: 0, dy: -14 * h };
      }
      placed.push({ x0: nx0 + best.dx - 2, x1: nx0 + best.dx + w + 2, y0: ny1 + best.dy - h - 2, y1: ny1 + best.dy });
      let st = this.state.get(b.id);
      if (!st) { st = { ox: best.dx, oy: best.dy }; this.state.set(b.id, st); }
      st.ox += (best.dx - st.ox) * 0.5; st.oy += (best.dy - st.oy) * 0.5;
      const x0 = nx0 + Math.round(st.ox), y0 = ny1 + Math.round(st.oy) - h;
      const age = b.age, pop = Math.min(1, age / 0.15);
      const alpha = b.kind === 'talk' ? Math.min(1, (b.life - b.age) / 0.4) : 1;
      const shake = b.kind === 'shout' && age > 0.2 && age < 0.9 ? Math.round(Math.sin(age * 40) * 1.5) : 0;
      drawn.push({ sp, x0: x0 + shake, y0, w, h, sx, sy, fx, lifted: Math.hypot(st.ox, st.oy) > 4, pop, alpha });
    }
    for (const id of this.state.keys()) if (!live.has(id)) this.state.delete(id);
    // tails first (under every bubble), then the bubbles
    for (const d of drawn) {
      g.globalAlpha = d.alpha;
      if (d.lifted) this.tail(Math.max(d.x0 + 10, Math.min(d.x0 + d.w - 10, d.sx)), d.y0 + d.h - 3, d.sx, d.sy - 1);
      else {
        // the short tail: a small stepped point under the bubble
        const tx = Math.max(d.x0 + 6, Math.min(d.x0 + d.w - 6, d.x0 + Math.round(d.w * d.fx)));
        for (let k = 0; k < 5; k++) { g.fillStyle = INK; g.fillRect(tx - (5 - k) - 1, d.y0 + d.h - 2 + k, (5 - k) * 2 + 2, 1); if (k < 4) { g.fillStyle = PAPER; g.fillRect(tx - (4 - k), d.y0 + d.h - 2 + k, (4 - k) * 2, 1); } }
      }
    }
    for (const d of drawn) {
      g.globalAlpha = d.alpha;
      if (d.pop < 1) {
        const k = 0.4 + 0.6 * d.pop + Math.sin(d.pop * Math.PI) * 0.15;
        const w = Math.max(1, Math.round(d.sp.cv.width * k)), h = Math.max(1, Math.round(d.sp.cv.height * k));
        g.drawImage(d.sp.cv, Math.round(d.x0 + (d.sp.cv.width - w) / 2), Math.round(d.y0 + d.sp.cv.height - h), w, h);
      } else g.drawImage(d.sp.cv, d.x0, d.y0);
    }
    g.globalAlpha = 1;

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
