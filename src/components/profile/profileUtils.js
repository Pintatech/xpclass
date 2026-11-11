// Profile page (/profile): constants and pure helpers. No React in this file.

// Badge tiers of student_levels.badge_tier. Every class string is written out in full so Tailwind keeps it.
export const TIERS = {
  bronze: {
    label: 'Bronze',
    plate: 'from-orange-100 to-amber-200', ring: 'ring-orange-300', solid: 'from-orange-300 to-amber-500', text: 'text-orange-700',
  },
  silver: {
    label: 'Silver',
    plate: 'from-slate-100 to-slate-300', ring: 'ring-slate-300', solid: 'from-slate-200 to-slate-400', text: 'text-slate-600',
  },
  gold: {
    label: 'Gold',
    plate: 'from-yellow-100 to-amber-300', ring: 'ring-amber-400', solid: 'from-yellow-300 to-amber-500', text: 'text-amber-700',
  },
  platinum: {
    label: 'Platinum',
    plate: 'from-violet-100 to-purple-300', ring: 'ring-violet-400', solid: 'from-violet-300 to-purple-500', text: 'text-violet-700',
  },
  diamond: {
    label: 'Diamond',
    plate: 'from-cyan-100 to-sky-300', ring: 'ring-cyan-400', solid: 'from-cyan-300 to-sky-500', text: 'text-cyan-700',
  },
}

export const tierKey = (level) => (level && TIERS[level.badge_tier] ? level.badge_tier : null)

// How far the road is filled between the last earned level and the next one (0..1).
export const roadFraction = (xp, current, next) => {
  if (!current || !next) return 0
  const range = next.xp_required - current.xp_required
  if (!(range > 0)) return 0
  return Math.min(1, Math.max(0, (xp - current.xp_required) / range))
}

export const fmt = (n) => (Number(n) || 0).toLocaleString('vi-VN')

// A badge icon is a picture link or an emoji typed by the admin.
export const isImageLike = (icon) =>
  typeof icon === 'string' && (/^(https?:|data:|blob:|\/)/i.test(icon) || /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(icon))

// Daily challenge medals show how many times they were won (the counts belong to the logged-in student).
export const winCountFor = (achievement, challengeWinCounts) => {
  if (!achievement.criteria_type?.startsWith('daily_challenge_rank_')) return 0
  const match = achievement.criteria_type.match(/rank_(\d)/)
  if (match) return (challengeWinCounts || {})[`rank_${match[1]}`] || 0
  return 0
}

export const hasReward = (a) => a.xp_reward > 0 || a.gem_reward > 0

// Same words as the old button: "Nhận 100 XP + 10 💎". Read by screen readers and shown as the tooltip.
export const rewardLabel = (a) =>
  `Nhận ${[a.xp_reward > 0 ? `${a.xp_reward} XP` : null, a.gem_reward > 0 ? `${a.gem_reward} 💎` : null].filter(Boolean).join(' + ')}`

// Rewards waiting to be collected come first; everything else keeps its order.
export const claimableFirst = (list, canClaim) => {
  if (!canClaim) return list
  const waiting = list.filter((a) => !a.isClaimed && hasReward(a))
  if (waiting.length === 0 || waiting.length === list.length) return list
  return [...waiting, ...list.filter((a) => a.isClaimed || !hasReward(a))]
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
