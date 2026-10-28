import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the site at /character-creator/. Local dev stays at /.
  base: process.env.VITE_BASE || '/',
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
});
