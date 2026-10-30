import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DoubleSide, Raycaster, Vector3 } from 'three';
import {
  ANIMATIONS,
  createBody,
  createCharacter,
  defaultDocument,
  getRegistry,
} from '../src/body/index.js';
import { clothPad, pointInsideShell } from '../src/character/clothing.js';
import { applyPreset } from '../src/character/presets.js';

const BODY = [
  'chestMesh', 'pelvisMesh', 'waistMesh', 'headMesh',
  'upperArmLMesh', 'upperArmRMesh', 'forearmLMesh', 'forearmRMesh',
  'thighLMesh', 'thighRMesh', 'shinLMesh', 'shinRMesh',
  'footLMesh', 'footRMesh',
];

function wear(mutate) {
  const doc = defaultDocument();
  mutate(doc);
  return createCharacter(doc);
}

function garments(root) {
  const found = [];
  root.traverse((obj) => {
    if (obj.userData?.garment) found.push(obj);
  });
  return found;
}

function assertBodyStays(character) {
  for (const name of BODY) {
    assert.ok(character.root.getObjectByName(name), name);
  }
}

function assertClosedShell(mesh) {
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of list) {
    assert.equal(material.side, DoubleSide, mesh.name);
    assert.equal(material.polygonOffset, false, mesh.name);
  }
  const tris = mesh.geometry.index.count / 3;
  assert.ok(tris >= 10, `${mesh.name} has ${tris} tris`);
  mesh.geometry.computeBoundingBox();
  const size = mesh.geometry.boundingBox.getSize(new Vector3());
  assert.ok(size.x > 0.02 && size.y > 0.02 && size.z > 0.02, `${mesh.name} is a volume`);
}

function bboxOf(mesh) {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox;
}

/** Highest triangle whose XZ footprint contains the point, in mesh-local space. */
function coverFromAbove(mesh, x, z) {
  const pos = mesh.geometry.attributes.position;
  const index = mesh.geometry.index;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  let best = null;
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(pos, index.getX(i));
    b.fromBufferAttribute(pos, index.getX(i + 1));
    c.fromBufferAttribute(pos, index.getX(i + 2));
    const denom = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(denom) < 1e-10) continue;
    const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / denom;
    const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / denom;
    const w = 1 - u - v;
    if (u < -1e-4 || v < -1e-4 || w < -1e-4) continue;
    const y = a.y * u + b.y * v + c.y * w;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;
    const acx = c.x - a.x;
    const acy = c.y - a.y;
    const acz = c.z - a.z;
    const ny = abz * acx - abx * acz;
    if (!best || y > best.y) best = { y, ny };
  }
  return best;
}

function assertTorsoShell(character, meshName = 'clothingTop') {
  const spec = character.getResolved();
  const mesh = character.root.getObjectByName(meshName);
  const shell = mesh.userData.shell;
  const ease = shell.ease;
  const sx = spec.shoulderWidth / 2;
  const ball = spec.radii.shoulder;
  assert.ok(Math.abs(shell.hx - (spec.chestTopWidth / 2 + ease + shell.extra)) < 1e-6, `${meshName} uses the chest width`);
  assert.ok(shell.hx < sx + ball * 0.5, `${meshName} stops short of the outer shoulder ball`);
  assert.equal(coverFromAbove(mesh, 0, 0), null, 'neck hole stays open');
  const samples = [
    [spec.chestTopWidth * 0.35, 0],
    [-spec.chestTopWidth * 0.35, 0],
    [0, -spec.chestTopDepth * 0.3],
    [shell.hx * 0.82, 0],
    [-shell.hx * 0.82, 0],
  ];
  if (!shell.openFront) samples.push([0, spec.chestTopDepth * 0.3]);
  for (const [x, z] of samples) {
    const hit = coverFromAbove(mesh, x, z);
    assert.ok(hit, `${meshName} roof covers ${x.toFixed(3)}, ${z.toFixed(3)}`);
    assert.ok(hit.ny > 0, `${meshName} roof faces up at ${x.toFixed(3)}, ${z.toFixed(3)}`);
    assert.ok(hit.y > spec.chestHeight * spec.shoulderT, `${meshName} roof clears the shoulder joint`);
  }
  assert.ok(shell.yNeck - shell.ySide > 0.025, `${meshName} shoulder line slopes`);
  const neck = coverFromAbove(mesh, spec.radii.neck * 1.8, 0);
  const side = coverFromAbove(mesh, shell.hx * 0.82, 0);
  assert.ok(neck && side && neck.y > side.y + 0.015, `${meshName} is higher at the neck than at the shoulder`);
  assert.equal(coverFromAbove(mesh, sx + ball * 0.85, 0), null, 'outer shoulder ball is not in the torso');
  assert.equal(coverFromAbove(mesh, -(sx + ball * 0.85), 0), null, 'outer shoulder ball is not in the torso');
}

const SPAN = {
  idle: 1.6,
  walk: 2.2,
  run: 1.6,
  jump: 1.6,
  crouch: 1.6,
  slap: 0.7,
  hit: 0.8,
  'hit-r': 0.8,
  knockdown: 2.5,
  knockback: 2.5,
  pose: 0.08,
  robot: 6.6,
  chicken: 6.6,
  disco: 6.6,
  sprinkler: 6.6,
  flail: 6.6,
  hula: 7.4,
  flex: 1.7,
  mbappe: 12,
};

