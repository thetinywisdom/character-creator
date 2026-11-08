import * as THREE from 'three';
import { capsuleBetween, softBox } from '../lib/shapes.js';
import { CLOTH_COLORS } from '../styles/palette.js';
import { box, cyl, wheel } from './util.js';

// Batch C – vehicles: Japanese kei car, sedan, minivan, taxi (with a roof
// lamp), a city bike ("mamachari") with a front basket, and a small scooter.
// Vehicles face +z (front), wheels on y = 0.

export const VEHICLE_COLORS = ['White', 'Black', 'Gray', 'Red', 'Blue', 'Navy', 'Yellow', 'Green', 'Pink', 'Teal'];

const CARS = {
  // length, width, body height, cabin height, wheel radius, cabin start/end (fraction of length from the back)
  'Kei car': { L: 3.4, W: 1.48, body: 0.75, cabin: 0.85, r: 0.29, c0: 0.04, c1: 0.82, boxy: true },
  Sedan:     { L: 4.6, W: 1.75, body: 0.72, cabin: 0.62, r: 0.32, c0: 0.22, c1: 0.7 },
  Minivan:   { L: 4.7, W: 1.72, body: 0.85, cabin: 0.92, r: 0.32, c0: 0.06, c1: 0.78, boxy: true },
  Taxi:      { L: 4.6, W: 1.7, body: 0.72, cabin: 0.62, r: 0.32, c0: 0.22, c1: 0.7, taxi: true },
};

export const car = {
  id: 'car',
  label: 'Car',
  variants: Object.keys(CARS),
  colors: VEHICLE_COLORS,
  build({ variant, color }, style) {
    const s = CARS[variant] ?? CARS.Sedan;
    const g = new THREE.Group();
    const paintHex = s.taxi && !color ? 0xf2c230 : CLOTH_COLORS[color] ?? 0xe8e8e8;
    const paint = style.material('paint', paintHex);
    const glass = style.material('glass');
    const z0 = -s.L / 2;
    const bodyY = s.r * 0.75;
    // lower body: a softened box
    const body = softBox(s.W, s.body, s.L, paint, { round: 0.18 });
    body.position.y = bodyY + s.body / 2;
    g.add(body);
    // cabin (glasshouse): softened box, a little narrower, with glass sides
    const cl = (s.c1 - s.c0) * s.L;
    const cz = z0 + (s.c0 + s.c1) / 2 * s.L;
    const cabin = softBox(s.W * 0.9, s.cabin, cl, glass, { round: s.boxy ? 0.15 : 0.3, topRound: s.boxy ? 0 : 0.3 });
    cabin.position.set(0, bodyY + s.body + s.cabin / 2 - 0.02, cz);
    g.add(cabin);
    // painted roof and pillars over the glass
    g.add(box(s.W * 0.86, 0.05, cl * (s.boxy ? 0.95 : 0.75), paint, [0, bodyY + s.body + s.cabin - 0.01, cz]));
    for (const sx of [-1, 1]) g.add(box(0.06, s.cabin * 0.9, 0.08, paint, [sx * s.W * 0.43, bodyY + s.body + s.cabin / 2, cz]));
    // wheels with grey hubs
    const tire = style.material('tire');
    const hub = style.material('metal');
    for (const zf of [0.18, 0.8]) {
      for (const sx of [-1, 1]) {
        const z = z0 + zf * s.L;
        g.add(wheel(s.r, 0.2, tire, [sx * (s.W / 2 - 0.08), s.r, z]));
        g.add(wheel(s.r * 0.5, 0.21, hub, [sx * (s.W / 2 - 0.08), s.r, z]));
      }
    }
    // lights and number plate
    const light = style.material('light');
    const tail = style.material('light', 0xe0402f);
    for (const sx of [-1, 1]) {
      g.add(box(0.28, 0.12, 0.04, light, [sx * s.W * 0.33, bodyY + s.body * 0.7, s.L / 2]));
      g.add(box(0.22, 0.14, 0.04, tail, [sx * s.W * 0.36, bodyY + s.body * 0.75, -s.L / 2]));
    }
    for (const z of [s.L / 2 + 0.01, -s.L / 2 - 0.01]) {
      g.add(box(0.33, 0.16, 0.02, style.material('signage', 0xf4f4f0), [0, bodyY + s.body * 0.3, z]));
    }
    if (s.taxi) {
      // the roof lamp ("andon") of a Japanese taxi
      const roofY = bodyY + s.body + s.cabin + 0.02;
      g.add(box(0.5, 0.18, 0.2, style.material('light', 0xfff3c4), [0, roofY + 0.09, cz]));
    }
    return g;
  },
};

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
