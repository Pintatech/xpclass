/**
 * Speech-to-text scoring for spoken answers, on AssemblyAI.
 *
 * This is transcription, not phoneme assessment. AssemblyAI hands back what it
 * HEARD plus a confidence; it does not grade an accent. So a spoken answer is
 * marked the way a patient listener would mark it — "were those the words?" —
 * and not on how native the vowels were. For a room of Vietnamese children
 * reading English aloud that is the kinder measure and the one that survives a
 * cheap microphone; it is also the only one this API can honestly support, so
 * nothing here should be presented to a student as a pronunciation percentage.
 *
 * The event battle is the caller (see prompts/PronunciationPrompt.jsx). The pet
 * game PetSayItRight.jsx does the same job inline against single words and
 * predates this file — it is deliberately left alone rather than migrated,
 * since a working game is not worth destabilising for tidiness.
 */

const ASSEMBLYAI_KEY = import.meta.env.VITE_ASSEMBLYAI_API_KEY || ''

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Whether a spoken answer can be graded at all in this build.
 *
 * A question nobody can answer is worse than no question: in a battle it would
 * cost a life to a student who did nothing wrong. The prompt checks this before
 * it offers to record and skips the question harmlessly when it is false.
 *
 * The proxy needs no client key, so this is only false where there is neither —
 * which in practice means a local dev server with no .env.
 */
export const speechAvailable = () =>
  Boolean(ASSEMBLYAI_KEY) || typeof window !== 'undefined'

/**
 * Recorded audio → what was heard.
 *
 * The key lives on the server: /api/transcribe is a Vercel edge function that
 * holds ASSEMBLYAI_API_KEY and proxies the upload-create-poll dance. The direct
 * path is the local-dev escape hatch, taken only when VITE_ASSEMBLYAI_API_KEY is
 * set — the same precedence the pet game uses, so the two behave alike.
 */
export const transcribeSpeech = async (audioBlob) => {
  if (!ASSEMBLYAI_KEY) {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
      body: audioBlob
    })
    if (!res.ok) throw new Error('Transcription failed')
    const data = await res.json()
    return { text: data.text || '', confidence: data.confidence || 0, words: data.words || [] }
  }

  const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { Authorization: ASSEMBLYAI_KEY, 'Content-Type': 'application/octet-stream' },
    body: audioBlob
  })
  if (!uploadRes.ok) throw new Error('Upload failed')
  const { upload_url } = await uploadRes.json()

  const createRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { Authorization: ASSEMBLYAI_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url, language_code: 'en_us' })
  })
  if (!createRes.ok) throw new Error('Transcript creation failed')
  const { id } = await createRes.json()

  // Twenty seconds of patience. A phrase a child can say in one breath comes
  // back in two or three; anything past this is a failure dressed as a wait,
  // and the battle has a student sitting in front of it.
  for (let i = 0; i < 20; i++) {
    await sleep(1000)
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { Authorization: ASSEMBLYAI_KEY }
    })
    const result = await pollRes.json()
    if (result.status === 'completed') {
      return {
        text: result.text || '',
        confidence: result.confidence || 0,
        words: (result.words || []).map((w) => ({ text: w.text, confidence: w.confidence }))
      }
    }
    if (result.status === 'error') throw new Error(result.error || 'Transcription failed')
  }
  throw new Error('Transcription timed out')
}

/** Lowercased, stripped of punctuation, collapsed to single spaces. */
const normalise = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const wordsOf = (s) => (normalise(s) ? normalise(s).split(' ') : [])

/** Edit distance, for the near-misses a transcript makes on a child's voice. */
const levenshtein = (a, b) => {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = row
  }
  return prev[b.length]
}

/**
 * Whether two words are close enough to call the same word.
 *
 * Scaled to length, because one wrong letter in "cat" is a different word and
 * one wrong letter in "elephant" is a slip of the recogniser.
 */
const near = (a, b) => {
  if (a === b) return true
  const longest = Math.max(a.length, b.length)
  if (longest < 4) return false
  return levenshtein(a, b) <= (longest >= 8 ? 2 : 1)
}

/**
 * How much of the expected phrase was actually said, 0-100.
 *
 * Word by word and IN ORDER, with a pointer that may skip ahead through the
 * transcript but never back. Skipping forward forgives the noise a room adds —
 * a cough, a "um", the teacher talking — while refusing to go back is what
 * stops "cat the has Mai" scoring full marks for a sentence it has scrambled,
 * which matters on a reorder-adjacent skill.
 *
 * A near-miss counts half. It is worth something, because the child said a word
 * and the recogniser nearly agreed, but it is not worth what being right is.
 *
 * Returns the per-word verdicts as well as the number, so the reveal can colour
 * the phrase the student was reading rather than just accusing them of a score.
 */
export const scoreSpeech = (expected, heard) => {
  const want = wordsOf(expected)
  const got = wordsOf(heard?.text)
  if (!want.length) return { score: 0, words: [], heard: heard?.text || '' }

  let cursor = 0
  let earned = 0
  const words = want.map((word) => {
    // Exact first across the whole remaining transcript, so a near-miss earlier
    // in the tail cannot swallow the position of a word that is really there.
    let hit = -1
    let exact = false
    for (let i = cursor; i < got.length; i++) {
      if (got[i] === word) { hit = i; exact = true; break }
    }
    if (hit === -1) {
      for (let i = cursor; i < got.length; i++) {
        if (near(got[i], word)) { hit = i; break }
      }
    }

    if (hit === -1) return { text: word, ok: 'missing' }
    cursor = hit + 1
    earned += exact ? 1 : 0.5
    return { text: word, ok: exact ? 'said' : 'close' }
  })

  return {
    score: Math.round((earned / want.length) * 100),
    words,
    heard: heard?.text || ''
  }
}

export default { speechAvailable, transcribeSpeech, scoreSpeech }