function sleeveCoversBall(sleeve, ball, margin) {
  const pos = ball.geometry.attributes.position;
  const radius = ball.geometry.parameters.radius;
  const info = sleeve.userData.sleeve;
  const half = (info.yTop - info.yBottom) / 2;
  const local = new Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    local.fromBufferAttribute(pos, i);
    if (local.lengthSq() > 1e-10) local.multiplyScalar(1 + margin / radius);
    ball.localToWorld(local);
    sleeve.worldToLocal(local);
    if (Math.hypot(local.x, local.z) > info.inscribed - 1e-4) return false;
    if (Math.abs(local.y) > half - 1e-4) return false;
  }
  return true;
}

function ballLeavesShell(shellMesh, ball) {
  const pos = ball.geometry.attributes.position;
  const local = new Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    local.fromBufferAttribute(pos, i);
    ball.localToWorld(local);
    shellMesh.worldToLocal(local);
    if (!pointInsideShell(shellMesh.userData.shell, local.x, local.y, local.z, 0)) return true;
  }
  return false;
}

function originInsideShell(shellMesh, joint, margin) {
  const local = joint.getWorldPosition(new Vector3());
  shellMesh.worldToLocal(local);
  return pointInsideShell(shellMesh.userData.shell, local.x, local.y, local.z, margin);
}

const raycaster = new Raycaster();
const rayOrigin = new Vector3();
const rayDir = new Vector3();

function sleeveMeshCovers(sleeve, ball) {
  const pos = ball.geometry.attributes.position;
  const info = sleeve.userData.sleeve;
  const radius = ball.geometry.parameters.radius;
  const center = ball.getWorldPosition(new Vector3());
  raycaster.near = 0;
  raycaster.far = Math.max(info.yTop - info.yBottom, info.radius) + 0.02;
  const step = Math.max(1, Math.floor(pos.count / 10));
  const shift = new Vector3();
  for (let i = 0; i < pos.count; i += step) {
    rayOrigin.fromBufferAttribute(pos, i);
    if (rayOrigin.lengthSq() < 1e-10) continue;
    rayDir.copy(rayOrigin).normalize();
    rayOrigin.multiplyScalar(1 + 0.002 / radius);
    // A ray along a shared 8-gon edge falls between the two faces.
    shift.set(-rayDir.z, 0, rayDir.x);
    if (shift.lengthSq() < 1e-8) shift.set(1, 0, 0);
    rayOrigin.add(shift.normalize().multiplyScalar(0.002));
    ball.localToWorld(rayOrigin);
    rayDir.transformDirection(ball.matrixWorld);
    raycaster.set(rayOrigin, rayDir);
    const hits = raycaster.intersectObject(sleeve, false);
    if (hits.length === 0) return false;
    const outward = rayOrigin.clone().sub(center);
    if (hits[0].point.clone().sub(center).dot(outward) <= 0) return false;
  }
  return true;
}

function shellsOf(character) {
  return ['clothingTop', 'clothingOuter']
    .map((name) => character.root.getObjectByName(name))
    .filter((mesh) => mesh?.userData.shell);
}

function sleevesOn(character, side) {
  return ['clothingTop', 'clothingOuter']
    .map((prefix) => character.root.getObjectByName(`${prefix}Upper${side}`))
    .filter(Boolean);
}

/**
 * Shoulder balls stay inside their sleeves, and each sleeve stays shut
 * against the torso shell. The shoulder joint does not translate, so a
 * shell that contains the joint and a sleeve that contains the ball cannot
 * open a skin gap when the arm rotates. Sampling still runs every clip.
 */
function chestUnderTop(character) {
  const chest = character.root.getObjectByName('chestMesh');
  const top = character.root.getObjectByName('clothingTop');
  if (!chest || !top?.userData.shell) return true;
  const pos = chest.geometry.attributes.position;
  const local = new Vector3();
  const shell = top.userData.shell;
  for (let i = 0; i < pos.count; i += 1) {
    local.fromBufferAttribute(pos, i);
    chest.localToWorld(local);
    top.worldToLocal(local);
    if (Math.hypot(local.x, local.z) < shell.neckR * 1.15 && local.y > shell.ySide) continue;
    if (!pointInsideShell(shell, local.x, local.y, local.z, 0)) return false;
  }
  return true;
}

