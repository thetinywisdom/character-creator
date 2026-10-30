import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import {
  ANIMATIONS,
  JOINT_NAMES,
  createBody,
  createCharacter,
  createRegistry,
  defaultDocument,
  getRegistry,
  panelSections,
  registerPart,
  validateDocument,
} from '../src/body/index.js';

const PLAN_EXAMPLE = {
  version: 1,
  body: {
    presentation: 'woman',
    type: 'average',
    height: 1.7,
    skin: '#e4c29a',
    shoulder: 0.34,
    belly: 0.21,
    hip: 0.19,
    torso: 'normal',
  },
  head: {
    shape: 'round',
    size: 0.24,
    hair: { style: 'bob', color: '#2a2118' },
    facialHair: 'none',
    headwear: { id: 'beanie', color: '#1d2a3a' },
  },
  arms: {
    left: { type: 'normal', color: null, hand: 'open', wrist: { id: 'band', color: '#222222' } },
    right: { type: 'robot', color: '#c5c5c5', hand: 'claw', wrist: { id: 'none' } },
  },
  legs: {
    left: { type: 'normal', color: null },
    right: { type: 'peg', color: '#8a5a32' },
  },
  clothing: {
    top: { id: 'tee', color: '#3a5a40' },
    outer: { id: 'vest', color: '#1c1c1c' },
    bottom: { id: 'skirt', color: '#222222' },
    shoes: { id: 'sneakers', color: '#111111', accent: '#f2f2f2' },
  },
  back: { id: 'backpack', color: '#4a3728' },
  held: {
    left: { id: 'none' },
    right: { id: 'cup', color: '#f4f1ea' },
  },
  animation: { dance: 'robot', walkStyle: 'swagger' },
};

