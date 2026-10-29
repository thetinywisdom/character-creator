import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { MUSCULAR_SCALE } from './limbs.js';

/**
 * Clothes are low-poly shells worn over the naked body. Body meshes stay.
 * Each piece is a hand-built loft parented to the joint that should carry it.
 *
 * A top closes over the shoulders: a yoke slopes from a neck-sized hole out
 * over each shoulder ball and into the sleeve. From above, skin shows only
 * at the neck and the head.
 *
 * Robot and skeleton limbs keep their meshes and get no sleeve or pant tube.
 * The garment id is not rejected. Peg legs skip pant tubes and shoes. A robot
 * leg skips the pant tube and the boot cuff, and still takes a shoe. A robot
 * torso still cannot wear a top or an outer layer.
 */
const N = 12;
const SN = 10;

/** Extra ease outside the skin, scaled by height. About 3 cm at 1.8 m. */
export function clothPad(height) {
  return 0.03 * ((Number(height) || 1.8) / 1.8);
}

function removeGarments(root) {
  const doomed = [];
  root.traverse((obj) => {
    if (obj.userData?.garment) doomed.push(obj);
  });
  for (const mesh of doomed) {
    mesh.geometry?.dispose();
    mesh.removeFromParent();
  }
}

function clothArm(type) {
  return type === 'normal' || type === 'muscular';
}

function clothLeg(type) {
  return type === 'normal';
}

function garmentMaterial(ctx, color) {
  const hex = String(color || '#888888').toLowerCase();
  const key = `garment:${hex}`;
  let material = ctx.materials.find((entry) => entry.userData.poolKey === key);
  if (!material) {
    material = new MeshStandardMaterial({
      color: hex,
      roughness: 0.85,
      metalness: 0,
      flatShading: true,
      side: DoubleSide,
    });
    material.userData.poolKey = key;
    material.userData.lockedColor = true;
    material.polygonOffset = false;
    ctx.materials.push(material);
  }
  return material;
}

function addMesh(parent, geometry, material, name, garment) {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.userData.garment = garment;
  mesh.userData.role = 'garment';
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Shared-vertex loft. Rings are CCW from above, angle 0 at +X, +Z front. */
class Loom {
  constructor() {
    this.pos = [];
    this.idx = [];
    this.mat = [];
    this.material = 0;
  }

  v(x, y, z) {
    const i = this.pos.length / 3;
    this.pos.push(x, y, z);
    return i;
  }

  add(points) {
    return points.map((p) => this.v(p[0], p[1], p[2]));
  }

  tri(a, b, c) {
    const ax = this.pos[a * 3] - this.pos[b * 3];
    const ay = this.pos[a * 3 + 1] - this.pos[b * 3 + 1];
    const az = this.pos[a * 3 + 2] - this.pos[b * 3 + 2];
    const bx = this.pos[c * 3] - this.pos[b * 3];
    const by = this.pos[c * 3 + 1] - this.pos[b * 3 + 1];
    const bz = this.pos[c * 3 + 2] - this.pos[b * 3 + 2];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    if (cx * cx + cy * cy + cz * cz < 1e-12) return;
    this.idx.push(a, b, c);
    this.mat.push(this.material);
  }

  /** Outward wall. `lower` is the lower ring, both CCW from above. */
  wall(lower, upper, skip) {
    const n = lower.length;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      if (skip && skip(i, j, n)) continue;
      this.tri(lower[i], upper[j], lower[j]);
      this.tri(lower[i], upper[i], upper[j]);
    }
  }

  /** Annulus whose normal points up. `outer` is the larger ring. */
  cap(outer, inner, skip) {
    const n = outer.length;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      if (skip && skip(i, j, n)) continue;
      this.tri(outer[i], inner[j], outer[j]);
      this.tri(outer[i], inner[i], inner[j]);
    }
  }

  /** Open strip. Equal-length polylines, no wrap. */
  strip(lower, upper) {
    for (let i = 0; i < lower.length - 1; i += 1) {
      const j = i + 1;
      this.tri(lower[i], upper[j], lower[j]);
      this.tri(lower[i], upper[i], upper[j]);
    }
  }

  geometry() {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    geo.setIndex(this.idx);
    if (this.mat.some((m) => m !== 0)) {
      let start = 0;
      for (let i = 1; i <= this.mat.length; i += 1) {
        if (i === this.mat.length || this.mat[i] !== this.mat[start]) {
          geo.addGroup(start * 3, (i - start) * 3, this.mat[start]);
          start = i;
        }
      }
    }
    geo.computeVertexNormals();
    return geo;
  }
}

function ring(n, fn) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    pts.push(fn(a, Math.cos(a), Math.sin(a), i));
  }
  return pts;
}

function oval(n, y, rx, rz) {
  return ring(n, (_a, c, s) => [c * rx, y, s * rz]);
}

/** Rounded rectangle. p=2 is an ellipse; higher p reaches the corners. */
function squircle(c, s, rx, rz, p) {
  const denom = (Math.abs(c) ** p + Math.abs(s) ** p) ** (1 / p) || 1;
  return [c / denom * rx, s / denom * rz];
}

