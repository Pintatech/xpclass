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
      '/proxy-image': {
        target: 'https://xpclass.vn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-image/, '')
      },
      // Gợi ý: dùng `vercel dev` để phục vụ /api. Nếu không, xoá proxy này để tránh vòng lặp.
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
