import { getRegistry } from './registry.js';

/** Controls that already exist on the mannequin preview. Later slots add their own. */
export const BODY_CONTROLS = [
  { id: 'height', kind: 'range', label: 'Height', min: 1.35, max: 2.15, step: 0.01, unit: 'm' },
  { id: 'shoulder', kind: 'range', label: 'Shoulder width', min: 0.28, max: 0.72, step: 0.005, unit: 'm' },
  { id: 'hip', kind: 'range', label: 'Hip width', min: 0.16, max: 0.46, step: 0.005, unit: 'm' },
  { id: 'thick', kind: 'range', label: 'Limb thickness', min: 0.65, max: 1.7, step: 0.01 },
  { id: 'skin', kind: 'color', label: 'Skin' },
];

export const MOTION_CONTROLS = [
  { id: 'anim', kind: 'select', label: 'Movement' },
  { id: 'speed', kind: 'range', label: 'Speed', min: 0, max: 8, step: 0.05, unit: 'm/s' },
  { id: 'wire', kind: 'check', label: 'Wireframe' },
  { id: 'turn', kind: 'check', label: 'Turntable', checked: true },
];

/** Sections that have controls. Empty catalogue sections stay in the registry. */
export function panelSections() {
  return getRegistry().sections().filter((section) => section.controls.length > 0);
}
