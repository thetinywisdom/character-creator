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
import { createBody } from './body/index.js';

const query = new URLSearchParams(location.search);
const canvas = document.getElementById('view');
const statsEl = document.getElementById('stats');
const buttons = [...document.querySelectorAll('.modes button')];
const wireInput = document.getElementById('wire');
const turnInput = document.getElementById('turn');

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

const body = createBody();
scene.add(body.root);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotate = query.get('turn') !== '0';
controls.autoRotateSpeed = 0.7;
controls.target.set(0, 0.9, 0);

let mode = query.get('mode') || 'idle';
if (!['idle', 'walk', 'pose'].includes(mode)) mode = 'idle';
let freezeTime = query.has('freeze') ? Number(query.get('freeze')) : null;
let currentCam = query.get('cam') || 'three';
let framedByUser = false;

if (query.get('panel') === '0') document.body.classList.add('no-panel');
wireInput.checked = query.get('wire') === '1';
turnInput.checked = controls.autoRotate;

function applyWireframe(on) {
  body.material.wireframe = on;
  body.material.needsUpdate = true;
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
  for (const button of buttons) {
    button.classList.toggle('active', button.dataset.mode === mode);
  }
  resizeGround();
  applyWireframe(wireInput.checked);
  if (!framedByUser) {
    controls.target.y = spec.height * 0.5;
    key.target.position.y = spec.height * 0.5;
  }
}

function setMode(next) {
  mode = next;
  freezeTime = null;
  syncControls();
}

for (const button of buttons) {
  button.addEventListener('click', () => setMode(button.dataset.mode));
}

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
  if (freezeTime != null) body.update(0, { mode, time: freezeTime, freeze: true });
  else body.update(dt, mode);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
