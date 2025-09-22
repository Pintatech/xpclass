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
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
