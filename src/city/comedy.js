import * as THREE from 'three';
import { JOINT_NAMES, createGait, poseGait } from '../anim/gait.js';

/**
 * Comic variations of the hit animations (slap, push, fall), to pick from
 * before they replace the plain ones. Each variation poses a body at time t
 * (seconds) on top of a standing pose: `attacker` for the one who hits,
 * `victim` for the one who gets it (`kb`: how far they are thrown back, m/s
 * for a time). Bodies face +z; the victim stands facing the attacker.
 *
 * `ComedyStage` plays one variation on two people for previews (debug hook
 * `__cc.comedy(kind, n)`).
 */
const TAU = Math.PI * 2;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const span = (t, a, b) => clamp01((t - a) / (b - a));
const sides = (j, f) => { for (const s of ['L', 'R']) f(s, s === 'L' ? 1 : -1); };

/** Lying down on the back (or the front, sign -1) at amount d, a bounce on top. */
function lie(body, d, sign = 1, bounce = 0) {
  body.rotation.x = -1.5 * d * sign;
  body.position.y = 0.12 * d + bounce;
}
/** Getting back up over the last 0.5 s of `dur`. */
const upAgain = (t, dur) => 1 - ease(span(t, dur - 0.5, dur));
/** Arms and legs flailing like windmills. */
function flail(j, t, k = 1, speed = 22) {
  sides(j, (s, sg) => {
    if (j[`arm${s}`]) { j[`arm${s}`].rotation.x = -1.6 + Math.sin(t * speed + (sg > 0 ? 0 : Math.PI)) * 1.4 * k; j[`arm${s}`].rotation.z = sg * 0.5 * k; }
    if (j[`fore${s}`]) j[`fore${s}`].rotation.x = -0.6 * k;
  });
}
function kick(j, t, base, k = 0.5, speed = 26) {
  sides(j, (s, sg) => {
    if (j[`leg${s}`]) j[`leg${s}`].rotation.x = base + Math.sin(t * speed + (sg > 0 ? 0 : Math.PI)) * k;
    if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 0.5 + Math.sin(t * speed + 1 + (sg > 0 ? 0 : Math.PI)) * 0.4;
  });
}
/** A little dizzy wobble while standing. */
function dizzy(body, j, t, k) {
  body.rotation.z = Math.sin(t * 9) * 0.12 * k;
  body.rotation.x = Math.cos(t * 7) * 0.08 * k;
  if (j.head) j.head.rotation.z = Math.sin(t * 9 + 1) * 0.35 * k;
}

