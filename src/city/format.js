// City file format ("tiny-city", version 1): a whole town as plain JSON, so a
// city can be generated, edited, saved, loaded and used by other projects.
//
// {
//   "format": "tiny-city",
//   "version": 1,
//   "meta": { "name": "Sample town", "seed": 3 },
//   "grid": {                       // the street grid (metres)
//     "cols": 4, "rows": 3,         // blocks across (x) and down (z)
//     "block": 40,                  // block size, sidewalk included
//     "road": 9,                    // road width between blocks
//     "sidewalk": 3,                // sidewalk ring inside each block
//     "curb": 0.12                  // sidewalks are this much above the road
//   },
//   "blocks": [                     // one per block, row by row
//     { "col": 0, "row": 0, "type": "residential" }   // residential | mixed |
//   ],                                                 // shops | downtown | park
//   "objects": [                    // everything placed in the town
//     {
//       "asset": "building.house",  // an id from the asset catalogue
//       "params": { "w": 10, "d": 12, "seed": 42 },   // overrides its defaults
//       "x": -60.5, "z": -40, "y": 0,                 // position (y optional)
//       "rot": 180                  // turn around y, degrees (0 = facing +z)
//     }
//   ]
// }
//
// The world is centred on the origin; +x east, +z south, y up. Roads, the
// sidewalk slabs, pedestrian loops, the car loop and collisions are derived
// from the grid, blocks and objects when the city is built (city/build.js).

export const FORMAT = 'tiny-city';
export const VERSION = 1;

export const BLOCK_TYPES = ['residential', 'mixed', 'shops', 'downtown', 'park'];

/** World extent of a grid, and the corners of block (col, row). */
export function gridGeometry(grid) {
  const { cols, rows, block, road } = grid;
  const X = cols * block + (cols + 1) * road;
  const Z = rows * block + (rows + 1) * road;
  const blockRect = (col, row) => {
    const x0 = -X / 2 + road + col * (block + road), z0 = -Z / 2 + road + row * (block + road);
    return { x0, z0, x1: x0 + block, z1: z0 + block };
  };
  return { X, Z, blockRect };
}

/** Check a city object loosely; returns a list of problems (empty if fine). */
export function validateCity(data, catalog) {
  const problems = [];
  if (data?.format !== FORMAT) problems.push(`not a ${FORMAT} file`);
  if (data?.version > VERSION) problems.push(`made by a newer version (${data.version})`);
  const g = data?.grid;
  if (!g || !(g.cols > 0 && g.rows > 0 && g.block > 0 && g.road > 0)) problems.push('missing or bad grid');
  for (const o of data?.objects ?? []) {
    if (!catalog[o.asset]) problems.push(`unknown asset "${o.asset}"`);
  }
  return [...new Set(problems)];
}
