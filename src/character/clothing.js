import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Matrix4,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from 'three';
import { createTaperMesh } from '../body/geometry.js';
import { MUSCULAR_SCALE, materialFor } from './limbs.js';

/**
 * One compositor for top, outer, bottom, and shoes.
 * A jacket replaces the top, including a hoodie hood. A vest replaces the
 * torso shell and keeps the top's sleeves. A cape covers nothing.
 *
 * Robot and skeleton limbs keep their meshes: sleeves and pant tubes are
 * skipped on those sides, and the garment id is not rejected. Peg legs skip
 * pant tubes and shoes. Robot legs skip pant tubes and boot cuffs, and they
 * still take a shoe in place of the foot. A robot torso still cannot wear a
 * top or outer layer.
 *
 * A tee sleeve replaces the whole upper-arm mesh and stops at the elbow ball.
 * Stopping mid-bicep would open a hole once that mesh is gone. A shirt or
 * jacket continues to the wrist ball. Shorts stop at the knee ball.
 */
const GARMENTS = ['clothingTop', 'clothingOuter', 'clothingBottom', 'clothingShoes'];

const _mat = new Matrix4();
const _point = new Vector3();

export function shellGap(height) {
  return 0.01 * ((Number(height) || 1.8) / 1.8);
}

function removeGarments(root) {
  for (const name of GARMENTS) {
    const mesh = root.getObjectByName(name);
    if (!mesh) continue;
    mesh.geometry.dispose();
    if (mesh.skeleton?.boneTexture) mesh.skeleton.boneTexture.dispose();
    mesh.removeFromParent();
  }
}

function dropMesh(root, name) {
  const mesh = root.getObjectByName(name);
  if (!mesh) return;
  mesh.geometry.dispose();
  mesh.removeFromParent();
}

function blockOf(root, name) {
  const mesh = root.getObjectByName(name);
  const data = mesh?.geometry?.userData;
  if (!data?.height) return null;
  return {
    height: data.height,
    bottomWidth: data.bottomWidth,
    topWidth: data.topWidth,
    bottomDepth: data.bottomDepth,
    topDepth: data.topDepth,
    offsetY: mesh.position.y,
  };
}

function clothArm(type) {
  return type === 'normal' || type === 'muscular';
}

function clothLeg(type) {
  return type === 'normal';
}

function armRadii(spec, type) {
  const scale = type === 'muscular' ? MUSCULAR_SCALE : 1;
  return {
    shoulder: spec.radii.shoulder * scale,
    elbow: spec.radii.elbow * scale,
    wrist: spec.radii.wrist * scale,
  };
}

function chestAt(spec, y) {
  const y0 = spec.chestMeshY;
  const span = Math.max(spec.chestMeshHeight, 1e-4);
  const u = Math.min(1, Math.max(0, (y - y0) / span));
  return {
    width: spec.chestBottomWidth + (spec.chestTopWidth - spec.chestBottomWidth) * u,
    depth: spec.chestBottomDepth + (spec.chestTopDepth - spec.chestBottomDepth) * u,
  };
}

function pelvisAt(spec, y) {
  const y0 = spec.pelvisMeshY;
  const span = Math.max(spec.pelvisMeshHeight, 1e-4);
  const u = Math.min(1, Math.max(0, (y - y0) / span));
  return {
    width: spec.pelvisBottomWidth + (spec.pelvisTopWidth - spec.pelvisBottomWidth) * u,
    depth: spec.pelvisBottomDepth + (spec.pelvisTopDepth - spec.pelvisBottomDepth) * u,
  };
}

/** Open 4-corner tube. y0 is the first ring, y1 the second. Eight vertices. */
function rectTube(y0, y1, hx0, hx1, hz0, hz1) {
  const positions = [
    hx0, y0, hz0, -hx0, y0, hz0, -hx0, y0, -hz0, hx0, y0, -hz0,
    hx1, y1, hz1, -hx1, y1, hz1, -hx1, y1, -hz1, hx1, y1, -hz1,
  ];
  const indices = [];
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    indices.push(i, j + 4, j, i, i + 4, j + 4);
  }
  return { positions, indices };
}

/** Open cone, 8 sides, 16 vertices. The lower ring is stored first so the walls face out. */
export function skirtCone(y0, y1, r0, r1) {
  const lowFirst = y0 <= y1;
  return openTubeRings(
    lowFirst ? y0 : y1,
    lowFirst ? y1 : y0,
    lowFirst ? r0 : r1,
    lowFirst ? r1 : r0,
    8,
  );
}