function assertSleevesSealed(character, label) {
  character.root.updateMatrixWorld(true);
  const shells = shellsOf(character);
  assert.ok(shells.length > 0, `${label} has a torso shell`);
  let sleeves = 0;
  let raised = 0;
  for (const side of ['L', 'R']) {
    const ball = character.root.getObjectByName(`shoulder${side}Mesh`);
    const joint = character.joints[`shoulder${side}`];
    assert.equal(ball.userData.segment, `upperArm${side}`);
    assert.equal(ball.parent, joint);
    const fitted = sleevesOn(character, side);
    if (fitted.length === 0) continue;
    sleeves += fitted.length;
    for (const sleeve of fitted) {
      assert.equal(sleeve.parent, joint, `${label} ${sleeve.name}`);
      assert.equal(sleeve.geometry.parameters.openEnded, false);
      assert.equal(sleeve.geometry.parameters.radiusTop, sleeve.userData.sleeve.radius);
      assert.ok(sleeveCoversBall(sleeve, ball, 0.003), `${label} ${sleeve.name} contains the ball`);
      assert.ok(sleeveMeshCovers(sleeve, ball), `${label} ${sleeve.name} mesh covers the ball`);
    }
    if (fitted.length === 2) {
      const pos = fitted[0].geometry.attributes.position;
      const local = new Vector3();
      const outer = fitted[1];
      const info = outer.userData.sleeve;
      const half = (info.yTop - info.yBottom) / 2;
      for (let i = 0; i < pos.count; i += 1) {
        local.fromBufferAttribute(pos, i);
        fitted[0].localToWorld(local);
        outer.worldToLocal(local);
        assert.ok(Math.hypot(local.x, local.z) < info.inscribed - 1e-4, `${label} outer sleeve clears the inner one`);
        assert.ok(Math.abs(local.y) < half - 1e-4, `${label} outer sleeve caps the inner one`);
      }
    }
    assert.ok(ballLeavesShell(shells[0], ball), `${label} torso does not swallow the ${side} ball`);
  }
  assert.ok(sleeves > 0, `${label} has a sleeve`);
  assert.ok(chestUnderTop(character), `${label} chest sits inside the top`);
  for (const shell of shells) {
    for (const side of ['L', 'R']) {
      if (sleevesOn(character, side).length === 0) continue;
      assert.ok(originInsideShell(shell, character.joints[`shoulder${side}`], 0.003), `${label} ${shell.name} closes on ${side}`);
    }
  }

  for (const item of ANIMATIONS) {
    const seconds = SPAN[item.id] || 1.5;
    const frames = Math.max(2, Math.round(seconds * 10));
    const dt = seconds / frames;
    const styles = item.kind === 'move' ? ['normal', 'stomp', 'swagger'] : [null];
    for (const walkStyle of styles) {
      for (let frame = 0; frame < frames; frame += 1) {
        character.update(dt, {
          anim: item.id,
          speed: item.speed,
          ...(walkStyle ? { walkStyle } : {}),
        });
        character.root.updateMatrixWorld(true);
        for (const side of ['L', 'R']) {
          const ball = character.root.getObjectByName(`shoulder${side}Mesh`);
          const joint = character.joints[`shoulder${side}`];
          raised = Math.max(raised, Math.abs(joint.rotation.x), Math.abs(joint.rotation.z));
          const fitted = sleevesOn(character, side);
          if (fitted.length === 0) continue;
          for (const sleeve of fitted) {
            assert.equal(sleeve.parent, joint);
            assert.ok(sleeveCoversBall(sleeve, ball, 0.003), `${label} ${item.id} ${sleeve.name}`);
            if (frame % 4 === 0) {
              assert.ok(sleeveMeshCovers(sleeve, ball), `${label} ${item.id} mesh ${sleeve.name}`);
            }
          }
          for (const shell of shells) {
            assert.ok(
              originInsideShell(shell, joint, 0.003),
              `${label} ${item.id} ${shell.name} ${side}`,
            );
          }
          if (frame % 4 === 0) {
            assert.ok(chestUnderTop(character), `${label} ${item.id} chest stays covered`);
          }
        }
      }
    }
  }
  assert.ok(raised > 1, `${label} sampled a raised arm (${raised.toFixed(2)})`);
}

function playAll(character) {
  const world = new Vector3();
  for (const item of ANIMATIONS) {
    for (let step = 0; step < 4; step += 1) {
      character.update(1 / 30, { anim: item.id, speed: item.speed });
      character.root.updateMatrixWorld(true);
      character.root.traverse((obj) => {
        assert.ok(Number.isFinite(obj.position.y + obj.quaternion.w), item.id);
      });
      for (const name of ['footLHeel', 'footLToe', 'footRHeel', 'footRToe']) {
        const y = character.root.getObjectByName(name).getWorldPosition(world).y;
        if (item.kind !== 'jump' && item.id !== 'knockdown' && item.id !== 'knockback') {
          assert.ok(y >= -2e-3, `${item.id} ${name}`);
        }
      }
      for (const mesh of garments(character.root)) {
        assert.equal(mesh.parent.userData.joint || mesh.parent === character.pelvis, true, mesh.name);
      }
    }
  }
}

function assertRides(character, meshName, anim, time) {
  const mesh = character.root.getObjectByName(meshName);
  assert.ok(mesh, meshName);
  const local = mesh.position.clone();
  character.update(0, { anim, time, speed: anim === 'disco' ? 1 : 1.6, freeze: true });
  character.root.updateMatrixWorld(true);
  assert.ok(mesh.position.distanceTo(local) < 1e-8, `${meshName} stays on its joint`);
  const expected = local.clone().applyMatrix4(mesh.parent.matrixWorld);
  const actual = mesh.getWorldPosition(new Vector3());
  assert.ok(actual.distanceTo(expected) < 1e-4, `${anim} ${meshName}`);
}

