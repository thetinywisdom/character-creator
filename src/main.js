import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { subjects } from './subjects/index.js';
import { styles } from './styles/index.js';
import { Cell } from './viewer/Cell.js';
import { defaultsFor, loadParams, saveParams } from './viewer/params.js';
import './style.css';

// ---------------------------------------------------------------------------
// Renderer: one full-screen canvas. Gallery cells are drawn into scissored
// rectangles that track the HTML grid cells above the canvas.
// ---------------------------------------------------------------------------
const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const PAGE_BG = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#1d1f23');

const params = loadParams(subjects);
const state = {
  view: 'gallery', // 'gallery' | 'lineup' | 'focus'
  focus: null,
  turntable: true,
  speed: 0.35,
  angle: 0,
  lineupStyle: styles[0].id,
};

// ---------------------------------------------------------------------------
// Gallery grid: columns = subjects, rows = styles
// ---------------------------------------------------------------------------
const grid = document.querySelector('#grid');
grid.style.setProperty('--cols', subjects.length);
grid.append(Object.assign(document.createElement('div'), { className: 'corner' }));
for (const s of subjects) {
  grid.append(Object.assign(document.createElement('div'), { className: 'col-head', textContent: s.label }));
}

const galleryCells = [];
for (const style of styles) {
  grid.append(Object.assign(document.createElement('div'), { className: 'row-head', textContent: style.label }));
  for (const subject of subjects) {
    const cell = new Cell({ subjects: [subject], style });
    cell.el = Object.assign(document.createElement('div'), { className: 'cell', title: `${subject.label} · ${style.label}` });
    cell.el.dataset.label = `${subject.label} · ${style.label}`;
    cell.el.addEventListener('click', () => enterFocus(cell));
    grid.append(cell.el);
    galleryCells.push(cell);
  }
}

let lineupCell = makeLineup();
function makeLineup() {
  const style = styles.find((s) => s.id === state.lineupStyle) ?? styles[0];
  // tree, human, cat: the human in the middle as the scale reference
  const order = ['tree', 'human', 'cat'].map((id) => subjects.find((s) => s.id === id)).filter(Boolean);
  const cell = new Cell({ subjects: order, style, gap: 0.3 });
  cell.rebuild(params);
  return cell;
}

galleryCells.forEach((c) => c.rebuild(params));

// ---------------------------------------------------------------------------
// Focus / lineup: one big orbitable view
// ---------------------------------------------------------------------------
const focusCam = new THREE.PerspectiveCamera(30, 1, 0.01, 500);
const controls = new OrbitControls(focusCam, canvas);
controls.enableDamping = true;
controls.enabled = false;

const backBtn = document.querySelector('#back');
const hint = document.querySelector('#hint');
backBtn.addEventListener('click', () => setView('gallery'));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.view !== 'gallery') setView('gallery');
});

function enterFocus(cell) {
  state.focus = cell;
  setView('focus');
}

function setView(view) {
  state.view = view;
  const big = view !== 'gallery';
  grid.hidden = big;
  backBtn.hidden = !big;
  controls.enabled = big;
  hint.textContent = big
    ? 'Drag to orbit · scroll to zoom · Esc to go back'
    : 'Click a cell to inspect it up close';
  if (big) {
    const cell = activeCell();
    cell.frame(canvas.clientWidth / canvas.clientHeight, focusCam);
    controls.target.copy(cell.center);
    controls.update();
    // open just the matching subject's panel
    for (const [id, folder] of Object.entries(folders)) {
      if (view === 'lineup' || cell.has(id)) folder.open(); else folder.close();
    }
  }
}

function activeCell() {
  return state.view === 'lineup' ? lineupCell : state.focus;
}

// ---------------------------------------------------------------------------
// Controls panel
// ---------------------------------------------------------------------------
const dirty = new Set();
const gui = new GUI({ title: 'Controls' });
if (window.innerWidth < 700) gui.close();