/**
 * Open tube. `sign` -1 runs from the joint toward -Y (a limb).
 * `sign` +1 runs toward +Y (a boot cuff up the shin).
 * The lower ring is first so the walls face outward.
 */
function openTube(radiusNear, radiusFar, length, sides = 6, sign = -1) {
  const end = sign * length;
  const yLow = Math.min(0, end);
  const yHigh = Math.max(0, end);
  const rLow = yLow === 0 ? radiusNear : radiusFar;
  const rHigh = yHigh === 0 ? radiusNear : radiusFar;
  return openTubeRings(yLow, yHigh, rLow, rHigh, sides);
}

function openTubeRings(y0, y1, r0, r1, sides) {
  const positions = [];
  const indices = [];
  for (let ring = 0; ring < 2; ring += 1) {
    const y = ring === 0 ? y0 : y1;
    const radius = ring === 0 ? r0 : r1;
    for (let i = 0; i < sides; i += 1) {
      const a = (i / sides) * Math.PI * 2;
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
    }
  }
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    indices.push(i, j + sides, j, i, i + sides, j + sides);
  }
  return { positions, indices };
}

const BOX_FACES = {
  pz: [0, 5, 1, 0, 4, 5],
  nx: [1, 6, 2, 1, 5, 6],
  nz: [2, 7, 3, 2, 6, 7],
  px: [3, 4, 0, 3, 7, 4],
  ny: [0, 1, 2, 0, 2, 3],
  py: [4, 6, 5, 4, 7, 6],
};

function boxCorners(cx, cy, cz, width, height, depth) {
  const hx = width / 2;
  const hy = height / 2;
  const hz = depth / 2;
  return [
    cx + hx, cy - hy, cz + hz,
    cx - hx, cy - hy, cz + hz,
    cx - hx, cy - hy, cz - hz,
    cx + hx, cy - hy, cz - hz,
    cx + hx, cy + hy, cz + hz,
    cx - hx, cy + hy, cz + hz,
    cx - hx, cy + hy, cz - hz,
    cx + hx, cy + hy, cz - hz,
  ];
}

function boxIndices(include) {
  const indices = [];
  for (const face of include) indices.push(...BOX_FACES[face]);
  return indices;
}

function weld() {
  return {
    positions: [],
    indices: [],
    skinIndex: [],
    skinWeight: [],
    bones: [],
    boneOf: new Map(),
    ranges: [],
  };
}

function boneIndex(sheet, joint) {
  const key = joint.uuid;
  if (!sheet.boneOf.has(key)) {
    sheet.boneOf.set(key, sheet.bones.length);
    sheet.bones.push(joint);
  }
  return sheet.boneOf.get(key);
}

function addPiece(sheet, parent, joint, piece, materialIndex) {
  const start = sheet.indices.length;
  const base = sheet.positions.length / 3;
  const index = boneIndex(sheet, joint);
  _mat.copy(parent.matrixWorld).invert().multiply(joint.matrixWorld);
  for (let i = 0; i < piece.positions.length; i += 3) {
    _point.set(piece.positions[i], piece.positions[i + 1], piece.positions[i + 2]).applyMatrix4(_mat);
    sheet.positions.push(_point.x, _point.y, _point.z);
    sheet.skinIndex.push(index, 0, 0, 0);
    sheet.skinWeight.push(1, 0, 0, 0);
  }
  for (const idx of piece.indices) sheet.indices.push(idx + base);
  sheet.ranges.push({ start, count: sheet.indices.length - start, materialIndex });
}

function finish(sheet, parent, materials, name) {
  if (!sheet.positions.length) return null;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(sheet.positions, 3));
  geo.setAttribute('skinIndex', new Uint16BufferAttribute(sheet.skinIndex, 4));
  geo.setAttribute('skinWeight', new Float32BufferAttribute(sheet.skinWeight, 4));
  geo.setIndex(sheet.indices);
  geo.computeVertexNormals();
  const list = Array.isArray(materials) ? materials : [materials];
  if (list.length > 1) {
    for (const range of sheet.ranges) geo.addGroup(range.start, range.count, range.materialIndex);
  }
  const mesh = new SkinnedMesh(geo, list.length > 1 ? list : list[0]);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.role = 'garment';
  parent.add(mesh);
  parent.updateMatrixWorld(true);
  mesh.bind(new Skeleton(sheet.bones));
  return mesh;
}

function addTorso(sheet, parent, spec, y0, y1, gap) {
  const a = chestAt(spec, y0);
  const b = chestAt(spec, y1);
  addPiece(sheet, parent, parent, rectTube(
    y0, y1,
    a.width / 2 + gap, b.width / 2 + gap,
    a.depth / 2 + gap, b.depth / 2 + gap,
  ), 0);
}

