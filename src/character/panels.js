import { getRegistry } from './registry.js';

/** Body fields plus the torso slot. Presets write the numeric sliders. */
export const SHOULDER_WIDTH = { min: 0.18, max: 0.44, step: 0.005 };

export const BODY_CONTROLS = [
  {
    id: 'presentation',
    kind: 'choice',
    label: 'Presentation',
    options: [
      { id: 'man', label: 'Man' },
      { id: 'woman', label: 'Woman' },
    ],
  },
  {
    id: 'bodyType',
    kind: 'choice',
    label: 'Body type',
    options: [
      { id: 'slim', label: 'Slim' },
      { id: 'average', label: 'Average' },
      { id: 'broad', label: 'Broad' },
      { id: 'heavy', label: 'Heavy' },
    ],
  },
  { id: 'torso', kind: 'slot', slot: 'body.torso', label: 'Torso' },
  { id: 'height', kind: 'range', label: 'Height', min: 1.35, max: 2.15, step: 0.01, unit: 'm' },
  { id: 'shoulder', kind: 'range', label: 'Shoulder width', min: SHOULDER_WIDTH.min, max: SHOULDER_WIDTH.max, step: SHOULDER_WIDTH.step, unit: 'm' },
  { id: 'belly', kind: 'range', label: 'Belly', min: 0.08, max: 0.7, step: 0.005, unit: 'm' },
  { id: 'hip', kind: 'range', label: 'Hip width', min: 0.1, max: 0.46, step: 0.005, unit: 'm' },
  { id: 'thick', kind: 'range', label: 'Limb thickness', min: 0.65, max: 1.7, step: 0.01 },
  { id: 'skin', kind: 'color', label: 'Skin' },
];

export const ARMS_CONTROLS = [
  { id: 'armL', kind: 'slot', slot: 'arms.left', label: 'Left arm' },
  { id: 'armLColor', kind: 'color', label: 'Left color', nullable: true },
  { id: 'handL', kind: 'slot', slot: 'arms.left.hand', label: 'Left hand' },
  { id: 'armR', kind: 'slot', slot: 'arms.right', label: 'Right arm' },
  { id: 'armRColor', kind: 'color', label: 'Right color', nullable: true },
  { id: 'handR', kind: 'slot', slot: 'arms.right.hand', label: 'Right hand' },
];

export const LEGS_CONTROLS = [
  { id: 'legL', kind: 'slot', slot: 'legs.left', label: 'Left leg' },
  { id: 'legLColor', kind: 'color', label: 'Left color', nullable: true },
  { id: 'legR', kind: 'slot', slot: 'legs.right', label: 'Right leg' },
  { id: 'legRColor', kind: 'color', label: 'Right color', nullable: true },
];

export const HEAD_CONTROLS = [
  { id: 'shape', kind: 'slot', slot: 'head.shape', label: 'Shape' },
  { id: 'headSize', kind: 'range', label: 'Head size', min: 0.1, max: 0.28, step: 0.005, unit: 'm' },
  { id: 'hair', kind: 'slot', slot: 'head.hair', label: 'Hair' },
  { id: 'hairColor', kind: 'color', label: 'Hair color' },
  { id: 'hairHighlight', kind: 'color', label: 'Highlight', nullable: true, clearLabel: 'None' },
  { id: 'facialHair', kind: 'slot', slot: 'head.facialHair', label: 'Facial hair' },
  { id: 'ears', kind: 'slot', slot: 'head.ears', label: 'Ears' },
  { id: 'earrings', kind: 'slot', slot: 'head.earrings', label: 'Earrings' },
  { id: 'earringColor', kind: 'color', label: 'Earring color' },
  { id: 'headwear', kind: 'slot', slot: 'head.headwear', label: 'Headwear' },
  { id: 'headwearColor', kind: 'color', label: 'Headwear color' },
  { id: 'eyewear', kind: 'slot', slot: 'head.eyewear', label: 'Eyewear' },
  { id: 'eyewearColor', kind: 'color', label: 'Eyewear color' },
];

export const CLOTHES_CONTROLS = [
  { id: 'top', kind: 'slot', slot: 'clothing.top', label: 'Top' },
  { id: 'topColor', kind: 'color', label: 'Top color' },
  { id: 'outer', kind: 'slot', slot: 'clothing.outer', label: 'Outer' },
  { id: 'outerColor', kind: 'color', label: 'Outer color' },
  { id: 'bottom', kind: 'slot', slot: 'clothing.bottom', label: 'Bottom' },
  { id: 'bottomColor', kind: 'color', label: 'Bottom color' },
  { id: 'shoes', kind: 'slot', slot: 'clothing.shoes', label: 'Shoes' },
  { id: 'shoeColor', kind: 'color', label: 'Shoe color' },
  { id: 'shoeAccent', kind: 'color', label: 'Sole' },
];

export const MOTION_CONTROLS = [
  { id: 'walkStyle', kind: 'slot', slot: 'animation.walkStyle', label: 'Walk style' },
  { id: 'anim', kind: 'select', label: 'Movement' },
  { id: 'speed', kind: 'range', label: 'Speed', min: 0, max: 8, step: 0.05, unit: 'm/s' },
  { id: 'wire', kind: 'check', label: 'Wireframe' },
  { id: 'turn', kind: 'check', label: 'Turntable', checked: true },
];

function expandControl(control) {
  if (control.kind !== 'slot') {
    return {
      ...control,
      options: control.options?.map((option) => ({ ...option })),
    };
  }
  const options = getRegistry().parts(control.slot).map((part) => ({
    id: part.id,
    label: part.label,
  }));
  return { ...control, kind: 'choice', options };
}

/** Sections that have controls. Empty catalogue sections stay in the registry. */
export function panelSections() {
  return getRegistry().sections()
    .filter((section) => section.controls.length > 0)
    .map((section) => ({
      ...section,
      controls: section.controls.map(expandControl),
    }));
}
