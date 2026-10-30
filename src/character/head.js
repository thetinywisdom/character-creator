import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Mesh,
  SphereGeometry,
  Vector2,
} from 'three';
import {
  ISO_HEAD_DEPTH,
  ISO_HEAD_PROFILE,
  createHeadGeometry,
  createHeadMesh,
} from '../body/geometry.js';
import { materialFor } from './limbs.js';

/** Covering hats hide hair. Horns and a headband do not. */
export const COVERING_HEADWEAR = ['cap', 'beanie', 'hat', 'helmet'];

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
  const span = crown - chin;
  if (style === 'buzz') {
    return lathe(capRings(skull, chin + span * 0.52, crown + 0.012, 5), 8);
  }
  if (style === 'afro') {
    const radius = span * 0.42;
    const geo = new SphereGeometry(radius, 8, 5);
    geo.translate(0, crown - radius * 0.2, 0);
    return geo;
  }
  if (style === 'ponytail') {
    const cap = lathe(capRings(skull, chin + span * 0.55, crown + 0.008, 4), 8);
    const tailR = Math.max(spec.radii.neck * 0.28, 0.012);
    const tail = new CylinderGeometry(tailR * 0.72, tailR, span * 0.95, 6, 1, false);
    const y = chin + span * 0.72;
    tail.translate(0, y - span * 0.55, -(skull.radiusAt(y) + GAP + tailR));
    return mergeGeometries([cap, tail]);
  }
  const cap = lathe(capRings(skull, chin + span * 0.62, crown + 0.006, 4), 8);
  const top = chin + span * 0.62;
  const jaw = style === 'long' ? chin - spec.neckLength * 0.35 : chin + span * 0.18;
  const count = 5;
  const pairs = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const y = jaw + (top - jaw) * t;
    pairs.push([skull.radiusAt(y) + GAP + 0.014, y]);
  }
  const points = pairs.map(([r, y]) => new Vector2(Math.max(r, 0.0004), y));
  // theta 0 is +Z, the face. This arc keeps the face clear and wraps the sides and back.
  const wrap = new LatheGeometry(points, 8, Math.PI * 0.42, Math.PI * 1.16);
  return mergeGeometries([cap, wrap]);
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
  hang(socket, geo, materialFor(ctx, ctx.document.head.hair.color, true), 'hairMesh', 'hair');
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
  hang(socket, geo, materialFor(ctx, ctx.document.head.hair.color, true), 'facialHairMesh', 'facial');
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
  const geo = new CylinderGeometry(r, r, 0.016, 8, 1, true);
  geo.translate(0, y * 0.92, 0);
  return geo;
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