const viewFolder = gui.addFolder('View');
const actions = {
  gallery: () => setView('gallery'),
  lineup: () => setView('lineup'),
  screenshot: () => { shotPending = true; },
  copy: () => copySettings(),
  resetAll: () => {
    for (const s of subjects) Object.assign(params[s.id], defaultsFor(s));
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    subjects.forEach((s) => dirty.add(s.id));
  },
};
viewFolder.add(actions, 'gallery').name('Gallery (style × subject)');
viewFolder.add(actions, 'lineup').name('Lineup (real scale)');
if (styles.length > 1) {
  viewFolder.add(state, 'lineupStyle', Object.fromEntries(styles.map((s) => [s.label, s.id])))
    .name('Lineup style')
    .onChange(() => { lineupCell = makeLineup(); if (state.view === 'lineup') setView('lineup'); });
}
viewFolder.add(state, 'turntable').name('Turntable');
viewFolder.add(state, 'speed', 0, 1.5, 0.01).name('Spin speed');
viewFolder.add(actions, 'screenshot').name('Save PNG');
viewFolder.add(actions, 'copy').name('Copy settings (JSON)');
viewFolder.add(actions, 'resetAll').name('Reset everything');

const folders = {};
for (const s of subjects) {
  const f = gui.addFolder(s.label);
  folders[s.id] = f;
  const p = params[s.id];
  const presetState = { preset: '—' };
  if (s.presets) {
    f.add(presetState, 'preset', ['—', ...Object.keys(s.presets)]).name('Preset').onChange((name) => {
      if (name === '—') return;
      Object.assign(p, s.presets[name]);
      f.controllersRecursive().forEach((c) => c.updateDisplay());
      dirty.add(s.id);
    });
  }
  for (const [key, def] of Object.entries(s.schema)) {
    const ctrl = def.options
      ? f.add(p, key, def.options)
      : f.add(p, key, def.min, def.max, def.step);
    ctrl.name(def.label ?? key).onChange(() => dirty.add(s.id));
  }
  f.add({ reset: () => {
    Object.assign(p, defaultsFor(s));
    f.controllersRecursive().forEach((c) => c.updateDisplay());
    dirty.add(s.id);
  } }, 'reset').name('Reset');
  f.close();
}

function processDirty() {
  if (!dirty.size) return;
  for (const cell of [...galleryCells, lineupCell]) {
    if ([...dirty].some((id) => cell.has(id))) cell.rebuild(params);
  }
  dirty.clear();
  saveParams(params);
}

// ---------------------------------------------------------------------------
// Toast, clipboard, screenshot
// ---------------------------------------------------------------------------
const toastEl = document.querySelector('#toast');
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

async function copySettings() {
  const json = JSON.stringify(params, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    toast('Settings copied – paste them into the chat to share');
  } catch {
    console.log(json);
    toast('Clipboard blocked – settings printed to the browser console');
  }
}

let shotPending = false;
function saveScreenshot() {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `character-creator-${state.view}-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const pr = renderer.getPixelRatio();
  if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
    renderer.setSize(w, h, false);
  }
}

function loop() {
  resize();
  processDirty();
  const dt = Math.min(clock.getDelta(), 0.1);
  if (state.turntable) state.angle += dt * state.speed;

  const W = canvas.clientWidth, H = canvas.clientHeight;
  renderer.setScissorTest(false);
  renderer.setClearColor(PAGE_BG);
  renderer.clear();
  renderer.setScissorTest(true);

  if (state.view === 'gallery') {
    for (const cell of galleryCells) {
      const r = cell.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W || r.width < 2 || r.height < 2) continue;
      const bottom = H - r.bottom;
      renderer.setViewport(r.left, bottom, r.width, r.height);
      renderer.setScissor(r.left, bottom, r.width, r.height);
      cell.setAngle(state.angle);
      cell.frame(r.width / r.height);
      renderer.render(cell.scene, cell.camera);
    }
  } else {
    const cell = activeCell();
    renderer.setViewport(0, 0, W, H);
    renderer.setScissor(0, 0, W, H);
    cell.setAngle(state.angle);
    focusCam.aspect = W / H;
    focusCam.updateProjectionMatrix();
    controls.update();
    renderer.render(cell.scene, focusCam);
  }

  if (shotPending) {
    shotPending = false;
    saveScreenshot();
  }
  requestAnimationFrame(loop);
}

setView('gallery');
loop();

// handy for debugging from the console
Object.assign(window, {
  __cc: {
    params, state, galleryCells, setView,
    enterFocus: (i) => enterFocus(galleryCells[i]),
    apply: (id, values) => { Object.assign(params[id], values); dirty.add(id); },
  },
});
