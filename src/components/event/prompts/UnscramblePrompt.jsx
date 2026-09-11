import { useMemo } from 'react'
import TokenBuilder from './TokenBuilder'

/**
 * Spell a word from its scrambled letters. The stem is the clue — the word
 * itself is never shown until it is either built or missed.
 *
 * Split with the spread rather than `split('')`, so a letter written as a
 * surrogate pair survives being taken apart.
 */
const UnscramblePrompt = ({ question, disabled, result, onAnswer }) => {
  const letters = useMemo(() => [...(question.payload?.answer || '')], [question])

  return (
    <TokenBuilder
      answer={letters}
      disabled={disabled}
      result={result}
      onAnswer={onAnswer}
      join=""
      compact
    />
  )
}

export default UnscramblePrompt
