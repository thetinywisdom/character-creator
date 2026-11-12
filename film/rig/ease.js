/** Timeline eases. u is 0..1 inside a shot. */

export function clamp01(u) {
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function vlerp(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function ease(u, kind = 'linear') {
  u = clamp01(u);
  if (kind === 'smooth') return u * u * (3 - 2 * u);
  if (kind === 'out') return 1 - (1 - u) ** 3;
  if (kind === 'in') return u ** 3;
  return u;
}

/** Smoothstep from edge0 to edge1. */
export function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
