import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Local dev middleware to handle /api/transcribe (mirrors api/transcribe.js)
function assemblyAIPlugin() {
  return {
    name: 'assemblyai-transcribe',
    configureServer(server) {
      server.middlewares.use('/api/transcribe', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const apiKey = process.env.ASSEMBLYAI_API_KEY
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'ASSEMBLYAI_API_KEY not set in .env' }))
          return
        }

        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const audioData = Buffer.concat(chunks)

          // Upload
          const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: { 'Authorization': apiKey, 'Content-Type': 'application/octet-stream' },
            body: audioData
          })
          if (!uploadRes.ok) throw new Error('Upload failed')
          const { upload_url } = await uploadRes.json()

          // Create transcript
          const txRes = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio_url: upload_url, language_code: 'en_us' })
          })
          if (!txRes.ok) throw new Error('Transcript creation failed')
          const { id } = await txRes.json()

          // Poll
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 1000))
            const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
              headers: { 'Authorization': apiKey }
            })
            const result = await pollRes.json()
            if (result.status === 'completed') {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({
                success: true,
                text: result.text || '',
                confidence: result.confidence || 0,
                words: (result.words || []).map(w => ({ text: w.text, confidence: w.confidence }))
              }))
              return
            }
            if (result.status === 'error') throw new Error(result.error || 'Transcription failed')
          }
          throw new Error('Transcription timed out')
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env so ASSEMBLYAI_API_KEY is available in process.env
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
  plugins: [react(), assemblyAIPlugin()],
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
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
  }
})
