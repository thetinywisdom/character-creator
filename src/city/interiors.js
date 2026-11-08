import * as THREE from 'three';
import { box } from '../props/util.js';

// Shop interiors seen through the glass, in four ways (compared on the konbini):
//   'picture' (A)  a painted picture of the inside, flat behind the glass
//   'room'    (B)  a shallow 3D room: painted shelves, a glowing drinks fridge,
//                  a counter, ceiling lights (shelf items are painted, not modelled)
//   'shader'  (C)  one flat window drawn by a shader as a room with depth
//                  ("interior mapping"), including a layer of shelves and people
//   'hybrid'       B + simple stand-in people + posters on the glass
// Upper-floor windows can get painted curtains (paintedWindows).
// Every texture is drawn once on a canvas and shared by all shops.

const C = 128; // cell size of the painted textures

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}
const PRODUCTS = ['#d8302a', '#f0b818', '#2a62c8', '#279a4a', '#e8609a', '#ee7a18', '#7a3fbf', '#1fa3a0', '#c8302a'];
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

/** Rows of goods on white shelving, filling x, y, w, h. */
function paintShelves(g, x, y, w, h, rows = 4) {
  g.fillStyle = '#c8ccd0'; g.fillRect(x, y, w, h);
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    g.fillStyle = '#5a6068'; g.fillRect(x, y + r * rh + rh - 3, w, 3);  // shelf edge
    let px = x + 1;
    while (px < x + w - 2) {
      const pw = 5 + Math.floor(rnd() * 6);
      g.fillStyle = PRODUCTS[Math.floor(rnd() * PRODUCTS.length)];
      g.fillRect(px, y + r * rh + 3 + Math.floor(rnd() * 3), Math.min(pw, x + w - px - 1), rh - 7);
      px += pw + 1;
    }
  }
}
/** Glowing glass fridge doors full of drinks. */
function paintFridge(g, x, y, w, h) {
  g.fillStyle = '#bfe0f0'; g.fillRect(x, y, w, h);
  const doors = Math.max(2, Math.round(w / 26));
  for (let d = 0; d < doors; d++) {
    const dx = x + (d * w) / doors;
    g.fillStyle = '#4a5864'; g.fillRect(dx, y, 3, h);
    for (let r = 0; r < 5; r++) for (let b = 0; b < 4; b++) {
      g.fillStyle = PRODUCTS[Math.floor(rnd() * PRODUCTS.length)];
      g.fillRect(dx + 5 + b * ((w / doors - 7) / 4), y + 5 + r * ((h - 8) / 5), 4, (h - 8) / 5 - 3);
    }
  }
}
/** A flat-colour person seen from the front (for painted layers). */
function paintPerson(g, x, y, h, top, hair = '#2a2018') {
  const u = h / 8;
  g.fillStyle = '#2c3652'; g.fillRect(x - u * 0.9, y - u * 3.6, u * 1.8, u * 3.6);     // legs
  g.fillStyle = top; g.fillRect(x - u * 1.2, y - u * 6.4, u * 2.4, u * 2.9);           // body
  g.fillStyle = '#e0b48c'; g.fillRect(x - u * 0.7, y - u * 7.8, u * 1.4, u * 1.5);     // head
  g.fillStyle = hair; g.fillRect(x - u * 0.75, y - u * 8, u * 1.5, u * 0.6);
}

