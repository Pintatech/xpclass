/**
 * The kinds of question an event battle can ask.
 *
 * One entry per `type` the event_question_bank CHECK will accept, and one
 * renderer per entry in components/event/prompts. Adding a kind means three
 * things and no more: a case in that CHECK, an entry here, a renderer in the
 * registry.
 *
 * `label` is what the battle panel shows above the question, so a student knows
 * what is being asked of them before they read it; `hint` is the one-line
 * instruction under it. Both are Vietnamese, like the rest of the event UI.
 *
 * `seconds` is how long that question is given before the clock runs out and
 * the monster swings. It belongs to the TYPE, not the day and not the row:
 * reading four choices and rebuilding a five-word sentence are not the same
 * amount of work, and one number for all six would be either no pressure at all
 * on the quick ones or unfair on the slow ones. They are ceilings, not targets —
 * a student who knows the answer spends a fraction of them.
 *
 * A single row may override its type's number with its own `seconds` column;
 * see secondsFor. That is the exception, not the rule — the type default is what
 * almost every question should run on.
 */

export const QUESTION_TYPES = [
  {
    id: 'multiple_choice',
    label: 'Chọn đáp án',
    hint: 'Chọn câu trả lời đúng.',
    // Read four options and tap one.
    seconds: 20
  },
  {
    id: 'true_false',
    label: 'Đúng hay sai',
    hint: 'Câu này đúng hay sai?',
    // The fastest to read, so the tightest clock.
    seconds: 15
  },
  {
    id: 'fill_blank',
    label: 'Điền vào chỗ trống',
    hint: 'Gõ từ còn thiếu rồi bấm Trả lời.',
    // Has to be typed, and young fingers are slow.
    seconds: 25
  },
  {
    id: 'reorder',
    label: 'Sắp xếp câu',
    hint: 'Bấm các từ theo đúng thứ tự.',
    // A whole sentence to assemble, tap by tap.
    seconds: 35
  },
  {
    id: 'unscramble',
    label: 'Ghép chữ cái',
    hint: 'Bấm các chữ cái để tạo thành từ đúng.',
    // Letter by letter, and the word must be worked out first.
    seconds: 30
  },
  {
    id: 'matching',
    label: 'Nối từ',
    hint: 'Bấm một từ bên trái, rồi bấm nghĩa của nó bên phải.',
    // Six taps across two columns, and the pairs must be read first.
    seconds: 40
  },
  {
    id: 'pronunciation',
    label: 'Đọc to',
    hint: 'Bấm micro và đọc to câu này.',
    // The longest clock in the catalogue, and it is still tight: the microphone
    // has to be allowed, the phrase read, and a child who fluffs the first word
    // deserves the breath it takes to start again. The seconds are SPEAKING
    // time only — the battle holds the clock while the audio is being sent away
    // and graded, because a slow network is not a slow student.
    seconds: 45
  }
]

/** Every type id, which is also what a `mixed` stage draws from. */
export const ALL_QUESTION_TYPES = QUESTION_TYPES.map((t) => t.id)

/**
 * A stage may ask for `MIXED` instead of naming a type — the boss does, so the
 * last day is everything the week taught rather than a seventh new trick.
 */
export const MIXED = 'mixed'

export const DEFAULT_QUESTION_TYPE = 'multiple_choice'

/**
 * The level a student starts reading passages at.
 *
 * Below this a fight is drawn from the LOOSE bank — the questions attached to
 * no story — because a screen of English before the first question is a wall to
 * a child who is still sounding out the questions themselves. At this level and
 * above a day opens on its passage, and the questions asked are about what was
 * just read. See pickEventStory in components/dashboard/Dashboard.jsx.
 *
 * A number rather than a flag, so where reading starts can be moved without
 * touching the branch that reads it.
 */
export const STORY_MIN_LEVEL = 2

