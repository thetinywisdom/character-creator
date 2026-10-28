import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCustom, customDefaults, randomCustom, KIMATA_STYLE, CUSTOM } from './fixtures/isocity-characters.js';
import { createCharacter } from '../src/index.js';

// Mesh shells are no longer bit-identical to iso-city: hair is seated on the
// skull, hands meet the wrists, the waistband tucks under the shirt, and
// elbows and knees are filleted tubes instead of two straight segments.
// Those were overlapping or creased in iso-city. The rig contract is the joints.
const JOINTS = ['body', 'torso', 'head', 'headCenter', 'armL', 'armR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'legL', 'legR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];

function jointSnapshot(ch) {
  ch.root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  return JOINTS.map((name) => {
    const o = ch.parts[name];
    if (!o) return `${name}:missing`;
    o.getWorldPosition(v);
    return `${name}:${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
  });
}

function compareJoints(v1, label) {
  const theirs = createCustom(v1);
  const ours = createCharacter(v1);
  theirs.update(0, 0);
  ours.update(0, { speed: 0, grounded: true });
  const a = jointSnapshot(theirs);
  const b = jointSnapshot(ours);
  expect(b, label).toEqual(a);
  // Bone lengths stay put: wrist is still FORE below the elbow, ankle SHIN below the knee.
  for (const [parent, child] of [['elbowL', 'wristL'], ['elbowR', 'wristR'], ['kneeL', 'ankleL'], ['kneeR', 'ankleR'], ['armL', 'elbowL'], ['legL', 'kneeL']]) {
    const d0 = theirs.parts[parent].position.distanceTo(theirs.parts[child].position);
    const d1 = ours.parts[parent].position.distanceTo(ours.parts[child].position);
    expect(d1, `${label} ${parent}->${child}`).toBeCloseTo(d0, 5);
  }
  theirs.dispose?.();
  ours.dispose();
}

describe('rig parity with iso-city', () => {
  it('keeps joint positions for the man and woman presets', () => {
    compareJoints(customDefaults('man'), 'man');
    compareJoints(customDefaults('woman'), 'woman');
  });

  it('keeps joint positions for Kimata and seeded randoms', () => {
    compareJoints({ ...customDefaults('man'), ...KIMATA_STYLE, name: 'KIMATA' }, 'kimata');
    for (const seed of [1, 2, 3, 8, 42]) compareJoints(randomCustom(seed), `random ${seed}`);
  });

  it('keeps joint positions for every catalogue option', () => {
    const base = customDefaults('man');
    for (const hair of CUSTOM.hairs) compareJoints({ ...base, hair, name: `h-${hair}` }, `hair ${hair}`);
    for (const hat of CUSTOM.hats) compareJoints({ ...base, hat, name: `hat-${hat}` }, `hat ${hat}`);
    for (const top of CUSTOM.tops) compareJoints({ ...base, top, name: `top-${top}` }, `top ${top}`);
    for (const bottom of CUSTOM.bottoms) compareJoints({ ...base, bottom, name: `bot-${bottom}` }, `bottom ${bottom}`);
    for (const shoes of CUSTOM.shoes) compareJoints({ ...base, shoes, name: `sh-${shoes}` }, `shoes ${shoes}`);
    for (const held of CUSTOM.helds) compareJoints({ ...base, held, name: `held-${held}` }, `held ${held}`);
    for (const body of CUSTOM.bodies) compareJoints({ ...base, body, name: `body-${body}` }, `body ${body}`);
    for (const acc of CUSTOM.accs) {
      compareJoints({ ...base, name: `acc-${acc}`, acc: { ...base.acc, [acc]: true, sunglasses: acc === 'sunglasses', glasses: acc === 'glasses' } }, `acc ${acc}`);
    }
  });
});
