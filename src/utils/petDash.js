export const DASH_DURATION = 75
export const DASH_MAX_HP = 3
export const DASH_STAGES = 3
export const DASH_STAGE_SECONDS = DASH_DURATION / DASH_STAGES
export const DASH_CLOCK_BONUS = 4
export const DASH_MAX_BONUS_TIME = 12
export const DASH_REDEEM_BONUS = 5
export const DASH_DODGE_BONUS = 3
export const DASH_FLAWLESS_BONUS = 20
export const DASH_HEAL_STREAK = 5
// Hearts lost for a wrong word; a barrier always costs a full heart. 0.5 makes the game gentler.
export const DASH_WORD_DAMAGE = 1

const MAX_ROWS = 3
const HAZARD_CYCLE = 1.2
const RETRY_DELAY = 3
const MAX_RETRIES = 2
const REVERSE_MAX_HINT = 26
const FEEDBACK_SECONDS = 1.7
const SAFETY_OVERTIME = 8
// After a mistake the pet stumbles: the road slows down briefly so the next clue can be read.
const STUMBLE_SECONDS = 0.9
const STUMBLE_PACE = 0.5

const lerp = (a, b, t) => a + (b - a) * t
const levelStep = (level) => Math.min(3, Math.max(0, Math.floor(Number(level) || 1) - 1))
const runProgress = (elapsed) => Math.min(1, Math.max(0, elapsed / DASH_DURATION))

// A gate must have three genuinely different answers, including their hints.
export const normalizeDashWords = (bank) => {
  const words = new Set()
  const hints = new Set()
  return (Array.isArray(bank) ? bank : []).flatMap((entry) => {
    if (typeof entry?.word !== 'string' || typeof entry?.hint !== 'string') return []
    const word = entry.word.trim()
    const hint = entry.hint.trim()
    const wordKey = word.toLocaleLowerCase()
    const hintKey = hint.toLocaleLowerCase().replace(/\s+/g, ' ')
    if (!word || !hint || words.has(wordKey) || hints.has(hintKey)) return []
    words.add(wordKey)
    hints.add(hintKey)
    return [{ ...entry, word, hint }]
  })
}

const shuffled = (items, random) => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export const getDashChoiceLabel = (row, lane) => {
  const choice = row?.choices?.[lane]
  if (!choice) return ''
  return row.mode === 'word' ? choice.hint : choice.word
}

const labelOf = (entry, mode) => (mode === 'word' ? entry.hint : entry.word)

// Early on distractors are random; later they look and sound alike (length / first letter).
const similarity = (a, b) => {
  const x = a.toLocaleLowerCase()
  const y = b.toLocaleLowerCase()
  return -Math.abs(x.length - y.length) + (x[0] && x[0] === y[0] ? 2 : 0)
}

const pickDistractors = (words, target, mode, difficulty, random) => words
  .filter((entry) => entry.word !== target.word)
  .map((entry) => ({
    entry,
    key: random() * 6 * (1 - difficulty) - similarity(labelOf(entry, mode), labelOf(target, mode)) * difficulty,
  }))
  .sort((a, b) => a.key - b.key)
  .slice(0, 2)
  .map((item) => item.entry)

// mode 'hint': the meaning is shown and the lanes hold English words.
// mode 'word': the English word is shown and the lanes hold meanings.
export const createDashGate = (words, { previousWord = null, target = null, difficulty = 0, reverse = false } = {}, random = Math.random) => {
  if (!Array.isArray(words) || words.length < 3) return null
  let chosen = target
  if (!chosen) {
    const candidates = words.filter((entry) => entry.word !== previousWord)
    chosen = candidates[Math.floor(random() * candidates.length)]
  }
  let mode = reverse ? 'word' : 'hint'
  let distractors = pickDistractors(words, chosen, mode, difficulty, random)
  let choices = shuffled([chosen, ...distractors], random)
  if (mode === 'word' && choices.some((entry) => entry.hint.length > REVERSE_MAX_HINT)) {
    mode = 'hint'
    distractors = pickDistractors(words, chosen, mode, difficulty, random)
    choices = shuffled([chosen, ...distractors], random)
  }
  return { type: 'gate', mode, target: chosen, choices, correctLane: choices.indexOf(chosen) }
}

