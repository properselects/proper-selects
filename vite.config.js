import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Use index-dev.html as the entry so production index.html stays untouched
      input: resolve(__dirname, 'index-dev.html'),
      output: {
        entryFileNames: 'assets/index-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: { port: 5173, open: '/index-dev.html' },
});
