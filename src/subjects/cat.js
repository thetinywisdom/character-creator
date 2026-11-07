import * as THREE from 'three';
import { capsuleBetween, ellipsoid, seg } from '../lib/shapes.js';

// Cat gray-box, standing on all fours. Faces +z (head at +z, tail at -z).

export const cat = {
  id: 'cat',
  label: 'Cat',
  isCharacter: true,
  // drawn 1.5x real size so it reads from across a street (style guide §5)
  exaggeration: 1.5,
  schema: {
    bodyLength: { value: 0.42, min: 0.25, max: 0.6,  step: 0.01, label: 'Body length (m)' },
    chubbiness: { value: 1,    min: 0.7,  max: 1.6,  step: 0.01, label: 'Chubbiness' },
    legLength:  { value: 0.16, min: 0.08, max: 0.24, step: 0.005, label: 'Leg length (m)' },
    headSize:   { value: 1,    min: 0.7,  max: 1.5,  step: 0.01, label: 'Head size' },
    earSize:    { value: 1,    min: 0.5,  max: 1.8,  step: 0.01, label: 'Ear size' },
    tailLength: { value: 0.34, min: 0.1,  max: 0.5,  step: 0.01, label: 'Tail length (m)' },
    tailUp:     { value: 0.6,  min: 0,    max: 1,    step: 0.01, label: 'Tail raise' },
    tailCurl:   { value: 0.5,  min: 0,    max: 1,    step: 0.01, label: 'Tail curl' },
  },
  presets: {
    Housecat: { bodyLength: 0.42, chubbiness: 1,    legLength: 0.16, headSize: 1,    earSize: 1,   tailLength: 0.34 },
    Kitten:   { bodyLength: 0.28, chubbiness: 0.9,  legLength: 0.1,  headSize: 1.35, earSize: 1.3, tailLength: 0.2 },
    Chonk:    { bodyLength: 0.45, chubbiness: 1.55, legLength: 0.1,  headSize: 1.05, earSize: 0.8, tailLength: 0.26 },
    Lanky:    { bodyLength: 0.55, chubbiness: 0.75, legLength: 0.23, headSize: 0.9,  earSize: 1.45,  tailLength: 0.45 },
  },

  build(p, style) {
    const M = (role) => style.material(role);
    const root = new THREE.Group();
    root.name = 'cat';

    const L = p.bodyLength;
    const c = p.chubbiness;
    const bodyR = 0.075 * c;
    const legLen = p.legLength;
    const legR = 0.018 * Math.pow(c, 0.6);
    const bodyY = legLen + bodyR * 0.55;

    // --- body ----------------------------------------------------------
    const zb = Math.min(-L / 2 + bodyR, 0);
    const zf = Math.max(L / 2 - bodyR, 0);
    const body = capsuleBetween([0, bodyY, zb], [0, bodyY + bodyR * 0.12, zf], bodyR, M('fur'), 24);
    body.scale.x = 0.88;
    body.name = 'body';
    root.add(body);

    // --- legs + paws ---------------------------------------------------
    const legZ = { front: L / 2 - bodyR * 0.8, back: -L / 2 + bodyR * 0.9 };
    for (const [which, z] of Object.entries(legZ)) {
      for (const sx of [-1, 1]) {
        const x = sx * bodyR * 0.48;
        if (which === 'back') {
          root.add(ellipsoid(bodyR * 0.55, [0.6, 1, 1], M('fur'), { position: [sx * bodyR * 0.42, bodyY - bodyR * 0.25, z] }));
        }
        root.add(capsuleBetween([x, bodyY - bodyR * 0.2, z], [x, legR * 1.1, z], legR, M('fur')));
        root.add(ellipsoid(legR * 1.3, [1, 0.65, 1.3], M('furLight'), { position: [x, legR * 0.7, z + legR * 0.4] }));
      }
    }

    // --- head ----------------------------------------------------------
    const hr = 0.062 * p.headSize;
    const head = new THREE.Group();
    head.name = 'head';
    head.position.set(0, bodyY + bodyR * 0.75 + hr * 0.35, L / 2 + hr * 0.1);
    root.add(head);
    const rx = hr * 1.12, ry = hr * 0.95, rz = hr;
    head.add(ellipsoid(1, [rx, ry, rz], M('fur')));
    // muzzle bump keeps the head's profile readable; no eyes or nose
    head.add(ellipsoid(hr * 0.38, [1.25, 0.8, 0.85], M('fur'), { position: [0, -hr * 0.33, rz * 0.82] }));

    for (const sx of [-1, 1]) {
      // ears: flattened cones tilted outward, with a lighter inner ear
      const er_ = hr * 0.42 * p.earSize, eh = hr * 0.62 * p.earSize;
      const ear = new THREE.Group();
      ear.position.set(sx * rx * 0.52, ry * 0.62, -rz * 0.05);
      ear.rotation.z = -sx * 0.38;
      const outer = new THREE.Mesh(new THREE.ConeGeometry(er_, eh, seg(16)), M('fur'));
      outer.position.y = eh / 2;
      outer.scale.z = 0.45;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(er_ * 0.6, eh * 0.7, seg(16)), M('furLight'));
      inner.position.set(0, eh * 0.38, er_ * 0.12);
      inner.scale.z = 0.35;
      ear.add(outer, inner);
      head.add(ear);
    }

    // --- tail: a tapered tube that rises and curls forward -------------
    const tailR = 0.016 * Math.pow(c, 0.6);
    const n = 24;
    const segLen = p.tailLength / n;
    const a0 = 0.15 + p.tailUp * 1.2; // angle above horizontal, pointing back
    const pts = [new THREE.Vector3(0, bodyY + bodyR * 0.35, -L / 2 + bodyR * 0.25)];
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const a = a0 + p.tailCurl * 3.6 * Math.pow(t, 2.5); // curl mostly near the tip
      pts.push(pts[i - 1].clone().add(new THREE.Vector3(0, Math.sin(a), -Math.cos(a)).multiplyScalar(segLen)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubular = seg(48, 8), radial = seg(10, 4);
    const tube = new THREE.TubeGeometry(curve, tubular, tailR, radial, false);
    const pos = tube.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i <= tubular; i++) {
      const u = i / tubular;
      const centre = curve.getPointAt(u);
      const taper = 1 - 0.45 * u;
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        v.fromBufferAttribute(pos, k).sub(centre).multiplyScalar(taper).add(centre);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    const tail = new THREE.Mesh(tube, M('fur'));
    tail.name = 'tail';
    root.add(tail);
    root.add(ellipsoid(tailR * 0.55, [1, 1, 1], M('fur'), { position: pts[n].toArray() }));

    return root;
  },
};
