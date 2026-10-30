import { Vector3 } from 'three';

/** Orthographic city camera. The turnaround sheets are flat; this is the small iso view. */
export const CITY_ELEVATION = Math.PI / 6;
export const CITY_AZIMUTH = Math.PI / 4;
/** A standing figure occupies about this fraction of the view height. */
export const CITY_FIGURE_FRACTION = 0.22;

const _offset = new Vector3();

/**
 * Frame an orthographic camera so `height` reads at city scale.
 * Returns the look-at point the orbit target should use.
 */
export function frameCityCamera(camera, height, aspect) {
  const viewH = height / CITY_FIGURE_FRACTION;
  const safeAspect = aspect > 0 ? aspect : 1;
  camera.top = viewH / 2;
  camera.bottom = -viewH / 2;
  camera.left = (-viewH * safeAspect) / 2;
  camera.right = (viewH * safeAspect) / 2;
  camera.zoom = 1;
  const dist = height * 6;
  const lookY = height * 0.46;
  camera.position.set(
    Math.cos(CITY_ELEVATION) * Math.sin(CITY_AZIMUTH) * dist,
    lookY + Math.sin(CITY_ELEVATION) * dist,
    Math.cos(CITY_ELEVATION) * Math.cos(CITY_AZIMUTH) * dist,
  );
  camera.lookAt(0, lookY, 0);
  camera.updateProjectionMatrix();
  return lookY;
}

/** Elevation and azimuth of the camera relative to a look point on the ground axis. */
export function cityAngles(camera, lookY) {
  _offset.copy(camera.position);
  _offset.y -= lookY;
  const horizontal = Math.hypot(_offset.x, _offset.z);
  return {
    elevation: Math.atan2(_offset.y, horizontal),
    azimuth: Math.atan2(_offset.x, _offset.z),
  };
}
