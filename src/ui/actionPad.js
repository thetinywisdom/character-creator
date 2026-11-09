// The City's action buttons: every interaction has its own button, so a phone
// can do everything a keyboard can. Owner's request: "all interactions should
// be in a button", "the E icon should be a hand icon", several layouts.
//
//   USE (hand, E)   get on / off a vehicle next to you, else talk
//   SLAP (1)        hold to charge (the dial), release to slap
//   PUSH (2)  TALK (3)  FART (4)
//   JUMP (Space)  PEEL (B: drop a banana peel)  RUN (Shift: hold; the handbrake when riding)
//
// People buttons act on the person highlighted by the ring (the nearest one in
// front of you, or the one under the mouse); if they are a little way off you
// run over first. Buttons fire on finger-down (pointer events), so they work
// while the other thumb is on the joystick (phones send no clicks while a
// second finger is down). What you see is painted on the pixel layer
// (pixelOverlay.js drawPad); these page buttons are the tap areas, exactly
// the same size as the tiles.

export const PAD_LAYOUTS = ['Arc', 'Grid', 'Split', 'Bar'];

const BUTTONS = [
  { id: 'use', label: 'USE', key: 'E', icon: 'hand', title: 'Get on / off, or talk (E)' },
  { id: 'slap', label: 'SLAP', key: '1', icon: 'slap', title: 'Slap (1, hold to charge)', people: true },
  { id: 'push', label: 'PUSH', key: '2', icon: 'push', title: 'Push (2)', people: true },
  { id: 'talk', label: 'TALK', key: '3', icon: 'talk', title: 'Talk (3)', people: true },
  { id: 'fart', label: 'FART', key: '4', icon: 'fart', title: 'Fart (4)' },
  { id: 'jump', label: 'JUMP', key: '_', icon: 'jump', title: 'Jump (Space)' },
  { id: 'peel', label: 'PEEL', key: 'B', icon: 'peel', title: 'Drop a banana peel (B)' },
  { id: 'run', label: 'RUN', key: 'S', icon: 'run', title: 'Run, hold (Shift); handbrake when riding' },
];
const RIDING = new Set(['use', 'run']); // on a vehicle only these make sense

