import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import {
  ANIMATIONS,
  createBody,
  createCharacter,
  defaultDocument,
} from '../src/body/index.js';
import { shellGap, skirtCone } from '../src/character/clothing.js';

function wear(mutate) {
  const doc = defaultDocument();
  mutate(doc);
  return createCharacter(doc);
}

function findAll(root, name) {
  const found = [];
  root.traverse((obj) => {
    if (obj.name === name) found.push(obj);
  });
  return found;
}

function soleY(spec) {
  return spec.footCenterY - spec.footHeight / 2;
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
    }
  }
}

function radialNormal(piece) {
  const positions = piece.positions;
  const indices = piece.indices;
  const a = new Vector3(positions[indices[0] * 3], positions[indices[0] * 3 + 1], positions[indices[0] * 3 + 2]);
  const b = new Vector3(positions[indices[1] * 3], positions[indices[1] * 3 + 1], positions[indices[1] * 3 + 2]);
  const c = new Vector3(positions[indices[2] * 3], positions[indices[2] * 3 + 1], positions[indices[2] * 3 + 2]);
  const normal = new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
  const mid = a.clone().add(b).add(c);
  return normal.dot(new Vector3(mid.x, 0, mid.z));
}

describe('clothing compositor', () => {
  it('keeps the naked default at 1421 and adds nothing', () => {
    const naked = createBody();
    const character = createCharacter();
    assert.equal(character.getStats().vertices, 1421);
    assert.equal(character.getStats().triangles, 1868);
    assert.deepEqual(character.getStats().roles, naked.getStats().roles);
    for (const name of ['clothingTop', 'clothingOuter', 'clothingBottom', 'clothingShoes']) {
      assert.equal(findAll(character.root, name).length, 0);
    }
    assert.ok(character.root.getObjectByName('chestMesh'));
  });

  it('faces the skirt walls outward', () => {
    const piece = skirtCone(0.2, -0.4, 0.08, 0.3);
    assert.equal(piece.positions.length / 3, 16);
    assert.ok(radialNormal(piece) > 0);
  });

  it('replaces the chest and upper arms with one tee mesh', () => {
    const character = wear((doc) => {
      doc.clothing.top = { id: 'tee', color: '#3a5a40' };
    });
    const tops = findAll(character.root, 'clothingTop');
    assert.equal(tops.length, 1);
    assert.equal(tops[0].isSkinnedMesh, true);
    assert.equal(tops[0].geometry.isBufferGeometry, true);
    assert.equal(Array.isArray(tops[0].material), false);
    assert.equal(character.root.getObjectByName('chestMesh'), undefined);
    assert.ok(character.joints.waist.userData.block?.height > 0);
    assert.equal(character.root.getObjectByName('upperArmLMesh'), undefined);
    assert.equal(character.root.getObjectByName('upperArmRMesh'), undefined);
    assert.ok(character.root.getObjectByName('forearmLMesh'));
    assert.ok(character.root.getObjectByName('elbowLMesh'));
    assert.equal(tops[0].material.polygonOffset, false);

    const spec = character.getResolved();
    character.root.updateMatrixWorld(true);
    const elbow = character.joints.elbowL;
    const pos = tops[0].geometry.attributes.position;
    const point = new Vector3();
    let opening = Infinity;
    let samples = 0;
    for (let i = 0; i < pos.count; i += 1) {
      tops[0].getVertexPosition(i, point);
      tops[0].localToWorld(point);
      elbow.worldToLocal(point);
      if (Math.abs(point.y) > 0.03) continue;
      samples += 1;
      opening = Math.min(opening, Math.hypot(point.x, point.z));
    }
    assert.ok(samples >= 3, 'tee sleeve reaches the elbow');
    assert.ok(opening > spec.radii.elbow, `${opening} vs ${spec.radii.elbow}`);
  });

  it('lets a jacket replace the top and a vest keep the sleeves', () => {
    const jacket = wear((doc) => {
      doc.clothing.top = { id: 'tee', color: '#3a5a40' };
      doc.clothing.outer = { id: 'jacket', color: '#1c1c1c' };
    });
    assert.equal(jacket.root.getObjectByName('clothingTop'), undefined);
    assert.equal(jacket.root.getObjectByName('chestMesh'), undefined);
    assert.equal(jacket.root.getObjectByName('upperArmLMesh'), undefined);
    assert.equal(jacket.root.getObjectByName('forearmLMesh'), undefined);
    assert.equal(findAll(jacket.root, 'clothingOuter').length, 1);

    const vest = wear((doc) => {
      doc.clothing.top = { id: 'tee', color: '#3a5a40' };
      doc.clothing.outer = { id: 'vest', color: '#1c1c1c' };
    });
    assert.ok(vest.root.getObjectByName('clothingTop'));
    assert.ok(vest.root.getObjectByName('clothingOuter'));
    assert.equal(vest.root.getObjectByName('chestMesh'), undefined);
    assert.equal(vest.root.getObjectByName('upperArmLMesh'), undefined);
    assert.ok(vest.root.getObjectByName('forearmLMesh'));
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
    assert.equal(character.root.getObjectByName('chestMesh'), undefined);
    assert.equal(findAll(character.root, 'clothingTop').length, 1);
  });

  it('skips a peg and a robot leg in pants, and skips shoes on the peg', () => {
    const character = wear((doc) => {
      doc.clothing.bottom = { id: 'pants', color: '#222222' };
      doc.clothing.shoes = { id: 'sneakers', color: '#111111', accent: '#f2f2f2' };
      doc.legs.right.type = 'peg';
      doc.legs.left.type = 'robot';
    });
    assert.ok(character.root.getObjectByName('pegRMesh'));
    assert.equal(character.root.getObjectByName('thighRMesh'), undefined);
    assert.ok(character.root.getObjectByName('thighLMesh'));
    assert.ok(character.root.getObjectByName('shinLMesh'));
    assert.equal(character.root.getObjectByName('pelvisMesh'), undefined);
    assert.equal(character.root.getObjectByName('footLMesh'), undefined);
    assert.equal(character.root.getObjectByName('footRMesh'), undefined);
    const shoes = character.root.getObjectByName('clothingShoes');
    assert.ok(shoes);
    assert.ok(shoes.geometry.attributes.position.count < 40);
  });

  it('sizes the skirt from the stride and keeps the knee balls', () => {
    const character = wear((doc) => {
      doc.clothing.bottom = { id: 'skirt', color: '#222222' };
    });
    const spec = character.getResolved();
    const gap = shellGap(spec.height);
    const skirt = character.root.getObjectByName('clothingBottom');
    assert.equal(skirt.geometry.attributes.position.count, 16);
    assert.ok(skirt.userData.hemRadius >= spec.hipWidth / 2 + spec.radii.knee + gap);
    assert.equal(character.root.getObjectByName('pelvisMesh'), undefined);
    assert.ok(character.root.getObjectByName('thighLMesh'));
    assert.ok(character.root.getObjectByName('kneeLMesh'));
  });

  it('puts the sole on the accent and keeps the markers at that sole', () => {
    const character = wear((doc) => {
      doc.clothing.shoes = { id: 'sneakers', color: '#111111', accent: '#f2f2f2' };
    });
    const shoes = character.root.getObjectByName('clothingShoes');
    assert.ok(Array.isArray(shoes.material));
    assert.equal(shoes.material.length, 2);
    assert.equal(shoes.material[0].color.getHexString(), 'f2f2f2');
    assert.equal(shoes.material[1].color.getHexString(), '111111');
    assert.equal(shoes.material[0].polygonOffset, false);
    assert.ok(shoes.geometry.groups.length >= 2);
    assert.equal(character.root.getObjectByName('footLMesh'), undefined);
    const spec = character.getResolved();
    character.update(0, { anim: 'idle', time: 0, speed: 0, freeze: true });
    character.root.updateMatrixWorld(true);
    const ankle = character.joints.ankleL;
    const point = new Vector3();
    let minY = Infinity;
    const pos = shoes.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      shoes.getVertexPosition(i, point);
      shoes.localToWorld(point);
      ankle.worldToLocal(point);
      if (Math.abs(point.x) < spec.footWidth && Math.abs(point.z - spec.footCenterZ) < spec.footLength) {
        minY = Math.min(minY, point.y);
      }
    }
    assert.ok(Math.abs(minY - soleY(spec)) < 1e-3, `${minY} vs ${soleY(spec)}`);
    const world = new Vector3();
    for (const name of ['footLHeel', 'footLToe', 'footRHeel', 'footRToe']) {
      const y = character.root.getObjectByName(name).getWorldPosition(world).y;
      assert.ok(Math.abs(y) < 2e-3, name);
    }

    const boots = wear((doc) => {
      doc.clothing.shoes = { id: 'boots', color: '#222222', accent: '#eeeeee' };
    });
    const shin = boots.root.getObjectByName('shinLMesh');
    assert.ok(shin.position.y > -boots.getResolved().shinLength / 2 + 0.01);
    boots.root.updateMatrixWorld(true);
    const bootMesh = boots.root.getObjectByName('clothingShoes');
    const bootAnkle = boots.joints.ankleL;
    let maxY = -Infinity;
    const bootPos = bootMesh.geometry.attributes.position;
    for (let i = 0; i < bootPos.count; i += 1) {
      bootMesh.getVertexPosition(i, point);
      bootMesh.localToWorld(point);
      bootAnkle.worldToLocal(point);
      maxY = Math.max(maxY, point.y);
    }
    assert.ok(maxY > boots.getResolved().radii.ankle, 'boot cuff climbs the shin');
  });

  it('gives a robot leg a shoe and no cuff, and rejects a top on a robot torso', () => {
    const character = wear((doc) => {
      doc.legs.left.type = 'robot';
      doc.clothing.shoes = { id: 'boots', color: '#222222', accent: '#eeeeee' };
    });
    const spec = character.getResolved();
    const shin = character.root.getObjectByName('shinLMesh');
    assert.equal(shin.geometry.userData.height, spec.shinLength);
    assert.ok(Math.abs(shin.position.y + spec.shinLength) < 1e-4);
    assert.equal(character.root.getObjectByName('footLMesh'), undefined);
    assert.ok(character.root.getObjectByName('clothingShoes'));

    const robot = defaultDocument();
    robot.body.torso = 'robot';
    robot.clothing.top = { id: 'tee', color: '#3a5a40' };
    assert.throws(() => createCharacter(robot), /cannot wear a top/);
  });

  it('clears a robot torso top and brings the chest back when a tee comes off', () => {
    const character = createCharacter();
    character.updateDocument((doc) => {
      doc.body.torso = 'robot';
      doc.clothing.top.id = 'tee';
      doc.clothing.outer.id = 'jacket';
    });
    const cleared = character.getDocument();
    assert.equal(cleared.body.torso, 'robot');
    assert.equal(cleared.clothing.top.id, 'none');
    assert.equal(cleared.clothing.outer.id, 'none');
    assert.ok(character.root.getObjectByName('chestMesh'));

    const dressed = createCharacter();
    dressed.updateDocument((doc) => { doc.clothing.top.id = 'tee'; });
    assert.equal(dressed.root.getObjectByName('chestMesh'), undefined);
    dressed.updateDocument((doc) => { doc.clothing.top.id = 'none'; });
    assert.ok(dressed.root.getObjectByName('chestMesh'));
    assert.equal(dressed.joints.waist.userData.block, undefined);
    assert.ok(dressed.root.getObjectByName('upperArmLMesh'));
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
    assert.ok(open.getStats().vertices > hatted.getStats().vertices);
  });

  it('stays under 2200 verts with every slot filled and round-trips', () => {
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
    assert.ok(filled.getStats().vertices < 2200, String(filled.getStats().vertices));
    const again = createCharacter(filled.getDocument());
    assert.deepEqual(again.getDocument(), filled.getDocument());
    assert.equal(again.getStats().vertices, filled.getStats().vertices);

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
    const mixed = wear((doc) => {
      doc.body.torso = 'robot';
      doc.arms.left.type = 'robot';
      doc.arms.right.type = 'skeleton';
      doc.arms.right.hand = 'hook';
      doc.legs.left.type = 'robot';
      doc.legs.right.type = 'peg';
      doc.clothing.bottom = { id: 'pants', color: '#222233' };
      doc.clothing.shoes = { id: 'boots', color: '#111111', accent: '#eeeeee' };
      doc.animation.walkStyle = 'stomp';
    });
    assert.ok(full.getStats().vertices < 2200, String(full.getStats().vertices));
    assert.equal(mixed.root.getObjectByName('chestMesh') === undefined, false);
    assert.equal(mixed.root.getObjectByName('clothingTop'), undefined);
    assert.ok(mixed.root.getObjectByName('pegRMesh'));
    assert.ok(mixed.root.getObjectByName('upperArmLMesh'));
    assert.ok(mixed.root.getObjectByName('upperArmRMesh'));

    const counts = {
      naked: 1421,
      teePantsSneakers: casual.getStats().vertices,
      fullyDressed: full.getStats().vertices,
      robotMixed: mixed.getStats().vertices,
      everySlot: filled.getStats().vertices,
    };
    console.log(`CLOTHING ${JSON.stringify(counts)}`);
    assert.equal(counts.naked, 1421);
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
    assert.equal(dressed.root.getObjectByName('chestMesh'), undefined);

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
    const saved = createCharacter(mixed.getDocument());
    assert.deepEqual(saved.getDocument(), mixed.getDocument());
  });
});
