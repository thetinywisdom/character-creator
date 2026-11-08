import * as THREE from 'three';

// Skirt stretch: a light, cheap cloth effect for a rigid skirt over moving legs.
//
// The skirt is a lathe (rings from waist to hem). Every frame, after the legs
// are posed, each knee is located in skirt space; hem vertices facing that knee
// are pushed out to clear it and lifted to drape over it when it rises, as if
// the fabric were stretched over the thigh. The effect fades to nothing at the
// waist, and by angle away from the knee. Nothing moves when the legs are at
// rest. Only the skirt's few dozen vertices change, so it is fine for crowds.
//
// Works on any body with joints named legL/legR and shinL/shinR (knees) and a
// group named 'skirt' whose first mesh is the cloth and whose userData.stretch
// is { kneeR, top, hem, hemR } (see subjects/human/legwear.js).

const K = new THREE.Vector3();
const SPREAD = 0.6;   // how far round the skirt one knee pulls (radians)
const STRENGTH = 0.85; // < 1 keeps it light: the hem never fully wraps the knee

export function stretchSkirt(skirt, knees) {
  const s = skirt.userData.stretch;
  const cloth = skirt.children.find((c) => c.isMesh);
  if (!s || !cloth) return;
  const pos = cloth.geometry.attributes.position;
  if (!cloth.userData.rest) cloth.userData.rest = Float32Array.from(pos.array);
  const rest = cloth.userData.rest;
  // knees in cloth space: that space is before the cloth's front-to-back
  // squash, so the skirt is round there and angles compare directly
  skirt.updateWorldMatrix(true, false);
  const ks = [];
  for (const knee of knees) {
    if (!knee) continue;
    knee.getWorldPosition(K);
    cloth.worldToLocal(K);
    ks.push({ az: Math.atan2(K.x, K.z), r: Math.hypot(K.x, K.z), y: K.y });
  }

  // How much the hem must move at each knee's angle: out to clear the knee,
  // and up when the knee rises above the hem (the cloth drapes over it).
  // Worked out once at the hem, then eased in toward the waist.
  const m = s.kneeR * 1.4; // clearance round the knee
  const pulls = ks.map((k) => ({ az: k.az,
    out: Math.max(0, k.r + m - s.hemR),
    up: Math.max(0, k.y - m - s.hem) }));
  for (let i = 0; i < pos.count; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    const along = Math.min(1, Math.max(0, (s.top - y) / (s.top - s.hem))); // 0 waist .. 1 hem
    let dr = 0, dy = 0;
    if (along > 0.01) {
      const az = Math.atan2(x, z);
      for (const p of pulls) {
        let d = Math.abs(az - p.az);
        if (d > Math.PI) d = Math.PI * 2 - d;
        const w = Math.exp(-((d / SPREAD) ** 2)) * STRENGTH;
        dr = Math.max(dr, w * p.out * along);
        dy = Math.max(dy, w * p.up * along * along);
      }
    }
    const r = Math.hypot(x, z);
    const kr = (r + dr) / Math.max(r, 1e-6);
    pos.setXYZ(i, x * kr, y + dy, z * kr);
  }
  pos.needsUpdate = true;
  cloth.geometry.computeVertexNormals();
}
