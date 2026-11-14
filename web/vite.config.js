import { defineConfig } from 'vite';

// Vite sirve data/public/ como carpeta estatica (ADR-004).
// VITE_BASE permite publicar bajo un subpath (GitHub Pages).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  publicDir: '../data/public',
  build: { outDir: 'dist', emptyOutDir: true },
});
