import * as THREE from 'three';
import { COMIC } from '../palette.js';

// ---------------------------------------------------------------------------
// Full-resolution cartoon pipeline (the old low-res pixel-art pass is gone)
//  1. scene -> full-res colour target (+ depth texture), palette-ramp toon materials
//  2. scene -> view-space normal target (override material)
//  3. post pass straight to the canvas: black ink outlines (depth silhouettes + hard
//     creases), then nearest-colour snap to the Comic palette (OKLab).
// ---------------------------------------------------------------------------

// Palette exception: the two watermelon greens are used only by the watermelon pool ring.
// Everything else stays on the Comic palette.
export const PROP_GREENS = ['#4DBA5A', '#1F6B35'];
export const PALETTE_HEX = [...Object.values(COMIC).flat(), ...PROP_GREENS];

function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

const N = PALETTE_HEX.length;
const PAL_SRGB = PALETTE_HEX.map((h) => new THREE.Vector3(...hexRGB(h)));
const PAL_LAB = PALETTE_HEX.map((h) => new THREE.Vector3(...oklab(hexRGB(h).map(srgbToLinear))));

const FS_VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const POST_FRAG = /* glsl */`
precision highp float;
#define NPAL ${N}
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tNormal;
uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform float uThick;
uniform float uDepthThr; uniform float uNormalThr;
uniform vec3 uOutline;
uniform bool uOutlines; uniform bool uQuant;
uniform vec3 uPal[NPAL]; uniform vec3 uPalLab[NPAL];
varying vec2 vUv;

float linDepth(float d){ return d >= 0.99999 ? uFar * 4.0 : uNear + d * (uFar - uNear); } // orthographic: linear
vec3 lin2srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
vec3 oklab(vec3 c){
  float l = 0.4122214708*c.r + 0.5363325363*c.g + 0.0514459929*c.b;
  float m = 0.2119034982*c.r + 0.6806995451*c.g + 0.1073969566*c.b;
  float s = 0.0883024619*c.r + 0.2817188376*c.g + 0.6299787005*c.b;
  l = pow(max(l, 0.0), 1.0/3.0); m = pow(max(m, 0.0), 1.0/3.0); s = pow(max(s, 0.0), 1.0/3.0);
  return vec3(0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
              1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
              0.0259040371*l + 0.7827717662*m - 0.8086757660*s);
}
// cartoon ink: silhouettes (depth jump to something farther) + hard creases (normal jump), drawn on the near side only
void neighbour(vec2 o, float d, vec3 n, bool hasN, inout float edge){
  vec2 uv = vUv + o * uThick / uRes;
  float nd = linDepth(texture2D(tDepth, uv).r);
  float diff = nd - d;
  if (diff > uDepthThr) { edge = 1.0; return; }
  if (!hasN) return;
  vec4 nt = texture2D(tNormal, uv);
  if (nt.a > 0.5 && diff > -uDepthThr * 0.5) {
    vec3 nn = nt.rgb * 2.0 - 1.0;
    if (dot(n - nn, vec3(1.0)) > 0.01 && distance(n, nn) > uNormalThr) edge = 1.0;
  }
}
void main(){
  vec3 col = texture2D(tColor, vUv).rgb;   // linear
  float d0 = texture2D(tDepth, vUv).r;
  vec4 nt0 = texture2D(tNormal, vUv);
  if (uOutlines && d0 < 0.99999 && nt0.a > 0.5) {   // only building pixels get ink
    float d = linDepth(d0);
    vec4 nt = nt0;
    vec3 n = nt.rgb * 2.0 - 1.0; bool hasN = true;
    float e = 0.0;
    neighbour(vec2( 1.0, 0.0), d, n, hasN, e); neighbour(vec2(-1.0, 0.0), d, n, hasN, e);
    neighbour(vec2( 0.0, 1.0), d, n, hasN, e); neighbour(vec2( 0.0,-1.0), d, n, hasN, e);
    neighbour(vec2( 0.7, 0.7), d, n, hasN, e); neighbour(vec2(-0.7, 0.7), d, n, hasN, e);
    neighbour(vec2( 0.7,-0.7), d, n, hasN, e); neighbour(vec2(-0.7,-0.7), d, n, hasN, e);
    if (e > 0.5) { gl_FragColor = vec4(uOutline, 1.0); return; }
  }
  if (!uQuant) { gl_FragColor = vec4(lin2srgb(clamp(col, 0.0, 1.0)), 1.0); return; }
  vec3 lab = oklab(col);
  float best = 1e9; vec3 outc = uPal[0];
  for (int i = 0; i < NPAL; i++) {
    vec3 dl = lab - uPalLab[i];
    dl.yz *= 1.4;                           // keep hue families together
    float dd = dot(dl, dl);
    if (dd < best) { best = dd; outc = uPal[i]; }
  }
  gl_FragColor = vec4(outc, 1.0);           // exact palette sRGB values
}`;

