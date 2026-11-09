import * as THREE from 'three';
import { capsuleBetween, softBox } from '../lib/shapes.js';
import { CLOTH_COLORS } from '../styles/palette.js';
import { WHEEL_SIDES, box, cyl, wheel } from './util.js';

// Batch C – vehicles: cars (kei car, sedan, hatchback, minivan, taxi, sports
// car, bus), a city bike ("mamachari") with a front basket, and a small scooter.
// Vehicles face +z (front), wheels on y = 0.

export const VEHICLE_COLORS = ['White', 'Black', 'Gray', 'Red', 'Blue', 'Navy', 'Yellow', 'Green', 'Pink', 'Teal'];

// Cars are built from a side profile (z = along the car, y = up), extruded
// across the width: the lower body with real wheel arches, a narrower glass
// cabin (tumblehome), then painted roof and pillars, bumpers, lights, mirrors,
// door lines. Proportions follow real Japanese cars, not toys.
//
//   body:  the lower body outline, from the rear bumper round the nose and back
//          along the bottom (arches are cut in automatically)
//   glass: the cabin outline above the beltline (rear window, roof, windscreen)
//   doors: z of the door shut lines; wheels: z of the axles
const CARS = {
  // a tall 4-seat kei box: short nose, upright windscreen, flat roof, square back
  'Kei car': { L: 3.4, W: 1.48, r: 0.27, wheels: [-1.15, 1.12], doors: [-0.2, 0.75], mirrors: 'door', wheel: 'steel',
    body: [[-1.7, 0.32], [-1.7, 0.98], [1.2, 1.0], [1.62, 0.9], [1.7, 0.72], [1.7, 0.32]],
    glass: [[-1.68, 0.98], [-1.63, 1.62], [0.55, 1.66], [1.2, 1.0]] },
  Sedan: { L: 4.7, W: 1.78, r: 0.32, wheels: [-1.45, 1.4], doors: [-0.55, 0.55], mirrors: 'door', wheel: 'alloy',
    body: [[-2.35, 0.3], [-2.36, 0.74], [-2.25, 0.93], [-1.55, 0.98], [1.25, 0.95], [2.2, 0.82], [2.36, 0.6], [2.34, 0.3]],
    glass: [[-1.5, 0.98], [-0.8, 1.42], [0.4, 1.45], [1.22, 0.95]] },
  Hatchback: { L: 4.0, W: 1.72, r: 0.31, wheels: [-1.28, 1.28], doors: [-0.45, 0.5], mirrors: 'door', wheel: 'alloy',
    body: [[-2.0, 0.3], [-2.02, 0.95], [1.1, 0.95], [1.9, 0.8], [2.0, 0.6], [2.0, 0.3]],
    glass: [[-1.98, 0.95], [-1.75, 1.45], [0.35, 1.48], [1.1, 0.95]] },
  // a 6-seat minivan: long, tall, sliding rear door
  Minivan: { L: 4.7, W: 1.72, r: 0.31, wheels: [-1.55, 1.5], doors: [-0.75, 0.62], mirrors: 'door', wheel: 'alloy', sliding: true,
    body: [[-2.35, 0.32], [-2.36, 1.0], [1.55, 1.02], [2.2, 0.86], [2.36, 0.62], [2.35, 0.32]],
    glass: [[-2.34, 1.0], [-2.28, 1.8], [1.0, 1.85], [1.55, 1.02]] },
  // the modern Japanese taxi: tall and upright, a short sloping nose, a high
  // flat roof, a square back, mirrors on the front fenders, deep navy
  Taxi: { L: 4.4, W: 1.7, r: 0.3, wheels: [-1.38, 1.38], doors: [-0.55, 0.45], mirrors: 'fender', wheel: 'alloy', taxi: true, sliding: true,
    body: [[-2.2, 0.32], [-2.21, 1.02], [1.15, 1.0], [1.95, 0.92], [2.2, 0.72], [2.2, 0.32]],
    glass: [[-2.18, 1.02], [-2.12, 1.72], [0.6, 1.75], [1.15, 1.0]] },
  // a small 1970s fastback coupé: long low bonnet, sloping roof to a short
  // tail, round headlamps, chrome bumpers, fender mirrors
  'Sports car': { L: 3.95, W: 1.58, r: 0.29, wheels: [-1.2, 1.2], doors: [0.05], mirrors: 'fender', wheel: 'retro', chrome: true,
    body: [[-1.96, 0.32], [-1.97, 0.66], [-1.82, 0.84], [-1.55, 0.86], [0.75, 0.86], [1.85, 0.78], [1.98, 0.62], [1.98, 0.32]],
    glass: [[-1.6, 0.86], [-0.6, 1.3], [0.05, 1.33], [0.75, 0.86]] },
};
// half sizes for collisions (x across, z along)
export const CAR_SIZES = Object.fromEntries([...Object.entries(CARS).map(([k, s]) => [k, { hw: s.W / 2, hd: s.L / 2 }]), ['Bus', { hw: 1.25, hd: 5.25 }]]);

