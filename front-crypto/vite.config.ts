import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'path'
import { fileURLToPath } from 'url'
import process from 'node:process'

// Recréer __dirname pour ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET
    || env.VITE_API_URL
    || `http://localhost:${env.BACKEND_HOST_PORT || '8082'}`
  const tileTarget = env.VITE_TILE_PROXY_TARGET
    || `http://localhost:${env.CARTE_HOST_PORT || '3000'}`
  const devPort = Number(env.WEB_HOST_PORT || 5173)

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: devPort,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true
        },
        '/data': {
          target: tileTarget,
          changeOrigin: true
        },
        '/styles': {
          target: tileTarget,
          changeOrigin: true
        },
        '/tiles': {
          target: tileTarget,
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      minify: 'terser',
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'react-vendor'
              }
              if (id.includes('leaflet')) {
                return 'leaflet-vendor'
              }
              if (id.includes('firebase')) {
                return 'firebase-vendor'
              }
              return 'vendor'
            }
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
        }
      },
      chunkSizeWarningLimit: 1000,
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production'
        }
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'leaflet', 'react-leaflet', 'firebase']
    },
    css: {
      devSourcemap: true
    }
  }
})
