import * as THREE from 'three';
import { capsuleBetween } from '../lib/shapes.js';
import { bench, streetLamp, trashBin } from '../props/furniture.js';
import { vendingMachine } from '../props/extras.js';
import { tree } from '../subjects/tree.js';
import { defaultsFor } from '../viewer/params.js';
import { box, cyl, tiledBox } from '../props/util.js';

// A Japanese neighbourhood park (公園): grass, a cross of paths, trees round
// the edge, benches, a playground (slide, swings, sandbox, climbing frame),
// a small toilet hut, lamps and a low fence. Fills a w × d lot centred on the
// origin. Returns the group and box colliders for the solid parts.

export function park(style, rng, w, d) {
  const g = new THREE.Group();
  const colliders = [];
  const solid = (obj, cw, cd) => {
    colliders.push({ x: obj.position.x, z: obj.position.z, hw: cw / 2, hd: cd / 2 });
  };
  g.add(tiledBox(w, 0.06, d, style.material('grass'), [0, 0.03, 0]));
  const path = style.material('sidewalk', 0xd8cdb4);
  g.add(tiledBox(w, 0.08, 2.4, path, [0, 0.04, 0]));
  g.add(tiledBox(2.4, 0.08, d, path, [0, 0.04, 0]));

  // trees round the edge (a mix of the tree presets)
  const presets = Object.keys(tree.presets);
  const base = defaultsFor(tree);
  const spots = [];
  for (let x = -w / 2 + 3; x <= w / 2 - 3; x += 7) spots.push([x, -d / 2 + 2.5], [x, d / 2 - 2.5]);
  for (let z = -d / 2 + 9; z <= d / 2 - 9; z += 7) spots.push([-w / 2 + 2.5, z], [w / 2 - 2.5, z]);
  for (const [x, z] of spots) {
    if (Math.abs(x) < 3 || Math.abs(z) < 3) continue; // keep the path entrances open
    const name = presets[Math.floor(rng() * presets.length)];
    const t = tree.build({ ...base, ...tree.presets[name], seed: 1 + Math.floor(rng() * 50) }, style);
    t.scale.setScalar(0.8 + rng() * 0.3);
    t.position.set(x, 0, z);
    g.add(t);
    colliders.push({ x, z, hw: 0.4, hd: 0.4 });
  }

  // benches facing the paths
  for (const [x, z, ry] of [[-6, 2, Math.PI], [6, 2, Math.PI], [-6, -2, 0], [6, -2, 0]]) {
    const b = bench.build({ variant: 'Park bench' }, style);
    b.position.set(x, 0, z + Math.sign(z) * 0.6);
    b.rotation.y = ry;
    g.add(b);
  }

  // playground in one quarter
  const px = w / 4 + 1, pz = d / 4 + 1;
  const play = new THREE.Group();
  play.position.set(px, 0, pz);
  const red = style.material('signage', 0xd8443c);
  const blue = style.material('signage', 0x3f7fd6);
  const yellow = style.material('signage', 0xf2c230);
  // slide: ladder tower and a sloped chute
  play.add(box(1.2, 1.8, 1.2, blue, [-3, 0.9, -2]));
  play.add(box(0.7, 0.05, 3.2, yellow, [-3, 0.95, -0.15], [-0.5, 0, 0]));
  // swings: an A-frame with two seats
  for (const sx of [-1, 1]) {
    play.add(capsuleBetween([3 + sx * 1.6, 0, -2.6], [3 + sx * 1.6, 2.4, -2], 0.06, red, 6));
    play.add(capsuleBetween([3 + sx * 1.6, 0, -1.4], [3 + sx * 1.6, 2.4, -2], 0.06, red, 6));
  }
  play.add(capsuleBetween([1.4, 2.4, -2], [4.6, 2.4, -2], 0.06, red, 6));
  for (const sx of [-0.7, 0.7]) {
    play.add(capsuleBetween([3 + sx, 2.4, -2], [3 + sx, 0.55, -2], 0.015, style.material('metal'), 4));
    play.add(box(0.5, 0.06, 0.25, style.material('wood'), [3 + sx, 0.52, -2]));
  }
  // sandbox and a climbing frame
  play.add(box(3, 0.25, 3, style.material('wood'), [-2.6, 0.12, 2.4]));
  play.add(box(2.7, 0.27, 2.7, style.material('sidewalk', 0xe6d2a0), [-2.6, 0.12, 2.4]));
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 3; k++) play.add(cyl(0.04, 0.04, 1.6, yellow, [2 + i * 0.7, 0.8, 1.8 + k * 0.7], { segments: 5 }));
    play.add(box(1.5, 0.05, 0.05, yellow, [2.7, 0.5 + i * 0.5, 1.8]));
    play.add(box(1.5, 0.05, 0.05, yellow, [2.7, 0.5 + i * 0.5, 3.2]));
  }
  g.add(play);
  colliders.push({ x: px - 3, z: pz - 2, hw: 0.6, hd: 0.6 }, { x: px + 3, z: pz - 2, hw: 1.8, hd: 0.7 });

  // toilet hut and a vending machine in the opposite quarter
  const hut = new THREE.Group();
  hut.position.set(-w / 4 - 1, 0, -d / 4 - 1);
  hut.add(box(4, 2.8, 3, style.material('building', 0xd8d0c0), [0, 1.4, 0]));
  hut.add(box(4.6, 0.25, 3.6, style.material('roof'), [0, 2.9, 0]));
  hut.add(box(0.9, 2, 0.1, style.material('window'), [-0.8, 1, 1.51]));
  hut.add(box(0.9, 2, 0.1, style.material('window'), [0.8, 1, 1.51]));
  g.add(hut);
  solid(hut, 4, 3);
  const vm = vendingMachine.build({ variant: 'Blue' }, style);
  vm.position.set(-w / 4 + 2.2, 0, -d / 4 - 1.5);
  g.add(vm);
  solid(vm, 1, 0.8);
  const bin = trashBin.build({ variant: 'Recycling station' }, style);
  bin.position.set(-w / 4 + 4.2, 0, -d / 4 - 1.5);
  g.add(bin);

  // lamps by the paths
  for (const [x, z] of [[-w / 4, 1.6], [w / 4, -1.6]]) {
    const l = streetLamp.build({ variant: 'Single' }, style);
    l.scale.setScalar(0.7);
    l.position.set(x, 0, z);
    g.add(l);
  }

  // low fence round the edge, with openings at the paths
  const fence = style.material('metal', 0x4f7a54);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const len = w / 2 - 2;
      g.add(box(len, 0.6, 0.05, fence, [sx * (len / 2 + 1.6), 0.3, sz * (d / 2 - 0.3)]));
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const len = d / 2 - 2;
      g.add(box(0.05, 0.6, len, fence, [sx * (w / 2 - 0.3), 0.3, sz * (len / 2 + 1.6)]));
    }
  }
  return { group: g, colliders };
}
