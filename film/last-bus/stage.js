import * as THREE from 'three';
import { style, lightingPresets } from '../../src/styles/index.js';
import { human } from '../../src/subjects/human.js';
import { measure } from '../../src/subjects/human/frame.js';
import { buildHandItem } from '../../src/subjects/human/handheld.js';
import { cat } from '../../src/subjects/cat.js';
import { poseHold } from '../../src/anim/gait.js';
import { poseCat } from '../../src/anim/catGait.js';
import { CLOTH_COLORS } from '../../src/styles/palette.js';
import { streetLamp, busStop, postBox } from '../../src/props/furniture.js';
import { bus as busAsset } from '../../src/props/vehicles.js';
import { utilityPole } from '../../src/props/extras.js';
import { box, tiledBox } from '../../src/props/util.js';
import { kissaten, pharmacy } from '../../src/city/shops.js';
import { woodApartment } from '../../src/city/civic.js';
import { dressBacks } from '../../src/city/backs.js';
import { setNightGlow, weatherLight, lampPools } from '../../src/city/atmosphere.js';
import { mulberry32 } from '../../src/lib/rng.js';
import { createRain } from '../rig/rain.js';
import { smoothstep } from '../rig/ease.js';
import {
  BUS_Z, PUDDLE_X, WHEEL_HIT_T, busCenterX, SPLASH_START, SPLASH_END,
} from './timing.js';

// Staging for "Last Bus". Reuses the town's props and characters.
// The sidewalk is y = 0; the road sits 14 cm lower, so the curb reads.

const ROAD_Y = -0.14;
const CURB_Z = 4.58;
// Grandpa stands at the curb, in front of the shelter, so cameras can sit
// behind him without entering the glass.
const GP = { x: 0.1, z: 4.9 };
const KITTEN = { x: 0.44, z: 5.18 };
const DRY = { x: GP.x, z: GP.z, r: 1.15 };

// Umbrella tilt and the look toward the bus. Signs get flipped after a still
// if a joint turns the wrong way; positive head yaw faces his left (the bus).
const HEAD_YAW = 1.05;
const ARM_Z = 0.9;
const ARM_X = -0.2;
const UMBRELLA_Z = -0.85;

function beam(length, radius, color, opacity, forward) {
  const geo = new THREE.ConeGeometry(radius, length, 12, 1, true);
  geo.translate(0, -length / 2, 0);
  geo.rotateX(forward ? -Math.PI / 2 : Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  mesh.userData.noShadow = true;
  mesh.renderOrder = 2;
  return mesh;
}

function splashAmount(t) {
  if (t < SPLASH_START || t >= SPLASH_END) return 0;
  const u = (t - SPLASH_START) / (SPLASH_END - SPLASH_START);
  return u * u * (3 - 2 * u);
}

function screenRainOpacity(t) {
  // Thin veil. The kitten close-up has none of it, so the face stays dry.
  if (t >= 25.6 && t < 30.05) return 0;
  if (t >= 21.0 && t < 26.0) return 0.015;
  return 0.055;
}

function rimRain(n) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color: 0xd5e2f2, transparent: true, opacity: 0.32,
  }));
  lines.frustumCulled = false;
  lines.userData.noShadow = true;
  lines.visible = false;
  return lines;
}

function poseRim(lines, t, head) {
  // Only the close shots can see rain this near the face. The streaks sit just
  // outside the cheeks, in front of the kitten, so the face stays dry.
  lines.visible = t >= 20 && t < 30.2;
  if (!lines.visible) return;
  const p = lines.geometry.attributes.position.array;
  const n = p.length / 6;
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    // The 85mm frame is only ~20cm wide at the face, so the streaks have to
    // sit just beside the cheeks or they fall outside the shot.
    const x = head.x + side * (0.06 + (i % 4) * 0.012);
    const z = head.z - 0.06 - (i % 3) * 0.03;
    const y = ((i * 0.09 + t * 3.4) % 0.85);
    const o = i * 6;
    p[o] = x; p[o + 1] = y + 0.7; p[o + 2] = z;
    p[o + 3] = x + side * 0.01; p[o + 4] = y; p[o + 5] = z;
  }
  lines.geometry.attributes.position.needsUpdate = true;
}