// Each stage (morning, golden hour, twilight) is worth one star: collect its words before it ends.
// Goals are tuned with simulated players: a perfect run finds about 8 / 11-12 / 22-23 words per stage
// (the last stage also holds the bonus time and the final gates); a quick reader who knows 90% of the
// words earns three stars in about 3 runs out of 4.
const STAGE_GOALS = [[5, 8, 10], [5, 8, 10], [5, 8, 11], [5, 9, 11]]
export const getDashGoals = (level = 1) => [...STAGE_GOALS[levelStep(level)]]

export const getDashStage = (elapsed) => Math.min(DASH_STAGES - 1, Math.floor(Math.max(0, elapsed) / DASH_STAGE_SECONDS))

export const getDashStars = (run) => run.stageCleared.filter(Boolean).length

// Speed is tuned on a 0-11 scale per stage: 6 = medium (about 2.5 s per word), 9 = fast (1.8 s),
// 11 = turbo (1.3 s, the same at every level).
export const DASH_STAGE_SPEED = [6, 9, 11]
export const DASH_MAX_SPEED = 11
// From this speed on the road runs in turbo: the HUD says so and the pet leaves a trail of light.
export const DASH_TURBO_SPEED = 10
const SPEED_BLEND_SECONDS = 3
const TRAVEL_AT_ZERO = 4.6
const TRAVEL_PER_POINT = 0.28
const MIN_GATE_CYCLE = 1.3
// Adaptive pace: every mistake slows the road by one notch, at most down to the old relaxed pace
// (ASSIST_FLOOR, about 3 s per word), even when that is slower than stage 1.
// Correct answers given with time to spare (the pet settled in its lane ASSIST_CALM seconds before
// the gate) win a notch back; last-second answers keep the slower road.
// The notches are big because turbo is fast: with 1.5-point notches that stopped at stage 1's speed,
// simulated slow readers still had only 2 s per word and ran out of hearts in 9 runs out of 10.
export const DASH_ASSIST_MAX = 3
const ASSIST_STEP = 2
const ASSIST_FLOOR = 4
const ASSIST_RECOVER = 4
const ASSIST_CALM = 0.5
const ASSIST_EASE = 1.5

// The rating eases into the next stage's speed so the road never jumps. Higher levels add a little.
export const getDashSpeedRating = (elapsed = 0, level = 1) => {
  const stage = getDashStage(elapsed)
  const target = DASH_STAGE_SPEED[stage]
  const previous = stage > 0 ? DASH_STAGE_SPEED[stage - 1] : target
  const blend = Math.min(1, Math.max(0, (elapsed - stage * DASH_STAGE_SECONDS) / SPEED_BLEND_SECONDS))
  const eased = blend * blend * (3 - 2 * blend)
  return Math.min(DASH_MAX_SPEED, lerp(previous, target, eased) + levelStep(level) * 0.25)
}

// The speed the road actually runs at: the stage speed minus the notches the player's mistakes earned.
export const getDashRunSpeed = (run, level = 1) => Math.max(
  ASSIST_FLOOR,
  getDashSpeedRating(run.elapsed, level) - run.assistVis * ASSIST_STEP,
)

// Seconds a row needs to travel from the horizon to the pet at a given speed.
export const getDashTravelTime = (speed) => TRAVEL_AT_ZERO - TRAVEL_PER_POINT * speed

// Seconds between two consecutive gates: this is how long a student gets to read each word.
export const getDashGateCycle = (travel) => Math.max(MIN_GATE_CYCLE, travel * 0.85)

export const scoreDashGate = (streak) => 10 + Math.min(8, Math.max(0, streak - 1)) * 2

