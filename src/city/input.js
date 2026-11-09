// Input for walking around the city: keyboard (WASD / arrows, Shift to run),
// mouse or touch drag to turn the camera, mouse wheel / pinch-free zoom
// buttons, and an on-screen joystick for touch screens.

export class CityInput {
  constructor(canvas, joystickEl) {
    this.keys = new Set();
    this.move = { x: 0, z: 0 };   // joystick, -1..1
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.zoomDelta = 0;
    this.active = false;
    this.canvas = canvas;
    this.joy = joystickEl;
    this.knob = joystickEl.querySelector('.knob');
    this.events = []; // interaction events for interact.js (see takeEvents)
    // E menu / ride; 1 slap (hold to charge), 2 push, 3 talk, 4 fart (also in the open menu)
    const KEYS = { KeyE: 'primary', Digit1: 'chargeStart', Numpad1: 'chargeStart', KeyB: 'banana', Escape: 'close', Space: 'jump' };

    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      if (KEYS[e.code]) this.events.push({ type: KEYS[e.code] });
      const n = ['Digit2', 'Digit3', 'Digit4'].indexOf(e.code) + 1 || ['Numpad2', 'Numpad3', 'Numpad4'].indexOf(e.code) + 1;
      if (n > 0) this.events.push({ type: 'choose', n });
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if ((e.code === 'Digit1' || e.code === 'Numpad1') && this.active) this.events.push({ type: 'chargeEnd' }); // release the slap
    });
    window.addEventListener('blur', () => this.keys.clear());

    // drag to look; two fingers pinch to zoom
    let drag = null;
    const touches = new Map();
    let pinch = null;
    // clicks and taps: click, hold (0.45 s), double click, right click. A press
    // that moves more than a few pixels is a camera drag instead.
    let press = null, clickTimer = null, lastClick = 0;
    canvas.addEventListener('contextmenu', (e) => { if (this.active) e.preventDefault(); });
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.active || e.target !== canvas) return;
      if (press?.timer) clearTimeout(press.timer);
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, button: e.button, moved: false, fired: false };
      if (e.button === 2) this.rmb = true; // held right button = handbrake while driving
      // holding still starts charging a slap (released on pointerup)
      if (e.button === 0) press.timer = setTimeout(() => { if (press && !press.moved) { press.fired = true; press.charging = true; this.events.push({ type: 'chargeStart', x: press.x, y: press.y }); } }, 300);
    });
    // where the mouse is (not fingers): the City highlights who is under it
    canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') this.hover = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerleave', () => { this.hover = null; });
    canvas.addEventListener('pointermove', (e) => {
      if (press && !press.charging && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) { press.moved = true; clearTimeout(press.timer); }
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button === 2) this.rmb = false;
      if (!press || e.pointerId !== press.id) return;
      clearTimeout(press.timer);
      const pr = press;
      press = null;
      if (pr.charging) { this.events.push({ type: 'chargeEnd' }); return; }
      if (pr.moved || pr.fired || touches.size > 1) return;
      if (pr.button === 2) { this.events.push({ type: 'right', x: pr.x, y: pr.y }); return; }
      if (pr.button !== 0) return;
      const now = performance.now();
      if (clickTimer && now - lastClick < 300) { clearTimeout(clickTimer); clickTimer = null; this.events.push({ type: 'double', x: pr.x, y: pr.y }); return; }
      lastClick = now;
      clickTimer = setTimeout(() => { clickTimer = null; this.events.push({ type: 'click', x: pr.x, y: pr.y }); }, 260);
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.active || e.target !== canvas) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      if (touches.size === 2) { drag = null; pinch = null; if (press) { clearTimeout(press.timer); press.moved = true; } return; }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoomDelta += (pinch - dist) * 0.02;
        pinch = dist;
        return;
      }
      if (!drag || e.pointerId !== drag.id) return;
      this.yawDelta -= (e.clientX - drag.x) * 0.006;
      this.pitchDelta += (e.clientY - drag.y) * 0.004;
      drag.x = e.clientX; drag.y = e.clientY;
    });
    const end = (e) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
      if (drag && e.pointerId === drag.id) drag = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => { if (this.active) { this.zoomDelta += Math.sign(e.deltaY); e.preventDefault(); } }, { passive: false });

    // joystick
    let jid = null;
    const setKnob = (e) => {
      const r = this.joy.getBoundingClientRect();
      let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this.move.x = dx; this.move.z = dy;
      this.knob.style.transform = `translate(${dx * 32}px, ${dy * 32}px)`;
    };
    this.joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; this.joy.setPointerCapture(jid); setKnob(e); e.preventDefault(); });
    this.joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setKnob(e); });
    const release = (e) => {
      if (e.pointerId !== jid) return;
      jid = null; this.move.x = 0; this.move.z = 0;
      this.knob.style.transform = '';
    };
    this.joy.addEventListener('pointerup', release);
    this.joy.addEventListener('pointercancel', release);
  }

  /** Movement intent in camera space: x = right, z = back (forward is -z). */
  axes() {
    const k = this.keys;
    let x = this.move.x, z = this.move.z;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) z -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) z += 1;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    const shift = k.has('ShiftLeft') || k.has('ShiftRight');
    // Shift runs on foot; Shift or a held right button is the handbrake in a vehicle
    return { x, z, run: shift, handbrake: shift || !!this.rmb };
  }

  /** Interaction events since the last call (keys, clicks, taps, UI buttons). */
  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  takeLook() {
    const d = { yaw: this.yawDelta, pitch: this.pitchDelta, zoom: this.zoomDelta };
    this.yawDelta = this.pitchDelta = this.zoomDelta = 0;
    return d;
  }
}
