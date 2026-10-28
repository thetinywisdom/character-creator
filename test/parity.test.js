import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCustom, customDefaults, randomCustom, KIMATA_STYLE, CUSTOM } from './fixtures/isocity-characters.js';
import { createCharacter } from '../src/index.js';

function snapshot(root) {
  root.updateMatrixWorld(true);
  const meshes = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const bits = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      bits.push(v.x.toFixed(4), v.y.toFixed(4), v.z.toFixed(4));
    }
    meshes.push(`${o.material.color.getHexString()}|${bits.join(',')}`);
  });
  meshes.sort();
  return meshes;
}

function compare(v1, label) {
  const theirs = createCustom(v1);
  const ours = createCharacter(v1);
  const a = snapshot(theirs.root);
  const b = snapshot(ours.root);
  if (a.length !== b.length || a.some((row, i) => row !== b[i])) {
    const missing = a.filter((row) => !b.includes(row)).length;
    const extra = b.filter((row) => !a.includes(row)).length;
    expect.fail(`${label}: mesh snapshot differs (iso ${a.length}, ours ${b.length}, missing ${missing}, extra ${extra})`);
  }
  theirs.dispose?.();
  ours.dispose();
}

describe('visual parity with iso-city', () => {
  it('matches the man and woman presets', () => {
    compare(customDefaults('man'), 'man');
    compare(customDefaults('woman'), 'woman');
  });

  it('matches Kimata and a handful of seeded randoms', () => {
    compare({ ...customDefaults('man'), ...KIMATA_STYLE, name: 'KIMATA' }, 'kimata');
    for (const seed of [1, 2, 3, 8, 42]) compare(randomCustom(seed), `random ${seed}`);
  });

  it('matches every catalogue option on the default man', () => {
    const base = customDefaults('man');
    for (const hair of CUSTOM.hairs) compare({ ...base, hair, name: `h-${hair}` }, `hair ${hair}`);
    for (const hat of CUSTOM.hats) compare({ ...base, hat, name: `hat-${hat}` }, `hat ${hat}`);
    for (const top of CUSTOM.tops) compare({ ...base, top, name: `top-${top}` }, `top ${top}`);
    for (const bottom of CUSTOM.bottoms) compare({ ...base, bottom, name: `bot-${bottom}` }, `bottom ${bottom}`);
    for (const shoes of CUSTOM.shoes) compare({ ...base, shoes, name: `sh-${shoes}` }, `shoes ${shoes}`);
    for (const held of CUSTOM.helds) compare({ ...base, held, name: `held-${held}` }, `held ${held}`);
    for (const body of CUSTOM.bodies) compare({ ...base, body, name: `body-${body}` }, `body ${body}`);
    for (const acc of CUSTOM.accs) {
      compare({ ...base, name: `acc-${acc}`, acc: { ...base.acc, [acc]: true, sunglasses: acc === 'sunglasses', glasses: acc === 'glasses' } }, `acc ${acc}`);
    }
  });
});
