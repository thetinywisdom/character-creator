import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { CYLINDER_SIDES, JOINT_HEIGHT, JOINT_PHI_START, JOINT_WIDTH } from '../body/geometry.js';
import { MUSCULAR_SCALE } from './limbs.js';

/**
 * Clothes are straight blocks hung off the body, in a regular everyday fit.
 * They do not follow the waist or the limb taper. The shoulder line follows
 * the chest; below that they hang straight. Body meshes stay.
 *
 * A top takes its width from the chest at the shoulder line, not from the
 * shoulder balls, plus about 2 cm of ease. The shoulder line follows the
 * chest: high and narrow at the neck, lower at the outer shoulder. Below
 * that the cloth hangs straight to just under the hips. The shoulder balls
 * belong to the arms: a sleeve is a straight tube a bit wider than the ball,
 * and it overlaps the torso shell.
 *
 * The torso shell is the chest's rounded cross-section, grown by the ease,
 * with smooth normals. Sleeves and pant legs are the limb tubes, a little
 * wider, closed by smooth joint caps. An open front (jacket, vest, cape)
 * does not cover the chest.
 *
 * Robot and skeleton limbs keep their meshes and get no sleeve or pant tube.
 * Peg legs skip pant tubes and shoes. A robot leg skips the pant tube and the
 * boot cuff, and still takes a shoe. A robot torso cannot wear a top or outer.
 */
const N = 12;
const SLEEVE_SIDES = CYLINDER_SIDES;
/** Flats of an 8-gon sit this far inside the vertex radius. */
const SLEEVE_FLAT = Math.cos(Math.PI / SLEEVE_SIDES);

export function clothPad(height) {
  return 0.03 * ((Number(height) || 1.8) / 1.8);
}

/** Regular-fit ease, about 2 cm at 1.8 m, inside the 1.5–3 cm band. */
function fitEase(height) {
  return 0.02 * ((Number(height) || 1.8) / 1.8);
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
      flatShading: false,
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
    this.nrm = [];
    this.idx = [];
    this.mat = [];
    this.material = 0;
    this.hasN = false;
  }

  v(x, y, z, nx, ny, nz) {
    const i = this.pos.length / 3;
    this.pos.push(x, y, z);
    if (nx == null) this.nrm.push(0, 0, 0);
    else {
      this.hasN = true;
      this.nrm.push(nx, ny, nz);
    }
    return i;
  }

  add(points) {
    return points.map((p) => (Array.isArray(p)
      ? this.v(p[0], p[1], p[2])
      : this.v(p.x, p.y, p.z, p.nx, p.ny, p.nz)));
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
    if (this.hasN) geo.setAttribute('normal', new Float32BufferAttribute(this.nrm, 3));
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
    if (!this.hasN) geo.computeVertexNormals();
    return geo;
  }
}

/** Same roundover the chest uses, so a shell reads as that block grown by the ease. */
function clothBevelRadius(minSpan, height) {
  const h = Math.max(height, 1e-4);
  let r = Math.min(minSpan * 0.14, h * 0.09);
  r = Math.min(r, minSpan * 0.22, h * 0.2);
  if (!(r > 1e-4)) r = Math.min(minSpan, h) * 0.08;
  return r;
}

/** Point where a ray from the origin meets a rounded rectangle. */
function roundedBoundary(cosA, sinA, hx, hz, radius) {
  const len = Math.hypot(cosA, sinA) || 1;
  const dx = cosA / len;
  const dz = sinA / len;
  const c = Math.min(Math.max(radius, 0), hx * 0.999, hz * 0.999);
  const ix = hx - c;
  const iz = hz - c;
  const ax = Math.abs(dx);
  const az = Math.abs(dz);
  let tBox = Infinity;
  if (ax > 1e-8) tBox = Math.min(tBox, hx / ax);
  if (az > 1e-8) tBox = Math.min(tBox, hz / az);
  const xBox = dx * tBox;
  const zBox = dz * tBox;
  const onFlat = c < 1e-5 || Math.abs(xBox) <= ix + 1e-4 || Math.abs(zBox) <= iz + 1e-4;
  if (onFlat) {
    const onX = ax > 1e-8 && Math.abs(hx / ax - tBox) <= 1e-3;
    return {
      x: xBox,
      z: zBox,
      nx: onX ? Math.sign(dx) || 1 : 0,
      nz: onX ? 0 : Math.sign(dz) || 1,
    };
  }
  const cx = Math.sign(dx || 1) * ix;
  const cz = Math.sign(dz || 1) * iz;
  const dot = dx * cx + dz * cz;
  const disc = Math.max(dot * dot - (cx * cx + cz * cz - c * c), 0);
  const tHit = dot + Math.sqrt(disc);
  if (!Number.isFinite(tHit) || tHit <= 0) {
    return { x: xBox, z: zBox, nx: Math.sign(dx) || 1, nz: 0 };
  }
  const x = dx * tHit;
  const z = dz * tHit;
  return { x, z, nx: (x - cx) / c, nz: (z - cz) / c };
}

