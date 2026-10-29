import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { JOINT_NAMES, POSE_BEND, createBody } from '../src/body/index.js';

const EXPECTED_JOINTS = [
  'neck',
  'waist',
  'shoulderL',
  'shoulderR',
  'elbowL',
  'elbowR',
  'wristL',
  'wristR',
  'hipL',
  'hipR',
  'kneeL',
  'kneeR',
  'ankleL',
  'ankleR',
];

function findMesh(root, name) {
  return root.getObjectByName(name);
}

function assertOutward(geo, label) {
  const pos = geo.attributes.position;
  const index = geo.index;
  const centroid = new Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    centroid.x += pos.getX(i);
    centroid.y += pos.getY(i);
    centroid.z += pos.getZ(i);
  }
  centroid.multiplyScalar(1 / pos.count);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(pos, index.getX(i));
    b.fromBufferAttribute(pos, index.getX(i + 1));
    c.fromBufferAttribute(pos, index.getX(i + 2));
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    if (normal.lengthSq() < 1e-12) continue;
    const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    assert.ok(normal.dot(mid.sub(centroid)) > 0, `${label} face ${i / 3} points inward`);
  }
}

describe('createBody', () => {
  it('exposes exactly fourteen joints in the mannequin hierarchy', () => {
    const body = createBody();
    assert.equal(typeof body.update, 'function');
    assert.equal(typeof body.setParams, 'function');
    assert.equal(body.root.name, 'root');
    assert.deepEqual([...JOINT_NAMES], EXPECTED_JOINTS);
    assert.deepEqual(Object.keys(body.joints).sort(), [...EXPECTED_JOINTS].sort());
    assert.equal(JOINT_NAMES.length, 14);

    const { joints, pelvis } = body;
    assert.equal(pelvis.parent, body.root);
    assert.equal(pelvis.name, 'pelvis');
    assert.equal(joints.waist.parent, pelvis);
    assert.equal(joints.neck.parent, joints.waist);
    assert.equal(findMesh(body.root, 'headMesh').parent, joints.neck);

    assert.equal(joints.shoulderL.parent, joints.waist);
    assert.equal(joints.elbowL.parent, joints.shoulderL);
    assert.equal(joints.wristL.parent, joints.elbowL);
    assert.equal(findMesh(body.root, 'handLMesh').parent, joints.wristL);

    assert.equal(joints.hipL.parent, pelvis);
    assert.equal(joints.kneeL.parent, joints.hipL);
    assert.equal(joints.ankleL.parent, joints.kneeL);
    assert.equal(findMesh(body.root, 'footLMesh').parent, joints.ankleL);

    assert.equal(joints.shoulderR.parent, joints.waist);
    assert.equal(joints.hipR.parent, pelvis);
    assert.equal(findMesh(body.root, 'clavicleMesh'), undefined);
    assert.equal(findMesh(body.root, 'clavicle'), undefined);
    assert.equal(body.joints.clavicle, undefined);
    assert.equal(body.joints.head, undefined);
    assert.equal(body.joints.spine, undefined);
  });

  it('uses flush smooth spheres and keeps the blocks and paddles low-poly', () => {
    const body = createBody();
    const stats = body.getStats();
    const spec = body.getResolved();

    assert.equal(stats.roles.ball, 14);
    assert.equal(stats.roles.cylinder, 9);
    assert.equal(stats.roles.frustum, 2);
    assert.equal(stats.roles.paddle, 2);
    assert.equal(stats.roles.foot, 2);
    assert.equal(stats.roles.head, 1);
    assert.equal(stats.meshes, 30);
    assert.equal(stats.cylinderSides, 8);
    assert.equal(stats.jointWidth, 24);
    assert.equal(stats.jointHeight, 16);

    const elbow = findMesh(body.root, 'elbowLMesh');
    const upper = findMesh(body.root, 'upperArmLMesh');
    const forearm = findMesh(body.root, 'forearmLMesh');
    const shoulder = findMesh(body.root, 'shoulderLMesh');
    const wrist = findMesh(body.root, 'wristLMesh');
    const hip = findMesh(body.root, 'hipLMesh');
    const thigh = findMesh(body.root, 'thighLMesh');
    const knee = findMesh(body.root, 'kneeLMesh');
    const shin = findMesh(body.root, 'shinLMesh');
    const ankle = findMesh(body.root, 'ankleLMesh');
    const neck = findMesh(body.root, 'neckMesh');
    const tube = findMesh(body.root, 'neckTube');
    const waist = findMesh(body.root, 'waistMesh');
    const chest = findMesh(body.root, 'chestMesh');
    const pelvis = findMesh(body.root, 'pelvisMesh');
    const head = findMesh(body.root, 'headMesh');
    const foot = findMesh(body.root, 'footLMesh');
    const hand = findMesh(body.root, 'handLMesh');

    assert.equal(elbow.geometry.type, 'SphereGeometry');
    assert.equal(elbow.geometry.parameters.widthSegments, 24);
    assert.equal(elbow.geometry.parameters.heightSegments, 16);
    assert.equal(elbow.material.flatShading, false);
    assert.equal(upper.material.flatShading, true);
    assert.equal(chest.material.flatShading, false);
    assert.equal(pelvis.material.flatShading, false);
    assert.equal(head.material, upper.material);
    assert.equal(head.material.flatShading, true);
    assert.equal(head.geometry.type, 'LatheGeometry');
    assert.equal(head.geometry.parameters.segments, 8);
    assert.equal(head.geometry.parameters.points.length, 9);
    assert.equal(chest.material, elbow.material);
    assert.equal(foot.material, elbow.material);
    assert.equal(upper.material.flatShading, true);
    assert.notEqual(upper.material, chest.material);
    assert.equal(chest.geometry.userData.bevelSegments, 2);
    assert.ok(chest.geometry.userData.bevelRadius > 0.008 && chest.geometry.userData.bevelRadius < 0.04);
    assert.ok(chest.geometry.getAttribute('position').count < 120);
    let blended = 0;
    const chestN = chest.geometry.getAttribute('normal');
    for (let i = 0; i < chestN.count; i += 1) {
      const ax = Math.abs(chestN.getX(i));
      const ay = Math.abs(chestN.getY(i));
      const az = Math.abs(chestN.getZ(i));
      if (ax > 0.2 && ay > 0.2) blended += 1;
      if (az > 0.2 && ay > 0.2) blended += 1;
    }
    assert.ok(blended > 8, 'bevel normals tilt between the face and the side');

    assert.equal(upper.geometry.parameters.radiusTop, shoulder.geometry.parameters.radius);
    assert.equal(upper.geometry.parameters.radiusBottom, elbow.geometry.parameters.radius);
    assert.equal(forearm.geometry.parameters.radiusTop, elbow.geometry.parameters.radius);
    assert.equal(forearm.geometry.parameters.radiusBottom, wrist.geometry.parameters.radius);
    assert.equal(thigh.geometry.parameters.radiusTop, hip.geometry.parameters.radius);
    assert.equal(thigh.geometry.parameters.radiusBottom, knee.geometry.parameters.radius);
    assert.equal(shin.geometry.parameters.radiusTop, knee.geometry.parameters.radius);
    assert.equal(shin.geometry.parameters.radiusBottom, ankle.geometry.parameters.radius);
    assert.equal(tube.geometry.parameters.radiusTop, neck.geometry.parameters.radius);
    assert.equal(tube.geometry.parameters.radiusBottom, neck.geometry.parameters.radius);
    assert.equal(tube.geometry.parameters.openEnded, true);
    assert.equal(tube.geometry.parameters.radialSegments, 8);
    assert.ok(upper.geometry.parameters.radiusTop > upper.geometry.parameters.radiusBottom);

    const waistD = waist.geometry.parameters.radius * 2;
    assert.ok(Math.abs(chest.geometry.userData.bottomWidth - waistD) < 1e-6);
    assert.ok(Math.abs(chest.geometry.userData.bottomDepth - waistD) < 1e-6);
    assert.ok(Math.abs(pelvis.geometry.userData.topWidth - waistD) < 1e-6);
    assert.ok(Math.abs(pelvis.geometry.userData.topDepth - waistD) < 1e-6);
    assert.ok(chest.geometry.userData.topWidth > chest.geometry.userData.bottomWidth * 1.6);
    assert.ok(pelvis.geometry.userData.bottomWidth > pelvis.geometry.userData.topWidth * 1.15);
    assert.ok(chest.geometry.userData.topDepth > chest.geometry.userData.bottomDepth);

    const headPos = head.geometry.attributes.position;
    let maxH = 0;
    let yAtMax = 0;
    let maxY = -Infinity;
    let minY = Infinity;
    let ring = 0;
    let ringX = 0;
    let ringZ = 0;
    for (let i = 0; i < headPos.count; i += 1) {
      const x = headPos.getX(i);
      const y = headPos.getY(i);
      const z = headPos.getZ(i);
      const h = Math.hypot(x, z);
      if (h > maxH) {
        maxH = h;
        yAtMax = y;
      }
      if (y > maxY) maxY = y;
      if (y < minY) minY = y;
      if (Math.abs(y - spec.headNeckY) < 1e-4) {
        ring += 1;
        ringX = Math.max(ringX, Math.abs(x));
        ringZ = Math.max(ringZ, Math.abs(z));
      }
    }
    assert.ok(yAtMax > 0, 'the lathe is widest above its origin');
    assert.ok(Math.abs(maxY - spec.headRy) < 1e-4);
    assert.ok(minY < spec.headNeckY, 'the chin tip tucks below the neck ring');
    assert.ok(ring >= 8);
    assert.ok(Math.abs(ringX - spec.radii.neck) < 1e-3, 'chin ring matches the neck in width');
    assert.ok(Math.abs(ringZ / spec.radii.neck - 1.08) < 1e-3, 'chin ring keeps the iso depth scale');
    assert.equal(head.userData.role, 'head');
    let heads = 0;
    body.root.traverse((obj) => {
      if (obj.isMesh && obj.userData.role === 'head') heads += 1;
    });
    assert.equal(heads, 1, 'the head is a single faceless lathe');

    assert.equal(hand.userData.role, 'paddle');
    assert.equal(foot.geometry.type, 'SphereGeometry');
    assert.ok(foot.scale.z > foot.scale.x && foot.scale.x > foot.scale.y);
    const handPos = hand.geometry.attributes.position;
    for (let i = 0; i < 6; i += 1) {
      const d = Math.hypot(handPos.getX(i), handPos.getY(i), handPos.getZ(i));
      assert.ok(d < spec.radii.wrist, 'paddle base sits inside the wrist ball');
    }
    assert.ok(hand.rotation.z > 0.1, 'left paddle turns inward');
    assert.ok(findMesh(body.root, 'handRMesh').rotation.z < -0.1);

    assert.equal(stats.vertices, 6489);
    assert.equal(stats.triangles, 10828);
  });

  it('plants the feet, fits the crown to the height, and keeps the neck short', () => {
    const body = createBody();
    const spec = body.getResolved();
    assert.ok(Math.abs(spec.layout.crownY - spec.height) < 1e-6);
    assert.ok(spec.visibleNeck > 0.035 && spec.visibleNeck < 0.07);

    body.update(0, { mode: 'idle', time: 0, freeze: true });
    body.root.updateMatrixWorld(true);

    const head = findMesh(body.root, 'headMesh');
    const headWorld = new Vector3();
    head.getWorldPosition(headWorld);
    assert.ok(Math.abs(headWorld.y + spec.headRy - spec.height) < 1e-3);

    const neck = new Vector3();
    body.joints.neck.getWorldPosition(neck);
    const socketY = headWorld.y + spec.headNeckY;
    assert.ok(socketY - neck.y > 0.03 && socketY - neck.y < 0.07);

    for (const name of ['footLHeel', 'footLToe', 'footRHeel', 'footRToe']) {
      const y = findMesh(body.root, name).getWorldPosition(new Vector3()).y;
      assert.ok(y >= -1e-4, `${name} is not below the ground`);
    }
    const heel = findMesh(body.root, 'footLHeel').getWorldPosition(new Vector3());
    const toe = findMesh(body.root, 'footLToe').getWorldPosition(new Vector3());
    assert.ok(Math.abs(Math.min(heel.y, toe.y)) < 1e-3);
    assert.ok(toe.z > heel.z);
    assert.ok(Math.abs(spec.footHeel) < spec.footToe - spec.footLength * 0.15);

    const shorter = createBody({ height: 1.5 });
    assert.ok(Math.abs(shorter.getResolved().layout.crownY - 1.5) < 1e-6);
  });

  it('keeps joint objects stable and treats shoulder width as ball-centre distance', () => {
    const body = createBody();
    const elbow = body.joints.elbowL;
    const shoulder = body.joints.shoulderL;
    body.root.updateMatrixWorld(true);

    const left = new Vector3();
    const right = new Vector3();
    body.joints.shoulderL.getWorldPosition(left);
    body.joints.shoulderR.getWorldPosition(right);
    assert.ok(Math.abs(left.distanceTo(right) - body.getResolved().shoulderWidth) < 1e-4);
    assert.ok(left.y > body.joints.waist.getWorldPosition(new Vector3()).y);

    const headGeo = findMesh(body.root, 'headMesh').geometry.uuid;
    body.setParams({ skinColor: '#112233' });
    assert.equal(findMesh(body.root, 'headMesh').geometry.uuid, headGeo);
    assert.equal(findMesh(body.root, 'headMesh').material.color.getHexString(), '112233');
    assert.equal(findMesh(body.root, 'chestMesh').material.color.getHexString(), '112233');

    body.setParams({ shoulderWidth: 0.55, hipWidth: 0.24 });
    assert.equal(body.joints.elbowL, elbow);
    assert.equal(body.joints.shoulderL, shoulder);
    assert.equal(body.joints.shoulderL.parent, body.joints.waist);
    body.root.updateMatrixWorld(true);
    body.joints.shoulderL.getWorldPosition(left);
    body.joints.shoulderR.getWorldPosition(right);
    assert.ok(Math.abs(left.distanceTo(right) - 0.55) < 1e-4);
    body.joints.hipL.getWorldPosition(left);
    body.joints.hipR.getWorldPosition(right);
    assert.ok(Math.abs(left.distanceTo(right) - 0.24) < 1e-4);
    assert.equal(body.getStats().meshes, 30);
    assert.equal(findMesh(body.root, 'clavicleMesh'), undefined);
  });

  it('bends elbows and knees 120 degrees and walks without blowing up', () => {
    const body = createBody();
    assert.ok(Math.abs((POSE_BEND * 180) / Math.PI - 120) < 1e-6);

    body.update(0, { mode: 'pose', time: 0, freeze: true });
    assert.ok(Math.abs(body.joints.elbowL.rotation.x + POSE_BEND) < 1e-6);
    assert.ok(Math.abs(body.joints.elbowR.rotation.x + POSE_BEND) < 1e-6);
    assert.ok(Math.abs(body.joints.kneeL.rotation.x - POSE_BEND) < 1e-6);
    assert.ok(Math.abs(body.joints.kneeR.rotation.x - POSE_BEND) < 1e-6);
    assert.ok(Math.hypot(body.joints.shoulderL.rotation.x, body.joints.shoulderL.rotation.z) > 1);
    assert.ok(body.joints.shoulderL.rotation.z < 0);
    assert.ok(body.joints.shoulderR.rotation.z > 0);
    assert.ok(body.joints.shoulderL.rotation.x < -0.8);
    assert.equal(body.joints.wristL.rotation.x, 0);

    body.update(0, { mode: 'walk', time: 0.4, freeze: true });
    const knees = Math.abs(body.joints.kneeL.rotation.x) + Math.abs(body.joints.kneeR.rotation.x);
    const hips = Math.abs(body.joints.hipL.rotation.x) + Math.abs(body.joints.hipR.rotation.x);
    assert.ok(knees > 0.2);
    assert.ok(hips > 0.2);
    assert.notEqual(Math.sign(body.joints.shoulderL.rotation.x), Math.sign(body.joints.hipL.rotation.x));

    for (let i = 0; i < 90; i += 1) body.update(1 / 60, 'walk');
    body.root.traverse((obj) => {
      assert.ok(Number.isFinite(obj.position.x + obj.position.y + obj.position.z));
      assert.ok(Number.isFinite(obj.rotation.x + obj.rotation.y + obj.rotation.z));
    });
    for (const name of ['footLHeel', 'footLToe', 'footRHeel', 'footRToe']) {
      const y = findMesh(body.root, name).getWorldPosition(new Vector3()).y;
      assert.ok(y >= -1e-3, `${name} stays on the ground while walking`);
    }
  });

  it('winds the chest, pelvis, and paddles outward', () => {
    const body = createBody();
    assertOutward(findMesh(body.root, 'chestMesh').geometry, 'chest');
    assertOutward(findMesh(body.root, 'pelvisMesh').geometry, 'pelvis');
    assertOutward(findMesh(body.root, 'handLMesh').geometry, 'hand');
  });
});