export const COMEDY = {
  slap: [
    {
      name: 'Windmill spin',
      note: 'big overhead wind-up; they spin round once on the spot, then wobble, dizzy',
      attacker: { dur: 0.7, pose(body, j, t) {
        const wind = ease(span(t, 0, 0.35)), whip = ease(span(t, 0.35, 0.5)), back = ease(span(t, 0.5, 0.7));
        const x = -3.0 * wind + (3.0 - 1.4) * whip + 1.4 * back; // up and back, whip round, down
        if (j.armR) { j.armR.rotation.x = x; j.armR.rotation.z = -0.5 * (wind - back); }
        if (j.spine) j.spine.rotation.y = -0.5 * wind + 0.9 * whip - 0.4 * back;
        body.position.y = 0.06 * Math.sin(Math.PI * span(t, 0.3, 0.6));
      } },
      victim: { dur: 1.6, kb: [1.2, 0.2], pose(body, j, t) {
        if (j.head) j.head.rotation.y = 1.3 * (1 - ease(span(t, 0.15, 0.5)));
        body.rotation.y = TAU * ease(span(t, 0.05, 0.75));
        dizzy(body, j, t, span(t, 0.7, 0.8) * (1 - span(t, 1.3, 1.6)));
        flail(j, t, 0.5 * (1 - span(t, 0.6, 0.8)));
      } },
    },
    {
      name: 'Rapid-fire',
      note: 'four quick forehand-backhand slaps; their head whips left and right',
      attacker: { dur: 0.8, pose(body, j, t) {
        const on = Math.sin(Math.PI * span(t, 0, 0.8));
        if (j.armR) { j.armR.rotation.x = -1.5 * Math.min(1, on * 2); j.armR.rotation.z = Math.sin(t * TAU * 5) * 0.9 * on; }
        if (j.foreR) j.foreR.rotation.x = -0.3;
        if (j.spine) j.spine.rotation.y = Math.sin(t * TAU * 5) * 0.25 * on;
      } },
      victim: { dur: 1.1, kb: [0.6, 0.6], pose(body, j, t) {
        const on = 1 - span(t, 0.8, 1.1);
        if (j.head) j.head.rotation.y = Math.sin(t * TAU * 5 + 0.6) * 1.1 * on;
        if (j.spine) j.spine.rotation.z = Math.sin(t * TAU * 5 + 0.6) * 0.2 * on;
        body.position.y = Math.abs(Math.sin(t * TAU * 5)) * 0.05 * on;
        sides(j, (s, sg) => { if (j[`arm${s}`]) j[`arm${s}`].rotation.z = sg * 0.9 * on; });
      } },
    },
    {
      name: 'Launch',
      note: 'an uppercut slap sends them corkscrewing up; they land sitting, stunned',
      attacker: { dur: 0.7, pose(body, j, t) {
        const crouch = ease(span(t, 0, 0.25)) * (1 - ease(span(t, 0.25, 0.4)));
        const up = ease(span(t, 0.25, 0.45)) * (1 - ease(span(t, 0.5, 0.7)));
        body.position.y = -0.15 * crouch + 0.12 * up;
        if (j.armR) j.armR.rotation.x = 0.7 * crouch - 2.9 * up;
        sides(j, (s) => { if (j[`leg${s}`]) j[`leg${s}`].rotation.x = -0.5 * crouch; if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 0.9 * crouch; });
        if (j.spine) j.spine.rotation.x = 0.3 * crouch - 0.2 * up;
      } },
      victim: { dur: 2.0, kb: [1.6, 0.6], pose(body, j, t) {
        const air = span(t, 0.05, 0.65);
        body.position.y = Math.sin(Math.PI * air) * 1.1;
        body.rotation.y = TAU * 2 * ease(air);
        flail(j, t, air > 0 && air < 1 ? 1 : 0);
        kick(j, t, -0.4 * (air > 0 && air < 1 ? 1 : 0), air > 0 && air < 1 ? 0.6 : 0);
        // then sitting on the ground, legs out, a little bounce
        const sit = ease(span(t, 0.62, 0.7)) * upAgain(t, 2.0);
        if (sit > 0) {
          body.position.y = -0.55 * sit + Math.max(0, Math.sin(Math.PI * span(t, 0.65, 0.85))) * 0.12;
          sides(j, (s) => { if (j[`leg${s}`]) j[`leg${s}`].rotation.x = -1.5 * sit; if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 0.1 * sit; if (j[`arm${s}`]) j[`arm${s}`].rotation.x = 0.4 * sit; });
          if (j.head) j.head.rotation.z = Math.sin(t * 8) * 0.3 * sit;
        }
      } },
    },
  ],
  push: [
    {
      name: 'Sumo send-off',
      note: 'a sumo lunge with both palms; they fly back through the air, flailing, and slam flat',
      attacker: { dur: 0.6, pose(body, j, t) {
        const f = Math.sin(Math.PI * span(t, 0, 0.6));
        sides(j, (s) => { if (j[`arm${s}`]) j[`arm${s}`].rotation.x = -1.5 * f; if (j[`fore${s}`]) j[`fore${s}`].rotation.x = -0.1 * f; });
        if (j.legL) j.legL.rotation.x = -0.7 * f; if (j.shinL) j.shinL.rotation.x = 0.5 * f;
        if (j.legR) j.legR.rotation.x = 0.4 * f;
        if (j.spine) j.spine.rotation.x = 0.35 * f;
        body.position.y = -0.1 * f;
      } },
      victim: { dur: 2.4, kb: [4.5, 0.7], pose(body, j, t) {
        const air = span(t, 0, 0.7);
        const down = ease(span(t, 0, 0.35)) * upAgain(t, 2.4);
        const bounce = Math.max(0, Math.sin(Math.PI * span(t, 0.7, 0.9))) * 0.18;
        lie(body, down, 1, Math.sin(Math.PI * air) * 0.7 + bounce);
        const f = air < 1 ? 1 : 0.15 * (1 - span(t, 0.9, 1.4));
        flail(j, t, f); kick(j, t, -0.5 * (air < 1 ? 1 : down), 0.7 * f);
      } },
    },
    {
      name: 'Backpedal',
      note: 'a hip bump; they stumble backwards on tiny fast steps, arms windmilling, then tip over like a plank',
      attacker: { dur: 0.6, pose(body, j, t) {
        const f = Math.sin(Math.PI * span(t, 0, 0.6));
        if (j.spine) { j.spine.rotation.y = 0.9 * f; j.spine.rotation.z = 0.25 * f; }
        body.position.x = 0.15 * f;
        sides(j, (s, sg) => { if (j[`arm${s}`]) j[`arm${s}`].rotation.z = sg * 0.6 * f; });
      } },
      victim: { dur: 2.6, kb: [2.6, 1.2], pose(body, j, t) {
        const run = 1 - span(t, 1.1, 1.2);
        if (t < 1.2) {
          body.rotation.x = -0.15 - 0.25 * span(t, 0, 1.1);
          flail(j, t, 1, 18);
          sides(j, (s, sg) => {
            if (j[`leg${s}`]) j[`leg${s}`].rotation.x = Math.sin(t * 30 + (sg > 0 ? 0 : Math.PI)) * 0.6 * run;
            if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 0.4 + Math.sin(t * 30 + 1 + (sg > 0 ? 0 : Math.PI)) * 0.4 * run;
          });
          body.position.y = Math.abs(Math.sin(t * 30)) * 0.05;
        } else {
          // stiff as a plank, then a bounce
          const d = ease(span(t, 1.1, 1.4)) * upAgain(t, 2.6);
          lie(body, Math.max(0.27, d), 1, Math.max(0, Math.sin(Math.PI * span(t, 1.4, 1.6))) * 0.15);
          sides(j, (s) => { if (j[`arm${s}`]) j[`arm${s}`].rotation.x = 0; if (j[`leg${s}`]) j[`leg${s}`].rotation.x = 0; });
        }
      } },
    },
    {
      name: 'Back-sled',
      note: 'a flying push-kick; they land on their back and slide off like a sled, legs kicking, spinning',
      attacker: { dur: 0.7, pose(body, j, t) {
        const f = Math.sin(Math.PI * span(t, 0, 0.7));
        if (j.legR) j.legR.rotation.x = -1.7 * f; if (j.shinR) j.shinR.rotation.x = 0.2 * f;
        if (j.spine) j.spine.rotation.x = -0.35 * f;
        sides(j, (s, sg) => { if (j[`arm${s}`]) { j[`arm${s}`].rotation.x = 0.6 * f; j[`arm${s}`].rotation.z = sg * 0.8 * f; } });
        body.position.y = 0.15 * Math.sin(Math.PI * span(t, 0.1, 0.5));
      } },
      victim: { dur: 2.6, kb: [5.5, 1.4], pose(body, j, t) {
        const down = ease(span(t, 0, 0.22)) * upAgain(t, 2.6);
        lie(body, down);
        body.rotation.y = 1.4 * TAU * ease(span(t, 0.2, 1.6)) * 0.5;
        const k = 1 - span(t, 1.4, 1.8);
        kick(j, t, -1.2 * down, 0.6 * k);
        flail(j, t, 0.5 * k, 14);
      } },
    },
  ],
  fall: [
    {
      name: 'Feet over head',
      note: 'feet kick up over their head, they hang in the air a beat, then slam flat and bounce',
      victim: { dur: 2.4, kb: [1.0, 0.4], pose(body, j, t) {
        const up = span(t, 0, 0.45);
        const d = ease(span(t, 0, 0.3)) * upAgain(t, 2.4);
        const hang = Math.sin(Math.PI * up) * 0.75;
        const bounce = Math.max(0, Math.sin(Math.PI * span(t, 0.45, 0.65))) * 0.2;
        lie(body, d * 1.08, 1, hang + bounce);
        sides(j, (s, sg) => {
          if (j[`leg${s}`]) j[`leg${s}`].rotation.x = (-2.0 + sg * 0.3) * (up < 1 ? Math.sin(Math.PI * up) : 0) - 0.3 * d;
          if (j[`arm${s}`]) { j[`arm${s}`].rotation.x = -2.8 * Math.sin(Math.PI * Math.min(1, up * 1.4)); j[`arm${s}`].rotation.z = sg * 0.6; }
        });
      } },
    },
    {
      name: 'Faceplant',
      note: 'arms windmill forwards, they topple face-first like a plank, legs wiggling in the air',
      victim: { dur: 2.4, kb: [0.6, 0.4], pose(body, j, t) {
        const tip = span(t, 0, 0.5);
        const d = tip * tip * upAgain(t, 2.4); // accelerates like a falling plank
        lie(body, d, -1, Math.max(0, Math.sin(Math.PI * span(t, 0.5, 0.65))) * 0.12);
        flail(j, t, 1 - span(t, 0.45, 0.55), 20);
        const w = span(t, 0.55, 0.7) * (1 - span(t, 1.6, 1.9));
        sides(j, (s, sg) => {
          if (j[`leg${s}`]) j[`leg${s}`].rotation.x = 0.5 * w + Math.sin(t * 24 + (sg > 0 ? 0 : Math.PI)) * 0.25 * w;
          if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 1.6 * w;
          if (j[`arm${s}`] && tip >= 1) { j[`arm${s}`].rotation.x = -2.9 * w; j[`arm${s}`].rotation.z = 0; }
        });
      } },
    },
    {
      name: 'Splits & flop',
      note: 'feet shoot apart into the splits, arms flapping, a wince, then they flop over sideways',
      victim: { dur: 2.4, kb: [0.4, 0.3], pose(body, j, t) {
        const sp = ease(span(t, 0, 0.25)) * upAgain(t, 2.4);
        const flop = ease(span(t, 0.9, 1.15)) * upAgain(t, 2.4);
        body.position.y = -0.82 * sp * (1 - flop) + 0.12 * flop;
        body.rotation.z = 1.5 * flop;
        sides(j, (s, sg) => {
          if (j[`leg${s}`]) { j[`leg${s}`].rotation.z = sg * 1.45 * sp; j[`leg${s}`].rotation.x = 0; }
          if (j[`shin${s}`]) j[`shin${s}`].rotation.x = 0;
          if (j[`arm${s}`]) { j[`arm${s}`].rotation.z = sg * (1.2 + Math.sin(t * 20) * 0.6 * (1 - flop)) * sp; j[`arm${s}`].rotation.x = 0; }
        });
        if (j.head) j.head.rotation.x = 0.4 * sp * (1 - flop); // eyes shut, chin down
      } },
    },
  ],
};

