import * as THREE from 'three';
import { capsuleBetween, softBox } from '../lib/shapes.js';
import { CLOTH_COLORS } from '../styles/palette.js';
import { box, cyl, wheel } from './util.js';

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
    const s = CARS[variant] ?? CARS.Sedan;
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
    g.add(box(W * 0.84, s.r * 1.3, s.L * 0.9, dark, [0, s.r * 0.95, 0]));
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
    const front = s.body[s.body.length - 1][0], rear = s.body[0][0];
    const fy = topAt(s, front - 0.12) - 0.13;
    g.add(box(W * 0.42, 0.14, 0.04, s.chrome ? trim : dark, [0, fy - 0.04, front + 0.01]));                 // grille
    const light = style.material('light', 0xfff6dc), tail = style.material('light', 0xe0402f);
    for (const sx of [-1, 1]) {
      if (s.chrome) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 10), light);
        l.rotation.x = Math.PI / 2;
        l.position.set(sx * half * 0.68, fy, front + 0.01);
        g.add(l);
      } else g.add(box(W * 0.2, 0.09, 0.05, light, [sx * half * 0.66, fy + 0.02, front - 0.01]));
      const ty = topAt(s, rear + 0.1) - 0.16;
      g.add(box(s.taxi ? 0.14 : W * 0.16, s.taxi ? 0.38 : 0.12, 0.05, tail, [sx * half * 0.78, ty, rear - 0.01]));
    }
    const bumper = (z) => box(W * 0.98, 0.14, 0.12, s.chrome ? trim : style.material('paint', paintHex), [0, s.body[0][1] + 0.1, z]);
    g.add(bumper(front + 0.04), bumper(rear - 0.04));
    for (const z of [front + 0.11, rear - 0.11]) g.add(box(0.34, 0.16, 0.02, style.material('signage', 0xf4f4f0), [0, s.body[0][1] + 0.26, z]));
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
  const body = softBox(W, H - 0.35, L, paint, { round: 0.08 });
  body.position.y = 0.35 + (H - 0.35) / 2;
  g.add(body);
  g.add(box(W + 0.02, 0.12, L - 0.4, stripe, [0, 1.15, 0]));                         // a colour band along the sides
  g.add(box(W + 0.03, 1.0, L - 2.8, glass, [0, 2.2, -0.9]));                          // side window band
  for (let i = 0; i < 7; i++) g.add(box(W + 0.04, 1.0, 0.1, paint, [0, 2.2, -L / 2 + 0.6 + i * 1.32])); // window posts
  g.add(box(W - 0.2, 1.5, 0.05, glass, [0, 2.0, L / 2 + 0.01]));                       // windscreen
  g.add(box(W - 0.6, 0.3, 0.06, style.material('light', 0xf0a020), [0, 2.9, L / 2 + 0.02])); // destination sign
  g.add(box(0.05, 2.3, 1.1, glass, [W / 2 + 0.01, 1.4, L / 2 - 1.0]));                  // front door (left side: Japan)
  g.add(box(0.05, 2.3, 1.1, glass, [W / 2 + 0.01, 1.4, -0.5]));                         // middle door
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
  g.add(box(W * 0.85, 0.6, L * 0.9, dark, [0, 0.5, 0]));
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
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 4, 14), tire);
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