/** The lower-body outline with semicircle wheel arches cut into the bottom edge. */
function bodyShape(s) {
  const shape = new THREE.Shape();
  shape.moveTo(...s.body[0]);
  for (const p of s.body.slice(1)) shape.lineTo(...p);
  // back along the bottom, front to rear, with an arch over each wheel
  const bottom = s.body[0][1], ar = s.r + 0.07;
  const [wb, wf] = s.wheels;
  for (const wz of [wf, wb]) {
    shape.lineTo(wz + ar, bottom);
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * Math.PI;
      shape.lineTo(wz + Math.cos(a) * ar, Math.max(bottom, s.r + Math.sin(a) * ar));
    }
  }
  shape.lineTo(...s.body[0]);
  return shape;
}

/** Extrude a side outline across width w, centred on x = 0. */
function extrude(shape, w, material, bevel = 0.03) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  geo.rotateY(-Math.PI / 2); // outline x -> world z, extrusion -> world -x
  geo.translate(w / 2 - bevel, 0, 0);
  return new THREE.Mesh(geo, material);
}

/** A thin bar from a = [z, y] to b = [z, y] at side x (pillars, door lines). */
function bar(a, b, x, t, wdt, material) {
  const dz = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dz, dy);
  const m = new THREE.Mesh(new THREE.BoxGeometry(wdt, t, len), material);
  m.position.set(x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2);
  m.rotation.x = Math.atan2(-dy, dz);
  return m;
}

/** y of the body outline's top edge at z (for placing lights and handles). */
function topAt(s, z) {
  const top = s.body.slice(1, -1);
  for (let i = 0; i < top.length - 1; i++) {
    const [z0, y0] = top[i], [z1, y1] = top[i + 1];
    if (z >= Math.min(z0, z1) && z <= Math.max(z0, z1)) return y0 + ((z - z0) / ((z1 - z0) || 1)) * (y1 - y0);
  }
  return top[0][1];
}

