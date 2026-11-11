// A student's level from their XP and the student_levels rows (is_active ones). One set of rules for the whole app:
// useStudentLevels uses it for the logged-in student, the profile page for any student.
//
// current: highest level whose xp_required the XP has reached (the first level when none is reached yet).
// next: the level after current by level_number. Levels an admin switched off are not in the list, so the next
// one is the nearest higher level_number, not level_number + 1 (with +1, a switched-off level showed "Max").
export const levelInfoFor = (userXp, levels) => {
  const list = levels || []
  if (list.length === 0) return { current: null, next: null, xpNeeded: 0, percent: 0, isMax: true }

  const current = list
    .filter((l) => userXp >= l.xp_required)
    .reduce((best, l) => (!best || l.level_number > best.level_number ? l : best), null)

  if (!current) {
    return { current: list[0], next: list[1] || null, xpNeeded: list[1]?.xp_required || 0, percent: 0, isMax: !list[1] }
  }

  const next = list
    .filter((l) => l.level_number > current.level_number)
    .reduce((best, l) => (!best || l.level_number < best.level_number ? l : best), null)
  if (!next) return { current, next: null, xpNeeded: 0, percent: 100, isMax: true }

  const range = next.xp_required - current.xp_required
  const percent = range > 0 ? Math.round(((userXp - current.xp_required) / range) * 100) : 100
  return {
    current,
    next,
    xpNeeded: Math.max(0, next.xp_required - userXp),
    percent: Math.min(100, Math.max(0, percent)),
    isMax: false,
  }
}
