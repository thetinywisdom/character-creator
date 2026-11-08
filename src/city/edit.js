import { blockObjects, streetObjects } from './layout.js';
import { FORMAT, VERSION, gridGeometry } from './format.js';

// Editing operations on a city file. Each returns a NEW city object and never
// changes the one it was given; objects that didn't change are shared between
// the old and new city (so undo is just keeping old cities, and an editor
// can tell what changed by comparing object identity).
//
// Generated objects carry a group: 'block:col,row' (rebuilt when that block
// is repainted) or 'streets' (crosswalks, lights, signs: rebuilt when any
// block changes). Hand-placed objects have no group and are never touched by
// regeneration; moving or turning a generated object makes it hand-placed.

const newSeed = () => Math.floor(Math.random() * 1e9);
const groupOf = (col, row) => `block:${col},${row}`;

/** An empty city of cols × rows cells. */
export function emptyCity(cols = 4, rows = 3, name = 'New town') {
  return {
    format: FORMAT, version: VERSION, meta: { name },
    grid: { cols, rows, block: 40, road: 9, sidewalk: 3, curb: 0.12 },
    blocks: [], objects: [],
  };
}

const withStreets = (data) => ({
  ...data,
  objects: [...data.objects.filter((o) => o.group !== 'streets'), ...streetObjects(data.grid, data.blocks)],
});

/** The block at (col, row), or undefined. */
export const blockAt = (data, col, row) => data.blocks.find((b) => b.col === col && b.row === row);

/**
 * Paint cell (col, row) as `type` (null = no block, open ground). Painting
 * the same type again re-rolls the block (new seed).
 */
export function setBlock(data, col, row, type, seed = newSeed()) {
  const blocks = data.blocks.filter((b) => !(b.col === col && b.row === row));
  const block = type ? { col, row, type, seed } : null;
  if (block) blocks.push(block);
  blocks.sort((a, b) => a.row - b.row || a.col - b.col);
  const objects = data.objects.filter((o) => o.group !== groupOf(col, row));
  if (block) objects.push(...blockObjects(data.grid, block));
  return withStreets({ ...data, blocks, objects });
}

/** Change the grid size, keeping blocks and hand-placed things where they are. */
export function resizeGrid(data, cols, rows) {
  cols = Math.max(1, Math.min(12, cols));
  rows = Math.max(1, Math.min(12, rows));
  const grid = { ...data.grid, cols, rows };
  const before = gridGeometry(data.grid), after = gridGeometry(grid);
  // the town is centred on the origin: keep things fixed relative to its north-west corner
  const dx = (after.X - before.X) / 2, dz = (after.Z - before.Z) / 2;
  const blocks = data.blocks.filter((b) => b.col < cols && b.row < rows);
  const kept = data.objects.filter((o) => !o.group).map((o) => {
    const moved = { ...o, x: o.x + dx, z: o.z + dz };
    if (o.asset === 'line.wire') moved.params = { ...o.params, a: shift(o.params.a, dx, dz), b: shift(o.params.b, dx, dz) };
    return moved;
  });
  const generated = blocks.flatMap((b) => blockObjects(grid, b));
  return withStreets({ ...data, grid, blocks, objects: [...kept, ...generated] });
}
const shift = (p, dx, dz) => [p[0] + dx, p[1], p[2] + dz];

/** Add one hand-placed object. */
export function addObject(data, object) {
  return { ...data, objects: [...data.objects, object] };
}

/** Replace `object` with a changed copy (it becomes hand-placed). */
export function updateObject(data, object, changes) {
  const next = { ...object, ...changes };
  delete next.group;
  return { ...data, objects: data.objects.map((o) => (o === object ? next : o)), changed: next };
}

/** Remove `object`. */
export function removeObject(data, object) {
  return { ...data, objects: data.objects.filter((o) => o !== object) };
}

/** Which cell a world point is in: { col, row } (may be outside the grid). */
export function cellAt(grid, x, z) {
  const { X, Z } = gridGeometry(grid);
  const step = grid.block + grid.road;
  return { col: Math.floor((x + X / 2 - grid.road / 2) / step), row: Math.floor((z + Z / 2 - grid.road / 2) / step) };
}
