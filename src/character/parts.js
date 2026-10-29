import { ANIMATIONS } from '../body/animate.js';
import { BODY_CONTROLS, MOTION_CONTROLS } from './panels.js';
import { registerPart, registerSection, registerSlot } from './registry.js';

const empty = () => {};

function slot(id, section, label) {
  registerSlot(id, { section, label });
}

function part(slotId, id, label, extra = {}) {
  registerPart(slotId, id, { label, build: empty, ...extra });
}

function mirror(slotIds, entries) {
  for (const slotId of slotIds) {
    for (const [id, label, extra] of entries) part(slotId, id, label, extra);
  }
}

registerSection('body', { label: 'Body', controls: BODY_CONTROLS });
registerSection('head', { label: 'Head' });
registerSection('arms', { label: 'Arms' });
registerSection('legs', { label: 'Legs' });
registerSection('clothes', { label: 'Clothes' });
registerSection('gear', { label: 'Gear' });
registerSection('motion', { label: 'Motion', controls: MOTION_CONTROLS });

slot('body.torso', 'body', 'Torso');
part('body.torso', 'normal', 'Normal');
part('body.torso', 'robot', 'Robot');

slot('head.shape', 'head', 'Head shape');
part('head.shape', 'classic', 'Classic');
part('head.shape', 'round', 'Round');
part('head.shape', 'long', 'Long');
part('head.shape', 'box', 'Box');

slot('head.hair', 'head', 'Hair');
for (const [id, label] of [
  ['none', 'None'],
  ['buzz', 'Buzz'],
  ['bob', 'Bob'],
  ['ponytail', 'Ponytail'],
  ['spikes', 'Spikes'],
  ['long', 'Long'],
  ['mohawk', 'Mohawk'],
  ['afro', 'Afro'],
]) part('head.hair', id, label);

slot('head.facialHair', 'head', 'Facial hair');
part('head.facialHair', 'none', 'None');
part('head.facialHair', 'moustache', 'Moustache');
part('head.facialHair', 'beard', 'Beard');

slot('head.ears', 'head', 'Ears');
part('head.ears', 'normal', 'Normal');
part('head.ears', 'elf', 'Elf');
part('head.ears', 'cat', 'Cat');
part('head.ears', 'antenna', 'Robot antenna');

slot('head.earrings', 'head', 'Earrings');
part('head.earrings', 'none', 'None');
part('head.earrings', 'stud', 'Stud');
part('head.earrings', 'hoop', 'Hoop');

slot('head.headwear', 'head', 'Headwear');
for (const [id, label] of [
  ['none', 'None'],
  ['cap', 'Cap'],
  ['beanie', 'Beanie'],
  ['hat', 'Hat'],
  ['helmet', 'Helmet'],
  ['crown', 'Crown'],
  ['headband', 'Headband'],
  ['horns', 'Horns'],
]) part('head.headwear', id, label);

slot('head.eyewear', 'head', 'Eyewear');
part('head.eyewear', 'none', 'None');
part('head.eyewear', 'glasses', 'Glasses');
part('head.eyewear', 'sunglasses', 'Sunglasses');
part('head.eyewear', 'visor', 'Visor');
part('head.eyewear', 'goggles', 'Goggles');

slot('arms.left', 'arms', 'Left arm');
slot('arms.right', 'arms', 'Right arm');
mirror(['arms.left', 'arms.right'], [
  ['normal', 'Normal'],
  ['muscular', 'Muscular'],
  ['robot', 'Robot'],
  ['skeleton', 'Skeleton'],
]);

slot('arms.left.wrist', 'arms', 'Left wrist');
slot('arms.right.wrist', 'arms', 'Right wrist');
mirror(['arms.left.wrist', 'arms.right.wrist'], [
  ['none', 'None'],
  ['band', 'Band'],
  ['cuff', 'Cuff'],
]);

slot('legs.left', 'legs', 'Left leg');
slot('legs.right', 'legs', 'Right leg');
mirror(['legs.left', 'legs.right'], [
  ['normal', 'Normal'],
  ['robot', 'Robot'],
  ['peg', 'Peg leg'],
]);

slot('clothing.top', 'clothes', 'Top');
part('clothing.top', 'none', 'None');
part('clothing.top', 'tank', 'Tank', { covers: ['chest'] });
part('clothing.top', 'tee', 'T-shirt', { covers: ['chest', 'upperArmL', 'upperArmR'] });
part('clothing.top', 'shirt', 'Shirt', { covers: ['chest', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR'] });
part('clothing.top', 'hoodie', 'Hoodie', { covers: ['chest', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR'] });

slot('clothing.outer', 'clothes', 'Outer');
part('clothing.outer', 'none', 'None');
part('clothing.outer', 'jacket', 'Jacket', { covers: ['chest', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR'] });
part('clothing.outer', 'vest', 'Vest', { covers: ['chest'] });
part('clothing.outer', 'cape', 'Cape');

slot('clothing.bottom', 'clothes', 'Bottom');
part('clothing.bottom', 'none', 'None');
part('clothing.bottom', 'pants', 'Pants', { covers: ['pelvis', 'thighL', 'thighR', 'shinL', 'shinR'] });
part('clothing.bottom', 'shorts', 'Shorts', { covers: ['pelvis', 'thighL', 'thighR'] });
part('clothing.bottom', 'skirt', 'Skirt', { covers: ['pelvis'] });

slot('clothing.shoes', 'clothes', 'Shoes');
part('clothing.shoes', 'barefoot', 'Barefoot');
part('clothing.shoes', 'sneakers', 'Sneakers', { covers: ['footL', 'footR'] });
part('clothing.shoes', 'boots', 'Boots', { covers: ['footL', 'footR', 'shinL', 'shinR'] });
part('clothing.shoes', 'flats', 'Flats', { covers: ['footL', 'footR'] });

slot('back', 'gear', 'Back');
part('back', 'none', 'None');
part('back', 'bag', 'Bag');
part('back', 'backpack', 'Backpack');
part('back', 'wings', 'Wings');

slot('hands.left', 'gear', 'Left hand');
slot('hands.right', 'gear', 'Right hand');
mirror(['hands.left', 'hands.right'], [
  ['none', 'None'],
  ['phone', 'Phone'],
  ['cup', 'Cup'],
  ['book', 'Book'],
  ['stick', 'Stick'],
  ['balloon', 'Balloon'],
]);

slot('animation.dance', 'motion', 'Default dance');
part('animation.dance', 'none', 'None');
for (const item of ANIMATIONS) {
  if (item.kind === 'dance') part('animation.dance', item.id, item.label);
}

slot('animation.walkStyle', 'motion', 'Walk style');
part('animation.walkStyle', 'normal', 'Normal');
part('animation.walkStyle', 'stomp', 'Robot stomp');
part('animation.walkStyle', 'swagger', 'Swagger');
