import {
  ACESFilmicToneMapping,
  CircleGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ANIMATIONS, createCharacter, panelSections } from './body/index.js';

const query = new URLSearchParams(location.search);
const canvas = document.getElementById('view');
const statsEl = document.getElementById('stats');
const sectionsRoot = document.getElementById('sections');
const documentBox = document.getElementById('document');
const documentError = document.getElementById('document-error');

for (const section of panelSections()) {
  const details = document.createElement('details');
  details.className = 'panel-section';
  details.open = true;
  details.dataset.section = section.id;
  const summary = document.createElement('summary');
  summary.textContent = section.label;
  details.append(summary);
  const stack = document.createElement('div');
  stack.className = 'sliders';
  for (const control of section.controls) stack.append(renderControl(control));
  details.append(stack);
  sectionsRoot.append(details);
}

const animSelect = document.getElementById('anim');
const speedInput = document.getElementById('speed');
const speedLabel = document.getElementById('speed-label');
const speedVal = document.getElementById('speed-val');
const wireInput = document.getElementById('wire');
const turnInput = document.getElementById('turn');

function renderControl(control) {
  if (control.kind === 'select') {
    const label = document.createElement('label');
    label.className = 'field';
    const span = document.createElement('span');
    span.textContent = control.label;
    const select = document.createElement('select');
    select.id = control.id;
    select.setAttribute('aria-label', control.label);
    label.append(span, select);
    return label;
  }
  if (control.kind === 'check') {
    const label = document.createElement('label');
    label.className = 'check';
    const input = document.createElement('input');
    input.id = control.id;
    input.type = 'checkbox';
    input.checked = Boolean(control.checked);
    label.append(input, document.createTextNode(control.label));
    return label;
  }
  const label = document.createElement('label');
  label.className = control.kind === 'color' ? 'slider skin' : 'slider';
  const row = document.createElement('span');
  row.className = 'row';
  const name = document.createElement('span');
  if (control.id === 'speed') name.id = 'speed-label';
  name.textContent = control.label;
  row.append(name);
  if (control.kind === 'range') {
    const output = document.createElement('output');
    output.id = control.id === 'speed' ? 'speed-val' : `${control.id}-val`;
    row.append(output);
  }
  const input = document.createElement('input');
  input.id = control.id;
  if (control.kind === 'color') {
    input.type = 'color';
  } else {
    input.type = 'range';
    input.min = String(control.min);
    input.max = String(control.max);
    input.step = String(control.step);
  }
  label.append(row, input);
  return label;
}

const byId = Object.fromEntries(ANIMATIONS.map((item) => [item.id, item]));
const groups = [];
for (const item of ANIMATIONS) {
  let group = groups.find((entry) => entry.label === item.group);
  if (!group) {
    group = document.createElement('optgroup');
    group.label = item.group;
    animSelect.append(group);
    groups.push(group);
  }
  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = item.label;
  group.append(option);
}

const scene = new Scene();
scene.background = new Color('#e4dfd6');

const camera = new PerspectiveCamera(32, 1, 0.05, 40);
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const hemi = new HemisphereLight(0xf4efe6, 0xb7a898, 0.72);
scene.add(hemi);

