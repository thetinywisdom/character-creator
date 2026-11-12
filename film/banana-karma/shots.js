import { verticalFovDeg } from '../rig/camera.js';
import { smoothstep } from '../rig/ease.js';
import {
  FALL_T, JUMP_DUR, JUMP_T, PEEL1,
} from './timing.js';

const ASPECT = 1080 / 1920;

function setCam(cam, focal, eye, look, near = 0.05, up = [0, 1, 0]) {
  cam.fov = verticalFovDeg(focal);
  cam.aspect = ASPECT;
  cam.near = near;
  cam.far = 90;
  cam.position.set(eye[0], eye[1], eye[2]);
  cam.up.set(up[0], up[1], up[2]);
  cam.lookAt(look[0], look[1], look[2]);
  cam.updateProjectionMatrix();
}

/**
 * Locked shot list for "Banana Karma". Focal lengths are millimetres on a
 * portrait full-frame sensor (36 mm vertical). Cameras stay close: the worker
 * is the subject, and the phone frame has to read his pose.
 *
 * Safe zones of the 1080×1920 frame: keep the important action out of the
 * top 220 px, the bottom 420 px and the right 140 px.
 */
export function bananaShots() {
  return [
    {
      id: '1-splat',
      start: 0,
      end: 2,
      focal: 35,
      subframes: 6,
      shutter: 2 / 30,
      near: 0.04,
      camera(_stage, _u, cam, t) {
        // Whip from down the street onto the peel. The ease is steep so the
        // shutter streaks, then the camera is locked for the splat.
        const whip = smoothstep(0.02, 0.34, t);
        const k = 1 - (1 - whip) ** 3;
        const eye = [
          1.1 * (1 - k) + 0.0 * k,
          1.25 * (1 - k) + 0.34 * k,
          -0.2 * (1 - k) + -0.68 * k,
        ];
        const look = [
          PEEL1.x + 1.8 * (1 - k),
          0.7 * (1 - k) + 0.04 * k,
          PEEL1.z + 3.2 * (1 - k),
        ];
        setCam(cam, 35, eye, look, 0.04);
      },
    },
    {
      id: '2-swagger',
      start: 2,
      end: 5,
      focal: 35,
      camera(stage, _u, cam, t) {
        const z = stage.z(t);
        const x = stage.x;
        // Tracking backward, chest height, close enough that he fills the frame.
        // Far enough that both shoes clear the bottom caption band.
        // Above his eyeline, so the leading shoe is seen from the top and
        // does not stab out the bottom of the frame.
        setCam(cam, 35, [x + 0.1, 2.2, z - 3.2], [x, 0.95, z + 0.12], 0.06);
      },
    },
    {
      id: '3-shoe',
      start: 5,
      end: 7,
      focal: 50,
      camera(stage, _u, cam, t) {
        const f = stage.frontFoot(t);
        // Low, but not under the sole: the shoe and the whole peel, with the gap between them.
        const look = [f.x * 0.45 + PEEL1.x * 0.55, 0.05, f.z * 0.4 + PEEL1.z * 0.6];
        setCam(cam, 50, [look[0] + 0.18, 0.46, look[2] - 0.92], [look[0], 0.04, look[2] + 0.1], 0.03);
      },
    },
    {
      id: '4-hop',
      start: 7,
      end: 9,
      focal: 35,
      camera(stage, _u, cam) {
        // Locked on the middle of the hop so the apex stays in frame.
        const mid = JUMP_T + JUMP_DUR * 0.5;
        const z = stage.z(mid);
        const x = stage.x;
        // The city's jump clears ~0.75 m. Frame the head at the top of that arc.
        // Look back toward the peel he is clearing, camera low enough that the
        // foreground sidewalk does not eat the bottom of the frame.
        setCam(cam, 35, [x + 0.08, 1.88, z - 3.7], [x, 1.15, z + 0.08], 0.08);
      },
    },
    {
      id: '5-orbit',
      start: 9,
      end: 11,
      focal: 24,
      ease: 'smooth',
      camera(stage, u, cam, t) {
        const z = stage.z(t);
        const x = stage.x;
        // A short arc across his front, not a trip around the block.
        // From the corner, so the stride is in profile and the front shoe
        // stays inside the frame.
        const ang = 0.5 + u * 0.55;
        const r = 2.5;
        setCam(
          cam, 24,
          [x + Math.sin(ang) * r, 1.65, z - Math.cos(ang) * r * 0.8],
          [x, 0.95, z],
          0.08,
        );
      },
    },
    {
      id: '6-peel',
      start: 11,
      end: 12,
      focal: 85,
      camera(stage, _u, cam) {
        const p = stage.peel2;
        const f = stage.frontFoot(11.4);
        const look = [(p.x + f.x) / 2, 0.07, (p.z + f.z) / 2];
        setCam(cam, 85, [look[0] + 0.04, 0.62, look[2] - 1.38], [look[0] - 0.01, 0.05, look[2] + 0.02], 0.04);
      },
    },
    {
      id: '7-fall',
      start: 12,
      end: 15,
      focal: 24,
      camera(stage, _u, cam) {
        // Locked off, three-quarter, close. The lie tips him back from the
        // pivot, so the look point sits behind it. Upright horizon.
        const z = stage.z(13.15);
        const x = stage.x;
        setCam(cam, 24, [x + 0.98, 1.58, z - 1.04], [x, 1.18, z + 0.2], 0.08);
      },
    },
    {
      id: '8-button',
      start: 15,
      end: 17,
      focal: 35,
      camera(stage, _u, cam, t) {
        const z = stage.z(t);
        const x = stage.x;
        // Steep high angle: top-down enough to read as overhead, tipped so the
        // shirt and the cup beside him still show. Up-vector stays world +Y
        // so his body runs vertically on the phone.
        // High, but aimed at the middle of the body so the head clears the
        // top band and the cup beside him stays out of the right band.
        setCam(cam, 35, [x + 0.02, 2.48, z - 0.68], [x, 0.14, z + 0.26], 0.04);
      },
    },
  ];
}

export function frameCamera(camera, shot, u, t, stage) {
  if (shot.camera) shot.camera(stage, u, camera, t);
  else throw new Error(`shot ${shot.id} has no camera`);
}
