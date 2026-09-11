import { useEffect, useRef, useState } from 'react'
import { CUT, SubmitButton, normalize } from './shared'

/**
 * Type the missing word. The stem carries the ___ ; this is the box under it.
 *
 * Any of `payload.answers` counts, compared through `normalize`, because "is"
 * and "'s" are both right and a child who typed the other one has not made a
 * mistake. On a wrong answer the reveal shows the first accepted spelling —
 * seeing the word is the whole lesson of getting it wrong.
 */
const FillBlankPrompt = ({ question, disabled, result, onAnswer }) => {
  const [text, setText] = useState('')
  const input = useRef(null)
  const answers = question.payload?.answers || []

  // A fresh question empties the box and takes the caret back, so a student can
  // type straight through a round without reaching for the field each time.
  useEffect(() => {
    setText('')
    if (!disabled) input.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question])

  const submit = () => {
    if (disabled || result || !text.trim()) return
    const given = normalize(text)
    onAnswer(answers.some((a) => normalize(a) === given), text.trim())
  }

  return (
    <div className="mx-auto max-w-md">
      <input
        ref={input}
        // `?? ''` because a question that ran out of time resolves with a null
        // response, and a null value would flip this from a controlled input to
        // an uncontrolled one mid-round.
        value={result ? (result.response ?? '') : text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        disabled={disabled || Boolean(result)}
        placeholder="Gõ câu trả lời…"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        style={{ clipPath: CUT }}
        className={`w-full border bg-white/[0.07] px-4 py-3 text-center text-lg font-semibold text-white placeholder:text-white/30 focus:outline-none disabled:cursor-default ${
          result
            ? result.right
              ? 'border-green-400/80 bg-green-500/25'
              : 'border-red-400/80 bg-red-500/25'
            : 'border-white/15 focus:border-blue-400/70'
        }`}
      />

      {result && !result.right && (
        <p className="mt-2 text-center text-sm text-white/70">
          Đáp án: <span className="font-bold text-green-300">{answers[0]}</span>
        </p>
      )}

      {!result && <SubmitButton disabled={disabled || !text.trim()} onClick={submit} />}
    </div>
  )
}

export default FillBlankPrompt