/**
 * How much of a phrase has to be recognised for a spoken answer to count.
 *
 * Deliberately not 100: the grader is a speech-to-text engine listening to a
 * child on a phone microphone, so a word it mishears is as often its fault as
 * theirs. Seventy means "you said the sentence and it was understood", which is
 * the thing worth rewarding, and leaves room for the one word that always comes
 * back wrong. A row may set its own `pass` for a phrase that needs more or less
 * slack.
 */
export const DEFAULT_SPEECH_PASS = 70
export const SPEECH_PASS_RANGE = { min: 40, max: 100 }

/** The pass mark a spoken row is graded on, falling back to the default. */
export const speechPassFor = (payload) =>
  payload?.pass >= SPEECH_PASS_RANGE.min && payload.pass <= SPEECH_PASS_RANGE.max
    ? payload.pass
    : DEFAULT_SPEECH_PASS

/**
 * What a per-question override is allowed to be. Mirrors the CHECK in
 * add_event_question_seconds.sql: below the floor a question expires before it
 * can be read, and the ceiling is far past anything a real question needs.
 */
export const SECONDS_RANGE = { min: 5, max: 300 }

const BY_ID = Object.fromEntries(QUESTION_TYPES.map((t) => [t.id, t]))

/** The catalogue entry for a type, falling back to multiple choice. */
export const questionType = (id) => BY_ID[id] || BY_ID[DEFAULT_QUESTION_TYPE]

/**
 * Which types a stage's questions may be drawn from, as a list — one entry for
 * a stage that names a type, all of them for a mixed one. The database query
 * and the battle both take this, so neither has to know about MIXED.
 */
export const questionTypesFor = (type) => {
  if (!type || type === MIXED) return ALL_QUESTION_TYPES
  return ALL_QUESTION_TYPES.includes(type) ? [type] : [DEFAULT_QUESTION_TYPE]
}

/**
 * A blank payload for a type, for the admin editor to start from.
 *
 * Multiple choice opens with four slots because that is what almost every row
 * wants; the CHECK allows anywhere from two upwards and the editor can add or
 * drop them.
 */
export const blankPayload = (type) => {
  switch (type) {
    case 'multiple_choice': return { choices: ['', '', '', ''], answer_index: 0 }
    // No answer, rather than a default of true: the editor highlights neither
    // button until one is picked, so an admin cannot save a true/false question
    // having never chosen — which would silently make half of them wrong.
    case 'true_false': return {}
    case 'fill_blank': return { answers: [''] }
    case 'reorder': return { answer: [] }
    case 'unscramble': return { answer: '' }
    case 'matching': return { pairs: [['', ''], ['', '']] }
    // The pass mark is opened at the default rather than left blank, so an
    // admin who never touches it still saves a gradeable question.
    case 'pronunciation': return { text: '', pass: DEFAULT_SPEECH_PASS }
    default: return {}
  }
}

/**
 * Why this row would be rejected, as a list of human sentences — empty when it
 * is fine.
 *
 * This deliberately mirrors the CHECK in add_event_question_bank.sql. The
 * database is still the guarantee; this exists so an admin gets "Câu hỏi phải
 * có chỗ trống ___" instead of a raw constraint violation, and so the editor
 * can grey out its save button before a round trip. If a rule changes, it
 * changes in both places — which is the cost of the better message.
 */