function addSleeve(sheet, parent, ctx, side, kind, gap, radii) {
  const spec = ctx.spec;
  const shoulder = ctx.joints[`shoulder${side}`];
  addPiece(sheet, parent, shoulder, openTube(
    radii.shoulder + gap,
    radii.elbow + gap,
    spec.upperArmLength,
  ), 0);
  if (kind === 'full') {
    const elbow = ctx.joints[`elbow${side}`];
    addPiece(sheet, parent, elbow, openTube(radii.elbow + gap, radii.wrist + gap, spec.forearmLength), 0);
  }
}

function addHood(sheet, parent, ctx, gap) {
  const spec = ctx.spec;
  const neck = ctx.joints.neck;
  const y0 = spec.neckLength + spec.headNeckY - gap * 0.4;
  const y1 = spec.neckLength + spec.headRy + gap;
  const rx = spec.headRy * 0.72 + gap;
  const rz = rx * 1.08;
  const faces = ['nx', 'nz', 'px', 'py'];
  addPiece(sheet, parent, neck, {
    positions: boxCorners(0, (y0 + y1) / 2, 0, rx * 2, y1 - y0, rz * 2),
    indices: boxIndices(faces),
  }, 0);
}

function addCape(sheet, parent, spec, gap) {
  const y0 = spec.chestHeight * spec.shoulderT;
  const y1 = -spec.pelvisHeight;
  const z = -(Math.max(spec.chestTopDepth, spec.chestBottomDepth) / 2 + gap * 2.2);
  const x = spec.shoulderWidth * 0.42;
  const positions = [
    -x, y0, z,
    0, y0, z,
    0, y1, z,
    -x, y1, z,
    x, y0, z,
    x, y1, z,
  ];
  const indices = [
    0, 3, 2, 0, 2, 1,
    1, 2, 5, 1, 5, 4,
  ];
  addPiece(sheet, parent, parent, { positions, indices }, 0);
}

function capeMaterial(ctx, color) {
  const hex = String(color).toLowerCase();
  const key = `flat:double:${hex}`;
  let material = ctx.materials.find((entry) => entry.userData.poolKey === key);
  if (!material) {
    material = materialFor(ctx, hex, true).clone();
    material.side = DoubleSide;
    material.userData = { poolKey: key, lockedColor: true };
    ctx.materials.push(material);
  }
  return material;
}

function addPelvis(sheet, parent, spec, gap) {
  const y0 = spec.pelvisMeshY;
  const y1 = spec.pelvisHeight - spec.radii.waist * 0.55;
  const a = pelvisAt(spec, y0);
  const b = pelvisAt(spec, y1);
  addPiece(sheet, parent, parent, rectTube(
    y0, y1,
    a.width / 2 + gap, b.width / 2 + gap,
    a.depth / 2 + gap, b.depth / 2 + gap,
  ), 0);
}

function addLegTube(sheet, parent, ctx, side, part, gap, cuff) {
  const spec = ctx.spec;
  const hip = ctx.joints[`hip${side}`];
  const radii = spec.radii;
  addPiece(sheet, parent, hip, openTube(radii.hip + gap, radii.knee + gap, spec.thighLength), 0);
  if (part === 'both') {
    const knee = ctx.joints[`knee${side}`];
    const len = Math.max(spec.shinLength - cuff, spec.shinLength * 0.45);
    const u = len / spec.shinLength;
    const ankle = radii.knee + (radii.ankle - radii.knee) * u;
    addPiece(sheet, parent, knee, openTube(radii.knee + gap, ankle + gap, len), 0);
  }
}

function skirtSize(spec, gap) {
  const leg = spec.thighLength + spec.shinLength;
  const scale = leg / 0.82;
  const stride = Math.min(1.5, Math.max(0.8, 0.55 + 0.32 * 1.6)) * scale;
  const footForward = stride * 0.6 * 0.5;
  const kneeForward = footForward * (spec.thighLength / leg);
  const lateral = spec.hipWidth / 2 + spec.radii.knee + gap;
  return {
    y0: spec.pelvisHeight - spec.radii.waist * 0.35,
    y1: -spec.thighLength + spec.radii.knee,
    r0: spec.radii.waist + gap,
    r1: Math.hypot(lateral, kneeForward) + gap,
  };
}