export const car = {
  id: 'car',
  label: 'Car',
  variants: [...Object.keys(CARS), 'Bus'],
  colors: VEHICLE_COLORS,
  build({ variant, color }, style) {
    if (variant === 'Bus') return buildBus(color, style);
    // the body sits 5 cm higher on its wheels than the outlines say (more ground clearance)
    const base = CARS[variant] ?? CARS.Sedan, LIFT = 0.05;
    const up = (pts) => pts.map(([z, y]) => [z, y + LIFT]);
    const s = { ...base, body: up(base.body), glass: up(base.glass) };
    const g = new THREE.Group();
    const paintHex = s.taxi && !color ? 0x1c2238 : CLOTH_COLORS[color] ?? 0xe8e8e8;
    const paint = style.material('paint', paintHex);
    const glass = style.material('glass', 0x2a3644);
    const dark = style.material('darkMetal', 0x1e2024);
    const trim = s.chrome ? style.material('metal', 0xd8dce0) : dark;
    const W = s.W, half = W / 2;
    const belt = s.glass[0][1];
    // lower body, the cabin glass (narrower: the sides lean in), roof and pillars
    g.add(extrude(bodyShape(s), W, paint, 0.05));
    const cabinW = W * 0.86;
    const gs = new THREE.Shape(s.glass.map(([z, y]) => new THREE.Vector2(z, y)));
    g.add(extrude(gs, cabinW, glass, 0.02));
    const [rw, r0, r1, ws] = s.glass; // rear window base, roof rear, roof front, windscreen base
    const roof = new THREE.Shape([new THREE.Vector2(r0[0] + 0.02, r0[1] - 0.06), new THREE.Vector2(r1[0] - 0.02, r1[1] - 0.06), new THREE.Vector2(r1[0] - 0.02, r1[1] + 0.025), new THREE.Vector2(r0[0] + 0.02, r0[1] + 0.025)]);
    g.add(extrude(roof, cabinW + 0.04, paint, 0.02));
    const px = cabinW / 2 + 0.005;
    for (const sx of [-1, 1]) {
      g.add(bar(ws, r1, sx * (px - 0.03), 0.07, 0.08, paint));                 // A pillar
      g.add(bar(rw, r0, sx * (px - 0.03), 0.08, 0.08, paint));                 // C / D pillar
      // B pillar: the rear edge of the front door (the last shut line still under the roof)
      const last = s.doors[s.doors.length - 1];
      const bz = (last <= r1[0] ? last : s.doors[0]) - 0.05;
      g.add(bar([bz, belt], [bz, (r0[1] + r1[1]) / 2], sx * px, 0.09, 0.03, s.chrome ? paint : dark));
      if (s.sliding) g.add(bar([s.doors[0] - 0.05, belt], [s.doors[0] - 0.05, r0[1] - 0.05], sx * px, 0.07, 0.03, dark));
    }
    // dark wheel wells seen through the arches, and the wheels
    // (from the bottom of the body up, so nothing dark hangs below the sills)
    const wellLo = s.body[0][1], wellHi = s.r + s.r * 0.95;
    g.add(box(W * 0.84, wellHi - wellLo, s.L * 0.9, dark, [0, (wellLo + wellHi) / 2, 0]));
    const tire = style.material('tire');
    const hubM = s.wheel === 'steel' ? style.material('metal', 0xb8bcc0) : s.wheel === 'retro' ? dark : style.material('metal', 0xd0d4d8);
    for (const z of s.wheels) {
      for (const sx of [-1, 1]) {
        const x = sx * (half - 0.11);
        g.add(wheel(s.r, 0.2, tire, [x, s.r, z]));
        g.add(wheel(s.r * (s.wheel === 'retro' ? 0.62 : 0.66), 0.21, hubM, [x, s.r, z]));
        if (s.wheel === 'retro') g.add(wheel(s.r * 0.22, 0.22, style.material('metal', 0xd8dce0), [x, s.r, z])); // chrome cap
      }
    }
    // door shut lines and handles on both sides
    for (const sx of [-1, 1]) {
      const x = sx * (half + 0.006);
      for (const dz of s.doors) g.add(bar([dz, s.body[0][1] + 0.06], [dz, belt - 0.02], x, 0.02, 0.012, dark));
      for (const dz of s.doors) g.add(box(0.012, 0.035, 0.16, style.material('metal', 0xc8ccd0), [x, belt - 0.12, dz - 0.25]));
      if (s.sliding) g.add(box(0.012, 0.025, s.doors[0] - s.wheels[0] - 0.2, dark, [x, belt - 0.06, (s.doors[0] + s.wheels[0]) / 2]));
      if (s.chrome) g.add(box(0.012, 0.03, s.L * 0.55, trim, [x, s.body[0][1] + 0.08, 0.1]));       // chrome sill line
    }
    // front: grille, lights, bumper; back: tail lights, bumper; number plates
    // the body's rounded edge (bevel) puts its surface 5 cm outside the outline:
    // lights, grille and tail lights sit on that surface, not inside it
    const front = s.body[s.body.length - 1][0] + 0.05, rear = s.body[0][0] - 0.05;
    const fy = topAt(s, front - 0.17) - 0.13;
    g.add(box(W * 0.42, 0.14, 0.04, s.chrome ? trim : dark, [0, fy - 0.04, front + 0.01]));                 // grille
    const light = style.material('light', 0xfff6dc), tail = style.material('light', 0xe0402f);
    for (const sx of [-1, 1]) {
      // a dark surround behind each lamp, so it reads on any paint colour (white cars too)
      if (s.chrome) {
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 10), trim);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(sx * half * 0.68, fy, front + 0.01);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10), light);
        l.rotation.x = Math.PI / 2;
        l.position.set(sx * half * 0.68, fy, front + 0.03);
        g.add(rim, l);
      } else {
        g.add(box(W * 0.24, 0.13, 0.04, dark, [sx * half * 0.66, fy + 0.02, front]));
        g.add(box(W * 0.2, 0.09, 0.05, light, [sx * half * 0.66, fy + 0.02, front + 0.015]));
      }
      const ty = topAt(s, rear + 0.15) - 0.16;
      g.add(box(s.taxi ? 0.14 : W * 0.16, s.taxi ? 0.38 : 0.12, 0.05, tail, [sx * half * 0.78, ty, rear - 0.01]));
    }
    const bumper = (z) => box(W * 0.98, 0.14, 0.12, s.chrome ? trim : style.material('paint', paintHex), [0, s.body[0][1] + 0.1, z]);
    g.add(bumper(front - 0.01), bumper(rear + 0.01));
    for (const z of [front + 0.06, rear - 0.06]) g.add(box(0.34, 0.16, 0.02, style.material('signage', 0xf4f4f0), [0, s.body[0][1] + 0.26, z]));
    // mirrors: on the doors, or out on the front fenders (taxis, older cars)
    for (const sx of [-1, 1]) {
      if (s.mirrors === 'fender') {
        const mz = front - 0.55, my = topAt(s, mz);
        g.add(box(0.025, 0.14, 0.025, dark, [sx * (half - 0.12), my + 0.07, mz]));
        g.add(box(0.05, 0.08, 0.1, dark, [sx * (half - 0.12), my + 0.15, mz]));
      } else g.add(box(0.12, 0.09, 0.06, style.material('paint', paintHex), [sx * (cabinW / 2 + 0.08), belt + 0.08, ws[0] - 0.12]));
    }
    if (s.taxi) {
      // the roof lamp (andon) and a small lit sign in the windscreen corner
      g.add(box(0.42, 0.16, 0.16, style.material('light', 0xfff3c4), [0, r1[1] + 0.1, (r0[0] + r1[0]) / 2 + 0.6]));
      g.add(box(0.2, 0.08, 0.02, style.material('light', 0xd8302a), [cabinW * 0.28, ws[1] + 0.12, ws[0] - 0.12]));
    }
    g.userData.size = CAR_SIZES[variant] ?? CAR_SIZES.Sedan;
    return g;
  },
};