function torsoRing(n, y, rx, rz, p) {
  return ring(n, (_a, c, s) => {
    const [x, z] = squircle(c, s, rx, rz, p);
    return [x, y, z];
  });
}

function circle(n, y, radius) {
  return oval(n, y, radius, radius);
}

function skipSide(limit) {
  return (i, j, n) => {
    const ci = Math.abs(Math.cos((i / n) * Math.PI * 2));
    const cj = Math.abs(Math.cos((j / n) * Math.PI * 2));
    return ci > limit && cj > limit;
  };
}

function skipFront(limit) {
  return (i, j, n) => {
    const si = Math.sin((i / n) * Math.PI * 2);
    const sj = Math.sin((j / n) * Math.PI * 2);
    return si > limit && sj > limit;
  };
}

function either(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (i, j, n) => a(i, j, n) || b(i, j, n);
}

function shoulderBall(spec, doc) {
  let r = spec.radii.shoulder;
  for (const key of ['left', 'right']) {
    if (doc.arms[key].type === 'muscular') r = Math.max(r, spec.radii.shoulder * MUSCULAR_SCALE);
  }
  return r;
}

function armScale(type) {
  return type === 'muscular' ? MUSCULAR_SCALE : 1;
}

/**
 * Torso measures in waist space. The yoke sits above the chest cap and the
 * shoulder balls. The neck ring is the only hole.
 */
function shellMeasures(spec, doc, kind, pad) {
  const ball = shoulderBall(spec, doc);
  const ease = { tank: 1, tee: 1.02, shirt: 1.05, hoodie: 1.2, vest: 1.16, jacket: 1.24 }[kind] || 1;
  const dropped = kind === 'hoodie' || kind === 'jacket';
  const sleeveR = ball + pad * (dropped ? 1.55 : 1.12);
  const reach = spec.shoulderWidth / 2 + sleeveR * (dropped ? 1.08 : 0.98);
  const chestX = spec.chestTopWidth / 2 * ease + pad;
  const chestZ = spec.chestTopDepth / 2 * ease + pad;
  let waistX = Math.max(spec.chestBottomWidth, spec.pelvisTopWidth) / 2 * ease + pad;
  let waistZ = Math.max(spec.chestBottomDepth, spec.pelvisTopDepth) / 2 * ease + pad * 0.75;
  if (kind === 'jacket') {
    waistX = Math.max(waistX, chestX * 0.94);
    waistZ = Math.max(waistZ, chestZ * 0.92);
  }
  const flare = { tank: 1.1, tee: 1.08, shirt: 1.04, hoodie: 0.94, vest: 1.06, jacket: 1.02 }[kind] || 1.04;
  const hemDrop = kind === 'hoodie' ? 0.6 : (kind === 'vest' ? 0.5 : 0.7);
  const scoop = { tank: 1, tee: 0.38, shirt: 0.08, hoodie: 0, vest: 0.7, jacket: 0.12 }[kind] || 0;
  const yHem = -spec.pelvisHeight * hemDrop;
  const yWaist = kind === 'hoodie' ? -spec.pelvisHeight * 0.02 : -spec.pelvisHeight * 0.06;
  const yChest = spec.chestHeight * (kind === 'vest' ? 0.42 : 0.5);
  const yArm = spec.chestHeight * spec.shoulderT - ball * 0.2;
  const     yFront = spec.chestHeight + pad * 0.28;
    const ySide = spec.chestHeight * spec.shoulderT + ball + pad * 0.55;
    const yFloor = spec.chestHeight + pad * 0.16;
  let neckR = spec.radii.neck * 1.22 + pad * 0.12;
  const collarR = Math.min(neckR * 1.7, Math.min(chestX, chestZ) * 0.78);
  neckR = Math.min(neckR, collarR * 0.78);
  return {
    n: N,
    ball,
    sleeveR,
    reach,
    chestX,
    chestZ,
    waistX,
    waistZ,
    hemX: waistX * flare,
    hemZ: waistZ * flare,
    yHem,
    yWaist,
    yChest,
    yArm,
      yFront,
      ySide,
      yFloor,
      yNeck: Math.max(yFront, ySide, yFloor) + pad * 0.4,
    neckR,
    collarR,
    scoop,
    pad,
    shoulderPow: kind === 'hoodie' ? 0.85 : 1.25,
    armhole: { tank: 0.2, tee: 0.42, shirt: 0.62, hoodie: 0.7, vest: 0.28, jacket: 0.58 }[kind] || 0.45,
    frontOpen: kind === 'vest' ? 0.2 : (kind === 'jacket' ? 0.42 : null),
    pointHem: kind === 'vest',
    collar: kind === 'tee' || kind === 'hoodie' ? 'crew' : (kind === 'shirt' || kind === 'jacket' ? 'band' : null),
    placket: kind === 'shirt',
    pocket: kind === 'hoodie',
    lapel: kind === 'jacket',
    hood: kind === 'hoodie',
    cinch: kind === 'hoodie',
  };
}

