import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Collapse many small meshes into one mesh per material, so a whole city (or
// a crowd of characters) costs a handful of draw calls instead of thousands.
// Groups whose names are in `keep` stay separate (and are merged internally),
// so they can still move: a character's arms, legs and head, for example.

function prepare(geo, material) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  for (const name of Object.keys(g.attributes)) {
    if (name === 'position' || name === 'normal') continue;
    if (name === 'uv' && material.map) continue;
    if (material.userData?.keepAttributes?.includes(name)) continue; // e.g. the interior shader's room data
    g.deleteAttribute(name);
  }
  if (material.map && !g.attributes.uv) {
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  return g;
}

function collect(node, inv, buckets, keep, kept) {
  for (const child of node.children) {
    if (keep.has(child.name)) { kept.push(child); continue; }
    if (child.isMesh && !child.userData.noMerge) {
      const m = new THREE.Matrix4().multiplyMatrices(inv, child.matrixWorld);
      const g = prepare(child.geometry, child.material);
      g.applyMatrix4(m);
      const key = child.material;
      if (!buckets.has(key)) buckets.set(key, { list: [], shadow: child.castShadow });
      buckets.get(key).list.push(g);
    }
    collect(child, inv, buckets, keep, kept);
  }
}

/** Returns a new group equivalent to `root`, with meshes merged per material. */
export function mergeByMaterial(root, keep = new Set(), { castShadow = true, receiveShadow = true } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const kept = [];
  collect(root, inv, buckets, keep, kept);

  const out = new THREE.Group();
  out.name = root.name;
  out.position.copy(root.position);
  out.quaternion.copy(root.quaternion);
  out.scale.copy(root.scale);
  for (const [material, { list }] of buckets) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    out.add(mesh);
  }
  // kept groups: merged on their own, transform kept relative to root
  for (const k of kept) {
    const mk = mergeByMaterial(k, keep, { castShadow, receiveShadow });
    const rel = new THREE.Matrix4().multiplyMatrices(inv, k.matrixWorld);
    rel.decompose(mk.position, mk.quaternion, mk.scale);
    mk.userData = { ...k.userData };
    out.add(mk);
  }
  return out;
}