function buildSplash() {
  const g = new THREE.Group();
  g.name = 'splash';
  const mat = new THREE.MeshBasicMaterial({
    color: 0xd7e6f4, transparent: true, opacity: 0.8, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < 10; i++) {
    const h = 0.55 + (i % 3) * 0.35;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.07), mat);
    // A fan of spray, mostly upward and toward the camera, not a row of bars.
    m.userData.ang = -1.1 + (i / 9) * 2.2;
    m.userData.h = h;
    m.userData.noShadow = true;
    g.add(m);
  }
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.15), mat);
  sheet.userData.sheet = true;
  sheet.userData.noShadow = true;
  g.add(sheet);
  g.visible = false;
  return g;
}

function poseSplash(g, amount) {
  g.visible = amount > 0.03;
  if (!g.visible) return;
  for (const m of g.children) {
    if (m.userData.sheet) {
      m.position.set(0.15, 0.35 * amount, 0);
      m.scale.set(0.35 + amount, 0.3 + amount, 1);
      m.rotation.y = -0.6;
      m.material.opacity = 0.35 + 0.45 * amount;
      continue;
    }
    const a = m.userData.ang;
    m.rotation.z = a * 0.85;
    m.position.set(Math.sin(a) * 0.55 * amount, m.userData.h * 0.45 * amount, -0.15 * amount);
    m.scale.set(1, Math.max(0.15, amount), 1);
  }
}

function placeBuilding(scene, built, x, z, rotY, rng) {
  const g = built.group;
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  dressBacks(g, style, rng);
  scene.add(g);
  return g;
}

