import { bench, busStop, bollard, hydrant, postBox, streetLamp, trashBin } from './furniture.js';
import { cone, crosswalk, streetSign, trafficLight } from './traffic.js';
import { bicycle, car, scooter } from './vehicles.js';
import { phoneBooth, planter, utilityPole, vendingMachine } from './extras.js';
import { bikeRack, paperLantern, sandwichBoard, stoneLantern } from './japan.js';

// All street props, grouped as in the plan (A furniture, B traffic, C vehicles, D extras).
export const PROP_GROUPS = [
  { label: 'Street furniture', props: [bench, streetLamp, trashBin, bollard, hydrant, postBox, busStop] },
  { label: 'Traffic and signs', props: [trafficLight, streetSign, cone, crosswalk] },
  { label: 'Vehicles', props: [car, bicycle, scooter] },
  { label: 'Extras', props: [planter, vendingMachine, phoneBooth, utilityPole] },
  { label: 'Japanese street', props: [stoneLantern, paperLantern, sandwichBoard, bikeRack] },
];
export const PROPS = PROP_GROUPS.flatMap((g) => g.props);

/**
 * Wrap one prop variant as a "subject" so the viewer's Cell can show it like
 * the characters (gallery cell, inspection view, street scene).
 */
export function propSubject(prop, variant, color) {
  return {
    id: `${prop.id}:${variant}:${color ?? ''}`,
    label: prop.variants.length > 1 ? `${prop.label} · ${variant}` : prop.label,
    isProp: true,
    schema: {},
    build: (_params, style) => {
      const g = prop.build({ variant, color }, style);
      g.name = prop.id;
      return g;
    },
  };
}

/** Every prop variant, with a varied colour for vehicles. */
export function allPropSubjects() {
  const out = [];
  for (const prop of PROPS) {
    prop.variants.forEach((v, i) => {
      const color = prop.colors ? prop.colors[(i * 3 + prop.id.length) % prop.colors.length] : undefined;
      out.push(propSubject(prop, v, color));
    });
  }
  return out;
}