function shellRings(m) {
  const n = m.n;
  const point = m.pointHem;
  const p = 4;
  const hem = ring(n, (_a, c, s) => {
    const front = Math.max(0, s);
    const drop = point ? front * front * 0.055 : 0;
    const [x, z] = squircle(c, s, m.hemX, m.hemZ, p);
    return [x, m.yHem - drop, z + (point ? front * 0.02 : 0)];
  });
  const lip = ring(n, (_a, c, s) => {
    const front = Math.max(0, s);
    const drop = point ? front * front * 0.04 : 0;
    const [x, z] = squircle(c, s, m.hemX * 0.9, m.hemZ * 0.9, p);
    return [x, m.yHem + m.pad * 0.55 - drop, z];
  });
  const waist = torsoRing(n, m.yWaist, m.cinch ? m.waistX * 0.96 : m.waistX, m.cinch ? m.waistZ * 0.96 : m.waistZ, p);
  const chest = torsoRing(n, m.yChest, m.chestX, m.chestZ, p);
  const armpit = torsoRing(n, m.yArm, m.chestX * 0.98, m.chestZ * 0.98, p);
  const yoke = ring(n, (_a, c, s) => {
    const side = Math.abs(c) ** m.shoulderPow;
    const hx = m.chestX + (m.reach - m.chestX) * side;
    const [x, z] = squircle(c, s, hx, m.chestZ, p);
    const y = m.yFront + (m.ySide - m.yFront) * side;
    return [x, y, z];
  });
  const collar = m.collar
    ? oval(n, m.yFront + m.pad * 0.2, m.collarR, m.collarR)
    : null;
  const neck = ring(n, (_a, c, s) => {
    const front = Math.max(0, s);
    const r = m.neckR * (1 + m.scoop * 0.05 * front);
    const drop = Math.max(0, m.yNeck - m.yFloor) * m.scoop * front ** 1.2;
    return [c * r, m.yNeck - drop, s * r];
  });
  const bind = ring(n, (_a, c, s) => {
    const front = Math.max(0, s);
    const r = m.neckR * 0.9;
    const drop = Math.max(0, m.yNeck - m.yFloor) * m.scoop * front;
    const y = Math.max(m.yFloor, m.yNeck - m.pad * 0.4 - drop * 0.85);
    return [c * r, y, s * r];
  });
  return { hem, lip, waist, chest, armpit, yoke, collar, neck, bind };
}

function boundaryIndices(n, openSin) {
  const found = [];
  for (let i = 0; i < n; i += 1) {
    const prev = (i + n - 1) % n;
    const next = (i + 1) % n;
    const s = (k) => Math.sin((k / n) * Math.PI * 2);
    const skipPrev = s(prev) > openSin && s(i) > openSin;
    const skipNext = s(i) > openSin && s(next) > openSin;
    if (skipPrev !== skipNext) found.push(i);
  }
  return found;
}

function addOpeningLip(loom, rings, ids, openSin, depth) {
  const n = rings[0].length;
  for (const bi of boundaryIndices(n, openSin)) {
    const shell = ids.map((id) => id[bi]);
    const lip = rings.map((pts) => {
      const p = pts[bi];
      const len = Math.hypot(p[0], p[2]) || 1;
      return loom.v(p[0] - (p[0] / len) * depth, p[1], p[2] - (p[2] / len) * depth);
    });
    loom.strip(shell, lip);
  }
}

function addPlacket(loom, m) {
  const x = 0.012;
  const z0 = m.chestZ + 0.003;
  const z1 = z0 + 0.009;
  const y0 = m.yHem + 0.012;
  const y1 = m.yChest;
  const face = [
    [-x, y0, z1], [x, y0, z1], [x, y1, z1], [-x, y1, z1],
  ].map((p) => loom.v(...p));
  const back = [
    [-x, y0, z0], [x, y0, z0], [x, y1, z0], [-x, y1, z0],
  ].map((p) => loom.v(...p));
  loom.tri(face[0], face[1], face[2]);
  loom.tri(face[0], face[2], face[3]);
  loom.strip(back, face);
  loom.tri(face[0], back[0], back[1]);
  loom.tri(face[0], back[1], face[1]);
  loom.tri(face[3], face[2], back[2]);
  loom.tri(face[3], back[2], back[3]);
}

function addPocket(loom, m) {
  const y0 = m.yHem + m.pad * 1.6;
  const y1 = (m.yHem + m.yWaist) * 0.5 + m.pad;
  const x = Math.min(m.chestX * 0.46, 0.1);
  const z = m.chestZ + 0.006;
  const puff = 0.014;
  const a = loom.v(-x, y0, z);
  const b = loom.v(x, y0, z);
  const c = loom.v(x, y1, z);
  const d = loom.v(-x, y1, z);
  const p = loom.v(0, (y0 + y1) * 0.5, z + puff);
  loom.tri(a, b, p);
  loom.tri(b, c, p);
  loom.tri(c, d, p);
  loom.tri(d, a, p);
  const e = loom.v(-x, y1 + 0.012, z + puff);
  const f = loom.v(x, y1 + 0.012, z + puff);
  loom.tri(d, c, f);
  loom.tri(d, f, e);
}

