import * as THREE from 'three';
import { setDetail } from '../lib/shapes.js';
import { mergeByMaterial } from '../lib/merge.js';
import { skinCharacter, vertexColorMaterial } from '../lib/skin.js';
import { mulberry32 } from '../lib/rng.js';
import { car } from '../props/vehicles.js';
import { generateCityData } from './layout.js';
import { buildCity } from './build.js';
import { JOINT_NAMES, createGait, poseGait, stepGait } from '../anim/gait.js';
import { Precipitation, lampPools, setNightGlow, setSnowCover, weatherLight } from './atmosphere.js';
import { giveHeldItem } from '../subjects/human.js';
import { addSilhouette, markPerson, silhouetteMaterial } from './silhouette.js';
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
  constructor({ style, renderer, human, cat, params, npcCount = 28, seed = 3, data = null }) {
    this.style = style;
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
    const silPeople = silhouetteMaterial(0x3a64b8, 0.6), silPlayer = silhouetteMaterial(0xf2b64a, 0.85);
    const buildPerson = (p, player = false) => {
      const raw = human.build(p, style);
      style.decorate?.(raw);
      const body = skinCharacter(raw, LIMBS, personMat);
      const sil = addSilhouette(body, player ? silPlayer : silPeople, silCache);
      if (sil) this.silhouettes.push(sil);
      return body;
    };
    this.player = { body: buildPerson(params.human, true), root: new THREE.Group(), x: 0, z: 0, heading: 0, speed: 0, gait: createGait() };
    this.player.root.add(this.player.body);
    this.scene.add(this.player.root);
    // start on the sidewalk next to the park (or the first block)
    this.player.x = city.start.x;
    this.player.z = city.start.z;
    const pr = city.parkRect ?? { x0: -1, x1: 1, z0: -1, z1: 1 };

    this.npcs = [];
    for (let i = 0; i < (city.walkLoops.length ? npcCount : 0); i++) {
      const loop = city.walkLoops[Math.floor(rng() * city.walkLoops.length)];
      const { lengths, total } = loopLengths(loop);
      const look = { ...params.human, ...human.randomize(rng) };
      const elderly = look.bodyType === 'Grandpa' || look.bodyType === 'Grandma';
      const npc = {
        body: buildPerson(look),
        look,
        root: new THREE.Group(),
        loop, lengths, total,
        s: rng() * total,
        dir: rng() < 0.5 ? 1 : -1,
        speed: elderly ? 0.6 + rng() * 0.2 : 1.0 + rng() * 0.5, // grandparents walk slowly
        gait: createGait(rng() * 10),
        lane: (rng() - 0.5) * 1.2, // spread across the sidewalk
      };
      npc.root.add(npc.body);
      this.scene.add(npc.root);
      this.npcs.push(npc);
    }

    // cats wandering in the park
    this.cats = [];
    for (let i = 0; i < 3; i++) {
      const raw = cat.build({ ...params.cat }, style);
      // one skinned mesh per cat, joints kept for the walk / run (anim/catGait.js)
      const body = skinCharacter(raw, new Set(CAT_JOINTS), personMat);
      const root = new THREE.Group();
      root.scale.setScalar(cat.exaggeration ?? 1);
      root.add(body);
      this.scene.add(root);
      this.cats.push({ root, body, gait: createCatGait(rng() * 10), speed: 0, x: pr.x0 + rng() * (pr.x1 - pr.x0), z: pr.z0 + rng() * (pr.z1 - pr.z0), tx: 0, tz: 0, wait: rng() * 3 });
    }

    // a few cars driving round the ring road (on the left, Japanese style)
    this.cars = [];
    const kinds = ['Kei car', 'Sedan', 'Taxi', 'Minivan', 'Kei car'];
    const colors = ['White', 'Red', undefined, 'Blue', 'Yellow'];
    const loops = city.carLoops ?? (city.carLoop ? [city.carLoop] : []);
    for (let i = 0; i < kinds.length && loops.length; i++) {
      const loop = loops[(i * 7) % loops.length]; // spread over the blocks
      const ring = loopLengths(loop);
      const obj = mergeByMaterial(car.build({ variant: kinds[i], color: colors[i] }, style));
      this.scene.add(obj);
      this.cars.push({ obj, s: rng() * ring.total, speed: 7 + rng() * 3, ...ring, loop });
    }
    setDetail(1);

    this.cam = { yaw: Math.PI, pitch: 0.32, dist: 6 };
    // isometric view: an orthographic camera at the classic angle (35.3° down,
    // turned in 45° steps), following the player; zoom = half the view height (m)
    this.isoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 40, 400);
    this.iso = { yaw: Math.PI / 4, targetYaw: Math.PI / 4, zoom: 16 };
    this.viewMode = 'third';
    this.applyLighting({ keyColor: 0xffffff, key: 1, dir: [0.5, 1, 0.6], hemi: 1, tint: null, tintAmount: 0 });
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
    const HW = 0.9, HD = 2.3;
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
      if (n) { n.off.x -= (dx / d) * 0.04; n.off.z -= (dz / d) * 0.04; } // they make way a little
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
    // rain / snow fall around the player
    this.precip?.update(dt, this.player.root.position);
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
    const moveYaw = this.viewMode === 'iso' ? this.iso.yaw : this.cam.yaw; // move relative to the screen
    const fwd = { x: -Math.sin(moveYaw), z: -Math.cos(moveYaw) };
    const right = { x: -fwd.z, z: fwd.x };
    const mx = right.x * a.x - fwd.x * a.z;
    const mz = right.z * a.x - fwd.z * a.z;
    const moving = Math.hypot(mx, mz) > 0.05;
    const target = moving ? (a.run ? 4.2 : 1.6) : 0;
    p.speed += (target - p.speed) * Math.min(1, dt * 8);
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
    stepGait(p.gait, dt, p.speed);
    poseGait(p.body, p.gait, this.playerGait ?? 'natural');
    const ground = this.layout.groundHeight(p.x, p.z);
    p.root.position.set(p.x, ground, p.z);
    p.root.rotation.y = p.heading;

    // --- pedestrians ----------------------------------------------------------
    for (const n of this.npcs) {
      n.s += n.dir * n.speed * dt;
      const q = alongLoop(n.loop, n.lengths, n.total, n.s, 1.2); // round the corners
      const hd = Math.atan2(q.dx * n.dir, q.dz * n.dir);
      const len = Math.hypot(q.dx, q.dz) || 1;
      // sideways offset so people don't all walk on one line
      const ox = (-q.dz / len) * n.lane, oz = (q.dx / len) * n.lane;
      // plus a sidestep (n.off) that steers round people and things, then
      // fades so they drift back into their lane
      n.off ??= { x: 0, z: 0 };
      const bx = q.x + ox, bz = q.z + oz;
      const pos = { x: bx + n.off.x, z: bz + n.off.z };
      for (const o of this.npcs) {
        if (o === n || !o.pos) continue;
        const dx = pos.x - o.pos.x, dz = pos.z - o.pos.z, d = Math.hypot(dx, dz), min = PERSON_R * 2 + 0.08;
        if (d < min && d > 1e-5) { pos.x += (dx / d) * (min - d) * 0.5; pos.z += (dz / d) * (min - d) * 0.5; }
      }
      { const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz), min = PERSON_R + PLAYER_R + 0.05;
        if (d < min && d > 1e-5) { pos.x += (dx / d) * (min - d); pos.z += (dz / d) * (min - d); } }
      this.pushOut(pos, PERSON_R);
      n.off.x = (pos.x - bx) * (1 - Math.min(1, dt * 0.8));
      n.off.z = (pos.z - bz) * (1 - Math.min(1, dt * 0.8));
      n.pos = pos;
      n.root.position.set(pos.x, 0, pos.z);
      n.root.rotation.y = hd;
      stepGait(n.gait, dt, n.speed);
      poseGait(n.body, n.gait);
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
        if (d < 0.3) { c.tx = 0; c.wait = 1 + Math.random() * 4; } else {
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
      // brake for anything in the lane just ahead: the player, pedestrians,
      // other cars (a car waiting over 3 s ignores other cars, so two cars can
      // never block each other for good at a crossing)
      c.cruise ??= c.speed;
      c.wait ??= 0;
      let blocked = false;
      if (c.fx !== undefined) {
        const ahead = (o, car = false) => {
          const dx = o.x - c.obj.position.x, dz = o.z - c.obj.position.z;
          const along = dx * c.fx + dz * c.fz, side = Math.abs(dx * c.fz - dz * c.fx);
          return along > 0.5 && along < (car ? 6.5 : 5) && side < (car ? 1.4 : 1.3);
        };
        if (ahead(p)) blocked = true;
        for (const n of this.npcs) if (n.pos && ahead(n.pos)) blocked = true;
        if (c.wait < 3) for (const o of this.cars) if (o !== c && ahead(o.obj.position, true)) blocked = true;
      }
      c.wait = blocked ? c.wait + dt : 0;
      c.speed += ((blocked ? 0 : c.cruise) - c.speed) * Math.min(1, dt * (blocked ? 6 : 1.5));
      c.s += c.speed * dt;
      // the route already runs down the middle of the kerb-side lane (driving
      // on the left, block on the driver's left), so the car sits right on it
      const q = alongLoop(c.loop, c.lengths, c.total, c.s, 3);
      const len = Math.hypot(q.dx, q.dz) || 1;
      const fx = q.dx / len, fz = q.dz / len;
      c.obj.position.set(q.x, -0.12, q.z);
      c.obj.rotation.y = Math.atan2(fx, fz);
      c.fx = fx; c.fz = fz; // for braking and collisions
    }

    // --- camera: third person, behind and above ----------------------------------
    const { yaw, pitch, dist } = this.cam;
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
