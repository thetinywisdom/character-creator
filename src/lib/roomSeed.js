import { mulberry32 } from './rng.js';

// Shared by the meeting, bedroom and studio kits. Seed 0 is never passed
// here: that seed keeps the hand-made layout. The same seed and salt rebuild
// the same sequence, via the city's mulberry32.

export function roomRng(seed, salt = 1) {
  const n = (seed | 0) + Math.imul(salt | 0, 0x1000);
  return mulberry32((Math.imul(n, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0);
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function between(rng, a, b) {
  return a + (b - a) * rng();
}

/** Axis-aligned box of a footprint after a yaw, in metres. */
export function yawBox(x, z, w, d, rotY = 0) {
  const c = Math.abs(Math.cos(rotY));
  const s = Math.abs(Math.sin(rotY));
  const hw = (w / 2) * c + (d / 2) * s;
  const hd = (w / 2) * s + (d / 2) * c;
  return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd };
}

export function overlaps(a, b, gap = 0) {
  return a.x0 < b.x1 + gap && a.x1 + gap > b.x0 && a.z0 < b.z1 + gap && a.z1 + gap > b.z0;
}

export function inside(box, bounds) {
  return box.x0 >= bounds.x0 - 1e-4 && box.x1 <= bounds.x1 + 1e-4
    && box.z0 >= bounds.z0 - 1e-4 && box.z1 <= bounds.z1 + 1e-4;
}

/** Where local +z points after a yaw. */
export function facing(rotY) {
  return { x: Math.sin(rotY), z: Math.cos(rotY) };
}

function distToBox(x, z, b) {
  const dx = x < b.x0 ? b.x0 - x : x > b.x1 ? x - b.x1 : 0;
  const dz = z < b.z0 ? b.z0 - z : z > b.z1 ? z - b.z1 : 0;
  return Math.hypot(dx, dz);
}

/**
 * True when a person of `radius` metres (half the clear width) can walk from
 * `entrance` to within `near` metres of every goal box, staying inside bounds
 * and off the blocked boxes.
 */
export function reaches(blocked, bounds, entrance, goals, radius = 0.35, step = 0.1) {
  const cols = Math.max(1, Math.ceil((bounds.x1 - bounds.x0) / step));
  const rows = Math.max(1, Math.ceil((bounds.z1 - bounds.z0) / step));
  const free = new Uint8Array(cols * rows);
  const at = (c, r) => ({ x: bounds.x0 + (c + 0.5) * step, z: bounds.z0 + (r + 0.5) * step });
  const blockedAt = (x, z) => blocked.some((b) => overlaps(
    { x0: x, x1: x, z0: z, z1: z },
    b,
    radius,
  ));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = at(c, r);
      if (p.x < bounds.x0 || p.x > bounds.x1 || p.z < bounds.z0 || p.z > bounds.z1) continue;
      if (!blockedAt(p.x, p.z)) free[r * cols + c] = 1;
    }
  }
  const cell = (x, z) => {
    const c = Math.floor((x - bounds.x0) / step);
    const r = Math.floor((z - bounds.z0) / step);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
    return r * cols + c;
  };
  let start = cell(entrance.x, entrance.z);
  if (start < 0 || !free[start]) {
    let best = -1;
    let bestD = 1e9;
    for (let i = 0; i < free.length; i++) {
      if (!free[i]) continue;
      const p = at(i % cols, Math.floor(i / cols));
      const d = (p.x - entrance.x) ** 2 + (p.z - entrance.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0 || bestD > 0.6 ** 2) return false;
    start = best;
  }
  const seen = new Uint8Array(free.length);
  const q = [start];
  seen[start] = 1;
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi];
    const c = i % cols;
    const r = Math.floor(i / cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const j = nr * cols + nc;
      if (!free[j] || seen[j]) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  const missed = [];
  const ok = goals.every((goal) => {
    const near = goal.near ?? 0.45;
    for (let i = 0; i < seen.length; i++) {
      if (!seen[i]) continue;
      const p = at(i % cols, Math.floor(i / cols));
      const d = distToBox(p.x, p.z, goal);
      if (d > 0.02 && d <= near) return true;
    }
    missed.push(goal.item ?? '?');
    return false;
  });
  reaches.lastMissed = missed;
  return ok;
}
