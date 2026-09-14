import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square, VolumeX } from 'lucide-react'
import { CUT } from './shared'
import { speechPassFor } from '../../../config/eventQuestions'
import { scoreSpeech, speechAvailable, transcribeSpeech } from '../../../utils/speechScore'

/**
 * Đọc to — say the phrase, and be understood.
 *
 * The only prompt that grades something other than a tap or a keystroke, and
 * the only one that can fail for reasons the student had no part in: a refused
 * microphone, a missing API key, a network that drops the audio. Every one of
 * those SKIPS the question rather than marking it wrong, because a battle costs
 * a life for a wrong answer and none of those are the child's fault. A skip goes
 * out through `onSkip`, not `onAnswer`: it deals no damage either way.
 *
 * It is also the only prompt that goes away and comes back. Transcription takes
 * seconds, so it holds the clock through `onBusy` while it waits — the seconds
 * on a spoken question are speaking time, not upload time.
 */
const PronunciationPrompt = ({ question, disabled, result, onAnswer, onSkip, onBusy }) => {
  const phrase = question.payload?.text || ''
  const pass = speechPassFor(question.payload)

  // idle | recording | scoring | unavailable
  const [phase, setPhase] = useState(() => (speechAvailable() ? 'idle' : 'unavailable'))
  const [error, setError] = useState(null)
  const recorder = useRef(null)
  const chunks = useRef([])
  const stream = useRef(null)

  // Whatever happens next, let go of the microphone. A recorder left running
  // keeps the browser's tab indicator lit after the fight has ended, which
  // reads as the app listening to a child's bedroom.
  const release = () => {
    try { recorder.current?.state === 'recording' && recorder.current.stop() } catch { /* already stopped */ }
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    recorder.current = null
  }
  useEffect(() => release, [])

  // A fresh question puts the microphone back in its idle state. A day is one
  // kind of question throughout, so this component is NOT remounted between
  // questions — without this the panel would still be showing "Đang chấm…" from
  // the phrase before, and the button to record the new one would never appear.
  useEffect(() => {
    release()
    setError(null)
    setPhase(speechAvailable() ? 'idle' : 'unavailable')
  }, [question])

  // The clock is the battle's, so it must never be left held: if this prompt
  // unmounts mid-transcription — the fight ended underneath it — the hold is
  // dropped on the way out.
  useEffect(() => () => onBusy?.(false), [onBusy])

  const start = async () => {
    setError(null)
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      // Refused, or no microphone at all. Not a wrong answer.
      setPhase('unavailable')
      return
    }

    chunks.current = []
    const rec = new MediaRecorder(stream.current)
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
    rec.onstop = () => grade(new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }))
    recorder.current = rec
    rec.start()
    setPhase('recording')
  }

  const stop = () => {
    if (recorder.current?.state !== 'recording') return
    setPhase('scoring')
    onBusy?.(true)
    recorder.current.stop()
  }

  const grade = async (blob) => {
    release()
    try {
      const heard = await transcribeSpeech(blob)
      const scored = scoreSpeech(phrase, heard)
      onBusy?.(false)
      onAnswer(scored.score >= pass, scored)
    } catch {
      // The audio never got graded, so nobody can say it was wrong. Skipped,
      // with a line saying why rather than a silent pass.
      onBusy?.(false)
      setPhase('unavailable')
      setError('Không chấm được — bỏ qua câu này.')
    }
  }

  // A question that cannot be graded is neither right nor wrong. Wrong would
  // cost a life for a broken microphone; right would let a student deny the
  // microphone on purpose and tap through a replay for its loot.
  const skip = () => onSkip?.()

  const shown = result?.response

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* The phrase, always visible — this is a reading-aloud task, not a
          memory one, so hiding it after the first look would test the wrong
          thing. After an answer the same words carry the verdict. */}
      <div
        style={{ clipPath: CUT }}
        className="border border-white/15 bg-black/40 px-5 py-4 text-center text-xl font-bold leading-relaxed text-white"
      >
        {shown?.words?.length
          ? shown.words.map((w, i) => (
              <span
                key={`${w.text}-${i}`}
                className={
                  w.ok === 'said' ? 'text-green-300'
                    : w.ok === 'close' ? 'text-amber-300'
                      : 'text-red-300 line-through decoration-red-400/60'
                }
              >
                {w.text}{i < shown.words.length - 1 ? ' ' : ''}
              </span>
            ))
          : phrase}
      </div>

      {result && shown && (
        <div className="space-y-1 text-center text-sm">
          <p className={result.right ? 'font-bold text-green-300' : 'font-bold text-amber-300'}>
            {shown.score}% · cần {pass}%
          </p>
          {/* What the recogniser actually heard. Shown because "you said it
              wrong" is unarguable and useless, where "it heard THIS" is
              something a child and a teacher can both look at. */}
          {shown.heard && <p className="text-white/50">Nghe được: “{shown.heard}”</p>}
        </div>
      )}

      {!result && phase === 'idle' && (
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          style={{ clipPath: CUT }}
          className="mx-auto flex items-center gap-2 border border-blue-300/40 bg-blue-600 px-6 py-4 text-lg font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-default disabled:opacity-50"
        >
          <Mic className="h-5 w-5" /> Bấm để nói
        </button>
      )}

      {!result && phase === 'recording' && (
        <button
          type="button"
          onClick={stop}
          style={{ clipPath: CUT }}
          className="mx-auto flex animate-pulse items-center gap-2 border border-red-300/40 bg-red-600 px-6 py-4 text-lg font-bold text-white hover:bg-red-500"
        >
          <Square className="h-5 w-5" /> Xong
        </button>
      )}

      {!result && phase === 'scoring' && (
        <p className="flex items-center justify-center gap-2 py-4 font-semibold text-white/70">
          <Loader2 className="h-5 w-5 animate-spin" /> Đang chấm…
        </p>
      )}

      {!result && phase === 'unavailable' && (
        <div className="space-y-2 text-center">
          <p className="flex items-center justify-center gap-2 text-sm text-amber-300">
            <VolumeX className="h-4 w-4" /> {error || 'Không dùng được micro.'}
          </p>
          <button
            type="button"
            onClick={skip}
            style={{ clipPath: CUT }}
            className="mx-auto border border-white/20 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/20"
          >
            Bỏ qua
          </button>
        </div>
      )}
    </div>
  )
}

export default PronunciationPrompt
