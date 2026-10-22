import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { playerBundle } from './scripts/player-plugin.mjs';

// The web editor (also deployed to GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react(), playerBundle()],
  build: { outDir: 'dist/web', emptyOutDir: true },
});
