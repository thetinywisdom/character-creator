// Bounding boxes for diner seeds 0–50, plus a real triangle count.
// Run from the repo root: node scripts/check-diner-layout.mjs
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { dinerLayout, auditDiner } = await vite.ssrLoadModule('/src/diner/plan.js');
  const { buildDinerRoom } = await vite.ssrLoadModule('/src/diner/items.js');
  const { style } = await vite.ssrLoadModule('/src/styles/index.js');

  const countTris = (root) => {
    let n = 0;
    root.traverse((o) => {
      const g = o.geometry;
      if (!g) return;
      n += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    });
    return n;
  };

  let failed = 0;
  const seen = new Map();
  for (let seed = 0; seed <= 50; seed++) {
    const plan = dinerLayout(seed);
    const again = dinerLayout(seed);
    const audit = auditDiner(plan);
    const same = JSON.stringify(plan.placements) === JSON.stringify(again.placements);
    const room = buildDinerRoom(style, { cutaway: true, seed });
    const tris = countTris(room.group);
    if (!seen.has(plan.arrangement)) seen.set(plan.arrangement, []);
    seen.get(plan.arrangement).push(seed);
    const problems = [...audit.problems];
    if (!same) problems.push('not deterministic');
    if (tris !== audit.tris) problems.push(`mesh tris ${tris} != estimate ${audit.tris}`);
    if (tris > 10000) problems.push(`mesh tris ${tris}`);
    if (seed === 0 && plan.arrangement !== 'handmade') problems.push('seed 0 moved');
    if (problems.length) {
      failed++;
      console.log(`seed ${seed} (${plan.arrangement}) ${problems.join('; ')}`);
    }
  }
  console.log('arrangements', [...seen.entries()].map(([k, v]) => `${k}:${v.length}`).join(' '));
  console.log(failed ? `${failed} seeds failed` : '50 seeds ok, plus the hand-made room');
  if (failed) process.exitCode = 1;
} finally {
  await vite.close();
}