let shared = null;
/** All painted textures (made once). */
export function konbiniTextures() {
  if (shared) return shared;
  // shelves and fridge faces for the 3D room (B / hybrid)
  const [sc, sg] = canvas(C, C / 2); paintShelves(sg, 0, 0, C, C / 2, 4);
  const [fc, fg] = canvas(C, C / 2); paintFridge(fg, 0, 0, C, C / 2);
  // room atlas for the shader (C): back, left, right / floor, ceiling, middle layer
  const [ac, a] = canvas(C * 3, C * 2);
  paintFridge(a, 0, 0, C, C);                                         // back: drinks fridge
  paintShelves(a, C, 0, C, C, 5);                                     // left wall: shelves
  a.fillStyle = '#f4f4f0'; a.fillRect(C * 2, 0, C, C);                // right wall: counter, posters
  a.fillStyle = '#d8d4cc'; a.fillRect(C * 2, C * 0.55, C, C * 0.45);
  a.fillStyle = '#3f7fd6'; a.fillRect(C * 2 + 20, C * 0.2, 30, 40);
  a.fillStyle = '#f2c230'; a.fillRect(C * 2 + 70, C * 0.25, 34, 30);
  a.fillStyle = '#d8dad8'; a.fillRect(0, C, C, C);                    // floor tiles
  a.fillStyle = '#c8cac8';
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) a.fillRect(i * 16, C + j * 16, 16, 16);
  a.fillStyle = '#f8f8f4'; a.fillRect(C, C, C, C);                    // ceiling with light panels
  a.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) { a.fillStyle = '#fffbe6'; a.fillRect(C + 14 + i * 38, C + 20, 22, 88); }
  a.clearRect(C * 2, C, C, C);                                        // middle layer: a shelf row and people (transparent around)
  paintShelves(a, C * 2 + 8, C + C * 0.62, C - 16, C * 0.38, 2);
  paintPerson(a, C * 2 + 30, C * 2 - 2, C * 0.62, '#d8443c');
  paintPerson(a, C * 2 + 96, C * 2 - 2, C * 0.58, '#3fa65a', '#5a3a28');
  // painted picture of the whole interior (A)
  const [pc, p] = canvas(C * 2, C);
  p.fillStyle = '#f4f4f0'; p.fillRect(0, 0, C * 2, C);
  p.fillStyle = '#fffbe6'; for (let i = 0; i < 4; i++) p.fillRect(14 + i * 62, 6, 40, 6);   // ceiling lights
  paintFridge(p, 16, 18, C * 2 - 32, C * 0.42);                                               // fridge wall at the back
  p.fillStyle = '#d8dad8'; p.fillRect(0, C * 0.8, C * 2, C * 0.2);                            // floor
  paintShelves(p, 30, C * 0.5, C * 1.1, C * 0.36, 2);                                          // a shelf row
  p.fillStyle = '#c9c4b8'; p.fillRect(C * 1.45, C * 0.56, C * 0.5, C * 0.3);                  // counter
  paintPerson(p, C * 1.7, C * 0.62, C * 0.36, '#3f7fd6');                                      // clerk behind it
  paintPerson(p, C * 0.62, C * 0.94, C * 0.55, '#d8443c');                                     // a shopper
  // painted upper-floor windows: curtains in a few colours, lit or dark
  const [wc, w] = canvas(C * 2, C / 2);
  const CURTAINS = [['#e8d8a8', true], ['#a8c4d8', false], ['#e6b8b8', true], ['#c8d8b0', false]];
  CURTAINS.forEach(([col, lit], i) => {
    const x = i * (C / 2);
    w.fillStyle = lit ? '#fff2c8' : '#4a5664'; w.fillRect(x, 0, C / 2, C / 2);
    w.fillStyle = col; w.fillRect(x, 0, C / 2 * 0.32, C / 2); w.fillRect(x + C / 2 * 0.68, 0, C / 2 * 0.32, C / 2);
    w.fillStyle = 'rgba(0,0,0,0.25)'; w.fillRect(x, 0, C / 2, 3); w.fillRect(x + C / 4 - 1, 0, 2, C / 2);
  });
  // window posters for the konbini glass
  const [oc, o] = canvas(64, 32);
  o.fillStyle = '#f2c230'; o.fillRect(0, 0, 30, 32); o.fillStyle = '#d8443c'; o.font = 'bold 14px sans-serif'; o.fillText('SALE', 1, 20);
  o.fillStyle = '#3f7fd6'; o.fillRect(34, 0, 30, 32); o.fillStyle = '#fff'; o.font = 'bold 11px sans-serif'; o.fillText('おにぎり', 34, 20);
  shared = { shelf: tex(sc), fridge: tex(fc), atlas: tex(ac), picture: tex(pc), windows: tex(wc), posters: tex(oc) };
  return shared;
}

// --- A: painted picture -----------------------------------------------------------
function picture(style, w, h, z) {
  const t = konbiniTextures();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), style.material('signage', 0xffffff, t.picture));
  m.position.set(0, h / 2 + 0.1, z - 0.05);
  return m;
}

