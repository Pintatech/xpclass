import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase/client';
import { useAuth } from './useAuth';

// Leaderboard and records of one training game, for the screen before a run.
// - The weekly board reads training_scores like the other leaderboards: students only (role 'user'), each
//   student's best run since Monday 00:00 Vietnam time.
// - All-time records read training_records (migrations/add_training_records.sql). training_scores cannot keep
//   them: the daily cron drops rows older than 10 days and ending a competition clears the game's rows.
//   Until that SQL is run the table is missing, and the records fall back to this week's numbers.

const PAGE = 1000; // Supabase returns at most 1000 rows per select
const MAX_WEEK_PAGES = 3;
export const BOARD_SIZE = 10;
const DAY_MS = 86400000;
// Table not created yet (PGRST205), or no foreign key to users for the join (PGRST200).
const MISSING_TABLE = new Set(['PGRST205', 'PGRST200', '42P01']);
// Last result per player and game: the board shows it at once on the next open while it refreshes.
const cache = new Map();

// A saved run makes the cached board out of date (new best, new rank): the next open loads it fresh.
export const forgetTrainingRecords = gameType => {
  for (const key of [...cache.keys()]) {
    if (key.endsWith(`:${gameType}`)) cache.delete(key);
  }
};

// Monday 00:00 in Vietnam, when the weekly boards and competitions reset, and the next Monday.
export const getVietnamWeek = (now = Date.now()) => {
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const [y, m, d] = today.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  const sinceMonday = (new Date(base).getUTCDay() + 6) % 7;
  const day = offset => new Date(base + offset * DAY_MS).toISOString().slice(0, 10);
  return {
    start: `${day(-sinceMonday)}T00:00:00+07:00`,
    resetsAt: Date.parse(`${day(7 - sinceMonday)}T00:00:00+07:00`),
  };
};

const nameOf = user => user?.full_name?.trim() || user?.username?.trim() || 'Student';

// Competition ranking: equal scores share a rank (1, 2, 2, 4). The list is sorted best first.
const withRanks = list => {
  let rank = 0;
  return list.map((entry, i) => {
    if (i === 0 || entry.score < list[i - 1].score) rank = i + 1;
    return { ...entry, rank };
  });
};

