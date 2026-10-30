import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Mesh,
  SphereGeometry,
  Vector2,
} from 'three';
import { Color } from 'three';
import {
  ISO_HEAD_CROWN,
  ISO_HEAD_DEPTH,
  ISO_HEAD_NECK_Y,
  ISO_HEAD_PROFILE,
  createHeadGeometry,
  createHeadMesh,
} from '../body/geometry.js';
import { materialFor } from './limbs.js';

/** Covering hats hide hair. Horns and a headband do not. */
export const COVERING_HEADWEAR = ['cap', 'beanie', 'hat', 'helmet', 'crown'];

const GAP = 0.008;

function skinFlat(ctx) {
  return ctx.materials.find((material) => material.userData.skin === 'flat');
}

function disposeMesh(mesh) {
  mesh.geometry?.dispose();
  mesh.removeFromParent();
}

function clearPart(parent, role) {
  for (const child of [...parent.children]) {
    if (child.userData?.headPart === role) disposeMesh(child);
  }
}

function hang(parent, geometry, material, name, role) {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.userData.headPart = role;
  mesh.userData.role = role;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function samplesFrom(pairs) {
  const samples = pairs
    .map(([y, r]) => ({ y, r: Math.max(r, 0) }))
    .sort((a, b) => a.y - b.y);
  return {
    samples,
    radiusAt(y) {
      if (!samples.length) return 0;
      if (y >= samples[samples.length - 1].y) return 0;
      if (y <= samples[0].y) return samples[0].r;
      for (let i = 1; i < samples.length; i += 1) {
        const a = samples[i - 1];
        const b = samples[i];
        if (y <= b.y) {
          const t = (y - a.y) / (b.y - a.y || 1);
          return a.r + (b.r - a.r) * t;
        }
      }
      return samples[samples.length - 1].r;
    },
  };
}

function classicSamples(scale, yScale, xzScale, yShift) {
  return ISO_HEAD_PROFILE.map(([r, y]) => [
    y * scale * yScale + yShift,
    r * scale * xzScale * ISO_HEAD_DEPTH,
  ]);
}

/** Skull radius in head-socket space. Parts live in that space. */
export function skullFor(shape, spec) {
  const scale = spec.headScale;
  if (shape === 'long') {
    const shift = spec.headNeckY * (1 - 1.25);
    return samplesFrom(classicSamples(scale, 1.25, 0.9, shift));
  }
  if (shape === 'round') {
    const bot = spec.headNeckY;
    const top = spec.headRy;
    const radius = (top - bot) * 0.48;
    const cy = (top + bot) * 0.5;
    const pairs = [];
    const steps = 8;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const y = cy - radius + t * radius * 2;
      const dy = y - cy;
      pairs.push([y, Math.sqrt(Math.max(radius * radius - dy * dy, 0))]);
    }
    return samplesFrom(pairs);
  }
  if (shape === 'box') {
    const y0 = spec.headNeckY;
    const y1 = spec.headRy;
    const hx = spec.radii.neck * 1.45;
    const hz = hx * ISO_HEAD_DEPTH;
    const r = Math.hypot(hx, hz);
    return samplesFrom([[y0, r], [y1, r]]);
  }
  return samplesFrom(classicSamples(scale, 1, 1, 0));
}