// --- B: shallow 3D room -------------------------------------------------------------
function room(style, w, h, z, depth) {
  const t = konbiniTextures();
  const g = new THREE.Group();
  const wall = style.material('light', 0xe2e4e0);
  const back = z - depth;
  g.add(box(w, h, 0.05, wall, [0, h / 2, back]));                                  // back wall
  for (const sx of [-1, 1]) g.add(box(0.05, h, depth, wall, [sx * w / 2, h / 2, z - depth / 2]));
  g.add(box(w, 0.05, depth, style.material('concrete', 0xd8dad8), [0, 0.03, z - depth / 2]));        // floor
  g.add(box(w, 0.05, depth, wall, [0, h, z - depth / 2]));                         // ceiling
  for (let i = 0; i < 3; i++) g.add(box(w * 0.7, 0.04, 0.25, style.material('light', 0xfffbe6), [0, h - 0.04, back + depth * (0.2 + i * 0.3)]));
  // drinks fridge along the back wall (glowing)
  const fridge = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 1.9), style.material('signage', 0xffffff, t.fridge));
  fridge.position.set(0, 1.05, back + 0.06);
  g.add(fridge);
  // a shelf unit across the middle, painted goods on both faces
  const shelfW = w * 0.55, sz = back + depth * 0.45;
  g.add(box(shelfW, 1.45, 0.5, style.material('metal', 0xe8e8e4), [-w * 0.15, 0.72, sz]));
  for (const s of [1, -1]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(shelfW * 0.98, 1.35), style.material('signage', 0xffffff, t.shelf));
    f.position.set(-w * 0.15, 0.72, sz + s * 0.26);
    if (s < 0) f.rotation.y = Math.PI;
    g.add(f);
  }
  // counter with a register by the door side
  g.add(box(w * 0.28, 1.0, 0.6, style.material('concrete', 0xc9c4b8), [w * 0.32, 0.5, back + depth * 0.4]));
  g.add(box(0.35, 0.3, 0.3, style.material('darkMetal'), [w * 0.3, 1.15, back + depth * 0.4]));
  // a low magazine rack under the window
  const mag = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, 0.6), style.material('signage', 0xffffff, t.shelf));
  mag.position.set(-w * 0.18, 0.45, z - 0.35);
  mag.rotation.y = Math.PI; // faces into the room; its back reads as the rack from outside
  g.add(mag, box(w * 0.5, 0.75, 0.3, style.material('metal', 0xd8d8d0), [-w * 0.18, 0.38, z - 0.25]));
  return g;
}

// --- simple stand-in people (about 150 triangles each) ------------------------------------
const FIG_TOPS = [0x3f7fd6, 0xd8443c, 0x3fa65a, 0xf2c230, 0x8a55c9];
export function simpleFigure(style, { top = 0x3f7fd6, hair = 0x2a2018, skin = 0xe0b48c, legs = 0x2c3652, height = 1.65 } = {}) {
  const g = new THREE.Group();
  const s = height / 1.65;
  const m = (role, c) => style.material(role, c);
  g.add(box(0.3 * s, 0.78 * s, 0.18 * s, m('clothAlt', legs), [0, 0.39 * s, 0]));
  g.add(box(0.4 * s, 0.6 * s, 0.24 * s, m('cloth', top), [0, 1.08 * s, 0]));
  for (const sx of [-1, 1]) g.add(box(0.09 * s, 0.55 * s, 0.1 * s, m('cloth', top), [sx * 0.25 * s, 1.08 * s, 0]));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 6, 4), m('skin', skin));
  head.position.y = 1.5 * s;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), m('hair', hair));
  cap.position.y = 1.52 * s;
  g.add(head, cap);
  return g;
}

