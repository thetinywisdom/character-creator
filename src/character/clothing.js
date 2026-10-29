import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Uint16BufferAttribute,
} from 'three';
import { MUSCULAR_SCALE } from './limbs.js';

/**
 * Clothes are closed shells worn over the naked body. Body meshes are never
 * removed. Each piece is parented to the joint that should carry it, so a
 * bend takes the sleeve or the pant leg with it.
 *
 * Robot and skeleton limbs keep their meshes and get no sleeve or pant tube.
 * The garment id is not rejected. Peg legs skip pant tubes and shoes. A robot
 * leg skips the pant tube and the boot cuff, and still takes a shoe. A robot
 * torso still cannot wear a top or an outer layer.
 *
 * A tee sleeve is a short closed tube on the upper arm. A shirt, hoodie, or
 * jacket continues with a closed tube on the forearm.
 */
const SIDES = 8;

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

function hangTube(parent, radius, length, material, name, garment) {
  const geo = new CylinderGeometry(radius, radius, Math.max(length, 0.02), SIDES, 1, false);
  const mesh = addMesh(parent, geo, material, name, garment);
  mesh.position.y = -length / 2;
  return mesh;
}

function placeBox(parent, width, height, depth, y, material, name, garment) {
  const geo = new BoxGeometry(Math.max(width, 0.02), Math.max(height, 0.02), Math.max(depth, 0.02));
  const mesh = addMesh(parent, geo, material, name, garment);
  mesh.position.y = y;
  return mesh;
}

function torsoBox(spec, pad, reach) {
  const width = Math.max(
    spec.chestTopWidth,
    spec.chestBottomWidth,
    spec.pelvisTopWidth,
    spec.pelvisBottomWidth,
  ) + pad * 2;
  const depth = Math.max(
    spec.chestTopDepth,
    spec.chestBottomDepth,
    spec.pelvisTopDepth,
    spec.pelvisBottomDepth,
  ) + pad * 2;
  const y1 = reach === 'vest'
    ? spec.chestHeight * spec.shoulderT
    : spec.chestHeight - spec.radii.neck * 0.25;
  const y0 = -spec.pelvisHeight * 0.78;
  return { width, depth, y0, y1 };
}

function addTorsoBox(parent, spec, pad, reach, material, name, garment) {
  const box = torsoBox(spec, pad, reach);
  const height = box.y1 - box.y0;
  const mesh = placeBox(parent, box.width, height, box.depth, (box.y0 + box.y1) / 2, material, name, garment);
  mesh.userData.hem = box;
  return mesh;
}

function armRadii(spec, type) {
  const scale = type === 'muscular' ? MUSCULAR_SCALE : 1;
  return {
    shoulder: spec.radii.shoulder * scale,
    elbow: spec.radii.elbow * scale,
    wrist: spec.radii.wrist * scale,
  };
}

function addSleeves(ctx, kind, pad, material, prefix, garment) {
  const spec = ctx.spec;
  const doc = ctx.document;
  for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
    if (!clothArm(doc.arms[key].type)) continue;
    const radii = armRadii(spec, doc.arms[key].type);
    const upperLen = kind === 'half' ? spec.upperArmLength * 0.7 : spec.upperArmLength;
    hangTube(
      ctx.joints[`shoulder${side}`],
      Math.max(radii.shoulder, radii.elbow) + pad,
      upperLen,
      material,
      `${prefix}Upper${side}`,
      garment,
    );
    if (kind === 'full') {
      hangTube(
        ctx.joints[`elbow${side}`],
        Math.max(radii.elbow, radii.wrist) + pad,
        spec.forearmLength,
        material,
        `${prefix}Forearm${side}`,
        garment,
      );
    }
  }
}

