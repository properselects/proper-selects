import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'rename-index',
      closeBundle() {
        // Rename dist/index-dev.html → dist/index.html so Vercel serves it as the entry
        try {
          copyFileSync(resolve(__dirname, 'dist/index-dev.html'), resolve(__dirname, 'dist/index.html'));
        } catch {}
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index-dev.html'),
      output: {
        entryFileNames: 'assets/index-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: { port: 5173, open: '/index-dev.html' },
});
