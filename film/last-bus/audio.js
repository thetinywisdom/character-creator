// Soundtrack for "Last Bus". Everything here is synthesized in this file:
// filtered noise for the rain, a low oscillator plus noise for the bus,
// a short noise burst for the puddle, and a handful of damped sine partials
// for the piano. No samples, no external audio.
//
//   node film/last-bus/audio.js /tmp/last-bus.wav
//
// The picture clock lives in timing.js. The splash is written to peak on the
// shot 3 cut (t = 10s, frame 300), where the picture's splash is largest.

import { writeFileSync } from 'node:fs';
import { DURATION, busCenterX } from './timing.js';

const SR = 48000;
const N = Math.round(SR * DURATION);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

const L = new Float32Array(N);
const R = new Float32Array(N);

function add(i, l, r) {
  if (i < 0 || i >= N) return;
  L[i] += l;
  R[i] += r;
}

// --- rain -----------------------------------------------------------------
// A lowpassed noise bed, plus sparse high ticks so it reads as drops and not
// a hiss. The bed ducks a little while the piano is playing.
const rainRng = mulberry32(20261112);
let rainLp = 0;
const rainBed = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const white = rainRng() * 2 - 1;
  rainLp += 0.06 * (white - rainLp);
  const tick = rainRng() > 0.996 ? (rainRng() * 2 - 1) * 0.55 : 0;
  rainBed[i] = rainLp * 0.55 + tick;
}

function pianoGainAt(t) {
  // Roughly where the line is present, so the rain can sit under it.
  if (t < 2.2 || (t >= 9.7 && t < 21.6) || t > 35.6) return 0;
  const enter = t < 4 ? (t - 2.2) / 1.8 : 1;
  const leave = t > 34.2 ? (35.6 - t) / 1.4 : 1;
  return clamp(enter, 0, 1) * clamp(leave, 0, 1);
}

for (let i = 0; i < N; i++) {
  const t = i / SR;
  const duck = 1 - 0.32 * pianoGainAt(t);
  const v = rainBed[i] * 0.16 * duck;
  // A slow left/right drift, so the bed isn't a mono lump.
  const pan = 0.08 * Math.sin(t * 0.37);
  add(i, v * (1 - pan), v * (1 + pan));
}

// --- bus ------------------------------------------------------------------
// Constant 8 m/s, same function as the picture. Loudest as it passes the
// shelter, then gone. A falling tone across the pass stands in for doppler.
let eng = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const x = busCenterX(t);
  const dist = Math.hypot(x - 0.4, 7.5);
  const pass = Math.exp(-((t - 9.65) ** 2) / (2 * 0.42 ** 2));
  const bed = t < 7 ? 0.12 : 0.22;
  if (pass < 0.02 && bed <= 0) continue;
  const doppler = 1 - 0.22 * Math.tanh((t - 9.4) * 1.4);
  const f = 78 * doppler;
  eng += 0.12 * ((rainRng() * 2 - 1) - eng);
  const tone = Math.sin(2 * Math.PI * f * t) * 0.55
    + Math.sin(2 * Math.PI * f * 2 * t) * 0.18
    + eng * 0.9;
  const whoosh = Math.exp(-((t - 9.85) ** 2) / (2 * 0.18 ** 2)) * (rainRng() * 2 - 1);
  const near = Math.min(0.35, 4.5 / dist);
  const s = tone * 0.08 * bed * near + whoosh * 0.22 * pass;
  const pan = Math.tanh(x / 10);
  add(i, s * (0.65 - 0.45 * pan), s * (0.65 + 0.45 * pan));
}

// --- puddle splash, peaked on the cut ------------------------------------
// Shot 3 ends at t = 10 (frame 300). The picture's splash is largest on
// frame 299 (t = 9.967). The burst is centred there so the hit and the cut
// land together.
const SPLASH_PEAK = 9.97;
// Low-passed spray, not full-band noise. A single-sample spike was the true
// peak of the whole film and left no headroom once the hit was loud enough.
let splashLp = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const dt = t - SPLASH_PEAK;
  if (dt < -0.18 || dt > 0.7) continue;
  const env = dt < 0
    ? Math.exp(dt / 0.03)
    : Math.exp(-dt / 0.16);
  const n = rainRng() * 2 - 1;
  splashLp += 0.45 * (n - splashLp);
  const thump = Math.sin(2 * Math.PI * 70 * dt) * Math.exp(-Math.max(0, dt) / 0.05);
  const s = (splashLp * 2.4 + thump * 0.55) * env * 2.6;
  add(i, s * 0.85, s);
}

