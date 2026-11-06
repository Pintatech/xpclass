// +10 XP for the winner of an async PvP challenge, paid once per challenge.
//
// The winner is often the other player (the challenger wins when the responder loses or declines). Since
// migrations/lock_currency_rpcs.sql only lets a student change their own XP, the award goes through
// award_pvp_win, which checks that the caller played this challenge and pays its winner once. Before that SQL
// runs, the function is missing and the old direct award is used. Like the old code, it never throws: a failed
// award must not break the results screen.
export async function awardPvpWin(client, challengeId, winnerId) {
  try {
    const { error } = await client.rpc('award_pvp_win', { p_challenge_id: challengeId });
    if (!error) return true;
    if (error.code !== 'PGRST202') throw error; // PGRST202: award_pvp_win does not exist yet
    const fallback = await client.rpc('increment_user_currency', { p_user_id: winnerId, p_xp: 10, p_gems: 0 });
    if (fallback.error) throw fallback.error;
    return true;
  } catch (error) {
    console.error('PvP win award failed', error);
    return false;
  }
}
