import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { MUSCULAR_SCALE } from './limbs.js';

/**
 * Clothes are loose straight blocks hung over the naked body. They do not
 * follow the waist, chest, or limb taper. Body meshes stay. Overlap is fine.
 *
 * A top is one roomy block from the shoulder line to just below the hips,
 * flat across the top, with a small neck hole. Sleeves are straight wide
 * tubes parented to the arm joints. A sleeve cap covers the shoulder ball.
 *
 * Robot and skeleton limbs keep their meshes and get no sleeve or pant tube.
 * Peg legs skip pant tubes and shoes. A robot leg skips the pant tube and the
 * boot cuff, and still takes a shoe. A robot torso cannot wear a top or outer.
 */
const N = 12;

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

  wall(lower, upper, skip) {
    const n = lower.length;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      if (skip && skip(i, j, n)) continue;
      this.tri(lower[i], upper[j], lower[j]);
      this.tri(lower[i], upper[i], upper[j]);
    }
  }

  cap(outer, inner, skip) {
    const n = outer.length;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      if (skip && skip(i, j, n)) continue;
      this.tri(outer[i], inner[j], outer[j]);
      this.tri(outer[i], inner[i], inner[j]);
    }
  }

  strip(a, b) {
    for (let i = 0; i < a.length - 1; i += 1) {
      this.tri(a[i], b[i + 1], a[i + 1]);
      this.tri(a[i], b[i], b[i + 1]);
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

function loop(n, fn) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    pts.push(fn(Math.cos(a), Math.sin(a), i));
  }
  return pts;
}

/** Rounded rectangle. Higher p is a sharper box; the corners stay beveled. */
function roundRect(y, hx, hz, p) {
  return loop(N, (c, s) => {
    const d = (Math.abs(c) ** p + Math.abs(s) ** p) ** (1 / p) || 1;
    return [(c / d) * hx, y, (s / d) * hz];
  });
}

function circle(y, r) {
  return loop(N, (c, s) => [c * r, y, s * r]);
}

function skipFront(limit) {
  return (i, j, n) => {
    const si = Math.sin((i / n) * Math.PI * 2);
    const sj = Math.sin((j / n) * Math.PI * 2);
    return si > limit && sj > limit;
  };
}

function shoulderBall(spec, doc) {
  let r = spec.radii.shoulder;
  for (const key of ['left', 'right']) {
    if (doc.arms[key].type === 'muscular') r = Math.max(r, spec.radii.shoulder * MUSCULAR_SCALE);
  }
  return r;
}

function blockSize(spec, ball, pad, extra) {
  const hx = Math.max(
    spec.shoulderWidth / 2 + ball + pad,
    spec.chestTopWidth / 2 + pad * 1.5,
    spec.pelvisBottomWidth / 2 + pad,
  ) + extra;
  const hz = Math.max(spec.chestTopDepth, spec.pelvisBottomDepth, spec.chestBottomDepth) / 2 + pad * 1.6 + extra;
  const y1 = Math.max(spec.chestHeight, spec.chestHeight * spec.shoulderT + ball) + pad * 0.5;
  const y0 = -spec.pelvisHeight * 1.05;
  return { hx, hz, y0, y1, neckR: spec.radii.neck * 1.2 };
}

function cutLip(loom, rings, ids, pred, depth) {
  const n = rings[0].length;
  const bounds = [];
  for (let i = 0; i < n; i += 1) {
    const prev = (i + n - 1) % n;
    const next = (i + 1) % n;
    if (pred(prev, i, n) !== pred(i, next, n)) bounds.push(i);
  }
  for (const bi of bounds) {
    const shell = ids.map((id) => id[bi]);
    const lip = rings.map((pts) => {
      const p = pts[bi];
      const len = Math.hypot(p[0], p[2]) || 1;
      return loom.v(p[0] - (p[0] / len) * depth, p[1], p[2] - (p[2] / len) * depth);
    });
    loom.strip(shell, lip);
  }
}

/**
 * Straight roomy block. Same width at the shoulder and the hem.
 * The top is a flat lid with a neck hole. `power` bevels the corners.
 */
