import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { subjects } from './subjects/index.js';
import { galleryStyles, lightingPresets, styles } from './styles/index.js';
import { Cell } from './viewer/Cell.js';
import { defaultsFor, loadParams, saveParams } from './viewer/params.js';
import { mulberry32 } from './lib/rng.js';
import './style.css';

// ---------------------------------------------------------------------------
// Renderer: one full-screen canvas. Gallery cells are drawn into scissored
// rectangles that track the HTML grid cells above the canvas.
// ---------------------------------------------------------------------------
const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const PAGE_BG = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#1d1f23');

const params = loadParams(subjects);
const state = {
  view: 'gallery', // 'gallery' | 'lineup' | 'crowd' | 'focus'
  crowdSeed: 1,
  focus: null,
  turntable: true,
  speed: 0.35,
  angle: 0,
  lineupStyle: styles[0].id,
  lighting: 'Day',
  street: false, // frame subjects small, as seen from across a street
  characterScale: 1, // >1 exaggerates people and animals so they read when tiny
};
const STREET_HEIGHT = 6; // metres of height in view at street distance
const LINEUP_HEIGHT = 9;

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
for (const style of galleryStyles) {
  grid.append(Object.assign(document.createElement('div'), { className: 'row-head', textContent: style.label }));
  for (const subject of subjects) {
    const cell = new Cell({ entries: [{ subject }], style, renderer });
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
  // a street with every tree preset as a variant, the human and cat in the middle
  const byId = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const treeVariant = (name) => ({ subject: byId.tree, overrides: byId.tree.presets[name] });
  const entries = [
    treeVariant('Old giant'), treeVariant('Oak'),
    { subject: byId.human }, { subject: byId.cat },
    treeVariant('Pine'), treeVariant('Lollipop'),
  ];
  const cell = new Cell({ entries, style, renderer, gap: 1.2, viewDir: [0.18, 0.3, 1], backdrop: 'street' });
  cell.rebuild(params);
  cell.applyLighting(lightingPresets[state.lighting]);
  return cell;
}

// A street full of random characters (plus the cat), to check that outfits
// work together and stay readable in a group.
let crowdCell = null;
function makeCrowd() {
  const style = styles.find((s) => s.id === state.lineupStyle) ?? styles[0];
  const byId = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const rng = mulberry32(state.crowdSeed * 7717 + 3);
  const entries = [];
  for (let i = 0; i < 12; i++) {
    entries.push({
      subject: byId.human,
      overrides: byId.human.randomize(rng),
      z: (rng() - 0.5) * 1.6,
      rotation: (rng() - 0.5) * 1.4,
    });
    if (i === 5) entries.push({ subject: byId.cat, z: 0.6, rotation: 0.5 });
  }
  const cell = new Cell({ entries, style, renderer, gap: 0.25, viewDir: [0.18, 0.3, 1], backdrop: 'street' });
  cell.rebuild(params);
  cell.applyLighting(lightingPresets[state.lighting]);
  return cell;
}
crowdCell = makeCrowd();

galleryCells.forEach((c) => { c.rebuild(params); c.applyLighting(lightingPresets[state.lighting]); });

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
    cell.frame(bigViewWidth() / canvas.clientHeight, focusCam, { minHeight: framingHeight(view) });
    controls.target.copy(cell.viewCenter);
    controls.update();
    // open just the matching subject's panel
    for (const [id, folder] of Object.entries(folders)) {
      if (view === 'lineup' || view === 'crowd' || cell.has(id)) folder.open(); else folder.close();
    }
  }
}

/** Street distance shows a fixed slice of the world instead of hugging the subject. */
function framingHeight(view = state.view) {
  if (view === 'lineup' || view === 'crowd') return LINEUP_HEIGHT;
  return state.street ? STREET_HEIGHT : 0;
}

/** Width of the focus/lineup view: on wide screens, stop short of the open panel. */
function bigViewWidth() {
  const W = canvas.clientWidth;
  if (W < 900 || gui._closed) return W;
  return W - gui.domElement.offsetWidth - 16;
}

