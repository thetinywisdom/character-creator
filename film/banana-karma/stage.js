import * as THREE from 'three';
import { style, lightingPresets } from '../../src/styles/index.js';
import { human } from '../../src/subjects/human.js';
import { measure } from '../../src/subjects/human/frame.js';
import { handGrip } from '../../src/subjects/human/arms.js';
import { buildHandItem } from '../../src/subjects/human/handheld.js';
import { poseGait, tuneOf } from '../../src/anim/gait.js';
import { CLOTH_COLORS } from '../../src/styles/palette.js';
import { bananaPeel, vendingMachine } from '../../src/props/extras.js';
import { box, tiledBox } from '../../src/props/util.js';
import { shop } from '../../src/city/buildings.js';
import { kissaten } from '../../src/city/shops.js';
import { tree } from '../../src/subjects/tree.js';
import { COMEDY } from '../../src/city/comedy.js';
import { mulberry32 } from '../../src/lib/rng.js';
import { smoothstep } from '../rig/ease.js';
import {
  CUP_LAND, CUP_LAUNCH, FALL_T, HANG_T1, JUMP_DUR, JUMP_T, JUMP_VY,
  PEEL1, SLAM_T1, SPEED, SPLAT_T, WALK1_A, WORKER_X,
  fallPoseTime, jumpHeight, walkAmount, walked, workerZ,
} from './timing.js';

// Staging for "Banana Karma". A bright sidewalk, a konbini, a kissaten,
// a vending machine and a street tree. The worker is a Man in the office
// look, phone in the right hand (the only hand slot), coffee parented to
// the left. The fall is COMEDY.fall[0], "Feet over head".

const FEET_OVER_HEAD = COMEDY.fall[0].victim;
const DAY = lightingPresets.Day;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function cycleLength(L, tune) {
  const W = tune.walk ?? {};
  const vn = SPEED * 0.75 / L;
  const styleStep = clamp(((W.stride ?? 1) / (W.cadence ?? 1)) / (0.85 / 1.1), 0.75, 1.35);
  return L * clamp(0.9 + 0.55 * vn, 1.0, 1.85) * styleStep;
}

/** The city's landing spring (gaitIK.landGait + the dip integrator), as a pure function of t. */
function landingDip(t) {
  const land = JUMP_T + JUMP_DUR;
  if (t < land) return 0;
  let dip = 0;
  let dipV = Math.min(1.6, Math.abs(-JUMP_VY) * 0.22);
  const dt = 1 / 120;
  const steps = Math.min(80, Math.floor((t - land) * 120));
  for (let i = 0; i < steps; i++) {
    dipV += (-140 * dip - 16 * dipV) * dt;
    dip = clamp(dip + dipV * dt, -0.04, 0.08);
  }
  return dip;
}

function placeBuilding(scene, built, x, z, rotY) {
  const g = built.group;
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  g.traverse((o) => { if (o.isMesh) o.userData.noCast = true; });
  scene.add(g);
  return g;
}

