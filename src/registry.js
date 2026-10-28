/**
 * Part registry.
 *
 * A part owns one slot in the character tree. `build(ctx, opts)` adds that
 * slot's meshes onto the rig in `ctx.P`. Limb parts must leave the standard
 * joint positions and bone lengths alone (see METRICS): walk, IK and held-item
 * poses read those joints by name.
 *
 * @typedef {object} Part
 * @property {string} slot
 * @property {string} id
 * @property {string} [label]
 * @property {(ctx: object, opts: object) => void} build
 */

/** Slots a character is made of. Later parts register into the same tree. */
export const SLOTS = [
  'head.shape',
  'head.hair',
  'head.facialHair',
  'head.headwear',
  'head.eyewear',
  'head.ears',
  'body',
  'body.torso',
  'arms.left',
  'arms.right',
  'legs.left',
  'legs.right',
  'clothing.top',
  'clothing.outer',
  'clothing.bottom',
  'clothing.shoes',
  'back',
  'hands.right',
  'hands.left',
  'animation.dance',
  'animation.walkStyle',
];

const registry = new Map();

/**
 * Register a part for a slot.
 * @param {string} slot
 * @param {string} id
 * @param {{ build: (ctx: object, opts: object) => void, label?: string, [key: string]: any }} part
 */
export function registerPart(slot, id, part) {
  if (!slot || !id) throw new Error('registerPart(slot, id, part) needs a slot and an id');
  if (!part || typeof part.build !== 'function') {
    throw new Error(`registerPart(${slot}, ${id}): build(ctx, opts) is required`);
  }
  if (!registry.has(slot)) registry.set(slot, new Map());
  const entry = { ...part, slot, id };
  registry.get(slot).set(id, entry);
  return entry;
}

/** Parts registered for `slot`, in registration order. */
export function getParts(slot) {
  const m = registry.get(slot);
  return m ? [...m.values()] : [];
}

/** One part, or null when the id is not registered. */
export function getPart(slot, id) {
  return registry.get(slot)?.get(id) ?? null;
}

/** True when `id` is a registered part of `slot`. */
export function hasPart(slot, id) {
  return registry.get(slot)?.has(id) ?? false;
}