// ---------------------------------------------------------------------------
// Palette-ramp toon shading. Every lit fragment is snapped to one of three tones
// picked by hand from the Comic palette for its base colour, the way a pixel
// artist shades: [sunlit / top, shaded side, cast shadow]. Hue stays inside a
// family (with a little hue-shift for light tints) instead of drifting.
// ---------------------------------------------------------------------------
//            base        shaded side  cast shadow / dark
export const RAMPS = {
  '#203A57': ['#203A57', '#292C2E'], '#2A5B94': ['#203A57', '#203A57'], '#3B7EE1': ['#2A5B94', '#2A5B94'],
  '#B0E9FF': ['#3B7EE1', '#3B7EE1'], '#DBF5FE': ['#B0E9FF', '#B0E9FF'],
  '#A92D59': ['#4C3F42', '#4C3F42'], '#FF5491': ['#A92D59', '#A92D59'], '#FF7DAF': ['#FF5491', '#FF5491'],
  '#F8C0C5': ['#DF9E89', '#DF9E89'], '#F9F0F1': ['#F8C0C5', '#F8C0C5'],
  '#194A4C': ['#292C2E', '#292C2E'], '#198085': ['#194A4C', '#194A4C'], '#00B4BC': ['#198085', '#198085'],
  '#A8ECF2': ['#B0E9FF', '#00B4BC'], '#EFFAFA': ['#A8ECF2', '#A8ECF2'],
  '#4C3F42': ['#292C2E', '#292C2E'], '#93616B': ['#4C3F42', '#4C3F42'], '#DF9E89': ['#93616B', '#93616B'],
  '#F1CDC3': ['#DF9E89', '#DF9E89'], '#FCF0ED': ['#F1CDC3', '#F1CDC3'],
  '#292C2E': ['#292C2E', '#292C2E'], '#363E47': ['#292C2E', '#292C2E'], '#5B6A7B': ['#363E47', '#363E47'],
  '#A7BFA4': ['#5B6A7B', '#5B6A7B'], '#F0F2F4': ['#DBF5FE', '#DBF5FE'],
  '#ED8F02': ['#93616B', '#93616B'], '#FFCC3F': ['#ED8F02', '#ED8F02'], '#FFE166': ['#FFCC3F', '#FFCC3F'],
  '#FFF3C1': ['#FFE166', '#FFCC3F'], '#FCF9EB': ['#FFF3C1', '#FFF3C1'],
};
// Off-palette colours used by the character module, mapped onto palette ramps.
// #B6C2CA is the NPC blue-grey. The old ramp lit it as #DBF5FE (near white),
// so a close-up face was blank. The Comic palette has no cool grey at that
// lightness — the nearest swatch is a green — so this uses the skin ramp.
export const ALIASES = { '#B6C2CA': ['#F1CDC3', '#DF9E89', '#93616B'], '#ED612B': ['#ED8F02', '#93616B', '#93616B'],
  '#4DBA5A': ['#4DBA5A', '#1F6B35', '#1F6B35'], '#1F6B35': ['#1F6B35', '#194A4C', '#194A4C'] };   // prop-only greens (see PROP_GREENS)