// chest: treasure chests are enabled, so one gate of the run (somewhere among gates 5-12) carries one.
export const createDashRun = (level = 1, { chest = false, random = Math.random } = {}) => ({
  goals: getDashGoals(level), stage: 0, stageWords: [0, 0, 0], stageCleared: [false, false, false],
  stageMistakes: [0, 0, 0], stageFlawless: [false, false, false], stumble: 0, sniffCharge: false, hurt: 0,
  assist: 0, assistVis: 0, calm: 0, laneSince: 0, chestAt: chest ? 5 + Math.floor(random() * 8) : 0, chestCollected: false,
  elapsed: 0, duration: DASH_DURATION, lane: 1, hp: DASH_MAX_HP, shield: false, score: 0,
  wordsCompleted: 0, gatesCleared: 0, streak: 0, bestStreak: 0, dodges: 0, redeemed: 0,
  distance: 0, rowId: 0, spawned: 0, gateIndex: 0, nextSpawn: 0.5, previousWord: null,
  rows: [], deck: [], retry: [], feedback: null, feedbackId: 0, events: [], missedWords: [],
  over: false, reason: null,
})

export const getDashTimeBonus = (run) => Math.floor(Math.min(run.elapsed, DASH_DURATION) * 6 / 25)
export const getDashHeartBonus = (run) => (run.over && run.reason === 'time' ? Math.floor(run.hp * 5) : 0)
export const getDashScore = (run) => run.score + getDashTimeBonus(run) + getDashHeartBonus(run)

export const drainDashEvents = (run) => {
  const events = run.events
  run.events = []
  return events
}

// 1 while running normally, slower for a moment after a mistake.
export const getDashPace = (run) => (run.stumble > 0 ? STUMBLE_PACE : 1)

export const moveDashLane = (run, lane) => {
  const next = Math.max(0, Math.min(2, Math.round(Number(lane) || 0)))
  if (next === run.lane) return false
  run.lane = next
  run.laneSince = run.elapsed
  return true
}

const emit = (run, event) => { run.events.push(event) }

const setFeedback = (run, feedback) => {
  run.feedbackId += 1
  run.feedback = { ...feedback, id: run.feedbackId, until: run.elapsed + FEEDBACK_SECONDS }
}

// The shield absorbs a hit; otherwise hearts are lost and zero hearts ends the run.
const takeHit = (run, damage = 1) => {
  if (run.shield) {
    run.shield = false
    return true
  }
  run.hp = Math.max(0, run.hp - damage)
  run.hurt += 1
  if (run.hp <= 0) { run.over = true; run.reason = 'lives' }
  return false
}

const heal = (run) => { run.hp = Math.min(DASH_MAX_HP, run.hp + 1) }

const noteMistake = (run) => {
  run.stageMistakes[getDashStage(run.elapsed)] += 1
  run.streak = 0
  run.stumble = STUMBLE_SECONDS
  run.assist = Math.min(DASH_ASSIST_MAX, run.assist + 1)
  run.calm = 0
}

const gateLabels = (row) => [0, 1, 2].map((lane) => getDashChoiceLabel(row, lane))

const resolveGate = (run, row) => {
  run.gatesCleared += 1
  const { target } = row
  const missed = run.missedWords.find((item) => item.word === target.word)
  if (run.lane === row.correctLane) {
    run.wordsCompleted += 1
    const stage = getDashStage(run.elapsed)
    run.stageWords[stage] += 1
    run.streak += 1
    run.bestStreak = Math.max(run.bestStreak, run.streak)
    if (run.assist > 0 && run.elapsed - run.laneSince >= ASSIST_CALM) {
      run.calm += 1
      if (run.calm >= ASSIST_RECOVER) { run.assist -= 1; run.calm = 0 }
    }
    let points = scoreDashGate(run.streak)
    const redeemed = Boolean(row.retry && missed && !missed.redeemed)
    if (redeemed) {
      missed.redeemed = true
      run.redeemed += 1
      points += DASH_REDEEM_BONUS
    }
    run.score += points
    // Every few correct answers in a row heal a heart, so a good streak can undo an early slip.
    const healed = run.streak % DASH_HEAL_STREAK === 0 && run.hp < DASH_MAX_HP
    if (healed) heal(run)
    const chest = Boolean(row.chest)
    if (chest) run.chestCollected = true
    setFeedback(run, { title: target.word, detail: target.hint, good: true, points, tag: chest ? 'Treasure chest!' : redeemed ? 'Redeemed!' : healed ? 'Combo heal +1 heart' : null })
    emit(run, { type: 'correct', lane: run.lane, points, streak: run.streak, word: target.word, hint: target.hint, mode: row.mode, redeemed, healed, chest, labels: gateLabels(row), eliminated: row.eliminated ?? null })
    if (!run.stageCleared[stage] && run.stageWords[stage] >= run.goals[stage]) {
      run.stageCleared[stage] = true
      emit(run, { type: 'star', stage })
    }
    return
  }
  const chosenEntry = row.choices[run.lane]
  const attempts = (missed?.misses || 0) + 1
  const entry = {
    word: target.word, hint: target.hint, misses: attempts, redeemed: false,
    chosen: chosenEntry ? (row.mode === 'word' ? chosenEntry.hint : chosenEntry.word) : undefined,
  }
  run.missedWords = [...run.missedWords.filter((item) => item.word !== target.word), entry]
  run.retry = run.retry.filter((item) => item.word !== target.word)
  if (attempts <= MAX_RETRIES) run.retry.push({ word: target.word, dueAt: run.gateIndex + RETRY_DELAY })
  noteMistake(run)
  const shielded = takeHit(run, DASH_WORD_DAMAGE)
  setFeedback(run, { title: target.word, detail: target.hint, good: false, tag: shielded ? 'Shield saved you' : row.chest ? 'The chest slipped away' : null })
  emit(run, { type: 'wrong', lane: run.lane, word: target.word, hint: target.hint, shielded, mode: row.mode, labels: gateLabels(row), eliminated: row.eliminated ?? null })
}