function addCollarFlaps(loom, m) {
  const y = m.yNeck - m.pad * 0.2;
  const r = m.neckR;
  const flaps = [1, -1];
  for (const s of flaps) {
    const a = loom.v(s * r * 0.15, y, r * 0.85);
    const b = loom.v(s * r * 1.05, y, r * 0.2);
    const c = loom.v(s * r * 1.45, y - 0.05, r * 1.05);
    const d = loom.v(s * r * 0.4, y - 0.055, r * 1.35);
    loom.tri(a, d, c);
    loom.tri(a, c, b);
  }
}

function addLapels(loom, m) {
  const z = m.chestZ * 0.55;
  const x = m.neckR * 1.15;
  const y1 = m.yNeck - 0.01;
  const y0 = m.yChest * 0.85;
  for (const s of [1, -1]) {
    const a = loom.v(s * x * 0.35, y1, z);
    const b = loom.v(s * x * 1.25, y1 - 0.012, z + 0.028);
    const c = loom.v(s * x * 1.45, y0, z + 0.04);
    const d = loom.v(s * x * 0.3, y0, z + 0.006);
    loom.tri(a, d, c);
    loom.tri(a, c, b);
  }
}

function buildShell(spec, doc, kind, pad) {
  const m = shellMeasures(spec, doc, kind, pad);
  const rings = shellRings(m);
  const loom = new Loom();
  const order = [rings.hem, rings.lip, rings.waist, rings.chest, rings.armpit, rings.yoke];
  if (rings.collar) order.push(rings.collar);
  order.push(rings.neck, rings.bind);
  const ids = order.map((pts) => loom.add(pts));
  const front = m.frontOpen == null ? null : skipFront(m.frontOpen);
  const arm = skipSide(m.armhole);
  // hem, lip, waist, chest, armpit, yoke, [collar], neck, bind
  const yokeAt = 5;
  for (let i = 0; i < yokeAt; i += 1) {
    const skip = i === yokeAt - 1 ? either(arm, front) : front;
    loom.wall(ids[i], ids[i + 1], skip);
  }
  const neckAt = rings.collar ? yokeAt + 2 : yokeAt + 1;
  const collarAt = rings.collar ? yokeAt + 1 : neckAt;
  loom.cap(ids[yokeAt], ids[collarAt], front);
  if (rings.collar) loom.wall(ids[collarAt], ids[neckAt], front);
  loom.wall(ids[neckAt + 1], ids[neckAt], front);
  if (m.frontOpen != null) addOpeningLip(loom, order, ids, m.frontOpen, Math.max(m.pad * 0.45, 0.012));
  if (m.placket) addPlacket(loom, m);
  if (m.pocket) addPocket(loom, m);
  if (m.collar === 'band' && kind === 'shirt') addCollarFlaps(loom, m);
  if (m.lapel) addLapels(loom, m);
  return { geometry: loom.geometry(), measures: m };
}

function tubeGeo(stations) {
  const loom = new Loom();
  const ordered = [...stations].sort((a, b) => a.y - b.y);
  const ids = ordered.map((st) => loom.add(circle(SN, st.y, st.r)));
  for (let i = 0; i < ids.length - 1; i += 1) loom.wall(ids[i], ids[i + 1]);
  return loom.geometry();
}

function sleeveStations(spec, radii, pad, kind, part) {
  if (part === 'upper' && kind === 'short') {
    const len = spec.upperArmLength * 0.48;
    const top = radii.shoulder + pad * 1.12;
    const mid = top * 1.16;
    const hem = top * 1.02;
    return [
      { y: -len, r: hem },
      { y: -len + pad * 0.55, r: hem * 0.86 },
      { y: -len * 0.42, r: mid },
      { y: 0, r: top },
    ];
  }
  if (part === 'upper') {
    const len = spec.upperArmLength;
    const top = radii.shoulder + pad * (kind === 'hoodie' || kind === 'jacket' ? 1.55 : 1.12);
    const bottom = radii.elbow + pad * (kind === 'jacket' ? 1.35 : 1.05);
    return [
      { y: -len, r: bottom },
      { y: -len * 0.5, r: (top + bottom) * 0.5 },
      { y: 0, r: top },
    ];
  }
  const len = spec.forearmLength;
  const top = radii.elbow + pad * (kind === 'jacket' ? 1.5 : 1.2);
  const wrist = radii.wrist + pad * 0.7;
  if (kind === 'hoodie') {
    return [
      { y: -len, r: wrist * 0.92 },
      { y: -len + 0.01, r: wrist * 1.16 },
      { y: -len + 0.02, r: wrist * 0.9 },
      { y: -len + 0.032, r: wrist * 1.12 },
      { y: -len + 0.046, r: wrist },
      { y: -len * 0.45, r: (top + wrist) * 0.5 },
      { y: 0, r: top },
    ];
  }
  return [
    { y: -len, r: wrist * 0.94 },
    { y: -len + 0.014, r: wrist * 1.14 },
    { y: -len + 0.028, r: wrist },
    { y: -len * 0.48, r: (top + wrist) * 0.52 },
    { y: 0, r: top },
  ];
}

