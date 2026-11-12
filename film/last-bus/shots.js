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
      from: [6.8, 4.4, 7.6],
      to: [4.8, 3.6, 6.9],
      look: [-16, 0.45, 1.1],
      lookTo: [-8, 0.6, 2.0],
      near: 0.15,
    },
    {
      id: '2-back',
      start: 3,
      end: 7,
      focal: 85,
      // Outside the shelter, over his left shoulder, so the head-turn reads.
      from: [-1.55, 1.5, 6.15],
      look: [0.12, 1.42, 4.85],
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
        const dive = u * u;
        // Low three-quarter on the open side of the bus, closing on the puddle.
        cam.position.set(x - 3.4 + dive * 1.2, 1.05 - 0.35 * dive, BUS_Z - 5.1);
        cam.up.set(0, 1, 0);
        cam.lookAt(x + 2.2, 1.15 - 0.7 * dive, BUS_Z + 0.2);
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
      from: [1.2, 0.46, 3.05],
      to: [0.82, 0.34, 3.55],
      look: [0.22, 0.1, 4.72],
      lookTo: [0.2, 0.08, 4.78],
      near: 0.02,
    },
    {
      id: '6-reveal',
      start: 18,
      end: 26,
      focal: 35,
      ease: 'out',
      from: [1.45, 2.15, 6.15],
      to: [1.7, 0.34, 5.6],
      look: [0.12, 1.9, 4.85],
      lookTo: [0.12, 0.18, 4.95],
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
        cam.position.set(h.x - 0.14, h.y - 0.03, h.z - 0.8);
        cam.up.set(0, 1, 0);
        cam.lookAt(h.x + 0.03, h.y - 0.02, h.z + 0.04);
        cam.updateProjectionMatrix();
      },
    },
    {
      id: '8-away',
      start: 30,
      end: 36,
      focal: 28,
      ease: 'smooth',
      from: [2.4, 4.6, 9.6],
      to: [5.8, 16.5, 18.5],
      look: [0.2, 1.2, 5.1],
      lookTo: [0.2, 0.35, 5.0],
      near: 0.2,
      far: 300,
    },
  ];
}

export function frameCamera(camera, shot, u, t, stage) {
  if (shot.camera) shot.camera(stage, u, camera, t);
  else applyShotCamera(camera, shot, u, ASPECT);
}
