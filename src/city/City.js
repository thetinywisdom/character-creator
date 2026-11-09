import * as THREE from 'three';
import { setDetail } from '../lib/shapes.js';
import { mergeByMaterial } from '../lib/merge.js';
import { takeSwings } from './playground.js';
import { Knockables } from './knock.js';
import { skinCharacter, vertexColorMaterial } from '../lib/skin.js';
import { mulberry32 } from '../lib/rng.js';
import { bicycle, car, scooter } from '../props/vehicles.js';
import { Interactions } from './interact.js';
import { Crowd, leanInto, pedalPose, sitPose } from './crowd.js';
import { createAsset } from '../catalog/index.js';
import { generateCityData } from './layout.js';
import { buildCity } from './build.js';
import { JOINT_NAMES, NPC_RUN_SPEED, PLAYER_RUN_SPEED, createGait, landGait, poseGait, stepGait, tuneOf } from '../anim/gait.js';
import { Precipitation, lampPools, setNightGlow, setSnowCover, weatherLight } from './atmosphere.js';
import { giveHeldItem } from '../subjects/human.js';
import { addObjectSilhouette, addSilhouette, markPerson, silhouetteMaterial } from './silhouette.js';
import { CAT_JOINTS, CAT_RUN_SPEED, CAT_WALK_SPEED, createCatGait, poseCat, stepCatGait } from '../anim/catGait.js';

// The walkable town: a generated city, your character (built from the
// creator's current settings), pedestrians on the sidewalks, cats in the park
// and a few cars on the ring road. Rendered by main.js like any other cell
// (it has .scene and .style), with its own camera.

const LIMBS = new Set([...JOINT_NAMES, 'head']); // kept as separate groups so they can move
const PLAYER_R = 0.3;
const PERSON_R = 0.28; // pedestrians

/**
 * Point at distance s along a closed polyline, with every corner rounded by
 * a curve of radius r (so walkers and cars turn smoothly instead of snapping
 * 90°). Returns the position and the direction of travel (dx, dz).
 */
function alongLoop(loop, lengths, total, s, r = 0) {
  s = ((s % total) + total) % total;
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    if (s <= lengths[i]) {
      const a = loop[i], b = loop[(i + 1) % n];
      const len = Math.max(lengths[i], 1e-6);
      if (r > 0) {
        // the rounding at a corner k uses the same radius from both sides
        const rAt = (k) => Math.min(r, lengths[(k - 1 + n) % n] / 2, lengths[k] / 2);
        const rEnd = rAt((i + 1) % n), rStart = rAt(i);
        if (s > len - rEnd) return corner(loop, (i + 1) % n, rEnd, (s - (len - rEnd)) / (2 * rEnd));
        if (s < rStart) return corner(loop, i, rStart, 0.5 + s / (2 * rStart));
      }
      const t = s / len;
      return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: b[0] - a[0], dz: b[1] - a[1] };
    }
    s -= lengths[i];
  }
  return { x: loop[0][0], z: loop[0][1], dx: 1, dz: 0 };
}

/** On the curve round corner k (radius r), at t from 0 (before) to 1 (after). */
function corner(loop, k, r, t) {
  const n = loop.length;
  const p = loop[(k - 1 + n) % n], c = loop[k], q = loop[(k + 1) % n];
  const li = Math.hypot(c[0] - p[0], c[1] - p[1]) || 1, lo = Math.hypot(q[0] - c[0], q[1] - c[1]) || 1;
  const p0 = [c[0] - ((c[0] - p[0]) / li) * r, c[1] - ((c[1] - p[1]) / li) * r];
  const p2 = [c[0] + ((q[0] - c[0]) / lo) * r, c[1] + ((q[1] - c[1]) / lo) * r];
  const u = 1 - t;
  // quadratic curve with the corner as control point; its slope is the heading
  return {
    x: u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0],
    z: u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1],
    dx: 2 * u * (c[0] - p0[0]) + 2 * t * (p2[0] - c[0]),
    dz: 2 * u * (c[1] - p0[1]) + 2 * t * (p2[1] - c[1]),
  };
}

function loopLengths(loop) {
  const lengths = loop.map((a, i) => {
    const b = loop[(i + 1) % loop.length];
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  });
  return { lengths, total: lengths.reduce((s, l) => s + l, 0) };
}