const MATCH = [], OUT0 = [], OUT1 = [], OUT2 = [];
for (const [h, [m, d]] of Object.entries(RAMPS)) { MATCH.push(h); OUT0.push(h); OUT1.push(m); OUT2.push(d); }
for (const [h, [b, m, d]] of Object.entries(ALIASES)) { MATCH.push(h); OUT0.push(b); OUT1.push(m); OUT2.push(d); }
const col = (h) => new THREE.Color(h); // linear working space
export const rampUniforms = {
  uMatch: { value: MATCH.map(col) }, uOut0: { value: OUT0.map(col) }, uOut1: { value: OUT1.map(col) }, uOut2: { value: OUT2.map(col) },
  uSunI: { value: 1.4 }, uTopThr: { value: 0.6 }, uSideThr: { value: 0.2 },
};
const NR = MATCH.length;
const RAMP_CHUNK = /* glsl */`
{
  vec3 base = diffuseColor.rgb;
  vec3 o0 = vO0, o1 = vO1, o2 = vO2;   // ramp resolved per vertex (flat)
  float lb = max(dot(base, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
  float sun = dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722)) / (lb * uSunI * RECIPROCAL_PI);
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float up = dot(normalize(normal), upV);
  vec3 tone;
  if (up > 0.7) tone = sun > uTopThr ? o0 : o2;          // ground / roofs: lit or in cast shadow
  else tone = sun > uSideThr ? o0 : (up < -0.3 ? o2 : o1); // walls: sunlit side or shaded side
  outgoingLight = tone;
}
#include <opaque_fragment>`;

function rampMaterial(m) {
  const r = m.clone();
  r.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, rampUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', `uniform vec3 diffuse; uniform vec3 uMatch[${NR}]; uniform vec3 uOut0[${NR}]; uniform vec3 uOut1[${NR}]; uniform vec3 uOut2[${NR}];
flat varying vec3 vO0; flat varying vec3 vO1; flat varying vec3 vO2;
void main() {`)
      .replace('#include <color_vertex>', `#include <color_vertex>
  {
    vec3 base = diffuse;
    #if defined( USE_COLOR )
      base *= color.rgb;
    #endif
    float best = 1e9; int bi = 0;
    for (int i = 0; i < ${NR}; i++) { vec3 d = base - uMatch[i]; float dd = dot(d, d); if (dd < best) { best = dd; bi = i; } }
    vO0 = uOut0[bi]; vO1 = uOut1[bi]; vO2 = uOut2[bi];
  }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `flat varying vec3 vO0; flat varying vec3 vO1; flat varying vec3 vO2;\nuniform float uSunI; uniform float uTopThr; uniform float uSideThr;\nvoid main() {`)
      .replace('#include <opaque_fragment>', RAMP_CHUNK);
  };
  r.customProgramCacheKey = () => 'pixelRamp';
  r.userData.orig = m;
  return r;
}

// Ink (cartoon outlines) is drawn ONLY on buildings: building meshes join INK_LAYER, the normal pass
// renders just that layer (depth-tested against everything), and the post pass only inks building pixels.
export const INK_LAYER = 5;
export function markInk(o) { o?.traverse?.((m) => m.layers.enable(INK_LAYER)); return o; }

