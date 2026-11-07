// Subject parameters: defaults from each subject's schema, merged with
// whatever the viewer last saved in this browser.

const KEY = 'character-creator.params.v1';

export function defaultsFor(subject) {
  return Object.fromEntries(Object.entries(subject.schema).map(([k, d]) => [k, d.value]));
}

export function loadParams(subjects) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    saved = {};
  }
  const out = {};
  for (const s of subjects) {
    const values = defaultsFor(s);
    const stored = saved[s.id] || {};
    for (const k of Object.keys(values)) {
      const def = s.schema[k];
      if (typeof stored[k] !== typeof values[k]) continue;
      if (def.options && !def.options.includes(stored[k])) continue;
      values[k] = stored[k];
    }
    out[s.id] = values;
  }
  return out;
}

export function saveParams(params) {
  try {
    localStorage.setItem(KEY, JSON.stringify(params));
  } catch {
    /* storage unavailable (private mode etc.) – settings just won't persist */
  }
}
