// Shared helpers for seeded interior layouts. mulberry32 is the town's RNG
// (src/lib/rng.js): the same seed rebuilds the same numbers. Each room keeps
// its own rules in src/<kit>/layout.js and uses this for boxes and overlap.

import { mulberry32 } from './rng.js';

/** Deterministic RNG. `salt` keeps two rooms with the same seed from sharing draws. */
export function rngFor(seed, salt = 1) {
  const rnd = mulberry32((Math.imul(seed | 0, 0x9E3779B1) ^ (salt | 0)) >>> 0);
  return {
    rnd,
    int(a, b) { return a + Math.floor(rnd() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(rnd() * arr.length)]; },
    chance(p) { return rnd() < p; },
    jitter(amount) { return (rnd() - 0.5) * 2 * amount; },
  };
}

const q = (n) => Math.round(n * 1000) / 1000;

/** World AABB. `back` items have their origin on the back face and extend along local +z. */
export function footprintAabb(x, z, w, d, rotY = 0, back = false) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const hw = (w / 2) * Math.abs(c) + (d / 2) * Math.abs(s);
  const hd = (w / 2) * Math.abs(s) + (d / 2) * Math.abs(c);
  const cx = x + (back ? s * (d / 2) : 0);
  const cz = z + (back ? c * (d / 2) : 0);
  return { x: cx, z: cz, hw, hd, x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd };
}

export function overlapAmount(a, b) {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  if (ox <= 0 || oz <= 0) return 0;
  return Math.min(ox, oz);
}

/** Local +z after a three.js Y rotation. */
export function facingOf(rotY) {
  return { x: Math.sin(rotY), z: Math.cos(rotY) };
}

function rect(x, z, hw, hd) {
  return { x, z, hw, hd, x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd };
}

/**
 * Floor planner. `bounds` is the inner wall face. `back` items are wall-hung
 * (origin on the wall). `noHit` and `onTop` do not take floor space.
 */
export function occupancy({ bounds, footprints, back, noHit, onTop, gap = 0.002 }) {
  const blocks = [];
  const placements = [];

  function boxFor(item, x, z, rotY) {
    const [w, d] = footprints[item];
    return footprintAabb(x, z, w, d, rotY, back.has(item));
  }

  function hit(box) {
    for (const b of blocks) {
      if (overlapAmount(box, b.aabb) > gap) return b;
    }
    return null;
  }

  function inside(box) {
    return box.x0 >= bounds.x0 - 1e-3 && box.x1 <= bounds.x1 + 1e-3
      && box.z0 >= bounds.z0 - 1e-3 && box.z1 <= bounds.z1 + 1e-3;
  }

  return {
    placements,
    blocks,
    block(x, z, hw, hd, name) {
      blocks.push({ aabb: rect(x, z, hw, hd), name });
    },
    /** Reserve a walkway. Returns the rect so the room can report it. */
    keep(x, z, hw, hd, name) {
      this.block(x, z, hw, hd, name);
      return { x: q(x), z: q(z), hw, hd, name };
    },
    add(item, x, z, rotY = 0, y = 0) {
      x = q(x);
      z = q(z);
      rotY = q(rotY);
      y = q(y);
      const skip = noHit.has(item) || onTop.has(item);
      const box = boxFor(item, x, z, rotY);
      if (!skip) {
        if (!back.has(item) && !inside(box)) return null;
        if (hit(box)) return null;
        blocks.push({ aabb: box, name: item });
      }
      const p = { item, x, y, z, rotY };
      placements.push(p);
      return p;
    },
    place(item, x, z, rotY = 0, y = 0) {
      const p = this.add(item, x, z, rotY, y);
      if (!p) {
        const box = boxFor(item, q(x), q(z), rotY);
        const other = hit(box);
        const why = !back.has(item) && !inside(box)
          ? 'outside'
          : `hits ${other ? other.name : 'nothing'}`;
        throw new Error(`cannot place ${item} at ${q(x)}, ${q(z)} (${why})`);
      }
      return p;
    },
    tryAt(item, spots, y = 0) {
      for (const s of spots) {
        const p = this.add(item, s.x, s.z, s.rotY ?? 0, s.y ?? y);
        if (p) return p;
      }
      return null;
    },
  };
}

/** Shuffle a copy with the room RNG. */
export function shuffled(rng, arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Overlap and walkway check for one generated plan.
 * Floor boxes may not intersect each other or a keepout by more than `tol`.
 * `onTop` pieces must sit on a named surface. Wall pieces must face into the room.
 */
export function auditPlan(plan, { bounds, footprints, back, noHit, onTop, surfaces, tol = 0.015 }) {
  const errors = [];
  const solids = [];
  for (const p of plan.placements) {
    const fp = footprints[p.item];
    if (!fp) { errors.push(`unknown ${p.item}`); continue; }
    const box = footprintAabb(p.x, p.z, fp[0], fp[1], p.rotY || 0, back.has(p.item));
    if (noHit.has(p.item)) {
      if (p.x < bounds.x0 - 0.2 || p.x > bounds.x1 + 0.2 || p.z < bounds.z0 - 0.2 || p.z > bounds.z1 + 0.2) {
        errors.push(`noHit outside ${p.item}`);
      }
      continue;
    }
    if (onTop.has(p.item)) {
      const host = solids.find((s) => surfaces.has(s.item)
        && p.x > s.box.x0 + 0.02 && p.x < s.box.x1 - 0.02
        && p.z > s.box.z0 + 0.02 && p.z < s.box.z1 - 0.02);
      if (!host) errors.push(`not on a surface ${p.item}`);
      continue;
    }
    if (!back.has(p.item)) {
      if (box.x0 < bounds.x0 - 0.02 || box.x1 > bounds.x1 + 0.02 || box.z0 < bounds.z0 - 0.02 || box.z1 > bounds.z1 + 0.02) {
        errors.push(`outside ${p.item}`);
      }
    } else {
      const face = facingOf(p.rotY || 0);
      const into = face.x * (0 - p.x) + face.z * (0 - p.z);
      if (into <= 0.05) errors.push(`wall faces out ${p.item}`);
    }
    for (const o of solids) {
      if (overlapAmount(box, o.box) > tol) errors.push(`overlap ${p.item} / ${o.item}`);
    }
    if (!back.has(p.item)) {
      for (const k of plan.keepouts || []) {
        const kb = rect(k.x, k.z, k.hw, k.hd);
        if (overlapAmount(box, kb) > tol) errors.push(`blocks ${k.name}: ${p.item}`);
      }
    }
    solids.push({ item: p.item, box, p });
  }
  for (const k of plan.keepouts || []) {
    const narrow = Math.min(k.hw, k.hd) * 2;
    if (narrow < 0.88) errors.push(`keepout ${k.name} is ${narrow.toFixed(2)} m wide`);
  }
  return errors;
}