/** A city bus: a tall box with a band of windows, a big windscreen, a front door, a lit destination sign. */
function buildBus(color, style) {
  const g = new THREE.Group();
  const L = 10.5, W = 2.5, H = 3.1, r = 0.5;
  const paint = style.material('paint', CLOTH_COLORS[color] ?? 0xf2f2ee);
  const stripe = style.material('paint', color && color !== 'White' ? 0xf2f2ee : 0x2fa36b);
  const glass = style.material('glass', 0x2a3644), dark = style.material('darkMetal', 0x1e2024);
  const body = softBox(W, H - 0.4, L, paint, { round: 0.08 });
  body.position.y = 0.4 + (H - 0.4) / 2;
  g.add(body);
  g.add(box(W + 0.02, 0.12, L - 0.4, stripe, [0, 1.15, 0]));                         // a colour band along the sides (the doors cover it)
  // side windows: separate panes, with gaps where the doors are (doors on the
  // left side only, the kerb side in Japan); the other side runs unbroken
  const doors = [L / 2 - 1.0, -0.6]; // door centres (z), 1.1 m wide
  const paneLen = 1.15, gap = 0.14, z0 = -L / 2 + 0.5, z1 = L / 2 - 1.75;
  for (const sx of [-1, 1]) {
    for (let z = z0; z + paneLen <= z1 + 0.01; z += paneLen + gap) {
      const mid = z + paneLen / 2;
      if (sx > 0 && doors.some((d) => Math.abs(mid - d) < 0.55 + paneLen / 2)) continue;
      g.add(box(0.05, 0.95, paneLen, glass, [sx * (W / 2 + 0.01), 2.25, mid]));
    }
  }
  // doors: a dark frame, two glass leaves with a split down the middle
  for (const dz of doors) {
    g.add(box(0.05, 2.35, 1.2, dark, [W / 2 + 0.012, 1.55, dz]));
    for (const k of [-1, 1]) g.add(box(0.05, 2.15, 0.5, glass, [W / 2 + 0.03, 1.6, dz + k * 0.27]));
  }
  g.add(box(W - 0.2, 1.5, 0.05, glass, [0, 2.0, L / 2 + 0.01]));                       // windscreen
  g.add(box(W - 0.6, 0.3, 0.06, style.material('light', 0xf0a020), [0, 2.9, L / 2 + 0.02])); // destination sign
  g.add(box(W - 0.5, 0.95, 0.05, glass, [0, 2.25, -L / 2 - 0.01]));                      // rear window
  g.add(box(W - 0.9, 0.22, 0.06, style.material('light', 0xf0a020), [0, 2.9, -L / 2 - 0.02])); // route number at the back
  g.add(box(W * 0.98, 0.3, 0.15, dark, [0, 0.45, L / 2]), box(W * 0.98, 0.3, 0.15, dark, [0, 0.45, -L / 2]));
  const light = style.material('light', 0xfff6dc), tail = style.material('light', 0xe0402f);
  for (const sx of [-1, 1]) {
    g.add(box(0.3, 0.14, 0.05, light, [sx * 0.9, 0.75, L / 2 + 0.01]));
    g.add(box(0.2, 0.4, 0.05, tail, [sx * 1.05, 1.0, -L / 2 - 0.01]));
  }
  const tire = style.material('tire'), hub = style.material('metal', 0xb8bcc0);
  for (const z of [L / 2 - 2.2, -L / 2 + 2.6]) for (const sx of [-1, 1]) {
    g.add(wheel(r, 0.3, tire, [sx * (W / 2 - 0.15), r, z]));
    g.add(wheel(r * 0.55, 0.31, hub, [sx * (W / 2 - 0.15), r, z]));
  }
  g.add(box(W * 0.85, 0.5, L * 0.9, dark, [0, 0.62, 0])); // wheel wells, above the body's bottom edge
  g.userData.size = CAR_SIZES.Bus;
  return g;
}