// Every student's best run this week, best first; ties go to whoever got there first.
// Rows are sorted by score, so the first ~1000 rows already hold the top players. Paging only matters for the
// rank of someone far down a very busy week; `complete` says whether every row was read.
async function fetchWeekLadder(client, gameType, since) {
  const best = new Map();
  let complete = false;
  for (let page = 0; page < MAX_WEEK_PAGES && !complete; page += 1) {
    const { data, error } = await client
      .from('training_scores')
      .select('user_id, score, played_at, users!inner()')
      .eq('game_type', gameType)
      .eq('users.role', 'user')
      .gt('score', 0)
      .gte('played_at', since)
      .order('score', { ascending: false })
      .order('played_at', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    for (const row of data || []) {
      if (row.user_id && !best.has(row.user_id)) best.set(row.user_id, { id: row.user_id, score: row.score, at: row.played_at });
    }
    complete = (data || []).length < PAGE;
  }
  return { ladder: withRanks([...best.values()]), complete };
}

// The player's own best this week, whatever their role: staff runs are not on the board but still count for them.
async function fetchOwnWeekBest(client, gameType, uid, since) {
  const { data, error } = await client
    .from('training_scores')
    .select('score, played_at')
    .eq('user_id', uid)
    .eq('game_type', gameType)
    .gt('score', 0)
    .gte('played_at', since)
    .order('score', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ? { score: data[0].score, at: data[0].played_at } : null;
}

// null while training_records does not exist yet.
async function fetchAllTime(client, gameType, uid, ranked) {
  const [top, own] = await Promise.all([
    client
      .from('training_records')
      .select('user_id, best_score, best_at, user:users!inner(full_name, username, avatar_url)', { count: 'exact' })
      .eq('game_type', gameType)
      .eq('user.role', 'user')
      .gt('best_score', 0)
      .order('best_score', { ascending: false })
      .order('best_at', { ascending: true })
      .limit(BOARD_SIZE),
    client
      .from('training_records')
      .select('best_score, best_at, runs')
      .eq('user_id', uid)
      .eq('game_type', gameType)
      .maybeSingle(),
  ]);
  if (top.error && MISSING_TABLE.has(top.error.code)) return null;
  if (top.error) throw top.error;
  if (own.error) throw own.error;

  const entries = withRanks((top.data || []).map(row => ({
    id: row.user_id,
    score: row.best_score,
    at: row.best_at,
    name: nameOf(row.user),
    avatar: row.user?.avatar_url || null,
  })));
  const mine = own.data?.best_score > 0 ? { score: own.data.best_score, at: own.data.best_at, runs: own.data.runs || 0 } : null;
  let myRank = entries.find(entry => entry.id === uid)?.rank ?? null;
  if (ranked && mine && myRank == null) {
    const above = await client
      .from('training_records')
      .select('user_id, users!inner()', { count: 'exact', head: true })
      .eq('game_type', gameType)
      .eq('users.role', 'user')
      .gt('best_score', mine.score);
    if (above.error) throw above.error;
    myRank = (above.count ?? 0) + 1;
  }
  return { entries, total: top.count ?? entries.length, mine, myRank };
}

async function fetchProfiles(client, ids) {
  const profiles = new Map();
  if (!ids.length) return profiles;
  const { data, error } = await client.from('users').select('id, full_name, username, avatar_url').in('id', ids);
  if (error) throw error;
  for (const user of data || []) profiles.set(user.id, { name: nameOf(user), avatar: user.avatar_url || null });
  return profiles;
}

/**
 * Loads the weekly board, the all-time records and where the player stands. Takes the client so it can be
 * checked outside React.
 * Scores are the saved ones, which include the level bonus that PetDisplay adds to each run.
 */
export async function loadTrainingBoard(client, { gameType, uid, role = 'user', name = 'You', avatar = null, now = Date.now() }) {
  const week = getVietnamWeek(now);
  // Only students are ranked, as on the main leaderboard. Teachers and admins see the board and their own best.
  const ranked = role === 'user';
  const [{ ladder, complete }, ownWeek, allTime] = await Promise.all([
    fetchWeekLadder(client, gameType, week.start),
    fetchOwnWeekBest(client, gameType, uid, week.start),
    // The weekly board does not depend on the records table: if it fails, the board still shows.
    fetchAllTime(client, gameType, uid, ranked).catch(error => {
      console.warn('training records unavailable', error);
      return null;
    }),
  ]);

  const mineThisWeek = ranked ? ladder.find(entry => entry.id === uid) : null;
  const weekBest = mineThisWeek?.score ?? ownWeek?.score ?? null;
  let weekRank = mineThisWeek?.rank ?? null;
  if (ranked && weekRank == null && weekBest != null && complete) {
    weekRank = 1 + ladder.filter(entry => entry.score > weekBest).length;
  }

  // The score to beat: the closest player above this week's best, or the last one on the board before a first
  // run, the same order the in-run rival bar climbs. Staff see who leads.
  let target = null;
  if (!ranked) target = ladder[0] ?? null;
  else if (weekBest == null) target = ladder[ladder.length - 1] ?? null;
  else if (weekRank !== 1) target = ladder.filter(entry => entry.score > weekBest && entry.id !== uid).pop() ?? null;
  const runnerUp = weekRank === 1 ? ladder.find(entry => entry.id !== uid) : null;

  const top = ladder.slice(0, BOARD_SIZE);
  const profiles = await fetchProfiles(client, [...new Set([...top.map(entry => entry.id), target?.id].filter(id => id && id !== uid))]);
  const me = { name, avatar };
  const dress = entry => entry && {
    ...entry,
    ...(entry.id === uid ? me : profiles.get(entry.id) ?? { name: 'Student', avatar: null }),
    isMe: entry.id === uid,
  };

  const weekEntries = top.map(dress);
  const weekBoard = {
    entries: weekEntries,
    me: ranked && weekBest != null ? { id: uid, rank: weekRank, score: weekBest, ...me, isMe: true } : null,
    total: ladder.length,
    complete,
    target: dress(target),
    lead: runnerUp ? Math.max(0, weekBest - runnerUp.score) : null,
    top: weekEntries[0] ?? null,
    resetsAt: week.resetsAt,
  };

  let allTimeBoard = null;
  if (allTime) {
    const entries = allTime.entries.map(entry => (entry.id === uid ? { ...entry, ...me, isMe: true } : { ...entry, isMe: false }));
    allTimeBoard = {
      entries,
      me: ranked && allTime.mine ? { id: uid, rank: allTime.myRank, score: allTime.mine.score, ...me, isMe: true } : null,
      total: allTime.total,
    };
  }

  // The trigger keeps a record at least as high as every saved run. If the week is somehow ahead, show the week.
  const allBest = allTime?.mine?.score ?? null;
  let best = null;
  if (allBest != null && (weekBest == null || allBest >= weekBest)) {
    best = { score: allBest, at: allTime.mine.at, runs: allTime.mine.runs, rank: ranked ? allTime.myRank : null, scope: 'all' };
  } else if (weekBest != null) {
    best = { score: weekBest, rank: ranked ? weekRank : null, scope: 'week' };
  }

  const recordHolder = allTimeBoard?.entries[0] ?? weekEntries[0] ?? null;
  return {
    ranked,
    week: weekBoard,
    allTime: allTimeBoard,
    best,
    record: recordHolder && { ...recordHolder, scope: allTimeBoard ? 'all' : 'week' },
    // Never finished a run, as far as the data goes: the board opens on How to play.
    newPlayer: best == null && !allTime?.mine,
    loadedAt: now,
  };
}

/**
 * { status: 'idle' | 'loading' | 'ready' | 'error', data, reload } for the current player.
 * A board loaded earlier in the session shows at once and refreshes in the background.
 */
export function useTrainingRecords(gameType, { enabled = true } = {}) {
  const { user, profile } = useAuth();
  const uid = user?.id;
  const key = enabled && uid && gameType ? `${uid}:${gameType}` : null;
  const [state, setState] = useState(() => {
    const cached = key ? cache.get(key) : null;
    if (cached) return { status: 'ready', data: cached };
    return { status: key ? 'loading' : 'idle', data: null };
  });
  const requestRef = useRef(0);
  const role = profile?.role ?? 'user';
  const name = profile?.full_name?.trim() || profile?.username || 'You';
  const avatar = profile?.avatar_url || null;

  const reload = useCallback(async () => {
    if (!key) return;
    const request = ++requestRef.current;
    setState(previous => (previous.data ? previous : { status: 'loading', data: null }));
    try {
      const data = await loadTrainingBoard(supabase, { gameType, uid, role, name, avatar });
      cache.set(key, data);
      if (requestRef.current === request) setState({ status: 'ready', data });
    } catch (error) {
      console.error('training board failed', error);
      // A failed refresh keeps the board that is already showing.
      if (requestRef.current === request) setState(previous => (previous.data ? previous : { status: 'error', data: null }));
    }
  }, [key, gameType, uid, role, name, avatar]);

  useEffect(() => {
    reload();
    return () => { requestRef.current += 1; };
  }, [reload]);

  return { status: state.status, data: state.data, reload };
}
