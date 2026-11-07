import { inkCelStyle } from './inkCel.js';
import { ps1Classic, ps1Bright, ps1Clear } from './ps1.js';
import { grayStyle } from './gray.js';

// All styles. A style provides: id, label, background, material(role),
// createLights(ctx), and optionally: detail (segment multiplier),
// decorate(root), fog, pixelScale + prepareRender(w, h) (low-res rendering),
// outline / dither (low-res post effects), options + setOption().
//
// PS1 was chosen as the direction. Ink & Cel is kept (not in the gallery) so
// switching back stays a small change; pick it in the street scene's style list.
export const styles = [ps1Clear, ps1Bright, ps1Classic, grayStyle, inkCelStyle];

// Rows in the gallery, top to bottom.
export const galleryStyles = [ps1Clear, ps1Bright, ps1Classic, grayStyle];

// Lighting presets, applied on top of every style's own lights.
export const lightingPresets = {
  Day:    { keyColor: 0xffffff, key: 1,    dir: [0.5, 1, 0.6],   hemi: 1,    tint: null,     tintAmount: 0 },
  Sunset: { keyColor: 0xffaa66, key: 1.1,  dir: [1, 0.32, 0.25], hemi: 0.6,  tint: 0xf0a070, tintAmount: 0.35 },
  Night:  { keyColor: 0x9db3ff, key: 0.45, dir: [-0.4, 1, 0.35], hemi: 0.45, tint: 0x10173a, tintAmount: 0.75 },
};
