import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import {
  ANIMATIONS,
  createCharacter,
  defaultDocument,
  validateDocument,
} from '../src/body/index.js';
import { COVERING_HEADWEAR } from '../src/character/head.js';

const HAIR = ['buzz', 'bob', 'ponytail', 'long', 'afro'];
const HATS = ['cap', 'beanie', 'hat', 'helmet', 'headband'];
const FACIAL = ['moustache', 'beard'];
const SHAPES = ['classic', 'round', 'long', 'box'];

function wear(mutate) {
  const doc = defaultDocument();
  mutate(doc);
  return createCharacter(doc);
}

function parts(root, role) {
  const found = [];
  root.traverse((obj) => {
    if (obj.userData?.headPart === role) found.push(obj);
  });
  return found;
}

function clearance(character, role) {
  const head = character.root.getObjectByName('headMesh');
  const skull = head.userData.skull;
  assert.equal(typeof skull.radiusAt, 'function');
  const local = new Vector3();
  let checked = 0;
  for (const mesh of parts(character.root, role)) {
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      local.fromBufferAttribute(pos, i);
      mesh.localToWorld(local);
      character.sockets.head.worldToLocal(local);
      const need = skull.radiusAt(local.y) + 0.006;
      const gap = Math.hypot(local.x, local.z) - need;
      assert.ok(gap >= -1e-4, `${mesh.name} y=${local.y.toFixed(3)} is ${gap.toFixed(4)} m inside the skull`);
      checked += 1;
    }
  }
  assert.ok(checked > 0, role);
}

describe('head parts', () => {
  it('loads an old document that omits the head section', () => {
    const result = validateDocument({
      version: 1,
      body: { presentation: 'woman', type: 'slim', height: 1.7, skin: '#e4c29a', torso: 'normal', limbThickness: 1 },
    });
    assert.equal(result.ok, true);
    assert.equal(result.document.head.shape, 'classic');
    assert.equal(result.document.head.hair.style, 'none');
    assert.equal(result.document.head.hair.color, '#2a2118');
    assert.equal(result.document.head.facialHair, 'none');
    assert.equal(result.document.head.headwear.id, 'none');
    assert.equal('ears' in result.document.head, false);
    assert.equal('highlight' in result.document.head.hair, false);
  });

  it('ignores removed head fields and maps retired styles to none', () => {
    const result = validateDocument({
      version: 1,
      head: {
        shape: 'classic',
        ears: 'elf',
        earrings: { id: 'hoop', color: '#d4af37' },
        eyewear: { id: 'glasses', color: '#111111' },
        hair: { style: 'spikes', color: '#111111', highlight: '#ffffff' },
        headwear: { id: 'horns', color: '#222222', extra: true },
        facialHair: 'beard',
      },
    });
    assert.equal(result.ok, true, result.errors.join('; '));
    assert.equal(result.document.head.hair.style, 'none');
    assert.equal(result.document.head.hair.color, '#111111');
    assert.equal('highlight' in result.document.head.hair, false);
    assert.equal(result.document.head.headwear.id, 'none');
    assert.equal(result.document.head.facialHair, 'beard');
    assert.equal('ears' in result.document.head, false);
    assert.equal('earrings' in result.document.head, false);
    assert.equal('eyewear' in result.document.head, false);
    const mohawk = validateDocument({
      version: 1,
      head: { hair: { style: 'mohawk', color: '#222222' }, headwear: { id: 'crown', color: '#d4af37' } },
    });
    assert.equal(mohawk.ok, true, mohawk.errors.join('; '));
    assert.equal(mohawk.document.head.hair.style, 'none');
    assert.equal(mohawk.document.head.headwear.id, 'none');
  });

  it('keeps every hair, hat, and beard outside the skull on every shape', () => {
    for (const shape of SHAPES) {
      for (const style of HAIR) {
        const character = wear((doc) => {
          doc.head.shape = shape;
          doc.head.hair.style = style;
          doc.head.hair.highlight = '#c4a574';
        });
        assert.equal(character.sockets.head.position.y, character.getResolved().neckLength);
        assert.equal(parts(character.root, 'hair')[0].parent, character.sockets.head);
        clearance(character, 'hair');
      }
      for (const hat of HATS) {
        clearance(wear((doc) => {
          doc.head.shape = shape;
          doc.head.headwear.id = hat;
        }), 'hat');
      }
      for (const facial of FACIAL) {
        clearance(wear((doc) => {
          doc.head.shape = shape;
          doc.head.facialHair = facial;
        }), 'facial');
      }
    }
  });

  it('hides hair under a covering hat or a hoodie hood, and lets headwear win', () => {
    const bob = wear((doc) => { doc.head.hair.style = 'bob'; });
    assert.ok(bob.root.getObjectByName('hairMesh'));
    for (const hat of COVERING_HEADWEAR) {
      const covered = wear((doc) => {
        doc.head.hair.style = 'bob';
        doc.head.headwear.id = hat;
      });
      assert.equal(covered.root.getObjectByName('hairMesh'), undefined, hat);
      assert.ok(covered.root.getObjectByName('headwearMesh'), hat);
    }
    const band = wear((doc) => {
      doc.head.hair.style = 'bob';
      doc.head.headwear.id = 'headband';
    });
    assert.ok(band.root.getObjectByName('hairMesh'));
    assert.ok(band.root.getObjectByName('headwearMesh'));

    const hood = wear((doc) => {
      doc.head.hair.style = 'long';
      doc.clothing.top = { id: 'hoodie', color: '#334455' };
    });
    assert.equal(hood.root.getObjectByName('hairMesh'), undefined);
    assert.ok(hood.root.getObjectByName('clothingTopHood'));

    const cap = wear((doc) => {
      doc.head.hair.style = 'afro';
      doc.head.headwear.id = 'cap';
      doc.clothing.top = { id: 'hoodie', color: '#334455' };
    });
    assert.equal(cap.root.getObjectByName('hairMesh'), undefined);
    assert.equal(cap.root.getObjectByName('clothingTopHood'), undefined);
    assert.ok(cap.root.getObjectByName('headwearMesh'));
  });

  it('keeps fourteen joints and every clip with a bearded head', () => {
    const character = wear((doc) => {
      doc.head.shape = 'round';
      doc.head.hair.style = 'afro';
      doc.head.facialHair = 'beard';
    });
    assert.ok(character.root.getObjectByName('facialHairMesh'));
    assert.equal(character.root.getObjectByName('facialHairMesh').parent, character.sockets.head);
    assert.equal(Object.keys(character.joints).length, 14);
    assert.equal(ANIMATIONS.length, 19);
    character.update(0.1, { anim: 'walk', speed: 1.6 });
    assert.equal(Object.keys(character.joints).length, 14);
  });
});
