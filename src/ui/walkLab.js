// The Walk lab: try different ways of walking and running on the main
// character, live in the City. Pick a walk and a run style, then fine-tune
// with sliders; auto-walk shows the character from the side, walking or
// running in a big circle. Settings are kept in this browser (localStorage)
// and can be copied as JSON to hand over.
import { RUN_STYLES, WALK_STYLES } from '../anim/gait.js';

const SLIDERS = [
  ['stride', 'Stride', 0.5, 1.6, 0.05, 'how far the legs reach'],
  ['knee', 'Knee lift', 0.3, 1.8, 0.05, 'how much the knees bend'],
  ['bounce', 'Bounce', 0, 3, 0.1, 'extra up and down'],
  ['arms', 'Arm swing', 0, 2, 0.05, ''],
  ['lean', 'Lean', -1, 2.5, 0.05, 'forward (+) or back (-)'],
  ['sway', 'Hip sway', 0, 3, 0.1, 'hips and shoulders turning'],
  ['cadence', 'Cadence', 0.6, 1.6, 0.05, 'steps per second'],
];
const KEY = 'tinycity.walklab.v1';
const DEFAULT = { walkStyle: 'Natural', runStyle: 'Natural sprint', walk: {}, run: {}, runAt: 2.2, blend: 1.6, fps: 0, auto: 'off', tab: 'walk' };

