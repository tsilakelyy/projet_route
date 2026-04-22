/// <reference types="vitest" />

import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }
          if (id.includes('firebase')) {
            return 'firebase';
          }
          if (id.includes('leaflet') || id.includes('@mapbox/vector-tile') || id.includes('pbf')) {
            return 'leaflet';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
})