const key = new DirectionalLight(0xfff6ee, 2.35);
key.position.set(2.4, 4.2, 2.6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.00035;
key.shadow.normalBias = 0.025;
key.shadow.camera.near = 0.4;
key.shadow.camera.far = 14;
key.shadow.camera.left = -2.2;
key.shadow.camera.right = 2.2;
key.shadow.camera.top = 2.4;
key.shadow.camera.bottom = -1.4;
scene.add(key);
scene.add(key.target);

const fill = new DirectionalLight(0xe7eef8, 0.55);
fill.position.set(-2.6, 1.6, 1.4);
scene.add(fill);

const rim = new DirectionalLight(0xfff8f2, 0.45);
rim.position.set(-1.2, 2.4, -2.6);
scene.add(rim);

const ground = new Mesh(
  new CircleGeometry(1, 64),
  new MeshStandardMaterial({ color: '#b7b0a4', roughness: 1, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.001;
ground.receiveShadow = true;
scene.add(ground);

const body = createCharacter();
scene.add(body.root);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotate = query.get('turn') !== '0';
controls.autoRotateSpeed = 0.7;
controls.target.set(0, 0.9, 0);

let anim = query.get('mode') || query.get('anim') || 'idle';
if (!byId[anim]) anim = 'idle';
let speed = byId[anim].speed;
let freezeTime = query.has('freeze') ? Number(query.get('freeze')) : null;
let currentCam = query.get('cam') || 'three';
let framedByUser = false;

if (query.get('panel') === '0') document.body.classList.add('no-panel');
wireInput.checked = query.get('wire') === '1';
turnInput.checked = controls.autoRotate;

function applyWireframe(on) {
  for (const material of body.materials) {
    material.wireframe = on;
    material.needsUpdate = true;
  }
  body.root.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = !on;
  });
}

applyWireframe(wireInput.checked);

function frameCamera(name) {
  const h = body.getResolved().height;
  const lookY = h * 0.5;
  const dist = h * 2.45;
  const spots = {
    front: new Vector3(0, lookY, dist),
    side: new Vector3(dist, lookY, 0),
    three: new Vector3(dist * 0.62, lookY + h * 0.06, dist * 0.78),
  };
  camera.position.copy(spots[name] || spots.three);
  controls.target.set(0, lookY, 0);
  key.target.position.set(0, lookY, 0);
  controls.update();
}

function resizeGround() {
  const spec = body.getResolved();
  const radius = Math.max(0.95, spec.footLength * 2.5, spec.shoulderWidth * 1.35);
  ground.scale.setScalar(radius);
}

function fmt(n) {
  return n.toFixed(2);
}

function syncControls() {
  const spec = body.getResolved();
  const stats = body.getStats();
  statsEl.textContent = `${stats.vertices} verts · ${stats.triangles} tris`;
  const height = document.getElementById('height');
  const shoulder = document.getElementById('shoulder');
  const hip = document.getElementById('hip');
  const thick = document.getElementById('thick');
  height.value = String(spec.height);
  shoulder.value = String(spec.shoulderWidth);
  hip.value = String(spec.hipWidth);
  thick.value = String(spec.limbThickness);
  document.getElementById('height-val').textContent = `${fmt(spec.height)} m`;
  document.getElementById('shoulder-val').textContent = `${fmt(spec.shoulderWidth)} m`;
  document.getElementById('hip-val').textContent = `${fmt(spec.hipWidth)} m`;
  document.getElementById('thick-val').textContent = fmt(spec.limbThickness);
  document.getElementById('skin').value = spec.skinColor;
  if (document.activeElement !== documentBox) {
    documentBox.value = JSON.stringify(body.getDocument(), null, 2);
  }
  animSelect.value = anim;
  const info = byId[anim];
  const rate = info.unit === '×';
  speedLabel.textContent = rate ? 'Playback' : 'Speed';
  speedInput.min = rate ? '0' : '0';
  speedInput.max = rate ? '2' : '8';
  speedInput.step = rate ? '0.05' : '0.05';
  speedInput.disabled = info.kind === 'pose';
  speedInput.value = String(speed);
  speedVal.textContent = rate ? `${Number(speed).toFixed(2)}×` : `${Number(speed).toFixed(1)} m/s`;
  resizeGround();
  applyWireframe(wireInput.checked);
  if (!framedByUser) {
    controls.target.y = spec.height * 0.5;
    key.target.position.y = spec.height * 0.5;
  }
}

function setAnim(next) {
  anim = byId[next] ? next : 'idle';
  speed = byId[anim].speed;
  freezeTime = null;
  syncControls();
}

animSelect.addEventListener('change', () => setAnim(animSelect.value));

speedInput.addEventListener('input', () => {
  speed = Number(speedInput.value);
  const info = byId[anim];
  speedVal.textContent = info.unit === '×'
    ? `${speed.toFixed(2)}×`
    : `${speed.toFixed(1)} m/s`;
});

wireInput.addEventListener('change', () => {
  applyWireframe(wireInput.checked);
});

turnInput.addEventListener('change', () => {
  controls.autoRotate = turnInput.checked;
});

controls.addEventListener('start', () => {
  framedByUser = true;
  controls.autoRotate = false;
  turnInput.checked = false;
});

document.getElementById('height').addEventListener('input', (event) => {
  const next = Number(event.target.value);
  const prev = body.getResolved();
  const k = next / prev.height;
  body.setParams({
    height: next,
    shoulderWidth: prev.shoulderWidth * k,
    hipWidth: prev.hipWidth * k,
    headSize: prev.headRadius * k,
  });
  syncControls();
});

document.getElementById('shoulder').addEventListener('input', (event) => {
  body.setParams({ shoulderWidth: Number(event.target.value) });
  syncControls();
});

document.getElementById('hip').addEventListener('input', (event) => {
  body.setParams({ hipWidth: Number(event.target.value) });
  syncControls();
});

document.getElementById('thick').addEventListener('input', (event) => {
  body.setParams({ limbThickness: Number(event.target.value) });
  syncControls();
});

document.getElementById('skin').addEventListener('input', (event) => {
  body.setParams({ skinColor: event.target.value });
  syncControls();
});

function showDocumentError(message) {
  documentError.hidden = !message;
  documentError.textContent = message || '';
}

document.getElementById('copy-json').addEventListener('click', () => {
  const text = JSON.stringify(body.getDocument(), null, 2);
  documentBox.value = text;
  showDocumentError('');
  navigator.clipboard?.writeText(text).catch(() => {});
});

document.getElementById('paste-json').addEventListener('click', () => {
  let parsed;
  try {
    parsed = JSON.parse(documentBox.value);
  } catch {
    showDocumentError('That text is not JSON.');
    return;
  }
  try {
    body.setDocument(parsed);
    showDocumentError('');
    syncControls();
  } catch (error) {
    showDocumentError(error.errors?.join('\n') || error.message);
  }
});

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const observer = new ResizeObserver(resize);
observer.observe(canvas);

frameCamera(currentCam);
syncControls();
resize();

let last = performance.now();
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (freezeTime != null) body.update(0, { anim, speed, time: freezeTime, freeze: true });
  else body.update(dt, { anim, speed });
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