export function buildBananaKarma() {
  const scene = new THREE.Scene();
  const skyHex = typeof style.background === 'number' ? style.background : 0x7cc7ff;
  const sky = new THREE.Color(skyHex);
  scene.background = sky;
  scene.fog = new THREE.FogExp2(sky.getHex(), 0.007);

  const walkMat = style.material('sidewalk', 0xf7f4ee);
  const roadMat = style.material('road', 0xc8c2b6);
  const curbMat = style.material('concrete', 0xe4e0d8);

  // Sidewalk under the action, road off to +X, curb between them.
  scene.add(tiledBox(5.4, 0.2, 46, walkMat, [0.15, -0.1, -1], 4));
  scene.add(tiledBox(16, 0.16, 52, roadMat, [10.4, -0.24, -1], 4));
  scene.add(box(0.2, 0.18, 46, curbMat, [2.85, -0.02, -1]));

  // A pale centre line, so the road reads as a road in the wide shots.
  const dash = style.material('signage', 0xf4f1e6);
  for (let z = -16; z <= 14; z += 3.2) {
    scene.add(box(0.12, 0.02, 1.1, dash, [6.2, -0.14, z]));
  }

  const rng = mulberry32(7);
  // Fronts face +X, toward the sidewalk the worker is on.
  placeBuilding(scene, shop(style, rng, 11, 10, 'Konbini'), -8.2, 1.2, Math.PI / 2);
  placeBuilding(scene, kissaten(style, rng, 10, 11), -8.4, 10.2, Math.PI / 2);

  const vm = vendingMachine.build({ variant: 'Blue' }, style);
  vm.position.set(-1.55, 0, 3.35);
  vm.rotation.y = Math.PI / 2;
  scene.add(vm);

  const ginkgo = tree.build({ ...tree.presets.Ginkgo, seed: 4 }, style);
  ginkgo.position.set(2.15, 0, 7.2);
  scene.add(ginkgo);

  // The stock lamp reads as a black scaffold from these camera heights, so the
  // street is the shops, the vending machine and the tree.

  const peelWrap = (name) => {
    const g = new THREE.Group();
    g.name = name;
    g.add(bananaPeel.build({}, style));
    return g;
  };
  const peel1 = peelWrap('peel1');
  peel1.position.set(PEEL1.x, 0, PEEL1.z);
  scene.add(peel1);
  const peel2 = peelWrap('peel2');
  peel2.visible = false;
  scene.add(peel2);

  const splat = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 14),
    style.material('signage', 0xe8c47a),
  );
  splat.rotation.x = -Math.PI / 2;
  splat.position.set(PEEL1.x, 0.012, PEEL1.z);
  splat.visible = false;
  splat.userData.noShadow = true;
  scene.add(splat);

  const params = human.applyRules({
    ...human.presets.Man,
    ...human.outfits['Office worker'],
    handItem: 'Phone',
    handItemColor: 'Black',
    walkStyle: 'Swagger',
    runStyle: 'Natural',
    hair: 'short · side part',
    hairColor: 'Black',
    skin: 'Light',
    beard: 'None',
    moustache: 'None',
    faceAccessory: 'None',
    height: 1.8,
    build: 'Normal',
  });
  const worker = human.build(params, style);
  const mover = new THREE.Group();
  mover.add(worker);
  mover.rotation.y = Math.PI; // faces -Z, toward the camera
  scene.add(mover);

  const joints = {};
  worker.traverse((o) => { if (o.name && !joints[o.name]) joints[o.name] = o; });
  // The stock phone is a few centimetres tall. Bigger, it reads at the ear on a phone screen.
  const phone = worker.getObjectByName('handItem');
  if (phone) phone.scale.multiplyScalar(1.7);

  const tune = tuneOf(params);
  const gait = {
    phase: 0, amount: 0, run: 0, t: 0, speed: SPEED, dt: 0,
    cyc: 0, amt: 1, rw: 0, dip: 0, dipV: 0, look: 0, lookTo: 0,
  };
  // One pose so the IK rig measures the legs. amt 0, dt 0: nothing random sticks.
  poseGait(worker, gait, 'natural', tune);
  const L = worker.userData.legRig?.L ?? 0.85;
  const CYCLE = cycleLength(L, tune);
  // At the first stop the left foot (cycle 0) is the forward one.
  const PHASE = -walked(5) / CYCLE;

  function cycAt(t) {
    const raw = walked(Math.min(t, 11.08)) / CYCLE + PHASE;
    if (t < 10.62) return walked(t) / CYCLE + PHASE;
    const cFreeze = walked(11.08) / CYCLE + PHASE;
    const target = Math.round(cFreeze);
    const u = smoothstep(10.62, 11.08, Math.min(t, 11.08));
    return raw + (target - cFreeze) * u;
  }

  // Coffee lives in the scene, not on the rig: one hand slot is the phone.
  // The local transform is the forearm-space pose of a held cup.
  const fMeasure = measure(params);
  fMeasure.mats = { trim: style.material('accent', 0x2a2a30) };
  const { grip } = handGrip(fMeasure, 1);
  const cup = buildHandItem(
    fMeasure, 'Coffee cup',
    style.material('cloth', CLOTH_COLORS.White),
    new THREE.Vector3(), new THREE.Vector3(0, -1, 0), style,
  );
  cup.scale.setScalar(1.7);
  cup.name = 'coffee';
  scene.add(cup);
  let cupLocalPos = new THREE.Vector3();
  let cupLocalQuat = new THREE.Quaternion();

  function poseLeftArm(t) {
    const arm = joints.armL;
    const fore = joints.foreL;
    if (!arm || !fore) return;
    // Bring the cup up to the mouth through the victory strut, then back down
    // before the second peel. Otherwise it rides out to his side, clear of the jacket.
    const sip = smoothstep(9.35, 9.85, t) * (1 - smoothstep(10.15, 10.65, t));
    arm.rotation.x = -0.42 + (-1.15 - -0.42) * sip;
    arm.rotation.z = 0.62 + (0.18 - 0.62) * sip;
    fore.rotation.x = -1.25 + (-1.45 - -1.25) * sip;
    if (joints.head && sip > 0) {
      joints.head.rotation.x -= 0.22 * sip;
      joints.head.rotation.z += 0.08 * sip;
    }
  }

  function captureCupLocal() {
    poseBody(3, { cup: false });
    worker.updateMatrixWorld(true);
    const fore = joints.foreL;
    const at = worker.worldToLocal(fore.localToWorld(grip.clone()));
    worker.localToWorld(at);
    cupLocalPos = fore.worldToLocal(at);
    const q = new THREE.Quaternion();
    cupLocalQuat = fore.getWorldQuaternion(q).invert().multiply(worker.getWorldQuaternion(new THREE.Quaternion()));
  }

  let zBias = 0;
  let frontOffset = { x: 0.08, z: -0.36 };
  const peel2Pos = { x: WORKER_X, z: -4 };
  let launchPos = new THREE.Vector3(WORKER_X, 1.1, 0);
  let launchQuat = new THREE.Quaternion();

  function poseBody(t, opt = {}) {
    const placeCup = opt.cup !== false;
    mover.position.set(WORKER_X, 0, workerZ(t) + zBias);
    mover.rotation.y = Math.PI;
    mover.visible = t >= WALK1_A - 0.04;

    gait.t = t;
    gait.dt = 0;
    gait.speed = SPEED;
    gait.run = 0;
    gait.rw = 0;
    gait.amt = walkAmount(t);
    gait.dip = landingDip(t);
    gait.dipV = 0;
    gait.cyc = cycAt(t);
    gait.look = 0;
    gait.lookTo = 0;
    poseGait(worker, gait, 'natural', tune);

    const falling = fallPoseTime(t) >= 0;
    if (!falling) {
      poseLeftArm(t);
      // Lift the phone hand from the stock pose so it sits at the ear, not the chest.
      if (joints.armR) {
        joints.armR.rotation.x = -0.72;
        joints.armR.rotation.z = 0.15;
      }
      if (joints.foreR) joints.foreR.rotation.x = -2.15;
    }

    const jy = jumpHeight(t);
    if (jy > 0.001 && !falling) {
      const k = Math.min(1, jy / 0.28);
      for (const s of ['L', 'R']) {
        if (joints[`leg${s}`]) joints[`leg${s}`].rotation.x -= 0.55 * k;
        if (joints[`shin${s}`]) joints[`shin${s}`].rotation.x += 0.95 * k;
      }
      worker.position.y += jy;
    }

    if (!falling && t >= 2 && t < FALL_T && joints.head) {
      joints.head.rotation.x -= 0.14; // chin up, pleased with himself
    }

    // Front foot hovers a finger above the second peel for the insert,
    // and stays clear until the fall actually takes him.
    if (t >= 11.02 && t < 12.22) {
      if (joints.legL) joints.legL.rotation.x -= 0.48;
      if (joints.shinL) joints.shinL.rotation.x += 0.62;
      if (joints.footL) joints.footL.rotation.x -= 0.2;
    }

    const pt = fallPoseTime(t);
    if (pt >= 0 && pt <= FEET_OVER_HEAD.dur) {
      FEET_OVER_HEAD.pose(worker, joints, pt);
      // The fall pose drives the thighs and leaves the shins in the walk
      // pose, which throws a shoe off the leg. Straighten them once he is over.
      if (pt >= 0.28) {
        const flat = smoothstep(0.28, 0.5, pt);
        for (const s of ['L', 'R']) {
          if (joints[`shin${s}`]) joints[`shin${s}`].rotation.x = 0.35 * (1 - flat) + 0.05 * flat;
          if (joints[`foot${s}`]) joints[`foot${s}`].rotation.x = 0.15 * flat;
        }
      }
      // The peel is a few centimetres tall. A finger of lift after the slam
      // keeps the soles on top of it instead of inside it.
      if (pt >= 0.6) worker.position.y += 0.035;
    }

    if (placeCup) placeCoffee(t);
    cup.visible = t >= CUP_LAUNCH || mover.visible;
    posePeels(t);
  }

  function placeCoffee(t) {
    if (t < CUP_LAUNCH) {
      worker.updateMatrixWorld(true);
      joints.foreL.localToWorld(cup.position.copy(cupLocalPos));
      const q = new THREE.Quaternion();
      cup.quaternion.copy(joints.foreL.getWorldQuaternion(q)).multiply(cupLocalQuat);
      return;
    }
    const p = cupFlight(t);
    cup.position.set(p.x, p.y, p.z);
    const tumble = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.spin, p.spin * 0.65, p.spin * 0.2));
    const upright = new THREE.Quaternion();
    cup.quaternion.copy(tumble).slerp(upright, p.upright);
  }

  function cupFlight(t) {
    // Screen-left of his chest in the overhead (world +X). The right 140 px
    // is a caption band, so the cup cannot land on his other side.
    const landX = WORKER_X + 0.42;
    const landZ = workerZ(CUP_LAND) + zBias + 0.08;
    const landY = 0.02;
    const hangT = HANG_T1;
    const dropT = CUP_LAND - 0.55;
    if (t < hangT) {
      const k = clamp((t - CUP_LAUNCH) / (hangT - CUP_LAUNCH), 0, 1);
      const rise = Math.sin(k * Math.PI * 0.5);
      return {
        x: launchPos.x + (landX - launchPos.x) * k * 0.55,
        y: launchPos.y + rise * 0.55,
        z: launchPos.z + (landZ - launchPos.z) * k * 0.45,
        spin: (t - CUP_LAUNCH) * 8,
        upright: 0,
      };
    }
    if (t < dropT) {
      const k = clamp((t - hangT) / (dropT - hangT), 0, 1);
      return {
        x: launchPos.x + (landX - launchPos.x) * (0.55 + 0.45 * k),
        y: launchPos.y + 0.55 + (landY + 0.7 - (launchPos.y + 0.55)) * k,
        z: launchPos.z + (landZ - launchPos.z) * (0.45 + 0.55 * k),
        spin: (t - CUP_LAUNCH) * 6,
        upright: 0,
      };
    }
    if (t < CUP_LAND) {
      const k = clamp((t - dropT) / (CUP_LAND - dropT), 0, 1);
      const e = k * k;
      return {
        x: landX, z: landZ,
        y: (landY + 0.7) * (1 - e) + landY * e,
        spin: (1 - k) * 3,
        upright: k,
      };
    }
    const b = t - CUP_LAND;
    const hop = Math.exp(-b * 9) * Math.abs(Math.sin(b * 30)) * 0.045;
    return { x: landX, y: landY + hop, z: landZ, spin: 0, upright: 1 };
  }

  function posePeels(t) {
    // Peel 1 drops in the hook and stays where it splatted.
    if (t < 0.06) {
      peel1.position.y = 2.6;
      peel1.rotation.set(t * 4, 0, t * 3);
      peel1.scale.setScalar(1);
      splat.visible = false;
    } else if (t < SPLAT_T) {
      const u = (t - 0.06) / (SPLAT_T - 0.06);
      peel1.position.set(PEEL1.x, 2.6 * (1 - u * u), PEEL1.z);
      peel1.rotation.set(u * 2.2, u * 5, u * 1.4);
      peel1.scale.setScalar(1);
      splat.visible = false;
    } else {
      const b = t - SPLAT_T;
      const bounce = Math.exp(-b * 8) * Math.abs(Math.sin(b * 24)) * 0.1;
      const squash = Math.exp(-b * 12) * 0.28;
      peel1.position.set(PEEL1.x, bounce, PEEL1.z);
      peel1.rotation.set(0, 0.35, 0);
      peel1.scale.set(1 + squash, 1 - squash * 0.65, 1 + squash);
      splat.visible = true;
      const grow = 1 - Math.exp(-b * 14);
      splat.scale.setScalar(0.35 + grow * 0.85);
    }

    peel2.visible = t >= 10.98;
    peel2.position.set(peel2Pos.x, 0.005, peel2Pos.z);
    peel2.rotation.set(0, 0.8, 0);
    peel2.scale.setScalar(1);
  }

  function frontShoe() {
    worker.updateMatrixWorld(true);
    const bl = new THREE.Box3().setFromObject(joints.footL);
    const br = new THREE.Box3().setFromObject(joints.footR);
    return bl.min.z <= br.min.z
      ? { box: bl, joint: joints.footL }
      : { box: br, joint: joints.footR };
  }

  // Cup's rest pose on the forearm, then shift the whole path so the stopped
  // shoe sits an inch off the first peel, then plant the second peel under
  // the foot he actually stops on.
  captureCupLocal();
  poseBody(6);
  const peelBox = new THREE.Box3().setFromObject(peel1);
  const toeZ = frontShoe().box.min.z;
  // One inch between the toe tip and the near edge of the peel.
  zBias = peelBox.max.z + 0.025 - toeZ;
  poseBody(6);
  {
    const front = frontShoe();
    const toe = new THREE.Vector3();
    front.joint.getWorldPosition(toe);
    frontOffset = { x: toe.x - mover.position.x, z: toe.z - mover.position.z };
  }
  poseBody(11.45);
  {
    const front = frontShoe();
    const peelR = Math.max(peelBox.max.x - peelBox.min.x, peelBox.max.z - peelBox.min.z) / 2;
    // Just ahead of the toe and a little to the side, so the insert reads
    // "under the next step" and the flat landing does not put the shoe inside the peel.
    // Entirely beside the toe, with a gap, so the hovering shoe reads as
    // about to land on it and the flat pose does not bury the shoe in the mesh.
    // Under the next inch of the step, nudged off the shoe centre so the
    // petals and the sole occupy different space once he is flat.
    peel2Pos.x = (front.box.min.x + front.box.max.x) / 2 - 0.08;
    peel2Pos.z = front.box.min.z - peelR * 0.35;
  }
  poseBody(CUP_LAUNCH);
  worker.updateMatrixWorld(true);
  launchPos = joints.foreL.localToWorld(cupLocalPos.clone());
  {
    const q = new THREE.Quaternion();
    launchQuat = joints.foreL.getWorldQuaternion(q).multiply(cupLocalQuat);
  }
  poseBody(0);

  const lights = style.createLights();
  scene.add(...lights.objects);
  // Day preset: white key, no night tint. Intensities are the style's own
  // (createLights already baked them) times the Day multipliers, which are 1.
  lights.key.color.copy(new THREE.Color(0xfff6e8)).multiply(new THREE.Color(DAY.keyColor));
  lights.key.intensity = 2.55 * DAY.key;
  lights.hemi.color.set(0xfff9f0);
  lights.hemi.groundColor.set(0xf2e2c4);
  lights.hemi.intensity = 2.05 * DAY.hemi;
  const fill = new THREE.DirectionalLight(0xfff4e2, 0.9);
  fill.position.set(-2, 5, -6);
  fill.userData.noShadow = true;
  scene.add(fill);
  const bounce = new THREE.DirectionalLight(0xffe6c0, 0.45);
  bounce.position.set(0, -2, 2);
  bounce.userData.noShadow = true;
  scene.add(bounce);

  lights.key.shadow.mapSize.set(1024, 1024);
  lights.key.shadow.bias = -0.0006;
  lights.key.shadow.normalBias = 0.035;

  scene.traverse((o) => {
    if (!o.isMesh || o.userData.noShadow) return;
    o.receiveShadow = true;
    o.castShadow = !o.userData.noCast;
  });
  // The worker throws the contact shadow. Buildings stay unshadowed so a
  // shop doesn't paint a black slab across the sunny pavement.
  worker.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  peel1.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  peel2.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  cup.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  const v = new THREE.Vector3();
  function projectPoint(camera, x, y, z) {
    v.set(x, y, z).project(camera);
    const px = (v.x * 0.5 + 0.5) * 1080;
    const py = (1 - (v.y * 0.5 + 0.5)) * 1920;
    return {
      x: Math.round(px), y: Math.round(py),
      behind: v.z < -1 || v.z > 1,
      top: py < 220, bottom: py > 1500, right: px > 940,
    };
  }

  function fitSun(camera) {
    const focus = new THREE.Vector3(mover.position.x, 1, mover.position.z);
    const dist = camera ? camera.position.distanceTo(focus) : 5;
    const r = clamp(dist * 0.9, 1.1, 7);
    // Sun high and in front of him (he's facing -Z), so the face is the lit side.
    lights.key.position.set(focus.x + 3.2, focus.y + 9.5, focus.z - 4.2);
    lights.key.target.position.copy(focus);
    const sh = lights.key.shadow.camera;
    sh.left = -r; sh.right = r; sh.top = r; sh.bottom = -r;
    sh.near = 0.4; sh.far = 36;
    sh.updateProjectionMatrix();
    lights.key.updateMatrixWorld();
  }

  const stage = {
    scene,
    x: WORKER_X,
    z(t) { return workerZ(t) + zBias; },
    frontFoot(t) {
      return { x: WORKER_X + frontOffset.x, z: workerZ(t) + zBias + frontOffset.z };
    },
    get peel2() { return peel2Pos; },
    update(t, camera) {
      poseBody(t);
      fitSun(camera);
    },
    project(camera) {
      worker.updateMatrixWorld(true);
      const head = new THREE.Vector3();
      const fl = new THREE.Vector3();
      const fr = new THREE.Vector3();
      joints.head.getWorldPosition(head);
      joints.footL.getWorldPosition(fl);
      joints.footR.getWorldPosition(fr);
      const cupP = cup.position;
      const headPx = projectPoint(camera, head.x, head.y, head.z);
      const flPx = projectPoint(camera, fl.x, fl.y, fl.z);
      const frPx = projectPoint(camera, fr.x, fr.y, fr.z);
      const wb = new THREE.Box3().setFromObject(worker);
      const ys = [];
      for (const x of [wb.min.x, wb.max.x]) {
        for (const y of [wb.min.y, wb.max.y]) {
          for (const z of [wb.min.z, wb.max.z]) {
            const p = projectPoint(camera, x, y, z);
            if (!p.behind) ys.push(p.y);
          }
        }
      }
      const frac = ys.length >= 2 ? (Math.max(...ys) - Math.min(...ys)) / 1920 : 0;
      return {
        head: headPx,
        footL: flPx,
        footR: frPx,
        peel1: projectPoint(camera, peel1.position.x, 0.04, peel1.position.z),
        peel2: projectPoint(camera, peel2.position.x, 0.04, peel2.position.z),
        cup: projectPoint(camera, cupP.x, cupP.y, cupP.z),
        frac: Math.round(frac * 1000) / 1000,
        z: Math.round((workerZ(0) + zBias) * 100) / 100,
      };
    },
    bounds() {
      poseBody(stage._t ?? 0);
      worker.updateMatrixWorld(true);
      const boxOf = (o) => {
        if (!o.visible) return null;
        const b = new THREE.Box3().setFromObject(o);
        if (b.isEmpty()) return null;
        const r = (n) => Math.round(n * 1000) / 1000;
        return { min: b.min.toArray().map(r), max: b.max.toArray().map(r) };
      };
      const overlap = (a, b) => a && b
        && a.min[0] <= b.max[0] && a.max[0] >= b.min[0]
        && a.min[1] <= b.max[1] && a.max[1] >= b.min[1]
        && a.min[2] <= b.max[2] && a.max[2] >= b.min[2];
      const foot = boxOf(joints.footL);
      const p1 = boxOf(peel1);
      const p2 = peel2.visible ? boxOf(peel2) : null;
      return {
        footL: foot,
        peel1: p1,
        peel2: p2,
        footHitsPeel1: overlap(foot, p1),
        footHitsPeel2: overlap(foot, p2),
        zBias: Math.round(zBias * 1000) / 1000,
        cycle: Math.round(CYCLE * 1000) / 1000,
      };
    },
  };

  // Remember the last posed time so bounds() doesn't rewind the picture.
  const update = stage.update;
  stage.update = (t, camera) => { stage._t = t; update(t, camera); };
  stage.update(0, null);
  return stage;
}