export class PixelPipeline {
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.enabled = true; this.scale = 1;          // kept for callers that snap UI to the render grid
    this.toonCache = new WeakMap();
    this._toonRoots = new Set();
    const rt = (depth) => {
      const t = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
      if (depth) { t.depthTexture = new THREE.DepthTexture(4, 4); t.depthTexture.type = THREE.UnsignedIntType;
        t.depthTexture.minFilter = t.depthTexture.magFilter = THREE.NearestFilter; }
      return t;
    };
    this.colorRT = rt(true); this.normalRT = rt(false);
    this.normalMat = new THREE.MeshNormalMaterial({ flatShading: true });
    this.depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });   // depth-only pre-pass so hidden building bits get no ink
    this.postMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: this.colorRT.texture }, tDepth: { value: this.colorRT.depthTexture }, tNormal: { value: this.normalRT.texture },
        uRes: { value: new THREE.Vector2() }, uNear: { value: 1 }, uFar: { value: 600 }, uThick: { value: 2 },
        uDepthThr: { value: 0.3 }, uNormalThr: { value: opts.normalThr ?? 0.9 },
        uOutline: { value: (() => { const h = parseInt((opts.outline ?? '#292C2E').slice(1), 16); return new THREE.Vector3((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255); })() },   // raw sRGB, written as-is
        uOutlines: { value: opts.outlines ?? true }, uQuant: { value: true },
        uPal: { value: PAL_SRGB }, uPalLab: { value: PAL_LAB },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene(); this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.thickCss = opts.thickness ?? 1.1;          // ink width in CSS pixels
    this.setSize(window.innerWidth, window.innerHeight);
  }

  get outlines() { return this.postMat.uniforms.uOutlines.value; }
  set outlines(v) { this.postMat.uniforms.uOutlines.value = v; }
  get dither() { return false; }
  set dither(v) {}
  get quantize() { return this.postMat.uniforms.uQuant.value; }
  set quantize(v) { this.postMat.uniforms.uQuant.value = v; }

  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    this.width = w; this.height = h; this.pr = pr;
    const W = Math.max(1, Math.round(w * pr)), H = Math.max(1, Math.round(h * pr));
    for (const t of [this.colorRT, this.normalRT]) t.setSize(W, H);
    this.postMat.uniforms.uRes.value.set(W, H);
    this.postMat.uniforms.uThick.value = Math.max(1, Math.round(this.thickCss * pr));
  }
  setScale() {}

  // Swap Lambert materials under `root` for palette-ramp toon versions.
  toonify(root, on = true) {
    this._toonRoots.add(root);
    root.traverse((o) => {
      if (!o.isMesh || o.userData.isGhost) return;
      const swap = (m) => {
        if (on) {
          if (!m.isMeshLambertMaterial || m.userData.orig) return m;
          let t = this.toonCache.get(m);
          if (!t) { t = rampMaterial(m); this.toonCache.set(m, t); }
          return t;
        }
        return m.userData.orig || m;
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
  }
  setEnabled() {}

  // Place an orthographic camera (iso offset from target) and size its frustum. Returns world size of one CSS pixel.
  placeCamera(camera, target, offset, viewHeight) {
    const aspect = this.width / this.height;
    camera.zoom = 1;
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    this.pixelWorld = viewHeight / this.height;
    return this.pixelWorld;
  }

  render(scene, camera) {
    const r = this.renderer, U = this.postMat.uniforms;
    U.uNear.value = camera.near; U.uFar.value = camera.far;
    U.uDepthThr.value = Math.max(0.3, (this.pixelWorld || 0.03) * this.thickCss * 7);
    const autoShadow = r.shadowMap.autoUpdate;
    r.setRenderTarget(this.colorRT); r.render(scene, camera);
    if (U.uOutlines.value) {
      r.shadowMap.autoUpdate = false;
      const bg = scene.background, fog = scene.fog, ov = scene.overrideMaterial;
      const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
      scene.background = null; scene.fog = null; scene.overrideMaterial = this.normalMat;
      const noInk = scene.userData.noInk, hid = [];
      if (noInk) for (const o of noInk) if (o.visible) { o.visible = false; hid.push(o); }
      r.setClearColor(0x000000, 0);
      r.setRenderTarget(this.normalRT);
      scene.overrideMaterial = this.depthMat; r.render(scene, camera);            // everything: depth only
      const mask = camera.layers.mask, ac = r.autoClear;
      camera.layers.set(INK_LAYER); scene.overrideMaterial = this.normalMat; r.autoClear = false;
      r.render(scene, camera);                                                     // buildings: normals, a = 1
      camera.layers.mask = mask; r.autoClear = ac;
      for (const o of hid) o.visible = true;
      scene.background = bg; scene.fog = fog; scene.overrideMaterial = ov;
      r.setClearColor(cc, ca);
      r.shadowMap.autoUpdate = autoShadow;
    }
    r.setRenderTarget(null); r.render(this.quadScene, this.quadCam);
  }
}

// Keep a following directional light's shadow map aligned to its own texel grid
// so hard shadow edges don't crawl as the light tracks the player.
const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
export function placeSnappedSun(sun, target, offset) {
  const cam = sun.shadow.camera;
  const texel = (cam.right - cam.left) / sun.shadow.mapSize.x;
  const dir = offset.clone().normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
  const up = dir.clone().cross(right).normalize();
  _v.copy(target);
  const a = _v.dot(right), b = _v.dot(up);
  _v.addScaledVector(right, Math.round(a / texel) * texel - a).addScaledVector(up, Math.round(b / texel) * texel - b);
  sun.target.position.copy(_v);
  sun.position.copy(_v).add(offset);
  sun.target.updateMatrixWorld();
}
