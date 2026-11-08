import * as THREE from 'three';
import { createAsset } from './index.js';
import { setDetail } from '../lib/shapes.js';

// Little pictures of catalogue assets for the editor's palette, in the app's
// own look. Made only when a palette tab is first shown (one per frame, so the
// page never stalls), and kept in the browser afterwards, so later visits
// show them at once and only new assets get drawn. Bump VERSION when assets
// change shape and their pictures should be redrawn.

const VERSION = 11; // 2: zebra crossings; 3: office light masks; 4: buildings vary by seed; 5: new cars; 6: dressed backs; 7: the palette; 8: building colours, motorbikes; 9: octagon wheels, visible headlights; 11: bus rear window
const SIZE = 64; // drawn small, shown scaled up with crisp pixels
const mem = new Map();
const queue = [];
let busy = false;
let stage = null;

const keyOf = (id, params) => `tcb.thumb.v${VERSION}:${id}:${JSON.stringify(params ?? {})}`;

function getStage(renderer, style) {
  if (stage) return stage;
  const scene = new THREE.Scene();
  style.createLights({}).objects.forEach((o) => scene.add(o));
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  rt.texture.colorSpace = THREE.SRGBColorSpace; // store display colours, like the screen
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  stage = { scene, rt, camera: new THREE.PerspectiveCamera(30, 1, 0.05, 2000), canvas, pixels: new Uint8Array(SIZE * SIZE * 4) };
  return stage;
}

/** Draw one asset now and return a PNG data URL (transparent background). */
function draw(renderer, style, id, params) {
  const s = getStage(renderer, style);
  setDetail(style.detail ?? 1);
  const obj = createAsset(id, params, style);
  setDetail(1);
  style.decorate?.(obj);
  s.scene.add(obj);
  // frame it from the front-right, a little above
  const box = new THREE.Box3().setFromObject(obj);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const dir = new THREE.Vector3(0.75, 0.6, 1).normalize();
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(15)) * 1.02;
  s.camera.position.copy(sphere.center).addScaledVector(dir, dist);
  s.camera.near = dist / 50; s.camera.far = dist * 3;
  s.camera.lookAt(sphere.center);
  s.camera.updateProjectionMatrix();

  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevScissor = renderer.getScissorTest();
  renderer.setScissorTest(false);
  renderer.setClearColor(0x000000, 0);
  style.prepareRender?.(SIZE, SIZE);
  renderer.setRenderTarget(s.rt);
  renderer.clear();
  renderer.render(s.scene, s.camera);
  renderer.readRenderTargetPixels(s.rt, 0, 0, SIZE, SIZE, s.pixels);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  renderer.setScissorTest(prevScissor);

  s.scene.remove(obj);
  obj.traverse((o) => o.geometry?.dispose());
  // flip rows (GL reads bottom-up) into a canvas
  const ctx = s.canvas.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) img.data.set(s.pixels.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
  ctx.putImageData(img, 0, 0);
  return s.canvas.toDataURL('image/png');
}

/**
 * Fill `img` with the picture of asset `id` (with `params`): at once when it
 * is already known, otherwise soon (drawn in the background, then saved).
 */
export function thumbInto(img, renderer, style, id, params) {
  const key = keyOf(id, params);
  let url = mem.get(key);
  if (!url) { try { url = localStorage.getItem(key); } catch { /* storage blocked */ } }
  if (url) { mem.set(key, url); img.src = url; return; }
  queue.push({ img, id, params, key });
  if (!busy) pump(renderer, style);
}

function pump(renderer, style) {
  const job = queue.shift();
  if (!job) { busy = false; return; }
  busy = true;
  requestAnimationFrame(() => {
    let url = mem.get(job.key);
    if (!url) {
      try { url = draw(renderer, style, job.id, job.params); } catch (e) { console.warn('thumbnail', job.id, e); }
      if (url) { mem.set(job.key, url); try { localStorage.setItem(job.key, url); } catch { /* full or blocked: keep in memory */ } }
    }
    if (url) job.img.src = url;
    pump(renderer, style);
  });
}
