// Shared clock for the picture and the soundtrack. Plain numbers so the
// Node audio script and the browser rig import the same cuts.
//
// The worker faces -Z and walks toward the camera. z decreases as he advances.
// Shot times are the locked list; a few beats inside a shot (the hang, the
// slam, the clink) are placed for the laugh rather than spread evenly.

export const FPS = 30;
export const DURATION = 17;
export const WIDTH = 1080;
export const HEIGHT = 1920;
/** Two black frames (508 and 509). The picture holds through t = 16.90. */
export const BLACK_FRAME = 508;

export const WORKER_X = 0.12;
export const PEEL1 = { x: 0.0, z: 0 };

export const SPEED = 1.28;
export const Z_STOP = 0.78;
export const HOP_DIST = 0.98;

// The city's jump: vy = 4.4, gravity 13 (src/city/City.js).
export const JUMP_VY = 4.4;
export const JUMP_G = 13;
export const JUMP_T = 7.16;
export const JUMP_DUR = (2 * JUMP_VY) / JUMP_G;

export const WALK1_A = 2.0;
export const WALK1_B = 4.62;
export const GLIDE1_B = 5.0;
export const WALK2_A = JUMP_T + JUMP_DUR + 0.24;
export const WALK2_B = 10.72;
export const GLIDE2_B = 11.08;

export const FALL_T = 12.0;
export const HANG_T0 = 12.48;
export const HANG_T1 = 13.55;
export const SLAM_T1 = 14.18;
export const SLIDE_T0 = 13.62;
export const SLIDE_T1 = 14.32;
export const SLIDE = 0.62;

export const SPLAT_T = 0.30;
export const SCRATCH_T = 5.0;
export const DING_T = JUMP_T + JUMP_DUR;
export const WHOOSH_T = 12.14;
export const BOING_T = 13.92;
export const CUP_LAUNCH = 12.06;
export const CUP_LAND = 15.5;
export const MUSIC_A0 = 2.0;
export const MUSIC_A1 = 5.0;
export const MUSIC_B0 = 9.0;
export const MUSIC_B1 = 11.0;

const GLIDE1 = 0.16;
const GLIDE2 = 0.14;
const WALK1_DIST = SPEED * (WALK1_B - WALK1_A);
export const Z_START = Z_STOP + GLIDE1 + WALK1_DIST;

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Mover z at time t, before the shoe-gap bias the stage measures. */
export function workerZ(t) {
  if (t <= WALK1_A) return Z_START;
  if (t < WALK1_B) return Z_START - SPEED * (t - WALK1_A);
  if (t < GLIDE1_B) {
    const z0 = Z_START - WALK1_DIST;
    return z0 + (Z_STOP - z0) * smoothstep(WALK1_B, GLIDE1_B, t);
  }
  if (t < JUMP_T) return Z_STOP;
  if (t < JUMP_T + JUMP_DUR) {
    return Z_STOP - HOP_DIST * smoothstep(JUMP_T, JUMP_T + JUMP_DUR, t);
  }
  const zLand = Z_STOP - HOP_DIST;
  if (t < WALK2_A) return zLand;
  if (t < WALK2_B) return zLand - SPEED * (t - WALK2_A);
  if (t < GLIDE2_B) {
    const z0 = zLand - SPEED * (WALK2_B - WALK2_A);
    const z1 = z0 - GLIDE2;
    return z0 + (z1 - z0) * smoothstep(WALK2_B, GLIDE2_B, t);
  }
  const z2 = zLand - SPEED * (WALK2_B - WALK2_A) - GLIDE2;
  if (t < SLIDE_T0) return z2;
  return z2 - SLIDE * smoothstep(SLIDE_T0, SLIDE_T1, t);
}

/** Height of the city jump, metres. Zero on the ground. */
export function jumpHeight(t) {
  const u = t - JUMP_T;
  if (u <= 0 || u >= JUMP_DUR) return 0;
  return JUMP_VY * u - 0.5 * JUMP_G * u * u;
}

/**
 * Metres of stride. The hop does not advance it, so he lands in the same
 * step he took off from and the victory walk continues cleanly.
 */
export function walked(t) {
  const a = Math.max(0, Math.min(t, WALK1_B) - WALK1_A);
  const b = Math.max(0, Math.min(t, WALK2_B) - WALK2_A);
  let g = 0;
  if (t > WALK1_B) g += GLIDE1 * Math.min(1, (t - WALK1_B) / (GLIDE1_B - WALK1_B));
  if (t > WALK2_B) g += GLIDE2 * Math.min(1, (t - WALK2_B) / (GLIDE2_B - WALK2_B));
  return a * SPEED + b * SPEED + g;
}

/** 1 while swaggering, 0 while planted. */
export function walkAmount(t) {
  if (t < WALK1_A) return 0;
  if (t < WALK1_A + 0.16) return (t - WALK1_A) / 0.16;
  if (t < WALK1_B) return 1;
  if (t < GLIDE1_B) return 1 - smoothstep(WALK1_B, GLIDE1_B, t);
  if (t < JUMP_T) return 0;
  if (t < JUMP_T + JUMP_DUR) return 0.15;
  if (t < WALK2_A) return 0;
  if (t < WALK2_A + 0.16) return (t - WALK2_A) / 0.16;
  if (t < WALK2_B) return 1;
  if (t < GLIDE2_B) return 1 - smoothstep(WALK2_B, GLIDE2_B, t);
  return 0;
}

/**
 * Local time for COMEDY.fall[0] ("Feet over head").
 * The pose's own 0.65s of action is held: a beat with the feet over the
 * head, then the slam, then he stays flat (the pose stands up again at 1.9s,
 * which this short never reaches).
 */
export function fallPoseTime(t) {
  if (t < FALL_T) return -1;
  if (t < HANG_T0) return ((t - FALL_T) / (HANG_T0 - FALL_T)) * 0.30;
  if (t < HANG_T1) return 0.30;
  if (t < SLAM_T1) return 0.30 + ((t - HANG_T1) / (SLAM_T1 - HANG_T1)) * 0.34;
  const u = Math.min(1, (t - SLAM_T1) / 0.4);
  return 0.64 + u * 0.42;
}

/** 0 silent, 1 the first bass entrance, 1.5 the louder return. Hard gates. */
export function musicGain(t) {
  if (t >= MUSIC_A0 && t < MUSIC_A1) return 1;
  if (t >= MUSIC_B0 && t < MUSIC_B1) return 1.5;
  return 0;
}

/** One still per shot, plus the 0.5s hook and the fall apex. */
export const BEATS = [
  { frame: 15, name: '00.50-hook' },
  { frame: 45, name: '01.50-shot1' },
  { frame: 105, name: '03.50-shot2' },
  { frame: 180, name: '06.00-shot3' },
  { frame: 225, name: '07.50-shot4' },
  { frame: 300, name: '10.00-shot5' },
  { frame: 345, name: '11.50-shot6' },
  { frame: 390, name: '13.00-apex' },
  { frame: 420, name: '14.00-shot7' },
  { frame: 465, name: '15.50-clink' },
  { frame: 496, name: '16.53-shot8' },
];
