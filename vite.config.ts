import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: 'client',
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'client/src'), 'node:crypto': path.resolve(__dirname, 'client/src/demo/crypto-shim.ts') } },
  build: {
    outDir: path.resolve(__dirname, 'dist'), emptyOutDir: true, chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/recharts|d3-|victory|decimal\.js/.test(id)) return 'charts';
          if (/react-dom|react-router|scheduler|[\\/]react[\\/]/.test(id)) return 'react';
          return 'vendor';
        },
      },
    },
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
