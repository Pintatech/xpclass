/**
 * The seven-day event ladder.
 *
 * Seven monsters, one a day, the last of them a boss. A stage opens on its own
 * day and not before, and only once the stage before it has been beaten, so the
 * week is a ladder rather than seven unrelated fights.
 *
 * A cleared stage stays open for as long as the event runs, but only the first
 * clear counts for anything: it is what levels the student up (see
 * levelFromClears) and what rolls the good drop. A rerun is practice.
 *
 * Everything here is a knob. The stage list and the day the week starts are
 * data, so the ladder can be retuned or rerun without a migration. The climb
 * itself lives in the monsters' own stats — see eventMonsters.js, where each
 * day is a little harder than the one before it.
 */
import { getMonster } from './eventMonsters'
import { MIXED, questionTypesFor } from './eventQuestions'

/** Local date the ladder opens on. Day 1 is this day. */
export const EVENT_START = '2026-09-14'

/**
 * Day → which monster, and which kind of question it asks.
 *
 * A day is one kind throughout, so the fight has a rhythm to settle into rather
 * than changing the rules every question — and so a student who is weak at one
 * kind meets it on one day instead of all week. The order runs roughly easiest
 * to hardest to ANSWER, which is not the same axis as the monsters' own climb
 * but pulls in the same direction.
 *
 * Kinds repeat on purpose: a week is four skills met twice, not seven tricks met
 * once. Multiple choice opens and comes back on day 3, and the two fill-blank
 * days sit together so the harder typing lands once the reading is familiar.
 *
 * The boss asks MIXED: day seven is everything the week taught, not an eighth
 * trick nobody has seen — see LADDER_QUESTION_TYPES, which is that list and is
 * derived from these rows rather than written out twice. The catalogue is
 * eventQuestions.js, and a value naming no known type falls back to multiple
 * choice rather than opening a fight with an empty panel.
 */
export const STAGES = [
  { day: 1, monster: 'bat',      questions: 'multiple_choice' },
  { day: 2, monster: 'golem',    questions: 'true_false' },
  { day: 3, monster: 'demon',    questions: 'multiple_choice' },
  { day: 4, monster: 'axion',    questions: 'fill_blank' },
  { day: 5, monster: 'skeleton', questions: 'fill_blank' },
  { day: 6, monster: 'satyr',    questions: 'reorder' },
  { day: 7, monster: 'ninja',    questions: MIXED, boss: true }
]

export const LADDER_DAYS = STAGES.length

export const stageFor = (day) => STAGES.find((s) => s.day === day) || STAGES[0]

/**
 * THE WHOLE FIGHT, IN THREE NUMBERS.
 *
 * A fighter has three lives and does one damage. A monster has hit points and
 * nothing else. So one right answer takes a point off the monster, one wrong
 * answer takes a life, and the fight ends when either runs out — no stats, no
 * builds, no points to spend, nothing to calibrate but the numbers below.
 *
 * This replaced, in order, a pool-and-percentage model with a damping factor
 * and two clamps, and a levelled stat sheet with three buyable stats. Both were
 * arithmetic nobody could read off the page, and both quietly decided how many
 * questions a student got asked. These three can be read by the teacher setting
 * them and explained to the child playing.
 */
export const HERO_LIVES = 3
export const HERO_ATK = 1

/**
 * A monster's hit points, which is simply the RIGHT ANSWERS it takes to kill.
 *
 * Ten on day one and one more each day, so the last day asks for sixteen. That
 * is the entire difficulty curve of the event, and it is this line.
 */
export const MONSTER_HP_DAY_1 = 1
export const monsterHpFor = (day) => MONSTER_HP_DAY_1 + Math.max(0, (day || 1) - 1)

/**
 * The most questions a fight can possibly ask: the hardest day's monster, plus
 * the mistakes a student is allowed on the way (the third one ends it).
 *
 * A day's bank needs this many of its question type to be sure of never running
 * dry mid-fight — which is what the admin screen counts against.
 */
export const maxRoundQuestions = () => monsterHpFor(LADDER_DAYS) + HERO_LIVES - 1

/**
 * Levels, such as they are: a level is a monster you have beaten, plus one.
 *
 * Nothing is stored and nothing is spent — it is a badge, not a budget. Beating
 * a monster you have already beaten raises nothing, because the ladder holds a
 * SET of cleared stages and a repeat does not grow a set.
 */
export const MAX_LEVEL = LADDER_DAYS + 1
export const levelFromClears = (clears = 0) => Math.min(MAX_LEVEL, 1 + Math.max(0, clears))

/**
 * The monster a stage fights, carrying the hit points that day asks for.
 *
 * The HP belongs to the DAY rather than to the creature: the bat is the bat
 * whichever day it turns up on, and what makes day five harder than day one is
 * the ladder, not the animal. eventMonsters.js is therefore art and nothing
 * else — reorder STAGES and the difficulty curve follows the days, which is the
 * bug an earlier per-creature stat block kept walking into.
 */
export const stageMonster = (stage, { replay = false } = {}) => ({
  ...getMonster(stage.monster),
  hp: replay ? REPLAY_MONSTER_HP : monsterHpFor(stage.day)
})

/**
 * The most questions a round can ask: a kill's worth of right answers plus the
 * mistakes allowed on the way. The battle draws its round with this arithmetic
 * and openEventBattle stocks against it, so it lives in one place rather than
 * being spelled out at both ends.
 */
