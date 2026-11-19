// Bounding-box and determinism checks for seeded room kits.
// Clinic, police and minimarket: seeds 1–50 must not overlap, leave the room,
// or block a 0.9 m walkway. Seed 0 is the hand-made layout (overlaps only).
// Meeting, bedroom and studio: seed 0 stays the hand-made layout (the plan
// returns null), and seeds 1–50 rebuild the same arrangement twice.
//
//   node scripts/check-room-seeds.mjs

import { createServer } from 'vite';
import { meetingPlan } from '../src/meeting/layout.js';
import { bedroomPlan } from '../src/bedroom/layout.js';
import { studioPlan } from '../src/studio/layout.js';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const clinic = await server.ssrLoadModule('/src/clinic/layout.js');
const police = await server.ssrLoadModule('/src/police/layout.js');
const market = await server.ssrLoadModule('/src/minimarket/layout.js');

const rooms = [
  ['clinic', clinic.clinicLayout, clinic.clinicIssues],
  ['police', police.policeLayout, police.policeIssues],
  ['minimarket', market.minimarketLayout, market.minimarketIssues],
];

let failed = 0;
for (const [name, layout, issues] of rooms) {
  const a = JSON.stringify(layout(0));
  const b = JSON.stringify(layout(0));
  if (a !== b) {
    console.error(`${name} seed 0 is not stable`);
    failed++;
  }
  for (let seed = 0; seed <= 50; seed++) {
    let one;
    let errs = [];
    try {
      one = JSON.stringify(layout(seed));
      if (one !== JSON.stringify(layout(seed))) {
        console.error(`${name} seed ${seed} is not deterministic`);
        failed++;
      }
      errs = issues(seed);
    } catch (e) { errs = [e.message]; }
    if (errs.length) {
      failed++;
      console.error(`${name} seed ${seed}: ${errs.slice(0, 8).join('; ')}`);
    }
  }
  const varied = new Set();
  for (let seed = 1; seed <= 50; seed++) {
    try { varied.add(JSON.stringify(layout(seed).placements)); } catch { /* already reported */ }
  }
  console.log(`${name}: ${varied.size} distinct layouts in seeds 1-50`);
}

const interiors = [
  ['meeting', meetingPlan],
  ['bedroom', bedroomPlan],
  ['studio', studioPlan],
];
for (const [name, plan] of interiors) {
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

await server.close();
if (failed) {
  console.error(`${failed} seed check(s) failed`);
  process.exit(1);
}
console.log('room seeds 0-50 ok');
console.log('ok: seeds 0 and 1-50 for meeting, bedroom, studio');
