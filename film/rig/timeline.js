/** A shot list is an array of { id, start, end, ... } in seconds, [start, end). */

export function activeShot(shots, t) {
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (t >= s.start && t < s.end) return s;
  }
  return shots[shots.length - 1];
}

export function shotU(shot, t) {
  const d = shot.end - shot.start;
  if (d <= 0) return 0;
  const u = (t - shot.start) / d;
  return u < 0 ? 0 : u > 1 ? 1 : u;
}
