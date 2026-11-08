import * as THREE from 'three';

// Small canvas textures for sign faces and shop signs. Low resolution with
// hard (nearest) filtering so text looks like a 90s console texture.

const cache = new Map();

/**
 * A sign face. shape: 'rect' | 'circle' | 'triangleDown'.
 * lines: text lines (Japanese is fine). Colours are CSS strings.
 */
export function signTexture({ lines = [], bg = '#ffffff', fg = '#000000', border = null, borderWidth = 0.08,
  shape = 'rect', w = 64, h = 64, font = 'bold', vertical = false }) {
  const key = JSON.stringify(arguments[0]);
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const path = () => {
    g.beginPath();
    if (shape === 'circle') g.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    else if (shape === 'triangleDown') { g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w / 2, h); g.closePath(); }
    else g.rect(0, 0, w, h);
  };
  if (border) {
    path(); g.fillStyle = border; g.fill();
    g.save();
    g.translate(w / 2, h * (shape === 'triangleDown' ? 0.36 : 0.5));
    const k = 1 - borderWidth * (shape === 'triangleDown' ? 3 : 2);
    g.scale(k, k);
    g.translate(-w / 2, -h * (shape === 'triangleDown' ? 0.36 : 0.5));
    path(); g.fillStyle = bg; g.fill();
    g.restore();
  } else {
    path(); g.fillStyle = bg; g.fill();
  }
  if (lines.length) {
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const n = lines.length;
    const size = Math.floor((vertical ? w : h) * (shape === 'triangleDown' ? 0.22 : 0.62) / Math.max(n, 1));
    g.font = `${font} ${size}px "Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif`;
    if (vertical) {
      // vertical Japanese signs: one character per row
      const chars = [...lines.join('')];
      const step = h / (chars.length + 1);
      chars.forEach((ch, i) => g.fillText(ch, w / 2, step * (i + 1)));
    } else {
      const top = shape === 'triangleDown' ? h * 0.3 : h / 2 - ((n - 1) * size * 1.1) / 2;
      lines.forEach((t, i) => g.fillText(t, w / 2, top + i * size * 1.1, w * 0.9));
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  cache.set(key, tex);
  return tex;
}
