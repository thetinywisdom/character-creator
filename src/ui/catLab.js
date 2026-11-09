// The Cat lab: every cat version made so far (from the project history, in
// subjects/catVersions/) next to new cute proposals built on today's cat
// (subjects/cat.js with its cute options: face, body shape, paw size, cheek
// fluff). All on the same rig (legFL..legBR, lowFL..lowBR, head, tail), so the
// buttons make them all walk, run, sit, loaf or sleep together. Only the very
// first, grey-box cat has no leg joints: it just stands.
import * as THREE from 'three';
import { Cell } from '../viewer/Cell.js';
import { cat } from '../subjects/cat.js';
import { cat as v1 } from '../subjects/catVersions/cat_5be0e8a.js';
import { cat as v2 } from '../subjects/catVersions/cat_1b40be1.js';
import { cat as v3 } from '../subjects/catVersions/cat_edf7b5c.js';
import { cat as v4 } from '../subjects/catVersions/cat_10f037a.js';
import { cat as v5 } from '../subjects/catVersions/cat_b6fbf6d.js';
import { CAT_RUN_SPEED, CAT_WALK_SPEED, createCatGait, poseCat, stepCatGait } from '../anim/catGait.js';

const defaults = (c) => Object.fromEntries(Object.entries(c.schema).map(([k, d]) => [k, d.value]));
const coat = { furColor: 'Ginger', pattern: 'Tabby', tailType: 'Long', earType: 'Pointed', coat: 'Short' };

export const CAT_VERSIONS = [
  ['1 · Grey box (first)', v1, {}],
  ['2 · Better shape', v2, coat],
  ['3 · Natural shape', v3, coat],
  ['4 · Cuter proportions', v4, coat],
  ['5 · Big round head', v5, coat],
  ['6 · Today (calico)', cat, { furColor: 'White', pattern: 'Calico' }],
];

/** Cute proposals: today's cat with the cute options turned up. */
export const CUTE_CATS = {
  'Mochi': { shape: 'Bean', bodyLength: 0.3, chubbiness: 1.35, legLength: 0.08, headSize: 1.45, earSize: 0.95, tailLength: 0.2, tailType: 'Bobtail', pawSize: 1.6, cheeks: 0.6, face: 'Sparkle', furColor: 'White', pattern: 'Solid' },
  'Loaf': { shape: 'Loaf', bodyLength: 0.4, chubbiness: 1.45, legLength: 0.07, headSize: 1.25, earSize: 0.85, earType: 'Folded', tailLength: 0.26, pawSize: 1.4, cheeks: 0.3, face: 'Sleepy', furColor: 'Ginger', pattern: 'Tabby' },
  'Chibi': { shape: 'Bean', bodyLength: 0.24, chubbiness: 1.05, legLength: 0.09, headSize: 1.65, earSize: 1.4, tailLength: 0.24, tailType: 'Curled', pawSize: 1.8, face: 'Sparkle', furColor: 'Gray', pattern: 'Tabby' },
  'Pudding': { shape: 'Bean', bodyLength: 0.32, chubbiness: 1.3, legLength: 0.08, headSize: 1.4, earSize: 1, coat: 'Long', cheeks: 1, tailUp: 0.9, tailCurl: 0.8, pawSize: 1.4, face: 'Smile', furColor: 'Cream', pattern: 'Points' },
  'Tiny tux': { shape: 'Bean', bodyLength: 0.28, chubbiness: 1.1, legLength: 0.09, headSize: 1.45, earSize: 1.1, tailType: 'Curled', pawSize: 1.5, face: 'Dots', furColor: 'Black', pattern: 'Tuxedo' },
  'Bao': { shape: 'Bean', bodyLength: 0.32, chubbiness: 1.6, legLength: 0.06, headSize: 1.3, earSize: 0.75, tailType: 'Bobtail', pawSize: 1.3, cheeks: 0.5, face: 'Dots', furColor: 'White', pattern: 'Solid' },
  'Calico mochi': { shape: 'Bean', bodyLength: 0.3, chubbiness: 1.3, legLength: 0.08, headSize: 1.45, earSize: 1, tailLength: 0.24, pawSize: 1.6, cheeks: 0.5, face: 'Sparkle', furColor: 'White', pattern: 'Calico' },
};

