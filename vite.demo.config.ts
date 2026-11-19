// Builds the online demo: one self-contained HTML file, no server needed.
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

const stripServerTags: Plugin = {
  name: 'strip-server-tags',
  transformIndexHtml: (html) => html
    .replace(/<link rel="manifest"[^>]*>\s*/, '')
    .replace(/<link rel="(icon|alternate icon|apple-touch-icon)"[^>]*>\s*/g, '')
    .replace(/<script src="\/theme-init.js"><\/script>\s*/, '')
    .replace('<title>OSSATURE</title>', '<title>OSSATURE — démo</title>'),
};

export default defineConfig({
  root: 'client',
  publicDir: false,
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1') },
  plugins: [react(), tailwindcss(), stripServerTags, viteSingleFile()],
  resolve: { alias: { '@': path.resolve(__dirname, 'client/src'), 'node:crypto': path.resolve(__dirname, 'client/src/demo/crypto-shim.ts') } },
  build: { outDir: path.resolve(__dirname, 'dist-demo'), emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false },
});
