import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  // Keeps `three` a single instance; two copies break R3F's reconciler.
  resolve: {
    dedupe: ['three', '@react-three/fiber', 'react', 'react-dom'],
  },
});
