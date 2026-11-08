import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// One draw call per walking person. A built character is a tree of joints
// (spine, legs, shins, feet, arms, forearms, head, wings) holding many small
// meshes in many colours. This turns it into a single skinned mesh: every
// vertex is bound rigidly (weight 1) to the joint it hangs from, and each
// part's material colour is baked into a vertex colour, so all people can
// share one material. The joints stay in place, so the gait animation poses
// them exactly as before.
//
// Kept as separate meshes: anything with a texture or transparency (the blob
// shadow), and parts that change shape themselves (the skirt, see
// anim/skirt.js), listed in `keepGroups`.

/** A vertex-colour material that looks like the style's other materials (PS1 snapping included). */
export function vertexColorMaterial(style) {
  const base = style.material('skin', 0xffffff);
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  m.onBeforeCompile = base.onBeforeCompile;
  m.customProgramCacheKey = () => 'ps1-snap-vc';
  m.userData.role = 'character';
  return m;
}

/**
 * Turn `root` (a built character) into joints + one skinned mesh, in place.
 * jointNames: names of the moving groups. Returns root.
 */
export function skinCharacter(root, jointNames, material, { keepGroups = ['skirt'] } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const joints = [root];
  root.traverse((o) => { if (o !== root && jointNames.has(o.name)) joints.push(o); });
  const indexOf = new Map(joints.map((j, i) => [j, i]));

  const parts = [];
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    // skip meshes under a group that changes shape on its own
    let a = o.parent, keep = false;
    while (a && a !== root) { if (keepGroups.includes(a.name)) keep = true; a = a.parent; }
    const mat = o.material;
    if (keep || Array.isArray(mat) || mat.map || mat.transparent || !mat.color) return;
    // the joint this mesh moves with
    let j = o.parent;
    while (j && !indexOf.has(j)) j = j.parent;
    const bone = indexOf.get(j) ?? 0;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    // a part painted per face (a cat's coat) keeps its own colours
    const own = mat.vertexColors && g.attributes.color ? g.attributes.color.array.slice() : null;
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    // colour = the material's colour, plus its glow if it has one
    const c = mat.color.clone();
    if (mat.emissive && mat.emissiveIntensity) c.add(mat.emissive.clone().multiplyScalar(mat.emissiveIntensity * 0.6));
    for (let i = 0; i < n; i++) {
      if (own) col.set([own[i * 3] * c.r, own[i * 3 + 1] * c.g, own[i * 3 + 2] * c.b], i * 3);
      else col.set([c.r, c.g, c.b], i * 3);
      si[i * 4] = bone;
      sw[i * 4] = 1;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    parts.push(g);
    remove.push(o);
  });
  if (!parts.length) return root;
  for (const o of remove) o.parent.remove(o);

  const geo = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.castShadow = true;
  // bounds that cover the moving limbs (a person is never wider than they are
  // tall), so people off screen are skipped
  geo.computeBoundingBox();
  const bb = geo.boundingBox, h = bb.max.y - bb.min.y;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, bb.min.y + h / 2, 0), h * 0.75);
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(joints));
  return root;
}
