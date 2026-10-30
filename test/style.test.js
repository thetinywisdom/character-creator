import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OrthographicCamera } from 'three';
import { createBody, defaultDocument } from '../src/body/index.js';
import { COLORS, PALETTE } from '../src/character/palette.js';
import { CITY_AZIMUTH, CITY_ELEVATION, CITY_FIGURE_FRACTION, cityAngles, frameCityCamera } from '../src/preview/view.js';

describe('illustration style', () => {
  it('uses the sheet palette for the naked default', () => {
    const doc = defaultDocument();
    for (const hex of Object.values(COLORS)) {
      assert.ok(PALETTE.map((swatch) => swatch.toLowerCase()).includes(hex), hex);
    }
    assert.equal(doc.body.skin, COLORS.skin);
    assert.equal(doc.head.hair.color, COLORS.hair);
    assert.equal(doc.clothing.bottom.color, COLORS.bottom);
    assert.equal(doc.clothing.top.color, COLORS.top);
    const spec = createBody().getResolved();
    assert.equal(spec.skinColor, COLORS.skin);
    assert.ok(spec.radii.wrist < spec.radii.elbow && spec.radii.elbow < spec.radii.shoulder);
    assert.ok(spec.radii.ankle < spec.radii.knee && spec.radii.knee < spec.radii.hip);
    assert.ok(spec.chestTopDepth > spec.chestTopWidth * 0.7);
    assert.ok(spec.handMidRx > spec.radii.wrist);
  });

  it('frames the city camera as a small isometric view', () => {
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.05, 80);
    const height = 1.8;
    const lookY = frameCityCamera(camera, height, 16 / 9);
    const angles = cityAngles(camera, lookY);
    assert.ok(Math.abs(angles.elevation - CITY_ELEVATION) < 1e-6);
    assert.ok(Math.abs(angles.azimuth - CITY_AZIMUTH) < 1e-6);
    const viewH = camera.top - camera.bottom;
    assert.ok(Math.abs(height / viewH - CITY_FIGURE_FRACTION) < 1e-6);
  });
});
