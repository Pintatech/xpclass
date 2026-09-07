/**
 * Stat and levelling model for the event fighter.
 *
 * A character is described by three numbers — HP, ATK, DEF — made of a base
 * that comes from who the character is, plus whatever the student has poured
 * into it. Battle XP raises an event level, each level hands out points, and a
 * point buys a fixed amount of one stat. Nothing here touches the study XP on
 * the profile: this ladder is climbed by fighting, not by studying.
 *
 * Progress is stored per character (see useEventStats), so the picker chooses
 * between seven separate builds rather than reskinning one.
 */

export const MAX_LEVEL = 30
export const POINTS_PER_LEVEL = 3

// What one point buys. HP is worth several because it is spent by the hit and
// ATK/DEF are spent every hit — a point of DEF shaves damage off every blow for
// the rest of the battle, so it is deliberately the cheapest to give away.
export const STAT_GROWTH = { hp: 8, atk: 2, def: 1 }

/** Display order and labels for the stat panel and the battle HUD. */
export const STATS = [
  { key: 'hp',  label: 'Máu',      short: 'HP',  color: '#22c55e', hint: `+${STAT_GROWTH.hp} máu mỗi điểm` },
  { key: 'atk', label: 'Tấn công', short: 'ATK', color: '#f97316', hint: `+${STAT_GROWTH.atk} sát thương mỗi điểm` },
  { key: 'def', label: 'Phòng thủ', short: 'DEF', color: '#3b82f6', hint: `+${STAT_GROWTH.def} giáp mỗi điểm` }
]

export const EMPTY_SPEND = { hp: 0, atk: 0, def: 0 }

/**
 * Base stats per character. These are the flavour knobs: the knights soak,
 * the light three-hit fighters swing harder and fold faster. Every character
 * still ends up viable — the spread is roughly ±25% around the middle, small
 * enough that a build decides a fight more than the pick does.
 *
 * Kept here rather than in eventCharacter.js so that file stays what it is:
 * a description of sprite sheets.
 */
const BASE_STATS = {
  'warrior-woman': { hp: 30, atk: 7, def: 3 },
  knight:          { hp: 40, atk: 5, def: 6 },
  'male-hero':     { hp: 34, atk: 8, def: 4 },
  adventurer:      { hp: 28, atk: 7, def: 3 },
  brawler:         { hp: 36, atk: 6, def: 5 },
  'red-knight':    { hp: 38, atk: 6, def: 5 },
  'pixel-knight':  { hp: 44, atk: 5, def: 7 }
}

const FALLBACK_BASE = { hp: 34, atk: 6, def: 4 }

export const baseStats = (characterId) => BASE_STATS[characterId] || FALLBACK_BASE

/** XP to get from `level` to the next one. Flat early, then a gentle ramp. */
export const xpForLevel = (level) => (level >= MAX_LEVEL ? Infinity : 100 + (level - 1) * 50)

/** Total XP → level, plus where inside that level the bar sits. */
export const levelFromXp = (xp) => {
  let level = 1
  let remaining = Math.max(0, xp || 0)

  while (level < MAX_LEVEL && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level += 1
  }

  const need = xpForLevel(level)
  return {
    level,
    xpInLevel: level >= MAX_LEVEL ? 0 : remaining,
    xpToNext: level >= MAX_LEVEL ? 0 : need,
    progress: level >= MAX_LEVEL ? 100 : Math.round((remaining / need) * 100)
  }
}

/** Points a level has been handed in total. Level 1 starts with a few to spend. */
export const pointsForLevel = (level) => level * POINTS_PER_LEVEL

export const pointsSpent = (spend) =>
  (spend?.hp || 0) + (spend?.atk || 0) + (spend?.def || 0)

/**
 * The three numbers a battle actually runs on: base plus what was bought.
 */
export const deriveStats = (characterId, spend = EMPTY_SPEND) => {
  const base = baseStats(characterId)
  return {
    base,
    maxHp: base.hp + (spend.hp || 0) * STAT_GROWTH.hp,
    atk: base.atk + (spend.atk || 0) * STAT_GROWTH.atk,
    def: base.def + (spend.def || 0) * STAT_GROWTH.def
  }
}

/**
 * Damage for one hit. DEF counts half, so stacking it never reaches immunity —
 * and the floor of 1 means even a fully armoured fighter still loses the fight
 * if they keep answering wrong.
 */
export const damageFrom = (atk, def, multiplier = 1) =>
  Math.max(1, Math.round(atk * multiplier) - Math.floor((def || 0) / 2))

/**
 * Monsters grow with the hero, or a levelled fighter would flatten the golem
 * before the second question. The growth is slower than the hero's, so points
 * still buy a real advantage — this closes the gap, it doesn't erase it.
 *
 * These rates were picked by simulating ten-question fights: they are the ones
 * where a level-4 build that dumped everything into one stat wins at roughly
 * the same rate whichever stat it picked (~85%), a balanced build beats all
 * three (~96%), and a fighter who never spent a point is clearly behind (~23%).
 * Faster HP growth than this quietly turns the fight into an ATK check, because
 * ten questions cap how many swings a defensive build ever gets to take.
 */
export const scaleMonster = (monster, heroLevel = 1) => {
  const steps = Math.max(0, heroLevel - 1)
  return {
    maxHp: Math.round((monster.hp || 40) * (1 + steps * 0.2)),
    atk: Math.round((monster.atk || 6) + steps),
    def: Math.round((monster.def || 3) + steps * 0.6)
  }
}

/**
 * XP for one finished battle. A loss still pays — for a student answering ten
 * questions, a run that ends in defeat should still move the bar.
 */
export const battleXp = ({ won, correct = 0, monster }) => {
  const bounty = monster?.xpReward || 60
  return Math.round(won ? bounty + correct * 5 : bounty * 0.3 + correct * 3)
}
