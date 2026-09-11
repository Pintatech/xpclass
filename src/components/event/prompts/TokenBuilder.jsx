import { useEffect, useMemo, useState } from 'react'
import { CUT, SubmitButton, normalize, scramble, tone } from './shared'

/**
 * Build a sequence by tapping tokens out of a tray.
 *
 * Reorder and unscramble are the same interaction at two grain sizes — words
 * into a sentence, letters into a word — so they are one component with two
 * tokenisers rather than two near-identical files.
 *
 * Tapping is deliberate: real drag-and-drop is the obvious way to arrange words
 * and the wrong one here. The battle is a full-screen portal on a phone, where
 * a drag fights the scroll and the browser's own text selection, and it grades
 * exactly the same as a tap.
 *
 * Tokens are tracked by their position in the tray, never by their text: "the"
 * can appear twice in a sentence and the two must stay distinct.
 */
const TokenBuilder = ({
  answer,
  disabled,
  result,
  onAnswer,
  join = ' ',
  compact = false
}) => {
  const tray = useMemo(() => scramble(answer), [answer])
  const [placed, setPlaced] = useState([])

  useEffect(() => setPlaced([]), [tray])

  const done = placed.length === answer.length
  const used = new Set(placed)

  const submit = () => {
    if (disabled || result || !done) return
    const given = placed.map((i) => tray[i])
    const right = given.every((t, i) => normalize(t) === normalize(answer[i]))
    onAnswer(right, given.join(join))
  }

  const slot = compact
    ? 'h-11 w-9 justify-center text-lg font-bold uppercase'
    : 'px-3 py-2 font-medium'

  return (
    <div className="mx-auto max-w-2xl">
      {/* The line being built. Fixed minimum height so the tray below does not
          jump up the screen as the first token lands in it. */}
      <div
        className={`mb-3 flex min-h-[3.5rem] flex-wrap items-center justify-center gap-2 border border-dashed p-2 ${
          result
            ? result.right
              ? 'border-green-400/60 bg-green-500/10'
              : 'border-red-400/60 bg-red-500/10'
            : 'border-white/20 bg-white/[0.03]'
        }`}
      >
        {placed.length === 0 && (
          <span className="text-sm text-white/30">Bấm các ô bên dưới…</span>
        )}
        {placed.map((trayIndex, slotIndex) => (
          <button
            key={`${trayIndex}-${slotIndex}`}
            type="button"
            onClick={() => setPlaced((p) => p.filter((_, i) => i !== slotIndex))}
            disabled={disabled || Boolean(result)}
            style={{ clipPath: CUT }}
            className={`flex items-center border transition-colors disabled:cursor-default ${slot} ${tone(
              result ? (result.right ? 'right' : 'wrong') : 'picked'
            )}`}
          >
            {tray[trayIndex]}
          </button>
        ))}
      </div>

      {/* The tray. A spent token keeps its space rather than being removed, so
          the grid never reflows under the finger that is tapping it. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {tray.map((token, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPlaced((p) => [...p, i])}
            disabled={disabled || used.has(i) || Boolean(result)}
            style={{ clipPath: CUT }}
            className={`flex items-center border transition-colors disabled:cursor-default ${slot} ${tone(
              used.has(i) ? 'spent' : 'idle'
            )}`}
          >
            {token}
          </button>
        ))}
      </div>

      {result && !result.right && (
        <p className="mt-3 text-center text-sm text-white/70">
          Đáp án:{' '}
          <span className="font-bold text-green-300">{answer.join(join)}</span>
        </p>
      )}

      {!result && <SubmitButton disabled={disabled || !done} onClick={submit} />}
    </div>
  )
}

export default TokenBuilder