const resolveObstacle = (run, row) => {
  if (row.blocked.includes(run.lane)) {
    noteMistake(run)
    const shielded = takeHit(run)
    setFeedback(run, { title: shielded ? 'Shield saved you' : 'Ouch!', detail: shielded ? 'The barrier broke it instead.' : 'Dodge the barriers.', good: shielded })
    emit(run, { type: 'hit', lane: run.lane, shielded, blocked: row.blocked })
    return
  }
  run.score += DASH_DODGE_BONUS
  run.dodges += 1
  emit(run, { type: 'dodge', lane: run.lane, points: DASH_DODGE_BONUS, blocked: row.blocked })
}

const resolvePickup = (run, row) => {
  if (run.lane !== row.lane) return
  if (row.kind === 'shield') {
    run.shield = true
    setFeedback(run, { title: 'Shield ready!', detail: 'Absorbs your next mistake.', good: true })
  } else if (row.kind === 'sniff') {
    const gate = run.rows.find((item) => item.type === 'gate' && item.eliminated == null)
    if (gate) sniffOut(gate)
    else run.sniffCharge = true
    setFeedback(run, { title: 'Sniff!', detail: gate ? 'One wrong gate is closed.' : 'The next gate loses a wrong answer.', good: true })
  } else if (row.kind === 'heart') {
    // A combo may have refilled the hearts since this pickup appeared: then it pays points instead.
    const full = run.hp >= DASH_MAX_HP
    if (full) run.score += 10
    else heal(run)
    setFeedback(run, full
      ? { title: '+10 points', detail: 'Your hearts are already full.', good: true }
      : { title: '+1 heart', detail: 'Feeling stronger.', good: true })
  } else {
    run.duration = Math.min(DASH_DURATION + DASH_MAX_BONUS_TIME, run.duration + DASH_CLOCK_BONUS)
    setFeedback(run, { title: `+${DASH_CLOCK_BONUS} seconds`, detail: 'More time to run.', good: true })
  }
  emit(run, { type: 'pickup', kind: row.kind, lane: row.lane })
}

// A sniffed gate closes one of its wrong lanes (never the right one).
const sniffOut = (gate) => {
  const wrong = [0, 1, 2].filter((lane) => lane !== gate.correctLane)
  gate.eliminated = wrong[gate.id % 2]
}

// The simulation owns collision/score state, independently of React's render rate.
export const resolveDashRow = (run, row = run.rows[0]) => {
  if (!row || !run.rows.includes(row)) return
  run.rows = run.rows.filter((item) => item !== row)
  if (row.type === 'gate') resolveGate(run, row)
  else if (row.type === 'obstacle') resolveObstacle(run, row)
  else resolvePickup(run, row)
  if (run.over) emit(run, { type: 'over', reason: run.reason })
}

