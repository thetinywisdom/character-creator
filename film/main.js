import * as THREE from 'three';
import { style } from '../src/styles/index.js';
import { createPs1Renderer } from '../src/render/ps1.js';
import { createFilmPresenter } from './rig/present.js';
import { activeShot, shotU } from './rig/timeline.js';
import { buildLastBus } from './last-bus/stage.js';
import { frameCamera, lastBusShots } from './last-bus/shots.js';
import { FPS, DURATION, WIDTH, HEIGHT, BLACK_FRAME } from './last-bus/timing.js';

// Opt-in film page. The viewer (index.html) never loads this.
// Open /film/index.html?film=last-bus — the query selects the short.
// Frames are drawn only when window.__film.renderFrame(i) is called, so a
// capture is frame-accurate rather than a screen recording.

const params = new URLSearchParams(location.search);
const filmId = params.get('film') || 'last-bus';
if (filmId !== 'last-bus') {
  document.body.textContent = '';
  throw new Error(`Unknown film "${filmId}"`);
}

// Same pixel scale as the viewer on a large screen (pixel size 2), whatever
// the window size is, so headless and desktop captures match.
Object.defineProperty(style, 'pixelScale', { configurable: true, get() { return 2; } });

const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, alpha: false, preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x000000, 1);
renderer.autoClear = true;

const ps1 = createPs1Renderer(renderer);
const presenter = createFilmPresenter(renderer, ps1, { width: WIDTH, height: HEIGHT });
const stage = buildLastBus();
const shots = lastBusShots();
const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 0.05, 220);
const ps1Stage = { scene: stage.scene, style };

function seek(t) {
  const shot = activeShot(shots, t);
  const u = shotU(shot, t);
  frameCamera(camera, shot, u, t, stage);
  stage.update(t, camera);
  return shot;
}

function subTimes(t, shot) {
  const n = shot.subframes ?? 1;
  if (n <= 1) return [t];
  const span = shot.shutter ?? (1 / FPS);
  const out = [];
  for (let s = 0; s < n; s++) {
    const k = n === 1 ? 0 : s / (n - 1) - 0.5;
    // Stay inside the shot so the shutter never shows the next cut.
    const ts = Math.min(shot.end - 1e-3, Math.max(shot.start, t + k * span));
    out.push(ts);
  }
  return out;
}

const api = {
  id: filmId,
  fps: FPS,
  duration: DURATION,
  width: WIDTH,
  height: HEIGHT,
  frames: FPS * DURATION,
  ready: true,
  renderFrame(i) {
    const t = i / FPS;
    if (i >= BLACK_FRAME) {
      presenter.black();
      return { t, frame: i, shot: 'black', black: true };
    }
    const shot = activeShot(shots, t);
    const times = subTimes(t, shot);
    if (times.length === 1) {
      seek(times[0]);
      presenter.render(ps1Stage, camera, i);
    } else {
      presenter.accumulate(times.map((ts) => () => {
        seek(ts);
        presenter.drawPs1(ps1Stage, camera);
      }), i);
    }
    return {
      t, frame: i, shot: shot.id, black: false,
      fov: camera.fov,
      cam: camera.position.toArray(),
      busX: stage.busX(t),
      pts: stage.project(camera),
    };
  },
  bounds() {
    return stage.bounds();
  },
  /** Centre pixel, to catch a blank WebGL buffer. Origin is bottom-left. */
  sample() {
    const gl = renderer.getContext();
    const p = new Uint8Array(4);
    gl.readPixels(WIDTH / 2, HEIGHT / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
    return Array.from(p);
  },
};

// A first draw so the page is not blank if a person opens it.
// The capture script calls renderFrame for every frame it needs.
api.renderFrame(0);
window.__film = api;

// Optional realtime play for eyeballing: /film/index.html?film=last-bus&play=1
if (params.has('play')) {
  let frame = 0;
  const loop = () => {
    api.renderFrame(frame);
    frame = (frame + 1) % api.frames;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