function sectionRing(hx, hz, radius) {
  const pts = [];
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    pts.push(roundedBoundary(Math.cos(a), Math.sin(a), hx, hz, radius));
  }
  return pts;
}

function withY(pts, yAt, normalAt) {
  return pts.map((p) => {
    const y = typeof yAt === 'function' ? yAt(p) : yAt;
    const n = normalAt(p, y);
    return { x: p.x, y, z: p.z, nx: n[0], ny: n[1], nz: n[2] };
  });
}

function wallNormal(p) {
  const len = Math.hypot(p.nx, p.nz) || 1;
  return [p.nx / len, 0, p.nz / len];
}

function lidNormal(p) {
  const nx = p.nx * 0.4;
  const nz = p.nz * 0.4;
  const len = Math.hypot(nx, 1, nz) || 1;
  return [nx / len, 1 / len, nz / len];
}

function shoulderY(size, p, hx, hz) {
  const ang = Math.atan2(p.z / hz, p.x / hx);
  return size.ySide + (size.yNeck - size.ySide) * Math.abs(Math.sin(ang));
}

function radialRing(pts, radius) {
  return pts.map((p) => {
    const len = Math.hypot(p.x, p.z) || 1;
    const nx = p.x / len;
    const nz = p.z / len;
    return { x: nx * radius, z: nz * radius, nx, nz };
  });
}

function skipFront(limit) {
  return (i, j, n) => {
    const si = Math.sin((i / n) * Math.PI * 2);
    const sj = Math.sin((j / n) * Math.PI * 2);
    return si > limit && sj > limit;
  };
}

/**
 * Straight torso block. Width is the chest at the shoulder line, plus ease.
 * The shoulder balls are not included; sleeves cover those. Depth is the
 * chest. The hem may widen a centimetre. The neckline sits just above the
 * chest and the outer shoulder sits just above the chest's shoulder corner,
 * so the cloth follows that slope and then hangs straight. `extra` lifts a
 * vest or jacket a hair off the layer under it.
 */
function torsoFit(spec, ease, extra) {
  const hx = spec.chestTopWidth / 2 + ease + extra;
  // Depth ease is a little larger than the side ease so a top stays outside
  // the pants when the waist leans.
  const hz = Math.max(spec.chestTopDepth, spec.pelvisBottomDepth) / 2 + ease * 1.75 + extra;
  const drop = spec.chestShoulderDrop || 0.03;
  const yNeck = spec.chestHeight + ease + extra * 0.35;
  const ySide = Math.min(
    spec.chestHeight - drop + ease * 0.65 + extra * 0.15,
    yNeck - 0.02,
  );
  const y0 = -spec.pelvisHeight - ease * 0.45;
  const flare = Math.min(ease * 0.45, 0.01);
  return {
    hx,
    hz,
    y0,
    ySide,
    yNeck,
    flare,
    neckR: spec.radii.neck * 1.12,
    ease,
    extra,
    corner: clothBevelRadius(
      Math.min(spec.chestTopWidth, Math.max(spec.chestTopDepth, spec.pelvisBottomDepth)),
      spec.chestMeshHeight,
    ),
  };
}

/**
 * True when a point in the shell's local space sits inside the torso block.
 * The test uses the shoulder-line cross-section, which is the narrowest part
 * of the hanging block. `margin` shrinks that cross-section.
 */