export const scooter = {
  id: 'scooter',
  label: 'Motorbike',
  // 50cc: a small step-through scooter; Delivery: the same with a big box on
  // the back; Step-through: the classic moped with leg shields and a front
  // basket; Motorcycle: a naked road bike (tank, engine, exhaust)
  variants: ['50cc', 'Delivery', 'Step-through', 'Motorcycle'],
  colors: VEHICLE_COLORS,
  build({ variant = '50cc', color }, style) {
    const g = new THREE.Group();
    const paint = style.material('paint', CLOTH_COLORS[color] ?? 0xd8443c);
    const tire = style.material('tire');
    const metal = style.material('metal');
    const dark = style.material('darkMetal');
    if (variant === 'Motorcycle') {
      const r = 0.3;
      g.add(wheel(r, 0.13, tire, [0, r, 0.72]));
      g.add(wheel(r, 0.15, tire, [0, r, -0.72]));
      // engine block between the wheels, tank on top, seat behind it
      g.add(box(0.3, 0.32, 0.5, dark, [0, 0.42, 0.02]));
      const tank = softBox(0.34, 0.24, 0.5, paint, { round: 0.4 });
      tank.position.set(0, 0.86, 0.22);
      g.add(tank);
      g.add(box(0.26, 0.1, 0.58, tire, [0, 0.84, -0.32], [0.08, 0, 0]));       // seat
      g.add(box(0.2, 0.14, 0.4, paint, [0, 0.78, -0.62], [0.2, 0, 0]));        // tail
      g.add(capsuleBetween([0, 0.62, -0.35], [0, r, -0.72], 0.03, metal, 5));  // swingarm
      g.add(capsuleBetween([0, 1.0, 0.5], [0, r, 0.72], 0.03, metal, 5));      // forks
      g.add(capsuleBetween([-0.34, 1.06, 0.46], [0.34, 1.06, 0.46], 0.022, dark, 5)); // bars
      g.add(cyl(0.08, 0.08, 0.08, style.material('light'), [0, 0.98, 0.62], { rot: [Math.PI / 2, 0, 0] })); // round headlight
      g.add(capsuleBetween([0.18, 0.34, 0.2], [0.2, 0.42, -0.8], 0.045, metal, 6)); // exhaust
      return g;
    }
    const r = 0.22;
    g.add(wheel(r, 0.1, tire, [0, r, 0.6]));
    g.add(wheel(r, 0.1, tire, [0, r, -0.6]));
    if (variant === 'Step-through') {
      // a backbone frame low between the wheels, leg shields, a front basket
      g.add(capsuleBetween([0, 0.82, 0.48], [0, 0.4, 0.05], 0.05, paint, 6));
      g.add(capsuleBetween([0, 0.4, 0.05], [0, 0.55, -0.4], 0.06, paint, 6));
      g.add(box(0.36, 0.5, 0.06, paint, [0, 0.55, 0.36], [-0.25, 0, 0]));       // leg shields
      g.add(box(0.26, 0.12, 0.48, paint, [0, 0.58, -0.45]));                    // side covers
      g.add(box(0.26, 0.08, 0.5, tire, [0, 0.7, -0.4]));                        // seat
      g.add(box(0.36, 0.05, 0.36, dark, [0, 0.74, -0.85]));                     // rear rack
      g.add(capsuleBetween([0, 1.02, 0.5], [0, r, 0.6], 0.025, metal, 5));       // forks
      g.add(capsuleBetween([-0.3, 1.06, 0.48], [0.3, 1.06, 0.48], 0.022, metal, 5));
      g.add(box(0.12, 0.09, 0.05, style.material('light'), [0, 0.98, 0.58]));
      g.add(box(0.32, 0.2, 0.26, dark, [0, 0.94, 0.72]));                       // basket
      return g;
    }
    // body: rear cowl under the seat, low floorboard, front shield
    const cowl = softBox(0.4, 0.42, 0.8, paint, { round: 0.35 });
    cowl.position.set(0, 0.5, -0.38);
    g.add(cowl);
    g.add(box(0.3, 0.08, 0.5, paint, [0, 0.3, 0.12]));
    g.add(box(0.42, 0.7, 0.12, paint, [0, 0.62, 0.45], [-0.2, 0, 0]));
    g.add(box(0.3, 0.08, 0.6, tire, [0, 0.75, -0.4])); // seat
    g.add(cyl(0.03, 0.03, 0.4, metal, [0, 0.95, 0.52], { rot: [-0.25, 0, 0] }));
    g.add(capsuleBetween([-0.3, 1.13, 0.47], [0.3, 1.13, 0.47], 0.025, dark, 5));
    g.add(box(0.14, 0.1, 0.05, style.material('light'), [0, 1.0, 0.58]));
    if (variant === 'Delivery') {
      // a big delivery box on a rack, in the bike's colour with a white lid
      g.add(box(0.5, 0.06, 0.5, dark, [0, 0.82, -0.78]));
      g.add(box(0.48, 0.4, 0.46, paint, [0, 1.05, -0.78]));
      g.add(box(0.5, 0.05, 0.48, style.material('paint', 0xf2f2ee), [0, 1.27, -0.78]));
    } else {
      g.add(box(0.36, 0.26, 0.32, dark, [0, 0.92, -0.75])); // rear box
    }
    return g;
  },
};
