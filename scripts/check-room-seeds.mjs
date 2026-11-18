// Bounding-box check for seeded room kits. Seeds 1–50 must stay inside the
// room, miss each other, and leave a connected walk from the door to every
// functional spot. Seed 0 is the hand-made layout: overlaps and bounds only.
//
// Run: node scripts/check-room-seeds.mjs

import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

const { cafePlan, cafeFloorBoxes } = await server.ssrLoadModule('/src/cafe/arrange.js');
const { classroomPlan, classroomFloorBoxes } = await server.ssrLoadModule('/src/classroom/arrange.js');
const { openOfficePlan, openOfficeFloorBoxes } = await server.ssrLoadModule('/src/openoffice/arrange.js');
const { planProblems } = await server.ssrLoadModule('/src/lib/roomPlan.js');

const kits = [
  ['cafe', cafePlan, cafeFloorBoxes],
  ['classroom', classroomPlan, classroomFloorBoxes],
  ['open office', openOfficePlan, openOfficeFloorBoxes],
];

let failed = 0;
for (const [name, planFn, boxesFn] of kits) {
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
}

await server.close();
if (failed) {
  console.error(`${failed} failing seed checks`);
  process.exit(1);
}
console.log('ok: cafe, classroom, open office — seeds 0–50 inside, clear, and deterministic');