export class City {
  constructor({ style, renderer, human, cat, params, npcCount = 46, seed = 3, data = null }) {
    this.style = style;
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.baseBackground = new THREE.Color(style.background);
    this.scene.background = this.baseBackground.clone();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

    const lights = style.createLights({ renderer });
    this.key = lights.key;
    this.hemi = lights.hemi;
    this.base = { keyColor: this.key.color.clone(), keyIntensity: this.key.intensity, hemiIntensity: this.hemi.intensity };
    lights.objects.forEach((o) => this.scene.add(o));
    this.key.shadow.mapSize.set(1024, 1024);
    const sc = this.key.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 120;
    sc.updateProjectionMatrix();
    this.key.shadow.normalBias = 0.04;
    this.lightDir = new THREE.Vector3(0.5, 1, 0.6).normalize();

    // --- the town (static, merged to a few meshes) --------------------------
    setDetail(style.detail ?? 1);
    // any city file (generated, edited or loaded); a generated town by default
    const cityData = data ?? generateCityData(seed);
    const city = buildCity(cityData, style);
    this.layout = city;
    // small props you can knock over come out of the merged town (knock.js)
    this.knock = new Knockables(this, city.group, city.colliders);
    // parked cars and bicycles in the town come out of it too, so you can ride them
    this.parkedRides = takeRideables(this, city.group, city.colliders);
    // the swing seats too, so they swing (playground.js)
    this.swings = takeSwings(this, city.group);
    this.scene.add(mergeByMaterial(city.group));
    // light pools under the street lamps, shown at night (atmosphere.js);
    // a lamp's head reaches 1.45 m out over the road from its post
    this.pools = lampPools(cityData.objects.filter((o) => o.asset === 'prop.streetLamp').map((o) => {
      const r = ((o.rot ?? 0) * Math.PI) / 180;
      return [o.x + Math.sin(r) * 1.45, o.z + Math.cos(r) * 1.45];
    }));
    this.pools.visible = false;
    this.scene.add(this.pools);
    this.weather = 'Clear';

    // --- characters -----------------------------------------------------------
    const rng = mulberry32(seed * 31 + 7);
    // each person becomes one skinned mesh (joints kept for the walk), sharing
    // one vertex-colour material: about 2 draw calls a person instead of ~21
    const personMat = markPerson(vertexColorMaterial(style));
    // see-through silhouettes for the iso view (silhouette.js): the player in a
    // bright colour so you can always find yourself, everyone else in blue
    this.silhouettes = [];
    const silCache = new Map();
    const silPeople = silhouetteMaterial(0x3a64b8, 0.7), silPlayer = silhouetteMaterial(0xf2b64a, 0.85);
    const buildPerson = (p, player = false) => {
      const raw = human.build(p, style);
      style.decorate?.(raw);
      const body = skinCharacter(raw, LIMBS, personMat);
      const sil = addSilhouette(body, player ? silPlayer : silPeople, silCache);
      if (sil) this.silhouettes.push(sil);
      return body;
    };
    this.buildPerson = buildPerson; // for previews (comedy.js)
    this.humanParams = params.human; // your look (walk / run styles come from it)
    this.player = { body: buildPerson(params.human, true), root: new THREE.Group(), x: 0, z: 0, heading: 0, speed: 0, gait: createGait(), height: params.human.height };
    this.player.root.add(this.player.body);
    this.scene.add(this.player.root);
    // start on the sidewalk next to the park (or the first block)
    this.player.x = city.start.x;
    this.player.z = city.start.z;
    const pr = city.parkRect ?? { x0: -1, x1: 1, z0: -1, z1: 1 };

    // the crowd (crowd.js): walkers who roam the town, people standing about,
    // people on park benches. Each is one skinned person.
    this.npcs = [];
    this.crowd = new Crowd(this);
    this.loopInfo = new Map(city.walkLoops.map((l) => [l, loopLengths(l)]));
    const makePerson = (look = { ...params.human, ...human.randomize(rng) }, loop = city.walkLoops[Math.floor(rng() * city.walkLoops.length)]) => {
      const elderly = look.bodyType === 'Grandpa' || look.bodyType === 'Grandma';
      const npc = {
        trait: look.trait ?? (rng() < 0.25 ? 'Aggressive' : 'Calm'), // how they react (interact.js)
        name: look.name ?? null, // optional; not shown for now
        tune: tuneOf(look), // their walk and run (walkStyle / runStyle)
        body: buildPerson(look),
        look,
        root: new THREE.Group(),
        loop, ...this.loopInfo.get(loop),
        s: rng() * this.loopInfo.get(loop).total,
        dir: rng() < 0.5 ? 1 : -1,
        speed: elderly ? 0.6 + rng() * 0.2 : 1.0 + rng() * 0.5, // grandparents walk slowly
        gait: createGait(rng() * 10),
        lane: (rng() - 0.5) * 1.2, // spread across the sidewalk
      };
      npc.root.add(npc.body);
      this.scene.add(npc.root);
      this.npcs.push(npc);
      return npc;
    };
    this.makePerson = makePerson; // for drivers who jump out (ejectDriver)
    this.randomDriver = () => ({ ...params.human, ...human.randomize(Math.random) });
    // looks that fit the place: suits downtown, school uniforms by the school,
    // police uniforms, aprons on shop promoters
    const isKid = (l) => l.bodyType === 'Boy' || l.bodyType === 'Girl';
    const randomLook = (want = 'any') => {
      for (let k = 0; k < 40; k++) {
        const l = { ...params.human, ...human.randomize(rng) };
        if (want === 'any' || (want === 'kid') === isKid(l)) return l;
      }
      return { ...params.human, ...human.randomize(rng) };
    };
    const dress = (l, what) => {
      if (what === 'office') Object.assign(l, human.outfits['Office worker']);
      if (what === 'police') Object.assign(l, human.outfits['Police officer'], { bodyType: l.bodyType === 'Grandma' || l.bodyType === 'Woman' ? 'Woman' : 'Man' });
      if (what === 'student') Object.assign(l, l.bodyType === 'Girl'
        ? { top: 'Sailor uniform', topColor: 'White', legwear: 'Skirt', legwearColor: 'Navy', outerwear: 'None', headwear: 'None' }
        : { top: 'Gakuran', topColor: 'Black', legwear: 'Trousers', legwearColor: 'Black', outerwear: 'None', headwear: 'None' });
      if (what === 'apron') Object.assign(l, { bodyAccessory: 'Apron', handItem: 'None', outerwear: 'None' });
      return l;
    };
    const zoneOf = (loop) => city.blocks[city.walkLoops.indexOf(loop)]?.type;
    if (city.walkLoops.length) {
      const sp = this.crowd.spots(rng);
      for (let i = 0; i < npcCount; i++) {
        const loop = city.walkLoops[Math.floor(rng() * city.walkLoops.length)];
        const zone = zoneOf(loop);
        let look;
        if (zone === 'downtown' && rng() < 0.7) look = dress(randomLook('adult'), 'office');
        else if (zone === 'school' && rng() < 0.65) look = dress(randomLook('kid'), 'student');
        else look = randomLook();
        this.crowd.assign(makePerson(look, loop), { kind: 'walk' });
      }
      // two officers walking a beat
      for (let i = 0; i < 2; i++) this.crowd.assign(makePerson(dress(randomLook('adult'), 'police')), { kind: 'walk', police: true });
      for (const home of sp.stands.slice(0, 12)) this.crowd.assign(makePerson(), { kind: 'stand', home });
      for (const home of sp.benches) if (rng() < 0.7) this.crowd.assign(makePerson(), { kind: 'bench', home });
      for (const role of this.crowd.plan(rng, sp)) {
        const look = role.kid ? randomLook('kid') : role.police ? dress(randomLook('adult'), 'police')
          : role.kind === 'promote' ? dress(randomLook('adult'), 'apron') : randomLook('adult');
        this.crowd.assign(makePerson(look), role);
      }
    }

    // cats wandering in the park
    this.cats = [];
    for (let i = 0; i < 3; i++) {
      const raw = cat.build({ ...params.cat, ...cat.randomize(rng) }, style); // every cat its own pattern, tail, ears
      // one skinned mesh per cat, joints kept for the walk / run (anim/catGait.js)
      const body = skinCharacter(raw, new Set(CAT_JOINTS), personMat);
      const catSil = addSilhouette(body, silPeople, silCache);
      if (catSil) this.silhouettes.push(catSil);
      const root = new THREE.Group();
      root.scale.setScalar(cat.exaggeration ?? 1);
      root.add(body);
      this.scene.add(root);
      this.cats.push({ root, body, gait: createCatGait(rng() * 10), speed: 0, x: pr.x0 + rng() * (pr.x1 - pr.x0), z: pr.z0 + rng() * (pr.z1 - pr.z0), tx: 0, tz: 0, wait: rng() * 3 });
    }

    // a few cars driving round the ring road (on the left, Japanese style)
    this.cars = [];
    this.cars.push(...this.parkedRides); // parked cars and bicycles you can ride
    const kinds = ['Kei car', 'Sedan', 'Taxi', 'Minivan', 'Hatchback', 'Bus', 'Sports car', 'Kei car'];
    const colors = ['White', 'Red', undefined, 'Blue', 'Gray', 'White', 'Yellow', 'Green'];
    const silCars = silhouetteMaterial(0x3a64b8, 0.65);
    const loops = city.carLoops ?? (city.carLoop ? [city.carLoop] : []);
    for (let i = 0; i < kinds.length && loops.length; i++) {
      const loop = loops[(i * 7) % loops.length]; // spread over the blocks
      const ring = loopLengths(loop);
      const built = car.build({ variant: kinds[i], color: colors[i] }, style);
      const obj = mergeByMaterial(built);
      this.silhouettes.push(...addObjectSilhouette(obj, silCars, silCache));
      this.scene.add(obj);
      const bus = kinds[i] === 'Bus';
      this.cars.push({ obj, size: built.userData.size ?? { hw: 0.9, hd: 2.3 }, s: rng() * ring.total, speed: bus ? 5 + rng() : 7 + rng() * 3, ...ring, loop });
    }
    // people riding bikes and motorbikes in the traffic (sitting on them, crowd.js sitPose)
    const rideKinds = [['bicycle', { color: 'Blue' }, 4], ['scooter', { variant: '50cc' }, 6.5], ['bicycle', { color: 'Red' }, 4.5],
      ['scooter', { variant: 'Step-through' }, 7], ['scooter', { variant: 'Delivery' }, 6], ['bicycle', { color: 'White' }, 4]];
    rideKinds.forEach(([kind, prm, speed], i) => {
      if (!loops.length) return;
      const loop = loops[(i * 5 + 3) % loops.length], ring = loopLengths(loop);
      const obj = mergeByMaterial(kind === 'bicycle' ? bicycle.build(prm, style) : scooter.build(prm, style));
      this.silhouettes.push(...addObjectSilhouette(obj, silCars, silCache));
      const riderLook = { ...params.human, ...human.randomize(rng), handItem: 'None', backAccessory: 'None', bodyAccessory: 'None' };
      const rider = buildPerson(riderLook);
      rider.userData.look = riderLook;
      sitPose(rider, kind === 'bicycle' ? 0.86 : 0.74);
      rider.position.z = kind === 'bicycle' ? -0.2 : -0.35;
      for (const a of ['armL', 'armR']) { const j = rider.getObjectByName(a); if (j) j.rotation.x = -0.95; } // hands on the bars
      obj.add(rider);
      this.scene.add(obj);
      this.cars.push({ obj, size: { hw: 0.35, hd: 0.95 }, s: rng() * ring.total, speed: speed * (0.9 + rng() * 0.2), ...ring, loop, rider: true, bike: kind, riderBody: rider, riderLook: rider.userData.look, riderSeat: { y: kind === 'bicycle' ? 0.86 : 0.74, z: rider.position.z } });
    });

    // a bus stop on the bus's route: the bus pulls in, people get off and on
    // bus shelters at the kerb: walkers step round behind them (lx, lz point
    // into the block, from the kerb point x, z)
    this.walkAvoid = [];
    for (const o of cityData.objects ?? []) {
      if (o.asset !== 'prop.busStop' || o.params?.variant !== 'Shelter') continue;
      const r = ((o.rot ?? 0) * Math.PI) / 180, ox = Math.sin(r), oz = Math.cos(r);
      this.walkAvoid.push({ x: o.x + ox * 0.75, z: o.z + oz * 0.75, fx: oz, fz: -ox, lx: -ox, lz: -oz, half: 2.4, clear: 1.95 });
    }
    const bus = this.cars.find((c) => c.size.hd > 4);
    if (bus) {
      let k = 0;
      bus.lengths.forEach((l, i) => { if (l > bus.lengths[k]) k = i; });
      const a = bus.loop[k], b = bus.loop[(k + 1) % bus.loop.length], len = bus.lengths[k];
      const fx = (b[0] - a[0]) / len, fz = (b[1] - a[1]) / len, lx = fz, lz = -fx; // left of the bus = the kerb
      const sx = (a[0] + b[0]) / 2, sz = (a[1] + b[1]) / 2;
      const stopS = bus.lengths.slice(0, k).reduce((u, v) => u + v, 0) + len / 2;
      const shelter = createAsset('prop.busStop', { variant: 'Shelter' }, style);
      // at the kerb (the open side to the road), so the pavement behind it stays
      // free: only its glass back is solid, and walkers step round behind it
      const kerb = (cityData.grid?.road ?? 6) / 4; // lane centre to kerb
      const kx = sx + lx * (kerb + 0.75), kz = sz + lz * (kerb + 0.75);
      shelter.position.set(kx, 0, kz);
      shelter.rotation.y = Math.atan2(-lx, -lz); // facing the road
      this.scene.add(mergeByMaterial(shelter));
      const bx = kx + lx * 0.6, bz = kz + lz * 0.6; // the back panel
      city.colliders.push({ x: bx, z: bz, hw: Math.abs(fx) > 0.5 ? 1.6 : 0.12, hd: Math.abs(fx) > 0.5 ? 0.12 : 1.6 });
      this.walkAvoid.push({ x: sx + lx * kerb, z: sz + lz * kerb, fx, fz, lx, lz, half: 2.4, clear: 1.95 });
      bus.stop = { s: stopS, x: sx, z: sz, door: { x: sx + lx * 2.2 + fx * 3.5, z: sz + lz * 2.2 + fz * 3.5 }, wait: 0, served: false };
      // people waiting at the stop, facing the road
      const stopInfo = { stop: bus.stop, slots: [], waiters: [], boarded: [] };
      for (let i = 0; i < 4; i++) {
        const d = -1.5 + i * 0.9;
        stopInfo.slots.push({ x: sx + lx * 2.1 + fx * d, z: sz + lz * 2.1 + fz * d, heading: Math.atan2(-lx, -lz) });
      }
      this.crowd.busStop = stopInfo;
      stopInfo.slots.slice(0, 3).forEach((home) => this.crowd.assign(makePerson(), { kind: 'busWait', home: { ...home } }));
    }

    // a scooter and a bicycle you can ride, parked by where you start
    [['scooter', scooter.build({ variant: '50cc' }, style), { hw: 0.45, hd: 0.95 }, 2.4],
     ['bicycle', bicycle.build({ color: 'Blue' }, style), { hw: 0.3, hd: 0.9 }, 3.6]].forEach(([bike, built, size, dx]) => {
      const obj = mergeByMaterial(built);
      obj.position.set(city.start.x + dx, 0, city.start.z);
      obj.rotation.y = 0; // side by side, facing the road
      this.silhouettes.push(...addObjectSilhouette(obj, silCars, silCache));
      this.scene.add(obj);
      this.cars.push({ obj, size, bike, parked: true, fx: 0, fz: 1, speed: 0, seat: built.userData.seat });
    });
    setDetail(1);

    this.cam = { yaw: Math.PI, pitch: 0.32, dist: 6 };
    // isometric view: an orthographic camera at the classic angle (35.3° down,
    // turned in 45° steps), following the player; zoom = half the view height (m)
    this.isoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 40, 400);
    this.iso = { yaw: Math.PI / 4, targetYaw: Math.PI / 4, zoom: 16 };
    this.viewMode = 'third';
    this.applyLighting({ keyColor: 0xffffff, key: 1, dir: [0.5, 1, 0.6], hemi: 1, tint: null, tintAmount: 0 });
    // slap / push / talk, banana peels, riding (interact.js)
    this.ix = new Interactions(this, style);
  }

  /** Walk / run a person's legs at `speed` (used while they are busy). */
  stepPerson(who, dt, speed) {
    // everyone walks and runs their own way (walkStyle / runStyle, anim/gait.js)
    stepGait(who.gait, dt, speed, who.tune ?? null);
    poseGait(who.body, who.gait, 'natural', who.tune ?? null);
  }

  /** A busy person is done: back to walking their route from where they are. */
  /**
   * A busy person is done: they walk back (normally, at their own pace) to
   * their place, their route or their spot, then carry on (finishAct).
   */
  endAct(n) {
    n.kb = null;
    n.body.rotation.x = 0;
    // still in their seat: just carry on sitting
    if (n.role?.kind === 'bench' && n.pos && Math.hypot(n.pos.x - n.role.home.x, n.pos.z - n.role.home.z) < 0.3) { n.act = null; return; }
    const home = n.role?.home ?? this.nearestOnRoute(n);
    n.act = { kind: 'return', x: home.x, z: home.z, t: 40 };
  }

  /** Walking a route: the nearest point of it to where they are now. */
  nearestOnRoute(n) {
    let best = { x: n.pos.x, z: n.pos.z }, bd = Infinity;
    const L = n.loop.length;
    for (let i = 0; i < L; i++) {
      const a = n.loop[i], b = n.loop[(i + 1) % L], len = n.lengths[i] || 1e-6;
      const t = Math.max(0, Math.min(1, ((n.pos.x - a[0]) * (b[0] - a[0]) + (n.pos.z - a[1]) * (b[1] - a[1])) / (len * len)));
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, d = Math.hypot(x - n.pos.x, z - n.pos.z);
      if (d < bd) { bd = d; best = { x, z }; }
    }
    return best;
  }

  /**
   * A scared person runs off along the streets (crossing roads like any
   * walker) away from you, until 300 m from where they started; then they
   * calm down and walk back to their place.
   */
  startFlee(n) {
    // their own route if they walk one; else the nearest pavement route
    if (n.role?.kind !== 'walk' || !n.loop) {
      let best = null, bd = Infinity;
      for (const loop of this.layout.walkLoops) {
        const t = { loop, ...this.loopInfo.get(loop), pos: n.pos };
        const q = this.nearestOnRoute(t);
        const d = Math.hypot(q.x - n.pos.x, q.z - n.pos.z);
        if (d < bd) { bd = d; best = loop; }
      }
      n.loop = best;
      Object.assign(n, this.loopInfo.get(best));
    }
    n.fleeRole = n.role;
    n.role = { kind: 'walk' };
    n.flee = { left: 300 };
    n.act = null;
    this.rejoinRoute(n);
    // run whichever way along the route leads away from you
    const q = alongLoop(n.loop, n.lengths, n.total, n.s, 0), p = this.player;
    n.dir = (q.dx * (n.pos.x - p.x) + q.dz * (n.pos.z - p.z)) >= 0 ? 1 : -1;
  }

  /**
   * You take a vehicle someone is riding or driving: they jump off on the
   * driver's side, shout, and run away scared (like a calm person slapped).
   */
  ejectDriver(c) {
    let look = c.riderLook;
    if (c.riderBody) { c.riderBody.removeFromParent(); c.riderBody = null; } // also if they were lying on the road
    c.rider = false;
    if (!look) look = this.randomDriver();
    const n = this.makePerson({ ...look, trait: 'Calm' });
    const h = c.obj.rotation.y, side = c.size.hw + 0.6;
    n.pos = { x: c.obj.position.x + Math.cos(h) * side, z: c.obj.position.z - Math.sin(h) * side };
    n.root.position.set(n.pos.x, this.layout.groundHeight(n.pos.x, n.pos.z), n.pos.z);
    n.root.rotation.y = h;
    n.role = null; // startFlee puts them on the nearest pavement route, then they walk on
    n.act = { kind: 'flee', t: 4, delay: 0.35 };
    this.ix.say(this.ix.headOf(n), ['THIEF!!', c.bike ? 'My bike!!' : 'My car!!', "HEY! That's mine!", 'Help! Police!'][Math.floor(Math.random() * 4)], 'shout', 2.6, 0.1, this.ix.nameOf(n));
  }

  /** Which segment of their route a walker is on. */
  segmentAt(n) {
    let s = ((n.s % n.total) + n.total) % n.total;
    for (let i = 0; i < n.lengths.length; i++) { if (s <= n.lengths[i]) return i; s -= n.lengths[i]; }
    return 0;
  }

  /** Crossing the road to another block's pavement, then walking its route. */
  crossRoad(n, dt) {
    const c = n.cross, dx = c.x - n.pos.x, dz = c.z - n.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.2) {
      n.cross = null;
      n.loop = c.loop;
      Object.assign(n, this.loopInfo.get(c.loop));
      n.s = n.lengths.slice(0, c.k).reduce((a, b) => a + b, 0);
      n.off = { x: 0, z: 0 };
      n.seg = undefined;
      return;
    }
    const pace = n.flee ? NPC_RUN_SPEED : n.speed;
    if (n.flee) n.flee.left -= pace * dt;
    n.pos = { x: n.pos.x + (dx / d) * pace * dt, z: n.pos.z + (dz / d) * pace * dt };
    this.walkRoundCars(n.pos, pace * dt);
    n.root.position.set(n.pos.x, this.layout.groundHeight(n.pos.x, n.pos.z), n.pos.z);
    let h = Math.atan2(dx, dz) - n.root.rotation.y;
    h = Math.atan2(Math.sin(h), Math.cos(h));
    n.root.rotation.y += h * Math.min(1, dt * 6);
    if (this.crowd.culled(n)) return;
    stepGait(n.gait, dt, pace, n.tune);
    poseGait(n.body, n.gait, 'natural', n.tune);
  }

  /**
   * A person on foot meets a car (parked, stopped, or the one you are in):
   * pushed out of it, they slide along its side towards the nearer end, so
   * they walk round it instead of through it or getting stuck.
   */
  walkRoundCars(pos, step) {
    for (const c of this.cars) {
      if (c.fallen || Math.abs(c.obj.position.x - pos.x) > 6 || Math.abs(c.obj.position.z - pos.z) > 6) continue;
      const ox = pos.x, oz = pos.z;
      this.pushOutOfCar(pos, PERSON_R + 0.05, c);
      if (pos.x === ox && pos.z === oz) continue;
      const fx = c.fx ?? 0, fz = c.fz ?? 1;
      const along = (pos.x - c.obj.position.x) * fx + (pos.z - c.obj.position.z) * fz;
      const s = along >= 0 ? 1 : -1;
      pos.x += fx * s * step; pos.z += fz * s * step;
      this.pushOutOfCar(pos, PERSON_R + 0.05, c);
    }
  }

  /** Back at their place: pick their role up again. */
  finishAct(n) {
    n.act = null;
    n.kb = null;
    if (n.role?.home) { this.crowd.assign(n, n.role); return; }
    this.rejoinRoute(n);
  }

  /** Put a walker onto the nearest point of their route, keeping them where they are (offset fades). */
  rejoinRoute(n) {
    // the nearest point of their route; the sidestep offset carries them back smoothly
    let best = 0, bd = Infinity, acc = 0;
    const L = n.loop.length;
    for (let i = 0; i < L; i++) {
      const a = n.loop[i], b = n.loop[(i + 1) % L], len = n.lengths[i] || 1e-6;
      const t = Math.max(0, Math.min(1, ((n.pos.x - a[0]) * (b[0] - a[0]) + (n.pos.z - a[1]) * (b[1] - a[1])) / (len * len)));
      const d = Math.hypot(a[0] + (b[0] - a[0]) * t - n.pos.x, a[1] + (b[1] - a[1]) * t - n.pos.z);
      if (d < bd) { bd = d; best = acc + t * len; }
      acc += len;
    }
    n.s = best;
    const q = alongLoop(n.loop, n.lengths, n.total, n.s, 1.2);
    const len = Math.hypot(q.dx, q.dz) || 1;
    const bx = q.x + (-q.dz / len) * n.lane, bz = q.z + (q.dx / len) * n.lane;
    n.off = { x: n.pos.x - bx, z: n.pos.z - bz };
  }

  applyLighting(preset) {
    this.lightPreset = preset;
    const night = !!preset.night;
    setNightGlow(this.scene, night);
    this.pools.visible = night;
    preset = weatherLight(preset, this.weather);
    this.key.color.copy(this.base.keyColor).multiply(new THREE.Color(preset.keyColor));
    this.key.intensity = this.base.keyIntensity * preset.key;
    this.hemi.intensity = this.base.hemiIntensity * preset.hemi;
    this.scene.background.copy(this.baseBackground);
    if (preset.tint !== null) this.scene.background.lerp(new THREE.Color(preset.tint), preset.tintAmount);
    this.lightDir.set(...preset.dir).normalize();
  }

  /**
   * Weather: 'Clear', 'Rain' (falling rain, darker light, many people open
   * umbrellas) or 'Snow' (falling snow, white ground, roofs and trees).
   */
  setWeather(kind = 'Clear') {
    if (this.precip) { this.scene.remove(this.precip.object); this.precip.dispose(); this.precip = null; }
    for (const n of this.npcs) { n.putAway?.(); n.putAway = null; }
    this.weather = kind;
    if (kind !== 'Clear') {
      this.precip = new Precipitation(kind);
      this.scene.add(this.precip.object);
    }
    setSnowCover(this.scene, kind === 'Snow');
    if (kind === 'Rain') {
      // most people without something in their hands open an umbrella
      const colors = ['Blue', 'Navy', 'Red', 'Black', 'White', 'Green', 'Pink', 'Yellow'];
      this.npcs.forEach((n, i) => {
        if ((n.look.handItem && n.look.handItem !== 'None') || i % 4 === 3) return;
        n.putAway = giveHeldItem(n.body, n.look, 'Umbrella (open)', colors[i % colors.length], this.style);
      });
    }
    this.applyLighting(this.lightPreset);
    return kind;
  }

  /** Static colliders near (x, z), from a coarse grid built on first use. */
  nearColliders(x, z) {
    const C = 8;
    if (!this.colGrid) {
      this.colGrid = new Map();
      for (const c of this.layout.colliders) {
        for (let i = Math.floor((c.x - c.hw - 1) / C); i <= Math.floor((c.x + c.hw + 1) / C); i++) {
          for (let j = Math.floor((c.z - c.hd - 1) / C); j <= Math.floor((c.z + c.hd + 1) / C); j++) {
            const k = `${i},${j}`;
            if (!this.colGrid.has(k)) this.colGrid.set(k, []);
            this.colGrid.get(k).push(c);
          }
        }
      }
    }
    return this.colGrid.get(`${Math.floor(x / C)},${Math.floor(z / C)}`) ?? [];
  }

  /** Push a circle at pos (radius r) out of the static colliders (circle vs box). */
  pushOut(pos, r) {
    for (const c of this.nearColliders(pos.x, pos.z)) {
      if (c.down) continue; // a knocked-over prop (knock.js)
      const dx = pos.x - c.x, dz = pos.z - c.z;
      if (Math.abs(dx) > c.hw + r || Math.abs(dz) > c.hd + r) continue;
      const cx = Math.max(-c.hw, Math.min(c.hw, dx));
      const cz = Math.max(-c.hd, Math.min(c.hd, dz));
      let ox = dx - cx, oz = dz - cz;
      const d = Math.hypot(ox, oz);
      if (d >= r) continue;
      if (d < 1e-5) {
        // centre inside the box: push out along the shallowest axis
        const px = c.hw - Math.abs(dx), pz = c.hd - Math.abs(dz);
        if (px < pz) pos.x = c.x + Math.sign(dx || 1) * (c.hw + r);
        else pos.z = c.z + Math.sign(dz || 1) * (c.hd + r);
        continue;
      }
      ox /= d; oz /= d;
      pos.x += ox * (r - d);
      pos.z += oz * (r - d);
    }
  }

  /** Push a circle out of a moving car (a box turned with the car). */
  pushOutOfCar(pos, r, car) {
    const { x, z } = car.obj.position;
    const fx = car.fx ?? 0, fz = car.fz ?? 1;
    const dx = pos.x - x, dz = pos.z - z;
    const along = dx * fx + dz * fz, side = dx * fz - dz * fx; // car space
    const HW = car.size?.hw ?? 0.9, HD = car.size?.hd ?? 2.3;
    if (Math.abs(side) > HW + r || Math.abs(along) > HD + r) return;
    const ca = Math.max(-HD, Math.min(HD, along)), cs = Math.max(-HW, Math.min(HW, side));
    let oa = along - ca, os = side - cs;
    let d = Math.hypot(oa, os);
    if (d < 1e-5) { // inside: out through the nearest side
      if (HW - Math.abs(side) < HD - Math.abs(along)) { os = Math.sign(side || 1); oa = 0; d = 0; pos.x += os * fz * (HW + r - Math.abs(side)); pos.z += -os * fx * (HW + r - Math.abs(side)); return; }
      oa = Math.sign(along || 1); os = 0; pos.x += oa * fx * (HD + r - Math.abs(along)); pos.z += oa * fz * (HD + r - Math.abs(along)); return;
    }
    if (d >= r) return;
    oa /= d; os /= d;
    const push = r - d;
    pos.x += (oa * fx + os * fz) * push;
    pos.z += (oa * fz - os * fx) * push;
  }

  /** Keep the player out of buildings and props, cars, other people and cats. */
  collide(p) {
    this.pushOut(p, PLAYER_R);
    for (const c of this.cars) this.pushOutOfCar(p, PLAYER_R, c);
    const others = [...this.npcs.map((n) => [n.pos, PERSON_R, n]), ...this.cats.map((c) => [c, 0.25, null])];
    for (const [o, r, n] of others) {
      if (!o) continue;
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = PLAYER_R + r;
      if (d >= min || d < 1e-5) continue;
      p.x += (dx / d) * (min - d);
      p.z += (dz / d) * (min - d);
      if (n?.off) { n.off.x -= (dx / d) * 0.04; n.off.z -= (dz / d) * 0.04; } // walkers make way a little (people standing still have no offset)
    }
    this.pushOut(p, PLAYER_R); // never end up inside a wall after being pushed
    const lim = { x: this.layout.size.X / 2 + 20, z: this.layout.size.Z / 2 + 20 };
    p.x = Math.max(-lim.x, Math.min(lim.x, p.x));
    p.z = Math.max(-lim.z, Math.min(lim.z, p.z));
  }

  /** The camera to render with: third person or isometric. */
  get activeCamera() { return this.viewMode === 'iso' ? this.isoCamera : this.camera; }

  /** Switch between 'third' and 'iso' (no argument: toggle). */
  setViewMode(mode = this.viewMode === 'iso' ? 'third' : 'iso') {
    if (mode === 'iso' && this.viewMode !== 'iso') {
      // start the iso view looking the same way the third-person camera did, snapped to 45° steps
      const snap = Math.round((this.cam.yaw - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
      this.iso.yaw = this.iso.targetYaw = snap;
    }
    this.viewMode = mode;
    // hidden people show through buildings in the iso view
    for (const sil of this.silhouettes) sil.visible = mode === 'iso';
    return mode;
  }

  /** Turn the iso view by 90° (dir ±1). */
  rotateIso(dir) { this.iso.targetYaw += dir * Math.PI / 2; }

  /** Keep the cameras' shape matching the screen. */
  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    const z = this.iso.zoom;
    Object.assign(this.isoCamera, { left: -z * aspect, right: z * aspect, top: z, bottom: -z });
    this.isoCamera.updateProjectionMatrix();
  }

  update(dt, input) {
    const look = input.takeLook();
    if (this.viewMode === 'iso') {
      // drag turns the view freely, wheel / pinch zooms; Q / E (rotateIso) turn it 90° smoothly
      if (look.yaw) this.iso.targetYaw = this.iso.yaw = this.iso.yaw + look.yaw;
      this.iso.yaw += (this.iso.targetYaw - this.iso.yaw) * Math.min(1, dt * 8);
      this.iso.zoom = Math.max(5, Math.min(60, this.iso.zoom * Math.exp(look.zoom * 0.12)));
    } else {
      this.cam.yaw += look.yaw;
      this.cam.pitch = Math.max(0.05, Math.min(1.2, this.cam.pitch + look.pitch));
      this.cam.dist = Math.max(2.5, Math.min(18, this.cam.dist + look.zoom * 0.8));
    }

    // --- player: move relative to the camera ---------------------------------
    const p = this.player;
    const a = input.axes();
    // clicks, keys and taps for interactions (interact.js)
    const rect = this.renderer.domElement.getBoundingClientRect();
    // who is under the mouse (a highlight ring, interact.js)
    const hv = input.hover && !p.riding ? this.ix.pickAt(input.hover.x, input.hover.y, this.activeCamera, rect) : null;
    this.ix.mouseHover = hv;
    // who the action buttons would act on (ui/actionPad.js): ringed too, so you can see it
    this.ix.padTarget = p.riding ? null : this.ix.buttonTarget();
    this.ix.hover = hv ?? this.ix.padTarget;
    this.renderer.domElement.style.cursor = hv ? 'pointer' : '';
    for (const ev of input.takeEvents?.() ?? []) this.ix.handle(ev, this.activeCamera, rect);
    const busy = this.ix.updatePlayer(dt, a); // riding, staggering or slipping
    if (!busy) {
    const moveYaw = this.viewMode === 'iso' ? this.iso.yaw : this.cam.yaw; // move relative to the screen
    const fwd = { x: -Math.sin(moveYaw), z: -Math.cos(moveYaw) };
    const right = { x: -fwd.z, z: fwd.x };
    const mx = right.x * a.x - fwd.x * a.z;
    const mz = right.z * a.x - fwd.z * a.z;
    const moving = Math.hypot(mx, mz) > 0.05;
    // speed builds up: quick to a walk, then a slower build to a full run (and quick to stop)
    const target = moving ? (a.run ? PLAYER_RUN_SPEED : 1.6) : 0;
    const accel = target < p.speed ? 9 : p.speed < 1.6 ? 6 : 1.7;
    p.speed += Math.sign(target - p.speed) * Math.min(Math.abs(target - p.speed), accel * dt);
    if (moving) {
      const want = Math.atan2(mx, mz);
      let d = want - p.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.heading += d * Math.min(1, dt * 10);
      const len = Math.hypot(mx, mz);
      p.x += (mx / len) * p.speed * dt;
      p.z += (mz / len) * p.speed * dt;
    }
    this.collide(p);
    // your walk and run: from the character creator (the Walk lab overrides while it is open)
    p.tune = this.playerTune ?? tuneOf(this.humanParams);
    stepGait(p.gait, dt, p.speed, p.tune);
    poseGait(p.body, p.gait, this.playerGait ?? 'natural', p.tune);
    this.ix.poseActor(p, dt); // a slap or push swing
    // jumping (Space): up, a tuck of the legs in the air, and down again
    if (p.jumpY > 0 || p.vy) {
      p.vy -= 13 * dt;
      p.jumpY = Math.max(0, (p.jumpY ?? 0) + p.vy * dt);
      if (p.jumpY === 0 && p.vy < 0) { landGait(p.gait, p.vy); p.vy = 0; } // landing: the legs squash
      const j = p.body.userData.joints ?? {}, f = Math.min(1, p.jumpY / 0.3);
      for (const s of ['L', 'R']) {
        if (j[`leg${s}`]) j[`leg${s}`].rotation.x -= 0.6 * f;
        if (j[`shin${s}`]) j[`shin${s}`].rotation.x += 1.0 * f;
        if (j[`arm${s}`]) j[`arm${s}`].rotation.x -= 0.7 * f;
      }
    }
    p.root.position.set(p.x, this.layout.groundHeight(p.x, p.z) + (p.jumpY ?? 0), p.z);
    p.root.rotation.y = p.heading;
    p.gait.turn = leanInto(p, p.heading, p.speed, dt); // leaning into the turn inside the body (feet stay down), more when running
    }
    const ground = this.layout.groundHeight(p.x, p.z);

    // --- pedestrians ----------------------------------------------------------
    this.crowd.update(dt); // queues shuffle up, groups chat
    for (const n of this.npcs) {
      if (n.act) { n.root.visible = true; this.ix.updateNpc(n, dt); continue; } // slapped, chasing, fleeing, talking, walking back
      if (n.role && n.role.kind !== 'walk') { this.crowd.updateRole(n, dt); continue; } // standing, sitting...
      if (n.cross) { this.crossRoad(n, dt); continue; }
      const pace = n.flee ? NPC_RUN_SPEED : n.speed; // running away scared (you are 1.25x faster)
      if (n.flee && (n.flee.left -= pace * dt) <= 0) {
        // far enough: calm down and walk back to their place
        n.flee = null;
        if (n.fleeRole) { n.role = n.fleeRole; n.fleeRole = null; }
        this.endAct(n);
        continue;
      }
      n.s += n.dir * pace * dt;
      // at a corner, sometimes cross to the next block (crowd.js), so walkers roam
      const seg = this.segmentAt(n);
      if (n.seg !== undefined && seg !== n.seg) {
        const corner = n.loop[n.dir > 0 ? seg : n.seg];
        const to = this.crowd.maybeCross(n, corner);
        if (to) n.cross = { ...to, from: { ...n.pos } };
      }
      n.seg = seg;
      const q = alongLoop(n.loop, n.lengths, n.total, n.s, 1.2); // round the corners
      const hd = Math.atan2(q.dx * n.dir, q.dz * n.dir);
      const len = Math.hypot(q.dx, q.dz) || 1;
      // sideways offset so people don't all walk on one line
      const ox = (-q.dz / len) * n.lane, oz = (q.dx / len) * n.lane;
      // plus a sidestep (n.off) that steers round people and things, then
      // fades so they drift back into their lane
      n.off ??= { x: 0, z: 0 };
      let bx = q.x + ox, bz = q.z + oz;
      // keep clear of things on the pavement (the bus shelter): step round behind
      for (const a of this.walkAvoid ?? []) {
        const rx = bx - a.x, rz = bz - a.z, along = rx * a.fx + rz * a.fz, inn = rx * a.lx + rz * a.lz;
        if (Math.abs(along) > a.half || inn >= a.clear || inn < -1) continue;
        const k = Math.min(1, (a.half - Math.abs(along)) / 1.0); // ease in and out
        bx += a.lx * (a.clear - inn) * k; bz += a.lz * (a.clear - inn) * k;
      }
      const pos = { x: bx + n.off.x, z: bz + n.off.z };
      for (const o of this.npcs) {
        if (o === n || !o.pos || Math.abs(o.pos.x - pos.x) > 1 || Math.abs(o.pos.z - pos.z) > 1) continue;
        const dx = pos.x - o.pos.x, dz = pos.z - o.pos.z, d = Math.hypot(dx, dz), min = PERSON_R * 2 + 0.08;
        if (d < min && d > 1e-5) { pos.x += (dx / d) * (min - d) * 0.5; pos.z += (dz / d) * (min - d) * 0.5; }
      }
      { const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz), min = PERSON_R + PLAYER_R + 0.05;
        if (d < min && d > 1e-5) { pos.x += (dx / d) * (min - d); pos.z += (dz / d) * (min - d); } }
      // and round cars, the one you are in too (they used to walk through it)
      this.walkRoundCars(pos, pace * dt);
      this.pushOut(pos, PERSON_R);
      n.off.x = (pos.x - bx) * (1 - Math.min(1, dt * 0.8));
      n.off.z = (pos.z - bz) * (1 - Math.min(1, dt * 0.8));
      n.pos = pos;
      n.root.position.set(pos.x, 0, pos.z);
      n.root.rotation.y = hd;
      n.gait.turn = leanInto(n, hd, pace, dt, 0.05, 0.2);
      if (this.crowd.culled(n)) continue; // far away: hidden, not animated
      stepGait(n.gait, dt, pace, n.tune);
      poseGait(n.body, n.gait, 'natural', n.tune);
      if (n.action || n.flinch > 0 || n.comic) this.ix.poseActor(n, dt);
    }

    // --- cats: wander between random points in the park ----------------------
    const pr = this.layout.parkRect ?? { x0: -1, x1: 1, z0: -1, z1: 1 };
    for (const c of this.cats) {
      // wander between random points; now and then dash somewhere instead
      let target = 0;
      if (c.wait > 0) c.wait -= dt;
      else {
        if (!c.tx) {
          c.tx = pr.x0 + Math.random() * (pr.x1 - pr.x0); c.tz = pr.z0 + Math.random() * (pr.z1 - pr.z0);
          c.cruise = Math.random() < 0.3 ? CAT_RUN_SPEED : CAT_WALK_SPEED;
        }
        const dx = c.tx - c.x, dz = c.tz - c.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.3) {
          // arrived: sit, loaf or curl up for a nap (naps last longer)
          c.tx = 0;
          const r = Math.random();
          c.gait.pose = r < 0.5 ? 'sit' : r < 0.82 ? 'loaf' : 'sleep';
          c.wait = c.gait.pose === 'sleep' ? 12 + Math.random() * 15 : c.gait.pose === 'loaf' ? 5 + Math.random() * 7 : 2 + Math.random() * 4;
        } else {
          c.gait.pose = null;
          target = Math.min(c.cruise, d * 2); // slow down on arrival
          c.x += (dx / d) * c.speed * dt;
          c.z += (dz / d) * c.speed * dt;
          // turn smoothly toward the target
          const want = Math.atan2(dx, dz);
          let turn = want - c.root.rotation.y;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          c.root.rotation.y += turn * Math.min(1, dt * 8);
        }
      }
      c.speed += (target - c.speed) * Math.min(1, dt * 4);
      c.root.position.set(c.x, 0.05, c.z);
      stepCatGait(c.gait, dt, c.speed);
      poseCat(c.body, c.gait);
    }

    // --- cars on the ring road -------------------------------------------------
    for (const c of this.cars) {
      if (c.fallen) { this.ix.updateFallen(c, dt); if (c.fallen) continue; } // knocked over (interact.js)
      if (c.ridden || c.parked) continue; // driven by you, or left where you parked it
      // brake for anything in the lane just ahead: the player, pedestrians,
      // other cars (a car waiting over 3 s ignores other cars, so two cars can
      // never block each other for good at a crossing)
      c.cruise ??= c.speed;
      c.wait ??= 0;
      let blocked = false;
      if (c.fx !== undefined) {
        // look ahead from this vehicle's nose (buses are long), plus the other vehicle's half length
        const nose = c.size.hd;
        const ahead = (o, other = null) => {
          const dx = o.x - c.obj.position.x, dz = o.z - c.obj.position.z;
          const along = dx * c.fx + dz * c.fz, side = Math.abs(dx * c.fz - dz * c.fx);
          return along > 0.5 && along < nose + (other ? 4.2 + other.size.hd : 2.7) && side < (other ? 1.4 : 1.3);
        };
        if (!p.riding && ahead(p)) blocked = true; // (riding: your vehicle is in the list below)
        for (const n of this.npcs) if (n.pos && ahead(n.pos)) blocked = true;
        // a vehicle standing in the lane that is not traffic (one you parked or
        // sit in, a fallen bike): steer out round it, then back in; brake if
        // there is no room to get round yet
        let want = 0, jammed = false;
        const rr = c.size.hd > 4 ? 6 : 3;
        for (const o of this.cars) {
          if (o === c) continue;
          const still = o.parked || o.fallen || (o.ridden && Math.abs(o.drive?.speed ?? 0) < 1);
          if (!still) { if (c.wait < 3 && ahead(o.obj.position, o)) blocked = true; continue; }
          const ox = o.obj.position.x, oz = o.obj.position.z;
          if (Math.abs(ox - c.obj.position.x) > 22 || Math.abs(oz - c.obj.position.z) > 22) continue;
          // where it is along our route (the road may bend): the nearest point of the lane
          let best = null;
          for (let k = -12; k <= 16; k += 0.5) {
            const q = alongLoop(c.loop, c.lengths, c.total, c.s + k, rr), d = Math.hypot(q.x - ox, q.z - oz);
            if (!best || d < best.d) best = { k, q, d };
          }
          if (best.d > 6) continue;
          const q2 = alongLoop(c.loop, c.lengths, c.total, c.s + best.k + 0.4, rr);
          let tx = q2.x - best.q.x, tz = q2.z - best.q.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
          const along = best.k, sr = (ox - best.q.x) * -tz + (oz - best.q.z) * tx; // its offset to the right of the lane's middle
          if (along < -(o.size.hd + c.size.hd + 3) || along > 14) continue; // until our back is well past it
          const ofx = o.fx ?? Math.sin(o.obj.rotation.y), ofz = o.fz ?? Math.cos(o.obj.rotation.y);
          const turn = Math.abs(ofx * tz - ofz * tx); // 0 along the lane, 1 across it
          const ow = o.size.hw * (1 - turn) + o.size.hd * turn + c.size.hw + 0.35; // half the room it takes, plus ours
          const near = sr - (c.dodge ?? 0); // its offset from us now
          if (Math.abs(near) < ow && along > -(o.size.hd + c.size.hd + 1)) want = Math.max(want, c.dodge ?? 0); // alongside: do not ease back in yet
          if (sr <= -ow || sr >= ow) continue; // clear of our lane (kerb side, or over the other side)
          const need = sr + ow; // pass it on the right (away from the kerb)
          if (need > 3.4) { if (along > 0) { blocked = true; jammed = true; } continue; } // no room on the road: wait (and honk)
          want = Math.max(want, need);
          if (along > -c.size.hd && along < c.size.hd + o.size.hd + 4 && (c.dodge ?? 0) < need - 0.1) blocked = true; // not out far enough yet
        }
        c.dodgeWant = want;
        // stuck behind a vehicle blocking the road: honk now and then (when you are near enough to hear)
        if (jammed && (c.honk = (c.honk ?? 1.5) - dt) <= 0) {
          c.honk = 2.5 + Math.random() * 3;
          if (Math.hypot(c.obj.position.x - p.x, c.obj.position.z - p.z) < 30) {
            const pos = c.obj.position;
            this.ix.say(() => pos.clone().add(new THREE.Vector3(0, c.bike ? 1.7 : 1.9, 0)), ['HONK!', 'BEEP BEEP!', 'HOONK!'][Math.floor(Math.random() * 3)], 'burst');
          }
        } else if (!jammed) c.honk = 1.5;
      }
      c.wait = blocked ? c.wait + dt : 0;
      let cruise = c.cruise;
      if (c.stop) {
        // the bus slows into its stop, waits, then pulls away (crowd.js swaps people)
        const st = c.stop, ahead = (((st.s - c.s) % c.total) + c.total) % c.total;
        if (st.wait > 0) { st.wait -= dt; cruise = 0; c.speed = 0; if (st.wait <= 0) st.served = true; }
        else if (!st.served && ahead < 14) {
          cruise = Math.min(cruise, ahead * 0.7);
          if (ahead < 0.4) { st.wait = 5; this.crowd.busArrived(); }
        } else if (st.served && ahead > 20 && ahead < c.total - 5) st.served = false;
      }
      // brakes take time (7 m/s²): step out right in front of one and it cannot stop
      if (blocked) c.speed = Math.max(0, c.speed - 7 * dt);
      else c.speed += (cruise - c.speed) * Math.min(1, dt * 1.5);
      c.s += c.speed * dt;
      // the route already runs down the middle of the kerb-side lane (driving
      // on the left, block on the driver's left), so the car sits right on it
      // the front axle follows the lane and the rear axle is towed behind it
      // (no sideways slide), so long vehicles like the bus swing round a
      // corner with the back cutting in, instead of spinning on the spot
      const wb = c.size.hd * 1.2;
      const qf = alongLoop(c.loop, c.lengths, c.total, c.s + wb / 2, c.size.hd > 4 ? 6 : 3);
      // round a vehicle standing in the lane: the front axle eases out to the right and back
      c.dodge ??= 0;
      const dw = c.dodgeWant ?? 0;
      c.dodge += Math.max(-1.2 * dt, Math.min(1.6 * dt, dw - c.dodge));
      if (c.dodge > 0.01) {
        const q2 = alongLoop(c.loop, c.lengths, c.total, c.s + wb / 2 + 0.4, c.size.hd > 4 ? 6 : 3);
        let tx = q2.x - qf.x, tz = q2.z - qf.z; const tl = Math.hypot(tx, tz) || 1;
        qf.x += (-tz / tl) * c.dodge; qf.z += (tx / tl) * c.dodge;
      }
      if (!c.rear) { const q0 = alongLoop(c.loop, c.lengths, c.total, c.s - wb / 2, 3); c.rear = { x: q0.x, z: q0.z }; }
      let fx = qf.x - c.rear.x, fz = qf.z - c.rear.z;
      const len = Math.hypot(fx, fz) || 1;
      fx /= len; fz /= len;
      c.rear.x = qf.x - fx * wb; c.rear.z = qf.z - fz * wb;
      c.obj.position.set(qf.x - fx * wb / 2, -0.12, qf.z - fz * wb / 2);
      c.obj.rotation.y = Math.atan2(fx, fz);
      if (c.bike) {
        // bikes lean into corners; bicycle riders pedal
        c.obj.rotation.z = leanInto(c, c.obj.rotation.y, c.speed, dt, 0.08, 0.45);
        if (c.riderBody && c.bike === 'bicycle') pedalPose(c.riderBody, (c.pedal = (c.pedal ?? 0) + c.speed * 1.5 * dt));
      }
      c.fx = fx; c.fz = fz; // for braking and collisions
      // it hits you if you are on foot in its way and it is still going
      if (!p.riding && c.speed > 2.5 && p.act?.kind !== 'slip' && this.ix.distToVehicle(c, p.x, p.z) < PLAYER_R + 0.05) this.ix.hitByCar(c);
    }

    // --- camera: third person, behind and above ----------------------------------
    this.ix.update(dt);
    this.knock.update(dt);

    // riding: the camera eases round behind the vehicle and pulls back a little
    if (p.riding && this.viewMode !== 'iso' && Math.abs(p.riding.drive.speed) > 1) {
      let d = p.riding.drive.heading + Math.PI - this.cam.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.cam.yaw += d * Math.min(1, dt * 2);
    }
    const { yaw, pitch } = this.cam;
    const dist = this.cam.dist + (p.riding && !p.riding.bike ? 3 : 0);
    const tx = p.x, ty = ground + 1.4, tz = p.z;
    this.camera.position.set(
      tx + Math.sin(yaw) * Math.cos(pitch) * dist,
      ty + Math.sin(pitch) * dist,
      tz + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    this.camera.lookAt(tx, ty, tz);
    // isometric camera: far up along the iso direction, looking at the player
    const ip = Math.atan(1 / Math.SQRT2), D = 160; // near / far kept tight for depth precision
    this.isoCamera.position.set(
      tx + Math.sin(this.iso.yaw) * Math.cos(ip) * D,
      ty + Math.sin(ip) * D,
      tz + Math.cos(this.iso.yaw) * Math.cos(ip) * D,
    );
    this.isoCamera.lookAt(tx, ty, tz);
    // rain / snow: a layer in front of whichever camera is in use
    this.precip?.update(dt, this.activeCamera, { pixels: this.renderer.domElement.clientHeight / (this.style.pixelScale || 1), distance: this.cam.dist });
    // shadows cover more ground when the iso view is zoomed out
    const reach = this.viewMode === 'iso' ? Math.max(30, this.iso.zoom * 2.2) : 30;
    const sc = this.key.shadow.camera;
    if (sc.right !== reach) { sc.left = sc.bottom = -reach; sc.right = sc.top = reach; sc.far = Math.max(120, reach * 4); sc.updateProjectionMatrix(); }

    // shadows follow the player
    this.key.position.set(p.x, 0, p.z).addScaledVector(this.lightDir, 50);
    this.key.target.position.set(p.x, 0, p.z);
    this.key.target.updateMatrixWorld();
  }
}

