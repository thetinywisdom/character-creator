// Builds a character by running the registered part for each slot.
import { Character } from './anim.js';
import { createSkeleton } from './rig.js';
import { disposeTree, SHAPES } from './geom.js';
import { getPart } from './registry.js';
import { normalize } from './schema.js';
import { skinLine, v1View, heldOffsets } from './meshes.js';
import { attachHeld } from './behavior.js';

const BUILD = { skinny: 0.82, average: 1, fat: 1.35, muscle: 1.25 };

const ORDER = [
  'body.torso', 'head.shape', 'head.ears',
  'arms.left', 'arms.right', 'legs.left', 'legs.right',
  'clothing.bottom', 'clothing.shoes', 'clothing.top', 'clothing.outer',
  'body',
  'head.hair', 'head.headwear', 'head.eyewear', 'head.facialHair',
  'back', 'hands.left', 'hands.right',
  'animation.walkStyle', 'animation.dance',
];

function readSlot(def, slot) {
  const node = slot.split('.').reduce((o, k) => o?.[k], def);
  const opts = node && typeof node === 'object' ? node : { id: node };
  const id = opts.style ?? opts.type ?? opts.item ?? opts.id;
  return { id, opts };
}

/** Shape for a body type, plus shoulder / belly / hip offsets. Zero offsets match iso-city. */
export function resolveShape(def) {
  const registered = getPart('body', def.body.type)?.shape;
  const base = { ...(registered || SHAPES[def.body.type] || SHAPES.average) };
  const shoulder = +def.body.shoulder || 0;
  const hip = +def.body.hip || 0;
  const belly = +def.body.belly || 0;
  if (!shoulder && !hip && !belly) return base;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  base.sh = clamp(base.sh + shoulder * 0.2, 0.55, 1.8);
  base.hip = clamp(base.hip + hip * 0.25, 0.55, 1.85);
  base.tx = clamp(base.tx + belly * 0.3, 0.55, 1.9);
  base.tz = clamp(base.tz + belly * 0.3, 0.55, 1.9);
  return base;
}

function buildCharacter(input) {
  const def = normalize(input);
  const P = createSkeleton(def.name || 'character');
  const shape = resolveShape(def);
  const cfg = {
    name: def.name,
    custom: true,
    skin: def.body.skin,
    line: skinLine(def.body.skin),
    outfit: 'custom',
    hair: def.head.hair.style,
    hairColor: def.head.hair.color,
    height: def.body.height,
    build: BUILD[def.body.type] ?? 1,
    shape,
    seed: def.extra?.id || def.name,
    def,
  };
  const ctx = { P, def, cfg, shape, v1: v1View(def), props: {} };
  for (const slot of ORDER) {
    const { id, opts } = readSlot(def, slot);
    const part = getPart(slot, id);
    if (part) part.build(ctx, opts);
  }

  const ch = new Character(P, cfg);
  const offsets = heldOffsets(shape, def.body.type);
  const left = ctx.props.left || { held: 'none', item: null, guitar: null, dog: null, leash: null, ring: null, ...offsets };
  if (!left.armOff) left.armOff = offsets.armOff;
  ch.cap = ctx.props.cap || null;
  ch.def = def;
  attachHeld(ch, left);
  ch.update(0, 0);
  ch.root.userData.def = def;
  return ch;
}

/**
 * Build a character from a v1 or v2 definition.
 * The returned handle matches the game contract: `{ root, update(dt, state) }`,
 * plus dance controls and `setDef`.
 * @param {object} [def]
 */
export function createCharacter(def) {
  let ch = buildCharacter(def);
  const api = {
    get root() { return ch.root; },
    get parts() { return ch.parts; },
    get def() { return ch.def; },
    get dancing() { return ch.dancing; },
    get danceName() { return ch.danceName; },
    get triangles() { return ch.triangles; },
    update(dt, state) { return ch.update(dt, state); },
    dance(name) { return ch.dance(name ?? ch.def?.animation?.dance); },
    stopDance(fade) { return ch.stopDance(fade); },
    slap() { return ch.slap(); },
    hit(side) { return ch.hit(side); },
    knockdown(dir, lie, roll) { return ch.knockdown(dir, lie, roll); },
    anticipate(amount) { return ch.anticipate(amount); },
    setWalkPose(phase, speed) { return ch.setWalkPose(phase, speed); },
    /**
     * Rebuild the meshes from a new definition. Keeps the root's parent and
     * the root yaw / position so a turntable doesn't jump.
     */
    setDef(next) {
      const parent = ch.root.parent;
      const yaw = ch.root.rotation.y;
      const pos = ch.root.position.clone();
      disposeTree(ch.root);
      ch.root.removeFromParent();
      ch = buildCharacter(next);
      ch.root.rotation.y = yaw;
      ch.root.position.copy(pos);
      if (parent) parent.add(ch.root);
      return api;
    },
    dispose() {
      disposeTree(ch.root);
      ch.dispose();
    },
  };
  return api;
}
