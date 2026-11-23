// Bounding-box and determinism checks for seeded room kits.
// Clinic, police and minimarket: seeds 1–50 must not overlap, leave the room,
// or block a 0.9 m walkway. Seed 0 is the hand-made layout (overlaps only).
// Meeting, bedroom and studio: seed 0 stays the hand-made layout (the plan
// returns null), and seeds 1–50 rebuild the same arrangement twice.
// Studio seeds 0–50 also keep the TV facing the sofa, with the screen in
// the iso camera's half-space (the catalogue never sees the TV's back).
// Cafe, classroom, open office, ramen, kitchen, library, dojo and station:
// seeds 1–50 stay inside, miss each other, and leave a connected walk. Seed 0
// is overlaps and bounds only. Ramen, kitchen and library also keep their
// fixed anchors and point chairs (and ramen stools) at the table or counter.
// Dojo varies the mat/gym split. Station keeps the gates and the platform
// edge fixed.
//
//   node scripts/check-room-seeds.mjs

import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { meetingPlan } from '../src/meeting/layout.js';
import { bedroomPlan } from '../src/bedroom/layout.js';
import { studioPlan, studioScreenProblems } from '../src/studio/layout.js';

const studioHandmade = JSON.parse(readFileSync(new URL('../public/studio-kit/layout.json', import.meta.url), 'utf8'));

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const clinic = await server.ssrLoadModule('/src/clinic/layout.js');
const police = await server.ssrLoadModule('/src/police/layout.js');
const market = await server.ssrLoadModule('/src/minimarket/layout.js');
const { cafePlan, cafeFloorBoxes } = await server.ssrLoadModule('/src/cafe/arrange.js');
const { classroomPlan, classroomFloorBoxes } = await server.ssrLoadModule('/src/classroom/arrange.js');
const { openOfficePlan, openOfficeFloorBoxes } = await server.ssrLoadModule('/src/openoffice/arrange.js');
const { ramenPlan, ramenFloorBoxes, ramenExtraErrors } = await server.ssrLoadModule('/src/ramen/arrange.js');
const { kitchenPlan, kitchenFloorBoxes, kitchenExtraErrors } = await server.ssrLoadModule('/src/kitchen/arrange.js');
const { libraryPlan, libraryFloorBoxes, libraryExtraErrors } = await server.ssrLoadModule('/src/library/arrange.js');
const { planProblems } = await server.ssrLoadModule('/src/lib/roomPlan.js');

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
function reportScreen(name, seed, placements) {
  const face = studioScreenProblems(placements);
  if (!face.length) return;
  failed++;
  console.log(`${name} seed ${seed}: ${face.join('; ')}`);
}

for (const [name, plan] of interiors) {
  if (plan(0) !== null) {
    failed++;
    console.log(`${name} seed 0 should keep the hand-made layout`);
  }
  if (name === 'studio') reportScreen(name, 0, studioHandmade.placements);
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
    if (name === 'studio') reportScreen(name, seed, a.placements);
  }
}

const kits = [
  ['cafe', cafePlan, cafeFloorBoxes, null],
  ['classroom', classroomPlan, classroomFloorBoxes, null],
  ['open office', openOfficePlan, openOfficeFloorBoxes, null],
  ['ramen', ramenPlan, ramenFloorBoxes, ramenExtraErrors],
  ['kitchen', kitchenPlan, kitchenFloorBoxes, kitchenExtraErrors],
  ['library', libraryPlan, libraryFloorBoxes, libraryExtraErrors],
];
for (const [name, planFn, boxesFn, extraFn] of kits) {
  for (let seed = 0; seed <= 50; seed++) {
    const plan = planFn(seed);
    const again = planFn(seed);
    if (JSON.stringify(again) !== JSON.stringify(plan)) {
      failed += 1;
      console.log(`${name} seed ${seed}: not deterministic`);
    }
    const boxes = boxesFn(plan);
    const errs = seed === 0
      ? planProblems({ ...plan, keepOut: null, goals: null, door: null }, boxes)
      : planProblems(plan, boxes);
    if (extraFn) errs.push(...extraFn(plan));
    if (errs.length) {
      failed += 1;
      console.log(`${name} seed ${seed}:`);
      for (const e of errs.slice(0, 12)) console.log(`  ${e}`);
      if (errs.length > 12) console.log(`  … ${errs.length - 12} more`);
    }
  }
}

const { dojoPlan, dojoFloorBoxes } = await server.ssrLoadModule('/src/dojo/arrange.js');
const { stationPlan, stationFloorBoxes } = await server.ssrLoadModule('/src/station/arrange.js');
const addedKits = [
  ['dojo', dojoPlan, dojoFloorBoxes],
  ['station', stationPlan, stationFloorBoxes],
];
for (const [name, planFn, boxesFn] of addedKits) {
  for (let seed = 0; seed <= 50; seed++) {
    const plan = planFn(seed);
    const again = planFn(seed);
    if (JSON.stringify(again) !== JSON.stringify(plan)) {
      failed += 1;
      console.log(`${name} seed ${seed}: not deterministic`);
    }
    const boxes = boxesFn(plan);
    const errs = seed === 0
      ? planProblems({ ...plan, keepOut: null, goals: null, door: null }, boxes)
      : planProblems(plan, boxes);
    if (errs.length) {
      failed += 1;
      console.log(`${name} seed ${seed}:`);
      for (const e of errs.slice(0, 12)) console.log(`  ${e}`);
      if (errs.length > 12) console.log(`  … ${errs.length - 12} more`);
    }
  }
  const varied = new Set();
  for (let seed = 1; seed <= 50; seed++) {
    try { varied.add(JSON.stringify(planFn(seed).placements)); } catch { /* already reported */ }
  }
  console.log(`${name}: ${varied.size} distinct layouts in seeds 1-50`);
}

await server.close();
if (failed) {
  console.error(`${failed} seed check(s) failed`);
  process.exit(1);
}
console.log('room seeds 0-50 ok');
console.log('ok: seeds 0 and 1-50 for meeting, bedroom, studio');
console.log('ok: studio seeds 0-50 — tv faces the sofa and the iso camera');
console.log('ok: cafe, classroom, open office, ramen, kitchen, library — seeds 0–50 inside, clear, and deterministic');
console.log('ok: dojo, station — seeds 0–50 inside, clear, and deterministic');
