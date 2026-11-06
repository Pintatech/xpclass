// Score helpers for ending a mini-game competition (admin Leaderboard Settings → End & Award).
// They take the Supabase client as an argument so they can be checked outside the app.

const PAGE = 1000; // Supabase returns at most 1000 rows per select
const MAX_PAGES = 50;

/**
 * Every student's best score in a game, best first, as [userId, score] pairs.
 * Only students (role 'user') with a real score count, the same players the competition leaderboard shows:
 * a 0 is an attempt that was opened and never finished. Pages past the 1000-row limit, so nobody above the
 * reward threshold is missed.
 */
export async function fetchCompetitionBests(client, gameType) {
  const best = new Map();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await client
      .from('training_scores')
      .select('user_id, score, users!inner()')
      .eq('game_type', gameType)
      .eq('users.role', 'user')
      .gt('score', 0)
      .order('score', { ascending: false })
      .order('id', { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    for (const row of data || []) {
      if (row.user_id && !best.has(row.user_id)) best.set(row.user_id, row.score);
    }
    if ((data || []).length < PAGE) break;
  }
  return [...best.entries()];
}

/**
 * Deletes every training_scores row of the game and returns how many went. Throws when nothing could be deleted.
 *
 * RLS does not let the browser delete other students' rows: a plain delete "succeeds" with 0 rows, which is why
 * the scores used to stay until someone cleared them in Supabase. The clear_competition_scores function
 * (migrations/add_clear_competition_scores_rpc.sql) deletes them for admins. Until that SQL is run, this falls
 * back to the plain delete and reports when the rows are still there.
 * training_records (all-time records) is not touched.
 */
export async function clearCompetitionScores(client, gameType) {
  if (!gameType) throw new Error('No competition game to clear.');
  const { data, error } = await client.rpc('clear_competition_scores', { p_game_type: gameType });
  if (!error) return Number(data) || 0;
  if (error.code !== 'PGRST202') throw error; // PGRST202: the function does not exist yet

  const { data: deleted, error: deleteError } = await client
    .from('training_scores')
    .delete()
    .eq('game_type', gameType)
    .select('id');
  if (deleteError) throw deleteError;
  if (deleted?.length) return deleted.length;

  const { count, error: countError } = await client
    .from('training_scores')
    .select('id', { count: 'exact', head: true })
    .eq('game_type', gameType);
  if (countError) throw countError;
  if (count > 0) {
    throw new Error(`The database did not allow deleting the ${count} scores. Run src/supabase/migrations/add_clear_competition_scores_rpc.sql in Supabase, then try again.`);
  }
  return 0;
}