/**
 * Parked vehicles built into the town (a car in a carport, at the petrol
 * station, bicycles outside shops and the koban), tagged
 * `userData.rideable` = 'car' | 'bicycle': taken out of the merged town and
 * added to the vehicles as parked, so you can ride them. Their collider is
 * switched off (`down`), the vehicle collides as itself.
 */
function takeRideables(city, group, colliders) {
  group.updateMatrixWorld(true);
  const found = [];
  group.traverse((o) => { if (o.userData.rideable) found.push(o); });
  const out = [];
  for (const o of found) {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    o.matrixWorld.decompose(pos, quat, scl);
    if (pos.y > 0.5) continue; // up in a car park: stays put
    const kind = o.userData.rideable, size = o.userData.size ?? (kind === 'car' ? { hw: 0.9, hd: 2.3 } : kind === 'scooter' ? { hw: 0.45, hd: 0.95 } : { hw: 0.3, hd: 0.9 });
    o.parent.remove(o);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    const heading = Math.atan2(fwd.x, fwd.z);
    o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.copy(scl);
    const obj = mergeByMaterial(o);
    obj.position.copy(pos); obj.rotation.set(0, heading, 0);
    city.scene.add(obj);
    for (const c of colliders) {
      if (Math.hypot(c.x - pos.x, c.z - pos.z) < 0.6 && Math.max(c.hw, c.hd) < size.hd + 0.6) c.down = true;
    }
    const car = { obj, size, parked: true, fx: Math.sin(heading), fz: Math.cos(heading), speed: 0, seat: o.userData.seat, ...(kind === 'bicycle' || kind === 'scooter' ? { bike: kind } : {}) };
    out.push(car);
  }
  return out;
}

