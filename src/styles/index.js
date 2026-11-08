import { ps1Clear } from './ps1.js';

// All styles. A style provides: id, label, background, material(role),
// createLights(ctx), and optionally: detail (segment multiplier),
// decorate(root), fog, pixelScale + prepareRender(w, h) (low-res rendering),
// outline / dither (low-res post effects), options + setOption().
//
// The look: PS1 · Bright + clear (see STYLE_GUIDE.md). Everything is built
// through this interface, so a different look later is one new style file.
export const style = ps1Clear;
export const styles = [ps1Clear];

// Lighting presets, applied on top of every style's own lights.
export const lightingPresets = {
  Day:    { keyColor: 0xffffff, key: 1,    dir: [0.5, 1, 0.6],   hemi: 1,    tint: null,     tintAmount: 0 },
  Sunset: { keyColor: 0xffaa66, key: 1.1,  dir: [1, 0.32, 0.25], hemi: 0.6,  tint: 0xf0a070, tintAmount: 0.35 },
  Night:  { keyColor: 0x9db3ff, key: 0.45, dir: [-0.4, 1, 0.35], hemi: 0.45, tint: 0x10173a, tintAmount: 0.75 },
};