function pushOutside(geometry, skull) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const need = skull.radiusAt(y) + GAP;
    const h = Math.hypot(x, z);
    if (h + 1e-6 >= need) continue;
    if (h < 1e-5) pos.setXYZ(i, need, y, 0);
    else {
      const s = need / h;
      pos.setXYZ(i, x * s, y, z * s);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

function lathe(pairs, segments = 8) {
  const points = pairs.map(([r, y]) => new Vector2(Math.max(r, 0.0004), y));
  return new LatheGeometry(points, segments);
}

function paintHair(geometry, base, highlight) {
  const pos = geometry.attributes.position;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const span = Math.max(maxY - minY, 1e-4);
  const main = new Color(base);
  const hi = new Color(highlight || base);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const t = (pos.getY(i) - minY) / span;
    const color = highlight && t > 0.62 ? hi : main;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
}

function hairMaterial(ctx, color, highlight) {
  const hex = String(color).toLowerCase();
  const hi = highlight ? String(highlight).toLowerCase() : '';
  const key = `hair:${hex}:${hi}`;
  let material = ctx.materials.find((entry) => entry.userData.poolKey === key);
  if (!material) {
    material = materialFor(ctx, '#ffffff', true).clone();
    material.color.set('#ffffff');
    material.vertexColors = true;
    material.userData.poolKey = key;
    material.userData.lockedColor = true;
    ctx.materials.push(material);
  }
  return material;
}

function placeHead(ctx) {
  ctx.sockets.head.position.set(0, ctx.spec.neckLength, 0);
  return ctx.sockets.head;
}

function replaceHead(ctx, geometry, y) {
  const neck = ctx.joints.neck;
  const previous = neck.getObjectByName('headMesh');
  if (previous) disposeMesh(previous);
  const mesh = new Mesh(geometry, skinFlat(ctx));
  mesh.name = 'headMesh';
  mesh.userData.role = 'head';
  mesh.position.y = y;
  neck.add(mesh);
  return mesh;
}

export function buildHeadShape(ctx) {
  const spec = ctx.spec;
  const shape = ctx.document.head.shape;
  const skull = skullFor(shape, spec);
  placeHead(ctx);
  const neck = ctx.joints.neck;
  const existing = neck.getObjectByName('headMesh');
  if (shape === 'classic') {
    const stamp = `classic|${spec.headScale.toFixed(5)}`;
    if (!existing || existing.userData.shapeStamp !== stamp) {
      if (existing) disposeMesh(existing);
      const mesh = createHeadMesh(spec.headScale, skinFlat(ctx));
      mesh.name = 'headMesh';
      mesh.position.y = spec.neckLength;
      neck.add(mesh);
      mesh.userData.shapeStamp = stamp;
      mesh.userData.skull = skull;
    } else {
      existing.userData.skull = skull;
      existing.userData.shapeStamp = stamp;
    }
    return;
  }
  const stamp = `${shape}|${spec.headScale.toFixed(5)}`;
  if (existing?.userData.shapeStamp === stamp) {
    existing.userData.skull = skull;
    return;
  }
  if (shape === 'round') {
    const bot = spec.headNeckY;
    const top = spec.headRy;
    const radius = (top - bot) * 0.48;
    const cy = (top + bot) * 0.5;
    const mesh = replaceHead(ctx, new SphereGeometry(radius, 8, 5), spec.neckLength + cy);
    mesh.userData.shapeStamp = stamp;
    mesh.userData.skull = skull;
    return;
  }
  if (shape === 'long') {
    const shift = spec.headNeckY * (1 - 1.25);
    const geo = createHeadGeometry(spec.headScale);
    geo.scale(0.9, 1.25, 0.9);
    const mesh = replaceHead(ctx, geo, spec.neckLength + shift);
    mesh.userData.shapeStamp = stamp;
    mesh.userData.skull = skull;
    return;
  }
  const y0 = spec.headNeckY;
  const y1 = spec.headRy;
  const hx = spec.radii.neck * 1.45;
  const hz = hx * ISO_HEAD_DEPTH;
  const mesh = replaceHead(
    ctx,
    new BoxGeometry(hx * 2, y1 - y0, hz * 2),
    spec.neckLength + (y0 + y1) / 2,
  );
  mesh.userData.shapeStamp = stamp;
  mesh.userData.skull = skull;
}

function capRings(skull, y0, y1, count) {
  const pairs = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const y = y0 + (y1 - y0) * t;
    pairs.push([skull.radiusAt(y) + GAP + 0.004 + t * 0.006, y]);
  }
  return pairs;
}