function shortenShin(ctx, side, cuff) {
  const spec = ctx.spec;
  const old = ctx.root.getObjectByName(`shin${side}Mesh`);
  if (!old) return;
  const length = Math.max(spec.shinLength - cuff, spec.shinLength * 0.45);
  const u = length / spec.shinLength;
  const bottom = spec.radii.knee + (spec.radii.ankle - spec.radii.knee) * u;
  const mesh = createTaperMesh(spec.radii.knee, bottom, length, old.material);
  mesh.name = old.name;
  mesh.position.y = -length / 2;
  old.geometry.dispose();
  old.parent.add(mesh);
  old.removeFromParent();
}

function addShoe(sheet, ctx, side, kind, gap, cuff) {
  const spec = ctx.spec;
  const ankle = ctx.joints[`ankle${side}`];
  const scale = spec.height / 1.8;
  const soleH = (kind === 'flats' ? 0.012 : 0.02) * scale;
  const soleY = spec.footCenterY - spec.footHeight / 2;
  const width = spec.footWidth + gap;
  const length = spec.footLength + gap;
  const z = spec.footCenterZ;
  const soleCenter = soleY + soleH / 2;
  if (kind === 'flats') {
    addPiece(sheet, ctx.pelvis, ankle, {
      positions: boxCorners(0, soleCenter, z, width, soleH, length),
      indices: boxIndices(['pz', 'nx', 'nz', 'px', 'ny', 'py']),
    }, 0);
    return;
  }
  addPiece(sheet, ctx.pelvis, ankle, {
    positions: boxCorners(0, soleCenter, z, width, soleH, length),
    indices: boxIndices(['pz', 'nx', 'nz', 'px', 'ny']),
  }, 0);
  const collar = kind === 'boots' ? 0 : spec.footCenterY + spec.footHeight / 2;
  const upperBottom = soleY + soleH;
  const upperH = Math.max(collar - upperBottom, soleH);
  const upperCenter = upperBottom + upperH / 2;
  addPiece(sheet, ctx.pelvis, ankle, {
    positions: boxCorners(0, upperCenter, z, width * 0.92, upperH, length * 0.9),
    indices: boxIndices(['pz', 'nx', 'nz', 'px', 'py']),
  }, 1);
  if (kind === 'boots' && cuff > 0) {
    addPiece(
      sheet,
      ctx.pelvis,
      ankle,
      openTube(spec.radii.ankle + gap, spec.radii.ankle + gap * 1.4, cuff, 6, 1),
      1,
    );
  }
}

function cuffLength(spec, gap) {
  return Math.max(gap * 7, spec.radii.ankle * 1.7);
}