export function buildLastBus() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x243552);
  scene.fog = new THREE.FogExp2(0x243552, 0.0024);

  const roadMat = style.material('road', 0x5a6a80).clone();
  roadMat.emissive = new THREE.Color(0x3a5270);
  roadMat.emissiveIntensity = 0.7;
  const walkMat = style.material('sidewalk', 0xc4c0b6);
  walkMat.color.multiplyScalar(0.95);
  const curbMat = style.material('concrete', 0x918f8a);

  // Near sidewalk (the stop), far sidewalk, and the wet road between them.
  scene.add(tiledBox(160, 0.2, 16, walkMat, [10, -0.1, 12.2], 4));
  scene.add(tiledBox(160, 0.2, 8, walkMat, [10, -0.1, -12.2], 4));
  scene.add(tiledBox(170, 0.16, 12.2, roadMat, [8, ROAD_Y - 0.08, -1.7], 4));
  scene.add(box(150, 0.14, 0.18, curbMat, [8, -0.07, CURB_Z]));
  scene.add(box(150, 0.14, 0.18, curbMat, [8, -0.07, -8.15]));

  const dash = style.material('signage', 0xf2efe8);
  for (let x = -36; x <= 55; x += 4.2) {
    if (Math.abs(x - PUDDLE_X) < 2.2) continue;
    scene.add(box(1.15, 0.02, 0.1, dash, [x, ROAD_Y + 0.02, BUS_Z]));
  }

  const rng = mulberry32(19);
  placeBuilding(scene, kissaten(style, rng, 11, 12), -9, -15.5, 0, rng);
  placeBuilding(scene, pharmacy(style, rng, 12, 12), 16, -16, 0, rng);
  placeBuilding(scene, woodApartment(style, rng, 10, 12), 8.5, 24, Math.PI, rng);

  const shelter = busStop.build({ variant: 'Shelter' }, style);
  shelter.position.set(-0.15, 0, 7.7);
  shelter.rotation.y = Math.PI; // open side toward the road
  scene.add(shelter);

  const lamp = streetLamp.build({ variant: 'Single' }, style);
  // Arm swings over grandpa rather than straight down the pavement.
  lamp.position.set(-1.9, 0, 4.55);
  lamp.rotation.y = 1.2;
  lamp.updateMatrixWorld(true);
  scene.add(lamp);
  const head = lamp.localToWorld(new THREE.Vector3(0, 6.05, 1.48));
  const pools = lampPools([[head.x, head.z]]);
  pools.traverse((o) => { if (o.isMesh) { o.position.y = 0.03; o.userData.noShadow = true; } });
  scene.add(pools);

  const pb = postBox.build({}, style);
  pb.position.set(3.5, 0, 6.7);
  scene.add(pb);
  const pole = utilityPole.build({ variant: 'Plain' }, style);
  pole.position.set(-6.5, 0, 7.4);
  scene.add(pole);

  // Grandpa: cardigan, flat cap, open umbrella. The stick leans at the curb.
  const gpParams = human.applyRules({
    ...human.presets.Grandpa,
    handItem: 'Umbrella (open)',
    handItemColor: 'Blue',
    footwear: 'Shoes',
    shoeColor: 'Brown',
  });
  const grandpa = human.build(gpParams, style);
  grandpa.position.set(GP.x, 0, GP.z);
  grandpa.rotation.y = Math.PI; // faces the road, back toward the shelter
  scene.add(grandpa);
  const joints = {};
  grandpa.traverse((o) => { if (o.name) joints[o.name] = o; });
  joints.armR.userData.filmBaseZ = joints.armR.rotation.z;
  joints.handItem.userData.filmBaseQ = joints.handItem.quaternion.clone();

  const f = measure(gpParams);
  f.mats = { trim: style.material('accent', 0x2a2a30) };
  const stick = buildHandItem(f, 'Walking stick', style.material('cloth', CLOTH_COLORS.Brown), new THREE.Vector3(), new THREE.Vector3(0, -1, 0), style);
  // Flat on the road side of the right shoe. The kitten stays on the other
  // side, so the shaft does not cross the loaf in the reveal.
  stick.position.set(GP.x + 0.02, 0.22, GP.z - 0.32);
  stick.rotation.set(1.35, 0.4, 0.15);
  scene.add(stick);
  stick.updateMatrixWorld(true);
  const stickBox = new THREE.Box3().setFromObject(stick);
  stick.position.y -= stickBox.min.y - 0.012;

  const kittenInner = cat.build({
    ...cat.presets.Kitten,
    furColor: 'Ginger',
    pattern: 'Tabby',
    face: 'Sleepy',
    cheeks: 0.6,
    pawSize: 1.3,
    earType: 'Pointed',
    tailType: 'Long',
    tailUp: 0.35,
    tailCurl: 0.4,
    coat: 'Short',
  }, style);
  const kitten = new THREE.Group();
  kitten.add(kittenInner);
  kitten.scale.setScalar(cat.exaggeration ?? 1.5);
  // His left side, beside the shoes, under the umbrella. Clear of both feet
  // and of the stick, which stays on his right.
  // Tucked against his left shoe, under the umbrella's rim. Farther out
  // and he reads as a second figure beside the shelter, not under it.
  kitten.position.set(GP.x - 0.62, 0, GP.z + 0.14);
  kitten.rotation.y = Math.PI; // sleepy face toward the road
  scene.add(kitten);
  const gait = { phase: 0, amount: 0, run: 0, t: 0, pose: 'loaf', poseW: 1 };
  poseCat(kittenInner, gait);
  kitten.updateMatrixWorld(true);
  const kb = new THREE.Box3().setFromObject(kitten);
  if (kb.min.y < 0) kitten.position.y -= kb.min.y - 0.005;

  const kittenHead = new THREE.Vector3();
  const headBone = kittenInner.getObjectByName('head');

  // Bus. Local +z is the front; yaw +90° sends it down the street toward +x.
  const bus = busAsset.build({ color: 'White' }, style);
  bus.rotation.y = Math.PI / 2;
  bus.position.y = ROAD_Y;
  scene.add(bus);
  const L2 = 10.5 / 2;
  const headSpots = [];
  const headCones = [];
  for (const sx of [-1, 1]) {
    const cone = beam(16, 2.1, 0xfff6d8, 0.055, true);
    cone.position.set(sx * 0.9, 0.82, L2 + 0.05);
    bus.add(cone);
    headCones.push(cone);
    const lampMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff4d2 }),
    );
    lampMesh.position.set(sx * 0.9, 0.78, L2 + 0.2);
    lampMesh.userData.noShadow = true;
    bus.add(lampMesh);
    const spot = new THREE.SpotLight(0xfff1cc, 70, 48, 0.7, 0.55, 2);
    spot.position.set(sx * 0.9, 0.82, L2 + 0.05);
    spot.target.position.set(sx * 0.2, -0.4, L2 + 22);
    spot.userData.noShadow = true;
    bus.add(spot, spot.target);
    headSpots.push(spot);
    // A wet streak of the beam on the asphalt, lying in the road.
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 6),
      new THREE.MeshBasicMaterial({
        color: 0xfff0c4, transparent: true, opacity: 0.09, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    streak.rotation.x = -Math.PI / 2;
    streak.position.set(sx * 0.85, 0.04, L2 + 3.4);
    streak.userData.noShadow = true;
    bus.add(streak);
    const tail = new THREE.PointLight(0xff2a2a, 10, 14, 2);
    tail.position.set(sx * 1.05, 1.05, -L2 - 0.05);
    bus.add(tail);
    const tailCone = beam(2.8, 0.5, 0xff3028, 0.28, false);
    tailCone.position.set(sx * 1.05, 1.02, -L2 - 0.08);
    bus.add(tailCone);
  }

  const lampSpot = new THREE.SpotLight(0xffb06a, 55, 16, 1.05, 0.5, 2);
  lampSpot.position.copy(head);
  lampSpot.target.position.set(GP.x, 0.5, GP.z);
  scene.add(lampSpot, lampSpot.target);
  const lampPoint = new THREE.PointLight(0xffc080, 7, 12, 2);
  lampPoint.position.copy(head);
  scene.add(lampPoint);

  // Cool fill so shadows keep detail. No shadow of its own.
  const roadFill = new THREE.PointLight(0xd5e2f4, 16, 40, 2);
  roadFill.position.set(2, 6.5, 0);
  roadFill.userData.noShadow = true;
  scene.add(roadFill);
  const fill = new THREE.DirectionalLight(0xc5d4ee, 0.85);
  fill.position.set(-4, 8, -6);
  fill.userData.noShadow = true;
  scene.add(fill);

  // A small warm key for the kitten's face. Quiet until the close-up.
  const shoeFill = new THREE.PointLight(0xffc9a0, 0.35, 2.4, 2);
  shoeFill.position.set(GP.x + 0.15, 0.9, GP.z - 0.35);
  shoeFill.userData.noShadow = true;
  scene.add(shoeFill);
  const faceKey = new THREE.PointLight(0xffd8b0, 0.15, 1.6, 2);
  faceKey.position.set(GP.x - 0.9, 0.55, GP.z - 0.15);
  faceKey.userData.noShadow = true;
  scene.add(faceKey);

  const puddleZ = BUS_Z - 1.1; // the wheels on the camera side of the pass
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18), style.material('road', 0x6a788c));
  puddle.rotation.x = -Math.PI / 2;
  puddle.scale.set(1.7, 1.15, 1);
  puddle.position.set(PUDDLE_X, ROAD_Y + 0.03, puddleZ);
  scene.add(puddle);
  const puddleShine = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 18),
    new THREE.MeshBasicMaterial({
      color: 0xffe6c2, transparent: true, opacity: 0.12, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  puddleShine.rotation.x = -Math.PI / 2;
  puddleShine.position.set(PUDDLE_X, ROAD_Y + 0.04, puddleZ);
  puddleShine.userData.noShadow = true;
  scene.add(puddleShine);
  const splash = buildSplash();
  splash.position.set(PUDDLE_X, ROAD_Y + 0.02, puddleZ);
  scene.add(splash);

  const rain = createRain({
    seed: 11,
    dry: DRY,
    wide: { count: 280, region: [-50, 70, -14, 16] },
    local: { count: 640, region: [-8, 9, -1, 9] },
  });
  scene.add(rain.object);
  const rim = rimRain(22);
  scene.add(rim);

  const lights = style.createLights();
  scene.add(...lights.objects);
  const preset = weatherLight(lightingPresets.Night, 'Rain');
  // createLights baked the day colour and intensity; scale them like the viewer.
  lights.key.color.set(0xfff6e6).multiply(new THREE.Color(preset.keyColor));
  // Absolute levels. The weather preset's fraction, times a spot in candela,
  // either crushed the street or clipped it white (no filmic tonemap here).
  lights.key.intensity = 1.85;
  lights.hemi.intensity = 1.65;
  lights.hemi.color.set(0xb7c6e4);
  lights.hemi.groundColor.set(0x4a3a2c);
  // From the open side of the street, so the bus flank the pass-by camera sees is lit.
  const moon = new THREE.Vector3(0.2, 1, -0.65).normalize();
  lights.key.shadow.mapSize.set(512, 512);
  lights.key.shadow.bias = -0.001;
  lights.key.shadow.normalBias = 0.035;

  setNightGlow(scene, true);

  scene.traverse((o) => {
    if (!o.isMesh || o.userData.noShadow) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  // The additive beams should not throw shadows or receive them.
  rain.object.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  rim.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });

  function poseGrandpa(t) {
    joints.spine.rotation.set(0, 0, 0);
    joints.head.rotation.set(0, 0, 0);
    poseHold(grandpa, grandpa.userData.hold);
    // Shot 2: he turns toward the headlights, then settles before the wide.
    const turn = smoothstep(3.2, 6.5, t) * (1 - smoothstep(8.8, 9.85, t));
    joints.head.rotation.y += HEAD_YAW * turn;
    joints.head.rotation.x += -0.14 * turn;
    // Shot 6: the umbrella tips toward the kitten and stays there.
    const tilt = smoothstep(18.0, 21.2, t);
    // Negative z swings the right arm across toward his left, where the kitten is.
    joints.armR.rotation.z = joints.armR.userData.filmBaseZ - 1.45 * tilt;
    joints.armR.rotation.x += -0.25 * tilt;
    joints.handItem.quaternion.copy(joints.handItem.userData.filmBaseQ);
    joints.handItem.rotateZ(0.85 * tilt);
    joints.handItem.rotateX(0.45 * tilt);
  }

  function fitMoon(camera) {
    const focus = new THREE.Vector3(GP.x, 1, GP.z);
    const dist = camera ? camera.position.distanceTo(focus) : 12;
    const r = THREE.MathUtils.clamp(dist * 0.5, 2.4, 16);
    lights.key.position.copy(focus).addScaledVector(moon, 24);
    lights.key.target.position.copy(focus);
    const sh = lights.key.shadow.camera;
    sh.left = -r; sh.right = r; sh.top = r; sh.bottom = -r;
    sh.near = 0.4; sh.far = 50;
    sh.updateProjectionMatrix();
    lights.key.updateMatrixWorld();
  }

  const aimWorld = new THREE.Vector3();
  const aimLocal = new THREE.Vector3();
  function aimHeadlights(t) {
    // The opening sweeps the beam onto grandpa, then the lamps face down the road.
    const sweep = smoothstep(0.05, 1.45, t) * (1 - smoothstep(2.5, 4.6, t));
    aimWorld.set(bus.position.x + 16, 0.3, BUS_Z).lerp(new THREE.Vector3(GP.x, 0.35, GP.z), sweep);
    bus.updateMatrixWorld(true);
    bus.worldToLocal(aimLocal.copy(aimWorld));
    for (const spot of headSpots) spot.target.position.copy(aimLocal);
    for (const cone of headCones) {
      const dir = aimLocal.clone().sub(cone.position);
      const yaw = Math.atan2(dir.x, dir.z);
      const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
      cone.rotation.set(-pitch, yaw, 0);
    }
  }

  const stage = {
    scene,
    grandpa,
    kitten,
    kittenHead,
    bus,
    stick,
    puddle: { x: PUDDLE_X, y: ROAD_Y, z: puddleZ },
    gp: GP,
    busZ: BUS_Z,
    roadY: ROAD_Y,
    busX: busCenterX,
    update(t, camera) {
      poseGrandpa(t);
      // The kitten is there the whole night; earlier shots simply don't find him.
      kitten.visible = t >= 18;
      gait.t = t;
      poseCat(kittenInner, gait);
      kitten.updateMatrixWorld(true);
      headBone.getWorldPosition(kittenHead);
      const x = busCenterX(t);
      bus.position.x = x;
      bus.position.z = BUS_Z;
      poseSplash(splash, splashAmount(t));
      aimHeadlights(t);
      faceKey.intensity = t >= 25.4 ? 0.7 : (t >= 18 ? 0.28 : 0.08);
      rain.update(t, camera, screenRainOpacity(t));
      poseRim(rim, t, kittenHead);
      fitMoon(camera);
    },
    project(camera) {
      const v = new THREE.Vector3();
      const put = (x, y, z) => {
        v.set(x, y, z).project(camera);
        return {
          x: Math.round((v.x * 0.5 + 0.5) * 1080),
          y: Math.round((1 - (v.y * 0.5 + 0.5)) * 1920),
          behind: v.z < 0 || v.z > 1,
        };
      };
      return {
        feet: put(GP.x, 0.08, GP.z),
        head: put(GP.x, 1.55, GP.z),
        umbrella: put(GP.x, 2.15, GP.z),
        kitten: put(kittenHead.x, kittenHead.y, kittenHead.z),
        bus: put(bus.position.x, 1.5, bus.position.z),
        stick: put(stick.position.x, 0.12, stick.position.z),
        shoeR: put(GP.x + 0.22, 0.08, GP.z),
        coffee: put(-9, 4.0, -15.5),
      };
    },
    bounds() {
      const boxOf = (o) => {
        const b = new THREE.Box3().setFromObject(o);
        return { min: b.min.toArray(), max: b.max.toArray() };
      };
      return {
        grandpa: boxOf(grandpa),
        kitten: boxOf(kitten),
        head: kittenHead.toArray(),
        stick: boxOf(stick),
        bus: boxOf(bus),
      };
    },
  };
  stage.update(0, null);
  return stage;
}
