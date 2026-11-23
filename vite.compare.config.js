import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The old / new human comparison page (compare.html), built on its own into
// dist-compare/ so the game's build stays as it is:
//   npx vite build --config vite.compare.config.js
//   python3 scripts/single-file.py OUT.html dist-compare
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-compare',
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, 'compare.html') },
  },
});