// --- C: interior-mapping shader -------------------------------------------------------
// The window is one quad. Its uv is in metres inside the window (x from -w/2
// to w/2, y from 0 to h) and `roomSize` holds (w, h, depth); its normal points
// out to the street. Both survive merging meshes, so many windows can share
// one draw call. The shader casts the view ray into a box room behind the glass
// and paints the wall it hits from the atlas; a middle layer adds a shelf row
// and two people for depth.
let shaderMat = null;
function interiorMaterial() {
  if (shaderMat) return shaderMat;
  shaderMat = new THREE.ShaderMaterial({
    uniforms: { atlas: { value: konbiniTextures().atlas } },
    vertexShader: /* glsl */`
      attribute vec3 roomSize;
      varying vec3 vWorld; varying vec3 vNormal; varying vec2 vRoom; varying vec3 vSize;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vRoom = uv; vSize = roomSize;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D atlas;
      varying vec3 vWorld; varying vec3 vNormal; varying vec2 vRoom; varying vec3 vSize;
      vec4 cell(float cx, float cy, vec2 uv) { return texture2D(atlas, vec2((cx + clamp(uv.x, 0.0, 1.0)) / 3.0, (cy + clamp(uv.y, 0.0, 1.0)) / 2.0)); }
      void main() {
        vec3 n = normalize(vNormal);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), n));
        vec3 d = normalize(vWorld - cameraPosition);
        vec3 r = vec3(dot(d, right), d.y, -dot(d, n)); // into the room: +z
        float W = vSize.x, H = vSize.y, D = vSize.z;
        vec3 p = vec3(vRoom.x, vRoom.y, 0.0);
        float tx = ((r.x > 0.0 ? W * 0.5 : -W * 0.5) - p.x) / r.x;
        float ty = ((r.y > 0.0 ? H : 0.0) - p.y) / r.y;
        float tz = D / max(r.z, 1e-4);
        float t = min(tx, min(ty, tz));
        vec3 h = p + r * t;
        vec4 col;
        if (t == tz) col = cell(0.0, 1.0, vec2((h.x + W * 0.5) / W, 1.0 - h.y / H));                 // back
        else if (t == tx) col = r.x < 0.0 ? cell(1.0, 1.0, vec2(h.z / D, 1.0 - h.y / H)) : cell(2.0, 1.0, vec2(1.0 - h.z / D, 1.0 - h.y / H)); // sides
        else col = r.y < 0.0 ? cell(0.0, 0.0, vec2((h.x + W * 0.5) / W, h.z / D)) : cell(1.0, 0.0, vec2((h.x + W * 0.5) / W, h.z / D)); // floor, ceiling
        // middle layer half way in: a shelf row and people
        float tm = (D * 0.45) / max(r.z, 1e-4);
        if (tm < t) {
          vec3 m = p + r * tm;
          vec4 mid = cell(2.0, 0.0, vec2((m.x + W * 0.5) / W, 1.0 - m.y / H));
          if (abs(m.x) < W * 0.5 && m.y > 0.0 && m.y < H && mid.a > 0.5) col = mid;
        }
        gl_FragColor = vec4(col.rgb, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  shaderMat.userData.keepAttributes = ['uv', 'roomSize']; // survive mesh merging
  return shaderMat;
}
function shaderWindow(w, h, z, depth) {
  const geo = new THREE.PlaneGeometry(w, h);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i) + h / 2); // metres in the window
  geo.setAttribute('roomSize', new THREE.Float32BufferAttribute(new Array(pos.count).fill(0).flatMap(() => [w, h, depth]), 3));
  const m = new THREE.Mesh(geo, interiorMaterial());
  m.position.set(0, h / 2 + 0.1, z - 0.02);
  return m;
}

/**
 * The inside of a shop front: kind 'picture' | 'room' | 'shader' | 'hybrid'.
 * w × h is the window opening at depth z (the glass line); depth is how far
 * the room goes back.
 */
export function shopInterior(kind, style, w, h, z, depth = 3) {
  const g = new THREE.Group();
  if (kind === 'picture') g.add(picture(style, w, h, z));
  if (kind === 'shader') g.add(shaderWindow(w, h, z, depth));
  if (kind === 'room' || kind === 'hybrid') g.add(room(style, w, h + 0.4, z, depth));
  if (kind === 'hybrid') {
    // a clerk behind the counter and two shoppers
    const clerk = simpleFigure(style, { top: 0x3f7fd6 });
    clerk.position.set(w * 0.32, 0, z - depth + depth * 0.4 - 0.55);
    const a = simpleFigure(style, { top: FIG_TOPS[1], hair: 0x5a3a28, height: 1.58 });
    a.position.set(-w * 0.3, 0, z - depth * 0.3);
    a.rotation.y = Math.PI * 0.8;
    const b = simpleFigure(style, { top: FIG_TOPS[2] });
    b.position.set(0.1, 0, z - depth * 0.75);
    b.rotation.y = Math.PI;
    g.add(clerk, a, b);
    // posters stuck on the glass
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), style.material('light', 0xffffff, konbiniTextures().posters));
    poster.position.set(-w * 0.32, h * 0.72, z + 0.01);
    g.add(poster);
  }
  return g;
}

/** Painted upper-floor windows (curtains, some lit): a row like windowRow, from one shared texture. */
export function paintedWindows(g, style, w, y, z, { spacing = 2.4, ww = 1.4, wh = 1.4, seed = 1 } = {}) {
  const t = konbiniTextures().windows;
  const n = Math.max(1, Math.floor((w - 1) / spacing));
  for (let i = 0; i < n; i++) {
    const v = (seed * 7 + i * 3) % 4; // which of the 4 painted variants
    const geo = new THREE.PlaneGeometry(ww, wh);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (v + uv.getX(k)) / 4);
    const m = new THREE.Mesh(geo, style.material('light', 0xffffff, t));
    m.position.set(-((n - 1) * spacing) / 2 + i * spacing, y, z + 0.02);
    g.add(m);
    g.add(box(ww + 0.12, 0.1, 0.12, style.material('concrete', 0xb8b4aa), [m.position.x, y - wh / 2 - 0.05, z + 0.05])); // sill
  }
}