function activeCell() {
  if (state.view === 'lineup') return lineupCell;
  if (state.view === 'crowd') return crowdCell;
  return state.focus;
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
  crowd: () => setView('crowd'),
  newCrowd: () => {
    state.crowdSeed += 1;
    crowdCell = makeCrowd();
    setView('crowd');
  },
  screenshot: () => { shotPending = true; },
  copy: () => copySettings(),
  resetAll: () => {
    for (const s of subjects) Object.assign(params[s.id], defaultsFor(s));
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    subjects.forEach((s) => dirty.add(s.id));
  },
};
viewFolder.add(actions, 'gallery').name('Gallery (style × subject)');
viewFolder.add(actions, 'lineup').name('Street scene (real scale)');
viewFolder.add(actions, 'crowd').name('Crowd (random characters)');
viewFolder.add(actions, 'newCrowd').name('New random crowd');
function applyStreet(on) {
  state.street = on;
  for (const cell of galleryCells) {
    cell.setBackdrop(on ? 'street' : null);
    cell.rebuild(params);
  }
  if (state.view === 'focus') setView('focus');
}
viewFolder.add(state, 'street').name('Street distance (tiny)').onChange(applyStreet);
viewFolder.add(state, 'characterScale', 1, 1.6, 0.05).name('Extra character size').onChange((v) => {
  Cell.characterScale = v;
  for (const cell of [...galleryCells, lineupCell, crowdCell]) cell.rebuild(params);
});
viewFolder.add(state, 'lighting', Object.keys(lightingPresets)).name('Lighting').onChange((name) => {
  for (const cell of [...galleryCells, lineupCell, crowdCell]) cell.applyLighting(lightingPresets[name]);
});
if (styles.length > 1) {
  viewFolder.add(state, 'lineupStyle', Object.fromEntries(styles.map((s) => [s.label, s.id])))
    .name('Lineup style')
    .onChange(() => {
      lineupCell = makeLineup();
      crowdCell = makeCrowd();
      if (state.view === 'lineup' || state.view === 'crowd') setView(state.view);
    });
}
viewFolder.add(state, 'turntable').name('Turntable');
viewFolder.add(state, 'speed', 0, 1.5, 0.01).name('Spin speed');
viewFolder.add(actions, 'screenshot').name('Save PNG');
viewFolder.add(actions, 'copy').name('Copy settings (JSON)');
viewFolder.add(actions, 'resetAll').name('Reset everything');

