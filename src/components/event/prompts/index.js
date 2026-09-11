import { DEFAULT_QUESTION_TYPE } from '../../../config/eventQuestions'
import MultipleChoicePrompt from './MultipleChoicePrompt'
import TrueFalsePrompt from './TrueFalsePrompt'
import FillBlankPrompt from './FillBlankPrompt'
import ReorderPrompt from './ReorderPrompt'
import UnscramblePrompt from './UnscramblePrompt'
import MatchingPrompt from './MatchingPrompt'
import PronunciationPrompt from './PronunciationPrompt'

/**
 * type → renderer.
 *
 * Every renderer takes the same four props and answers with the same two:
 *
 *   question  the bank row, whose `payload` only its own renderer understands
 *   disabled  the battle is busy — spawning, or animating the last exchange
 *   result    { right, response } once answered, null while open
 *   onAnswer  (right, response) — the ONLY thing the battle learns from a
 *             question is that boolean; `response` comes back untouched as
 *             `result.response` so the renderer can draw its own reveal.
 *
 * There is a fifth, `onBusy(bool)`, which every renderer is passed and only one
 * uses: it HOLDS THE CLOCK. A prompt that has to go away and wait on something
 * slow — the network, in the spoken type's case — calls it rather than spending
 * a student's seconds on a round trip they are not answering during. Anything
 * that resolves at the speed of a tap should never touch it, which is why it is
 * documented as the exception rather than in the list above.
 *
 * Grading lives in the renderer because it is type-specific — normalised text
 * for a typed answer, index equality for a choice, pairwise for a match — and
 * keeping it next to the interaction is what stops the battle from growing a
 * switch statement over question shapes.
 */
export const PROMPTS = {
  multiple_choice: MultipleChoicePrompt,
  true_false: TrueFalsePrompt,
  fill_blank: FillBlankPrompt,
  reorder: ReorderPrompt,
  unscramble: UnscramblePrompt,
  matching: MatchingPrompt,
  pronunciation: PronunciationPrompt
}

/**
 * The renderer for a row. Falls back rather than throwing: a bank row whose
 * type this build has no renderer for would otherwise blank the panel in the
 * middle of a fight.
 */
export const promptFor = (type) => PROMPTS[type] || PROMPTS[DEFAULT_QUESTION_TYPE]