export function buildClothing(ctx) {
  if (ctx.root.userData.clothingBuilt) return;
  ctx.root.userData.clothingBuilt = true;
  removeGarments(ctx.root);

  const doc = ctx.document;
  const spec = ctx.spec;
  const gap = shellGap(spec.height);
  const robotTorso = doc.body.torso === 'robot';
  const topId = robotTorso ? 'none' : doc.clothing.top.id;
  const outerId = robotTorso ? 'none' : doc.clothing.outer.id;
  const bottomId = doc.clothing.bottom.id;
  const shoeId = doc.clothing.shoes.id;
  const jacket = outerId === 'jacket';
  const vest = outerId === 'vest';
  const sleeveKind = jacket
    ? 'full'
    : (topId === 'tee' ? 'half' : (topId === 'shirt' || topId === 'hoodie' ? 'full' : null));
  const topSleeves = jacket ? null : sleeveKind;
  const topTorso = !jacket && !vest && topId !== 'none';
  const hood = topId === 'hoodie' && !jacket && doc.head.headwear.id === 'none';
  const cuff = shoeId === 'boots' ? cuffLength(spec, gap) : 0;

  delete ctx.joints.waist.userData.block;
  delete ctx.pelvis.userData.block;
  if (topTorso || jacket || vest) {
    const block = blockOf(ctx.root, 'chestMesh');
    if (block) ctx.joints.waist.userData.block = block;
    dropMesh(ctx.root, 'chestMesh');
  }
  for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
    if (!clothArm(doc.arms[key].type)) continue;
    if (topSleeves || jacket) dropMesh(ctx.root, `upperArm${side}Mesh`);
    if ((topSleeves === 'full') || jacket) dropMesh(ctx.root, `forearm${side}Mesh`);
  }
  if (bottomId === 'pants' || bottomId === 'shorts' || bottomId === 'skirt') {
    const block = blockOf(ctx.root, 'pelvisMesh');
    if (block) ctx.pelvis.userData.block = block;
    dropMesh(ctx.root, 'pelvisMesh');
  }
  for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
    const type = doc.legs[key].type;
    if (type === 'peg') continue;
    if (clothLeg(type) && (bottomId === 'pants' || bottomId === 'shorts')) {
      dropMesh(ctx.root, `thigh${side}Mesh`);
    }
    if (clothLeg(type) && bottomId === 'pants') dropMesh(ctx.root, `shin${side}Mesh`);
    if (shoeId !== 'barefoot') dropMesh(ctx.root, `foot${side}Mesh`);
    if (shoeId === 'boots' && clothLeg(type) && bottomId !== 'pants') shortenShin(ctx, side, cuff);
  }

  ctx.root.updateMatrixWorld(true);
  const waist = ctx.joints.waist;
  const pelvis = ctx.pelvis;

  if (topTorso || topSleeves || hood) {
    const sheet = weld();
    const pad = gap;
    if (topTorso) {
      const y0 = spec.radii.waist * 0.55;
      const y1 = topId === 'tank'
        ? spec.chestHeight * spec.shoulderT
        : spec.chestHeight - spec.radii.neck * 0.45;
      addTorso(sheet, waist, spec, y0, y1, pad);
    }
    if (topSleeves) {
      for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
        if (!clothArm(doc.arms[key].type)) continue;
        addSleeve(sheet, waist, ctx, side, topSleeves, pad, armRadii(spec, doc.arms[key].type));
      }
    }
    if (hood) addHood(sheet, waist, ctx, pad);
    finish(sheet, waist, materialFor(ctx, doc.clothing.top.color, true), 'clothingTop');
  }

  if (jacket || vest || outerId === 'cape') {
    const sheet = weld();
    const pad = gap * (jacket ? 1.7 : vest ? 1.35 : 1);
    if (jacket || vest) {
      const y0 = spec.radii.waist * 0.55;
      const y1 = vest
        ? spec.chestHeight * spec.shoulderT
        : spec.chestHeight - spec.radii.neck * 0.35;
      addTorso(sheet, waist, spec, y0, y1, pad);
    }
    if (jacket) {
      for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
        if (!clothArm(doc.arms[key].type)) continue;
        addSleeve(sheet, waist, ctx, side, 'full', pad, armRadii(spec, doc.arms[key].type));
      }
    }
    if (outerId === 'cape') addCape(sheet, waist, spec, gap);
    const outerMaterial = outerId === 'cape' && !jacket && !vest
      ? capeMaterial(ctx, doc.clothing.outer.color)
      : materialFor(ctx, doc.clothing.outer.color, true);
    finish(sheet, waist, outerMaterial, 'clothingOuter');
  }

  if (bottomId === 'skirt') {
    const sheet = weld();
    const hem = skirtSize(spec, gap);
    addPiece(sheet, pelvis, pelvis, skirtCone(hem.y0, hem.y1, hem.r0, hem.r1), 0);
    const mesh = finish(sheet, pelvis, materialFor(ctx, doc.clothing.bottom.color, true), 'clothingBottom');
    if (mesh) mesh.userData.hemRadius = hem.r1;
  } else if (bottomId === 'pants' || bottomId === 'shorts') {
    const sheet = weld();
    addPelvis(sheet, pelvis, spec, gap);
    for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
      if (!clothLeg(doc.legs[key].type)) continue;
      addLegTube(sheet, pelvis, ctx, side, bottomId === 'shorts' ? 'thigh' : 'both', gap, cuff);
    }
    finish(sheet, pelvis, materialFor(ctx, doc.clothing.bottom.color, true), 'clothingBottom');
  }

  if (shoeId !== 'barefoot') {
    const sheet = weld();
    let any = false;
    for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
      const type = doc.legs[key].type;
      if (type === 'peg') continue;
      any = true;
      addShoe(sheet, ctx, side, shoeId, gap, type === 'normal' ? cuff : 0);
    }
    if (any) {
      const upper = materialFor(ctx, doc.clothing.shoes.color, true);
      const sole = materialFor(ctx, doc.clothing.shoes.accent, true);
      if (shoeId === 'flats') tagFlatSoles(sheet);
      finish(sheet, pelvis, [sole, upper], 'clothingShoes');
    }
  }
}

/** A flats box is 36 indices. The bottom face (ny) is the accent; the other faces are the shoe color. */
function tagFlatSoles(sheet) {
  const next = [];
  for (const range of sheet.ranges) {
    next.push({ start: range.start, count: 24, materialIndex: 1 });
    next.push({ start: range.start + 24, count: 6, materialIndex: 0 });
    next.push({ start: range.start + 30, count: 6, materialIndex: 1 });
  }
  sheet.ranges = next;
}