function buildBlock(size, power, frontLimit) {
  const { hx, hz, y0, y1, neckR } = size;
  const loom = new Loom();
  const hem = roundRect(y0, hx, hz, power);
  const lip = roundRect(y0 + 0.012, hx * 0.9, hz * 0.9, power);
  const top = roundRect(y1, hx, hz, power);
  const neck = circle(y1, neckR);
  const ids = [hem, lip, top, neck].map((pts) => loom.add(pts));
  const skip = frontLimit == null ? null : skipFront(frontLimit);
  loom.wall(ids[0], ids[1]);
  loom.wall(ids[0], ids[2], skip);
  loom.cap(ids[2], ids[3], skip);
  if (skip) cutLip(loom, [hem, top, neck], [ids[0], ids[2], ids[3]], skip, 0.014);
  return loom.geometry();
}

function collarBlock(size, power) {
  const { hx, hz, y0, y1, neckR } = size;
  const loom = new Loom();
  const collarR = neckR * 1.65;
  const hem = roundRect(y0, hx, hz, power);
  const top = roundRect(y1, hx, hz, power);
  const collar = circle(y1, collarR);
  const neck = circle(y1 + 0.02, neckR);
  const ids = [hem, top, collar, neck].map((pts) => loom.add(pts));
  loom.wall(ids[0], ids[1]);
  loom.cap(ids[1], ids[2]);
  loom.wall(ids[2], ids[3]);
  return loom.geometry();
}

function hangCylinder(parent, radius, yTop, yBottom, material, name, garment) {
  const height = Math.max(yTop - yBottom, 0.02);
  const geo = new CylinderGeometry(radius, radius, height, 8, 1, false);
  const mesh = addMesh(parent, geo, material, name, garment);
  mesh.position.y = (yTop + yBottom) / 2;
  return mesh;
}

function addSleeves(ctx, kind, pad, material, prefix, garment) {
  const spec = ctx.spec;
  const doc = ctx.document;
  for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
    if (!clothArm(doc.arms[key].type)) continue;
    const scale = doc.arms[key].type === 'muscular' ? MUSCULAR_SCALE : 1;
    const shoulder = spec.radii.shoulder * scale;
    const elbow = spec.radii.elbow * scale;
    const wrist = spec.radii.wrist * scale;
    const wide = pad * 2.1;
    const cap = shoulder + pad * 0.35;
    if (kind === 'half') {
      hangCylinder(
        ctx.joints[`shoulder${side}`],
        shoulder + wide,
        cap,
        -spec.upperArmLength * 0.45,
        material,
        `${prefix}Upper${side}`,
        garment,
      );
    } else {
      hangCylinder(
        ctx.joints[`shoulder${side}`],
        Math.max(shoulder, elbow) + wide,
        cap,
        -spec.upperArmLength,
        material,
        `${prefix}Upper${side}`,
        garment,
      );
      hangCylinder(
        ctx.joints[`elbow${side}`],
        Math.max(elbow, wrist) + wide * 0.85,
        pad * 0.4,
        -spec.forearmLength,
        material,
        `${prefix}Forearm${side}`,
        garment,
      );
    }
  }
}

function buildHood(spec, pad) {
  const loom = new Loom();
  const neckR = spec.radii.neck;
  const headR = spec.headRy;
  const segments = 6;
  const stations = [
    { y: -0.012, z: -neckR * 0.9, rx: neckR * 1.7, rz: 0.016 },
    { y: spec.neckLength * 0.22, z: -neckR * 1.1, rx: neckR * 2.1, rz: neckR * 0.45 },
    { y: spec.neckLength * 0.75, z: -headR * 0.62, rx: headR * 0.9, rz: headR * 0.32 },
    { y: spec.neckLength + headR * 0.62, z: -headR * 0.18, rx: headR * 0.42, rz: headR * 0.16 },
  ];
  const arc = (st, inset) => {
    const pts = [];
    const span = 1.35;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const theta = -span + 2 * span * t;
      let x = Math.sin(theta) * st.rx;
      let y = st.y;
      let z = st.z - Math.cos(theta) * st.rz;
      if (inset) {
        const dx = -x;
        const dy = spec.neckLength * 0.8 - y;
        const dz = 0.02 - z;
        const len = Math.hypot(dx, dy, dz) || 1;
        const d = Math.max(pad * 0.45, 0.012);
        x += (dx / len) * d;
        y += (dy / len) * d;
        z += (dz / len) * d;
      }
      pts.push([x, y, z]);
    }
    return pts;
  };
  const outer = stations.map((st) => loom.add(arc(st, false)));
  const inner = stations.map((st) => loom.add(arc(st, true)));
  for (let i = 0; i < outer.length - 1; i += 1) {
    loom.strip(outer[i], outer[i + 1]);
    loom.strip(inner[i + 1], inner[i]);
    loom.tri(outer[i][0], inner[i][0], inner[i + 1][0]);
    loom.tri(outer[i][0], inner[i + 1][0], outer[i + 1][0]);
    const c = segments;
    loom.tri(outer[i][c], outer[i + 1][c], inner[i + 1][c]);
    loom.tri(outer[i][c], inner[i + 1][c], inner[i][c]);
  }
  loom.strip(inner[0], outer[0]);
  const last = outer.length - 1;
  const tip = loom.v(0, spec.neckLength + headR * 0.88, -headR * 0.04);
  for (let i = 0; i < segments; i += 1) loom.tri(outer[last][i], outer[last][i + 1], tip);
  return loom.geometry();
}