export const roundSizeFor = (stage, { replay = false } = {}) =>
  stageMonster(stage, { replay }).hp + HERO_LIVES - 1

/**
 * The kinds the week actually taught, in the order it taught them.
 *
 * This is what the boss's MIXED means — "all of the above", literally: the days
 * above it, not everything the catalogue can describe. A type the ladder never
 * uses (matching and unscramble, as the week is currently cut) must not turn up
 * for the first time on day seven, which is exactly what drawing from the whole
 * catalogue would do. Re-cut the week and this follows on its own.
 */
export const LADDER_QUESTION_TYPES = [
  ...new Set(STAGES.map((s) => s.questions).filter((q) => q && q !== MIXED))
]

/**
 * WHAT A REPLAY ASKS INSTEAD.
 *
 * A cleared stage fought again is not the same fight. The week's seven days are
 * reading and writing — tap, type, reorder — and none of them asks a child to
 * open their mouth. The replay is where that happens: the questions are
 * REPLACED, not added to, so a redo is a speaking round rather than the same
 * round with a microphone bolted on, and has a reason to exist beyond farming
 * the small repeat reward.
 *
 * It sits outside STAGES on purpose, so it stays out of LADDER_QUESTION_TYPES
 * and can never turn up in the boss's MIXED round: nobody meets a spoken
 * question for the first time on day seven with a first clear riding on it.
 *
 * A redo is also the only safe place for it. A replay banks no level and no
 * first-clear reward, so a question graded by a speech recogniser over a phone
 * microphone — which will sometimes simply mishear a child — cannot cost anyone
 * anything that matters.
 */
export const REPLAY_QUESTION_TYPES = ['pronunciation']

/**
 * How many right answers a REPLAY takes — flat, and much shorter than the day
 * it replays.
 *
 * The ladder's climb is deliberate: day seven asks for more than day one, and
 * that is the whole difficulty curve. A speaking round must not inherit it.
 * Reading eighteen phrases aloud into a phone is not a harder version of the
 * same exercise, it is a different and worse one — the child is hoarse, the
 * novelty is gone, and every phrase is another roll of the dice on the
 * recogniser mishearing them.
 *
 * It also decides how much writing a day's speaking round costs: with three
 * hit points and two allowed mistakes a day needs five phrases per level band,
 * not eighteen. That is the difference between a teacher filling in the week
 * and a teacher giving up on it.
 */
export const REPLAY_MONSTER_HP = 3

/**
 * The question types a stage may draw from, as a list the bank query can hand
 * straight to an `in` filter. A single-type day gives one entry; the boss gives
 * every kind the week has already asked; a replay gives the spoken types and
 * nothing else.
 *
 * The caller decides what a replay is — see openEventBattle, which passes the
 * stage's own `cleared` flag and falls back to the day's normal types when the
 * bank has no spoken questions to offer, because a redo with an empty pool is a
 * fight that ends before it starts.
 */
export const stageQuestionTypes = (stage, { replay = false } = {}) => {
  if (replay) return REPLAY_QUESTION_TYPES
  return !stage?.questions || stage.questions === MIXED
    ? LADDER_QUESTION_TYPES
    : questionTypesFor(stage.questions)
}

/** Midnight-to-midnight, in the student's own timezone. */
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/**
 * Which day of the event it is, 1-based. Before the start date this is 0 and
 * nothing is open; after the last day it stays at LADDER_DAYS, so a student who
 * arrives late can still climb what they missed.
 */
export const eventDay = (now = new Date(), start = EVENT_START) => {
  const [y, m, d] = start.split('-').map(Number)
  const from = startOfDay(new Date(y, m - 1, d))
  const days = Math.floor((startOfDay(now) - from) / 86400000) + 1
  return Math.max(0, Math.min(LADDER_DAYS, days))
}

/**
 * The state of every stage for one student.
 *
 * `open` is the stage they are meant to fight now: the first uncleared one,
 * provided its day has arrived. Cleared stages stay `replay`able — that is what
 * a student does with the rest of a day once they have won — and anything the
 * calendar has not reached, or that sits behind an uncleared stage, is locked.
 *
 * The two gates lift independently, which is how staff get to inspect a week
 * that has not started: `ignoreCalendar` opens every day at once, `ignoreOrder`
 * drops the requirement to have beaten the day before. Both are mirrored in
 * record_event_stage_clear — a stage the database will not record is worse than
 * one that will not open, because the fight is fought before it is refused.
 */
export const ladderState = (
  clearedDays = [],
  now = new Date(),
  start = EVENT_START,
  { ignoreCalendar = false, ignoreOrder = false } = {}
) => {
  const today = eventDay(now, start)
  const cleared = new Set(clearedDays)
  const firstUncleared = STAGES.find((s) => !cleared.has(s.day))?.day ?? null

  return STAGES.map((stage) => {
    const isCleared = cleared.has(stage.day)
    const reached = ignoreCalendar || stage.day <= today
    const inTurn = ignoreOrder || stage.day === firstUncleared
    const playable = isCleared || (reached && inTurn)

    return {
      ...stage,
      cleared: isCleared,
      // Why it cannot be fought, for the tooltip on a locked node.
      lockedBy: playable ? null : !reached ? 'calendar' : 'previous',
      playable,
      // Where the ladder itself is pointing, which is the stage the panel opens
      // on. Unlocking everything must not move that to day 7.
      current: reached && stage.day === firstUncleared
    }
  })
}