export function pointInsideShell(shell, x, y, z, margin = 0) {
  const hx = shell.hx - margin;
  const hz = shell.hz - margin;
  if (!(hx > 0) || !(hz > 0)) return false;
  if (y < shell.y0 + margin) return false;
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax > hx || az > hz) return false;
  const r = Math.min(shell.corner || 0, hx * 0.999, hz * 0.999);
  if (r > 0 && ax > hx - r && az > hz - r) {
    const dx = ax - (hx - r);
    const dz = az - (hz - r);
    if (dx * dx + dz * dz > r * r) return false;
  }
  const ang = Math.atan2(z / hz, x / hx);
  const yLid = shell.ySide + (shell.yNeck - shell.ySide) * Math.abs(Math.sin(ang));
  return y <= yLid - margin;
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
      const len = Math.hypot(p.x, p.z) || 1;
      const ix = -p.x / len;
      const iz = -p.z / len;
      return loom.v(p.x + ix * depth, p.y, p.z + iz * depth, ix, 0, iz);
    });
    loom.strip(shell, lip);
  }
}

/**
 * Straight block. The hem is only slightly wider than the shoulders.
 * The cross-section is the chest's rounded rectangle. The lid slopes from
 * the neck down to the outer shoulder and keeps a neck hole.
 */
function buildBlock(size, frontLimit) {
  const { hx, hz, y0, flare, neckR } = size;
  const corner = size.corner || clothBevelRadius(Math.min(hx, hz) * 2, size.yNeck - y0);
  const loom = new Loom();
  const hemW = hx + flare;
  const hemD = hz + flare * 0.45;
  const hem = withY(sectionRing(hemW, hemD, corner), y0, wallNormal);
  const lip = withY(sectionRing(hemW * 0.9, hemD * 0.9, corner * 0.9), y0 + 0.012, wallNormal);
  const topPts = sectionRing(hx, hz, corner);
  const yAt = (p) => shoulderY(size, p, hx, hz);
  const topWall = withY(topPts, yAt, wallNormal);
  const topLid = withY(topPts, yAt, lidNormal);
  const neck = withY(radialRing(topPts, neckR), size.yNeck, () => [0, 1, 0]);
  const ids = [hem, lip, topWall, topLid, neck].map((pts) => loom.add(pts));
  const skip = frontLimit == null ? null : skipFront(frontLimit);
  loom.wall(ids[0], ids[1]);
  loom.wall(ids[0], ids[2], skip);
  loom.cap(ids[3], ids[4], skip);
  if (skip) cutLip(loom, [hem, topWall, neck], [ids[0], ids[2], ids[4]], skip, 0.014);
  return loom.geometry();
}

function collarBlock(size) {
  const { hx, hz, y0, flare, neckR } = size;
  const corner = size.corner || clothBevelRadius(Math.min(hx, hz) * 2, size.yNeck - y0);
  const loom = new Loom();
  const collarR = neckR * 1.65;
  const hem = withY(sectionRing(hx + flare, hz + flare * 0.45, corner), y0, wallNormal);
  const topPts = sectionRing(hx, hz, corner);
  const yAt = (p) => shoulderY(size, p, hx, hz);
  const topWall = withY(topPts, yAt, wallNormal);
  const topLid = withY(topPts, yAt, lidNormal);
  const collar = withY(radialRing(topPts, collarR), size.yNeck, wallNormal);
  const neck = withY(radialRing(topPts, neckR), size.yNeck + 0.016, wallNormal);
  const ids = [hem, topWall, topLid, collar, neck].map((pts) => loom.add(pts));
  loom.wall(ids[0], ids[1]);
  loom.cap(ids[2], ids[3]);
  loom.wall(ids[3], ids[4]);
  return loom.geometry();
}

function hangCylinder(parent, radius, yTop, yBottom, material, name, garment, sleeve, open = false) {
  const height = Math.max(yTop - yBottom, 0.02);
  const geo = new CylinderGeometry(radius, radius, height, SLEEVE_SIDES, 1, open);
  const mesh = addMesh(parent, geo, material, name, garment);
  mesh.position.y = (yTop + yBottom) / 2;
  if (sleeve) mesh.userData.sleeve = sleeve;
  return mesh;
}

