import * as THREE from 'three';
import { disposeGeometry } from '../lib/shapes.js';

// A Cell is one little stage: its own scene, lights, ground and camera,
// holding one or more subjects rendered in one style. The gallery is a grid
// of cells (subject x style); the lineup is a single cell with every subject.

const VIEW_DIR = new THREE.Vector3(0.62, 0.32, 1).normalize(); // 3/4 front view
const LIGHT_DIR = new THREE.Vector3(0.5, 1, 0.6).normalize();
const FOV = 30;

export class Cell {
  constructor({ subjects, style, gap = 0.35 }) {
    this.subjects = subjects;
    this.style = style;
    this.gap = gap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(style.background);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 500);
    const lights = style.createLights();
    this.key = lights.key;
    lights.objects.forEach((o) => this.scene.add(o));
    this.content = new THREE.Group();
    this.scene.add(this.content);
    this.pivots = [];
    this.center = new THREE.Vector3();
    this.radius = 1;
  }

  has(subjectId) {
    return this.subjects.some((s) => s.id === subjectId);
  }

  rebuild(params) {
    disposeGeometry(this.content);
    this.content.clear();
    this.pivots = [];

    const items = this.subjects.map((s) => {
      const obj = s.build(params[s.id], this.style);
      obj.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      const box = new THREE.Box3().setFromObject(obj);
      // horizontal radius: the footprint the subject sweeps while spinning
      const hr = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z);
      return { obj, box, hr };
    });

    // lay subjects out left to right, centred on x = 0
    const xs = [];
    let x = 0;
    items.forEach((it, i) => {
      if (i > 0) x += items[i - 1].hr + this.gap + it.hr;
      xs.push(x);
    });
    const shift = (xs[0] - items[0].hr + xs.at(-1) + items.at(-1).hr) / 2;

    const bounds = new THREE.Box3();
    items.forEach((it, i) => {
      const pivot = new THREE.Group();
      pivot.position.x = xs[i] - shift;
      pivot.add(it.obj);
      this.content.add(pivot);
      this.pivots.push(pivot);
      bounds.expandByPoint(new THREE.Vector3(pivot.position.x - it.hr, it.box.min.y, -it.hr));
      bounds.expandByPoint(new THREE.Vector3(pivot.position.x + it.hr, it.box.max.y, it.hr));
    });

    const size = bounds.getSize(new THREE.Vector3());
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(size.x, size.z) * 0.62 + 0.1, 64),
      this.style.material('ground'),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.content.add(ground);

    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    this.bounds = bounds;
    this.center.copy(sphere.center);
    this.radius = sphere.radius;
    this.fitLight();
  }

  fitLight() {
    const r = this.radius;
    this.key.position.copy(this.center).addScaledVector(LIGHT_DIR, r * 4);
    this.key.target.position.copy(this.center);
    const cam = this.key.shadow.camera;
    cam.left = -r * 1.3; cam.right = r * 1.3;
    cam.top = r * 1.3; cam.bottom = -r * 1.3;
    cam.near = 0.05; cam.far = r * 8;
    cam.updateProjectionMatrix();
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02 * r;
  }

  setAngle(angle) {
    for (const p of this.pivots) p.rotation.y = angle;
  }

  /** Place `camera` so the subjects' bounding box fits the given aspect ratio. */
  frame(aspect, camera = this.camera, margin = 1.1) {
    camera.fov = FOV;
    camera.aspect = aspect;
    const tv = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    const th = tv * aspect;
    // camera basis, matching Object3D.lookAt: z = back, x = right, y = up
    const right = new THREE.Vector3(0, 1, 0).cross(VIEW_DIR).normalize();
    const up = VIEW_DIR.clone().cross(right);
    let dist = 0;
    const { min, max } = this.bounds;
    const p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).sub(this.center);
      const z = p.dot(VIEW_DIR);
      dist = Math.max(dist, (Math.abs(p.dot(right)) * margin) / th + z, (Math.abs(p.dot(up)) * margin) / tv + z);
    }
    camera.position.copy(this.center).addScaledVector(VIEW_DIR, dist);
    camera.near = Math.max(0.01, dist - this.radius * 3);
    camera.far = dist + this.radius * 6;
    camera.lookAt(this.center);
    camera.updateProjectionMatrix();
  }
}