const subjectOf = (id, label, base, params) => ({
  id, label, isCharacter: true, exaggeration: base.exaggeration ?? 1.5, schema: {},
  build: (_p, style) => base.build({ ...defaults(base), ...(base.presets?.Housecat ?? {}), ...params }, style),
});

export class CatLab {
  constructor({ style, renderer, el }) {
    this.el = el;
    this.anim = 'Walk';
    const rows = [
      { title: 'Versions so far', items: CAT_VERSIONS.map(([label, base, params], i) => subjectOf(`v${i}`, label, base, params)) },
      { title: 'Cute proposals', items: Object.entries(CUTE_CATS).map(([name, params], i) => subjectOf(`c${i}`, name, cat, params)) },
    ];
    // one little stage per cat, so each fills its tile
    this.rows = rows.map((r) => {
      const tiles = r.items.map((subject, i) => {
        const cell = new Cell({ entries: [{ subject, rotation: 0.4 }], style, renderer, viewDir: [0.15, 0.32, 1] });
        cell.rebuild({});
        return { cell, cam: new THREE.PerspectiveCamera(30, 1, 0.01, 200), gait: createCatGait(i * 0.7) };
      });
      return { ...r, tiles, labels: r.items.map((s2) => s2.label) };
    });
    // the controls and the name tags
    el.innerHTML = `<div class="cl-bar"><b>Cat lab</b>${['Still', 'Walk', 'Run', 'Sit', 'Loaf', 'Sleep'].map((a) => `<button type="button" data-a="${a}">${a}</button>`).join('')}</div>`;
    this.tags = this.rows.map((r) => {
      const h = Object.assign(document.createElement('div'), { className: 'cl-row', textContent: r.title });
      el.append(h);
      return { head: h, names: r.labels.map((t) => { const d = Object.assign(document.createElement('div'), { className: 'cl-tag', textContent: t }); el.append(d); return d; }) };
    });
    el.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => { this.anim = b.dataset.a; this.mark(); }; });
    this.mark();
  }
  mark() { this.el.querySelectorAll('[data-a]').forEach((b) => b.classList.toggle('on', b.dataset.a === this.anim)); }
  applyLighting(preset) { for (const r of this.rows) for (const t of r.tiles) t.cell.applyLighting(preset); }

  /** Animate and draw both rows (top: versions, bottom: proposals) as tiles under the bar. */
  render(ps1, dt, W, H) {
    const top = 104, gapY = 6, rowH = (H - top - gapY * 3) / 2;
    const speed = { Walk: CAT_WALK_SPEED, Run: CAT_RUN_SPEED }[this.anim] ?? 0;
    const pose = { Sit: 'sit', Loaf: 'loaf', Sleep: 'sleep' }[this.anim] ?? null;
    this.rows.forEach((r, k) => {
      const y = top + gapY + k * (rowH + gapY), n = r.tiles.length, tw = W / n;
      const t = this.tags[k];
      t.head.style.cssText = `left:12px;top:${y + 4}px`;
      r.tiles.forEach((tile, i) => {
        const rect = { x: i * tw, y, w: tw - 4, h: rowH };
        const o = tile.cell.pivots[0]?.children[0];
        tile.gait.pose = pose;
        stepCatGait(tile.gait, dt, speed);
        if (o) o.traverse((q) => { if (q.name === 'cat') poseCat(q, tile.gait); });
        tile.cell.frame(rect.w / rect.h, tile.cam, { margin: 1.0 });
        tile.cam.updateProjectionMatrix();
        ps1.render(tile.cell, tile.cam, rect.x, H - rect.y - rect.h, rect.w, rect.h);
        t.names[i].style.cssText = `left:${rect.x + rect.w / 2}px;top:${rect.y + rect.h - 20}px`;
      });
    });
  }
}