function addSleeves(ctx, kind, pad, material, prefix, garment, fit) {
  const spec = ctx.spec;
  const doc = ctx.document;
  for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
    if (!clothArm(doc.arms[key].type)) continue;
    const scale = armScale(doc.arms[key].type);
    const radii = {
      shoulder: spec.radii.shoulder * scale,
      elbow: spec.radii.elbow * scale,
      wrist: spec.radii.wrist * scale,
    };
    const upperKind = kind === 'half' ? 'short' : fit;
    const foreKind = fit;
    addMesh(
      ctx.joints[`shoulder${side}`],
      tubeGeo(sleeveStations(spec, radii, pad, upperKind, 'upper')),
      material,
      `${prefix}Upper${side}`,
      garment,
    );
    if (kind === 'full') {
      addMesh(
        ctx.joints[`elbow${side}`],
        tubeGeo(sleeveStations(spec, radii, pad, foreKind, 'fore')),
        material,
        `${prefix}Forearm${side}`,
        garment,
      );
    }
  }
}

/**
 * Hood in neck space. The lowest arc sits on the neckline and the upper
 * back. The rest wraps the back of the skull. The face stays open.
 */
function buildHood(spec, pad) {
  const loom = new Loom();
  const neckR = spec.radii.neck;
  const headR = spec.headRy;
  const chestZ = spec.chestTopDepth / 2;
  const segments = 8;
  const stations = [
    { y: -0.05, z: -(chestZ + pad * 0.35), rx: neckR * 2.4, rz: 0.012, span: 1.15 },
    { y: 0.0, z: -neckR * 0.35, rx: neckR * 1.75, rz: neckR * 0.85, span: 1.35 },
    { y: spec.neckLength * 0.28, z: -neckR * 1.05, rx: neckR * 1.9, rz: neckR * 0.7, span: 1.45 },
    { y: spec.neckLength * 0.72, z: -headR * 0.55, rx: headR * 0.78, rz: headR * 0.42, span: 1.5 },
    { y: spec.neckLength + headR * 0.05, z: -headR * 0.78, rx: headR * 0.92, rz: headR * 0.38, span: 1.4 },
    { y: spec.neckLength + headR * 0.48, z: -headR * 0.42, rx: headR * 0.62, rz: headR * 0.28, span: 1.15 },
    { y: spec.neckLength + headR * 0.78, z: -headR * 0.16, rx: headR * 0.34, rz: headR * 0.16, span: 0.85 },
  ];
  const arc = (st, inset) => {
    const pts = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const theta = -st.span + 2 * st.span * t;
      const x = Math.sin(theta) * st.rx;
      const y = st.y;
      const z = st.z - Math.cos(theta) * st.rz;
      if (!inset) {
        pts.push([x, y, z]);
      } else {
        const dx = -x;
        const dy = spec.neckLength - y;
        const dz = -z;
        const len = Math.hypot(dx, dy, dz) || 1;
        const d = Math.max(pad * 0.4, 0.012);
        pts.push([x + (dx / len) * d, y + (dy / len) * d, z + (dz / len) * d]);
      }
    }
    return pts;
  };
  const outer = stations.map((st) => loom.add(arc(st, false)));
  const inner = stations.map((st) => loom.add(arc(st, true)));
  for (let i = 0; i < outer.length - 1; i += 1) {
    loom.strip(outer[i], outer[i + 1]);
    loom.strip(inner[i + 1], inner[i]);
  }
  const last = outer.length - 1;
  for (let i = 0; i < last; i += 1) {
    loom.tri(outer[i][0], inner[i][0], inner[i + 1][0]);
    loom.tri(outer[i][0], inner[i + 1][0], outer[i + 1][0]);
    const c = segments;
    loom.tri(outer[i][c], outer[i + 1][c], inner[i + 1][c]);
    loom.tri(outer[i][c], inner[i + 1][c], inner[i][c]);
  }
  loom.strip(inner[0], outer[0]);
  const tip = loom.v(0, spec.neckLength + headR * 0.92, -headR * 0.05);
  for (let i = 0; i < segments; i += 1) {
    loom.tri(outer[last][i], outer[last][i + 1], tip);
  }
  return loom.geometry();
}

function addHood(ctx, pad, material) {
  return addMesh(ctx.joints.neck, buildHood(ctx.spec, pad), material, 'clothingTopHood', 'top');
}