export const payloadIssues = (type, payload = {}, question = '') => {
  const issues = []
  const filled = (v) => String(v ?? '').trim().length > 0

  // A spoken row has no stem of its own — the phrase in the payload IS the
  // question, and it is checked in that branch. Demanding both would block a
  // perfectly complete row on a box the form does not even show.
  if (type !== 'pronunciation' && !filled(question)) issues.push('Cần nhập nội dung câu hỏi.')

  switch (type) {
    case 'multiple_choice': {
      const choices = payload.choices || []
      if (choices.length < 2) issues.push('Cần ít nhất 2 lựa chọn.')
      if (choices.some((c) => !filled(c))) issues.push('Không được để trống lựa chọn nào.')
      if (!(payload.answer_index >= 0 && payload.answer_index < choices.length)) {
        issues.push('Phải chọn một đáp án đúng.')
      }
      break
    }
    case 'true_false':
      if (typeof payload.answer !== 'boolean') issues.push('Phải chọn Đúng hoặc Sai.')
      break
    case 'fill_blank': {
      const answers = (payload.answers || []).filter(filled)
      if (!answers.length) issues.push('Cần ít nhất một đáp án được chấp nhận.')
      // The renderer puts the input under the stem; without the blank the
      // student is not told which word is missing.
      if (!question.includes('___')) issues.push('Câu hỏi phải chứa chỗ trống ___.')
      break
    }
    case 'reorder':
      if ((payload.answer || []).filter(filled).length < 2) {
        issues.push('Câu cần ít nhất 2 từ để sắp xếp.')
      }
      break
    case 'unscramble':
      if (String(payload.answer || '').trim().length < 2) {
        issues.push('Từ cần ít nhất 2 chữ cái.')
      }
      break
    case 'matching': {
      const pairs = payload.pairs || []
      if (pairs.length < 2) issues.push('Cần ít nhất 2 cặp từ.')
      if (pairs.some(([a, b]) => !filled(a) || !filled(b))) {
        issues.push('Không được để trống vế nào của một cặp.')
      }
      break
    }
    case 'pronunciation': {
      const text = String(payload.text || '').trim()
      if (!text) issues.push('Cần nhập câu cần đọc.')
      // Scored word by word against a transcript, so a single word is a coin
      // flip on whether the recogniser caught it — two gives the grader
      // something to average over.
      else if (text.split(/\s+/).length < 2) issues.push('Câu cần ít nhất 2 từ.')
      if (
        payload.pass !== undefined &&
        !(payload.pass >= SPEECH_PASS_RANGE.min && payload.pass <= SPEECH_PASS_RANGE.max)
      ) {
        issues.push(`Điểm đạt phải từ ${SPEECH_PASS_RANGE.min} đến ${SPEECH_PASS_RANGE.max}.`)
      }
      break
    }
    default:
      issues.push('Loại câu hỏi không hợp lệ.')
  }
  return issues
}

/** A one-line preview of a row's answer, for the admin list. */
export const answerSummary = (type, payload = {}) => {
  switch (type) {
    case 'multiple_choice': return payload.choices?.[payload.answer_index] ?? '—'
    case 'true_false': return payload.answer ? 'Đúng' : 'Sai'
    case 'fill_blank': return (payload.answers || []).join(' / ')
    case 'reorder': return (payload.answer || []).join(' ')
    case 'unscramble': return payload.answer || '—'
    case 'matching': return (payload.pairs || []).map(([a, b]) => `${a}–${b}`).join(', ')
    case 'pronunciation': return payload.text ? `“${payload.text}” (${speechPassFor(payload)}%)` : '—'
    default: return '—'
  }
}

/**
 * How long a question gets, in seconds.
 *
 * A row's own `seconds` wins when it has one; otherwise the type's default
 * stands. Null, undefined and a stored 0 all fall through to the default — 0 is
 * not a legal override and treating it as one would expire the question the
 * instant it appeared.
 */
export const secondsFor = (row) =>
  row?.seconds > 0 ? row.seconds : questionType(row?.type).seconds

/**
 * Why a per-question override would be rejected — empty when it is fine, which
 * includes leaving it blank to inherit the type default.
 */
export const secondsIssues = (seconds) => {
  if (seconds === null || seconds === undefined || seconds === '') return []
  const n = Number(seconds)
  if (!Number.isInteger(n)) return ['Thời gian phải là số nguyên (giây).']
  if (n < SECONDS_RANGE.min || n > SECONDS_RANGE.max) {
    return [`Thời gian phải từ ${SECONDS_RANGE.min} đến ${SECONDS_RANGE.max} giây.`]
  }
  return []
}

