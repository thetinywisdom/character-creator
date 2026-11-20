// The Human lab: today's person beside three other ways of building one.
// Same outfit on every figure, same rig, so they stand, walk and run together.
// Nothing here is used by the creator, the catalogue or the City.
import * as THREE from 'three';
import { RUN_SPEED, WALK_SPEED, createGait, poseGait, stepGait, tuneOf } from '../anim/gait.js';
import { APPROACHES, buildApproach, triangleCount } from '../subjects/human/approaches.js';
import { human } from '../subjects/human.js';
import { BODY_TYPES } from '../subjects/human/rules.js';
import { defaultsFor } from '../viewer/params.js';
import { Cell } from '../viewer/Cell.js';

const VIEW = new THREE.Vector3(0, 0.22, 1).normalize();

function outfitFor(bodyType) {
  return { ...defaultsFor(human), ...human.presets[bodyType] };
}

export class HumanLab {
  constructor({ style, renderer, el, canvas }) {
    this.el = el;
    this.style = style;
    this.renderer = renderer;
    this.anim = 'Still';
    this.yaw = 0.45;
    this.bodyType = 'Man';
    this.outfit = outfitFor('Man');
    this.focus = null; // 0..3, or null for all four
    this.freeze = null; // { cyc, rw } holds a walk or run pose still for a picture
    this.gait = createGait();
    this.tiles = APPROACHES.map((a) => this.makeTile(a));
    el.innerHTML = `<div class="hl-bar"><b>Human lab</b>${['Still', 'Walk', 'Run'].map((a) => `<button type="button" data-a="${a}">${a}</button>`).join('')}<span class="hl-gap"></span>${BODY_TYPES.map((t) => `<button type="button" data-b="${t}">${t}</button>`).join('')}</div>`;
    this.tags = APPROACHES.map((a) => {
      const d = Object.assign(document.createElement('div'), { className: 'hl-tag', textContent: a.label });
      el.append(d);
      return d;
    });
    el.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => this.setAnim(b.dataset.a); });
    el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => this.setBody(b.dataset.b); });
    this.mark();
    // drag anywhere that isn't a button to turn all four
    this.drag = null;
    const down = (e) => {
      if (el.hidden || e.target.closest('button, a, input')) return;
      this.drag = { x: e.clientX, yaw: this.yaw, id: e.pointerId };
      canvas.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.01;
    };
    const up = (e) => { if (this.drag?.id === e.pointerId) this.drag = null; };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  makeTile(a) {
    const subject = {
      id: a.id,
      label: a.label,
      isCharacter: true,
      schema: {},
      build: (_p, style) => buildApproach(a.id, this.outfit, style),
    };
    const cell = new Cell({ entries: [{ subject }], style: this.style, renderer: this.renderer, viewDir: VIEW.toArray() });
    cell.rebuild({});
    return { ...a, cell, cam: new THREE.PerspectiveCamera(30, 1, 0.01, 200) };
  }

  mark() {
    this.el.querySelectorAll('[data-a]').forEach((b) => b.classList.toggle('on', b.dataset.a === this.anim));
    this.el.querySelectorAll('[data-b]').forEach((b) => b.classList.toggle('on', b.dataset.b === this.bodyType));
  }

  setAnim(a) {
    if (a === 'Still') this.rebuild(); // back to the built pose, feet together
    this.anim = a;
    this.freeze = null;
    this.mark();
  }

  setBody(type) {
    if (!human.presets[type]) return;
    this.bodyType = type;
    this.outfit = outfitFor(type);
    this.mark();
    this.rebuild();
  }

  /** Hold one stride (0..1) so a picture can catch the same step on every figure. */
  setFreeze(cyc, rw = 0) {
    this.anim = rw ? 'Run' : 'Walk';
    this.freeze = { cyc, rw };
    this.mark();
  }

  setYaw(yaw) { this.yaw = yaw; }
  setFocus(i) { this.focus = i; }

  rebuild() {
    for (const t of this.tiles) t.cell.rebuild({});
    this.gait = createGait();
  }

  applyLighting(preset) { for (const t of this.tiles) t.cell.applyLighting(preset); }

  counts() {
    return this.tiles.map((t) => ({
      id: t.id,
      label: t.label,
      triangles: triangleCount(t.cell.pivots[0]?.children[0]),
    }));
  }

  poseAll(dt) {
    const tune = tuneOf(this.outfit);
    const speed = this.anim === 'Run' ? RUN_SPEED : this.anim === 'Walk' ? WALK_SPEED : 0;
    if (this.anim === 'Still') return;
    if (this.freeze) {
      const g = this.gait;
      g.cyc = this.freeze.cyc;
      g.amt = 1;
      g.rw = this.freeze.rw;
      g.dt = 0;
      g.speed = this.freeze.rw ? RUN_SPEED : WALK_SPEED;
      g.amount = 1;
      g.run = this.freeze.rw;
      g.dip = 0;
      g.dipV = 0;
      g.accLean = 0;
      g.prevSpeed = g.speed;
    } else stepGait(this.gait, dt, speed, tune);
    // poseGait advances the shared gait. Pose every figure from the same step.
    const snap = {
      dt: this.gait.dt, cyc: this.gait.cyc, amt: this.gait.amt, rw: this.gait.rw,
      prevSpeed: this.gait.prevSpeed, dip: this.gait.dip, dipV: this.gait.dipV,
      accLean: this.gait.accLean, idle: this.gait.idle, look: this.gait.look,
      lookTo: this.gait.lookTo, nextLook: this.gait.nextLook,
    };
    let after = null;
    for (const t of this.tiles) {
      Object.assign(this.gait, snap);
      const body = t.cell.pivots[0]?.children[0];
      if (body?.name === 'human') poseGait(body, this.gait, 'natural', tune);
      after = {
        dt: this.gait.dt, cyc: this.gait.cyc, amt: this.gait.amt, rw: this.gait.rw,
        prevSpeed: this.gait.prevSpeed, dip: this.gait.dip, dipV: this.gait.dipV,
        accLean: this.gait.accLean,
      };
    }
    if (after && !this.freeze) Object.assign(this.gait, after);
  }

  /** Draw the row. Returns each tile's rectangle in page pixels (origin top-left). */
  render(ps1, dt, W, H) {
    this.poseAll(dt);
    const bar = this.el.querySelector('.hl-bar')?.getBoundingClientRect();
    const top = Math.max(108, Math.ceil((bar?.bottom ?? 100) + 8));
    const tiles = this.focus == null ? this.tiles : [this.tiles[this.focus]];
    const n = tiles.length;
    const tw = W / n;
    const rects = [];
    const dists = [];
    tiles.forEach((t, i) => {
      t.cell.setAngle(this.yaw);
      const rect = { x: i * tw, y: top, w: tw - 4, h: H - top - 8 };
      t.cell.frame(rect.w / Math.max(rect.h, 1), t.cam, { margin: 1.15 });
      dists.push(t.cam.position.distanceTo(t.cell.viewCenter));
      rects.push({ id: t.id, label: t.label, ...rect });
    });
    // one camera distance, so a wider figure is not shrunk to fit its tile
    const dist = this.focus == null ? Math.max(...dists) : dists[0];
    const shown = new Set(tiles);
    this.tags.forEach((tag, i) => { tag.hidden = !shown.has(this.tiles[i]); });
    tiles.forEach((t, i) => {
      const rect = rects[i];
      t.cam.position.copy(t.cell.viewCenter).addScaledVector(VIEW, dist);
      t.cam.near = Math.max(0.05, dist * 0.02);
      t.cam.far = dist + 80;
      t.cam.lookAt(t.cell.viewCenter);
      t.cam.updateProjectionMatrix();
      ps1.render(t.cell, t.cam, rect.x, H - rect.y - rect.h, rect.w, rect.h);
      const tag = this.tags[this.tiles.indexOf(t)];
      tag.style.cssText = `left:${rect.x + rect.w / 2}px;top:${rect.y + rect.h - 22}px`;
    });
    return rects;
  }
}
