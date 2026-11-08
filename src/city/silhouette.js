import * as THREE from 'three';

// See-through silhouettes: people, cats and vehicles hidden behind buildings are drawn as a flat
// tinted shape (used in the iso view, where buildings hide the street).
//
// How: every style material writes stencil 0 where it is drawn (ps1.js), a
// person's own materials write 1. A second copy of each person's skinned
// mesh is drawn after everything else with depthFunc Greater (only where
// something is in front of it) and only where the stencil is not 1 (so a
// person never tints their own visible body, e.g. the thighs under a skirt).
// The copy shares the person's geometry and skeleton: it moves with the
// walk for free, and costs one extra draw call per person.

export const PERSON_STENCIL = 1;

/** Make `material` mark its pixels as "a person is visible here". */
export function markPerson(material) {
  material.stencilWrite = true;
  material.stencilRef = PERSON_STENCIL;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilZPass = THREE.ReplaceStencilOp;
  return material;
}

/** The flat silhouette material (one per colour, shared). */
export function silhouetteMaterial(color, opacity = 0.7) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthFunc: THREE.GreaterDepth,
    stencilWrite: true,
    stencilRef: PERSON_STENCIL,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    // mark the pixel once drawn, so overlapping parts (a car's body and
    // wheels) tint it only once: an even, flat silhouette
    stencilZPass: THREE.ReplaceStencilOp,
  });
}

/**
 * Give a skinned person (root from lib/skin.js) a silhouette copy. Other
 * meshes of the person (skirt, held items) get person-marking copies of
 * their materials. Returns the silhouette mesh (hidden until shown).
 */
export function addSilhouette(root, material, cache = new Map()) {
  let skinned = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isSkinnedMesh && !skinned) { skinned = o; return; }
    if (o.material.transparent) return; // blob shadow
    if (!cache.has(o.material)) cache.set(o.material, markPerson(o.material.clone()));
    o.material = cache.get(o.material);
  });
  if (!skinned) return null;
  const sil = new THREE.SkinnedMesh(skinned.geometry, material);
  sil.bind(skinned.skeleton, skinned.bindMatrix);
  sil.position.copy(skinned.position);
  sil.quaternion.copy(skinned.quaternion);
  sil.scale.copy(skinned.scale);
  sil.boundingSphere = skinned.boundingSphere;
  sil.renderOrder = 10;
  sil.castShadow = false;
  sil.visible = false;
  sil.name = 'silhouette';
  skinned.parent.add(sil);
  return sil;
}

/**
 * The same for a rigid moving thing (a car, a bus): every opaque mesh under
 * `root` gets person-marking copies of its materials (so it never tints
 * itself) and a silhouette twin sharing its geometry. Returns the twins.
 */
export function addObjectSilhouette(root, material, cache = new Map()) {
  const twins = [];
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.material.transparent) meshes.push(o); });
  for (const o of meshes) {
    if (!cache.has(o.material)) cache.set(o.material, markPerson(o.material.clone()));
    o.material = cache.get(o.material);
    const twin = new THREE.Mesh(o.geometry, material);
    twin.renderOrder = 10;
    twin.visible = false;
    twin.name = 'silhouette';
    o.add(twin); // same place as the original
    twins.push(twin);
  }
  return twins;
}