describe('character document', () => {
  it('registers the slot tree and rejects duplicates', () => {
    const registry = getRegistry();
    const ids = registry.slots().map((slot) => slot.id);
    assert.deepEqual(ids, [
      'body.torso',
      'head.shape',
      'head.hair',
      'head.facialHair',
      'head.headwear',
      'arms.left',
      'arms.right',
      'arms.left.hand',
      'arms.right.hand',
      'arms.left.wrist',
      'arms.right.wrist',
      'legs.left',
      'legs.right',
      'clothing.top',
      'clothing.outer',
      'clothing.bottom',
      'clothing.shoes',
      'back',
      'hands.left',
      'hands.right',
      'animation.dance',
      'animation.walkStyle',
    ]);
    assert.deepEqual(
      registry.parts('head.shape').map((part) => part.id),
      ['classic', 'round', 'long', 'box'],
    );
    assert.equal(registry.parts('head.hair').length, 6);
    assert.deepEqual(
      registry.parts('clothing.bottom').map((part) => part.id),
      ['none', 'pants', 'shorts', 'skirt'],
    );
    assert.ok(registry.parts('animation.dance').some((part) => part.id === 'mbappe'));
    assert.throws(() => registerPart('head.shape', 'classic', { build() {} }), /already registered/);

    const fresh = createRegistry();
    fresh.registerSection('body', { label: 'Body' });
    fresh.registerSlot('body.torso', { section: 'body', label: 'Torso' });
    assert.throws(() => fresh.registerSlot('body.torso', { section: 'body' }), /already registered/);
    fresh.registerPart('body.torso', 'normal', {});
    assert.throws(() => fresh.registerPart('body.torso', 'normal', {}), /already registered/);
  });

  it('validates version 1 and fills missing sections from the naked default', () => {
    const result = validateDocument(defaultDocument());
    assert.equal(result.ok, true);
    assert.equal(result.document.body.torso, 'normal');
    assert.equal(result.document.body.belly, null);
    assert.equal(result.document.head.shape, 'classic');
    assert.equal(result.document.clothing.bottom.id, 'none');

    const partial = validateDocument({ version: 1, body: { height: 1.6 } });
    assert.equal(partial.ok, true);
    assert.equal(partial.document.body.height, 1.6);
    assert.equal(partial.document.body.skin, '#e4c29a');
    assert.equal(partial.document.animation.walkStyle, 'normal');
    assert.equal(partial.document.body.limbThickness, 1);
  });

  it('accepts the plan example, and rejects dress and a clothed robot torso', () => {
    const example = validateDocument(PLAN_EXAMPLE);
    assert.equal(example.ok, true, example.errors.join('; '));
    assert.equal(example.document.arms.right.hand, 'claw');
    assert.equal(example.document.arms.right.wrist.color, '#222222');
    assert.equal(example.document.body.limbThickness, 1);
    assert.equal(example.document.body.belly, 0.21);

    const dress = validateDocument({
      ...defaultDocument(),
      clothing: { ...defaultDocument().clothing, bottom: { id: 'dress', color: '#222222' } },
    });
    assert.equal(dress.ok, false);
    assert.ok(dress.errors.some((line) => line.includes('clothing.bottom')));

    const robot = defaultDocument();
    robot.body.torso = 'robot';
    robot.clothing.top = { id: 'tee', color: '#3a5a40' };
    robot.clothing.outer = { id: 'jacket', color: '#111111' };
    const blocked = validateDocument(robot);
    assert.equal(blocked.ok, false);
    assert.ok(blocked.errors.some((line) => line.includes('cannot wear a top')));
    assert.ok(blocked.errors.some((line) => line.includes('cannot wear an outer layer')));

    robot.clothing.top = { id: 'none', color: '#3a5a40' };
    robot.clothing.outer = { id: 'none', color: '#1c1c1c' };
    assert.equal(validateDocument(robot).ok, true);
    assert.equal(validateDocument({ version: 2 }).ok, false);
  });

  it('turns an open hand into a fist when that hand holds an item', () => {
    const doc = defaultDocument();
    doc.held.right = { id: 'phone', color: '#ffffff' };
    doc.arms.right.hand = 'open';
    doc.arms.left.hand = 'claw';
    doc.held.left = { id: 'book', color: '#cccccc' };
    const result = validateDocument(doc);
    assert.equal(result.ok, true);
    assert.equal(doc.arms.right.hand, 'open');
    assert.equal(result.document.arms.right.hand, 'fist');
    assert.equal(result.document.arms.left.hand, 'claw');
  });

  it('builds the body, arms, legs, clothing, and motion controls from the registry', () => {
    const sections = panelSections();
    assert.deepEqual(sections.map((section) => section.id), ['body', 'head', 'arms', 'legs', 'clothes', 'motion']);
    assert.equal(sections[1].label, 'Head');
    assert.equal(sections[4].label, 'Clothing');
    assert.deepEqual(
      sections[0].controls.map((control) => control.id),
      ['presentation', 'bodyType', 'torso', 'height', 'shoulder', 'belly', 'hip', 'thick', 'skin'],
    );
    assert.deepEqual(
      sections[0].controls.find((control) => control.id === 'torso').options.map((option) => option.id),
      ['normal', 'robot'],
    );
    assert.deepEqual(
      sections[1].controls.map((control) => control.id),
      ['shape', 'headSize', 'hair', 'hairColor', 'facialHair', 'headwear', 'headwearColor'],
    );
    assert.deepEqual(
      sections[2].controls.map((control) => control.id),
      ['armL', 'armLColor', 'handL', 'armR', 'armRColor', 'handR'],
    );
    assert.deepEqual(
      sections[2].controls.find((control) => control.id === 'handL').options.map((option) => option.id),
      ['open', 'fist', 'claw', 'hook'],
    );
    assert.deepEqual(
      sections[3].controls.map((control) => control.id),
      ['legL', 'legLColor', 'legR', 'legRColor'],
    );
    assert.deepEqual(
      sections[3].controls.find((control) => control.id === 'legL').options.map((option) => option.id),
      ['normal', 'robot', 'peg'],
    );
    assert.deepEqual(
      sections[4].controls.map((control) => control.id),
      ['top', 'topColor', 'outer', 'outerColor', 'bottom', 'bottomColor', 'shoes', 'shoeColor', 'shoeAccent'],
    );
    assert.deepEqual(
      sections[4].controls.find((control) => control.id === 'top').options.map((option) => option.id),
      ['none', 'tank', 'tee', 'shirt', 'hoodie'],
    );
    assert.deepEqual(
      sections[4].controls.find((control) => control.id === 'bottom').options.map((option) => option.id),
      ['none', 'pants', 'shorts', 'skirt'],
    );
    assert.deepEqual(
      sections[5].controls.map((control) => control.id),
      ['walkStyle', 'anim', 'speed', 'wire', 'turn'],
    );
    assert.deepEqual(
      sections[5].controls.find((control) => control.id === 'walkStyle').options.map((option) => option.id),
      ['normal', 'stomp', 'swagger'],
    );
  });
});

