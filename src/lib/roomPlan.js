// Shared checks for seeded room layouts. Placement code lives with each kit.
// A box is { x, z, hw, hd } in metres, origin at the room centre.

export function aabb(x, z, w, d, rot = 0) {
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  return { x, z, hw: (w / 2) * c + (d / 2) * s, hd: (w / 2) * s + (d / 2) * c };
}

export function hits(a, b, gap = 0) {
  return Math.abs(a.x - b.x) < a.hw + b.hw + gap - 1e-4
    && Math.abs(a.z - b.z) < a.hd + b.hd + gap - 1e-4;
}

export function inside(a, bounds) {
  return a.x - a.hw >= bounds.x0 - 0.04 && a.x + a.hw <= bounds.x1 + 0.04
    && a.z - a.hd >= bounds.z0 - 0.04 && a.z + a.hd <= bounds.z1 + 0.04;
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function rectBox(r) {
  return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, hw: Math.abs(r.x1 - r.x0) / 2, hd: Math.abs(r.z1 - r.z0) / 2 };
}

function contains(r, x, z) {
  return x >= r.x0 - 1e-4 && x <= r.x1 + 1e-4 && z >= r.z0 - 1e-4 && z <= r.z1 + 1e-4;
}

/** Rectangles that touch or overlap, so a walk can cross from one into the next. */
function connected(rects, door) {
  const n = rects.length;
  const touch = (a, b) => hits(rectBox(a), rectBox(b), 0.05);
  const seen = new Set();
  const stack = [];
  rects.forEach((r, i) => { if (contains(r, door.x, door.z)) stack.push(i); });
  while (stack.length) {
    const i = stack.pop();
    if (seen.has(i)) continue;
    seen.add(i);
    for (let j = 0; j < n; j++) if (!seen.has(j) && touch(rects[i], rects[j])) stack.push(j);
  }
  return seen.size === n;
}

/**
 * Floor boxes must sit inside the room, miss each other, and miss the
 * reserved walk (about 0.9 m wide). The walk must be one connected piece
 * from the door, and every goal (a spot in front of a bar, a row, a bench)
 * must lie on that walk.
 */
export function planProblems(plan, boxes) {
  const errs = [];
  if (!plan.bounds) return ['missing bounds'];
  boxes.forEach((b, i) => {
    if (!inside(b, plan.bounds)) errs.push(`outside ${b.item} @ ${b.x.toFixed(2)},${b.z.toFixed(2)}`);
    for (let j = i + 1; j < boxes.length; j++) {
      if (hits(b, boxes[j])) errs.push(`overlap ${b.item} @ ${b.x.toFixed(2)},${b.z.toFixed(2)} and ${boxes[j].item} @ ${boxes[j].x.toFixed(2)},${boxes[j].z.toFixed(2)}`);
    }
  });
  if (!plan.keepOut) return errs;
  const walks = plan.keepOut.map(rectBox);
  for (const b of boxes) {
    walks.forEach((w, i) => {
      if (hits(b, w)) errs.push(`blocks walk ${i} ${b.item} @ ${b.x.toFixed(2)},${b.z.toFixed(2)}`);
    });
  }
  if (!plan.door || !connected(plan.keepOut, plan.door)) errs.push('walk is not one path from the door');
  for (const g of plan.goals || []) {
    if (!plan.keepOut.some((r) => contains(r, g.x, g.z))) errs.push(`goal ${g.name} is off the walk`);
  }
  return errs;
}
