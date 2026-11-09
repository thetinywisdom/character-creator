import { bench, busStop, bollard, hydrant, postBox, streetLamp, trashBin } from './furniture.js';
import { cone, crosswalk, streetSign, trafficLight } from './traffic.js';
import { bicycle, bus, car, scooter } from './vehicles.js';
import { bananaPeel, phoneBooth, planter, utilityPole, vendingMachine } from './extras.js';
import { bikeRack, paperLantern, sandwichBoard, stoneLantern } from './japan.js';

// All street props, grouped as in the plan (A furniture, B traffic, C vehicles, D extras).
export const PROP_GROUPS = [
  { label: 'Street furniture', props: [bench, streetLamp, trashBin, bollard, hydrant, postBox, busStop] },
  { label: 'Traffic and signs', props: [trafficLight, streetSign, cone, crosswalk] },
  { label: 'Vehicles', props: [car, bus, bicycle, scooter] },
  { label: 'Extras', props: [planter, vendingMachine, phoneBooth, utilityPole, bananaPeel] },
  { label: 'Japanese street', props: [stoneLantern, paperLantern, sandwichBoard, bikeRack] },
];
export const PROPS = PROP_GROUPS.flatMap((g) => g.props);
