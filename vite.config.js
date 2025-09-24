import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api/audio': {
        target: 'https://xpclass.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/audio/, '')
      },
      // Local dev proxy to Vercel function (optional if running vercel dev)
      '/api/ai-score': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
