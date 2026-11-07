import * as THREE from 'three';
import { disposeGeometry, setDetail } from '../lib/shapes.js';
import { mulberry32 } from '../lib/rng.js';

// A Cell is one little stage: its own scene, lights, ground and camera,
// holding one or more subjects rendered in one style. The gallery is a grid
// of cells (subject x style); the lineup is a single cell with every subject.
//
// entries: [{ subject, overrides? }] – overrides pin parameters (e.g. a tree
// preset) on top of the live slider values.
// backdrop: 'street' adds a road, sidewalk and a row of box buildings.

const VIEW_DIR = new THREE.Vector3(0.62, 0.32, 1).normalize(); // 3/4 front view
const FOV = 30;

export class Cell {
  constructor({ entries, style, renderer, gap = 0.35, viewDir, backdrop = null }) {
    this.backdrop = backdrop;
    this.viewDir = viewDir ? new THREE.Vector3(...viewDir).normalize() : VIEW_DIR;
    this.entries = entries;
    this.style = style;
    this.gap = gap;
    this.scene = new THREE.Scene();
    this.baseBackground = new THREE.Color(style.background);
    this.scene.background = this.baseBackground.clone();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 500);

    const lights = style.createLights({ renderer });
    this.key = lights.key;
    this.hemi = lights.hemi;
    this.base = {
      keyColor: this.key.color.clone(),
      keyIntensity: this.key.intensity,
      hemiIntensity: this.hemi?.intensity ?? 0,
    };
    lights.objects.forEach((o) => this.scene.add(o));
    if (lights.environment) {
      this.scene.environment = lights.environment;
      this.scene.environmentIntensity = lights.environmentIntensity ?? 1;
    }
    if (style.fog) this.scene.fog = new THREE.Fog(this.scene.background.clone(), 10, 100);
    this.lightDir = new THREE.Vector3(0.5, 1, 0.6).normalize();