describe('createCharacter', () => {
  it('wraps the naked mannequin and leaves the sockets empty', () => {
    const naked = createBody();
    const character = createCharacter();
    assert.equal(character.getStats().vertices, 1421);
    assert.equal(character.getStats().triangles, 1868);
    assert.deepEqual(character.getStats().roles, naked.getStats().roles);
    assert.deepEqual(Object.keys(character.joints), JOINT_NAMES);
    for (const name of JOINT_NAMES) {
      assert.ok(
        character.joints[name].position.distanceTo(naked.joints[name].position) < 1e-6,
        name,
      );
    }

    assert.equal(character.sockets.head.parent, character.joints.neck);
    assert.equal(character.sockets.back.parent, character.joints.waist);
    assert.equal(character.sockets.gripL.parent, character.joints.wristL);
    assert.equal(character.sockets.gripR.parent, character.joints.wristR);
    assert.equal(character.sockets.wristItemL.parent, character.joints.wristL);
    assert.equal(character.sockets.wristItemR.parent, character.joints.wristR);
    for (const [name, socket] of Object.entries(character.sockets)) {
      assert.equal(socket.children.length, 0, name);
      assert.equal(socket.userData.socket, true);
    }
    assert.equal(character.getRegistry(), getRegistry());
  });

  it('keeps the naked mesh and the clips when the document and sliders change', () => {
    const character = createCharacter();
    assert.equal(character.getStats().vertices, 1421);
    const saved = character.setDocument(PLAN_EXAMPLE);
    assert.equal(saved.body.shoulder, 0.34);
    assert.equal(saved.arms.right.hand, 'claw');
    const variantVerts = character.getStats().vertices;
    assert.notEqual(variantVerts, 1421);
    assert.ok(Math.abs(character.joints.shoulderL.position.x + 0.17) < 1e-6);

    character.setParams({
      height: 1.9,
      shoulderWidth: 0.4,
      hipWidth: 0.2,
      headSize: 0.25,
      limbThickness: 1.1,
      skinColor: '#E4C29A',
    });
    const doc = character.getDocument();
    assert.equal(doc.body.height, 1.9);
    assert.equal(doc.body.shoulder, 0.4);
    assert.equal(doc.body.hip, 0.2);
    assert.equal(doc.head.size, 0.25);
    assert.equal(doc.body.limbThickness, 1.1);
    assert.equal(doc.body.skin, '#e4c29a');
    assert.equal(doc.body.belly, 0.21);
    assert.equal(character.getStats().vertices, variantVerts);
    assert.equal(character.sockets.head.parent, character.joints.neck);
    assert.equal(character.sockets.gripR.parent, character.joints.wristR);

    const before = new Map(JOINT_NAMES.map((name) => [name, character.joints[name].position.clone()]));
    for (const item of ANIMATIONS) {
      for (let step = 0; step < 4; step += 1) {
        character.update(1 / 30, { anim: item.id, speed: item.speed });
        character.root.updateMatrixWorld(true);
        character.root.traverse((obj) => {
          assert.ok(Number.isFinite(obj.position.y + obj.quaternion.w), item.id);
        });
        const heel = character.root.getObjectByName('footLHeel');
        const point = heel.getWorldPosition(new Vector3());
        if (item.kind !== 'jump' && item.id !== 'knockdown' && item.id !== 'knockback') {
          assert.ok(point.y >= -2e-3, `${item.id} foot stays on the ground`);
        }
      }
    }
    assert.equal(character.getStats().vertices, variantVerts);
    for (const [name, position] of before) {
      assert.ok(character.joints[name].position.distanceTo(position) < 1e-6, name);
    }

    assert.throws(() => character.setDocument({ version: 1, clothing: { bottom: { id: 'dress', color: '#222222' } } }));
    assert.equal(character.getDocument().body.height, 1.9);
  });
});
