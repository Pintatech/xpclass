import { Check, X } from 'lucide-react'
import { CUT, tone } from './shared'

/**
 * Đúng / Sai. Two buttons, resolving on tap like multiple choice.
 *
 * A coin flip beats every other type on luck alone, which is the price of how
 * fast it reads; the ladder puts it on day two, where the monster is soft enough
 * that a lucky run does not trivialise the fight.
 */
const CHOICES = [
  { value: true, label: 'Đúng', Icon: Check },
  { value: false, label: 'Sai', Icon: X }
]

const TrueFalsePrompt = ({ question, disabled, result, onAnswer }) => {
  const answer = question.payload?.answer === true

  return (
    <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
      {CHOICES.map(({ value, label, Icon }) => {
        const shown = result
          ? value === answer
            ? 'right'
            : value === result.response
              ? 'wrong'
              : 'idle'
          : 'idle'
        return (
          <button
            key={label}
            type="button"
            onClick={() => onAnswer(value === answer, value)}
            disabled={disabled}
            style={{ clipPath: CUT }}
            className={`flex items-center justify-center gap-2 border px-4 py-4 text-lg font-bold transition-colors disabled:cursor-default ${tone(shown)}`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default TrueFalsePrompt