describe('clothing compositor', () => {
  it('keeps the naked default at 1421 and adds nothing', () => {
    const naked = createBody();
    const character = createCharacter();
    assert.equal(character.getStats().vertices, 1421);
    assert.equal(character.getStats().triangles, 1868);
    assert.deepEqual(character.getStats().roles, naked.getStats().roles);
    assert.equal(garments(character.root).length, 0);
    assertBodyStays(character);
  });

  it('wears a tee over the body, with sleeves on the shoulders', () => {
    const character = wear((doc) => {
      doc.clothing.top = { id: 'tee', color: '#3a5a40' };
    });
    assertBodyStays(character);
    const spec = character.getResolved();
    const top = character.joints.waist.getObjectByName('clothingTop');
    assert.equal(top.parent, character.joints.waist);
    assertClosedShell(top);
    const edgeAt = (y) => {
      const pos = top.geometry.attributes.position;
      let edge = 0;
      for (let i = 0; i < pos.count; i += 1) {
        if (Math.abs(pos.getY(i) - y) > 0.02) continue;
        edge = Math.max(edge, Math.abs(pos.getX(i)));
      }
      return edge;
    };
    const shell = top.userData.shell;
    assert.ok(Math.abs(edgeAt(shell.ySide) - edgeAt(shell.y0)) < 0.025, 'tee hangs straight below the shoulders');
    const box = bboxOf(top);
    assert.ok(box.max.x - box.min.x > spec.chestTopWidth);
    assert.ok(box.max.z - box.min.z > spec.chestTopDepth);
    assert.ok(box.min.y < 0, 'shirt covers the waist');
    assert.ok(box.max.y > spec.chestHeight * 0.7, 'shirt reaches the neck');
    const sleeve = character.joints.shoulderL.getObjectByName('clothingTopUpperL');
    assert.equal(sleeve.parent, character.joints.shoulderL);
    assertClosedShell(sleeve);
    const sleeveBox = bboxOf(sleeve);
    assert.ok(sleeveBox.max.y - sleeveBox.min.y < spec.upperArmLength * 0.7, 'tee sleeve ends on the upper arm');
    assert.equal(character.joints.elbowL.getObjectByName('clothingTopForearmL'), undefined);
    assert.ok(character.root.getObjectByName('forearmLMesh'));
    assertTorsoShell(character);
    const tee = getRegistry().part('clothing.top', 'tee');
    assert.ok(tee.covers.includes('shoulderL') && tee.covers.includes('upperArmL'));
    assert.equal(getRegistry().part('clothing.top', 'tank').covers.includes('shoulderL'), false);
    assert.equal(getRegistry().part('clothing.outer', 'vest').covers.includes('shoulderL'), false);
    assert.ok(getRegistry().part('clothing.outer', 'jacket').covers.includes('shoulderR'));
  });

  it('closes a shirt and a muscular shoulder, and keeps a tee skirt from gaping', () => {
    const shirt = wear((doc) => {
      doc.clothing.top = { id: 'shirt', color: '#dddddd' };
      doc.arms.left.type = 'muscular';
    });
    assert.ok(shirt.joints.elbowL.getObjectByName('clothingTopForearmL'));
    assert.ok(shirt.joints.shoulderL.getObjectByName('clothingTopUpperL'));
    assertTorsoShell(shirt);
    const left = shirt.root.getObjectByName('clothingTopUpperL').userData.sleeve;
    const right = shirt.root.getObjectByName('clothingTopUpperR').userData.sleeve;
    assert.ok(left.ball > right.ball, 'the muscular sleeve follows that arm');
    assert.ok(Math.abs(shirt.root.getObjectByName('clothingTop').userData.shell.hx
      - (shirt.getResolved().chestTopWidth / 2 + shirt.root.getObjectByName('clothingTop').userData.shell.ease)) < 1e-6);
    const teeSkirt = wear((doc) => {
      doc.clothing.top = { id: 'tee', color: '#3a5a40' };
      doc.clothing.bottom = { id: 'skirt', color: '#222222' };
    });
    assertTorsoShell(teeSkirt);
    const skirt = teeSkirt.root.getObjectByName('clothingBottom');
    skirt.geometry.computeBoundingBox();
    assert.ok(skirt.geometry.boundingBox.max.y > teeSkirt.getResolved().pelvisHeight * 0.85);
  });

  it('stacks a vest over a tank and shorts over the legs without holes', () => {
    const character = wear((doc) => {
      doc.clothing.top = { id: 'tank', color: '#3a5a40' };
      doc.clothing.outer = { id: 'vest', color: '#111111' };
      doc.clothing.bottom = { id: 'shorts', color: '#222222' };
    });
    assertBodyStays(character);
    const top = character.root.getObjectByName('clothingTop');
    const vest = character.root.getObjectByName('clothingOuter');
    const topSize = bboxOf(top).getSize(new Vector3());
    const vestSize = bboxOf(vest).getSize(new Vector3());
    assert.ok(topSize.x < vestSize.x, 'vest is wider than the tank');
    assert.ok(topSize.z < vestSize.z, 'vest is deeper than the tank');
    assert.equal(character.joints.shoulderL.children.some((child) => child.userData.garment), false);
    const thigh = character.joints.hipL.getObjectByName('clothingBottomThighL');
    assert.equal(thigh.parent, character.joints.hipL);
    assertClosedShell(thigh);
    const thighBox = bboxOf(thigh);
    assert.ok(thighBox.max.y - thighBox.min.y < character.getResolved().thighLength * 0.75);
    assert.equal(character.root.getObjectByName('clothingBottomShinL'), undefined);
    for (const mesh of garments(character.root)) assertClosedShell(mesh);
    character.root.updateMatrixWorld(true);
    const vestBox = bboxOf(vest);
    assert.ok(vestBox.min.x < -0.05 && vestBox.max.x > 0.05, 'vest has both sides');
    assert.ok(vestBox.min.z < -0.02 && vestBox.max.z > 0.02, 'vest has a front and a back');
    assertTorsoShell(character);
    assertTorsoShell(character, 'clothingOuter');
    const spec = character.getResolved();
    const shoulder = coverFromAbove(vest, spec.chestTopWidth * 0.45, 0);
    assert.ok(shoulder && shoulder.ny > 0, 'vest covers the chest shoulder line');
  });

  it('keeps the top when a jacket is worn over it', () => {
    const character = wear((doc) => {
      doc.clothing.top = { id: 'tee', color: '#3a5a40' };
      doc.clothing.outer = { id: 'jacket', color: '#1c1c1c' };
    });
    assert.ok(character.root.getObjectByName('clothingTop'));
    assert.ok(character.root.getObjectByName('clothingOuter'));
    assert.ok(character.joints.elbowL.getObjectByName('clothingOuterForearmL'));
    assert.ok(character.root.getObjectByName('chestMesh'));
    assert.ok(character.root.getObjectByName('upperArmLMesh'));
    assert.ok(character.root.getObjectByName('forearmLMesh'));
  });

  it('skips sleeves on a robot or skeleton arm and keeps that limb', () => {
    const character = wear((doc) => {
      doc.clothing.top = { id: 'shirt', color: '#3a5a40' };
      doc.arms.right.type = 'robot';
      doc.arms.left.type = 'skeleton';
    });
    assert.ok(character.root.getObjectByName('upperArmLMesh'));
    assert.ok(character.root.getObjectByName('upperArmRMesh'));
    assert.ok(character.root.getObjectByName('forearmLMesh'));
    assert.ok(character.root.getObjectByName('forearmRMesh'));
    assert.ok(character.root.getObjectByName('chestMesh'));
    assert.equal(character.root.getObjectByName('clothingTopUpperL'), undefined);
    assert.equal(character.root.getObjectByName('clothingTopUpperR'), undefined);
    assert.ok(character.root.getObjectByName('clothingTop'));
  });

  it('skips a peg and a robot leg in pants, and skips shoes on the peg', () => {
    const character = wear((doc) => {
      doc.clothing.bottom = { id: 'pants', color: '#222222' };
      doc.clothing.shoes = { id: 'sneakers', color: '#111111', accent: '#f2f2f2' };
      doc.legs.right.type = 'peg';
      doc.legs.left.type = 'robot';
    });
    assert.ok(character.root.getObjectByName('pegRMesh'));
    assert.ok(character.root.getObjectByName('thighLMesh'));
    assert.ok(character.root.getObjectByName('pelvisMesh'));
    assert.ok(character.root.getObjectByName('footLMesh'));
    assert.equal(character.root.getObjectByName('clothingBottomThighL'), undefined);
    assert.equal(character.root.getObjectByName('clothingBottomThighR'), undefined);
    assert.equal(character.root.getObjectByName('clothingShoeR'), undefined);
    assert.equal(character.joints.ankleL.getObjectByName('clothingShoeL').parent, character.joints.ankleL);
  });

  it('sizes the skirt from the stride and leaves the legs in place', () => {
    const character = wear((doc) => {
      doc.clothing.bottom = { id: 'skirt', color: '#222222' };
    });
    const spec = character.getResolved();
    const pad = clothPad(spec.height);
    const skirt = character.root.getObjectByName('clothingBottom');
    assert.equal(skirt.parent, character.pelvis);
    assert.ok(skirt.userData.hemRadius >= spec.hipWidth / 2 + spec.radii.knee + pad);
    assert.ok(character.root.getObjectByName('pelvisMesh'));
    assert.ok(character.root.getObjectByName('thighLMesh'));
    assertClosedShell(skirt);
    const pos = skirt.geometry.attributes.position;
    const index = skirt.geometry.index;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i += 1) {
      minY = Math.min(minY, pos.getY(i));
      maxY = Math.max(maxY, pos.getY(i));
    }
    assert.ok(maxY > spec.pelvisHeight * 0.85, 'waistband meets the waist');
    assert.equal(skirt.geometry.parameters.openEnded, false);
    assert.ok(skirt.userData.hemRadius > skirt.userData.waistRadius, 'skirt flares toward the hem');
    let hemR = 0;
    for (let i = 0; i < pos.count; i += 1) {
      if (Math.abs(pos.getY(i) - minY) > 1e-4) continue;
      hemR = Math.max(hemR, Math.hypot(pos.getX(i), pos.getZ(i)));
    }
    assert.ok(Math.abs(hemR - skirt.userData.hemRadius) < 1e-4);
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    let sideFaces = 0;
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(pos, index.getX(i));
      b.fromBufferAttribute(pos, index.getX(i + 1));
      c.fromBufferAttribute(pos, index.getX(i + 2));
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const abz = b.z - a.z;
      const acx = c.x - a.x;
      const acy = c.y - a.y;
      const acz = c.z - a.z;
      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;
      const len = Math.hypot(nx, ny, nz);
      assert.ok(len > 1e-6, 'no degenerate skirt face');
      if (Math.abs(ny) / len > 0.65) continue;
      const cx = (a.x + b.x + c.x) / 3;
      const cz = (a.z + b.z + c.z) / 3;
      assert.ok(nx * cx + nz * cz > 0, 'skirt side faces point outward');
      sideFaces += 1;
    }
    assert.ok(sideFaces >= 16, 'skirt has a closed side wall');
  });

  it('puts shoes over the feet and keeps the markers at the sole', () => {
    const character = wear((doc) => {
      doc.clothing.shoes = { id: 'sneakers', color: '#111111', accent: '#f2f2f2' };
    });
    const shoes = character.joints.ankleL.getObjectByName('clothingShoeL');
    assert.ok(Array.isArray(shoes.material));
    assert.equal(shoes.material[0].color.getHexString(), 'f2f2f2');
    assert.equal(shoes.material[1].color.getHexString(), '111111');
    assert.equal(shoes.material[0].side, DoubleSide);
    assert.ok(shoes.geometry.groups.length >= 2);
    assert.ok(character.root.getObjectByName('footLMesh'));
    const spec = character.getResolved();
    const soleY = spec.footCenterY - spec.footHeight / 2;
    character.update(0, { anim: 'idle', time: 0, speed: 0, freeze: true });
    character.root.updateMatrixWorld(true);
    const point = new Vector3();
    let minY = Infinity;
    const pos = shoes.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      point.fromBufferAttribute(pos, i);
      minY = Math.min(minY, point.y);
    }
    assert.ok(Math.abs(minY - soleY) < 1e-3, `${minY} vs ${soleY}`);
    const world = new Vector3();
    for (const name of ['footLHeel', 'footLToe', 'footRHeel', 'footRToe']) {
      const y = character.root.getObjectByName(name).getWorldPosition(world).y;
      assert.ok(Math.abs(y) < 2e-3, name);
    }

    const boots = wear((doc) => {
      doc.clothing.shoes = { id: 'boots', color: '#222222', accent: '#eeeeee' };
    });
    const boot = boots.joints.ankleL.getObjectByName('clothingShoeL');
    boot.geometry.computeBoundingBox();
    assert.ok(boot.geometry.boundingBox.max.y > boots.getResolved().radii.ankle, 'boot cuff climbs the shin');
    assert.ok(boots.root.getObjectByName('shinLMesh'));
    assert.ok(boots.root.getObjectByName('footLMesh'));
  });

  it('gives a robot leg a shoe and no cuff, and rejects a top on a robot torso', () => {
    const character = wear((doc) => {
      doc.legs.left.type = 'robot';
      doc.clothing.shoes = { id: 'boots', color: '#222222', accent: '#eeeeee' };
    });
    const boot = character.joints.ankleL.getObjectByName('clothingShoeL');
    boot.geometry.computeBoundingBox();
    assert.ok(boot.geometry.boundingBox.max.y < character.getResolved().radii.ankle);
    assert.ok(character.root.getObjectByName('shinLMesh'));
    assert.ok(character.root.getObjectByName('footLMesh'));

    const robot = defaultDocument();
    robot.body.torso = 'robot';
    robot.clothing.top = { id: 'tee', color: '#3a5a40' };
    assert.throws(() => createCharacter(robot), /cannot wear a top/);
  });

  it('clears a robot torso top and removes a tee without deleting the chest', () => {
    const character = createCharacter();
    character.updateDocument((doc) => {
      doc.body.torso = 'robot';
      doc.clothing.top.id = 'tee';
      doc.clothing.outer.id = 'jacket';
    });
    const cleared = character.getDocument();
    assert.equal(cleared.clothing.top.id, 'none');
    assert.equal(cleared.clothing.outer.id, 'none');
    assert.ok(character.root.getObjectByName('chestMesh'));
    assert.equal(garments(character.root).length, 0);

    const dressed = createCharacter();
    dressed.updateDocument((doc) => { doc.clothing.top.id = 'tee'; });
    assert.ok(dressed.root.getObjectByName('chestMesh'));
    assert.ok(dressed.root.getObjectByName('clothingTop'));
    const dressedVerts = dressed.getStats().vertices;
    assert.ok(dressedVerts > 1421);
    dressed.updateDocument((doc) => { doc.clothing.top.id = 'none'; });
    assert.ok(dressed.root.getObjectByName('chestMesh'));
    assert.ok(dressed.root.getObjectByName('upperArmLMesh'));
    assert.equal(dressed.root.getObjectByName('clothingTop'), undefined);
    assert.equal(dressed.getStats().vertices, 1421);
  });

  it('suppresses a hoodie hood when headwear is set', () => {
    const open = wear((doc) => {
      doc.clothing.top = { id: 'hoodie', color: '#334455' };
      doc.head.headwear.id = 'none';
    });
    const hatted = wear((doc) => {
      doc.clothing.top = { id: 'hoodie', color: '#334455' };
      doc.head.headwear.id = 'cap';
    });
    const hood = open.root.getObjectByName('clothingTopHood');
    assert.ok(hood);
    assert.equal(hood.parent, open.joints.neck);
    assert.notEqual(hood.geometry.type, 'BoxGeometry');
    assert.equal(hatted.root.getObjectByName('clothingTopHood'), undefined);
    assert.ok(open.getStats().vertices > hatted.getStats().vertices);
    assertClosedShell(hood);
    const spec = open.getResolved();
    const pos = hood.geometry.attributes.position;
    let minY = Infinity;
    let maxY = -Infinity;
    let back = false;
    let nape = false;
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      if (z < -spec.radii.neck) back = true;
      if (y < spec.neckLength * 0.35 && z < 0 && Math.hypot(pos.getX(i), z) < spec.headRy) nape = true;
    }
    assert.ok(minY < 0.02, 'hood meets the neckline');
    assert.ok(maxY > spec.neckLength + spec.headRy * 0.4, 'hood reaches the crown');
    assert.ok(back, 'hood sits behind the head');
    assert.ok(nape, 'hood drapes onto the neck instead of floating');
    assertTorsoShell(open);
  });

  it('keeps sleeves closed over the shoulder balls through every clip', () => {
    const naked = createBody();
    const tee = wear((doc) => {
      doc.clothing.top = { id: 'tee', color: '#3a5a40' };
    });
    assert.equal(tee.joints.shoulderL.position.x, naked.joints.shoulderL.position.x);
    assert.equal(tee.joints.shoulderL.position.y, naked.joints.shoulderL.position.y);
    assert.equal(Object.keys(tee.joints).length, 14);
    assertSleevesSealed(tee, 'tee');

    const muscular = wear((doc) => {
      doc.clothing.top = { id: 'shirt', color: '#dddddd' };
      doc.arms.left.type = 'muscular';
      doc.arms.right.type = 'normal';
    });
    assertSleevesSealed(muscular, 'muscular shirt');

    const layered = wear((doc) => {
      doc.clothing.top = { id: 'tee', color: '#3a5a40' };
      doc.clothing.outer = { id: 'vest', color: '#111111' };
    });
    assertSleevesSealed(layered, 'tee and vest');

    const jacket = wear((doc) => {
      doc.clothing.top = { id: 'tee', color: '#3a5a40' };
      doc.clothing.outer = { id: 'jacket', color: '#1c1c1c' };
    });
    assertSleevesSealed(jacket, 'jacket');

    const heavy = createCharacter(applyPreset(defaultDocument(), 'woman', 'heavy'));
    heavy.updateDocument((doc) => {
      doc.clothing.top.id = 'hoodie';
    });
    assertSleevesSealed(heavy, 'heavy hoodie');

    const mixed = wear((doc) => {
      doc.clothing.top = { id: 'shirt', color: '#3a5a40' };
      doc.arms.right.type = 'robot';
      doc.arms.left.type = 'skeleton';
    });
    assert.equal(mixed.root.getObjectByName('clothingTopUpperL'), undefined);
    assert.equal(mixed.root.getObjectByName('clothingTopUpperR'), undefined);
    assert.equal(mixed.root.getObjectByName('shoulderLMesh').userData.segment, 'upperArmL');
    assert.equal(mixed.root.getObjectByName('shoulderRMesh').userData.segment, 'upperArmR');
    assertTorsoShell(mixed);
    const shell = mixed.root.getObjectByName('clothingTop').userData.shell;
    const spec = mixed.getResolved();
    assert.ok(shell.hx < spec.shoulderWidth / 2 + spec.radii.shoulder * 0.5);
  });

  it('follows the joints through a walk and a dance', () => {
    const photo = wear((doc) => {
      doc.clothing.top = { id: 'tank', color: '#3a5a40' };
      doc.clothing.outer = { id: 'vest', color: '#111111' };
      doc.clothing.bottom = { id: 'shorts', color: '#222222' };
    });
    assertRides(photo, 'clothingTop', 'walk', 0.45);
    assertRides(photo, 'clothingOuter', 'disco', 0.8);
    assertRides(photo, 'clothingBottomThighL', 'walk', 0.45);
    assertRides(photo, 'clothingBottomThighR', 'disco', 0.8);

    const full = wear((doc) => {
      doc.clothing.top = { id: 'hoodie', color: '#334455' };
      doc.clothing.outer = { id: 'cape', color: '#111122' };
      doc.clothing.bottom = { id: 'pants', color: '#222233' };
      doc.clothing.shoes = { id: 'boots', color: '#111111', accent: '#eeeeee' };
    });
    assertRides(full, 'clothingTopUpperL', 'walk', 0.45);
    assertRides(full, 'clothingTopForearmR', 'disco', 0.7);
    assertRides(full, 'clothingBottomShinL', 'walk', 0.5);
    assertRides(full, 'clothingShoeL', 'disco', 0.9);
    assertRides(full, 'clothingCape', 'walk', 0.4);
    full.update(0, { anim: 'walk', time: 0.45, speed: 1.6, freeze: true });
    full.root.updateMatrixWorld(true);
    const arm = full.root.getObjectByName('upperArmLMesh').getWorldPosition(new Vector3());
    const sleeve = full.root.getObjectByName('clothingTopUpperL').getWorldPosition(new Vector3());
    assert.ok(arm.distanceTo(sleeve) < full.getResolved().upperArmLength);
  });

  it('round-trips and stays a shell over the naked body', () => {
    const filled = wear((doc) => {
      doc.body.presentation = 'woman';
      doc.body.type = 'broad';
      doc.head.shape = 'box';
      doc.head.hair.style = 'afro';
      doc.head.facialHair = 'beard';
      doc.head.ears = 'cat';
      doc.head.earrings.id = 'hoop';
      doc.head.headwear.id = 'crown';
      doc.head.eyewear.id = 'goggles';
      doc.arms.left.type = 'muscular';
      doc.arms.left.hand = 'claw';
      doc.arms.left.wrist.id = 'band';
      doc.arms.right.type = 'robot';
      doc.arms.right.hand = 'hook';
      doc.arms.right.wrist.id = 'cuff';
      doc.legs.left.type = 'robot';
      doc.legs.right.type = 'peg';
      doc.clothing.top = { id: 'hoodie', color: '#334455' };
      doc.clothing.outer = { id: 'cape', color: '#111122' };
      doc.clothing.bottom = { id: 'pants', color: '#222233' };
      doc.clothing.shoes = { id: 'boots', color: '#111111', accent: '#eeeeee' };
      doc.back.id = 'wings';
      doc.held.left = { id: 'phone', color: '#ffffff' };
      doc.held.right = { id: 'stick', color: '#886644' };
      doc.animation.dance = 'disco';
      doc.animation.walkStyle = 'swagger';
    });
    const again = createCharacter(filled.getDocument());
    assert.deepEqual(again.getDocument(), filled.getDocument());
    assert.equal(again.getStats().vertices, filled.getStats().vertices);
    assert.ok(filled.root.getObjectByName('chestMesh'));

    const casual = wear((doc) => {
      doc.clothing.top = { id: 'tee', color: '#3a5a40' };
      doc.clothing.bottom = { id: 'pants', color: '#222222' };
      doc.clothing.shoes = { id: 'sneakers', color: '#111111', accent: '#f2f2f2' };
    });
    const full = wear((doc) => {
      doc.clothing.top = { id: 'hoodie', color: '#334455' };
      doc.clothing.outer = { id: 'cape', color: '#111122' };
      doc.clothing.bottom = { id: 'pants', color: '#222233' };
      doc.clothing.shoes = { id: 'boots', color: '#111111', accent: '#eeeeee' };
    });
    const photo = wear((doc) => {
      doc.clothing.top = { id: 'tank', color: '#3a5a40' };
      doc.clothing.outer = { id: 'vest', color: '#111111' };
      doc.clothing.bottom = { id: 'shorts', color: '#222222' };
    });
    const counts = {
      naked: 1421,
      tankVestShorts: photo.getStats().vertices,
      teePantsSneakers: casual.getStats().vertices,
      fullyDressed: full.getStats().vertices,
      everySlot: filled.getStats().vertices,
    };
    console.log(`CLOTHING ${JSON.stringify(counts)}`);
    assert.equal(counts.naked, 1421);
    assert.ok(counts.tankVestShorts > 1421);
    assert.ok(counts.teePantsSneakers > 1421);
    assert.ok(counts.fullyDressed > counts.teePantsSneakers);
  });

  it('plays every clip on a dressed body and a robot-mixed dressed body', () => {
    const dressed = wear((doc) => {
      doc.clothing.top = { id: 'tee', color: '#3a5a40' };
      doc.clothing.bottom = { id: 'pants', color: '#222222' };
      doc.clothing.shoes = { id: 'sneakers', color: '#111111', accent: '#f2f2f2' };
    });
    const before = dressed.getStats().vertices;
    playAll(dressed);
    assert.equal(dressed.getStats().vertices, before);
    assert.ok(dressed.root.getObjectByName('chestMesh'));

    const mixed = wear((doc) => {
      doc.body.torso = 'robot';
      doc.arms.left.type = 'muscular';
      doc.arms.left.hand = 'claw';
      doc.arms.right.type = 'skeleton';
      doc.arms.right.hand = 'hook';
      doc.legs.left.type = 'robot';
      doc.legs.right.type = 'peg';
      doc.clothing.bottom = { id: 'pants', color: '#222233' };
      doc.clothing.shoes = { id: 'boots', color: '#111111', accent: '#eeeeee' };
      doc.animation.walkStyle = 'stomp';
    });
    const mixedVerts = mixed.getStats().vertices;
    playAll(mixed);
    assert.equal(mixed.getStats().vertices, mixedVerts);
    assert.ok(mixed.root.getObjectByName('chestMesh'));
    assert.equal(mixed.root.getObjectByName('clothingTop'), undefined);
    const saved = createCharacter(mixed.getDocument());
    assert.deepEqual(saved.getDocument(), mixed.getDocument());
  });
});