export const bicycle = {
  id: 'bicycle',
  label: 'Bicycle',
  variants: ['City bike'],
  colors: VEHICLE_COLORS,
  build({ color }, style) {
    const g = new THREE.Group();
    const frame = style.material('paint', CLOTH_COLORS[color] ?? 0xf2f2ee);
    const tire = style.material('tire');
    const metal = style.material('metal');
    const r = 0.33;
    const front = [0, r, 0.55], back = [0, r, -0.5];
    for (const p of [front, back]) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 4, WHEEL_SIDES), tire); // octagon wheels, like every vehicle
      t.rotation.y = Math.PI / 2;
      t.position.set(...p);
      g.add(t);
    }
    // step-through frame (mamachari)
    const crank = [0, 0.32, -0.05], seatPost = [0, 0.82, -0.25], head = [0, 0.82, 0.42];
    g.add(capsuleBetween(back, crank, 0.022, frame, 5));
    g.add(capsuleBetween(crank, [0, 0.45, 0.32], 0.026, frame, 5)); // low step-through tube
    g.add(capsuleBetween([0, 0.45, 0.32], head, 0.026, frame, 5));
    g.add(capsuleBetween(crank, seatPost, 0.024, frame, 5));
    g.add(capsuleBetween(seatPost, back, 0.02, frame, 5));
    g.add(capsuleBetween(head, front, 0.022, metal, 5));
    g.add(box(0.14, 0.06, 0.26, style.material('tire'), [0, 0.86, -0.27])); // saddle
    g.add(capsuleBetween([-0.28, 1.02, 0.36], [0.28, 1.02, 0.36], 0.018, metal, 5)); // handlebar
    g.add(capsuleBetween(head, [0, 1.02, 0.38], 0.02, metal, 5));
    // front basket and a mudguard over the back wheel
    g.add(box(0.36, 0.24, 0.3, style.material('darkMetal'), [0, 0.86, 0.66]));
    g.add(box(0.1, 0.03, 0.45, frame, [0, r + 0.36, -0.5]));
    return g;
  },
};

/** The town bus, on its own card too (it is also a Car variant). */
export const bus = {
  id: 'bus',
  label: 'Bus',
  variants: ['City bus'],
  colors: VEHICLE_COLORS,
  build({ color }, style) { return buildBus(color, style); },
};