// per-style options (ink line width, PS1 pixel size, ...)
for (const style of styles) {
  if (!style.options) continue;
  const f = viewFolder.addFolder(`Style: ${style.label}`);
  const values = Object.fromEntries(Object.entries(style.options).map(([k, d]) => [k, d.value]));
  for (const [key, def] of Object.entries(style.options)) {
    const ctrl = typeof def.value === 'boolean' ? f.add(values, key) : f.add(values, key, def.min, def.max, def.step);
    ctrl.name(def.label ?? key).onChange((v) => { def.value = v; style.setOption?.(key, v); });
  }
  f.close();
}

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
  if (s.randomize) {
    f.add({ randomize: () => {
      Object.assign(p, s.randomize());
      f.controllersRecursive().forEach((c) => c.updateDisplay());
      dirty.add(s.id);
    } }, 'randomize').name('Randomize');
  }
  const groups = {};
  for (const [key, def] of Object.entries(s.schema)) {
    const target = def.group ? (groups[def.group] ??= f.addFolder(def.group)) : f;
    const ctrl = def.options
      ? target.add(p, key, def.options)
      : target.add(p, key, def.min, def.max, def.step);
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
// Low-resolution rendering for styles with a pixelScale (PS1): render the cell
// into a small target, then draw it back scaled up with hard pixels, reduced
// to 15-bit colour with a 4x4 ordered dither.
// ---------------------------------------------------------------------------
const blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const blitMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null }, size: { value: new THREE.Vector2(1, 1) },
    dither: { value: 1 }, outline: { value: 0 }, near: { value: 0.1 }, far: { value: 100 },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    #include <packing>
    uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 size;
    uniform float dither; uniform float outline; uniform float near; uniform float far;
    varying vec2 vUv;
    float viewDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
    float bayer4(vec2 p) {
      int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
      int i = x + y * 4;
      int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
      return float(m[i]) / 16.0;
    }
    void main() {
      vec4 c = linearToOutputTexel(texture2D(tDiffuse, vUv));
      if (outline > 0.5) {
        // Silhouette test. 1/depth changes linearly across any flat surface,
        // so its second difference is ~0 on floors and walls (even near the
        // horizon) and large where a shape sits in front of something else.
        // Only the nearer pixel is darkened, giving shapes a 1-pixel dark rim.
        vec2 t = 1.0 / size;
        float d = viewDepth(vUv);
        float l = viewDepth(vUv - vec2(t.x, 0.0)), r = viewDepth(vUv + vec2(t.x, 0.0));
        float dn = viewDepth(vUv - vec2(0.0, t.y)), up = viewDepth(vUv + vec2(0.0, t.y));
        float ic = 1.0 / d;
        float lap = abs(1.0 / l + 1.0 / r - 2.0 * ic) + abs(1.0 / dn + 1.0 / up - 2.0 * ic);
        float farthest = max(max(l, r), max(dn, up));
        if (lap > ic * 0.12 && farthest > d * 1.02) c.rgb *= 0.28;
      }
      if (dither > 0.5) {
        vec2 px = floor(vUv * size);
        c.rgb += (bayer4(px) - 0.5) / 31.0;
        c.rgb = floor(clamp(c.rgb, 0.0, 1.0) * 31.0 + 0.5) / 31.0;
      }
      gl_FragColor = c;
    }`,
  depthTest: false,
  depthWrite: false,
});
const blitScene = new THREE.Scene();
blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMat));

/** Render `cell` with `camera` into the canvas rectangle (x, y from bottom-left). */
function renderCell(cell, camera, x, y, w, h) {
  const scale = cell.style.pixelScale;
  if (!scale) {
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.render(cell.scene, camera);
    return;
  }
  const lw = Math.max(1, Math.round(w / scale));
  const lh = Math.max(1, Math.round(h / scale));
  cell.rt ??= new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthTexture: new THREE.DepthTexture(1, 1),
  });
  if (cell.rt.width !== lw || cell.rt.height !== lh) cell.rt.setSize(lw, lh);
  cell.style.prepareRender?.(lw, lh);
  renderer.setRenderTarget(cell.rt);
  renderer.render(cell.scene, camera);
  renderer.setRenderTarget(null);
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  blitMat.uniforms.tDiffuse.value = cell.rt.texture;
  blitMat.uniforms.size.value.set(lw, lh);
  blitMat.uniforms.tDepth.value = cell.rt.depthTexture;
  blitMat.uniforms.dither.value = cell.style.dither === false ? 0 : 1;
  blitMat.uniforms.outline.value = cell.style.outline ? 1 : 0;
  blitMat.uniforms.near.value = camera.near;
  blitMat.uniforms.far.value = camera.far;
  renderer.render(blitScene, blitCam);
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const pr = renderer.getPixelRatio();
  if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
    renderer.setSize(w, h, false);
  }
}

function loop(time) {
  timer.update(time);
  resize();
  processDirty();
  const dt = Math.min(timer.getDelta(), 0.1);
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
      cell.setAngle(state.angle);
      cell.frame(r.width / r.height, cell.camera, { minHeight: framingHeight() });
      renderCell(cell, cell.camera, r.left, H - r.bottom, r.width, r.height);
    }
  } else {
    const cell = activeCell();
    const w = bigViewWidth();
    cell.setAngle(state.angle);
    focusCam.aspect = w / H;
    focusCam.updateProjectionMatrix();
    controls.update();
    renderCell(cell, focusCam, 0, 0, w, H);
  }

  if (shotPending) {
    shotPending = false;
    saveScreenshot();
  }
  requestAnimationFrame(loop);
}

setView('gallery');
requestAnimationFrame(loop);

// handy for debugging from the console
Object.assign(window, {
  __cc: {
    params, state, galleryCells, setView, applyStreet, actions,
    enterFocus: (i) => enterFocus(galleryCells[i]),
    /** Orbit the inspection camera by `az` radians around the subject. */
    orbit: (az) => {
      const cell = activeCell();
      cell.frame(bigViewWidth() / canvas.clientHeight, focusCam, { minHeight: framingHeight() });
      const t = cell.viewCenter;
      focusCam.position.sub(t).applyAxisAngle(new THREE.Vector3(0, 1, 0), az).add(t);
      controls.target.copy(t);
      controls.update();
    },
    apply: (id, values) => { Object.assign(params[id], values); dirty.add(id); },
  },
});
