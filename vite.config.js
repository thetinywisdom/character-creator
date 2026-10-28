import { defineConfig } from 'vite';

export default defineConfig({
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
  },
});