function buildCape(spec, pad) {
  const y0 = -spec.pelvisHeight * 1.08;
  const y1 = spec.chestHeight * 0.92;
  const width = Math.max(spec.shoulderWidth * 1.05, spec.chestTopWidth + pad * 2);
  const thick = Math.max(pad * 0.7, 0.018);
  const geo = new BoxGeometry(width, y1 - y0, thick);
  geo.translate(0, (y0 + y1) / 2, -(Math.max(spec.chestTopDepth, spec.chestBottomDepth) / 2 + pad + thick));
  return geo;
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
    rTop: spec.radii.waist + pad * 1.4,
    rHem: Math.hypot(lateral, kneeForward) + pad,
  };
}

function buildSkirt(spec, pad) {
  const hem = skirtSize(spec, pad);
  const height = Math.max(hem.yTop - hem.yBottom, 0.04);
  const geo = new CylinderGeometry(hem.rTop, hem.rHem, height, 8, 1, false);
  geo.translate(0, (hem.yTop + hem.yBottom) / 2, 0);
  geo.userData.hemRadius = hem.rHem;
  geo.userData.waistRadius = hem.rTop;
  return geo;
}

function addWaistBlock(ctx, pad, material) {
  const spec = ctx.spec;
  const y1 = spec.pelvisHeight * 0.94;
  const y0 = -pad * 0.4;
  const hx = Math.max(spec.pelvisBottomWidth, spec.hipWidth + spec.radii.hip * 2) / 2 + pad * 1.3;
  const hz = spec.pelvisBottomDepth / 2 + pad * 1.3;
  const geo = buildBlock({ hx, hz, y0, y1, neckR: spec.radii.waist * 0.55 }, 8, null);
  return addMesh(ctx.pelvis, geo, material, 'clothingBottom', 'bottom');
}

function addLegTubes(ctx, part, pad, material) {
  const spec = ctx.spec;
  const doc = ctx.document;
  for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
    if (!clothLeg(doc.legs[key].type)) continue;
    const thighR = Math.max(spec.radii.hip, spec.radii.knee) + pad * 2;
    const thighLen = part === 'shorts' ? spec.thighLength * 0.5 : spec.thighLength;
    hangCylinder(
      ctx.joints[`hip${side}`],
      thighR,
      pad * 0.2,
      -thighLen,
      material,
      `clothingBottomThigh${side}`,
      'bottom',
    );
    if (part === 'pants') {
      const shinR = Math.max(spec.radii.knee, spec.radii.ankle) + pad * 1.7;
      hangCylinder(
        ctx.joints[`knee${side}`],
        shinR,
        pad * 0.25,
        -spec.shinLength,
        material,
        `clothingBottomShin${side}`,
        'bottom',
      );
    }
  }
}