    this.content = new THREE.Group();
    this.scene.add(this.content);
    this.pivots = [];
    this.center = new THREE.Vector3();
    this.radius = 1;
  }

  setBackdrop(backdrop) {
    this.backdrop = backdrop;
  }

  has(subjectId) {
    return this.entries.some((e) => e.subject.id === subjectId);
  }

  rebuild(params) {
    disposeGeometry(this.content);
    this.content.clear();
    this.pivots = [];

    setDetail(this.style.detail ?? 1);
    const items = this.entries.map(({ subject, overrides }) => {
      const p = overrides ? { ...params[subject.id], ...overrides } : params[subject.id];
      const obj = subject.build(p, this.style);
      this.style.decorate?.(obj);
      obj.traverse((o) => {
        if (o.isMesh && !o.userData.outline) { o.castShadow = true; o.receiveShadow = true; }
      });
      const box = new THREE.Box3().setFromObject(obj);
      // horizontal radius: the footprint the subject sweeps while spinning
      const hr = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z);
      return { obj, box, hr };
    });
    setDetail(1);

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

    // a wide ground plane, so subjects read as standing in a world
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), this.style.material('ground'));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = this.backdrop === 'street' ? -0.16 : 0;
    ground.receiveShadow = true;
    this.content.add(ground);
    if (this.backdrop === 'street') this.content.add(this.buildStreet(bounds));

    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    this.bounds = bounds;
    this.center.copy(sphere.center);
    this.radius = sphere.radius;
    this.fitLight();
  }

  /** Sidewalk under the subjects, a road in front, box buildings behind. */
  buildStreet(bounds) {
    setDetail(this.style.detail ?? 1);
    const M = (role) => this.style.material(role);
    const street = new THREE.Group();
    const len = Math.max(40, bounds.max.x - bounds.min.x + 30);
    const backZ = bounds.min.z - 2.5; // building line, set back from the subjects
    const walkDepth = bounds.max.z - backZ + 1.5;

    const walk = new THREE.Mesh(new THREE.BoxGeometry(len, 0.15, walkDepth), M('sidewalk'));
    walk.position.set(0, -0.075, backZ + walkDepth / 2);
    const road = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 7), M('road'));
    road.position.set(0, -0.15, backZ + walkDepth + 3.5);
    street.add(walk, road);

    // buildings: seeded so the street looks the same every time
    const rng = mulberry32(42);
    let x = -len / 2;
    let i = 0;
    while (x < len / 2) {
      const w = 5 + rng() * 6;
      const h = 7 + rng() * 16;
      const d = 8;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, h, d), M(i++ % 2 ? 'building' : 'buildingAlt'));
      b.position.set(x + w / 2, h / 2 - 0.15, backZ - d / 2);
      street.add(b);
      // a window band per 3 m floor: gives the eye a sense of scale
      for (let y = 3; y < h - 1.5; y += 3) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(w - 1.3, 1.2, 0.1), M('window'));
        band.position.set(x + w / 2, y + 0.2, backZ + 0.03);
        street.add(band);
      }
      x += w;
    }
    street.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.style.decorate?.(street);
    setDetail(1);
    return street;
  }

  /** Apply a lighting preset (see styles/index.js) on top of the style's lights. */
  applyLighting(preset) {
    this.key.color.copy(this.base.keyColor).multiply(new THREE.Color(preset.keyColor));
    this.key.intensity = this.base.keyIntensity * preset.key;
    if (this.hemi) this.hemi.intensity = this.base.hemiIntensity * preset.hemi;
    this.scene.background.copy(this.baseBackground);
    if (preset.tint !== null) this.scene.background.lerp(new THREE.Color(preset.tint), preset.tintAmount);
    this.scene.fog?.color.copy(this.scene.background);
    this.lightDir.set(...preset.dir).normalize();
    this.fitLight();
  }

  fitLight() {
    const r = this.radius;
    this.key.position.copy(this.center).addScaledVector(this.lightDir, r * 4);
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

  /**
   * Place `camera` so the subjects' bounding box fits the given aspect ratio.
   * minHeight > 0 frames at least that many metres of height, which shows the
   * subject small, as it would appear from across a street.
   */
  frame(aspect, camera = this.camera, { margin = 1.1, minHeight = 0 } = {}) {
    camera.fov = FOV;
    camera.aspect = aspect;
    const tv = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    const th = tv * aspect;
    // camera basis, matching Object3D.lookAt: z = back, x = right, y = up
    const right = new THREE.Vector3(0, 1, 0).cross(this.viewDir).normalize();
    const up = this.viewDir.clone().cross(right);
    let dist = 0;
    const box = this.bounds.clone();
    if (minHeight > 0) {
      const c = box.getCenter(new THREE.Vector3());
      const half = minHeight * 0.3;
      box.expandByPoint(new THREE.Vector3(c.x - half, 0, c.z));
      box.expandByPoint(new THREE.Vector3(c.x + half, minHeight * 0.75, c.z));
    }
    const center = box.getBoundingSphere(new THREE.Sphere()).center;
    if (minHeight > 0) center.y = Math.min(center.y, this.bounds.max.y);
    this.viewCenter = center;
    const { min, max } = box;
    const p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).sub(center);
      const z = p.dot(this.viewDir);
      dist = Math.max(dist, (Math.abs(p.dot(right)) * margin) / th + z, (Math.abs(p.dot(up)) * margin) / tv + z);
    }
    camera.position.copy(center).addScaledVector(this.viewDir, dist);
    camera.near = Math.max(0.05, dist * 0.05);
    camera.far = dist + 120;
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    if (this.scene.fog) {
      // keep the subject clear, fade the far ground and buildings
      this.scene.fog.near = dist + this.radius;
      this.scene.fog.far = dist + this.radius + Math.max(25, dist * 2.5);
    }
  }
}
