import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { POSE_BEND, createBody } from '../src/body/index.js';

const MESH_NAMES = [
  'headMesh',
  'neckMesh',
  'clavicleMesh',
  'torsoMesh',
  'pelvisMesh',
  'shoulderLMesh',
  'shoulderRMesh',
  'upperArmLMesh',
  'upperArmRMesh',
  'elbowLMesh',
  'elbowRMesh',
  'forearmLMesh',
  'forearmRMesh',
  'wristLMesh',
  'wristRMesh',
  'handLMesh',
  'handRMesh',
  'hipLMesh',
  'hipRMesh',
  'thighLMesh',
  'thighRMesh',
  'kneeLMesh',
  'kneeRMesh',
  'shinLMesh',
  'shinRMesh',
  'ankleLMesh',
  'ankleRMesh',
  'footLMesh',
  'footRMesh',
];

function meshNames(root) {
  const names = [];
  root.traverse((obj) => {
    if (obj.isMesh) names.push(obj.name);
  });
  return names.sort();
}

function worldDistance(a, b) {
  const av = new Vector3();
  const bv = new Vector3();
  a.getWorldPosition(av);
  b.getWorldPosition(bv);
  return av.distanceTo(bv);
}

describe('createBody', () => {
  it('returns the public api and a stable joint hierarchy', () => {
    const body = createBody();
    assert.equal(typeof body.update, 'function');
    assert.equal(typeof body.setParams, 'function');
    assert.equal(body.root.name, 'root');
    const { joints } = body;

    assert.equal(joints.head.parent, joints.neck);
    assert.equal(joints.neck.parent, joints.spine);
    assert.equal(joints.spine.parent, joints.hips);
    assert.equal(joints.hips.parent, joints.root);

    assert.equal(joints.clavicle.parent, joints.spine);
    assert.equal(joints.shoulderL.parent, joints.clavicle);
    assert.equal(joints.elbowL.parent, joints.shoulderL);
    assert.equal(joints.wristL.parent, joints.elbowL);
    assert.equal(body.root.getObjectByName('handLMesh').parent, joints.wristL);

    assert.equal(joints.hipL.parent, joints.hips);
    assert.equal(joints.kneeL.parent, joints.hipL);
    assert.equal(joints.ankleL.parent, joints.kneeL);
    assert.equal(body.root.getObjectByName('footLMesh').parent, joints.ankleL);

    assert.equal(joints.shoulderR.parent, joints.clavicle);
    assert.equal(joints.hipR.parent, joints.hips);
    assert.deepEqual(meshNames(body.root), [...MESH_NAMES].sort());
  });

  it('builds the drawing primitives and keeps joint balls larger than their limbs', () => {
    const body = createBody();
    const stats = body.getStats();
    const resolved = body.getResolved();

    assert.equal(stats.roles.ball, 13);
    assert.equal(stats.roles.cylinder, 10);
    assert.equal(stats.roles.box, 5);
    assert.equal(stats.roles.trapezoid, 1);
    assert.equal(stats.sphereDetail, 1);
    assert.equal(stats.cylinderSides, 8);
    assert.ok(stats.vertices > 400 && stats.vertices < 2000);
    assert.ok(stats.triangles > 400 && stats.triangles < 3000);

    const head = body.root.getObjectByName('headMesh');
    const clavicle = body.root.getObjectByName('clavicleMesh');
    const torso = body.root.getObjectByName('torsoMesh');
    const pelvis = body.root.getObjectByName('pelvisMesh');
    assert.equal(head.geometry.parameters.detail, 1);
    assert.equal(clavicle.geometry.parameters.radialSegments, 8);
    assert.equal(clavicle.geometry.parameters.openEnded, true);
    assert.equal(torso.userData.role, 'box');
    assert.equal(pelvis.userData.role, 'trapezoid');
    assert.notEqual(pelvis.geometry.userData.topWidth, pelvis.geometry.userData.bottomWidth);

    for (const [joint, cover] of Object.entries(resolved.cover)) {
      const circum = joint === 'neck' ? resolved.headRadius : resolved.radii[joint];
      const inscribed = circum * resolved.inradiusRatio;
      assert.ok(inscribed > cover * 1.02, `${joint} ball covers its limb`);
    }

    const wristIn = resolved.radii.wrist * resolved.inradiusRatio;
    const hand = body.root.getObjectByName('handLMesh');
    const hw = hand.geometry.parameters.width / 2;
    const hh = hand.geometry.parameters.height / 2;
    const hd = hand.geometry.parameters.depth / 2;
    const topY = hand.position.y + hh;
    assert.ok(Math.hypot(hw, topY, hd) < wristIn);
  });

  it('plants the feet, fits the height, and puts the ankle over the heel', () => {
    const body = createBody();
    body.update(0, { mode: 'idle', time: 0, freeze: true });
    body.root.updateMatrixWorld(true);

    const resolved = body.getResolved();
    assert.ok(Math.abs(resolved.layout.crownY - resolved.height) < 1e-6);

    const head = new Vector3();
    body.joints.head.getWorldPosition(head);
    assert.ok(Math.abs(head.y + resolved.headRadius - resolved.height) < 1e-3);

    for (const name of ['footLHeel', 'footLToe', 'footRHeel', 'footRToe']) {
      const y = body.root.getObjectByName(name).getWorldPosition(new Vector3()).y;
      assert.ok(y >= -1e-4, `${name} is not below the ground`);
    }
    const heel = body.root.getObjectByName('footLHeel').getWorldPosition(new Vector3());
    const toe = body.root.getObjectByName('footLToe').getWorldPosition(new Vector3());
    assert.ok(Math.abs(Math.min(heel.y, toe.y)) < 1e-3);
    assert.ok(toe.z > heel.z);
    assert.ok(resolved.footCenterZ > resolved.footLength * 0.15);
  });

  it('treats shoulder width as the clavicle length and keeps joint objects stable', () => {
    const body = createBody();
    const elbow = body.joints.elbowL;
    const shoulder = body.joints.shoulderL;
    body.root.updateMatrixWorld(true);
    const before = worldDistance(body.joints.shoulderL, body.joints.shoulderR);
    assert.ok(Math.abs(before - body.getResolved().shoulderWidth) < 1e-4);

    body.setParams({ shoulderWidth: 0.62, hipWidth: 0.36, skinColor: '#112233' });
    assert.equal(body.joints.elbowL, elbow);
    assert.equal(body.joints.shoulderL, shoulder);
    assert.equal(body.joints.shoulderL.parent, body.joints.clavicle);

    const clavicle = body.root.getObjectByName('clavicleMesh');
    assert.ok(Math.abs(clavicle.geometry.parameters.height - 0.62) < 1e-6);
    body.root.updateMatrixWorld(true);
    assert.ok(Math.abs(worldDistance(body.joints.shoulderL, body.joints.shoulderR) - 0.62) < 1e-4);
    assert.ok(Math.abs(worldDistance(body.joints.hipL, body.joints.hipR) - 0.36) < 1e-4);
    assert.equal(body.root.getObjectByName('headMesh').material.color.getHexString(), '112233');
    assert.equal(body.getStats().meshes, 29);
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
  });

  it('winds the pelvis so every face points outward', () => {
    const body = createBody();
    const geo = body.root.getObjectByName('pelvisMesh').geometry;
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
      const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
      assert.ok(normal.dot(mid.sub(centroid)) > 0, `pelvis face ${i / 3} points inward`);
    }
  });
});
