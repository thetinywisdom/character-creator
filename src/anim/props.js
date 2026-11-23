// Cheap motion for catalogue props.
//
// Nobori cloth works like the skirt (anim/skirt.js): the rest shape is kept,
// and only that mesh's few vertices move. Nothing else in the prop changes.
// Birds work like the cat: a couple of joints (body, head, tail) get a pose.
// Call tickProps once a frame with the time in seconds. The same seed built
// the same phase, so two copies do not move in lockstep.

/** Bend a banner. Vertices on the pole (min x) stay put; the free top moves most. */
export function swayNobori(mesh, time) {
  const s = mesh.userData.sway;
  if (!s) return;
  const pos = mesh.geometry.attributes.position;
  if (!mesh.userData.rest || mesh.userData.rest.length !== pos.array.length) {
    mesh.userData.rest = Float32Array.from(pos.array);
  }
  const rest = mesh.userData.rest;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < rest.length; i += 3) {
    const x = rest[i], y = rest[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const sx = Math.max(0.001, maxX - minX);
  const sy = Math.max(0.001, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    const across = (x - minX) / sx;
    const up = (y - minY) / sy;
    const k = across * (0.35 + 0.65 * up);
    const w = Math.sin(time * s.speed + s.phase + up * 2.4);
    const w2 = Math.sin(time * s.speed * 0.67 + s.phase * 1.3 + across * 4.0);
    pos.setXYZ(i, x, y - Math.abs(w) * s.amp * 0.35 * k, z + (w * 0.8 + w2 * 0.35) * s.amp * k);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

/**
 * Pigeon: a stand with a head-bob, then a peck, then back.
 * Sparrow: perched, feet still, head looking along the wire.
 */
export function poseBird(root, time) {
  const b = root.userData.bird;
  if (!b) return;
  const t = time + b.phase;
  if (b.kind === 'sparrow') {
    const look = Math.sin(t * 0.65);
    b.head.rotation.set(b.headPitch + Math.max(0, Math.sin(t * 1.5)) * 0.18, b.headYaw + look * 0.55, b.headRoll);
    b.body.rotation.set(b.bodyPitch, b.yaw, b.roll + Math.sin(t * 2.4) * 0.04);
    if (b.tail) b.tail.rotation.x = Math.sin(t * 1.3) * 0.12;
    return;
  }
  const cycle = ((t % 4.2) + 4.2) % 4.2;
  const u = cycle / 4.2;
  let peck = 0;
  let jab = 0;
  if (u < 0.62) {
    const f = (u / 0.62 * 3) % 1;
    jab = f > 0.72 ? Math.sin(((f - 0.72) / 0.28) * Math.PI) : 0;
  } else {
    peck = Math.sin(((u - 0.62) / 0.38) * Math.PI);
  }
  b.head.rotation.set(
    b.headPitch + jab * 0.28 + peck * 1.05,
    b.headYaw,
    b.headRoll + Math.sin(t * 0.8) * 0.04,
  );
  b.head.position.set(b.headX, b.headY - peck * 0.012, b.headZ + jab * 0.01 + peck * 0.018);
  b.body.rotation.set(b.bodyPitch + peck * 0.16, b.yaw, b.roll);
  if (b.tail) b.tail.rotation.x = -peck * 0.25 + Math.sin(t * 1.1) * 0.06;
}

/** Advance every nobori and bird under `root`. Safe on a scene with neither. */
export function tickProps(root, time) {
  if (!root) return;
  root.traverse((o) => {
    if (o.isMesh && o.userData.sway) swayNobori(o, time);
    if (o.userData.bird) poseBird(o, time);
  });
}