export class WalkLab {
  constructor({ panel, button, getCity }) {
    this.panel = panel;
    this.getCity = getCity;
    try { this.s = { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { this.s = { ...DEFAULT }; }
    button.onclick = () => { panel.hidden = !panel.hidden; button.classList.toggle('on', !panel.hidden); if (panel.hidden) this.set({ auto: 'off' }); };
    this.render();
    this.apply();
  }
  /** The tune the gait reads: the style's values with the sliders on top. */
  tune() {
    const s = this.s;
    return {
      walk: { ...WALK_STYLES[s.walkStyle], ...s.walk },
      run: { ...RUN_STYLES[s.runStyle], ...s.run },
      runAt: s.runAt, blend: s.blend, fps: s.fps,
    };
  }
  set(patch) {
    Object.assign(this.s, patch);
    try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch { /* private window: fine */ }
    this.apply();
    this.render();
  }
  apply() { const c = this.getCity(); if (c) c.playerTune = this.tune(); }
  get auto() { return this.panel.hidden ? 'off' : this.s.auto; }

  render() {
    const s = this.s, tab = s.tab, cur = tab === 'walk' ? { ...WALK_STYLES[s.walkStyle], ...s.walk } : { ...RUN_STYLES[s.runStyle], ...s.run };
    const chips = (list, sel, name) => Object.keys(list).map((k) => `<button type="button" data-${name}="${k}" class="${k === sel ? 'on' : ''}">${k}</button>`).join('');
    this.panel.innerHTML = `
      <div class="wl-head"><h2>Walk lab</h2><span>WASD + Shift, or the joystick</span></div>
      <h3>Walk style</h3><div class="chips">${chips(WALK_STYLES, s.walkStyle, 'walk')}</div>
      <h3>Run style</h3><div class="chips">${chips(RUN_STYLES, s.runStyle, 'run')}</div>
      <h3>Fine-tune</h3>
      <div class="wl-tabs"><button type="button" data-tab="walk" class="${tab === 'walk' ? 'on' : ''}">Walk</button><button type="button" data-tab="run" class="${tab === 'run' ? 'on' : ''}">Run</button></div>
      ${SLIDERS.map(([k, label, min, max, step, hint]) => {
        const v = cur[k] ?? (k === 'bounce' ? 0 : 1);
        return `<label class="wl-row" for="wl-${k}" title="${hint}"><span>${label}</span><input id="wl-${k}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-k="${k}"><output>${(+v).toFixed(2)}</output></label>`;
      }).join('')}
      <h3>Walk to run</h3>
      <label class="wl-row" for="wl-runAt"><span>Run starts at</span><input id="wl-runAt" type="range" min="1.6" max="4" step="0.1" value="${s.runAt}" data-g="runAt"><output>${s.runAt.toFixed(1)} m/s</output></label>
      <label class="wl-row" for="wl-blend"><span>Blend over</span><input id="wl-blend" type="range" min="0.2" max="2.5" step="0.1" value="${s.blend}" data-g="blend"><output>${s.blend.toFixed(1)} m/s</output></label>
      <h3>Frame rate</h3>
      <div class="chips">${[[0, 'Smooth'], [12, '12 fps'], [8, '8 fps'], [6, '6 fps']].map(([v, l]) => `<button type="button" data-fps="${v}" class="${s.fps === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <h3>Auto-walk (side view)</h3>
      <div class="chips">${[['off', 'Off'], ['walk', 'Walk'], ['run', 'Run']].map(([v, l]) => `<button type="button" data-auto="${v}" class="${s.auto === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="wl-foot"><button type="button" data-act="reset">Reset</button><button type="button" data-act="copy">Copy settings</button></div>`;
    const P = this.panel;
    P.querySelectorAll('[data-walk]').forEach((b) => { b.onclick = () => this.set({ walkStyle: b.dataset.walk, walk: {}, tab: 'walk' }); });
    P.querySelectorAll('[data-run]').forEach((b) => { b.onclick = () => this.set({ runStyle: b.dataset.run, run: {}, tab: 'run' }); });
    P.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => this.set({ tab: b.dataset.tab }); });
    P.querySelectorAll('[data-fps]').forEach((b) => { b.onclick = () => this.set({ fps: +b.dataset.fps }); });
    P.querySelectorAll('[data-auto]').forEach((b) => { b.onclick = () => this.set({ auto: b.dataset.auto }); });
    P.querySelectorAll('input[data-k]').forEach((inp) => {
      inp.oninput = () => {
        const set = { ...(tab === 'walk' ? s.walk : s.run), [inp.dataset.k]: +inp.value };
        Object.assign(s, tab === 'walk' ? { walk: set } : { run: set });
        inp.nextElementSibling.textContent = (+inp.value).toFixed(2);
        try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* fine */ }
        this.apply();
      };
    });
    P.querySelectorAll('input[data-g]').forEach((inp) => {
      inp.oninput = () => { s[inp.dataset.g] = +inp.value; inp.nextElementSibling.textContent = `${(+inp.value).toFixed(1)} m/s`; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* fine */ } this.apply(); };
    });
    P.querySelector('[data-act=reset]').onclick = () => this.set({ ...DEFAULT, tab: s.tab, auto: s.auto });
    P.querySelector('[data-act=copy]').onclick = async (e) => {
      const text = JSON.stringify({ walkStyle: s.walkStyle, runStyle: s.runStyle, ...this.tune() });
      try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied'; } catch { window.prompt?.('Settings', text); e.target.textContent = 'Copy failed'; }
      setTimeout(() => { e.target.textContent = 'Copy settings'; }, 1600);
    };
  }

  /** Auto-walk: an input that walks (or runs) in a big circle, and a side-on camera. */
  input(real, city, dt) {
    const mode = this.auto;
    if (mode === 'off' || !city) { this.yaw = null; return real; }
    const p = city.player;
    this.yaw ??= p.heading;
    this.yaw += (mode === 'run' ? 0.22 : 0.3) * dt; // a slow, wide circle
    city.cam.yaw = this.yaw - Math.PI / 2;            // the camera looks at them from the side
    city.cam.pitch = 0.12;
    // the stick that moves them along this.yaw, given that moves are relative to the camera
    const y = city.cam.yaw, d = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    const fwd = { x: -Math.sin(y), z: -Math.cos(y) }, right = { x: -fwd.z, z: fwd.x };
    const ax = d.x * right.x + d.z * right.z, az = -(d.x * fwd.x + d.z * fwd.z);
    return { takeEvents: () => real.takeEvents(), takeLook: () => { real.takeLook(); return { yaw: 0, pitch: 0, zoom: 0 }; }, axes: () => ({ x: ax, z: az, run: mode === 'run', handbrake: false }) };
  }
}
