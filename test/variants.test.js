import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import {
  ANIMATIONS,
  BOX_FIT,
  JOINT_NAMES,
  MUSCULAR_SCALE,
  ROBOT_LEG_COLOR,
  SKELETON_SCALE,
  createBody,
  createCharacter,
  defaultDocument,
} from '../src/body/index.js';
import { applyPreset, presetMeasures } from '../src/character/presets.js';

function cornerDistance(mesh, yTest) {
  const pos = mesh.geometry.attributes.position;
  let max = 0;
  for (let i = 0; i < pos.count; i += 1) {
    if (!yTest(pos.getY(i))) continue;
    max = Math.max(max, Math.hypot(pos.getX(i), pos.getZ(i)));
  }
  return max;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe('proportions and limb variants', () => {
  it('keeps the naked default at 1421 and matches createBody', () => {
    const naked = createBody();
    const character = createCharacter();
    assert.equal(character.getDocument().body.belly, null);
    assert.equal(character.getStats().vertices, 1421);
    assert.equal(character.getStats().triangles, 1868);
    assert.deepEqual(character.getStats().roles, naked.getStats().roles);
    for (const name of JOINT_NAMES) {
      assert.ok(character.joints[name].position.distanceTo(naked.joints[name].position) < 1e-6, name);
    }
    naked.update(0, { anim: 'walk', time: 0.4, speed: 1.6, freeze: true });
    character.update(0, { anim: 'walk', time: 0.4, speed: 1.6, freeze: true });
    assert.ok(Math.abs(naked.joints.elbowL.rotation.x - character.joints.elbowL.rotation.x) < 1e-8);
    assert.ok(Math.abs(naked.joints.kneeL.rotation.x - character.joints.kneeL.rotation.x) < 1e-8);
    assert.ok(Math.abs(naked.pelvis.rotation.y - character.pelvis.rotation.y) < 1e-8);
  });

  it('writes a woman slim preset and keeps it when a slider moves', () => {
    const measures = presetMeasures('woman', 'slim', 1.8);
    const character = createCharacter(applyPreset(defaultDocument(), 'woman', 'slim'));
    const doc = character.getDocument();
    assert.equal(doc.body.presentation, 'woman');
    assert.equal(doc.body.type, 'slim');
    assert.equal(doc.body.shoulder, measures.shoulder);
    assert.equal(doc.body.belly, measures.belly);
    assert.equal(doc.body.hip, measures.hip);
    assert.equal(doc.body.limbThickness, measures.limbThickness);
    character.setParams({ shoulderWidth: 0.5 });
    const edited = character.getDocument();
    assert.equal(edited.body.presentation, 'woman');
    assert.equal(edited.body.type, 'slim');
    assert.equal(edited.body.shoulder, 0.5);
    assert.equal(edited.body.belly, measures.belly);
    assert.equal(edited.body.hip, measures.hip);
    assert.equal(edited.body.limbThickness, measures.limbThickness);
  });

  it('widens the belly mesh without moving the hip joints', () => {
    const character = createCharacter();
    const hipL = character.joints.hipL.position.x;
    const hipR = character.joints.hipR.position.x;
    const top = character.root.getObjectByName('chestMesh').geometry.userData.topWidth;
    character.setParams({ bellyWidth: 0.4 });
    assert.equal(character.getDocument().body.belly, 0.4);
    assert.equal(character.joints.hipL.position.x, hipL);
    assert.equal(character.joints.hipR.position.x, hipR);
    assert.ok(Math.abs(character.getResolved().radii.waist - 0.2) < 1e-6);
    const chest = character.root.getObjectByName('chestMesh').geometry.userData;
    const pelvis = character.root.getObjectByName('pelvisMesh').geometry.userData;
    assert.ok(Math.abs(chest.bottomWidth - 0.4) < 1e-6);
    assert.ok(Math.abs(pelvis.topWidth - 0.4) < 1e-6);
    assert.ok(Math.abs(chest.topWidth - top) < 1e-6);
    assert.equal(character.getStats().vertices, 1421);
  });

  it('fits a robot torso inside the waist ball and clears tops', () => {
    const doc = defaultDocument();
    doc.clothing.top = { id: 'tee', color: '#3a5a40' };
    doc.clothing.outer = { id: 'jacket', color: '#111111' };
    const character = createCharacter(doc);
    const saved = character.updateDocument((next) => {
      next.body.torso = 'robot';
    });
    assert.equal(saved.body.torso, 'robot');
    assert.equal(saved.clothing.top.id, 'none');
    assert.equal(saved.clothing.outer.id, 'none');
    assert.ok(character.getStats().vertices < 1421);
    const waistR = character.getResolved().radii.waist;
    const chest = character.root.getObjectByName('chestMesh');
    const pelvis = character.root.getObjectByName('pelvisMesh');
    const chestWaist = cornerDistance(chest, (y) => y < 1e-4);
    const pelvisWaist = cornerDistance(pelvis, (y) => y > pelvis.geometry.userData.height - 1e-4);
    assert.ok(chestWaist <= waistR * BOX_FIT + 1e-5, chestWaist);
    assert.ok(pelvisWaist <= waistR * BOX_FIT + 1e-5, pelvisWaist);
    assert.ok(character.root.getObjectByName('yokeMesh'));
    assert.throws(() => character.setDocument({
      ...character.getDocument(),
      clothing: {
        ...character.getDocument().clothing,
        top: { id: 'tee', color: '#3a5a40' },
      },
    }));
    assert.equal(character.getDocument().body.torso, 'robot');
    assert.equal(character.getDocument().clothing.top.id, 'none');
  });

  it('caps muscular scale and keeps the skeleton shoulder seated', () => {
    const normal = createCharacter();
    const muscular = createCharacter();
    muscular.updateDocument((doc) => { doc.arms.left.type = 'muscular'; });
    const shoulder = normal.root.getObjectByName('shoulderLMesh').geometry.parameters.radius;
    const grown = muscular.root.getObjectByName('shoulderLMesh').geometry.parameters.radius;
    const elbow = normal.root.getObjectByName('elbowLMesh').geometry.parameters.radius;
    const grownElbow = muscular.root.getObjectByName('elbowLMesh').geometry.parameters.radius;
    assert.ok(Math.abs(grown / shoulder - MUSCULAR_SCALE) < 1e-6);
    assert.ok(grown <= shoulder * MUSCULAR_SCALE + 1e-9);
    assert.ok(Math.abs(grownElbow / elbow - MUSCULAR_SCALE) < 1e-6);
    assert.equal(muscular.getStats().vertices, 1421);

    const skeleton = createCharacter();
    skeleton.updateDocument((doc) => { doc.arms.right.type = 'skeleton'; });
    const normalShoulder = normal.root.getObjectByName('shoulderRMesh').geometry.parameters.radius;
    const thinShoulder = skeleton.root.getObjectByName('shoulderRMesh').geometry.parameters.radius;
    const normalElbow = normal.root.getObjectByName('elbowRMesh').geometry.parameters.radius;
    const thinElbow = skeleton.root.getObjectByName('elbowRMesh').geometry.parameters.radius;
    assert.ok(thinShoulder >= normalShoulder - 1e-9);
    assert.ok(Math.abs(thinElbow / normalElbow - SKELETON_SCALE) < 1e-6);
    const tube = skeleton.root.getObjectByName('upperArmRMesh');
    const pos = tube.geometry.attributes.position;
    let top = 0;
    let bottom = Infinity;
    for (let i = 0; i < pos.count; i += 1) {
      const radial = Math.hypot(pos.getX(i), pos.getZ(i));
      if (pos.getY(i) > 0) top = Math.max(top, radial);
      else bottom = Math.min(bottom, radial);
    }
    assert.ok(Math.abs(top - normalShoulder) < 1e-4);
    assert.ok(Math.abs(bottom - normalElbow * SKELETON_SCALE) < 1e-4);
  });

  it('keeps robot limb corners inside the joint balls', () => {
    const character = createCharacter();
    character.updateDocument((doc) => {
      doc.arms.right.type = 'robot';
      doc.arms.right.color = '#c5c5c5';
      doc.legs.left.type = 'robot';
    });
    const spec = character.getResolved();
    const upper = character.root.getObjectByName('upperArmRMesh');
    const forearm = character.root.getObjectByName('forearmRMesh');
    assert.ok(cornerDistance(upper, (y) => y > spec.upperArmLength * 0.5) <= spec.radii.shoulder + 1e-6);
    assert.ok(cornerDistance(upper, (y) => y < spec.upperArmLength * 0.5) <= spec.radii.elbow + 1e-6);
    assert.ok(cornerDistance(forearm, (y) => y > spec.forearmLength * 0.5) <= spec.radii.elbow + 1e-6);
    assert.ok(cornerDistance(forearm, (y) => y < spec.forearmLength * 0.5) <= spec.radii.wrist + 1e-6);
    const thigh = character.root.getObjectByName('thighLMesh');
    const shin = character.root.getObjectByName('shinLMesh');
    assert.ok(cornerDistance(thigh, (y) => y > spec.thighLength * 0.5) <= spec.radii.hip + 1e-6);
    assert.ok(cornerDistance(shin, (y) => y < spec.shinLength * 0.5) <= spec.radii.ankle + 1e-6);
    assert.equal(character.getDocument().legs.left.color, null);
    assert.equal(
      character.root.getObjectByName('thighLMesh').material.color.getHexString(),
      ROBOT_LEG_COLOR.slice(1),
    );
    character.setParams({ skinColor: '#112233' });
    assert.equal(
      character.root.getObjectByName('thighLMesh').material.color.getHexString(),
      ROBOT_LEG_COLOR.slice(1),
    );

    const fist = createCharacter();
    fist.updateDocument((doc) => { doc.arms.left.hand = 'fist'; });
    const hand = fist.root.getObjectByName('handLMesh');
    const wrist = fist.joints.wristL;
    fist.root.updateMatrixWorld(true);
    const point = new Vector3();
    const pos = hand.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      point.fromBufferAttribute(pos, i);
      hand.localToWorld(point);
      wrist.worldToLocal(point);
      assert.ok(point.length() <= spec.radii.wrist + 1e-4);
    }
    assert.equal(pos.count, 8);
    assert.equal(fist.root.getObjectByName('handLMesh').parent, wrist);
  });

  it('plants a peg without bending its knee or moving the hip', () => {
    const naked = createBody();
    const character = createCharacter();
    character.updateDocument((doc) => { doc.legs.left.type = 'peg'; });
    assert.equal(character.root.getObjectByName('kneeLMesh'), undefined);
    assert.equal(character.root.getObjectByName('shinLMesh'), undefined);
    assert.equal(character.root.getObjectByName('ankleLMesh'), undefined);
    assert.equal(character.root.getObjectByName('footLMesh'), undefined);
    assert.ok(character.root.getObjectByName('pegLMesh'));
    assert.ok(character.root.getObjectByName('nubL'));
    assert.ok(character.root.getObjectByName('kneeRMesh'));
    assert.ok(character.root.getObjectByName('footRMesh'));
    assert.ok(character.joints.hipL.position.distanceTo(naked.joints.hipL.position) < 1e-6);
    assert.equal(character.joints.kneeL.position.y, naked.joints.kneeL.position.y);
    let bent = false;
    const world = new Vector3();
    for (let time = 0; time <= 2; time += 0.05) {
      character.update(0, { anim: 'walk', time, speed: 1.6, freeze: true });
      assert.equal(character.joints.kneeL.rotation.x, 0);
      assert.equal(character.joints.ankleL.rotation.x, 0);
      if (character.joints.kneeR.rotation.x > 0.15) bent = true;
      character.root.updateMatrixWorld(true);
      for (const name of ['footLHeel', 'footLToe', 'footRHeel', 'footRToe']) {
        const y = character.root.getObjectByName(name).getWorldPosition(world).y;
        assert.ok(y >= -2e-3, `${name} ${y}`);
      }
    }
    assert.ok(bent, 'the other knee still walks');
    character.update(0, { anim: 'jump', time: 0.2, speed: 0, freeze: true });
    assert.equal(character.joints.kneeL.rotation.x, 0);
  });

  it('stomps higher with held elbows and swaggers the hips', () => {
    function sample(style) {
      const character = createCharacter();
      character.updateDocument((doc) => { doc.animation.walkStyle = style; });
      let maxFoot = 0;
      let maxYaw = 0;
      const elbows = [];
      const world = new Vector3();
      for (let time = 0; time <= 2.4; time += 0.05) {
        character.update(0, { anim: 'walk', time, speed: 1.6, freeze: true });
        character.root.updateMatrixWorld(true);
        for (const name of ['footLHeel', 'footRHeel']) {
          maxFoot = Math.max(maxFoot, character.root.getObjectByName(name).getWorldPosition(world).y);
        }
        maxYaw = Math.max(maxYaw, Math.abs(character.pelvis.rotation.y));
        elbows.push(Math.abs(character.joints.elbowL.rotation.x));
      }
      const avg = mean(elbows);
      const variance = mean(elbows.map((value) => (value - avg) ** 2));
      return { maxFoot, maxYaw, avg, variance };
    }
    const normal = sample('normal');
    const stomp = sample('stomp');
    const swagger = sample('swagger');
    assert.ok(stomp.maxFoot > normal.maxFoot * 1.15, `${stomp.maxFoot} vs ${normal.maxFoot}`);
    assert.ok(Math.abs(stomp.avg - 0.6) < 0.05, stomp.avg);
    assert.ok(stomp.variance < 0.002, stomp.variance);
    assert.ok(Math.abs(normal.avg - 0.6) > Math.abs(stomp.avg - 0.6));
    assert.ok(swagger.maxYaw > normal.maxYaw * 1.3, `${swagger.maxYaw} vs ${normal.maxYaw}`);
  });

  it('plays every clip on a mixed body and round-trips the document', () => {
    const doc = defaultDocument();
    doc.body.torso = 'robot';
    doc.arms.left.type = 'muscular';
    doc.arms.left.color = '#cc6644';
    doc.arms.left.hand = 'claw';
    doc.arms.right.type = 'skeleton';
    doc.arms.right.hand = 'hook';
    doc.legs.left.type = 'robot';
    doc.legs.right.type = 'peg';
    doc.legs.right.color = '#8a5a32';
    doc.animation.walkStyle = 'stomp';
    const character = createCharacter(doc);
    const bind = new Map(JOINT_NAMES.map((name) => [name, character.joints[name].position.clone()]));
    const naked = createBody();
    for (const name of JOINT_NAMES) {
      assert.ok(character.joints[name].position.distanceTo(naked.joints[name].position) < 1e-6, name);
    }
    const verts = character.getStats().vertices;
    const world = new Vector3();
    for (const anim of ANIMATIONS) {
      const dur = anim.kind === 'dance' ? 2.4 : anim.kind === 'action' ? 2.2 : 1.2;
      for (let time = 0; time <= dur; time += 0.3) {
        character.update(0, { anim: anim.id, time, speed: anim.speed, freeze: true });
        character.root.updateMatrixWorld(true);
        character.root.traverse((obj) => {
          assert.ok(Number.isFinite(obj.position.x + obj.quaternion.w), anim.id);
        });
        for (const name of ['footLHeel', 'footLToe', 'footRHeel', 'footRToe']) {
          const y = character.root.getObjectByName(name).getWorldPosition(world).y;
          assert.ok(y >= -2e-3, `${anim.id} ${name}`);
        }
        const spec = character.getResolved();
        for (const side of ['L', 'R']) {
          const hand = character.root.getObjectByName(`hand${side}Mesh`);
          const chest = character.root.getObjectByName('chestMesh');
          const pelvis = character.root.getObjectByName('pelvisMesh');
          const head = character.root.getObjectByName('headMesh');
          for (const along of [spec.handLength, spec.handLength * 0.5]) {
            hand.localToWorld(world.set(0, -along, 0));
            assert.ok(overlap(head, world, true) < 0.02, `${anim.id} head`);
            assert.ok(overlap(chest, world, false) < 0.02, `${anim.id} chest`);
            assert.ok(overlap(pelvis, world, false) < 0.02, `${anim.id} pelvis`);
          }
        }
      }
    }
    assert.equal(character.getStats().vertices, verts);
    for (const [name, position] of bind) {
      assert.ok(character.joints[name].position.distanceTo(position) < 1e-6, name);
    }
    const again = createCharacter(character.getDocument());
    assert.deepEqual(again.getDocument(), character.getDocument());
    assert.equal(again.getStats().vertices, verts);

    const counts = {
      default: 1421,
      robotTorso: robotCount(),
      peg: pegCount(),
      muscularArm: 1421,
      mixed: verts,
    };
    console.log(`VERTS ${JSON.stringify(counts)}`);
    assert.ok(counts.robotTorso < 1421);
    assert.ok(counts.peg < 1421);
    assert.ok(counts.mixed < 1421);
  });
});