function buildCape(spec, pad) {
  const loom = new Loom();
  const cols = 7;
  const rows = 5;
  const yTop = spec.chestHeight * 0.96;
  const yHem = -spec.pelvisHeight * 1.08;
  const z0 = -(Math.max(spec.chestTopDepth, spec.chestBottomDepth) / 2 + pad * 1.35);
  const thick = Math.max(pad * 0.7, 0.016);
  const widthTop = spec.radii.neck * 3.4;
  const widthHem = Math.max(spec.shoulderWidth * 1.08, spec.chestTopWidth + pad * 2);
  const sheet = (zOff) => {
    const ids = [];
    for (let r = 0; r < rows; r += 1) {
      const s = r / (rows - 1);
      const y = yTop + (yHem - yTop) * s;
      const width = widthTop + (widthHem - widthTop) * (s ** 0.85);
      const z = z0 - pad * 0.45 * s + zOff;
      const row = [];
      for (let c = 0; c < cols; c += 1) {
        const t = c / (cols - 1);
        const fold = (c % 2 === 0 ? 1 : -1) * 0.016 * s;
        row.push(loom.v((t - 0.5) * width, y, z + fold));
      }
      ids.push(row);
    }
    return ids;
  };
  const outer = sheet(0);
  const inner = sheet(-thick);
  for (let r = 0; r < rows - 1; r += 1) {
    loom.strip(outer[r + 1], outer[r]);
    loom.strip(inner[r], inner[r + 1]);
    loom.tri(outer[r][0], inner[r][0], inner[r + 1][0]);
    loom.tri(outer[r][0], inner[r + 1][0], outer[r + 1][0]);
    const c = cols - 1;
    loom.tri(outer[r][c], outer[r + 1][c], inner[r + 1][c]);
    loom.tri(outer[r][c], inner[r + 1][c], inner[r][c]);
  }
  loom.strip(outer[rows - 1], inner[rows - 1]);
  loom.strip(inner[0], outer[0]);
  return loom.geometry();
}

function skirtSize(spec, pad) {
  const leg = spec.thighLength + spec.shinLength;
  const scale = leg / 0.82;
  const stride = Math.min(1.5, Math.max(0.8, 0.55 + 0.32 * 1.6)) * scale;
  const footForward = stride * 0.6 * 0.5;
  const kneeForward = footForward * (spec.thighLength / leg);
  const lateral = spec.hipWidth / 2 + spec.radii.knee + pad;
  return {
    yTop: spec.pelvisHeight * 0.92,
    yBottom: -spec.thighLength + spec.radii.knee,
    rTop: spec.radii.waist + pad * 1.15,
    rHem: Math.hypot(lateral, kneeForward) + pad,
  };
}

function pleatRing(n, y, radius, pleat) {
  return ring(n, (a, _c, _s, i) => {
    const alt = (i % 2 === 0 ? 1 : -1) * pleat;
    const r = radius + alt;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });
}

function buildSkirt(spec, pad) {
  const hem = skirtSize(spec, pad);
  const n = N;
  const pleat = Math.min(pad * 0.95, hem.rHem * 0.055);
  const yTop = hem.yTop;
  const yHem = hem.yBottom;
  const at = (t) => {
    const y = yTop + (yHem - yTop) * t;
    const radius = hem.rTop + (hem.rHem - hem.rTop) * t;
    return pleatRing(n, y, radius, pleat * t);
  };
  const loom = new Loom();
  const outer = loom.add(at(0));
  const rim = loom.add(pleatRing(n, yTop - 0.006, hem.rTop * 0.8, 0));
  const band = loom.add(at(0.1));
  const mid = loom.add(at(0.4));
  const low = loom.add(at(0.72));
  const hemRing = loom.add(at(1));
  const lip = loom.add(pleatRing(n, yHem + 0.016, hem.rHem * 0.9, pleat * 0.72));
  loom.cap(outer, rim);
  loom.wall(band, outer);
  loom.wall(mid, band);
  loom.wall(low, mid);
  loom.wall(hemRing, low);
  loom.wall(hemRing, lip);
  return { geometry: loom.geometry(), hemRadius: hem.rHem + pleat };
}

function buildBrief(spec, pad) {
  const n = N;
  const yTop = spec.pelvisHeight * 0.92;
  const yBand = yTop - Math.max(pad * 1.35, 0.028);
  const yHip = spec.pelvisHeight * 0.3;
  const yCrotch = -spec.radii.hip * 0.35;
  const rTop = spec.radii.waist + pad * 1.25;
  const rx = Math.max(spec.pelvisBottomWidth / 2, spec.hipWidth / 2 + spec.radii.hip * 0.45) + pad;
  const rz = spec.pelvisBottomDepth / 2 + pad;
  const loom = new Loom();
  const top = loom.add(oval(n, yTop, rTop, rTop * 0.9));
  const rim = loom.add(oval(n, yTop - 0.006, rTop * 0.78, rTop * 0.7));
  const band = loom.add(oval(n, yBand, rTop * 1.05, rTop * 0.96));
  const hipPts = oval(n, yHip, rx, rz);
  const hip = loom.add(hipPts);
  const crotch = loom.add(hipPts.map((p) => {
    const side = Math.min(1, Math.abs(p[0]) / rx);
    if (side > 0.72) return [p[0], p[1], p[2]];
    const tuck = 1 - side / 0.72;
    return [
      p[0] * (1 - tuck * 0.38),
      p[1] * (1 - tuck) + yCrotch * tuck,
      p[2] * (1 - tuck * 0.22),
    ];
  }));
  loom.cap(top, rim);
  loom.wall(band, top);
  loom.wall(hip, band);
  loom.wall(crotch, hip);
  return loom.geometry();
}

function legStations(length, rTop, rHem, lip) {
  const stations = [
    { y: -length, r: rHem },
    { y: -length * 0.45, r: (rTop + rHem) * 0.5 },
    { y: 0, r: rTop },
  ];
  if (lip) stations.push({ y: -length + 0.014, r: rHem * 0.88 });
  return stations;
}

