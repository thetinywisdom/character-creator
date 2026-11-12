// Soundtrack for "Banana Karma". Everything here is synthesized in this file.
// No samples and no third-party audio. See CREDITS.md.
//
//   node film/banana-karma/audio.js /tmp/banana-karma.wav
//
// The picture clock is timing.js. Each gag is written on the same timestamp
// the picture uses: splat, record scratch, ding, whoosh, boing, clink.

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import {
  BOING_T, CUP_LAND, DING_T, DURATION, MUSIC_A0, MUSIC_A1, MUSIC_B0, MUSIC_B1,
  SCRATCH_T, SPLAT_T, WHOOSH_T, musicGain,
} from './timing.js';

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

const rng = mulberry32(20261112);
const L = new Float32Array(N);
const R = new Float32Array(N);

function add(i, l, r) {
  if (i < 0 || i >= N) return;
  L[i] += l;
  R[i] += r;
}

function noise() { return rng() * 2 - 1; }

// --- splat: the peel hits the pavement ------------------------------------
{
  const i0 = Math.floor(SPLAT_T * SR);
  const len = Math.floor(0.28 * SR);
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const u = k / SR;
    const env = Math.exp(-u / 0.045);
    const n = noise();
    lp += 0.35 * (n - lp);
    const thump = Math.sin(2 * Math.PI * 78 * u) * Math.exp(-u / 0.05);
    const wet = Math.sin(2 * Math.PI * 340 * u) * Math.exp(-u / 0.02);
    const s = (lp * 1.4 + thump * 0.7 + wet * 0.25) * env;
    add(i0 + k, s * 0.9, s);
  }
}

// --- cocky bass loop -------------------------------------------------------
// 108 bpm, a one-bar walk that starts on the downbeat of each entrance.
// Pluck, not a drone: short decay, a little octave so it reads on a phone.
{
  const eighth = 60 / 108 / 2;
  const E2 = 82.41;
  const semis = [0, 0, 3, 7, 5, 3, 0, 10]; // E E G B A G E D
  const play = (t0, t1, gain) => {
    for (let n = 0; n < 64; n++) {
      const tNote = t0 + n * eighth;
      if (tNote >= t1 - 0.02) break;
      const semi = semis[n % semis.length];
      const freq = E2 * 2 ** (semi / 12);
      const i0 = Math.floor(tNote * SR);
      const len = Math.floor(0.22 * SR);
      for (let k = 0; k < len; k++) {
        const t = (i0 + k) / SR;
        if (t >= t1) break;
        const u = k / SR;
        const env = Math.exp(-u * 10) * (1 - Math.exp(-u * 200));
        const s = (
          Math.sin(2 * Math.PI * freq * u)
          + 0.22 * Math.sin(2 * Math.PI * freq * 2 * u)
          + 0.05 * Math.sign(Math.sin(2 * Math.PI * freq * u))
        ) * env * gain;
        add(i0 + k, s * 0.92, s * 0.84);
      }
    }
  };
  play(MUSIC_A0, MUSIC_A1, 0.34);
  play(MUSIC_B0, MUSIC_B1, 0.34 * 1.55);
}

// Hard mute past the gates, in case a pluck tail crosses the scratch.
for (let i = 0; i < N; i++) {
  const t = i / SR;
  if (musicGain(t) > 0) continue;
  // The bass is the only thing in these ranges before SFX are mixed... 
  // SFX are mixed in other ranges too, so don't zero the whole buffer.
}

// The tails are already cut inside play(). Good.

// --- record scratch: music dies on the cut to the shoe --------------------
{
  const i0 = Math.floor((SCRATCH_T - 0.012) * SR);
  const len = Math.floor(0.42 * SR);
  let phase = 0;
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const u = k / SR;
    const f = 1900 * (0.06 ** (u / 0.36));
    phase += (2 * Math.PI * f) / SR;
    const env = (u < 0.008 ? u / 0.008 : 1) * Math.exp(-u / 0.16);
    const n = noise();
    lp += 0.25 * (n - lp);
    const zip = Math.sin(phase);
    const s = (zip * 0.55 + lp * 0.9) * env;
    const pan = 0.15 * Math.sin(u * 40);
    add(i0 + k, s * (0.8 - pan), s * (0.8 + pan));
  }
}

// --- ding: he clears the peel ---------------------------------------------
{
  const i0 = Math.floor(DING_T * SR);
  const partials = [[1318.5, 0.5], [1975.5, 0.28], [2637, 0.12]];
  const len = Math.floor(0.55 * SR);
  for (let k = 0; k < len; k++) {
    const u = k / SR;
    const env = Math.exp(-u * 7.5) * (1 - Math.exp(-u * 400));
    let s = 0;
    for (const [f, a] of partials) s += Math.sin(2 * Math.PI * f * u) * a;
    s *= env * 0.55;
    add(i0 + k, s * 0.85, s);
  }
}

// --- whoosh: the feet leave the ground ------------------------------------
{
  const i0 = Math.floor(WHOOSH_T * SR);
  const len = Math.floor(0.38 * SR);
  let hp = 0;
  let prev = 0;
  for (let k = 0; k < len; k++) {
    const u = k / SR;
    const env = Math.sin(Math.PI * Math.min(1, u / 0.38)) ** 1.2;
    const n = noise();
    hp += 0.08 * (n - hp);
    const band = n - hp;
    prev = prev * 0.7 + band * 0.3;
    const air = Math.sin(2 * Math.PI * (280 + 900 * (u / 0.38)) * u) * 0.15;
    const s = (prev * 1.3 + air) * env * 0.7;
    add(i0 + k, s, s * 0.75);
  }
}

