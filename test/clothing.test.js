import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DoubleSide, Vector3 } from 'three';
import {
  ANIMATIONS,
  createBody,
  createCharacter,
  defaultDocument,
} from '../src/body/index.js';
import { clothPad } from '../src/character/clothing.js';

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
  if (mesh.geometry.parameters && 'openEnded' in mesh.geometry.parameters) {
    assert.equal(mesh.geometry.parameters.openEnded, false, mesh.name);
  }
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
    assert.equal(top.geometry.type, 'BoxGeometry');
    assertClosedShell(top);
    const params = top.geometry.parameters;
    assert.ok(params.width > spec.chestTopWidth);
    assert.ok(params.depth > spec.chestTopDepth);
    assert.ok(top.position.y - params.height / 2 < 0, 'shirt covers the waist');
    assert.ok(top.position.y + params.height / 2 > spec.chestHeight * 0.7, 'shirt reaches the neck');
    const sleeve = character.joints.shoulderL.getObjectByName('clothingTopUpperL');
    assert.equal(sleeve.parent, character.joints.shoulderL);
    assert.equal(sleeve.geometry.parameters.openEnded, false);
    assert.equal(character.joints.elbowL.getObjectByName('clothingTopForearmL'), undefined);
    assert.ok(character.root.getObjectByName('forearmLMesh'));
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
    assert.ok(top.geometry.parameters.width < vest.geometry.parameters.width);
    assert.ok(top.geometry.parameters.depth < vest.geometry.parameters.depth);
    assert.ok(top.geometry.parameters.height > vest.geometry.parameters.height);
    assert.equal(character.joints.shoulderL.children.some((child) => child.userData.garment), false);
    const thigh = character.joints.hipL.getObjectByName('clothingBottomThighL');
    assert.equal(thigh.parent, character.joints.hipL);
    assert.equal(thigh.geometry.parameters.openEnded, false);
    assert.equal(character.root.getObjectByName('clothingBottomShinL'), undefined);
    for (const mesh of garments(character.root)) assertClosedShell(mesh);
    character.root.updateMatrixWorld(true);
    const corners = [];
    const { width, height, depth } = vest.geometry.parameters;
    for (const x of [-width / 2, width / 2]) {
      for (const y of [-height / 2, height / 2]) {
        for (const z of [-depth / 2, depth / 2]) {
          corners.push(vest.localToWorld(new Vector3(x, y, z)));
        }
      }
    }
    const xs = corners.map((corner) => corner.x);
    const zs = corners.map((corner) => corner.z);
    assert.ok(Math.min(...xs) < -0.05 && Math.max(...xs) > 0.05, 'vest has both sides');
    assert.ok(Math.min(...zs) < -0.02 && Math.max(...zs) > 0.02, 'vest has a front and a back');
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
    assert.equal(skirt.geometry.parameters.openEnded, false);
    assert.ok(skirt.userData.hemRadius >= spec.hipWidth / 2 + spec.radii.knee + pad);
    assert.ok(character.root.getObjectByName('pelvisMesh'));
    assert.ok(character.root.getObjectByName('thighLMesh'));
    assertClosedShell(skirt);
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
    assert.ok(open.root.getObjectByName('clothingTopHood'));
    assert.equal(hatted.root.getObjectByName('clothingTopHood'), undefined);
    assert.ok(open.getStats().vertices > hatted.getStats().vertices);
    assertClosedShell(open.root.getObjectByName('clothingTopHood'));
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
    const counts = {
      naked: 1421,
      teePantsSneakers: casual.getStats().vertices,
      fullyDressed: full.getStats().vertices,
      everySlot: filled.getStats().vertices,
    };
    console.log(`CLOTHING ${JSON.stringify(counts)}`);
    assert.equal(counts.naked, 1421);
    assert.ok(counts.teePantsSneakers > 1421);
    assert.ok(counts.fullyDressed > counts.teePantsSneakers);
    assert.ok(counts.fullyDressed < 2200, String(counts.fullyDressed));
    assert.ok(counts.everySlot < 2200, String(counts.everySlot));
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