function mergeParts(parts) {
  const positions = [];
  const indices = [];
  const groups = [];
  for (const part of parts) {
    const pos = part.geometry.attributes.position;
    const index = part.geometry.index;
    const base = positions.length / 3;
    const start = indices.length;
    for (let i = 0; i < pos.count; i += 1) positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    for (let i = 0; i < index.count; i += 1) indices.push(index.getX(i) + base);
    groups.push({ start, count: index.count, materialIndex: part.materialIndex });
    part.geometry.dispose();
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  for (const group of groups) geo.addGroup(group.start, group.count, group.materialIndex);
  geo.computeVertexNormals();
  return geo;
}

function addShoe(ctx, side, kind, pad, cuff, materials) {
  const spec = ctx.spec;
  const soleH = (kind === 'flats' ? 0.014 : kind === 'boots' ? 0.026 : 0.02) * (spec.height / 1.8);
  const soleY = spec.footCenterY - spec.footHeight / 2;
  const width = spec.footWidth + pad * 2.2;
  const length = spec.footLength + pad * 1.6;
  const z = spec.footCenterZ;
  const parts = [];
  const sole = new BoxGeometry(width, soleH, length);
  sole.translate(0, soleY + soleH / 2, z);
  parts.push({ geometry: sole, materialIndex: 0 });
  const upperH = kind === 'flats' ? spec.footHeight * 0.55 : spec.footHeight * 0.95;
  const upper = new BoxGeometry(width * 0.88, upperH, length * 0.9);
  upper.translate(0, soleY + soleH * 0.45 + upperH / 2, z + length * 0.02);
  parts.push({ geometry: upper, materialIndex: 1 });
  if (kind === 'boots' && cuff) {
    const cuffLen = Math.max(spec.shinLength * 0.38, spec.radii.ankle * 2.6);
    const tube = new CylinderGeometry(spec.radii.ankle + pad, spec.radii.ankle + pad, cuffLen, 8, 1, false);
    tube.translate(0, cuffLen / 2, 0);
    parts.push({ geometry: tube, materialIndex: 1 });
  }
  const mesh = addMesh(ctx.joints[`ankle${side}`], mergeParts(parts), materials, `clothingShoe${side}`, 'shoes');
  mesh.userData.soleY = soleY;
  return mesh;
}

export function buildClothing(ctx) {
  if (ctx.root.userData.clothingBuilt) return;
  ctx.root.userData.clothingBuilt = true;
  removeGarments(ctx.root);

  const doc = ctx.document;
  const spec = ctx.spec;
  const pad = clothPad(spec.height);
  const ball = shoulderBall(spec, doc);
  const robotTorso = doc.body.torso === 'robot';
  const topId = robotTorso ? 'none' : doc.clothing.top.id;
  const outerId = robotTorso ? 'none' : doc.clothing.outer.id;

  if (topId !== 'none') {
    const material = garmentMaterial(ctx, doc.clothing.top.color);
    const extra = topId === 'hoodie' ? pad * 0.55 : 0;
    const power = topId === 'tank' ? 4 : 8;
    const size = blockSize(spec, ball, pad, extra);
    const geo = topId === 'shirt' ? collarBlock(size, power) : buildBlock(size, power, null);
    addMesh(ctx.joints.waist, geo, material, 'clothingTop', 'top');
    const sleeves = topId === 'tee' ? 'half' : (topId === 'shirt' || topId === 'hoodie' ? 'full' : null);
    if (sleeves) addSleeves(ctx, sleeves, pad, material, 'clothingTop', 'top');
    if (topId === 'hoodie' && doc.head.headwear.id === 'none') {
      addMesh(ctx.joints.neck, buildHood(spec, pad), material, 'clothingTopHood', 'top');
    }
  }

  if (outerId === 'vest' || outerId === 'jacket') {
    const material = garmentMaterial(ctx, doc.clothing.outer.color);
    const extra = outerId === 'vest' ? pad * 0.85 : pad * 1.15;
    const size = blockSize(spec, ball, pad, extra);
    addMesh(ctx.joints.waist, buildBlock(size, 8, outerId === 'vest' ? 0.45 : 0.72), material, 'clothingOuter', 'outer');
    if (outerId === 'jacket') addSleeves(ctx, 'full', pad + extra * 0.35, material, 'clothingOuter', 'outer');
  }
  if (outerId === 'cape') {
    addMesh(ctx.joints.waist, buildCape(spec, pad), garmentMaterial(ctx, doc.clothing.outer.color), 'clothingCape', 'outer');
  }

  const bottomId = doc.clothing.bottom.id;
  if (bottomId === 'skirt') {
    const geo = buildSkirt(spec, pad);
    const mesh = addMesh(ctx.pelvis, geo, garmentMaterial(ctx, doc.clothing.bottom.color), 'clothingBottom', 'bottom');
    mesh.userData.hemRadius = geo.userData.hemRadius;
    mesh.userData.waistRadius = geo.userData.waistRadius;
  } else if (bottomId === 'pants' || bottomId === 'shorts') {
    const material = garmentMaterial(ctx, doc.clothing.bottom.color);
    addWaistBlock(ctx, pad, material);
    addLegTubes(ctx, bottomId, pad, material);
  }

  const shoeId = doc.clothing.shoes.id;
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
