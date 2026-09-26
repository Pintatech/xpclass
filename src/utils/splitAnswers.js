/**
 * Split a blank's answer string into individual accepted answers.
 * New convention: use | or / as delimiters.
 * Falls back to , for backward compatibility with old data.
 */
export function splitAnswers(answer) {
  if (!answer) return []
  if (/[|/]/.test(answer)) {
    return answer.split(/[|/]/).map(a => a.trim()).filter(Boolean)
  }
  return answer.split(',').map(a => a.trim()).filter(Boolean)
}

/**
 * Check a user's answer against a blank's answer string.
 * Trims and collapses repeated whitespace on both sides before comparing.
 */
export function matchesAnswer(userAnswer, answer, caseSensitive = false) {
  const normalize = (s) => {
    const collapsed = String(s || '').trim().replace(/\s+/g, ' ')
    return caseSensitive ? collapsed : collapsed.toLowerCase()
  }
  const user = normalize(userAnswer)
  return splitAnswers(answer).some(a => normalize(a) === user)
}

/**
 * Get the first (display) answer from an answer string.
 */
export function firstAnswer(answer) {
  const answers = splitAnswers(answer)
  return answers[0] || ''
}
