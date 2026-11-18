import { meetingPlan } from '../src/meeting/layout.js';
import { bedroomPlan } from '../src/bedroom/layout.js';
import { studioPlan } from '../src/studio/layout.js';

const rooms = [
  ['meeting', meetingPlan],
  ['bedroom', bedroomPlan],
  ['studio', studioPlan],
];

let failed = 0;
for (const [name, plan] of rooms) {
  if (plan(0) !== null) {
    failed++;
    console.log(`${name} seed 0 should keep the hand-made layout`);
  }
  for (let seed = 1; seed <= 50; seed++) {
    let a;
    let b;
    try {
      a = plan(seed);
      b = plan(seed);
    } catch (err) {
      failed++;
      console.log(`${name} seed ${seed}: ${err.message}`);
      continue;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      failed++;
      console.log(`${name} seed ${seed}: not deterministic`);
    }
  }
}
if (failed) {
  console.log(`FAILED ${failed}`);
  process.exit(1);
}
console.log('ok: seeds 0 and 1-50 for meeting, bedroom, studio');
