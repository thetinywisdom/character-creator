import assert from 'node:assert/strict';
import layout from '../../public/office-kit/layout.json' with { type: 'json' };
import { officeLayout, officeLayoutIssues, officeSeed, officeTriangleCount } from './seedLayout.js';

const authored = officeLayoutIssues(layout.placements);
assert.deepEqual(authored, [], `authored room should pass: ${authored.join('; ')}`);

assert.equal(officeSeed(undefined), 0);
assert.equal(officeSeed(0), 0);
assert.equal(officeSeed('0'), 0);
assert.deepEqual(officeLayout(0).placements, layout.placements);
assert.equal(officeLayout(0).look, null);
assert.deepEqual(officeLayout().placements, layout.placements);
assert.deepEqual(officeLayout(undefined).placements, officeLayout(null).placements);

const counts = new Set();
const zones = new Set();
let mirrored = 0;
for (let seed = 1; seed <= 50; seed++) {
  const a = officeLayout(seed);
  const b = officeLayout(seed);
  assert.deepEqual(a, b, `seed ${seed} is not deterministic`);
  assert.ok(a.look, `seed ${seed} should recolour`);
  for (const it of a.placements) {
    for (const k of ['x', 'y', 'z', 'rotY']) {
      assert.ok(Number.isFinite(it[k]), `seed ${seed} ${it.item}.${k} is ${it[k]}`);
    }
  }
  const issues = officeLayoutIssues(a.placements);
  assert.deepEqual(issues, [], `seed ${seed}: ${issues.join('; ')}`);
  const tris = officeTriangleCount(a.placements);
  assert.ok(tris < 10000, `seed ${seed} has ${tris} tris`);
  const desks = a.placements.filter((p) => p.item === 'desk').length;
  counts.add(desks);
  const table = a.placements.find((p) => p.item === 'meeting_table');
  zones.add(table.z > 4 ? 'glass' : 'open');
  const meanX = a.placements.filter((p) => p.item === 'desk').reduce((s, p) => s + p.x, 0) / desks;
  if (meanX < 0.2) mirrored++;
}

assert.ok(counts.size >= 2, `desk counts did not vary: ${[...counts].join(',')}`);
assert.ok(zones.has('glass') && zones.has('open'), `meeting zone did not vary: ${[...zones].join(',')}`);
assert.ok(mirrored > 0, 'no seed mirrored the desk cluster');

const different = officeLayout(1).placements;
assert.notDeepEqual(different, layout.placements);
assert.notDeepEqual(officeLayout(1).look, officeLayout(2).look);

console.log('office seeds 1-50 ok', {
  deskCounts: [...counts].sort((a, b) => a - b),
  zones: [...zones],
  mirrored,
  tris: [1, 2, 3, 4, 5].map((s) => officeTriangleCount(officeLayout(s).placements)),
});
