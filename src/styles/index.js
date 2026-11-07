import { inkCelStyle } from './inkCel.js';
import { ps1Style } from './ps1.js';
import { grayStyle } from './gray.js';

// Row order in the gallery. Gray-box stays last as the neutral reference.
// A style provides: id, label, background, material(role), createLights(ctx),
// and optionally: detail (segment multiplier), decorate(root), fog,
// pixelScale + prepareRender(w, h) (low-res rendering), options + setOption().
export const styles = [inkCelStyle, ps1Style, grayStyle];

// Lighting presets, applied on top of every style's own lights.
export const lightingPresets = {
  Day:    { keyColor: 0xffffff, key: 1,    dir: [0.5, 1, 0.6],   hemi: 1,    tint: null,     tintAmount: 0 },
  Sunset: { keyColor: 0xffaa66, key: 1.1,  dir: [1, 0.32, 0.25], hemi: 0.6,  tint: 0xf0a070, tintAmount: 0.35 },
  Night:  { keyColor: 0x9db3ff, key: 0.45, dir: [-0.4, 1, 0.35], hemi: 0.45, tint: 0x10173a, tintAmount: 0.75 },
};
