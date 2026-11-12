import { verticalFovDeg } from '../rig/camera.js';
import { applyShotCamera } from '../rig/camera.js';
import { BUS_Z } from './timing.js';

const ASPECT = 1080 / 1920;

/**
 * Locked shot list for "Last Bus" (seconds). Focal lengths are millimetres on
 * a portrait full-frame sensor (36 mm vertical). See film/rig/camera.js.
 *
 * A shot is either declarative (from / to / look / lookTo) or a camera(stage, u, cam, t)
 * function when the move is tied to the bus. subframes > 1 averages the shutter
 * for motion blur. Safe zones: keep faces out of the top 220 px, the bottom
 * 420 px and the right 140 px of the 1080×1920 frame.
 */
export function lastBusShots() {
  return [
    {
      id: '1-wide',
      start: 0,
      end: 3,
      focal: 24,
      ease: 'smooth',
      // Across the stop, angled so the street (and the bus) opens to frame left.
      // High and to the side, looking down the street the bus is on.
      from: [5.4, 3.6, 7.2],
      to: [3.6, 3.05, 6.6],
      look: [-8, 0.75, 2.6],
      lookTo: [-4.5, 0.85, 3.0],
      near: 0.15,
    },
    {
      id: '2-back',
      start: 3,
      end: 7,
      focal: 85,
      // Far enough back that the umbrella sits under the top caption band.
      from: [-1.85, 1.48, 6.25],
      look: [0.08, 1.58, 4.9],
      near: 0.05,
    },
    {
      id: '3-pass',
      start: 7,
      end: 10,
      focal: 35,
      subframes: 6,
      shutter: 2 / 30,
      near: 0.1,
      camera(stage, u, cam, t) {
        const x = stage.busX(t);
        cam.fov = verticalFovDeg(35);
        cam.aspect = ASPECT;
        cam.near = 0.12;
        cam.far = 160;
        cam.position.set(x + 0.2, 1.55, BUS_Z - 5.6);
        cam.up.set(0, 1, 0);
        cam.lookAt(x + 2.6, 0.55, BUS_Z + 0.1);
        cam.updateProjectionMatrix();
      },
    },
    {
      id: '4-away',
      start: 10,
      end: 15,
      focal: 50,
      from: [-3.1, 1.95, 6.7],
      look: [7.5, 1.2, 3.0],
      near: 0.08,
    },
    {
      id: '5-stick',
      start: 15,
      end: 18,
      focal: 100,
      ease: 'smooth',
      from: [0.95, 0.72, 3.25],
      to: [0.75, 0.62, 3.45],
      look: [0.12, 0.08, 4.75],
      lookTo: [0.1, 0.07, 4.78],
      near: 0.02,
    },
    {
      id: '6-reveal',
      start: 18,
      end: 26,
      focal: 35,
      ease: 'smooth',
      // At the midpoint (about 0:22) the tilted umbrella and the kitten share the frame.
      from: [-3.2, 2.4, 5.15],
      to: [-2.6, 1.95, 5.0],
      look: [-0.05, 1.35, 4.95],
      lookTo: [-0.35, 0.82, 4.9],
      near: 0.04,
    },
    {
      id: '7-kitten',
      start: 26,
      end: 30,
      focal: 85,
      near: 0.02,
      camera(stage, _u, cam) {
        const h = stage.kittenHead;
        cam.fov = verticalFovDeg(85);
        cam.aspect = ASPECT;
        cam.near = 0.02;
        cam.far = 24;
        cam.position.set(h.x + 0.02, h.y + 0.02, h.z - 0.95);
        cam.up.set(0, 1, 0);
        cam.lookAt(h.x, h.y - 0.01, h.z + 0.02);
        cam.updateProjectionMatrix();
      },
    },
    {
      id: '8-away',
      start: 30,
      end: 36,
      focal: 28,
      ease: 'smooth',
      from: [-2.4, 4.4, 2.6],
      to: [-3.4, 6.6, 1.2],
      look: [-0.15, 0.85, 5.05],
      lookTo: [-0.2, 0.6, 5.1],
      near: 0.2,
      far: 300,
    },
  ];
}

export function frameCamera(camera, shot, u, t, stage) {
  if (shot.camera) shot.camera(stage, u, camera, t);
  else applyShotCamera(camera, shot, u, ASPECT);
}
