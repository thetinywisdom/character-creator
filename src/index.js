// Public entry. Importing this module registers the built-in parts.
import './parts.js';

export { registerPart, getParts, getPart, hasPart, SLOTS } from './registry.js';
export { defaults, normalize, randomize, migrate, selectPart, SKINS } from './schema.js';
export { createCharacter, resolveShape } from './create.js';
export { PALETTE, COMIC, COLORS } from './palette.js';
export { METRICS, mulberry32 } from './geom.js';
export { DANCES, HULA_W, JumpMotor, strideLength } from './anim.js';
