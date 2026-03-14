import { supabase } from '../supabase/client'

/**
 * Fetch PvP schedule settings from site_settings.
 * Returns { pvpEnabled, pvpStartTime, pvpEndTime }
 */
export async function fetchPvpSchedule() {
  const { data } = await supabase
    .from('site_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['pvp_enabled', 'pvp_start_time', 'pvp_end_time'])

  const settings = {}
  data?.forEach((row) => {
    settings[row.setting_key] = row.setting_value
  })

  return {
    pvpEnabled: settings.pvp_enabled !== 'false', // default true if not set
    pvpStartTime: settings.pvp_start_time || '', // e.g. "08:00"
    pvpEndTime: settings.pvp_end_time || '',     // e.g. "15:00"
  }
}

/**
 * Check if PvP is currently available based on schedule settings.
 * Returns { available: boolean, reason: string }
 */
export function checkPvpAvailability({ pvpEnabled, pvpStartTime, pvpEndTime }) {
  if (!pvpEnabled) {
    return { available: false, reason: 'PvP is currently disabled.' }
  }

  if (pvpStartTime && pvpEndTime) {
    const now = new Date()
    const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
    const currentMinutes = vnTime.getHours() * 60 + vnTime.getMinutes()
    const [startH, startM] = pvpStartTime.split(':').map(Number)
    const [endH, endM] = pvpEndTime.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
      return {
        available: false,
        reason: `PvP is only available from ${pvpStartTime} to ${pvpEndTime}.`,
      }
    }
  }

  return { available: true, reason: '' }
}