// Every word appears once per shuffled deck; missed words come back a few gates later.
// A word waiting for its second chance is not drawn from the deck in the meantime.
const pickTarget = (run, words, random) => {
  const due = run.retry.findIndex((item) => run.gateIndex >= item.dueAt && item.word !== run.previousWord)
  if (due >= 0) {
    const [item] = run.retry.splice(due, 1)
    const entry = words.find((word) => word.word === item.word)
    if (entry) return { entry, retry: true }
  }
  const waiting = (word) => run.retry.some((item) => item.word === word)
  const draw = () => run.deck.findIndex((word) => word !== run.previousWord && !waiting(word))
  let index = draw()
  if (index < 0) {
    run.deck = shuffled(words.map((entry) => entry.word), random)
    index = draw()
    // Tiny banks: every other word may be waiting for a retry.
    if (index < 0) index = run.deck.findIndex((word) => word !== run.previousWord)
  }
  const [word] = run.deck.splice(index, 1)
  return { entry: words.find((entry) => entry.word === word) || words[0], retry: false }
}

// Pickups answer what the player needs most right now: hearts, then help after a mistake.
export const pickDashPickupKind = (run) => {
  if (run.hp < DASH_MAX_HP) return 'heart'
  if (run.stageMistakes[run.stage] > 0 && !run.sniffCharge) return 'sniff'
  if (!run.shield) return 'shield'
  if (run.duration < DASH_DURATION + DASH_MAX_BONUS_TIME) return 'clock'
  return 'sniff'
}

const spawnRow = (run, words, level, travel, random) => {
  const step = levelStep(level)
  const n = run.spawned + 1
  const canHazard = n >= 4 && n % 4 === 0 && run.elapsed + travel <= run.duration
  let row = null
  if (canHazard) {
    const kind = (n / 4) % 3 === 0 ? pickDashPickupKind(run) : null
    if (kind) {
      row = { type: 'pickup', kind, lane: Math.floor(random() * 3) }
    } else {
      const wide = step >= 2 || run.elapsed > 40
      const safe = Math.floor(random() * 3)
      const blocked = wide && random() < 0.5
        ? [0, 1, 2].filter((lane) => lane !== safe)
        : [Math.floor(random() * 3)]
      row = { type: 'obstacle', blocked }
    }
  } else {
    const progress = runProgress(run.elapsed)
    const reverse = (step >= 1 || run.elapsed > 20) && random() < 0.3 + step * 0.1
    const picked = pickTarget(run, words, random)
    const gate = createDashGate(words, { target: picked.entry, difficulty: Math.min(1, step * 0.2 + progress * 0.5), reverse }, random)
    if (!gate) return false
    run.gateIndex += 1
    run.previousWord = gate.target.word
    row = { ...gate, retry: picked.retry, chest: run.gateIndex === run.chestAt }
  }
  run.spawned = n
  run.rowId += 1
  const spawned = { ...row, id: run.rowId, progress: 0 }
  if (spawned.type === 'gate' && run.sniffCharge) {
    sniffOut(spawned)
    run.sniffCharge = false
  }
  run.rows.push(spawned)
  return true
}

// A stage that earned its star without a single mistake pays a bonus when it ends.
const finishStage = (run, stage) => {
  if (!run.stageCleared[stage] || run.stageMistakes[stage] > 0 || run.stageFlawless[stage]) return
  run.stageFlawless[stage] = true
  run.score += DASH_FLAWLESS_BONUS
  emit(run, { type: 'flawless', stage, points: DASH_FLAWLESS_BONUS })
}