export const scooter = {
  id: 'scooter',
  label: 'Motorbike',
  // 50cc / Delivery: the three-wheeled delivery scooter (one wheel in front,
  //   two close together behind, a flat floor, a windscreen, racks front and
  //   back); Delivery is the same with boxes on the racks
  // Step-through: the classic business moped (white leg shield, a coloured
  //   body under the seat, big spoked wheels, a chrome rack and exhaust)
  // Motorcycle: a 1980s sport tourer (half fairing with a screen, a long
  //   seat and tail, the engine showing, cast wheels)
  // Mini scooter: a tiny folding scooter (a box-shaped body, small wheels, a
  //   tall handlebar stem, a little seat on top)
  variants: ['50cc', 'Delivery', 'Step-through', 'Motorcycle', 'Mini scooter'],
  colors: VEHICLE_COLORS,
  ownColors: true, // each variant has its own default colour (no colour = that one)
  build({ variant = '50cc', color }, style) {
    const DEFAULT = { '50cc': 'White', Delivery: 'White', 'Step-through': 'Green', Motorcycle: 'Black', 'Mini scooter': 'Yellow' };
    const paint = style.material('paint', CLOTH_COLORS[color ?? DEFAULT[variant]] ?? 0xf2efe8);
    const M = {
      paint,
      white: style.material('paint', 0xf2efe8),
      tire: style.material('tire'),
      dark: style.material('darkMetal', 0x2f3236),
      metal: style.material('metal', 0xcfccc4),
      seat: style.material('tire', 0x2f3236),
      light: style.material('light', 0xf2efe8),
      tail: style.material('light', 0xc99c98),
      amber: style.material('light', 0xdcb08c),
      glass: style.material('glass', 0x9fb6cc),
    };
    const g = new THREE.Group();
    const poly = (pts) => new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const wheelAt = (z, r, w, x = 0, hub = M.dark, spokes = false) => {
      g.add(wheel(r, w, M.tire, [x, r, z]));
      g.add(wheel(r * (spokes ? 0.86 : 0.62), w + 0.01, spokes ? M.metal : hub, [x, r, z]));
      if (spokes) g.add(wheel(r * 0.8, w + 0.02, M.dark, [x, r, z]), wheel(r * 0.22, w + 0.03, M.metal, [x, r, z]));
    };
    const fork = (top, bottom, x = 0.08, mat = M.metal) => { for (const sx of [-1, 1]) g.add(capsuleBetween([sx * x, top[1], top[0]], [sx * x, bottom[1], bottom[0]], 0.025, mat, 5)); };
    const fender = (z, r, from, to, w, mat) => {
      // an arc over a wheel (angles in radians, 0 = forward)
      const sh = new THREE.Shape();
      sh.absarc(0, 0, r + 0.06, from, to, false);
      sh.absarc(0, 0, r + 0.02, to, from, true);
      const m = extrude(sh, w, mat, 0);
      m.position.set(0, r, z);
      g.add(m);
    };
    const handlebar = (z, y, w = 0.32) => g.add(capsuleBetween([-w, y, z], [w, y, z], 0.018, M.dark, 5));
    const mirror = (z, y, sx) => {
      g.add(capsuleBetween([sx * 0.22, y, z], [sx * 0.26, y + 0.22, z], 0.008, M.metal, 4));
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 8), M.metal);
      m.rotation.x = Math.PI / 2; // a round mirror facing back at the rider
      m.position.set(sx * 0.26, y + 0.24, z);
      g.add(m);
    };

    if (variant === 'Motorcycle') {
      wheelAt(0.74, 0.31, 0.13, 0, style.material('paint', 0xc99c98));
      wheelAt(-0.74, 0.31, 0.15, 0, style.material('paint', 0xc99c98));
      // tank, fairing, seat base and tail as one side outline
      // (the bodywork stays above the wheels: they show in full, like a real bike)
      g.add(extrude(poly([[-1.08, 0.86], [-0.95, 0.98], [-0.62, 0.92], [-0.1, 0.92], [0.02, 1.06], [0.36, 1.09], [0.56, 1.12], [0.8, 1.04], [0.96, 0.84], [0.86, 0.7], [0.55, 0.72], [0.3, 0.8], [-0.15, 0.7], [-0.45, 0.72], [-0.98, 0.8]]), 0.34, paint, 0.03));
      g.add(extrude(poly([[-0.88, 0.96], [-0.68, 1.04], [-0.1, 0.98], [-0.05, 0.92], [-0.88, 0.92]]), 0.3, M.seat, 0.02)); // seat
      g.add(extrude(poly([[0.45, 0.62], [0.5, 0.42], [0.35, 0.3], [0.0, 0.3], [-0.05, 0.42], [0.3, 0.66]]), 0.3, style.material('paint', 0x6f747a), 0.02)); // grey belly pan under the engine
      g.add(extrude(poly([[0.56, 1.12], [0.66, 1.36], [0.72, 1.34], [0.8, 1.04]]), 0.3, M.glass, 0)); // screen
      g.add(box(0.28, 0.32, 0.42, M.dark, [0, 0.5, 0.05]));                                    // engine
      for (let k = 0; k < 3; k++) g.add(box(0.3, 0.025, 0.3, M.dark, [0, 0.64 + k * 0.05, 0.12]));
      g.add(capsuleBetween([0.12, 0.34, 0.1], [0.14, 0.42, -0.85], 0.055, M.dark, 6));        // silencer
      fork([0.62, 1.04], [0.74, 0.31]);
      g.add(capsuleBetween([0, 0.5, -0.1], [0, 0.31, -0.74], 0.03, M.metal, 5));              // swingarm
      g.add(capsuleBetween([0, 0.78, -0.45], [0, 0.4, -0.6], 0.03, M.dark, 5));               // rear shock
      fender(0.74, 0.31, Math.PI * 0.2, Math.PI * 0.75, 0.14, paint);
      g.add(box(0.2, 0.08, 0.05, M.light, [0, 0.9, 0.96]));                                    // headlight
      g.add(box(0.18, 0.06, 0.04, M.tail, [0, 0.92, -1.08]));
      for (const sx of [-1, 1]) g.add(box(0.06, 0.04, 0.04, M.amber, [sx * 0.2, 0.92, 0.8]));
      g.add(box(0.36, 0.02, 0.9, style.material('paint', 0xc99c98), [0, 0.92, 0.12]));        // a pinstripe
      handlebar(0.5, 1.08, 0.28);
      for (const sx of [-1, 1]) g.add(box(0.08, 0.06, 0.05, M.dark, [sx * 0.24, 1.16, 0.72])); // fairing mirrors
      g.userData.size = { hw: 0.4, hd: 1.1 };
      g.userData.seat = { y: 1.0, z: -0.5 }; // where a rider sits (City: sitOnBike)
      return g;
    }

    if (variant === 'Step-through') {
      wheelAt(0.62, 0.3, 0.09, 0, M.dark, true);
      wheelAt(-0.6, 0.3, 0.1, 0, M.dark, true);
      // the coloured body under the seat, over the back wheel
      g.add(extrude(poly([[-1.0, 0.56], [-0.98, 0.78], [-0.3, 0.82], [-0.05, 0.74], [0.02, 0.46], [-0.22, 0.4], [-0.32, 0.58], [-0.86, 0.6]]), 0.3, paint, 0.03));
      // the white leg shield, sweeping down from the steering head to the floor
      g.add(extrude(poly([[0.02, 0.3], [0.2, 0.28], [0.44, 0.98], [0.34, 1.04], [0.14, 0.62], [0.0, 0.48]]), 0.4, M.white, 0.03));
      g.add(box(0.3, 0.13, 0.56, M.seat, [0, 0.9, -0.38]));                                   // seat
      g.add(box(0.34, 0.03, 0.46, M.metal, [0, 0.86, -0.82]));                                 // chrome rack
      g.add(box(0.2, 0.18, 0.26, M.metal, [0, 0.32, 0.0]));                                    // engine
      g.add(capsuleBetween([-0.14, 0.24, 0.1], [-0.14, 0.3, -0.95], 0.04, M.metal, 6));        // chrome exhaust
      fork([0.42, 1.0], [0.62, 0.3], 0.07, paint);
      fender(0.62, 0.3, Math.PI * 0.1, Math.PI * 0.9, 0.14, paint);                           // the big front mudguard
      // headlight in a cowl on the handlebar, round mirror on a stalk
      g.add(box(0.2, 0.16, 0.16, paint, [0, 1.08, 0.44]));
      const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), M.light);
      hl.rotation.x = Math.PI / 2;
      hl.position.set(0, 1.08, 0.53);
      g.add(hl);
      handlebar(0.42, 1.12, 0.3);
      mirror(0.4, 1.12, -1);
      for (const sx of [-1, 1]) g.add(box(0.06, 0.05, 0.05, M.amber, [sx * 0.14, 1.1, 0.52]));
      g.add(box(0.12, 0.08, 0.05, M.tail, [0, 0.76, -1.02]));
      g.userData.size = { hw: 0.35, hd: 1.0 };
      g.userData.seat = { y: 0.94, z: -0.38 };
      return g;
    }

    if (variant === 'Mini scooter') {
      // small wheels showing under the box: the front one ahead of it on a short fork
      wheelAt(0.66, 0.17, 0.1);
      wheelAt(-0.36, 0.17, 0.1);
      // the box body: a rounded rectangle up off the ground
      g.add(extrude(poly([[-0.56, 0.38], [-0.56, 0.7], [0.48, 0.7], [0.54, 0.64], [0.54, 0.44], [0.48, 0.38]]), 0.3, paint, 0.03));
      g.add(box(0.32, 0.07, 0.9, M.dark, [0, 0.6, -0.03]));                                    // dark side strip (handles)
      g.add(box(0.3, 0.14, 0.42, M.dark, [0, 0.3, -0.3]));                                     // engine under the back
      g.add(box(0.2, 0.06, 0.3, M.seat, [0, 0.8, -0.3]));                                      // seat
      g.add(box(0.04, 0.08, 0.04, M.dark, [0, 0.74, -0.3]));
      fork([0.5, 0.62], [0.66, 0.17], 0.05, M.dark);
      g.add(capsuleBetween([0, 0.68, 0.5], [0, 1.14, 0.42], 0.022, M.dark, 5));                // handlebar stem
      handlebar(0.42, 1.14, 0.2);
      g.add(box(0.1, 0.08, 0.06, M.light, [0, 1.02, 0.47]));
      g.add(box(0.1, 0.06, 0.03, M.amber, [0, 0.6, -0.58]));
      fender(0.66, 0.17, Math.PI * 0.15, Math.PI * 0.85, 0.1, M.dark);
      mirror(0.44, 1.14, -1);
      g.userData.size = { hw: 0.25, hd: 0.7 };
      g.userData.seat = { y: 0.84, z: -0.3, splay: 0.45 }; // a wide box body: knees out either side of it
      return g;
    }

    // 50cc / Delivery: the three-wheeled delivery scooter
    wheelAt(0.62, 0.2, 0.1);
    for (const sx of [-1, 1]) wheelAt(-0.56, 0.2, 0.11, sx * 0.24);
    // leg shield: rises from the front wheel and leans back toward the rider
    g.add(extrude(poly([[0.2, 0.3], [0.56, 0.32], [0.42, 1.0], [0.3, 1.06], [0.24, 0.6], [0.16, 0.42]]), 0.4, paint, 0.03));
    g.add(box(0.36, 0.06, 0.62, M.dark, [0, 0.3, -0.04]));                                     // floor deck
    g.add(extrude(poly([[-0.9, 0.36], [-0.9, 0.62], [-0.3, 0.66], [-0.16, 0.5], [-0.22, 0.32]]), 0.42, paint, 0.03)); // rear body
    const pod = softBox(0.78, 0.26, 0.62, paint, { round: 0.4 });                             // fender pod over the back wheels
    pod.position.set(0, 0.36, -0.56);
    g.add(pod);
    g.add(box(0.32, 0.1, 0.48, M.seat, [0, 0.72, -0.42]));                                    // seat
    g.add(box(0.42, 0.03, 0.42, M.metal, [0, 0.78, -0.8]));                                   // rear rack
    g.add(box(0.32, 0.03, 0.26, M.metal, [0, 0.74, 0.72]));                                   // front rack
    fork([0.42, 0.95], [0.62, 0.2], 0.06, M.dark);
    g.add(extrude(poly([[0.34, 1.1], [0.28, 1.42], [0.34, 1.44], [0.44, 1.08]]), 0.36, M.glass, 0)); // windscreen, leaning back too
    handlebar(0.34, 1.1, 0.3);
    g.add(box(0.14, 0.1, 0.05, M.light, [0, 0.9, 0.5]));
    for (const sx of [-1, 1]) {
      g.add(box(0.06, 0.05, 0.05, M.amber, [sx * 0.18, 0.98, 0.47]));
      g.add(box(0.06, 0.08, 0.04, M.tail, [sx * 0.3, 0.52, -0.9]));
    }
    mirror(0.34, 1.1, -1);
    mirror(0.34, 1.1, 1);
    if (variant === 'Delivery') {
      // cardboard boxes strapped to both racks
      const card = style.material('cloth', 0xd8caa8), strap = M.dark;
      g.add(box(0.46, 0.4, 0.42, card, [0, 1.0, -0.8]));
      g.add(box(0.47, 0.41, 0.04, strap, [0, 1.0, -0.72]), box(0.47, 0.41, 0.04, strap, [0, 1.0, -0.88]));
      g.add(box(0.32, 0.24, 0.24, card, [0, 0.88, 0.72]));
      g.add(box(0.33, 0.25, 0.03, strap, [0, 0.88, 0.72]));
    }
    g.userData.size = { hw: 0.45, hd: 0.95 };
    g.userData.seat = { y: 0.76, z: -0.4 };
    return g;
  },
};
