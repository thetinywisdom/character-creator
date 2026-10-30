import { REFERENCE_HEIGHT } from '../body/params.js';

/** Metres at height 1.8, before the body-type multipliers. Thickness is unitless. */
const PRESENTATION = {
  man: { shoulder: 0.3, belly: 0.2, hip: 0.16, thickness: 1 },
  woman: { shoulder: 0.3 * (0.36 / 0.42), belly: 0.22, hip: 0.2, thickness: 0.92 },
};

const BODY_TYPE = {
  slim: { shoulder: 0.96, belly: 0.85, hip: 0.95, thickness: 0.8 },
  average: { shoulder: 1, belly: 1, hip: 1, thickness: 1 },
  broad: { shoulder: 1.12, belly: 1.05, hip: 1.05, thickness: 1.05 },
  heavy: { shoulder: 1.05, belly: 1.45, hip: 1.15, thickness: 1.25 },
};

/**
 * Preset sliders for one presentation and body type.
 * Shoulder, belly, and hip scale with height. Limb thickness does not.
 */
export function presetMeasures(presentation, type, height) {
  const row = PRESENTATION[presentation] || PRESENTATION.man;
  const scale = BODY_TYPE[type] || BODY_TYPE.average;
  const k = (Number(height) || REFERENCE_HEIGHT) / REFERENCE_HEIGHT;
  return {
    shoulder: row.shoulder * scale.shoulder * k,
    belly: row.belly * scale.belly * k,
    hip: row.hip * scale.hip * k,
    limbThickness: row.thickness * scale.thickness,
  };
}

/** Writes the preset into the document. Later slider edits keep these numbers. */
export function applyPreset(doc, presentation, type) {
  const next = structuredClone(doc);
  const measures = presetMeasures(presentation, type, next.body.height);
  next.body.presentation = presentation;
  next.body.type = type;
  next.body.shoulder = measures.shoulder;
  next.body.belly = measures.belly;
  next.body.hip = measures.hip;
  next.body.limbThickness = measures.limbThickness;
  return next;
}
