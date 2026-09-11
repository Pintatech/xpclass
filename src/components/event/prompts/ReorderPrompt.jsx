import TokenBuilder from './TokenBuilder'

/**
 * Put a sentence back in order. The tokens are the words of `payload.answer`,
 * scrambled; the student taps them into a line.
 */
const ReorderPrompt = ({ question, disabled, result, onAnswer }) => (
  <TokenBuilder
    answer={question.payload?.answer || []}
    disabled={disabled}
    result={result}
    onAnswer={onAnswer}
    join=" "
  />
)

export default ReorderPrompt