function addLegTubes(ctx, part, pad, material) {
  const spec = ctx.spec;
  const doc = ctx.document;
  for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
    if (!clothLeg(doc.legs[key].type)) continue;
    const hipR = spec.radii.hip + pad * 1.45;
    if (part === 'shorts') {
      const len = spec.thighLength * 0.5;
      const hem = hipR * 1.05;
      addMesh(
        ctx.joints[`hip${side}`],
        tubeGeo(legStations(len, hipR, hem, true)),
        material,
        `clothingBottomThigh${side}`,
        'bottom',
      );
    } else {
      const kneeR = spec.radii.knee + pad;
      addMesh(
        ctx.joints[`hip${side}`],
        tubeGeo(legStations(spec.thighLength, hipR, kneeR, false)),
        material,
        `clothingBottomThigh${side}`,
        'bottom',
      );
      const ankleR = spec.radii.ankle + pad * 0.85;
      const shinTop = spec.radii.knee + pad * 1.35;
      addMesh(
        ctx.joints[`knee${side}`],
        tubeGeo([
          { y: -spec.shinLength, r: ankleR * 0.92 },
          { y: -spec.shinLength + 0.012, r: ankleR * 1.14 },
          { y: -spec.shinLength + 0.026, r: ankleR },
          { y: -spec.shinLength * 0.5, r: (shinTop + ankleR) * 0.5 },
          { y: 0, r: shinTop },
        ]),
        material,
        `clothingBottomShin${side}`,
        'bottom',
      );
    }
  }
}

function shoeStations(spec, kind, pad) {
  const soleH = (kind === 'flats' ? 0.012 : kind === 'boots' ? 0.028 : 0.02) * (spec.height / 1.8);
  const soleY = spec.footCenterY - spec.footHeight / 2;
  const heelZ = spec.footCenterZ - spec.footLength / 2;
  const toeZ = spec.footCenterZ + spec.footLength / 2;
  const w = spec.footWidth / 2 + pad * 0.45;
  const lip = kind === 'flats' ? pad * 0.2 : pad * 0.55;
  const soleTop = soleY + soleH;
  const pointed = kind === 'flats' ? 0.28 : 0.5;
  const sole = [
    { z: heelZ - pad * 0.05, w: w * 0.7 + lip * 0.3, y0: soleY, y1: soleTop + (kind === 'boots' ? soleH * 0.45 : 0) },
    { z: spec.footCenterZ - spec.footLength * 0.05, w: w + lip, y0: soleY, y1: soleTop },
    { z: spec.footCenterZ + spec.footLength * 0.22, w: w + lip * 0.75, y0: soleY, y1: soleTop },
    { z: toeZ - spec.footLength * 0.06, w: w * pointed + lip * 0.3, y0: soleY + soleH * 0.45, y1: soleTop + soleH * 0.25 },
  ];
  const counter = kind === 'flats' ? spec.footHeight * 0.35 : spec.radii.ankle * 0.85;
  const upper = [
    { z: heelZ + pad * 0.15, w: w * 0.62, y0: soleTop * 0.65 + soleY * 0.35, y1: soleTop + counter },
    { z: spec.footCenterZ, w: w * 0.78, y0: soleY + soleH * 0.55, y1: soleTop + (kind === 'flats' ? spec.footHeight * 0.25 : spec.footHeight * 0.7) },
    { z: spec.footCenterZ + spec.footLength * 0.16, w: w * 0.62, y0: soleY + soleH * 0.6, y1: soleTop + spec.footHeight * (kind === 'flats' ? 0.16 : 0.32) },
    { z: toeZ - spec.footLength * 0.1, w: w * pointed * 0.85, y0: soleY + soleH * 0.85, y1: soleTop + spec.footHeight * (kind === 'flats' ? 0.1 : 0.22) },
  ];
  return { sole, upper, toeZ };
}

function rectLoop(st) {
  return [
    [-st.w, st.y0, st.z],
    [st.w, st.y0, st.z],
    [st.w, st.y1, st.z],
    [-st.w, st.y1, st.z],
  ];
}

function upperLoop(st) {
  return [
    [-st.w, st.y0, st.z],
    [st.w, st.y0, st.z],
    [st.w * 0.72, st.y1, st.z],
    [0, st.y1 + st.w * 0.18, st.z],
    [-st.w * 0.72, st.y1, st.z],
  ];
}