export class ActionPad {
  constructor(container, input) {
    this.el = container;
    this.input = input;
    try { this.layout = localStorage.getItem('tinycity.pad') ?? 'Arc'; } catch { this.layout = 'Arc'; }
    if (!PAD_LAYOUTS.includes(this.layout)) this.layout = 'Arc';
    container.innerHTML = '';
    this.buttons = BUTTONS.map((b) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.dataset.act = b.id;
      el.title = b.title;
      el.setAttribute('aria-label', b.label);
      container.appendChild(el);
      const btn = { ...b, el, flash: 0, held: false, rect: null, hidden: false };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        btn.held = true; btn.flash = performance.now();
        this.press(btn.id, true);
      });
      const up = (e) => { if (!btn.held) return; btn.held = false; this.press(btn.id, false); el.releasePointerCapture?.(e.pointerId); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      // keyboard (Enter / Space on a focused button) still works through click
      el.addEventListener('click', (e) => { if (e.detail === 0) { this.press(btn.id, true); this.press(btn.id, false); } });
      return btn;
    });
  }

  setLayout(name) {
    this.layout = PAD_LAYOUTS.includes(name) ? name : 'Arc';
    try { localStorage.setItem('tinycity.pad', this.layout); } catch { /* fine */ }
  }

  press(id, down) {
    const ev = this.input.events, inp = this.input;
    if (id === 'run') { inp.runHeld = down; return; }
    if (id === 'slap') { ev.push({ type: down ? 'chargeStart' : 'chargeEnd', btn: true }); return; }
    if (!down) return;
    if (id === 'use') ev.push({ type: 'primary', btn: true });
    else if (id === 'push') ev.push({ type: 'choose', n: 1, btn: true });
    else if (id === 'talk') ev.push({ type: 'choose', n: 2, btn: true });
    else if (id === 'fart') ev.push({ type: 'choose', n: 3, btn: true });
    else if (id === 'jump') ev.push({ type: 'jump' });
    else if (id === 'peel') ev.push({ type: 'banana' });
  }

  /**
   * Place the buttons for the screen (CSS px). touch: finger-sized buttons.
   * joy: the joystick's rect (or null). riding: only USE and RUN show.
   */
  place(W, H, { touch, joy, riding, safe = { l: 0, r: 0, b: 0 } }) {
    const s = touch ? Math.round(Math.max(52, Math.min(76, Math.min(W, H) * (H > W ? 0.15 : 0.17)))) : 52;
    const S = Math.round(s * 1.25); // the hand is bigger
    const m = touch ? 14 : 18, gap = touch ? 10 : 8;
    const R = W - m - safe.r, B = H - m - safe.b, Lx = m + safe.l;
    const pos = {};
    const at = (id, cx, cy, size = s) => { pos[id] = { x: Math.round(cx - size / 2), y: Math.round(cy - size / 2), s: size }; };
    const hx = R - S / 2, hy = B - S / 2;
    at('use', hx, hy, S);
    const L = this.layout;
    const left = joy ? joy.right + gap : Lx;
    // fill the room above / beside the hand, right to left, row by row (narrow screens)
    const fill = (order) => {
      const slots = [];
      for (let x = hx - S / 2 - gap - s / 2; x - s / 2 >= left; x -= s + gap) slots.push([x, B - s / 2]);
      for (let row = 0; slots.length < order.length && row < 8; row++) {
        const y = B - S - gap - s / 2 - row * (s + gap);
        for (let x = R - s / 2; x - s / 2 >= Math.min(left, R - 2 * s - gap); x -= s + gap) slots.push([x, y]);
      }
      order.forEach((id, i) => at(id, slots[i][0], slots[i][1]));
    };
    const portrait = H > W;
    if (L === 'Arc' && !portrait) {
      // round the hand in the corner: slap / push / talk close, the rest a ring further out
      const r1 = 1.4 * (s + gap) + (S - s) / 2, r2 = r1 + s + gap;
      [['slap', 180], ['push', 225], ['talk', 270]].forEach(([id, a]) => at(id, hx + r1 * Math.cos(a * Math.PI / 180), hy + r1 * Math.sin(a * Math.PI / 180)));
      [['run', 180], ['fart', 210], ['jump', 240], ['peel', 270]].forEach(([id, a]) => at(id, hx + r2 * Math.cos(a * Math.PI / 180), hy + r2 * Math.sin(a * Math.PI / 180)));
    } else if (L === 'Arc') {
      fill(['slap', 'push', 'talk', 'fart', 'jump', 'peel', 'run']);
    } else if (L === 'Grid' && portrait) {
      // two columns above the hand: the people buttons on the right, the rest beside them
      const y0 = B - S - gap - s / 2, step = s + gap;
      ['fart', 'talk', 'push', 'slap'].forEach((id, i) => at(id, R - s / 2, y0 - i * step));
      ['peel', 'jump', 'run'].forEach((id, i) => at(id, R - s * 1.5 - gap, y0 - i * step));
    } else if (L === 'Grid') {
      // two neat rows: the people buttons on top, the rest beside the hand
      const step = s + gap, yTop = B - S - gap - s / 2;
      ['fart', 'talk', 'push', 'slap'].forEach((id, i) => at(id, R - s / 2 - i * step, yTop));
      ['jump', 'peel', 'run'].forEach((id, i) => at(id, hx - S / 2 - gap - s / 2 - i * step, hy));
    } else if (L === 'Split') {
      // moving on the left (above the joystick), acting on the right
      const jt = joy ? joy.top : B - 150, x0 = joy ? Math.max(Lx, joy.left) : Lx;
      ['run', 'jump', 'peel'].forEach((id, i) => at(id, x0 + s / 2 + i * (s + gap), jt - gap - s / 2));
      if (portrait) {
        // a 2 x 2 block right above the hand
        const y0 = B - S - gap - s / 2;
        at('talk', R - s / 2, y0); at('push', R - s * 1.5 - gap, y0);
        at('slap', R - s / 2, y0 - s - gap); at('fart', R - s * 1.5 - gap, y0 - s - gap);
      } else {
        const cx = hx - S / 2 - gap - s / 2, cy = hy;
        at('talk', cx, cy); at('push', cx - s - gap, cy);
        at('slap', cx, cy - s - gap); at('fart', cx - s - gap, cy - s - gap);
      }
    } else {
      // Bar: a strip along the bottom right; on a narrow screen, full rows above the joystick
      const order = ['run', 'jump', 'peel', 'fart', 'talk', 'push', 'slap'];
      if (portrait) {
        const top = Math.min(joy ? joy.top : B, B - S) - gap;
        const perRow = Math.max(1, Math.floor((R - Lx + gap) / (s + gap)));
        order.forEach((id, i) => at(id, R - s / 2 - (i % perRow) * (s + gap), top - s / 2 - Math.floor(i / perRow) * (s + gap)));
      } else {
        const room = hx - S / 2 - gap - left;
        const perRow = Math.max(1, Math.floor((room + gap) / (s + gap)));
        order.forEach((id, i) => at(id, hx - S / 2 - gap - s / 2 - (i % perRow) * (s + gap), B - s / 2 - Math.floor(i / perRow) * (s + gap)));
      }
    }
    for (const b of this.buttons) {
      b.hidden = riding && !RIDING.has(b.id);
      const p = pos[b.id];
      b.rect = b.hidden ? null : p;
      b.el.hidden = b.hidden;
      if (!b.hidden) Object.assign(b.el.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${p.s}px`, height: `${p.s}px` });
    }
  }

  /** Tiles for the pixel layer (CSS px rects), with their state. */
  tiles({ riding, target }) {
    const now = performance.now();
    return this.buttons.filter((b) => b.rect).map((b) => ({
      ...b.rect, id: b.id, key: b.key,
      icon: b.id === 'use' ? (riding ? 'eject' : 'hand') : b.id === 'run' && riding ? 'brake' : b.icon,
      label: b.id === 'use' ? (riding ? 'OFF' : 'USE') : b.id === 'run' && riding ? 'BRAKE' : b.label,
      on: b.held || now - b.flash < 160,
      dim: b.people && !target,
    }));
  }
}