/** Reset the joints a comic pose may have touched, back to a standing pose. */
function stand(body, gait) {
  // every joint back to its rest rotation (stored the first time)
  if (!body.userData.rest) { body.userData.rest = []; body.traverse((o) => { if (JOINT_NAMES.includes(o.name)) body.userData.rest.push([o, o.rotation.clone(), o.position.clone()]); }); }
  for (const [o, r, q] of body.userData.rest) { o.rotation.copy(r); o.position.copy(q); }
  body.position.set(0, 0, 0);
  body.rotation.set(0, 0, 0);
  body.rotation.order = 'YXZ'; // spin round the vertical even when lying down
  poseGait(body, gait);
}

/**
 * Two people on the pavement playing one variation, for previews. `at(t)`
 * shows it at time t (s) from the start; it does not run by itself.
 */
export class ComedyStage {
  constructor(city, makeBody, x, z, heading) {
    this.city = city;
    this.root = new THREE.Group();
    this.a = { body: makeBody(), root: new THREE.Group(), gait: createGait() };
    this.v = { body: makeBody(true), root: new THREE.Group(), gait: createGait() };
    for (const w of [this.a, this.v]) { w.root.add(w.body); this.root.add(w.root); }
    city.scene.add(this.root);
    this.x = x; this.z = z; this.heading = heading;
  }
  joints(body) {
    if (!body.userData.cjoints) { const j = {}; body.traverse((o) => { if (JOINT_NAMES.includes(o.name)) j[o.name] ??= o; }); body.userData.cjoints = j; }
    return body.userData.cjoints;
  }
  play(kind, n) { this.spec = COMEDY[kind][n]; this.kind = kind; }
  /** Attacker hits at t = 0 (the victim reacts from 0.15 s); a fall has no attacker. */
  at(t) {
    const { spec } = this, h = this.heading, fx = Math.sin(h), fz = Math.cos(h);
    const fall = !spec.attacker;
    // attacker at the stage spot facing +heading, victim 1.1 m in front facing back
    this.a.root.visible = !fall;
    this.a.root.position.set(this.x, 0, this.z); this.a.root.rotation.y = h;
    const tv = fall ? t : t - 0.15;
    const [kv, kt] = spec.victim.kb;
    const back = Math.max(0, Math.min(tv, kt)) * kv * (1 - Math.min(tv, kt) / (2 * kt)) * 2 * (tv > 0 ? 1 : 0); // eases to a stop
    const vx = this.x + fx * (1.1 + back), vz = this.z + fz * (1.1 + back);
    this.v.root.position.set(vx, 0, vz); this.v.root.rotation.y = fall ? h : h + Math.PI;
    stand(this.a.body, this.a.gait); stand(this.v.body, this.v.gait);
    if (!fall && t >= 0 && t <= spec.attacker.dur) spec.attacker.pose(this.a.body, this.joints(this.a.body), t);
    if (tv >= 0 && tv <= spec.victim.dur) spec.victim.pose(this.v.body, this.joints(this.v.body), tv);
    return { victim: new THREE.Vector3(vx, 0, vz) };
  }
  dispose() { this.city.scene.remove(this.root); }
}