function buildShoe(spec, kind, pad, cuff) {
  const loom = new Loom();
  const { sole, upper, toeZ } = shoeStations(spec, kind, pad);
  loom.material = 0;
  const soleIds = sole.map((st) => loom.add(rectLoop(st)));
  for (let i = 0; i < soleIds.length - 1; i += 1) loom.wall(soleIds[i], soleIds[i + 1]);
  const toe = loom.v(0, sole[sole.length - 1].y1, toeZ + pad * 0.12);
  const last = soleIds[soleIds.length - 1];
  for (let i = 0; i < last.length; i += 1) {
    loom.tri(last[i], last[(i + 1) % last.length], toe);
  }
  loom.material = 1;
  const upperIds = upper.map((st) => loom.add(upperLoop(st)));
  for (let i = 0; i < upperIds.length - 1; i += 1) loom.wall(upperIds[i], upperIds[i + 1]);
  const tip = loom.v(0, upper[upper.length - 1].y1, toeZ + pad * 0.02);
  const uLast = upperIds[upperIds.length - 1];
  for (let i = 0; i < uLast.length; i += 1) {
    loom.tri(uLast[i], uLast[(i + 1) % uLast.length], tip);
  }
  const collar = upper[1];
  const tongueY = collar.y1 + pad * 0.25;
  const tz = collar.z + spec.footLength * 0.12;
  const t0 = loom.v(-collar.w * 0.28, collar.y1, collar.z + 0.01);
  const t1 = loom.v(collar.w * 0.28, collar.y1, collar.z + 0.01);
  const t2 = loom.v(collar.w * 0.18, tongueY, tz);
  const t3 = loom.v(-collar.w * 0.18, tongueY, tz);
  loom.tri(t0, t1, t2);
  loom.tri(t0, t2, t3);
  if (kind === 'boots' && cuff) {
    const r = spec.radii.ankle + pad * 0.85;
    const h = spec.shinLength * 0.42;
    const z = 0;
    const shaft = [
      { y: spec.radii.ankle * 0.2, r },
      { y: h * 0.62, r: r * 1.05 },
      { y: h - 0.01, r: r * 0.96 },
      { y: h, r: r * 1.08 },
    ].sort((a, b) => a.y - b.y);
    const ids = shaft.map((st) => loom.add(circle(8, st.y, st.r).map((p) => [p[0], p[1], p[2] + z])));
    for (let i = 0; i < ids.length - 1; i += 1) loom.wall(ids[i], ids[i + 1]);
  }
  return loom.geometry();
}

function addShoe(ctx, side, kind, pad, cuff, materials) {
  const spec = ctx.spec;
  const mesh = addMesh(
    ctx.joints[`ankle${side}`],
    buildShoe(spec, kind, pad, cuff),
    materials,
    `clothingShoe${side}`,
    'shoes',
  );
  mesh.userData.soleY = spec.footCenterY - spec.footHeight / 2;
  return mesh;
}

export function buildClothing(ctx) {
  if (ctx.root.userData.clothingBuilt) return;
  ctx.root.userData.clothingBuilt = true;
  removeGarments(ctx.root);

  const doc = ctx.document;
  const spec = ctx.spec;
  const pad = clothPad(spec.height);
  const robotTorso = doc.body.torso === 'robot';
  const topId = robotTorso ? 'none' : doc.clothing.top.id;
  const outerId = robotTorso ? 'none' : doc.clothing.outer.id;
  const bottomId = doc.clothing.bottom.id;
  const shoeId = doc.clothing.shoes.id;

  if (topId !== 'none') {
    const material = garmentMaterial(ctx, doc.clothing.top.color);
    const shell = buildShell(spec, doc, topId, pad);
    addMesh(ctx.joints.waist, shell.geometry, material, 'clothingTop', 'top');
    const sleeves = topId === 'tee' ? 'half' : (topId === 'shirt' || topId === 'hoodie' ? 'full' : null);
    if (sleeves) addSleeves(ctx, sleeves, pad, material, 'clothingTop', 'top', topId);
    if (topId === 'hoodie' && doc.head.headwear.id === 'none') addHood(ctx, pad, material);
  }

  if (outerId === 'vest' || outerId === 'jacket') {
    const material = garmentMaterial(ctx, doc.clothing.outer.color);
    const extra = outerId === 'vest' ? pad * 0.35 : pad * 0.7;
    const shell = buildShell(spec, doc, outerId, pad + extra);
    addMesh(ctx.joints.waist, shell.geometry, material, 'clothingOuter', 'outer');
    if (outerId === 'jacket') addSleeves(ctx, 'full', pad + extra, material, 'clothingOuter', 'outer', 'jacket');
  }
  if (outerId === 'cape') {
    addMesh(ctx.joints.waist, buildCape(spec, pad), garmentMaterial(ctx, doc.clothing.outer.color), 'clothingCape', 'outer');
  }

  if (bottomId === 'skirt') {
    const skirt = buildSkirt(spec, pad);
    const mesh = addMesh(ctx.pelvis, skirt.geometry, garmentMaterial(ctx, doc.clothing.bottom.color), 'clothingBottom', 'bottom');
    mesh.userData.hemRadius = skirt.hemRadius;
  } else if (bottomId === 'pants' || bottomId === 'shorts') {
    const material = garmentMaterial(ctx, doc.clothing.bottom.color);
    addMesh(ctx.pelvis, buildBrief(spec, pad), material, 'clothingBottom', 'bottom');
    addLegTubes(ctx, bottomId, pad, material);
  }

  if (shoeId !== 'barefoot') {
    const upper = garmentMaterial(ctx, doc.clothing.shoes.color);
    const sole = garmentMaterial(ctx, doc.clothing.shoes.accent);
    for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
      if (doc.legs[key].type === 'peg') continue;
      const cuff = shoeId === 'boots' && doc.legs[key].type === 'normal';
      addShoe(ctx, side, shoeId, pad, cuff, [sole, upper]);
    }
  }
}