function hairGeometry(style, spec, skull) {
  const crown = spec.headRy;
  const chin = spec.headNeckY;
  const mid = chin + (crown - chin) * 0.72;
  if (style === 'buzz') {
    return lathe(capRings(skull, mid, crown * 0.96, 4), 8);
  }
  if (style === 'bob') {
    const jaw = chin + (crown - chin) * 0.34;
    const cap = lathe(capRings(skull, mid, crown * 0.94, 3), 8);
    const back = skull.radiusAt(mid) + GAP + 0.018;
    const slab = new BoxGeometry(spec.radii.neck * 1.6, mid - jaw, 0.016);
    slab.translate(0, (mid + jaw) / 2, -(back + 0.01));
    return mergeGeometries([cap, slab]);
  }
  if (style === 'afro') {
    const bot = chin + 0.01;
    const top = crown + 0.02;
    const radius = (top - bot) * 0.55;
    const cy = (top + bot) * 0.5;
    const geo = new SphereGeometry(radius, 8, 5);
    geo.translate(0, cy, 0);
    return geo;
  }
  if (style === 'mohawk') {
    const yb = crown * 0.72;
    const r = skull.radiusAt(yb) + GAP + 0.01;
    const positions = [];
    const index = [];
    const zs = [-0.05, -0.02, 0.02, 0.05];
    for (let i = 0; i < zs.length; i += 1) {
      const z = zs[i];
      positions.push(-0.012, yb, z, 0.012, yb, z, 0, yb + r * 0.55 + 0.02, z);
    }
    for (let i = 0; i < zs.length - 1; i += 1) {
      const a = i * 3;
      index.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
      index.push(a + 2, a + 5, a + 4, a + 2, a + 4, a + 1);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    return geo;
  }
  if (style === 'spikes') {
    const positions = [];
    const index = [];
    const dirs = [
      [0.2, 0.9, 0.1],
      [-0.2, 0.9, 0.15],
      [0.35, 0.75, -0.2],
      [-0.3, 0.8, -0.15],
      [0.05, 0.7, 0.4],
      [-0.1, 0.72, -0.4],
    ];
    for (const dir of dirs) {
      const len = Math.hypot(dir[0], dir[1], dir[2]);
      const y = crown * 0.78;
      const base = skull.radiusAt(y) + GAP + 0.012;
      const bx = (dir[0] / len) * base;
      const bz = (dir[2] / len) * base;
      const tip = base + 0.045;
      const o = positions.length / 3;
      positions.push(
        bx, y, bz,
        bx + 0.012, y + 0.01, bz,
        bx, y + 0.012, bz + 0.012,
        (dir[0] / len) * tip, y + dir[1] * 0.05, (dir[2] / len) * tip,
      );
      index.push(o, o + 1, o + 3, o + 1, o + 2, o + 3, o + 2, o, o + 3, o, o + 2, o + 1);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    return geo;
  }
  const cap = lathe(capRings(skull, chin + (crown - chin) * 0.72, crown * 0.9, 3), 8);
  const back = skull.radiusAt(mid) + GAP + 0.02;
  const drop = style === 'long'
    ? spec.neckLength + spec.chestHeight * 0.85
    : spec.radii.neck * 2.4;
  const slab = new BoxGeometry(spec.radii.neck * 1.1, drop, 0.02);
  slab.translate(0, mid - drop * 0.45, -(back + 0.02));
  return mergeGeometries([cap, slab]);
}

function mergeGeometries(geos) {
  const positions = [];
  const index = [];
  for (const geo of geos) {
    const pos = geo.attributes.position;
    const src = geo.index;
    const base = positions.length / 3;
    for (let i = 0; i < pos.count; i += 1) positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (src) {
      for (let i = 0; i < src.count; i += 1) index.push(src.getX(i) + base);
    }
    geo.dispose();
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  if (index.length) geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function hairHidden(doc) {
  const hat = doc.head.headwear.id;
  if (COVERING_HEADWEAR.includes(hat)) return true;
  return doc.clothing.top.id === 'hoodie' && hat === 'none';
}

export function buildHair(ctx) {
  const socket = placeHead(ctx);
  clearPart(socket, 'hair');
  const style = ctx.document.head.hair.style;
  if (style === 'none' || hairHidden(ctx.document)) return;
  const skull = ctx.joints.neck.getObjectByName('headMesh').userData.skull;
  const geo = pushOutside(hairGeometry(style, ctx.spec, skull), skull);
  paintHair(geo, ctx.document.head.hair.color, ctx.document.head.hair.highlight);
  hang(socket, geo, hairMaterial(ctx, ctx.document.head.hair.color, ctx.document.head.hair.highlight), 'hairMesh', 'hair');
}

export function buildFacialHair(ctx) {
  const socket = placeHead(ctx);
  clearPart(socket, 'facial');
  const id = ctx.document.head.facialHair;
  if (id === 'none') return;
  const skull = ctx.joints.neck.getObjectByName('headMesh').userData.skull;
  const spec = ctx.spec;
  const y = spec.headNeckY + (spec.headRy - spec.headNeckY) * (id === 'moustache' ? 0.42 : 0.22);
  const reach = skull.radiusAt(y) + GAP + 0.006;
  let geo;
  if (id === 'moustache') {
    geo = new BoxGeometry(spec.radii.neck * 1.15, spec.radii.neck * 0.28, 0.012);
    geo.translate(0, y, reach);
  } else {
    const positions = [];
    const index = [];
    const steps = 5;
    for (let i = 0; i <= steps; i += 1) {
      const a = Math.PI * (0.15 + 0.7 * (i / steps));
      const x = Math.cos(a) * reach;
      const z = Math.sin(a) * reach;
      const o = positions.length / 3;
      positions.push(x, y + 0.012, z, x * 0.92, y - spec.radii.neck * 0.55, z * 0.92);
      if (i > 0) index.push(o - 2, o, o - 1, o - 1, o, o + 1);
    }
    geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
  }
  pushOutside(geo, skull);
  paintHair(geo, ctx.document.head.hair.color, null);
  hang(socket, geo, hairMaterial(ctx, ctx.document.head.hair.color, null), 'facialHairMesh', 'facial');
}

function earGeometry(kind, spec, side) {
  const sign = side === 'L' ? -1 : 1;
  const y = spec.headNeckY + (spec.headRy - spec.headNeckY) * 0.48;
  const x = sign * (spec.radii.neck * 1.55);
  if (kind === 'elf') {
    const geo = new ConeGeometry(spec.radii.neck * 0.22, spec.radii.neck * 1.5, 4);
    geo.rotateZ(sign * Math.PI / 2);
    geo.translate(x + sign * spec.radii.neck * 0.7, y + spec.radii.neck * 0.15, 0);
    return geo;
  }
  if (kind === 'cat') {
    const tri = new ConeGeometry(spec.radii.neck * 0.28, spec.radii.neck * 0.7, 3);
    tri.translate(x + sign * spec.radii.neck * 0.35, y + spec.radii.neck * 0.45, 0);
    const box = new BoxGeometry(spec.radii.neck * 0.22, spec.radii.neck * 0.18, spec.radii.neck * 0.12);
    box.translate(x + sign * spec.radii.neck * 0.2, y, 0);
    return mergeGeometries([tri, box]);
  }
  if (kind === 'antenna') {
    const rod = new CylinderGeometry(0.004, 0.004, spec.radii.neck * 1.3, 4);
    rod.translate(x, y + spec.radii.neck * 0.9, 0);
    const tip = new SphereGeometry(0.012, 4, 3);
    tip.translate(x, y + spec.radii.neck * 1.6, 0);
    return mergeGeometries([rod, tip]);
  }
  return wedge(sign, x, y, spec.radii.neck * 0.28, spec.radii.neck * 0.5);
}

function wedge(sign, x, y, width, height) {
  const geo = new BufferGeometry();
  const z = width * 0.15;
  geo.setAttribute('position', new Float32BufferAttribute([
    x, y - height * 0.5, 0,
    x, y + height * 0.5, 0,
    x + sign * width, y, z,
    x + sign * width, y - height * 0.15, -z,
  ], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

export function buildEars(ctx) {
  const socket = placeHead(ctx);
  clearPart(socket, 'ear');
  const kind = ctx.document.head.ears;
  const mat = skinFlat(ctx);
  hang(socket, earGeometry(kind, ctx.spec, 'L'), mat, 'earLMesh', 'ear');
  hang(socket, earGeometry(kind, ctx.spec, 'R'), mat, 'earRMesh', 'ear');
}

export function buildEarrings(ctx) {
  const socket = placeHead(ctx);
  clearPart(socket, 'earring');
  const id = ctx.document.head.earrings.id;
  if (id === 'none' || ctx.document.head.ears === 'antenna') return;
  const spec = ctx.spec;
  const y = spec.headNeckY + (spec.headRy - spec.headNeckY) * 0.36;
  const mat = materialFor(ctx, ctx.document.head.earrings.color, true);
  for (const [side, sign] of [['L', -1], ['R', 1]]) {
    const x = sign * (spec.radii.neck * 1.85);
    const geo = id === 'hoop'
      ? hoop(spec.radii.neck * 0.22)
      : new BoxGeometry(0.012, 0.012, 0.012);
    geo.translate(x, y, spec.radii.neck * 0.15);
    hang(socket, geo, mat, `earring${side}Mesh`, 'earring');
  }
}

function hoop(radius) {
  const geo = new CylinderGeometry(radius, radius, 0.006, 6, 1, true);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function headwearGeometry(id, spec, skull) {
  const crown = spec.headRy;
  const y = crown * 0.62;
  const r = skull.radiusAt(y) + GAP + 0.012;
  if (id === 'beanie') return lathe(capRings(skull, y, crown + 0.012, 4), 8);
  if (id === 'cap') {
    const crownGeo = new CylinderGeometry(r * 0.72, r, crown * 0.28, 8, 1, false);
    crownGeo.translate(0, y + crown * 0.08, 0);
    const brim = new BoxGeometry(r * 1.7, 0.008, r * 0.7);
    brim.translate(0, y, r * 0.55);
    return mergeGeometries([crownGeo, brim]);
  }
  if (id === 'hat') {
    const tube = new CylinderGeometry(r * 0.55, r * 0.62, crown * 0.42, 8, 1, false);
    tube.translate(0, y + crown * 0.16, 0);
    const brim = new CylinderGeometry(r * 1.15, r * 1.15, 0.01, 8, 1, false);
    brim.translate(0, y, 0);
    return mergeGeometries([tube, brim]);
  }
  if (id === 'helmet') {
    const hx = r * 1.05;
    const hy = (crown - y) * 0.95;
    const geo = new BoxGeometry(hx * 2, hy, r * 1.5);
    geo.translate(0, y + hy * 0.35, -r * 0.15);
    return geo;
  }
  if (id === 'crown') {
    const band = new CylinderGeometry(r * 0.95, r, 0.02, 8, 1, true);
    band.translate(0, y, 0);
    const parts = [band];
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      const tine = new BoxGeometry(0.012, 0.035, 0.008);
      tine.translate(Math.cos(a) * r * 0.92, y + 0.026, Math.sin(a) * r * 0.92);
      parts.push(tine);
    }
    return mergeGeometries(parts);
  }
  if (id === 'headband') {
    const geo = new CylinderGeometry(r, r, 0.016, 8, 1, true);
    geo.translate(0, y * 0.92, 0);
    return geo;
  }
  const left = new ConeGeometry(0.014, spec.radii.neck * 1.1, 4);
  left.rotateZ(Math.PI / 5);
  left.translate(-r * 0.55, crown * 0.75, 0);
  const right = new ConeGeometry(0.014, spec.radii.neck * 1.1, 4);
  right.rotateZ(-Math.PI / 5);
  right.translate(r * 0.55, crown * 0.75, 0);
  return mergeGeometries([left, right]);
}

export function buildHeadwear(ctx) {
  const socket = placeHead(ctx);
  clearPart(socket, 'hat');
  const id = ctx.document.head.headwear.id;
  if (id === 'none') return;
  const skull = ctx.joints.neck.getObjectByName('headMesh').userData.skull;
  const geo = pushOutside(headwearGeometry(id, ctx.spec, skull), skull);
  hang(socket, geo, materialFor(ctx, ctx.document.head.headwear.color, true), 'headwearMesh', 'hat');
}

function eyewearGeometry(id, spec, skull) {
  const y = spec.headNeckY + (spec.headRy - spec.headNeckY) * 0.58;
  const z = skull.radiusAt(y) + 0.012;
  const w = spec.radii.neck * 0.55;
  const h = spec.radii.neck * 0.38;
  if (id === 'visor') {
    const geo = new BoxGeometry(spec.radii.neck * 2.1, h * 0.7, 0.01);
    geo.translate(0, y, z);
    return geo;
  }
  if (id === 'goggles') {
    const left = new CylinderGeometry(w * 0.55, w * 0.55, 0.016, 6, 1, false);
    left.rotateX(Math.PI / 2);
    left.translate(-w * 0.7, y, z);
    const right = left.clone();
    right.translate(w * 1.4, 0, 0);
    const strap = new BoxGeometry(spec.radii.neck * 2.4, 0.012, 0.01);
    strap.translate(0, y, 0);
    return mergeGeometries([left, right, strap]);
  }
  const rimL = new BoxGeometry(w, h, 0.008);
  rimL.translate(-w * 0.65, y, z);
  const rimR = rimL.clone();
  rimR.translate(w * 1.3, 0, 0);
  const bar = new BoxGeometry(w * 0.4, 0.008, 0.008);
  bar.translate(0, y, z);
  const parts = [rimL, rimR, bar];
  if (id === 'sunglasses') {
    const lensL = new BoxGeometry(w * 0.82, h * 0.75, 0.004);
    lensL.translate(-w * 0.65, y, z + 0.004);
    const lensR = lensL.clone();
    lensR.translate(w * 1.3, 0, 0);
    parts.push(lensL, lensR);
  }
  return mergeGeometries(parts);
}

export function buildEyewear(ctx) {
  const socket = placeHead(ctx);
  clearPart(socket, 'eyewear');
  const id = ctx.document.head.eyewear.id;
  if (id === 'none') return;
  const skull = ctx.joints.neck.getObjectByName('headMesh').userData.skull;
  const geo = eyewearGeometry(id, ctx.spec, skull);
  hang(socket, geo, materialFor(ctx, ctx.document.head.eyewear.color, true), 'eyewearMesh', 'eyewear');
}