/** Round cloth joint. A sphere does not grow a spike when the limb turns. */
function hangCap(parent, radius, material, name, garment) {
  const geo = new SphereGeometry(radius, JOINT_WIDTH, JOINT_HEIGHT, JOINT_PHI_START);
  const mesh = addMesh(parent, geo, material, name, garment);
  mesh.userData.capRadius = radius;
  return mesh;
}

/**
 * Sleeve girth is the shoulder ball plus the same ease as the torso, measured
 * at the flats of the 8-gon. The tube is open at the shoulder and starts
 * inside a round cap, so a swing cannot flip a closed top up into a spike.
 */
function sleeveShape(ball, ease, extra, yBottom) {
  const inscribed = ball + ease + extra;
  const radius = inscribed / SLEEVE_FLAT;
  const capRadius = radius + Math.min(ease * 0.2, 0.005) + extra * 0.15;
  const yTop = Math.min(capRadius * 0.22, ball * 0.35);
  return {
    radius,
    inscribed,
    capRadius,
    yTop,
    yBottom,
    ball,
  };
}

function addSleeves(ctx, kind, fit, material, prefix, garment) {
  const spec = ctx.spec;
  const doc = ctx.document;
  const ease = fit.ease;
  const extra = fit.extra;
  for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
    if (!clothArm(doc.arms[key].type)) continue;
    const scale = doc.arms[key].type === 'muscular' ? MUSCULAR_SCALE : 1;
    const ball = spec.radii.shoulder * scale;
    let yBottom = kind === 'half' ? -spec.upperArmLength * 0.42 : -spec.upperArmLength;
    const sleeve = sleeveShape(ball, ease, extra, yBottom);
    if (kind === 'half') {
      const limit = spec.upperArmLength * 0.66;
      if (sleeve.yTop - yBottom > limit) yBottom = sleeve.yTop - limit;
      yBottom = Math.min(yBottom, -(ball + ease * 0.15));
      sleeve.yBottom = yBottom;
    }
    const shoulder = ctx.joints[`shoulder${side}`];
    hangCap(shoulder, sleeve.capRadius, material, `${prefix}Cap${side}`, garment);
    hangCylinder(
      shoulder,
      sleeve.radius,
      sleeve.yTop,
      sleeve.yBottom,
      material,
      `${prefix}Upper${side}`,
      garment,
      sleeve,
      true,
    );
    if (kind === 'full') {
      const elbow = ctx.joints[`elbow${side}`];
      const elbowR = sleeve.radius + Math.min(ease * 0.15, 0.004);
      hangCap(elbow, elbowR, material, `${prefix}Elbow${side}`, garment);
      hangCylinder(
        elbow,
        sleeve.radius,
        Math.min(elbowR * 0.22, 0.012 + extra),
        -spec.forearmLength,
        material,
        `${prefix}Forearm${side}`,
        garment,
        null,
        true,
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

function skirtSize(spec, pad, ease) {
  const leg = spec.thighLength + spec.shinLength;
  const scale = leg / 0.82;
  const stride = Math.min(1.5, Math.max(0.8, 0.55 + 0.32 * 1.6)) * scale;
  const footForward = stride * 0.6 * 0.5;
  const kneeForward = footForward * (spec.thighLength / leg);
  const lateral = spec.hipWidth / 2 + spec.radii.knee + pad;
  const rTop = spec.radii.waist + ease;
  return {
    yTop: spec.pelvisHeight * 0.92,
    yBottom: -spec.thighLength + spec.radii.knee,
    rTop,
    rHem: Math.max(Math.hypot(lateral, kneeForward), rTop + ease * 2),
  };
}

function buildSkirt(spec, pad, ease) {
  const hem = skirtSize(spec, pad, ease);
  const height = Math.max(hem.yTop - hem.yBottom, 0.04);
  const geo = new CylinderGeometry(hem.rTop, hem.rHem, height, CYLINDER_SIDES, 1, false);
  geo.translate(0, (hem.yTop + hem.yBottom) / 2, 0);
  geo.userData.hemRadius = hem.rHem;
  geo.userData.waistRadius = hem.rTop;
  return geo;
}

function addWaistBlock(ctx, ease, material) {
  const spec = ctx.spec;
  const y1 = spec.pelvisHeight * 0.9;
  const y0 = -ease * 0.35;
  const hx = spec.hipWidth / 2 + spec.radii.hip + ease;
  // Sit inside a top. The top uses the full ease on the same torso depth,
  // so a full ease here puts the waistband on the shirt and it shows through.
  const hz = Math.max(spec.pelvisBottomDepth, spec.pelvisTopDepth) / 2 + ease * 0.35;
  const geo = buildBlock({
    hx,
    hz,
    y0,
    yNeck: y1,
    ySide: y1,
    flare: ease * 0.15,
    neckR: spec.radii.waist * 0.45,
    corner: clothBevelRadius(Math.min(hx, hz) * 2, y1 - y0),
  }, null);
  return addMesh(ctx.pelvis, geo, material, 'clothingBottom', 'bottom');
}

function addLegTubes(ctx, part, ease, material) {
  const spec = ctx.spec;
  const doc = ctx.document;
  const legR = spec.radii.hip + ease;
  const kneeR = legR + Math.min(ease * 0.2, 0.005);
  for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
    if (!clothLeg(doc.legs[key].type)) continue;
    const thighLen = part === 'shorts' ? spec.thighLength * 0.5 : spec.thighLength;
    hangCylinder(
      ctx.joints[`hip${side}`],
      legR,
      0.008,
      part === 'shorts' ? -thighLen : -spec.thighLength + kneeR * 0.2,
      material,
      `clothingBottomThigh${side}`,
      'bottom',
      null,
      true,
    );
    if (part === 'pants') {
      hangCap(ctx.joints[`knee${side}`], kneeR, material, `clothingBottomKnee${side}`, 'bottom');
      hangCylinder(
        ctx.joints[`knee${side}`],
        legR,
        kneeR * 0.2,
        -spec.shinLength,
        material,
        `clothingBottomShin${side}`,
        'bottom',
        null,
        true,
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

function addShoe(ctx, side, kind, ease, cuff, materials) {
  const spec = ctx.spec;
  const soleH = (kind === 'flats' ? 0.012 : kind === 'boots' ? 0.022 : 0.016) * (spec.height / 1.8);
  const soleY = spec.footCenterY - spec.footHeight / 2;
  const width = spec.footWidth + ease;
  const length = spec.footLength + ease * 0.55;
  const z = spec.footCenterZ;
  const parts = [];
  const sole = new BoxGeometry(width, soleH, length);
  sole.translate(0, soleY + soleH / 2, z);
  parts.push({ geometry: sole, materialIndex: 0 });
  const upperH = kind === 'flats' ? spec.footHeight * 0.55 : spec.footHeight * 0.92;
  const upper = new BoxGeometry(width * 0.9, upperH, length * 0.92);
  upper.translate(0, soleY + soleH * 0.45 + upperH / 2, z + length * 0.015);
  parts.push({ geometry: upper, materialIndex: 1 });
  if (kind === 'boots' && cuff) {
    const cuffLen = Math.max(spec.shinLength * 0.38, spec.radii.ankle * 2.6);
    const tubeR = spec.radii.ankle + ease * 0.75;
    const tube = new CylinderGeometry(tubeR, tubeR, cuffLen, CYLINDER_SIDES, 1, false);
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
  const ease = fitEase(spec.height);
  const room = 0.01 * (spec.height / 1.8);
  const robotTorso = doc.body.torso === 'robot';
  const topId = robotTorso ? 'none' : doc.clothing.top.id;
  const outerId = robotTorso ? 'none' : doc.clothing.outer.id;

  if (topId !== 'none') {
    const material = garmentMaterial(ctx, doc.clothing.top.color);
    const extra = topId === 'hoodie' ? room : 0;
    const size = torsoFit(spec, ease, extra);
    const geo = topId === 'shirt' ? collarBlock(size) : buildBlock(size, null);
    const mesh = addMesh(ctx.joints.waist, geo, material, 'clothingTop', 'top');
    mesh.userData.shell = size;
    const sleeves = topId === 'tee' ? 'half' : (topId === 'shirt' || topId === 'hoodie' ? 'full' : null);
    if (sleeves) addSleeves(ctx, sleeves, size, material, 'clothingTop', 'top');
    if (topId === 'hoodie' && doc.head.headwear.id === 'none') {
      addMesh(ctx.joints.neck, buildHood(spec, pad), material, 'clothingTopHood', 'top');
    }
  }

  if (outerId === 'vest' || outerId === 'jacket') {
    const material = garmentMaterial(ctx, doc.clothing.outer.color);
    const extra = outerId === 'vest' ? room * 0.5 : room;
    const size = torsoFit(spec, ease, extra);
    size.openFront = true;
    const mesh = addMesh(
      ctx.joints.waist,
      buildBlock(size, outerId === 'vest' ? 0.45 : 0.72),
      material,
      'clothingOuter',
      'outer',
    );
    mesh.userData.shell = size;
    if (outerId === 'jacket') addSleeves(ctx, 'full', size, material, 'clothingOuter', 'outer');
  }
  if (outerId === 'cape') {
    addMesh(ctx.joints.waist, buildCape(spec, pad), garmentMaterial(ctx, doc.clothing.outer.color), 'clothingCape', 'outer');
  }

  const bottomId = doc.clothing.bottom.id;
  if (bottomId === 'skirt') {
    const geo = buildSkirt(spec, pad, ease);
    const mesh = addMesh(ctx.pelvis, geo, garmentMaterial(ctx, doc.clothing.bottom.color), 'clothingBottom', 'bottom');
    mesh.userData.hemRadius = geo.userData.hemRadius;
    mesh.userData.waistRadius = geo.userData.waistRadius;
  } else if (bottomId === 'pants' || bottomId === 'shorts') {
    const material = garmentMaterial(ctx, doc.clothing.bottom.color);
    addWaistBlock(ctx, ease, material);
    addLegTubes(ctx, bottomId, ease, material);
  }

  const shoeId = doc.clothing.shoes.id;
  if (shoeId !== 'barefoot') {
    const upper = garmentMaterial(ctx, doc.clothing.shoes.color);
    const sole = garmentMaterial(ctx, doc.clothing.shoes.accent);
    for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
      if (doc.legs[key].type === 'peg') continue;
      const cuff = shoeId === 'boots' && doc.legs[key].type === 'normal';
      addShoe(ctx, side, shoeId, ease, cuff, [sole, upper]);
    }
  }

  concealCovered(ctx, topId, outerId, bottomId, shoeId);
}

/**
 * Meshes a garment fully covers. An open front leaves the chest out: a jacket,
 * vest, or cape does not replace the torso. A short sleeve covers the shoulder
 * ball and leaves the rest of the arm. None and barefoot cover nothing.
 */
const FULL_COVER = {
  tank: ['chest'],
  tee: ['chest', 'shoulderL', 'shoulderR'],
  shirt: ['chest', 'shoulderL', 'shoulderR', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR', 'elbowL', 'elbowR', 'wristL', 'wristR'],
  hoodie: ['chest', 'shoulderL', 'shoulderR', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR', 'elbowL', 'elbowR', 'wristL', 'wristR'],
  jacket: ['shoulderL', 'shoulderR', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR', 'elbowL', 'elbowR', 'wristL', 'wristR'],
  pants: ['pelvis', 'hipL', 'hipR', 'thighL', 'thighR', 'kneeL', 'kneeR', 'shinL', 'shinR'],
  shorts: ['pelvis', 'hipL', 'hipR'],
  skirt: ['pelvis', 'hipL', 'hipR', 'thighL', 'thighR'],
  sneakers: ['footL', 'footR'],
  boots: ['footL', 'footR', 'ankleL', 'ankleR'],
  flats: ['footL', 'footR'],
};

const ARM_ROLE = /^(shoulder|upperArm|forearm|elbow|wrist)/;
const LEG_ROLE = /^(hip|thigh|knee|shin|foot|ankle)/;

function concealCovered(ctx, topId, outerId, bottomId, shoeId) {
  const doc = ctx.document;
  const roles = new Set();
  for (const id of [topId, outerId, bottomId, shoeId]) {
    for (const role of FULL_COVER[id] || []) roles.add(role);
  }
  for (const role of roles) {
    const side = role.endsWith('L') ? 'left' : role.endsWith('R') ? 'right' : null;
    if (side && ARM_ROLE.test(role) && !clothArm(doc.arms[side].type)) continue;
    if (side && LEG_ROLE.test(role) && !clothLeg(doc.legs[side].type)) continue;
    const mesh = ctx.root.getObjectByName(`${role}Mesh`);
    if (mesh) mesh.visible = false;
  }
}
