// Vercel Serverless Function: AssemblyAI transcription from a public video URL
// Path: /api/transcribe-video

// Signed-in users only (video exercise), and only for videos in the app's exercise-videos bucket; see _lib/guard.js.

import { guard, jsonResponse, supabaseUrl } from './_lib/guard.js'

export const config = {
  runtime: 'edge'
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY
  if (!ASSEMBLYAI_KEY) {
    return jsonResponse(500, { error: 'AssemblyAI API key not configured' })
  }

  const gate = await guard(req, { name: 'transcribe-video', userPerHour: 30, login: true })
  if (gate.error) return gate.error

  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return jsonResponse(400, { error: 'Missing or invalid "url" field' })
    }
    // Only the app's own uploads (VideoUploadExercise sends the public URL of the file it just uploaded).
    const allowedPrefix = `${supabaseUrl}/storage/v1/object/public/exercise-videos/`
    if (!supabaseUrl || !url.startsWith(allowedPrefix) || url.includes('..')) {
      return jsonResponse(400, { error: 'Only videos uploaded to the app can be transcribed' })
    }

    // Create transcript directly from public URL (AssemblyAI accepts video formats)
    const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: url,
        language_code: 'en_us'
      })
    })

    if (!transcriptRes.ok) {
      const detail = await transcriptRes.text()
      return jsonResponse(500, { error: 'Failed to create transcript', detail })
    }

    const { id } = await transcriptRes.json()

    // Poll for result — longer timeout for video files (30 iterations × 2s = 60s)
    for (let i = 0; i < 30; i++) {
      await sleep(2000)

      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { 'Authorization': ASSEMBLYAI_KEY }
      })

      const result = await pollRes.json()

      if (result.status === 'completed') {
        return jsonResponse(200, {
          success: true,
          text: result.text || '',
          confidence: result.confidence || 0,
          words: (result.words || []).map(w => ({
            text: w.text,
            confidence: w.confidence,
            start: w.start,
            end: w.end
          }))
        })
      }

      if (result.status === 'error') {
        return jsonResponse(500, { error: result.error || 'Transcription failed' })
      }
    }

    return jsonResponse(504, { error: 'Transcription timed out. Try a shorter video.' })
  } catch (err) {
    return jsonResponse(500, { error: 'Internal error', detail: String(err?.message || err) })
  }
}