export const advanceDashRun = (run, delta, words, level = 1, random = Math.random) => {
  if (run.over) return run
  const dt = Math.max(0, delta)
  run.elapsed += dt
  if (run.feedback && run.feedback.until <= run.elapsed) run.feedback = null
  const stage = getDashStage(run.elapsed)
  if (stage !== run.stage) {
    for (let finished = run.stage; finished < stage; finished++) finishStage(run, finished)
    run.stage = stage
    emit(run, { type: 'stage', stage })
  }
  // The pace eases toward its new notch instead of jumping.
  const easing = ASSIST_EASE * dt
  run.assistVis = run.assist > run.assistVis
    ? Math.min(run.assist, run.assistVis + easing)
    : Math.max(run.assist, run.assistVis - easing)
  const travel = getDashTravelTime(getDashRunSpeed(run, level))
  const moved = dt * getDashPace(run)
  run.stumble = Math.max(0, run.stumble - dt)
  run.distance += moved * 6 * (4.2 / travel)
  for (const row of run.rows) row.progress += moved / travel
  while (run.rows.length && run.rows[0].progress >= 1) {
    resolveDashRow(run, run.rows[0])
    if (run.over) return run
  }
  if (run.elapsed < run.duration && run.rows.length < MAX_ROWS) {
    const last = run.rows[run.rows.length - 1]
    // Gates are spaced by the current speed, so a slower road also leaves more time for each word.
    const gap = last && (last.type === 'gate' ? getDashGateCycle(travel) : HAZARD_CYCLE)
    const ready = last ? last.progress >= gap / travel : run.elapsed >= run.nextSpawn
    if (ready) spawnRow(run, words, level, travel, random)
  }
  // Rows already on the road finish after the clock hits zero, so no word is wasted.
  if (!run.over && run.elapsed >= run.duration && (run.rows.length === 0 || run.elapsed >= run.duration + SAFETY_OVERTIME)) {
    finishStage(run, run.stage)
    run.over = true
    run.reason = 'time'
    emit(run, { type: 'over', reason: 'time' })
  }
  return run
}

const clueOf = (gate) => (gate.mode === 'word' ? gate.target.word : gate.target.hint)
// Pictures only go with meaning clues (FIND THE WORD).
const imageOf = (gate) => (gate.mode !== 'word' && typeof gate.target.image_url === 'string' ? gate.target.image_url : null)

export const getDashPrompt = (run) => {
  const gates = run.rows.filter((row) => row.type === 'gate')
  const gate = gates[0]
  const front = run.rows[0]
  const alert = front && front.type !== 'gate' ? (front.type === 'obstacle' ? 'dodge' : 'grab') : null
  if (!gate) {
    return { id: 0, kind: alert || 'idle', label: alert === 'dodge' ? 'CHANGE LANES' : alert === 'grab' ? 'BONUS PICKUP' : 'ON THE TRAIL', text: alert === 'dodge' ? 'Dodge the barrier!' : alert === 'grab' ? 'Grab the bonus!' : run.gatesCleared === 0 ? 'Get ready for the first word…' : 'Keep running…', image: null, retry: false, alert: null, sniffed: false, chest: false, next: null }
  }
  const reverse = gate.mode === 'word'
  return {
    id: gate.id,
    kind: 'gate',
    label: gate.retry ? 'SECOND CHANCE' : reverse ? 'FIND THE MEANING' : 'FIND THE WORD',
    text: clueOf(gate),
    image: imageOf(gate),
    retry: Boolean(gate.retry),
    alert,
    sniffed: gate.eliminated != null,
    chest: Boolean(gate.chest),
    next: gates[1] ? { id: gates[1].id, text: clueOf(gates[1]), mode: gates[1].mode, image: imageOf(gates[1]) } : null,
  }
}

export const summarizeDashRun = (run) => {
  const attempted = run.wordsCompleted + run.missedWords.reduce((sum, word) => sum + word.misses, 0)
  const timeBonus = getDashTimeBonus(run)
  const heartBonus = getDashHeartBonus(run)
  return {
    score: run.score + timeBonus + heartBonus,
    baseScore: run.score,
    timeBonus,
    heartBonus,
    stars: getDashStars(run),
    stages: run.goals.map((goal, i) => ({ goal, words: run.stageWords[i], cleared: run.stageCleared[i], flawless: run.stageFlawless[i] })),
    wordsCompleted: run.wordsCompleted,
    bestStreak: run.bestStreak,
    distance: Math.floor(run.distance),
    accuracy: attempted > 0 ? Math.round(run.wordsCompleted / attempted * 100) : 0,
    redeemed: run.redeemed,
    chestCollected: run.chestCollected,
    dodges: run.dodges,
    hp: run.hp,
    reason: run.reason,
    missed: run.missedWords.filter((word) => !word.redeemed),
    mastered: run.missedWords.filter((word) => word.redeemed),
  }
}
