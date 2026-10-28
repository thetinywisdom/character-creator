// Held-item poses. The left hand keeps iso-city's grip, strum, sip, hoop and leash.
import * as THREE from 'three';
import { HULA_W as SY_W } from './anim.js';

const HELD_POSE = {
  umbrella: { w: [0.21, 1.4, 0.24], e: [0.44, 1.28, -0.05] },
  phone: { w: [0.09, 1.56, 0.3], e: [0.36, 1.3, 0.02], f: -0.4 },
  coffee: { w: [0.16, 1.24, 0.28], e: [0.38, 1.2, -0.05] },
  icecream: { w: [0.15, 1.3, 0.28], e: [0.38, 1.2, -0.05] },
  balloon: { w: [0.27, 1.22, 0.16], e: [0.45, 1.3, -0.1] },
  flowers: { w: [0.14, 1.22, 0.3], e: [0.38, 1.2, -0.05] },
  boombox: { w: [0.27, 1.86, 0.03], e: [0.46, 1.58, -0.1] },
  football: { w: [0.16, 1.1, 0.3], e: [0.4, 1.16, -0.1], idleOnly: true },
};
const _hp = new THREE.Vector3(), _hq = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Wire iso-city hold / prop hooks. `props` comes from placeLeftHeld. */
export function attachHeld(ch, props) {
  const { held, item, guitar, dog, leash, ring, zF, ringS, ringZ, armOff } = props;
  ch.heldItem = item; ch.guitar = guitar; ch.dog = dog; ch.ring = ring; ch.idleHula = true;
  ch.armOff = armOff;
  const pose = HELD_POSE[held];
  ch.hold = (c) => {
    if (c._kd || (c._dance && c._danceW >= 0.999)) return;
    const ty = c.parts.torso.rotation.y, idle = c.walk < 0.25 && c.air < 0.5, t = c.t;
    c._idleProp = idle;
    if (guitar) {
      guitar.parent.rotation.y = ty;
      c._armIK('L', [0.33, 1.43, 0.25 + zF], [0.5, 1.2, -0.05], 0.3, 0, ty);
      if (idle && !c.slapping) {   // strum
        const s = Math.sin(t * 13);
        c._armIK('R', [-0.04, 1.15 + 0.055 * s, 0.28 + zF], [-0.42, 1.2, -0.05], -0.3, -0.3 * s, ty);
        c.parts.head.rotation.x += 0.08 * Math.max(0, Math.sin(t * 6.5));
      }
      return;
    }
    if (dog) return;
    if (ring) {   // hand rests on the ring at the left hip; standing still a while -> hula-hoop it (Kimata's idle)
      c._ringIdle = ch.idleHula !== false && idle && !c.slapping && !c._dance ? (c._ringIdle || 0) + (c._lastD || 0.016) : 0;
      const e = smooth(1.2, 2.0, c._ringIdle || 0);
      c._ringE = e;
      if (e > 0.001) {
        const ph = c._ringPh = (c._ringPh || 0) + (c._lastD || 0.016) * SY_W;
        const H = c.h, P2 = c.parts, cs = Math.cos(ph), sn = Math.sin(ph);
        P2.body.position.x += 0.06 * cs * e * H; P2.body.position.z += 0.045 * sn * e * H;
        P2.body.rotation.z += -0.08 * cs * e; P2.torso.rotation.y += -0.08 * sn * e;
        const b = Math.sin(ph * 2) * 0.03;
        c._armIK('L', [0.42 + ch.armOff.x, 1.62 + b, 0.06], [0.55, 1.4, -0.1], 0, 0.3, 0);
        c._armIK('R', [-0.42 - ch.armOff.x, 1.62 + b, 0.06], [-0.55, 1.4, -0.1], 0, 0.3, 0);
      } else if (!c._dance || c._danceW < 0.999) c._armIK('L', [0.37 + ch.armOff.x, 1.08, 0.08 + ringZ], [0.48, 1.32, -0.2], 0.3, 0, ty);
      return;
    }
    if (!pose || (pose.idleOnly && !idle)) return;
    let w = pose.w;
    if (held === 'football') { const k = Math.abs(Math.sin(t * 3.4)); w = [w[0], w[1] - 0.06 * (1 - k), w[2]]; }
    if (held === 'coffee' && t % 6 > 4.8) w = [0.06, 1.62, 0.22];   // a sip
    if (held === 'icecream' && t % 5 > 3.9) w = [0.05, 1.6, 0.22];   // a lick
    c._armIK('L', [w[0], w[1], w[2] + zF], pose.e, 0, pose.f || 0, ty);
    if (held === 'boombox' && idle) {   // bob to the beat
      const b = Math.abs(Math.sin(t * 7));
      c.parts.head.rotation.x += 0.16 * b - 0.05; c.parts.body.position.y -= 0.025 * b * c.h;
    }
    if (held === 'phone') c.parts.head.rotation.x += 0.28;
  };
  const rIdleQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.6, Math.PI / 2 - 0.12, 'YXZ'));
  const rq = new THREE.Quaternion(), rs = new THREE.Quaternion(), rp = new THREE.Vector3(), re = new THREE.Euler();
  ch.prop = (c, dp, dw) => {
    const P = c.parts, t = c.t;
    if (ring) {
      const H = c.h;
      ring.scale.setScalar(ringS * H);
      ring.position.set((0.43 + ch.armOff.x) * H, 0.62 * H, (0.07 + ringZ) * H); ring.quaternion.copy(rIdleQ);
      // hula: the hula dance's own params, or the idle hoop
      let p = null, w = 0;
      if (dp && dp.ph !== undefined && dw > 0) { p = dp; w = dw; }
      else if ((c._ringE || 0) > 0.001) { const ph = c._ringPh || 0; p = { ph, e: 1, hx: 0.06 * Math.cos(ph), hz: 0.045 * Math.sin(ph), dip: 0 }; w = c._ringE; }
      if (p) {
        const off = 0.105 * ringS;
        rp.set((p.hx + off * Math.cos(p.ph - Math.PI / 2) * p.e) * H, (1.0 - p.dip + 0.04 * Math.sin(p.ph * 2) * p.e) * H, (p.hz + off * Math.sin(p.ph - Math.PI / 2) * p.e) * H);
        re.set(0.28 * Math.cos(p.ph) * p.e, 0, 0.55 * Math.sin(p.ph) * p.e);
        rq.setFromEuler(re); rs.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -p.ph * 0.6); rq.multiply(rs);
        ring.position.lerp(rp, w); ring.quaternion.slerp(rq, w);
      }
    }
    if (item) {
      P.wristL.updateWorldMatrix(true, false);
      P.wristL.localToWorld(_hp.set(0, -0.1, 0.02)); P.body.worldToLocal(_hp);
      item.position.copy(_hp); item.rotation.set(0, P.torso.rotation.y, 0);
      if (held === 'football') {
        const ball = item.getObjectByName('ball');
        const up = c._idleProp && !c._dance ? 0.08 + 0.42 * Math.abs(Math.sin(t * 3.4)) : -0.02;
        ball.position.set(c._idleProp ? 0 : 0.06, up, 0); ball.rotation.x = t * (c._idleProp ? 7 : 2);
      } else if (held === 'balloon') {
        const b = item.getObjectByName('balloon'); b.position.x = 0.05 * Math.sin(t * 1.3); b.position.y = 1.06 + 0.03 * Math.sin(t * 2.1);
      } else if (held === 'baguette' || held === 'skateboard' || held === 'briefcase' || held === 'shopping') {
        item.rotation.x = 0.15 * Math.sin(t * 2) * c.walk;
      }
    }
    if (dog) {
      const sp = c.walk, ph = c.phase * Math.PI * 4;
      dog.userData.legs.forEach((L, i) => { L.rotation.x = sp > 0.05 ? 0.7 * Math.sin(ph + (i % 3 ? Math.PI : 0)) * sp : 0; });
      dog.userData.body.position.y = 0.2 + (sp > 0.05 ? 0.02 * Math.abs(Math.sin(ph)) : 0);
      dog.userData.tail.rotation.y = 0.6 * Math.sin(t * (sp > 0.05 ? 9 : 14));
      dog.userData.head.rotation.x = sp > 0.05 ? 0 : 0.12 * Math.sin(t * 1.7);
      dog.position.x = 0.55 + (sp > 0.05 ? 0 : 0.06 * Math.sin(t * 0.7)); dog.position.z = 0.5 + 0.12 * sp;
      P.wristL.updateWorldMatrix(true, false);
      P.wristL.localToWorld(_hp.set(0, -0.12, 0.02)); c.root.worldToLocal(_hp);
      _hq.set(dog.position.x, 0.29, dog.position.z + 0.14);
      leash.position.copy(_hp).add(_hq).multiplyScalar(0.5);
      leash.scale.set(1, 1, _hp.distanceTo(_hq)); leash.lookAt(c.root.localToWorld(_hq.clone()));
    }
  };
}
