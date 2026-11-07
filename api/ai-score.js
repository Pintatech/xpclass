// Vercel Serverless Function: AI Scoring Endpoint
// Path: /api/ai-score
// Guests (guest page) may call it too. Only the OpenAI call is counted against the hourly limit (see _lib/guard.js);
// past the limit the answer is scored by the free similarity check below instead.

import { guard, readJson } from './_lib/guard.js'

export const config = {
  runtime: 'edge'
}

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const levenshtein = (a, b) => {
  const an = a ? a.length : 0
  const bn = b ? b.length : 0
  if (an === 0) return bn
  if (bn === 0) return an
  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i])
  for (let j = 0; j <= an; j++) matrix[0][j] = j
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[bn][an]
}

const similarityPct = (s1, s2) => {
  const longer = s1.length >= s2.length ? s1 : s2
  const shorter = s1.length >= s2.length ? s2 : s1
  if (longer.length === 0) return 100
  const dist = levenshtein(longer, shorter)
  return Math.max(0, ((longer.length - dist) / longer.length) * 100)
}

const clampScore = (n) => Math.min(100, Math.max(0, Number(n) || 0))

const tokenize = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, ' ').split(/\s+/).filter(Boolean)

// Exact word, or substring (plural/tense) when both words have 3+ letters,
// so short words like "a" / "i" don't match inside every other word.
const wordMatches = (w, x) =>
  w === x || (Math.min(w.length, x.length) >= 3 && (w.includes(x) || x.includes(w)))

// Share of the expected answer's words that appear in the student's answer.
// Counts expected words (each at most once), so it can never exceed 100.
const keywordScore = (userAns, expected) => {
  const u = tokenize(userAns)
  const e = tokenize(expected)
  if (e.length === 0) return 0
  const matched = e.filter(x => u.some(w => wordMatches(w, x)))
  return (matched.length / e.length) * 100
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const { body, error } = await readJson(req, 20000)
    if (error) return error
    const { question, userAnswer, expectedAnswers = [], context, minScore = 70, prompt, language = 'en' } = body || {}

    if (typeof userAnswer !== 'string' || userAnswer.trim().length === 0) {
      return jsonResponse(400, { error: 'Missing userAnswer' })
    }

    const cleanedAnswer = userAnswer.trim()
    const cleanedExpected = (Array.isArray(expectedAnswers) ? expectedAnswers : []).map(s => String(s).trim()).filter(Boolean)

    // Exact match fast path
    if (cleanedExpected.some(e => e.toLowerCase() === cleanedAnswer.toLowerCase())) {
      return jsonResponse(200, {
        score: 100,
        confidence: 95,
        explanation: 'Exact match with an expected answer.'
      })
    }

    // No expected answers = open-ended question: judge against the question itself
    const isOpenEnded = cleanedExpected.length === 0

    // Prefer OpenAI if configured
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.REACT_APP_OPENAI_API_KEY
    const gate = OPENAI_API_KEY
      ? await guard(req, { name: 'ai-score', userPerHour: 400, guestPerHour: 100, guestsPerHour: 1000 })
      : null
    if (OPENAI_API_KEY && !gate.error) {
      const system = 'You score short student answers fairly and explain briefly.'
      const aiPrompt = isOpenEnded
        ? `Question: "${question || ''}"
Student Answer: "${cleanedAnswer}"
Context: ${context || 'educational assessment'}

This is an open-ended question with NO fixed expected answer. Do not penalize the student for the lack of one.

Rules:
- Return JSON only: {"score":0-100,"confidence":0-100,"explanation":"..."}
- Score how well the answer does what the question/instructions ask (topic, number of sentences, etc.).
- An answer that is on-topic and meets the instructions should score 80-100. Minor typos/grammar errors should not penalize much.
- An answer that is off-topic or ignores the instructions should score 0-30; say what the question asked for.
- Write explanation in ${language === 'vi' ? 'Vietnamese' : 'English'}.`
        : `Question: "${question || ''}"
Student Answer: "${cleanedAnswer}"
Expected Answers: ${JSON.stringify(cleanedExpected)}
Context: ${context || 'educational assessment'}

Rules:
- Return JSON only: {"score":0-100,"confidence":0-100,"explanation":"..."}
- Reward partial correctness and synonyms. Minor typos should not penalize much.
- Write explanation in ${language === 'vi' ? 'Vietnamese' : 'English'}.`

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          temperature: 0.2,
          max_tokens: 250,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt ? `${prompt}\n\n${aiPrompt}` : aiPrompt }
          ]
        })
      })

      if (res.ok) {
        const data = await res.json()
        const content = data?.choices?.[0]?.message?.content || ''
        try {
          const parsed = JSON.parse(content)
          // Basic sanitize
          const score = clampScore(parsed.score)
          const confidence = clampScore(parsed.confidence)
          const explanation = String(parsed.explanation || '').slice(0, 500)
          return jsonResponse(200, { score, confidence, explanation })
        } catch {
          // fallthrough to heuristic
        }
      }
    }

    // Open-ended needs a real AI judge. Return an error so the client falls back
    // to its Groq scorer (which has an open-ended prompt) instead of guessing here.
    if (isOpenEnded) {
      return jsonResponse(503, { error: 'No AI scorer available for open-ended question' })
    }

    // Heuristic fallback: similarity + keywords
    let best = 0
    for (const exp of cleanedExpected) {
      const sim = similarityPct(cleanedAnswer.toLowerCase(), exp.toLowerCase())
      const key = keywordScore(cleanedAnswer.toLowerCase(), exp.toLowerCase())
      best = Math.max(best, Math.max(sim, key))
    }

    const score = Math.round(clampScore(best))
    const confidence = Math.min(95, Math.round(score + 5))
    const explanation = score >= minScore
      ? 'Your answer is sufficiently similar to expected answers.'
      : 'Your answer does not sufficiently match expected answers.'

    return jsonResponse(200, { score, confidence, explanation })
  } catch (err) {
    return jsonResponse(500, { error: 'Internal error', detail: String(err?.message || err) })
  }
}


