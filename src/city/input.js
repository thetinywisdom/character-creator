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

    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // drag to look; two fingers pinch to zoom
    let drag = null;
    const touches = new Map();
    let pinch = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.active || e.target !== canvas) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      if (touches.size === 2) { drag = null; pinch = null; return; }
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
    return { x, z, run: k.has('ShiftLeft') || k.has('ShiftRight') };
  }

  takeLook() {
    const d = { yaw: this.yawDelta, pitch: this.pitchDelta, zoom: this.zoomDelta };
    this.yawDelta = this.pitchDelta = this.zoomDelta = 0;
    return d;
  }
}
