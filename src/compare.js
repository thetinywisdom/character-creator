import * as THREE from 'three';
import { human } from './subjects/human.js';
import { style } from './styles/index.js';
import { createPs1Renderer } from './render/ps1.js';
import { defaultsFor } from './viewer/params.js';
import { createGait, poseGait, stepGait, tuneOf, RUN_SPEED, WALK_SPEED } from './anim/gait.js';
import { mulberry32 } from './lib/rng.js';
import './compare.css';

// Old vs new human, side by side (step 1 of the iso-city port, see PLAN.md).
// Each cell: the same settings built by the current builder (left) and by the
// iso-city style builder (right), in the game's PS1 look, walking in place.

const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true }); // stencil: the iso-view silhouettes in the Default look (no render target)
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
const ps1 = createPs1Renderer(renderer);

// the looks: each body type's default, then a few townspeople
const looks = ['Man', 'Woman', 'Boy', 'Girl', 'Grandpa', 'Grandma'].map((t) => ({ name: t, p: { ...defaultsFor(human), ...human.presets[t] } }));
const rng = mulberry32(7);
for (let i = 0; i < 4; i++) looks.push({ name: `Townsperson ${i + 1}`, p: { ...defaultsFor(human), ...human.randomize(rng) } });

const cells = looks.map(({ name, p }) => {
  human.applyRules?.(p);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(style.background);
  const lights = style.createLights({ renderer });
  scene.add(...lights.objects);
  lights.key.position.set(3, 6, 4);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24).rotateX(-Math.PI / 2), style.material('sidewalk', 0xd8cdb4));
  ground.receiveShadow = true;
  scene.add(ground);
  const tune = tuneOf(p);
  const people = [human.build(p, style, { characterStyle: 'Classic' }), human.build(p, style, { characterStyle: 'iso-city' })].map((body, i) => {
    const root = new THREE.Group();
    root.add(body);
    root.position.x = i ? 0.5 : -0.5;
    body.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(root);
    return { root, body, gait: createGait(i * 0.5) };
  });
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  return { name, p, scene, style, people, tune, camera, height: p.height ?? 1.7 };
});

// labels
const labels = document.querySelector('#labels');
for (const c of cells) {
  c.label = document.createElement('div');
  c.label.className = 'lab';
  c.label.innerHTML = `${c.name}<small>Classic · iso-city</small>`;
  labels.appendChild(c.label);
}

// narrow screens (phones): one pair at a time, picked from a row of chips
let pick = 0;
const looksNav = document.querySelector('#looks');
looksNav.innerHTML = cells.map((c, i) => `<button type="button" data-i="${i}" class="${i ? '' : 'on'}">${c.name}</button>`).join('');
looksNav.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-i]');
  if (!b) return;
  pick = +b.dataset.i;
  looksNav.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
});

// Still / Walk / Run
let anim = 'Walk';
document.querySelector('#anim').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-a]');
  if (!b) return;
  anim = b.dataset.a;
  document.querySelectorAll('#anim button').forEach((x) => x.classList.toggle('on', x === b));
});

// drag to turn (all at once), otherwise a slow turntable
let yaw = 0.5, dragging = null, hold = false;
// for tests: __cmp.view(yaw) stops the turntable at that angle
window.__cmp = { view: (v) => { yaw = v; hold = true; }, cells };
canvas.addEventListener('pointerdown', (e) => { dragging = { x: e.clientX, yaw }; });
window.addEventListener('pointermove', (e) => { if (dragging) yaw = dragging.yaw + (e.clientX - dragging.x) * 0.01; });
window.addEventListener('pointerup', () => { dragging = null; });

let t0 = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
  if (!dragging && !hold) yaw += dt * 0.25;
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H, false);
  const narrow = W < 700;
  document.body.classList.toggle('narrow', narrow);
  const top = document.querySelector('header').offsetHeight;
  const shown = narrow ? [cells[pick]] : cells;
  const cols = narrow ? 1 : W > H ? 5 : 2, rows = Math.ceil(shown.length / cols);
  const cw = Math.floor(W / cols), ch = Math.floor((H - top) / rows);
  for (const c of cells) c.label.style.display = shown.includes(c) ? '' : 'none';
  const speed = anim === 'Run' ? RUN_SPEED : anim === 'Walk' ? WALK_SPEED : 0;
  renderer.setScissorTest(false);
  renderer.setClearColor(style.background);
  renderer.clear();
  shown.forEach((c, i) => {
    const cx = (i % cols) * cw, cy = top + Math.floor(i / cols) * ch;
    for (const who of c.people) {
      who.root.rotation.y = yaw;
      stepGait(who.gait, dt, speed, c.tune);
      poseGait(who.body, who.gait, 'natural', c.tune);
    }
    // frame both people: 1.1 m apart, their height tall, room for the label
    const h = Math.max(1.9, c.height);
    c.camera.aspect = cw / ch;
    const dist = Math.max(h * 1.15 / (2 * Math.tan(15 * Math.PI / 180)), 2.3 / c.camera.aspect / (2 * Math.tan(15 * Math.PI / 180)));
    c.camera.position.set(0, h * 0.62, dist);
    c.camera.lookAt(0, h * 0.46, 0);
    c.camera.updateProjectionMatrix();
    ps1.render(c, c.camera, cx, H - cy - ch, cw, ch);
    Object.assign(c.label.style, { left: `${cx}px`, top: `${cy + 6}px`, width: `${cw}px` });
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
