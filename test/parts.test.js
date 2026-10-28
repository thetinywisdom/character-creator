import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SLOTS, getParts, createCharacter, defaults, selectPart, randomize, COLORS } from '../src/index.js';

function meshCount(root) {
  let n = 0;
  root.traverse((o) => { if (o.isMesh) n += 1; });
  return n;
}

describe('part registry', () => {
  it('registers the iso-city catalogue', () => {
    const count = (slot) => getParts(slot).length;
    expect(count('head.hair')).toBe(20);
    expect(count('head.headwear')).toBe(4);
    expect(count('head.facialHair')).toBe(3);
    expect(count('head.eyewear')).toBe(3);
    expect(count('head.ears')).toBe(1);
    expect(count('head.shape')).toBe(1);
    expect(count('body')).toBe(4);
    expect(count('body.torso')).toBe(1);
    expect(count('arms.left')).toBe(1);
    expect(count('arms.right')).toBe(1);
    expect(getParts('arms.left')[0].id).toBe('normal');
    expect(getParts('arms.right')[0].id).toBe('normal');
    expect(getParts('legs.left')[0].id).toBe('normal');
    expect(getParts('legs.right')[0].id).toBe('normal');
    expect(count('clothing.top')).toBe(11);
    expect(count('clothing.outer')).toBe(1);
    expect(count('clothing.bottom')).toBe(4);
    expect(count('clothing.shoes')).toBe(4);
    expect(count('back')).toBe(2);
    expect(count('hands.left')).toBe(16);
    expect(count('hands.right')).toBe(16);
    expect(count('animation.dance')).toBe(8);
    expect(count('animation.walkStyle')).toBe(1);
    expect(COLORS).toHaveLength(30);
    expect(SLOTS.length).toBeGreaterThan(15);
  });

  it('builds every registered part without throwing', () => {
    for (const slot of SLOTS) {
      for (const part of getParts(slot)) {
        const def = selectPart(defaults('man'), slot, part.id);
        expect(() => {
          const ch = createCharacter(def);
          ch.update(0.016, { speed: 1.4, grounded: true });
          expect(meshCount(ch.root)).toBeGreaterThan(10);
          ch.dispose();
        }, `${slot}/${part.id}`).not.toThrow();
      }
    }
  });

  it('plays every dance and swaps definitions on the same handle', () => {
    const group = new THREE.Group();
    const ch = createCharacter(defaults('woman'));
    group.add(ch.root);
    for (const part of getParts('animation.dance')) {
      expect(ch.dance(part.id)).toBeGreaterThan(0);
      for (let i = 0; i < 4; i++) ch.update(0.05, { speed: 0, grounded: true });
      ch.stopDance(0.02);
      ch.update(0.05, { speed: 0, grounded: true });
    }
    ch.setDef(randomize(9));
    expect(ch.root.parent).toBe(group);
    expect(ch.def.v).toBe(2);
    expect(ch.def.extra.id).toBe('9');
    ch.update(0.016, { speed: 6.2, grounded: true });
    ch.dispose();
  });
});