function addHood(ctx, pad, material) {
  const spec = ctx.spec;
  const y0 = spec.neckLength + spec.headNeckY - pad * 0.4;
  const y1 = spec.neckLength + spec.headRy + pad;
  const rx = spec.headRy * 0.78 + pad;
  const rz = rx * 1.08;
  const geometry = openFrontBox(rx * 2, y1 - y0, rz * 2);
  const mesh = addMesh(ctx.joints.neck, geometry, material, 'clothingTopHood', 'top');
  mesh.position.y = (y0 + y1) / 2;
  return mesh;
}

/** Closed on the back, sides, top, and bottom. The face stays open. DoubleSide keeps every wall visible. */
function openFrontBox(width, height, depth) {
  const hx = width / 2;
  const hy = height / 2;
  const hz = depth / 2;
  const positions = [
    hx, -hy, hz,
    -hx, -hy, hz,
    -hx, -hy, -hz,
    hx, -hy, -hz,
    hx, hy, hz,
    -hx, hy, hz,
    -hx, hy, -hz,
    hx, hy, -hz,
  ];
  const faces = [
    [1, 6, 2, 1, 5, 6],
    [2, 7, 3, 2, 6, 7],
    [3, 4, 0, 3, 7, 4],
    [0, 1, 2, 0, 2, 3],
    [4, 6, 5, 4, 7, 6],
  ];
  const indices = [];
  for (const face of faces) indices.push(...face);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setIndex(new Uint16BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  return geo;
}

function addCape(ctx, pad, material) {
  const spec = ctx.spec;
  const y0 = -spec.pelvisHeight * 0.95;
  const y1 = spec.chestHeight * spec.shoulderT;
  const thickness = Math.max(pad * 0.8, 0.018);
  const width = Math.max(spec.shoulderWidth * 0.92, spec.chestTopWidth + pad);
  const z = -(Math.max(spec.chestTopDepth, spec.chestBottomDepth) / 2 + pad + thickness);
  const mesh = placeBox(ctx.joints.waist, width, y1 - y0, thickness, (y0 + y1) / 2, material, 'clothingCape', 'outer');
  mesh.position.z = z;
  return mesh;
}

function skirtSize(spec, pad) {
  const leg = spec.thighLength + spec.shinLength;
  const scale = leg / 0.82;
  const stride = Math.min(1.5, Math.max(0.8, 0.55 + 0.32 * 1.6)) * scale;
  const footForward = stride * 0.6 * 0.5;
  const kneeForward = footForward * (spec.thighLength / leg);
  const lateral = spec.hipWidth / 2 + spec.radii.knee + pad;
  return {
    yTop: spec.pelvisHeight * 0.42,
    yBottom: -spec.thighLength + spec.radii.knee,
    rTop: spec.radii.waist + pad,
    rHem: Math.hypot(lateral, kneeForward) + pad,
  };
}

function addSkirt(ctx, pad, material) {
  const hem = skirtSize(ctx.spec, pad);
  const height = Math.max(hem.yTop - hem.yBottom, 0.04);
  const geo = new CylinderGeometry(hem.rTop, hem.rHem, height, SIDES, 1, false);
  const mesh = addMesh(ctx.pelvis, geo, material, 'clothingBottom', 'bottom');
  mesh.position.y = (hem.yTop + hem.yBottom) / 2;
  mesh.userData.hemRadius = hem.rHem;
  return mesh;
}

function addPelvisBox(ctx, pad, material) {
  const spec = ctx.spec;
  const y0 = spec.pelvisMeshY - pad * 0.25;
  const y1 = spec.pelvisHeight * 0.42;
  const width = Math.max(spec.pelvisTopWidth, spec.pelvisBottomWidth) + pad * 2;
  const depth = Math.max(spec.pelvisTopDepth, spec.pelvisBottomDepth) + pad * 2;
  return placeBox(ctx.pelvis, width, y1 - y0, depth, (y0 + y1) / 2, material, 'clothingBottom', 'bottom');
}

function addLegTubes(ctx, part, pad, material) {
  const spec = ctx.spec;
  const doc = ctx.document;
  for (const [side, key] of [['L', 'left'], ['R', 'right']]) {
    if (!clothLeg(doc.legs[key].type)) continue;
    const thighLen = part === 'shorts' ? spec.thighLength * 0.62 : spec.thighLength;
    hangTube(
      ctx.joints[`hip${side}`],
      Math.max(spec.radii.hip, spec.radii.knee) + pad,
      thighLen,
      material,
      `clothingBottomThigh${side}`,
      'bottom',
    );
    if (part === 'pants') {
      hangTube(
        ctx.joints[`knee${side}`],
        Math.max(spec.radii.knee, spec.radii.ankle) + pad,
        spec.shinLength,
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
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
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
  const soleH = (kind === 'flats' ? 0.014 : 0.024) * (spec.height / 1.8);
  const soleY = spec.footCenterY - spec.footHeight / 2;
  const width = spec.footWidth + pad * 2;
  const length = spec.footLength + pad * 2;
  const z = spec.footCenterZ;
  const parts = [];
  const sole = new BoxGeometry(width, soleH, length);
  sole.translate(0, soleY + soleH / 2, z);
  parts.push({ geometry: sole, materialIndex: 0 });
  const footTop = spec.footCenterY + spec.footHeight / 2;
  const upperBottom = soleY + soleH * 0.35;
  const upperTop = kind === 'boots' && cuff ? pad * 0.35 : footTop + pad * 0.2;
  const upperH = Math.max(upperTop - upperBottom, soleH);
  const upper = new BoxGeometry(width * 0.94, upperH, length * 0.94);
  upper.translate(0, upperBottom + upperH / 2, z);
  parts.push({ geometry: upper, materialIndex: 1 });
  if (kind === 'boots' && cuff) {
    const cuffLen = Math.max(pad * 4.5, spec.radii.ankle * 2.4);
    const tube = new CylinderGeometry(spec.radii.ankle + pad, spec.radii.ankle + pad, cuffLen, SIDES, 1, false);
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
  const robotTorso = doc.body.torso === 'robot';
  const topId = robotTorso ? 'none' : doc.clothing.top.id;
  const outerId = robotTorso ? 'none' : doc.clothing.outer.id;
  const bottomId = doc.clothing.bottom.id;
  const shoeId = doc.clothing.shoes.id;

  if (topId !== 'none') {
    const material = garmentMaterial(ctx, doc.clothing.top.color);
    addTorsoBox(ctx.joints.waist, spec, pad, 'full', material, 'clothingTop', 'top');
    const sleeves = topId === 'tee' ? 'half' : (topId === 'shirt' || topId === 'hoodie' ? 'full' : null);
    if (sleeves) addSleeves(ctx, sleeves, pad, material, 'clothingTop', 'top');
    if (topId === 'hoodie' && doc.head.headwear.id === 'none') addHood(ctx, pad, material);
  }

  if (outerId === 'vest' || outerId === 'jacket') {
    const material = garmentMaterial(ctx, doc.clothing.outer.color);
    const reach = outerId === 'vest' ? 'vest' : 'full';
    const extra = outerId === 'vest' ? pad * 0.85 : pad * 1.5;
    addTorsoBox(ctx.joints.waist, spec, pad + extra, reach, material, 'clothingOuter', 'outer');
    if (outerId === 'jacket') addSleeves(ctx, 'full', pad + extra, material, 'clothingOuter', 'outer');
  }
  if (outerId === 'cape') addCape(ctx, pad, garmentMaterial(ctx, doc.clothing.outer.color));

  if (bottomId === 'skirt') {
    addSkirt(ctx, pad, garmentMaterial(ctx, doc.clothing.bottom.color));
  } else if (bottomId === 'pants' || bottomId === 'shorts') {
    const material = garmentMaterial(ctx, doc.clothing.bottom.color);
    addPelvisBox(ctx, pad, material);
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
