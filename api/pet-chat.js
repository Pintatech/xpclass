// Vercel Serverless Function: Groq proxy for pet chat/tutor and AI scoring fallback
// Path: /api/pet-chat
// Guests (guest page, demo pages) may call it too, with a limit per hour; see _lib/guard.js.

import { guard, readJson, clamp, jsonResponse } from './_lib/guard.js'

export const config = {
  runtime: 'edge'
}

// The only model the app uses. The caller cannot pick another one.
const MODEL = 'openai/gpt-oss-120b'

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return jsonResponse(500, { error: 'GROQ_API_KEY not configured' })
  }

  const gate = await guard(req, { name: 'pet-chat', userPerHour: 300, guestPerHour: 100, guestsPerHour: 1000 })
  if (gate.error) return gate.error

  try {
    const { body, error } = await readJson(req, 40000)
    if (error) return error
    const { messages, max_tokens, temperature } = body || {}
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
      return jsonResponse(400, { error: 'messages must be a list of 1 to 40 messages' })
    }

    const apiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: Math.round(clamp(max_tokens, 1, 1500, 500)),
        temperature: clamp(temperature, 0, 1.5, 0.7)
      })
    })

    if (!apiRes.ok) {
      const errText = await apiRes.text()
      return jsonResponse(apiRes.status, { error: `Groq error: ${apiRes.status}`, detail: errText })
    }

    const data = await apiRes.json()
    return jsonResponse(200, data)
  } catch (err) {
    return jsonResponse(500, { error: err.message })
  }
}