function robotCount() {
  const character = createCharacter();
  character.updateDocument((doc) => { doc.body.torso = 'robot'; });
  return character.getStats().vertices;
}

function pegCount() {
  const character = createCharacter();
  character.updateDocument((doc) => { doc.legs.right.type = 'peg'; });
  return character.getStats().vertices;
}

function overlap(mesh, point, head) {
  const local = mesh.worldToLocal(point.clone());
  if (head) {
    const pos = mesh.geometry.attributes.position;
    let limit = null;
    let best = Infinity;
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i);
      const gap = Math.abs(y - local.y);
      if (gap < best) {
        best = gap;
        limit = Math.hypot(pos.getX(i), pos.getZ(i) / 1.08);
      }
    }
    if (limit == null) return 0;
    return limit - Math.hypot(local.x, local.z / 1.08);
  }
  const data = mesh.geometry.userData;
  if (local.y < 0 || local.y > data.height) return 0;
  const u = local.y / data.height;
  const halfW = (data.bottomWidth * (1 - u) + data.topWidth * u) / 2;
  const halfD = (data.bottomDepth * (1 - u) + data.topDepth * u) / 2;
  const ix = halfW - Math.abs(local.x);
  const iz = halfD - Math.abs(local.z);
  return ix > 0 && iz > 0 ? Math.min(ix, iz) : 0;
}