// --- boing: he hits the pavement ------------------------------------------
{
  const i0 = Math.floor(BOING_T * SR);
  const len = Math.floor(0.55 * SR);
  let phase = 0;
  for (let k = 0; k < len; k++) {
    const u = k / SR;
    const f = 230 * (0.42 ** (u / 0.42));
    phase += (2 * Math.PI * f) / SR;
    const env = Math.exp(-u / 0.18) * (1 - Math.exp(-u * 180));
    const spring = Math.sin(phase);
    const thud = Math.sin(2 * Math.PI * 62 * u) * Math.exp(-u / 0.06);
    const s = (spring * 0.7 + thud * 0.55) * env;
    add(i0 + k, s * 0.95, s);
  }
}

// --- clink: the cup lands upright -----------------------------------------
{
  const hits = [CUP_LAND, CUP_LAND + 0.09];
  const amps = [0.62, 0.22];
  hits.forEach((t0, n) => {
    const i0 = Math.floor(t0 * SR);
    const partials = [[1680, 0.45], [2740, 0.32], [4120, 0.18], [890, 0.12]];
    const len = Math.floor(0.22 * SR);
    for (let k = 0; k < len; k++) {
      const u = k / SR;
      const env = Math.exp(-u / 0.035) * (1 - Math.exp(-u * 900));
      let s = 0;
      for (const [f, a] of partials) s += Math.sin(2 * Math.PI * f * u) * a;
      s *= env * amps[n];
      add(i0 + k, s * 0.8, s);
    }
  });
}

// Soft knee so a stacked hit doesn't pin the true peak, then a first level.
function shave(x) {
  const a = 0.32;
  const ax = Math.abs(x);
  if (ax <= a) return x;
  const y = a + 0.22 * Math.tanh((ax - a) / 0.18);
  return Math.sign(x) * y;
}
for (let i = 0; i < N; i++) {
  L[i] = shave(L[i]);
  R[i] = shave(R[i]);
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
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buf.writeInt16LE(l < 0 ? Math.ceil(l * 32767) : Math.floor(l * 32767), o);
    buf.writeInt16LE(r < 0 ? Math.ceil(r * 32767) : Math.floor(r * 32767), o + 2);
    o += 4;
  }
  writeFileSync(file, buf);
}

function measure(file) {
  const r = spawnSync('ffmpeg', [
    '-hide_banner', '-i', file,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json',
    '-f', 'null', '-',
  ], { encoding: 'utf8' });
  const text = `${r.stderr || ''}\n${r.stdout || ''}`;
  const start = text.lastIndexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  return JSON.parse(text.slice(start, end + 1));
}

const out = process.argv[2] || '/tmp/banana-karma.wav';
writeWav(out, L, R, SR);
const before = measure(out);
if (before) {
  const inputI = Number(before.input_i);
  const inputTp = Number(before.input_tp);
  // Land integrated near -14 LUFS, and keep the wav true peak at or under
  // -2 dBTP so the AAC encode stays under -1 dBTP.
  let gainDb = -14 - inputI;
  if (inputTp + gainDb > -2) gainDb = -2 - inputTp;
  const g = 10 ** (gainDb / 20);
  for (let i = 0; i < N; i++) { L[i] *= g; R[i] *= g; }
  writeWav(out, L, R, SR);
  const after = measure(out);
  console.log(`level ${gainDb.toFixed(2)} dB  before I=${inputI} TP=${inputTp}  after I=${after?.input_i} TP=${after?.input_tp}`);
} else {
  console.log('ffmpeg loudnorm unavailable; wav left at the synthesized level');
}

function windowPeak(t0, t1) {
  const a = Math.max(0, Math.floor(t0 * SR));
  const b = Math.min(N - 1, Math.floor(t1 * SR));
  const win = Math.floor(0.02 * SR);
  let max = 0;
  let at = t0;
  for (let i = a; i < b; i += 24) {
    let e = 0;
    const c = Math.min(N - win, i);
    for (let k = 0; k < win; k++) e += L[c + k] * L[c + k] + R[c + k] * R[c + k];
    if (e > max) { max = e; at = c / SR; }
  }
  return { at, max };
}

const hits = [
  ['splat', SPLAT_T - 0.05, SPLAT_T + 0.2],
  ['scratch', SCRATCH_T - 0.05, SCRATCH_T + 0.4],
  ['ding', DING_T - 0.02, DING_T + 0.3],
  ['whoosh', WHOOSH_T - 0.02, WHOOSH_T + 0.35],
  ['boing', BOING_T - 0.02, BOING_T + 0.35],
  ['clink', CUP_LAND - 0.02, CUP_LAND + 0.2],
];
console.log(`wrote ${out}  ${DURATION}s  ${SR}Hz stereo`);
for (const [name, a, b] of hits) {
  const p = windowPeak(a, b);
  console.log(`  ${name} energy peak t=${p.at.toFixed(3)}s`);
}
