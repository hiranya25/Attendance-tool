import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// npm run build        -> dist/ for the real server (talks to /api)
// npm run build:demo   -> dist-single/ one self-contained HTML file on sample data, for sharing
// npm run dev          -> local development; /api is passed to the server on port 3000
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
  server: { proxy: { '/api': 'http://localhost:3000' } },
}));
