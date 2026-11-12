import * as THREE from 'three';
import { ease, vlerp } from './ease.js';

/**
 * Portrait focal length.
 *
 * A full-frame sensor is 36 × 24 mm. Held upright for 9:16, the long side is
 * vertical, so the vertical sensor height is 36 mm (not the landscape 24 mm).
 *
 *   vertical FOV = 2 * atan(sensorHeight / (2 * focalLength))
 *
 * three.js PerspectiveCamera.fov is this vertical angle, in degrees.
 * Horizontal FOV then follows the 9:16 aspect (1080 / 1920).
 */
export const SENSOR_HEIGHT_MM = 36;

export function verticalFovDeg(focalMm, sensorHeightMm = SENSOR_HEIGHT_MM) {
  return THREE.MathUtils.radToDeg(2 * Math.atan(sensorHeightMm / (2 * focalMm)));
}

/**
 * Apply a declarative shot camera.
 * shot.from / shot.to: eye positions. shot.look / shot.lookTo: look-at points.
 * Missing `to` / `lookTo` holds the start (a locked-off camera).
 */
export function applyShotCamera(camera, shot, u, aspect) {
  const eu = ease(u, shot.ease ?? 'linear');
  const lu = ease(u, shot.lookEase ?? shot.ease ?? 'linear');
  const eye = vlerp(shot.from, shot.to ?? shot.from, eu);
  const look = vlerp(shot.look, shot.lookTo ?? shot.look, lu);
  camera.fov = verticalFovDeg(shot.focal);
  camera.aspect = aspect;
  camera.near = shot.near ?? 0.05;
  camera.far = shot.far ?? 220;
  camera.position.set(eye[0], eye[1], eye[2]);
  camera.up.set(0, 1, 0);
  camera.lookAt(look[0], look[1], look[2]);
  camera.updateProjectionMatrix();
}