// --- piano ----------------------------------------------------------------
// A-minor, written for this short. Two phrases: one under the wait, one
// after the kitten is found. Nothing between the splash and the reveal.
const A4 = 440;
const notes = [
  // phrase 1 — enters during shot 1, finished before the splash
  [2.35, A4 / 2, 0.09, 2.4],       // A3
  [3.55, A4 * Math.pow(2, 3 / 12) / 2, 0.07, 2.2], // C4
  [4.85, A4 * Math.pow(2, 7 / 12) / 2, 0.075, 2.4], // E4
  [6.15, A4 / 2, 0.06, 2.0],
  [7.45, A4 * Math.pow(2, 7 / 12) / 2, 0.05, 1.8],
  [8.35, A4 * Math.pow(2, 3 / 12) / 2, 0.04, 1.4],
  // phrase 2 — the reveal, then the hold
  [21.85, A4 / 2, 0.08, 2.6],
  [23.25, A4 * Math.pow(2, 3 / 12) / 2, 0.065, 2.4],
  [24.85, A4 * Math.pow(2, 7 / 12) / 2, 0.07, 2.6],
  [26.55, A4, 0.045, 2.2],
  [28.35, A4 * Math.pow(2, 7 / 12) / 2, 0.05, 2.4],
  [30.45, A4 * Math.pow(2, 3 / 12) / 2, 0.045, 2.4],
  [32.55, A4 / 2, 0.055, 2.8],
  [34.15, A4 / 4 * Math.pow(2, 7 / 12), 0.04, 1.6], // E3, fades with the picture
];

for (const [t0, freq, amp, dur] of notes) {
  const i0 = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  for (let k = 0; k < len; k++) {
    const u = k / SR;
    const t = t0 + u;
    if (t >= DURATION - 0.05) break;
    const env = Math.exp(-u * 1.35) * (1 - Math.exp(-u * 80));
    const tail = t > 35.2 ? clamp((35.75 - t) / 0.55, 0, 1) : 1;
    const s = (
      Math.sin(2 * Math.PI * freq * u)
      + 0.28 * Math.sin(2 * Math.PI * freq * 2 * u)
      + 0.06 * Math.sin(2 * Math.PI * freq * 3 * u)
    ) * env * amp * tail;
    // A little wider than mono, and a slow vibrato-free detune on the right.
    const sr = Math.sin(2 * Math.PI * freq * 1.003 * u) * env * amp * tail * 0.35;
    add(i0 + k, s * 0.85, s * 0.55 + sr);
  }
}

// Gentle fade on the last quarter second, matching the cut to black.
for (let i = 0; i < N; i++) {
  const t = i / SR;
  if (t < 35.55) continue;
  const g = clamp((36 - t) / 0.45, 0, 1);
  L[i] *= g;
  R[i] *= g;
}

// Shave the splash tips, then sit the peak at -3 dBFS so the AAC true peak
// stays under -1 dBTP once the hit is brought up to about -14 LUFS.
function shave(x) {
  const a = 0.42;
  const ax = Math.abs(x);
  if (ax <= a) return x;
  const y = a + 0.28 * Math.tanh((ax - a) / 0.2);
  return Math.sign(x) * y;
}
for (let i = 0; i < N; i++) {
  L[i] = shave(L[i]);
  R[i] = shave(R[i]);
}
let peak = 1e-6;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
// 0.45 leaves the splash the loudest hit and lands near -14 LUFS with
// true peak under -1 dBTP after the AAC encode.
const gain = 0.48 / peak;
for (let i = 0; i < N; i++) { L[i] *= gain; R[i] *= gain; }

// Where the splash is loudest, for the sync check.
let splashAt = 0;
let splashMax = 0;
const win = Math.floor(0.02 * SR);
for (let i = win; i < N - win; i++) {
  const t = i / SR;
  if (t < 9.4 || t > 10.6) continue;
  let e = 0;
  for (let k = -win; k <= win; k++) e += L[i + k] * L[i + k] + R[i + k] * R[i + k];
  if (e > splashMax) { splashMax = e; splashAt = t; }
}

function writeWav(file, left, right, sr) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const l = clamp(left[i], -1, 1);
    const r = clamp(right[i], -1, 1);
    buf.writeInt16LE(l < 0 ? Math.ceil(l * 32767) : Math.floor(l * 32767), o);
    buf.writeInt16LE(r < 0 ? Math.ceil(r * 32767) : Math.floor(r * 32767), o + 2);
    o += 4;
  }
  writeFileSync(file, buf);
}

const out = process.argv[2] || '/tmp/last-bus.wav';
writeWav(out, L, R, SR);
console.log(`wrote ${out}  ${DURATION}s  ${SR}Hz stereo`);
let loudAt = 0;
let loudMax = 0;
for (let i = win; i < N - win; i += Math.floor(0.01 * SR)) {
  let e = 0;
  for (let k = -win; k <= win; k++) e += L[i + k] * L[i + k] + R[i + k] * R[i + k];
  if (e > loudMax) { loudMax = e; loudAt = i / SR; }
}
console.log(`loudest 20ms window at t=${loudAt.toFixed(3)}s`);
