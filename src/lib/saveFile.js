// Save a generated file for the viewer. Inside the claude.ai Artifact viewer
// pages may not download directly, so this goes through the viewer's
// `downloads` capability (the viewer confirms the save); anywhere else (a
// normal web page, a dev server) it falls back to a plain browser download.

// Ask for the capability once, at load, so a click never has to wait for it.
// Outside the Artifact viewer there is no window.claude and this is null.
const downloadsReady = window.claude?.use
  ? window.claude.use('downloads').catch(() => null)
  : Promise.resolve(null);

/**
 * Offer `data` (string, Blob or ArrayBuffer) as a file. Resolves true when
 * it was handed over for saving, false when the viewer declined or saving is
 * unavailable here.
 */
export async function saveFile(filename, data) {
  const downloads = await downloadsReady;
  if (downloads) {
    try {
      await downloads.save({ filename, data });
      return true;
    } catch (e) {
      if (e?.code !== 'unavailable' && e?.code !== 'not_granted') return false; // declined, rate limited, ...
    }
  }
  if (window.claude?.use) return false; // inside the viewer: a plain download would be blocked
  const blob = data instanceof Blob ? data : new Blob([data]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}

/** Ask the viewer for a file (e.g. '.json'); resolves its text, or null if cancelled. */
export function openTextFile(accept = '') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
