// Shared clock for the picture and the soundtrack. Plain numbers so the
// Node audio script and the browser rig import the same cuts.

export const FPS = 30;
export const DURATION = 36;
export const WIDTH = 1080;
export const HEIGHT = 1920;
/** First frame of the hard cut to black (8 black frames: 1072..1079). */
export const BLACK_FRAME = 1072;

// City bus length and the front axle, matching buildBus in src/props/vehicles.js.
export const BUS_LENGTH = 10.5;
export const WHEEL_FORWARD = BUS_LENGTH / 2 - 2.2;

/** Brisk town pace. Constant, so the bus never slows for the stop. */
export const BUS_SPEED = 8;
/** Front wheel crosses the puddle centre. The splash keeps rising until the cut. */
export const WHEEL_HIT_T = 9.82;
export const SPLASH_START = 9.55;
export const SPLASH_END = 10; // shot 3 / shot 4 cut
export const PUDDLE_X = 0.85;

export const BUS_Z = 1.15;

/** centre x of the bus at time t (seconds). */
export function busCenterX(t) {
  return PUDDLE_X - WHEEL_FORWARD - BUS_SPEED * (WHEEL_HIT_T - t);
}

export function frameTime(frame) {
  return frame / FPS;
}

/** One still per shot, plus the 0.5s hook and the 0:22 reveal. */
export const BEATS = [
  { frame: 15, name: '00.50-hook' },
  { frame: 45, name: '01.50-shot1' },
  { frame: 150, name: '05.00-shot2' },
  { frame: 255, name: '08.50-shot3' },
  { frame: 299, name: '09.97-splash' },
  { frame: 375, name: '12.50-shot4' },
  { frame: 495, name: '16.50-shot5' },
  { frame: 660, name: '22.00-reveal' },
  { frame: 840, name: '28.00-shot7' },
  { frame: 990, name: '33.00-shot8' },
  { frame: 1075, name: '35.83-black' },
];
