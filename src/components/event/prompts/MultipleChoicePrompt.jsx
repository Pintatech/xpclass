import { useMemo } from 'react'
import { CUT, shuffle, tone } from './shared'

/**
 * The original event question: a stem and four choices, one of them right.
 *
 * Resolves on tap — there is nothing to compose, so a submit button would only
 * be a second click. The choices carry their original index with them so the
 * grading is unaffected by the shuffle.
 */
const MultipleChoicePrompt = ({ question, disabled, result, onAnswer }) => {
  const answerIndex = question.payload?.answer_index ?? 0

  const choices = useMemo(() => {
    const list = question.payload?.choices || []
    return shuffle(list.map((text, index) => ({ text, index })))
    // Reshuffling on anything but a new question would move the buttons under
    // the student's finger mid-read.
  }, [question])

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2">
      {choices.map((choice, i) => {
        const shown = result
          ? choice.index === answerIndex
            ? 'right'
            : choice.index === result.response
              ? 'wrong'
              : 'idle'
          : 'idle'
        return (
          <button
            key={choice.index}
            type="button"
            onClick={() => onAnswer(choice.index === answerIndex, choice.index)}
            disabled={disabled}
            style={{ clipPath: CUT }}
            className={`flex items-center gap-3 border px-4 py-3 text-left font-medium transition-colors disabled:cursor-default ${tone(shown)}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white/15 text-xs font-bold">
              {'ABCD'[i]}
            </span>
            <span>{choice.text}</span>
          </button>
        )
      })}
    </div>
  )
}

export default MultipleChoicePrompt
