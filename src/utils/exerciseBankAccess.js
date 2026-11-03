import { supabase } from '../supabase/client'

// "Not found" codes for a table, view or function (the SQL migration has not been run yet)
const MISSING_CODES = ['PGRST202', 'PGRST205', '42P01', '42883']
const isMissing = (error) => MISSING_CODES.includes(error?.code)

/**
 * Exercise Bank folders the current user may open, as a Set of folder ids.
 * Returns null when nothing is restricted: admins, lock not turned on, or SQL not run yet.
 */
export const fetchOpenableFolderIds = async () => {
  const { data, error } = await supabase.rpc('my_exercise_folder_access')
  if (error) {
    if (!isMissing(error)) console.error('Error fetching folder access:', error)
    return null
  }
  return Array.isArray(data) ? new Set(data) : null
}

// Before the SQL is run: read the folder of every active bank exercise, 1000 rows per page
const countFoldersInBrowser = async () => {
  const totals = new Map()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('exercises')
      .select('folder_id')
      .eq('is_in_bank', true)
      .eq('is_active', true)
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    data.forEach(({ folder_id }) => totals.set(folder_id, (totals.get(folder_id) || 0) + 1))
    if (data.length < 1000) break
  }
  return [...totals].map(([folder_id, total]) => ({ folder_id, total }))
}

/**
 * Active bank exercises per folder id, plus 'all' for the total. One request.
 */
export const fetchFolderExerciseCounts = async () => {
  const { data, error } = await supabase.rpc('exercise_bank_folder_counts')
  if (error && !isMissing(error)) console.error('Error counting exercises:', error)
  const rows = error ? await countFoldersInBrowser() : data

  const counts = { all: 0 }
  rows.forEach(({ folder_id, total }) => {
    counts.all += Number(total)
    if (folder_id) counts[folder_id] = Number(total)
  })
  return counts
}

let bankViewMissing = false

/**
 * Runs an Exercise Bank list query on the exercise_bank_visible view, which leaves out
 * exercises in folders the user may not open. Uses the exercises table until the SQL is run.
 * buildQuery gets the table to select from and returns the query.
 */
export const queryBankExercises = async (buildQuery) => {
  if (!bankViewMissing) {
    const result = await buildQuery(supabase.from('exercise_bank_visible'))
    if (!isMissing(result.error)) return result
    bankViewMissing = true
  }
  return buildQuery(supabase.from('exercises'))
}
