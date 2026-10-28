import * as THREE from 'three';
import { createCharacter, randomize, defaults, getParts } from './index.js';
import { PixelPipeline, rampUniforms } from './style/pixel.js';

const stage = document.querySelector('#stage');
const panel = document.querySelector('#panel');
const who = document.querySelector('#who');

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#EFFAFA');
scene.add(new THREE.HemisphereLight('#ffffff', '#d5dbe0', 2.6));
const sun = new THREE.DirectionalLight('#ffffff', 1.1);
sun.position.set(4, 8, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0015;
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
scene.add(sun, sun.target);

const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(0.95, 0.95, 0.12, 24),
  new THREE.MeshStandardMaterial({ color: '#A8ECF2' }),
);
ground.position.y = -0.06;
ground.receiveShadow = true;
scene.add(ground);

const rig = new THREE.Group();
scene.add(rig);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
const offset = new THREE.Vector3(10, 10, 10);
const target = new THREE.Vector3(0, 1.05, 0);
const VIEW = 2.7;

rampUniforms.uSunI.value = 1.1;
const pixel = new PixelPipeline(renderer, { outlines: false });

let toon = true;
let spin = true;
let speed = 0;
let yaw = Math.PI / 5;
let character = null;

function resize() {
  const w = stage.clientWidth || 1;
  const h = stage.clientHeight || 1;
  renderer.setSize(w, h, false);
  pixel.setSize(w, h);
  const aspect = w / h;
  camera.left = -VIEW * aspect / 2;
  camera.right = VIEW * aspect / 2;
  camera.top = VIEW / 2;
  camera.bottom = -VIEW / 2;
  camera.position.copy(target).add(offset);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

function applyLook() {
  pixel.toonify(scene, toon);
  pixel.quantize = toon;
}

function describe(def) {
  const bits = [
    def.name,
    def.body.base,
    def.body.type,
    def.head.hair.style,
    def.head.headwear.style !== 'none' ? def.head.headwear.style : null,
    def.clothing.top.style,
    def.clothing.bottom.style,
    def.clothing.shoes.style,
    def.hands.left.item !== 'none' ? `holding ${def.hands.left.item}` : null,
  ].filter(Boolean);
  who.textContent = bits.join(' · ');
}

function show(def) {
  if (character) {
    character.setDef(def);
  } else {
    character = createCharacter(def);
    rig.add(character.root);
  }
  applyLook();
  describe(character.def);
}

function button(text, { pressed = false, primary = false, onClick } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  if (primary) b.className = 'primary';
  b.setAttribute('aria-pressed', String(pressed));
  b.addEventListener('click', onClick);
  return b;
}

function block(title, ...nodes) {
  const el = document.createElement('section');
  el.className = 'block';
  const h = document.createElement('h2');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'row';
  for (const n of nodes) row.append(n);
  el.append(h, row);
  return el;
}

const loco = [
  ['Idle', 0],
  ['Walk', 1.4],
  ['Run', 6.2],
];
function clearDances() {
  for (const b of dances) b.setAttribute('aria-pressed', 'false');
}

const locoButtons = loco.map(([text, value], i) => button(text, {
  pressed: i === 0,
  onClick() {
    speed = value;
    if (character?.dancing) character.stopDance();
    clearDances();
    for (const b of locoButtons) b.setAttribute('aria-pressed', String(b === this));
  },
}));

const dances = getParts('animation.dance').map((part) => button(part.label || part.id, {
  onClick() {
    character.dance(part.id);
    for (const b of dances) b.setAttribute('aria-pressed', String(b === this));
  },
}));

const spinBtn = button('Turntable', {
  pressed: true,
  onClick() {
    spin = !spin;
    spinBtn.setAttribute('aria-pressed', String(spin));
  },
});

const toonInput = document.createElement('input');
toonInput.type = 'checkbox';
toonInput.checked = true;
toonInput.addEventListener('change', () => {
  toon = toonInput.checked;
  applyLook();
});
const toonLabel = document.createElement('label');
toonLabel.className = 'switch';
toonLabel.append(toonInput, document.createTextNode('Toon style'));

panel.append(
  block('Character', button('Randomize', {
    primary: true,
    onClick() {
      clearDances();
      show(randomize(Math.floor(Math.random() * 1e9)));
    },
  }), spinBtn),
  toonLabel,
  block('Move', ...locoButtons),
  block('Dance', ...dances, button('Stop', {
    onClick() {
      character.stopDance();
      for (const b of dances) b.setAttribute('aria-pressed', 'false');
    },
  })),
);

show(defaults('man'));
resize();

const clock = new THREE.Clock();
let wasDancing = false;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (character) {
    if (spin && !character.dancing) yaw += dt * 0.7;
    character.root.rotation.y = yaw;
    character.update(dt, { speed: character.dancing ? 0 : speed, grounded: true });
    const dancing = character.dancing;
    if (wasDancing && !dancing) clearDances();
    wasDancing = dancing;
  }
  if (toon) pixel.render(scene, camera);
  else renderer.render(scene, camera);
});
