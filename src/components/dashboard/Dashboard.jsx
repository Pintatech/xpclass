import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabase/client'
import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getRecentExercise } from '../../utils/recentExercise'
import RecentActivities from './RecentActivities'
import TournamentWidget from './TournamentWidget'
import AvatarWithFrame from '../ui/AvatarWithFrame'
import PetDisplay from '../pet/PetDisplay'
import EventCharacter from '../event/EventCharacter'
import EventCharacterPicker from '../event/EventCharacterPicker'
import EventShop from '../event/EventShop'
import EventCrafting from '../event/EventCrafting'
import { EVENT_ENABLED, animationSrc } from '../../config/eventCharacter'
import { preloadSheets } from '../ui/spriteSheetCache'
import { useEventCharacter } from '../../hooks/useEventCharacter'
import { useEventLadder } from '../../hooks/useEventLadder'
import HeroCarousel from './HeroCarousel'
import { useCarouselPanel } from './panelContext'
import { MAX_LEVEL, levelFromClears, roundSizeFor, stageFor, stageMonster, stageQuestionTypes } from '../../config/eventLadder'
import { STORY_MIN_LEVEL } from '../../config/eventQuestions'
import { monsterBackground, monsterIntro, monsterMusic } from '../../config/eventMonsters'
import EventBattle from '../event/EventBattle'
import EventCutscene from '../event/EventCutscene'
import EventStatsPanel from '../event/EventStatsPanel'
import PvPChallengeModal from '../pvp/PvPChallengeModal'
import { FEATURES } from '../../config/features'
import { fetchPvpSchedule, checkPvpAvailability } from '../../utils/pvpSchedule'

import { assetUrl, useBranding } from '../../hooks/useBranding';
import { usePermissions } from '../../hooks/usePermissions';
import { useInventory } from '../../hooks/useInventory';
import { CheckCircle, Clock, XCircle, ChevronDown, Hammer, Lock, ShoppingBag, Users } from 'lucide-react';

// Collapsible student exercise stats for latest session — only fetches on first open
const CourseStatsSection = ({ courseId }) => {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [latestSession, setLatestSession] = useState(null);
  const [studentList, setStudentList] = useState([]);
  const [totalEx, setTotalEx] = useState(0);

  const handleToggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (loaded) return;

    setLoading(true);
    try {
      // 1. Get units
      const { data: units } = await supabase
        .from('units').select('id').eq('course_id', courseId);
      if (!units?.length) { setLoading(false); return; }

      // 2. Get all active non-test sessions (sorted by session_number desc)
      const { data: allSessions } = await supabase
        .from('sessions')
        .select('id, title, session_number, assigned_student_id')
        .in('unit_id', units.map(u => u.id))
        .eq('is_active', true)
        .neq('is_test', true)
        .order('session_number', { ascending: false });
      if (!allSessions?.length) { setLoading(false); return; }

      // Latest shared (non-personal) session
      const latestShared = allSessions.find(s => !s.assigned_student_id);
      setLatestSession(latestShared || allSessions[0]);

      // Latest personal session per student (highest session_number)
      const latestPersonalByStudent = {};
      for (const s of allSessions) {
        if (s.assigned_student_id && !latestPersonalByStudent[s.assigned_student_id]) {
          latestPersonalByStudent[s.assigned_student_id] = s;
        }
      }

      // Collect session IDs: latest shared + latest personal per student
      const relevantSessions = [];
      if (latestShared) relevantSessions.push(latestShared);
      for (const s of Object.values(latestPersonalByStudent)) relevantSessions.push(s);
      const sessionIds = relevantSessions.map(s => s.id);

      // 3. Exercises for these sessions
      const { data: assignments } = await supabase
        .from('exercise_assignments')
        .select('exercise_id, session_id')
        .in('session_id', sessionIds);
      if (!assignments?.length) { setLoading(false); return; }

      // Shared exercise IDs (from the latest shared session)
      const sharedSessionId = latestShared?.id;
      const sharedExerciseIds = Array.from(new Set(
        assignments.filter(a => a.session_id === sharedSessionId).map(a => a.exercise_id)
      ));

      // Personal exercises grouped by student (from their latest personal session)
      const sessionToStudent = {};
      for (const s of Object.values(latestPersonalByStudent)) {
        sessionToStudent[s.id] = s.assigned_student_id;
      }
      const personalExByStudent = {};
      for (const a of assignments) {
        const studentId = sessionToStudent[a.session_id];
        if (studentId) {
          if (!personalExByStudent[studentId]) personalExByStudent[studentId] = new Set();
          personalExByStudent[studentId].add(a.exercise_id);
        }
      }

      setTotalEx(sharedExerciseIds.length);

      // 4. Enrolled students
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('student_id, student:users!student_id(id, full_name, real_name)')
        .eq('course_id', courseId)
        .eq('is_active', true);
      const studentMap = {};
      (enrollments || []).forEach(e => {
        const personalSet = personalExByStudent[e.student_id];
        const personalCount = personalSet ? personalSet.size : 0;
        studentMap[e.student_id] = {
          id: e.student_id,
          name: e.student?.real_name || e.student?.full_name || 'Unknown',
          completed: 0,
          total: sharedExerciseIds.length + personalCount
        };
      });

      // 5. Progress for all exercises (shared + personal)
      const allExerciseIds = Array.from(new Set(assignments.map(a => a.exercise_id)));
      const studentIds = Object.keys(studentMap);
      if (studentIds.length && allExerciseIds.length) {
        const { data: progress } = await supabase
          .from('user_progress')
          .select('user_id, exercise_id, status')
          .in('user_id', studentIds)
          .in('exercise_id', allExerciseIds);
        (progress || []).forEach(p => {
          if (p.status === 'completed' && studentMap[p.user_id]) {
            // Only count if it's a shared exercise or this student's personal exercise
            const isShared = sharedExerciseIds.includes(p.exercise_id);
            const isPersonal = personalExByStudent[p.user_id]?.has(p.exercise_id);
            if (isShared || isPersonal) {
              studentMap[p.user_id].completed++;
            }
          }
        });
      }

      setStudentList(Object.values(studentMap).sort((a, b) => b.completed - a.completed));
      setLoaded(true);
    } catch (err) {
      console.error('Error fetching course stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 rounded-b-lg overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <span>{latestSession ? latestSession.title : 'Student Progress'}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-2">
          {loading ? (
            <div className="text-xs text-gray-400 py-2 text-center">Loading...</div>
          ) : studentList.length > 0 ? (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {studentList.map(s => {
                const sTotal = s.total ?? totalEx;
                return (
                  <div key={s.id} className="flex items-center gap-1.5 text-xs">
                    {s.completed === sTotal ? (
                      <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                    ) : s.completed > 0 ? (
                      <Clock className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-gray-300 flex-shrink-0" />
                    )}
                    <span className="text-gray-700 truncate flex-1">{s.name}</span>
                    <span className={`font-medium whitespace-nowrap ${
                      s.completed === sTotal ? 'text-green-600' : s.completed > 0 ? 'text-yellow-600' : 'text-gray-400'
                    }`}>
                      {s.completed}/{sTotal}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-gray-400 py-1">No data</div>
          )}
        </div>
      )}
    </div>
  );
};
/**
 * The monster in the hero banner. Split out so it can read the carousel: the
 * panel stays mounted off-screen, so sliding back to it has to be what triggers
 * the entrance, not mounting.
 *
 * Always mirrored: the sheets are drawn facing right, and standing at the right
 * edge it should be looking back across the banner, the way the battle turns it
 * to face the hero.
 */
const EventMonsterSprite = ({ config, scale }) => {
  const { active } = useCarouselPanel()
  return <EventCharacter key={config.id} config={config} scale={scale} spawn={active} flip interactive={false} />
}

/**
 * The monster's own scene behind a day's panel, so a rung of the ladder is a
 * place and not just a creature.
 *
 * A week of these is mounted at once, so only the panels within reach of the
 * one on screen paint theirs — otherwise opening the dashboard fetches seven
 * full-bleed photographs to show one. A panel is `near` a slide before it is
 * arrived at, which is enough warning for the image to be there.
 *
 * The scrim is here because this covers the banner's shared black/30: that
 * overlay is painted under the carousel, so without one the caption would be
 * white text on open sky.
 */
const EventMonsterScene = ({ config }) => {
  const { near } = useCarouselPanel()

  return (
    <div className="absolute inset-0 overflow-hidden">
      {near && (
        <div
          className="animate-scene-fade absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${monsterBackground(config)})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
    </div>
  )
}

// The hero's arrival on a day's panel: parked this far off the left edge, then
// run in over this long — after a beat, so the caption has landed and the
// carousel has finished sliding before anything moves.
const RUN_IN = { distance: 180, ms: 700, delay: 320 }

/**
 * The student's own fighter, running onto the day's panel to face what is
 * standing at the other end of it. Replays every time the panel comes round,
 * which is what makes it an arrival rather than scenery.
 *
 * Remounted to change sheets: EventCharacter reads `idleAnimation` once, when it
 * mounts, so a key is what swaps the run cycle for the idle. The travel is a
 * transform on the wrapper over the same span the cycle plays for, so the legs
 * and the distance stay one movement.
 */
const EventHeroRunIn = ({ config, scale }) => {
  const { active } = useCarouselPanel()
  const [phase, setPhase] = useState('off') // off | running | idle
  const moving = config.animations.run ? 'run' : config.animations.walk ? 'walk' : null

  // Both sheets before the run needs them, or the first stride of every panel
  // is a blank box while the strip is fetched.
  useEffect(() => {
    preloadSheets([moving, 'idle'].filter(Boolean).map((n) => animationSrc(config, n)))
  }, [config, moving])

  useEffect(() => {
    if (!active) {
      setPhase('off')
      return
    }
    if (!moving) {
      setPhase('idle')
      return
    }
    const start = setTimeout(() => setPhase('running'), RUN_IN.delay)
    const stop = setTimeout(() => setPhase('idle'), RUN_IN.delay + RUN_IN.ms)
    return () => { clearTimeout(start); clearTimeout(stop) }
  }, [active, moving])

  const off = phase === 'off'

  return (
    <div
      className="absolute bottom-0 left-3 z-10 md:left-8"
      style={{
        transform: `translateX(${off ? -RUN_IN.distance : 0}px)`,
        opacity: off ? 0 : 1,
        // Only the run is animated; arriving and being reset are instant, so
        // sliding away does not drag the sprite back across the panel.
        transition: phase === 'running'
          ? `transform ${RUN_IN.ms}ms linear, opacity 200ms ease-out`
          : 'none'
      }}
    >
      <EventCharacter
        key={phase}
        config={config}
        idleAnimation={phase === 'running' ? moving : 'idle'}
        scale={scale}
        interactive={false}
      />
    </div>
  )
}

/**
 * One day of the ladder, as its own slide. The whole week stays browsable — a
 * locked day still shows that something is waiting there and says why its
 * button is dead, which is the point of being able to slide onto it.
 *
 * What a day the CALENDAR has not reached does not show is WHICH something. Its
 * monster is drawn as a silhouette and its name held back until the morning it
 * opens, so sliding ahead is a week to look forward to rather than a week
 * already seen — day seven's boss especially, which is the one reveal the
 * ladder has to spend and was being given away on day one.
 *
 * Only the calendar lock hides anything. A day locked by `previous` has already
 * arrived and is being withheld for a reason the student can do something about;
 * hiding that one would just be answering "beat yesterday first" with a riddle.
 */
const EventStagePanel = ({ stage, hero, totalDays, ignoreCalendar, scale, busy, onFight }) => {
  const monster = stageMonster(stage)
  const unseen = stage.lockedBy === 'calendar'

  // Clipped so the hero can wait off the left edge without hanging over the
  // panel beside it in the strip.
  return (
    <div className="absolute inset-0 overflow-hidden">
      <EventMonsterScene config={monster} />

      {/* Right edge, facing back at the caption. The padding keeps it out from
          under the carousel arrow halfway down that edge. */}
      {/* The blackout is a filter on the wrapper rather than anything the sprite
          knows about, so it covers the animation whole — every frame, and the
          drop-shadow the sheet draws itself with. The rim light is what keeps it
          off the scrim at the bottom of the scene, where a pure black shape on
          black/75 is not a silhouette so much as a hole.

          aria-hidden because EventCharacter labels itself with the monster's
          name: the shape is the whole point and the name is the thing being
          withheld, so the caption's lock carries this for a screen reader
          instead. */}
      <div
        className="absolute inset-0 flex items-end justify-end pr-4 md:pr-12"
        aria-hidden={unseen ? 'true' : undefined}
        style={unseen ? { filter: 'brightness(0) opacity(0.82) drop-shadow(0 0 12px rgba(255,255,255,0.3))' } : undefined}
      >
        <EventMonsterSprite config={monster} scale={scale} />
      </div>

      {/* Centred between the two of them, with side padding wide enough to be
          standing room: the hero holds the left edge, the monster the right. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end p-6 px-16 text-center text-white md:px-24">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-80">
          <span>Sự kiện · Ngày {stage.day}/{totalDays}</span>
          {stage.cleared && (
            <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[10px] text-emerald-200">
              Đã hạ gục
            </span>
          )}
          {ignoreCalendar && (
            <span className="rounded bg-yellow-400/25 px-1.5 py-0.5 text-[10px] text-yellow-200">
              Admin · mở khoá toàn bộ
            </span>
          )}
        </div>
        <h5 className="flex items-center gap-2 text-2xl md:text-3xl font-bold drop-shadow-lg">
          {unseen ? (
            <>
              <Lock className="h-6 w-6 opacity-80" />
              {/* Not the boss line either: "Trùm cuối" on day seven would give
                  away the one thing the silhouette is holding back. */}
              <span className="tracking-[0.2em]"></span>
            </>
          ) : (
            <>{monster.name}{stage.boss ? ' — Trùm cuối!' : ' xuất hiện!'}</>
          )}
        </h5>
        <div className="mt-1 mb-1 h-[2px] w-20 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        <p className="text-base md:text-lg opacity-90 drop-shadow-md">
          {eventStageMessage(stage)}
        </p>

        <button
          onClick={onFight}
          disabled={busy || !stage.playable}
          className="pointer-events-auto mt-2 w-fit rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-red-700 disabled:opacity-60"
        >
          {stage.cleared ? 'Đánh lại' : 'Chiến đấu'}
        </button>
      </div>

      {/* After the caption, so it stands in front of it rather than behind. */}
      {hero && <EventHeroRunIn config={hero} scale={scale} />}
    </div>
  )
}

/** Why a day of the ladder can or cannot be fought, in one line. */
const eventStageMessage = (stage) => {
  if (!stage) return 'Sự kiện chưa bắt đầu.'
  if (stage.cleared) return 'Đã hạ gục — đánh lại nhận nguyên liệu.'
  if (stage.playable) return 'Đánh bại nó để nhận thưởng.'
  return stage.lockedBy === 'calendar'
    ? `Mở vào ngày ${stage.day} của sự kiện.`
    : 'Hãy hạ gục quái của ngày trước đã.'
}

const Dashboard = () => {
  const { profile } = useAuth()
  const { character: eventCharacter, chooseCharacter } = useEventCharacter(profile?.id)
  const permissions = usePermissions()
  // Staff reach any day whenever they like: an event is hard to check the day
  // before it opens if the dashboard will only show you day one, and harder
  // still if seeing day five means winning four fights first. The same two
  // overrides are honoured by record_event_stage_clear, so a stage they can
  // click is a stage the database will let them bank.
  const isStaff = permissions.isAdmin || profile?.role === 'admin'
  const ladder = useEventLadder(profile?.id, { ignoreCalendar: isStaff, ignoreOrder: isStaff })
  // A level is a monster beaten, and that is all it is: no sheet, no points, no
  // XP row to load. It is derived here and shown; nothing in a fight reads it.
  const eventLevel = levelFromClears(ladder.clearedCount)
  const { rollEventBattleDrop } = useInventory()
  // Frozen for the length of a battle, so finishing one credits the stage it was
  // actually fought on even if the ladder reloads underneath.
  const [fightStage, setFightStage] = useState(null)
  const [battleOpen, setBattleOpen] = useState(false)
  // The monster's intro clip, while it is playing. A fight with a clip opens on
  // it and the arena is not mounted until it is over or skipped — see
  // startEventBattle.
  const [cutscene, setCutscene] = useState(null)
  const [statsOpen, setStatsOpen] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  const [craftOpen, setCraftOpen] = useState(false)
  const [battleQuestions, setBattleQuestions] = useState([])
  // The passage this fight reads, or null for a round of loose questions.
  const [battleStory, setBattleStory] = useState(null)

  // Each panel reads its own stage now, so the only monster this level still
  // has to name is the one being fought. Memoised because EventBattle keys its
  // sprite preload and its scaled-monster maths on this object — a fresh one
  // every render would refetch the sheets mid-fight.
  // A replay's monster is the same creature on less health, climbing its own
  // shallower ladder — day seven asks twelve spoken phrases where a first clear
  // asks sixteen read ones. See REPLAY_HP_BY_DAY.
  const battleMonster = useMemo(
    () => stageMonster(fightStage || stageFor(1), { replay: Boolean(fightStage?.cleared) }),
    [fightStage]
  )

  // Music on a first run at a stage, silence on a rerun — the same line the
  // rest of the ladder is drawn on. A theme belongs to MEETING a monster; a
  // rerun is practice, and practice is quiet enough to think in. Null is a
  // silent fight, which is also what a day whose track is not uploaded gets.
  const battleMusic = useMemo(
    () => (fightStage?.cleared ? null : monsterMusic(battleMonster)),
    [fightStage, battleMonster]
  )

  /**
   * Which passage this fight opens on, if any.
   *
   * THE DAY NAMES ITS OWN STORY. A passage carries the `stage_day` it belongs
   * to, so the week is seven texts read in order rather than whichever one a
   * lottery turned up — a student who fights day 3 twice reads the same story
   * twice, which is the point of a story.
   *
   * A day may hold more than one, split by `min_level`, and the highest band at
   * or below the student is the one they read. So day 3 can be an easier text
   * for a level-2 reader and a harder one for a level-3 reader without either
   * meeting a passage out of turn, and a level-4 reader — who has no band of
   * their own — still gets the hardest one written rather than nothing.
   *
   * A story only qualifies if it can carry the WHOLE round on its own: the day
   * asks one kind of question, and a passage with three multiple-choice
   * questions cannot fill a round that asks for nine of them. Topping the round
   * up from the loose bank was the other option and is worse — questions about
   * a text the student has just read, mixed with questions about nothing, is a
   * round that quietly stops being a reading exercise halfway through. An
   * understocked band is therefore skipped and the band below it tried instead,
   * and a day no band can carry falls back to the loose bank rather than opening
   * a thin fight. That is the compatibility promise the story migration was
   * written on, and the reason `story_id` is nullable.
   */
  const pickEventStory = async (day, level, pool, roundSize) => {
    // How much of this day's question type each passage can actually field. The
    // pool is already cut to the day's types and the student's level, so a count
    // here is a count of questions this fight could really ask.
    const counts = new Map()
    for (const q of pool) {
      if (!q.story_id) continue
      counts.set(q.story_id, (counts.get(q.story_id) || 0) + 1)
    }
    if (!counts.size) return null

    // Every band this student may read on this day, hardest first. Filtered on
    // the passage's own level and active flag rather than the questions': a
    // story may be held back while the questions written for it are not.
    //
    // A database that has not run the story migration has no `stage_day` to
    // filter on, and PostgREST fails the whole select over the one missing
    // column — which lands here as a day with no passage, so the fight is a
    // loose round and nothing breaks.
    const { data, error } = await supabase
      .from('event_stories')
      .select('id, title, body, image_url')
      .eq('is_active', true)
      .eq('stage_day', day)
      .lte('min_level', level)
      .order('min_level', { ascending: false })

    if (error) return null
    return (data || []).find((s) => (counts.get(s.id) || 0) >= roundSize) || null
  }

  /**
   * A replay's phrases: this day's, in this student's band.
   *
   * Two narrowings, in order, on rows the query has already cut to the day (or
   * to no day at all).
   *
   * DAY. A day's own phrases win outright wherever they exist. Untagged rows
   * are a fallback for a day nobody has written yet, not a pool to be blended
   * in — mixing them would mean a day that HAS five phrases of its own still
   * asks three generic ones, and the week would stop feeling written.
   *
   * BAND. Then the highest `min_level` at or below the student, and only that
   * one. This is the same rule the passages use, and for the same reason: the
   * bank query is a `lte`, so without it a level-3 reader would be handed the
   * level-2 sentences as well and the two levels would quietly converge on the
   * same easy pool. Falling to the next band down rather than demanding an
   * exact match is what keeps a level-5 student — who has no band of their own
   * — reading the hardest thing written instead of nothing.
   */
  const replayPool = (rows, day, level) => {
    const own = rows.filter((r) => r.stage_day === day)
    const pool = own.length ? own : rows.filter((r) => !r.stage_day)
    if (!pool.length) return pool

    const band = Math.max(...pool.map((r) => r.min_level ?? 1).filter((l) => l <= level))
    return Number.isFinite(band) ? pool.filter((r) => (r.min_level ?? 1) === band) : pool
  }

  // The event's own bank — not the pet one, which can only describe a stem with
  // four choices. Each day asks a different KIND of question, so the rows are
  // filtered to the types this stage uses (one for a normal day, every kind the
  // week taught for the boss) as well as to the student's level.
  //
  // From level 2 a fight opens on a STORY: the student reads the passage that
  // belongs to this DAY, then answers questions about it, so a round is one
  // piece of reading rather than nine unrelated stems. The day still decides HOW
  // it is asked; the passage decides WHAT it is about.
  //
  // Level 1 never reads. A beginner is given the LOOSE questions — the ones
  // attached to no passage — because a page of English before the first question
  // is a wall to a child still sounding out the questions themselves. Where
  // reading starts is STORY_MIN_LEVEL, a knob in config/eventQuestions.js.
  //
  // Gated only on the ladder, which is what says whether this stage can be
  // fought at all. There is nothing else to wait for: every student walks in
  // with the same three lives and the same one damage.
  const openEventBattle = async (stage) => {
    if (ladder.loading || !stage?.playable) return

    const level = profile?.current_level || 1
    // A cleared stage fought again is a SPEAKING round: the day's reading and
    // typing are replaced outright, so a redo is its own exercise rather than
    // the same fight for a smaller prize. See REPLAY_QUESTION_TYPES.
    const replay = Boolean(stage.cleared)
    const types = stageQuestionTypes(stage, { replay })
    // What the fight can ask at the outside: a kill's worth of right answers
    // plus the mistakes allowed on the way. A story has to cover all of it to be
    // worth opening on — and a replay's is much smaller, because a speaking
    // round does not inherit the week's climb.
    const roundSize = roundSizeFor(stage, { replay })

    // The whole eligible pool comes back and the battle shuffles it down to a
    // round, so the same day is a different ten questions each time it is
    // fought rather than the first ten the table happens to return.
    const columns = 'id, type, question, payload, image_url, seconds'

    /**
     * The eligible rows, and whether passages are even possible on this
     * database.
     *
     * Two columns here arrived in later migrations — `story_id` and
     * `stage_day` — and PostgREST fails an entire select over one that is
     * missing. So the select is tried richest-first and degrades: a database
     * that never ran those migrations runs the day exactly as it ran before
     * they existed, rather than opening a fight with no questions in it.
     *
     * The DAY filter is replay-only and needs `stage_day`, so it falls away in
     * the same step. `stage_day.is.null` is in the `or` on purpose: untagged
     * phrases are the shared pool a day with none of its own falls back to.
     */
    const fetchPool = async (askTypes) => {
      const base = (cols) => supabase
        .from('event_question_bank')
        .select(cols)
        .eq('is_active', true)
        .in('type', askTypes)
        .lte('min_level', level)

      const attempts = replay
        ? [[`${columns}, story_id, stage_day`, true], [`${columns}, story_id`, false], [columns, false]]
        : [[`${columns}, story_id`, false], [columns, false]]

      for (const [cols, byDay] of attempts) {
        let query = base(cols)
        if (byDay) query = query.or(`stage_day.eq.${stage.day},stage_day.is.null`)
        const { data, error } = await query
        if (!error) return { rows: data || [], stories: cols.includes('story_id') }
      }
      return { rows: [], stories: false }
    }

    let { rows, stories } = await fetchPool(types)
    // A replay narrowed to this day and this level band; see replayPool.
    if (replay) rows = replayPool(rows, stage.day, level)

    // A speaking round with nothing to say. The spoken bank is written after
    // the week is, and an empty pool is not a gentle failure — the battle opens
    // and ends immediately as "exhausted", which reads to a student as the game
    // being broken. So a redo with no spoken questions quietly becomes an
    // ordinary redo of the day instead.
    if (replay && !rows.length) ({ rows, stories } = await fetchPool(stageQuestionTypes(stage)))

    const pool = rows
    const story = !stories || level < STORY_MIN_LEVEL
      ? null
      : await pickEventStory(stage.day, level, pool, roundSize)

    // With no passage the round is LOOSE questions only — never the pool as a
    // whole. A story's questions are about a text, and "Where does Mai find her
    // cat?" asked with no Mai on screen cannot be answered by anyone who has not
    // already read it. On a database that has not run the story migration no row
    // carries a story_id at all, so this keeps every row and the day runs
    // exactly as it did before passages existed.
    setBattleQuestions(
      story ? pool.filter((q) => q.story_id === story.id) : pool.filter((q) => !q.story_id)
    )
    setBattleStory(story)
    setFightStage(stage)

    // Straight into the arena unless this monster has an introduction to make.
    const intro = monsterIntro(stageMonster(stage))
    if (intro) setCutscene(intro)
    else setBattleOpen(true)
  }

  // What the cutscene hands over to, whether it played out or was skipped: the
  // clip is theatre and refusing to watch it costs a student nothing.
  const startEventBattle = () => {
    setCutscene(null)
    setBattleOpen(true)
  }

  // What a finished fight was worth. The loot is the inventory's business and
  // the tally is the stat sheet's; the battle needs both back so its victory
  // screen can show what the fight paid.
  //
  // The clear is banked FIRST, because everything else hangs off whether this
  // was the first time this stage went down, and only the database can settle
  // that — two devices cannot both claim it. A first clear is also the level:
  // recording it grows the ladder's cleared set, which is the whole of what a
  // level counts, so nothing here has to award anything for a student to gain
  // one.
  const finishEventBattle = async (result) => {
    const stage = fightStage
    const clear = result.won && stage ? await ladder.recordClear(stage.day) : null
    const firstClear = clear ? Boolean(clear.first_clear) : true

    const drop = FEATURES.inventory && result.won
      // Keyed on the base monster, not the tier-2 variant, so one entry in the
      // drop config covers both of a monster's days.
      ? await rollEventBattleDrop(stage?.monster || result.monster?.id, firstClear)
      : null

    // A monster beaten for the first time is a level. Read off `clear`, which is
    // null unless the fight was WON and the database recorded it — not off
    // `firstClear`, which falls back to true for a fight that banked nothing and
    // so announced a level-up on every defeat.
    return {
      loot: drop?.items || [],
      chest: drop?.chest || null,
      firstClear,
      levelUp: Boolean(clear?.first_clear) && eventLevel < MAX_LEVEL
    }
  }
  const { branding } = useBranding()
  const { canCreateContent } = permissions
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [recent, setRecent] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [courseProgress, setCourseProgress] = useState({})
  const [onlineUsers, setOnlineUsers] = useState([])
  const [offlineUsers, setOfflineUsers] = useState([])
  const [challengeTarget, setChallengeTarget] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingChallengeUserIds, setPendingChallengeUserIds] = useState({})
  const [pvpAvailable, setPvpAvailable] = useState(true)
  const [courseCompletion, setCourseCompletion] = useState({})
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  )
  const [tickedCourses, setTickedCourses] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('teacher_ticked_courses') || '{}');
      const now = Date.now();
      const filtered = {};
      for (const [id, ts] of Object.entries(stored)) {
        if (now - ts < 3 * 24 * 60 * 60 * 1000) filtered[id] = ts;
      }
      if (Object.keys(filtered).length !== Object.keys(stored).length) {
        localStorage.setItem('teacher_ticked_courses', JSON.stringify(filtered));
      }
      return filtered;
    } catch { return {}; }
  })
  const navigate = useNavigate()

  // Track desktop breakpoint for avatar sizing
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    const handler = (e) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Check PvP schedule
  useEffect(() => {
    const checkSchedule = async () => {
      const schedule = await fetchPvpSchedule()
      const result = checkPvpAvailability(schedule)
      setPvpAvailable(result.available)
    }
    checkSchedule()
    const scheduleInterval = setInterval(checkSchedule, 60000)
    return () => clearInterval(scheduleInterval)
  }, [])

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Fetch online + recently offline users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, last_seen_at, user_equipment(active_title, active_frame_ratio, hide_frame)')
          .gte('last_seen_at', twentyFourHoursAgo)
          .order('last_seen_at', { ascending: false })
          .limit(40)
        if (!error && data) {
          const flat = data.map(u => {
            const { user_equipment, ...rest } = u
            return { ...rest, ...user_equipment }
          })
          const online = []
          const offline = []
          flat.forEach(u => {
            if (u.last_seen_at >= fiveMinutesAgo) {
              online.push(u)
            } else {
              offline.push(u)
            }
          })
          setOnlineUsers(online)
          setOfflineUsers(offline)
        }
      } catch (err) {
        console.error('Error fetching online users:', err)
      }
    }
    fetchUsers()
    const interval = setInterval(fetchUsers, 60000)
    return () => clearInterval(interval)
  }, [])

  // Fetch pending PvP challenges
  useEffect(() => {
    if (!profile?.id) return
    const fetchPending = async () => {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('pvp_challenges')
        .select('challenger_id, opponent_id')
        .eq('status', 'pending')
        .gte('created_at', since)
        .or(`challenger_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
      if (data) {
        const map = {}
        data.forEach(c => {
          if (c.challenger_id === profile.id) {
            map[c.opponent_id] = 'sent'
          } else {
            map[c.challenger_id] = 'received'
          }
        })
        setPendingChallengeUserIds(map)
      }
    }
    fetchPending()
    const interval = setInterval(fetchPending, 30000)
    return () => clearInterval(interval)
  }, [profile?.id])

  // Fetch courses data
  useEffect(() => {
    if (profile) {
      fetchCourses()
      if (profile.role === 'user') {
        fetchMostRecentExercise()
        fetchCourseProgress()
      } else {
        setRecent(getRecentExercise())
      }
    }
  }, [profile])

  const fetchCourses = async () => {
    try {
      setLoading(true)

      // For students, only show enrolled courses. For admins/teachers, show all courses.
      if (profile?.role === 'user') {
        // Student: fetch only enrolled courses
        const { data, error } = await supabase
          .from('course_enrollments')
          .select(`
            courses (
              id,
              title,
              description,
              thumbnail_url,
              level_number,
              difficulty_label,
              color_theme,
              is_active
            )
          `)
          .eq('student_id', profile.id)
          .eq('is_active', true)
          .eq('courses.is_active', true)
          .order('level_number', { foreignTable: 'courses' })

        if (error) throw error

        // Extract courses from the enrollment data
        const enrolledCourses = data?.map(enrollment => enrollment.courses).filter(Boolean) || []
        console.log('Fetched enrolled courses:', enrolledCourses)
        setCourses(enrolledCourses)
      } else if (profile?.role === 'teacher') {
        // Teacher: fetch only assigned courses
        const { data, error } = await supabase
          .from('course_teachers')
          .select(`
            courses (
              id,
              title,
              description,
              thumbnail_url,
              level_number,
              difficulty_label,
              color_theme,
              is_active
            )
          `)
          .eq('teacher_id', profile.id)
          .eq('courses.is_active', true)
          .order('level_number', { foreignTable: 'courses' })

        if (error) throw error

        // Extract courses from the teacher assignments
        const assignedCourses = data?.map(assignment => assignment.courses).filter(Boolean) || []
        console.log('Fetched assigned courses for teacher:', assignedCourses)
        setCourses(assignedCourses)
        fetchCourseCompletion(assignedCourses)
      } else {
        // Admin: fetch all courses
        let { data, error } = await supabase
          .from('courses')
          .select(`
            id,
            title,
            description,
            thumbnail_url,
            level_number,
            difficulty_label,
            color_theme,
            is_active
          `)
          .eq('is_active', true)
          .order('level_number')

        // If courses table doesn't exist, try levels table as fallback
        if (error && error.code === 'PGRST205') {
          console.log('Courses table not found, trying levels table...')
          const fallback = await supabase
            .from('levels')
            .select(`
              id,
              title,
              description,
              thumbnail_url,
              level_number,
              difficulty_label,
              color_theme,
              is_active
            `)
            .eq('is_active', true)
            .order('level_number')

          data = fallback.data
          error = fallback.error
        }

        if (error) throw error
        console.log('Fetched all courses:', data)
        setCourses(data || [])
      }
    } catch (error) {
      console.error('Error fetching courses:', error)
      setCourses([])
    } finally {
      setLoading(false)
    }
  }

  const fetchMostRecentExercise = async () => {
    try {
      // 1. Get student's enrolled courses
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('student_id', profile.id)
        .eq('is_active', true)

      if (enrollError) throw enrollError
      if (!enrollments || enrollments.length === 0) return

      const courseIds = enrollments.map(e => e.course_id)

      // 2. Get all units from these courses, ordered by unit_number DESC
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id, course_id, unit_number, title')
        .in('course_id', courseIds)
        .eq('is_active', true)
        .order('unit_number', { ascending: false })

      if (unitsError) throw unitsError
      if (!units || units.length === 0) return

      // 3. Get all sessions from ALL units, ordered by unit_number DESC, session_number DESC
      const unitIds = units.map(u => u.id)
      const { data: allSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, unit_id, session_number, title')
        .in('unit_id', unitIds)
        .eq('is_active', true)
        .order('session_number', { ascending: false })

      if (sessionsError) throw sessionsError
      if (!allSessions || allSessions.length === 0) return

      // Sort sessions by unit order first, then session number
      const unitOrderMap = new Map(units.map((u, idx) => [u.id, idx]))
      const sortedSessions = allSessions.sort((a, b) => {
        const unitOrderA = unitOrderMap.get(a.unit_id)
        const unitOrderB = unitOrderMap.get(b.unit_id)
        if (unitOrderA !== unitOrderB) return unitOrderA - unitOrderB
        return b.session_number - a.session_number
      })

      // 4. Get student's progress for all exercises
      const { data: userProgress, error: progressError } = await supabase
        .from('user_progress')
        .select('exercise_id, status')
        .eq('user_id', profile.id)

      if (progressError) throw progressError

      const completedExercises = new Set(
        (userProgress || [])
          .filter(p => p.status === 'completed')
          .map(p => p.exercise_id)
      )

      // 5. Find first session with incomplete exercises
      let targetSession = null
      let targetUnit = null

      for (const session of sortedSessions) {
        // Get exercises from this session
        const { data: assignments, error: assignmentsError } = await supabase
          .from('exercise_assignments')
          .select(`
            exercise_id,
            exercises (
              id,
              title,
              exercise_type,
              content
            )
          `)
          .eq('session_id', session.id)
          .order('order_index', { ascending: true })

        if (assignmentsError) continue
        if (!assignments || assignments.length === 0) continue

        // Check if there are any incomplete exercises
        const hasIncomplete = assignments.some(a => !completedExercises.has(a.exercise_id))

        if (hasIncomplete) {
          targetSession = session
          targetUnit = units.find(u => u.id === session.unit_id)
          break
        }
      }

      // If no incomplete session found, default to the latest session
      if (!targetSession) {
        targetSession = sortedSessions[0]
        targetUnit = units.find(u => u.id === targetSession.unit_id)
      }

      if (!targetSession || !targetUnit) return

      // 6. Build the navigation path
      const continuePath = `/study/course/${targetUnit.course_id}/unit/${targetUnit.id}/session/${targetSession.id}`

      setRecent({
        id: targetSession.id,
        title: `${targetUnit.title} - ${targetSession.title}`,
        imageUrl: null,
        continuePath
      })

    } catch (error) {
      console.error('Error fetching most recent exercise:', error)
    }
  }

  const fetchCourseProgress = async () => {
    try {
      if (!profile?.id) return

      // Get all user progress
      const { data: userProgress, error: progressError } = await supabase
        .from('user_progress')
        .select('exercise_id, status')
        .eq('user_id', profile.id)

      if (progressError) throw progressError

      const completedExerciseIds = new Set(
        (userProgress || [])
          .filter(p => p.status === 'completed')
          .map(p => p.exercise_id)
      )

      // Get all courses
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('student_id', profile.id)
        .eq('is_active', true)

      if (enrollError) throw enrollError

      const courseIds = enrollments?.map(e => e.course_id) || []
      if (courseIds.length === 0) return

      // For each course, get total exercises and calculate progress
      const progressData = {}

      for (const courseId of courseIds) {
        // Get all units for this course
        const { data: units, error: unitsError } = await supabase
          .from('units')
          .select('id')
          .eq('course_id', courseId)
          .eq('is_active', true)

        if (unitsError) continue
        if (!units || units.length === 0) continue

        const unitIds = units.map(u => u.id)

        // Get all sessions for these units
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('id')
          .in('unit_id', unitIds)
          .eq('is_active', true)

        if (sessionsError) continue
        if (!sessions || sessions.length === 0) continue

        const sessionIds = sessions.map(s => s.id)

        // Get all exercises for these sessions
        const { data: assignments, error: assignError } = await supabase
          .from('exercise_assignments')
          .select('exercise_id')
          .in('session_id', sessionIds)

        if (assignError) continue
        if (!assignments || assignments.length === 0) continue

        const totalExercises = assignments.length
        const completedCount = assignments.filter(a =>
          completedExerciseIds.has(a.exercise_id)
        ).length

        progressData[courseId] = {
          total: totalExercises,
          completed: completedCount,
          percentage: totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0
        }
      }

      setCourseProgress(progressData)

    } catch (error) {
      console.error('Error fetching course progress:', error)
    }
  }

  const fetchCourseCompletion = async (courseList) => {
    try {
      if (profile?.role !== 'teacher') return
      const result = {}

      for (const course of courseList) {
        const { data: units } = await supabase.from('units').select('id').eq('course_id', course.id)
        const unitIds = (units || []).map(u => u.id)
        if (!unitIds.length) continue

        const { data: sessions } = await supabase
          .from('sessions').select('id, assigned_student_id')
          .in('unit_id', unitIds).neq('is_test', true)
        if (!sessions?.length) continue

        const sessionPersonalMap = {}
        sessions.forEach(s => { if (s.assigned_student_id) sessionPersonalMap[s.id] = s.assigned_student_id })

        const { data: assignments } = await supabase
          .from('exercise_assignments').select('exercise_id, session_id')
          .in('session_id', sessions.map(s => s.id))
        if (!assignments?.length) continue

        const sharedExerciseIds = [...new Set(assignments.filter(a => !sessionPersonalMap[a.session_id]).map(a => a.exercise_id))]
        const personalByStudent = {}
        assignments.forEach(a => {
          const sid = sessionPersonalMap[a.session_id]
          if (sid) { (personalByStudent[sid] ||= new Set()).add(a.exercise_id) }
        })

        const { data: enrollments } = await supabase
          .from('course_enrollments').select('student_id')
          .eq('course_id', course.id).eq('is_active', true)
        if (!enrollments?.length) continue

        const studentIds = enrollments.map(e => e.student_id)
        const allExIds = [...new Set(assignments.map(a => a.exercise_id))]

        const { data: progress } = await supabase
          .from('user_progress').select('user_id, exercise_id, status')
          .in('user_id', studentIds).in('exercise_id', allExIds)

        let totalCompletion = 0
        studentIds.forEach(sid => {
          const personal = personalByStudent[sid]
          const studentExIds = personal ? [...sharedExerciseIds, ...personal] : sharedExerciseIds
          if (!studentExIds.length) return
          const completed = (progress || []).filter(p => p.user_id === sid && p.status === 'completed' && studentExIds.includes(p.exercise_id)).length
          totalCompletion += Math.round((completed / studentExIds.length) * 100)
        })

        result[course.id] = {
          avg: studentIds.length > 0 ? Math.round(totalCompletion / studentIds.length) : 0,
          students: studentIds.length
        }
      }
      setCourseCompletion(result)
    } catch (err) { console.error('Error fetching course completion:', err) }
  }

  // Greeting is hidden in the hero for now; kept here, and commented out so it
  // does not read as dead code, for whenever it goes back.
  /*
  // Get greeting message based on Vietnam time
  const getGreetingMessage = () => {
    // Get Vietnam hour
    const vietnamHour = parseInt(new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      hour12: false
    }))

    if (vietnamHour >= 5 && vietnamHour < 12) {
      return "Buổi sáng vui vẻ, học thôi nào! 🌅"
    } else if (vietnamHour >= 12 && vietnamHour < 18) {
      return "Buổi chiều vui vẻ, học thôi nào! ☀️"
    } else {
      return "Buổi tối vui vẻ, học thôi nào! 🌙"
    }
  }
  */

  return (
    <div className="space-y-8 md:pt-8">
      {/* Header with Blue Background */}
      <div className="relative -mx-4 md:-mx-6 lg:mx-0 -mt-6 md:-mt-6 lg:-mt-6 -mb-4 md:-mb-6 lg:mb-0">
        {/* Background Image */}
        <div className="relative h-48 md:h-56 overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600"
          style={{ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }}
        >
          {/* Corner brackets */}
          <div className="absolute top-0 left-[12px] w-5 h-[1px] bg-gradient-to-r from-white/40 to-transparent z-10" />
          <div className="absolute top-0 left-[12px] w-[1px] h-5 bg-gradient-to-b from-white/40 to-transparent z-10" />
          <div className="absolute bottom-0 right-[12px] w-5 h-[1px] bg-gradient-to-l from-white/40 to-transparent z-10" />
          <div className="absolute bottom-0 right-[12px] w-[1px] h-5 bg-gradient-to-t from-white/40 to-transparent z-10" />

          {/* Background Image */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${branding.heroImageUrl})` }}
          />
          {/* Dark overlay for better text readability */}
          <div className="absolute inset-0 bg-black/30" />

          <HeroCarousel>
            {/* Panel 1 — profile */}
            <div className="absolute inset-0">
            {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-between p-6">
            {/* XP and Streak stats */}
            <div className="flex justify-between">
              <div className="bg-white/90 backdrop-blur-sm px-4 py-1 flex items-center space-x-2"
                style={{ clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }}
              >
                <img src={assetUrl('/icon/profile/streak.svg')} alt="Streak" className="w-5 h-5" />
                <span className="font-semibold text-red-500">{profile?.streak_count || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-white/90 backdrop-blur-sm px-4 py-2 flex items-center space-x-2"
                  style={{ clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }}
                >
                  <img src={assetUrl('/image/study/xp.png')} alt="XP" className="w-5 h-5" />
                  <span className="font-semibold text-gray-800">{profile?.xp || 0}</span>
                </div>
                <div className="bg-white/90 backdrop-blur-sm px-4 py-2 flex items-center space-x-2"
                  style={{ clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)' }}
                >
                  <img src={assetUrl('/image/study/gem.png')} alt="Gems" className="w-5 h-5" />
                  <span className="font-semibold text-gray-800">{profile?.gems || 0}</span>
                </div>
              </div>
            </div>

            {/* Welcome text with avatar */}
            <div className="text-white mt-5">
              <div className="flex items-center space-x-4 mb-4">
                <AvatarWithFrame
                  avatarUrl={profile?.avatar_url}
                  frameUrl={profile?.hide_frame ? null : profile?.active_title}
                  frameRatio={profile?.active_frame_ratio}
                  size={isDesktop ? 110 : 86}
                  fallback={profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                  onClick={() => navigate(`/profile/${profile?.id}?avatarSelector=true`)}
                />
                {/* Greeting hidden for now — uncomment with getGreetingMessage
                    above to bring it back.
                <div>
                  <h5 className="text-2xl md:text-3xl font-bold drop-shadow-lg">
                    Chào {profile?.full_name || 'Học viên'}! 👋
                  </h5>
                  <div className="h-[2px] w-20 bg-gradient-to-r from-white/50 to-transparent mt-1 mb-1" />
                  <p className="text-base md:text-lg opacity-90 drop-shadow-md max-w-2xl">
                    {getGreetingMessage()}
                  </p>
                </div>
                */}
              </div>
            </div>
          </div>

          {/* Event character — click opens the stat sheet, button above swaps
              who it is. Stood a fifth of the way across rather than on the left
              edge, so it clears the avatar sitting in the corner. */}
          {EVENT_ENABLED && (
            <div className="absolute bottom-0 left-[20%] z-20 flex -translate-x-1/2 flex-col items-center">
              <div className="mb-1 flex items-center gap-1">
                <button
                  onClick={() => setPickerOpen(true)}
                  className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-gray-700 backdrop-blur-sm hover:bg-white"
                >
                  Đổi nhân vật
                </button>
                {/* A window, not a till — the shop is display-only, so this
                    opens a catalogue rather than a checkout. */}
                <button
                  onClick={() => setShopOpen(true)}
                  className="flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-semibold text-amber-950 backdrop-blur-sm hover:bg-amber-300"
                >
                  <ShoppingBag className="h-3 w-3" />
                  Cửa hàng
                </button>
                {/* The bench itself, not a way to the inventory page: the table
                    opens here and crafts here. */}
                {FEATURES.inventory && (
                  <button
                    onClick={() => setCraftOpen(true)}
                    className="flex items-center gap-1 rounded-full bg-purple-500/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-purple-400"
                  >
                    <Hammer className="h-3 w-3" />
                    Chế tạo
                  </button>
                )}
                {/* Staff only: who in the class has cleared which day. */}
                {(isStaff || profile?.role === 'teacher') && (
                  <button
                    onClick={() => navigate('/teacher?view=event')}
                    className="flex items-center gap-1 rounded-full bg-blue-500/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-blue-400"
                  >
                    <Users className="h-3 w-3" />
                    Tiến độ lớp
                  </button>
                )}
              </div>
              {/* The sprite opens the stat sheet rather than swinging. Its own
                  click-to-attack is off (interactive={false}) so the two don't
                  both fire — the picker tiles wrap it the same way. */}
              <button
                onClick={() => setStatsOpen(true)}
                aria-label={`${eventCharacter.name} — xem chỉ số`}
                className="cursor-pointer rounded transition-transform duration-100 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                <EventCharacter
                  key={eventCharacter.id}
                  config={eventCharacter}
                  scale={isDesktop ? 2.5 : 1.75}
                  interactive={false}
                />
              </button>
            </div>
          )}
            </div>

            {/* Panels 2..n — one per day of the ladder, in order, so the week is
                something you slide through rather than a strip of buttons.
                Gated on the flag like the aside is: with the event over these
                are the monsters themselves, not just the hero standing in
                front of them, so the whole strip goes rather than emptying out
                into panels nobody can fight. */}
            {EVENT_ENABLED && ladder.stages.map((stage) => (
              <EventStagePanel
                key={stage.day}
                stage={stage}
                hero={eventCharacter}
                totalDays={ladder.totalDays}
                ignoreCalendar={ladder.ignoreCalendar}
                scale={isDesktop ? 2.5 : 1.75}
                busy={ladder.loading}
                onFight={() => openEventBattle(stage)}
              />
            ))}
          </HeroCarousel>
        </div>
      </div>



      {/* Online Users - Messenger style */}
      {(onlineUsers.length > 0 || offlineUsers.length > 0) && (
        <div className="xl:hidden">
          <div className="flex overflow-x-auto gap-4 pb-2 px-1 scrollbar-hide">
            {[...onlineUsers].sort((a, b) => {
              const aP = pendingChallengeUserIds[a.id] === 'received' ? 0 : pendingChallengeUserIds[a.id] === 'sent' ? 1 : 2
              const bP = pendingChallengeUserIds[b.id] === 'received' ? 0 : pendingChallengeUserIds[b.id] === 'sent' ? 1 : 2
              return aP - bP
            }).map((u) => (
              <button
                key={u.id}
                onClick={() => (u.id === profile?.id || profile?.is_banned || u.role === 'admin') ? navigate(`/profile/${u.id}`) : setChallengeTarget(u)}
                className="flex flex-col items-center flex-shrink-0 w-16"
              >
                <div className="relative">
                  <AvatarWithFrame
                    avatarUrl={u.avatar_url}
                    frameUrl={u.hide_frame ? null : u.active_title}
                    frameRatio={u.active_frame_ratio}
                    size={56}
                    fallback={u.full_name?.[0]?.toUpperCase() || '?'}
                  />
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white z-10" />
                  {pvpAvailable && !profile?.is_banned && u.role !== 'admin' && pendingChallengeUserIds[u.id] === 'received' && (
                    <img src={assetUrl('/icon/dashboard/pvp.png')} alt="PvP" className="absolute top-0 right-0 w-4 h-4 animate-pulse" />
                  )}
                  {pvpAvailable && !profile?.is_banned && u.role !== 'admin' && pendingChallengeUserIds[u.id] === 'sent' && (
                    <img src={assetUrl('/icon/dashboard/pvp.png')} alt="PvP" className="absolute top-0 right-0 w-4 h-4 opacity-50" />
                  )}
                </div>
                <span className="text-xs text-gray-600 mt-1 text-center truncate w-full">{u.full_name?.split(' ').pop() || 'N/A'}</span>
              </button>
            ))}
            {offlineUsers.length > 0 && onlineUsers.length > 0 && (
              <div className="flex items-center flex-shrink-0 px-1">
                <div className="w-px h-10 bg-gray-200" />
              </div>
            )}
            {[...offlineUsers].sort((a, b) => {
              const aP = pendingChallengeUserIds[a.id] === 'received' ? 0 : pendingChallengeUserIds[a.id] === 'sent' ? 1 : 2
              const bP = pendingChallengeUserIds[b.id] === 'received' ? 0 : pendingChallengeUserIds[b.id] === 'sent' ? 1 : 2
              return aP - bP
            }).map((u) => (
              <button
                key={u.id}
                onClick={() => (u.id === profile?.id || profile?.is_banned || u.role === 'admin') ? navigate(`/profile/${u.id}`) : setChallengeTarget(u)}
                className="flex flex-col items-center flex-shrink-0 w-16 opacity-50"
              >
                <div className="relative grayscale">
                  <AvatarWithFrame
                    avatarUrl={u.avatar_url}
                    frameUrl={u.hide_frame ? null : u.active_title}
                    frameRatio={u.active_frame_ratio}
                    size={56}
                    fallback={u.full_name?.[0]?.toUpperCase() || '?'}
                  />
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-400 rounded-full border-2 border-white z-10" />
                  {pvpAvailable && !profile?.is_banned && u.role !== 'admin' && pendingChallengeUserIds[u.id] === 'received' && (
                    <img src={assetUrl('/icon/dashboard/pvp.png')} alt="PvP" className="absolute top-0 right-0 w-4 h-4 animate-pulse" />
                  )}
                  {pvpAvailable && !profile?.is_banned && u.role !== 'admin' && pendingChallengeUserIds[u.id] === 'sent' && (
                    <img src={assetUrl('/icon/dashboard/pvp.png')} alt="PvP" className="absolute top-0 right-0 w-4 h-4 opacity-50" />
                  )}
                </div>
                <span className="text-xs text-gray-400 mt-1 text-center truncate w-full">{u.full_name?.split(' ').pop() || 'N/A'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PvP Challenge Modal */}
      {cutscene && (
        <EventCutscene
          src={cutscene}
          poster={monsterBackground(battleMonster)}
          onDone={startEventBattle}
        />
      )}

      {battleOpen && (
        <EventBattle
          hero={eventCharacter}
          heroLevel={eventLevel}
          monster={battleMonster}
          questions={battleQuestions}
          story={battleStory}
          music={battleMusic}
          background={monsterBackground(battleMonster)}
          onClose={() => setBattleOpen(false)}
          onFinish={finishEventBattle}
        />
      )}

      {statsOpen && (
        <EventStatsPanel
          character={eventCharacter}
          level={eventLevel}
          clears={ladder.clearedCount}
          onClose={() => setStatsOpen(false)}
        />
      )}

      {pickerOpen && (
        <EventCharacterPicker
          characterId={eventCharacter.id}
          onChoose={chooseCharacter}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {shopOpen && <EventShop onClose={() => setShopOpen(false)} />}

      {craftOpen && <EventCrafting onClose={() => setCraftOpen(false)} />}
      {challengeTarget && (
        <PvPChallengeModal
          opponent={challengeTarget}
          onClose={() => setChallengeTarget(null)}
        />
      )}

      {/* Recent Exercise (Above Levels List) */}
      {recent && (
        <div className="relative bg-white border border-gray-200 p-4 shadow-sm overflow-hidden"
          style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
        >
          {/* Corner brackets */}
          <div className="absolute top-0 left-[10px] w-5 h-[1px] bg-gradient-to-r from-blue-300/40 to-transparent" />
          <div className="absolute top-0 left-[10px] w-[1px] h-5 bg-gradient-to-b from-blue-300/40 to-transparent" />
          <div className="absolute bottom-0 right-[10px] w-5 h-[1px] bg-gradient-to-l from-blue-300/40 to-transparent" />
          <div className="absolute bottom-0 right-[10px] w-[1px] h-5 bg-gradient-to-t from-blue-300/40 to-transparent" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-100 overflow-hidden flex items-center justify-center"
                style={{ clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' }}
              >
                {recent.imageUrl ? (
                  <img src={recent.imageUrl} alt={recent.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">📘</span>
                )}
              </div>
              <div>
                <div className="text-sm text-blue-600 font-semibold uppercase tracking-wide">Bài gần nhất</div>
                <div className="font-medium text-gray-500">{recent.title}</div>
              </div>
            </div>
            <button
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-5 py-2 shadow-md hover:shadow-lg transition-all active:scale-95"
              style={{
                clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
                animation: 'scalePulse 2s ease-in-out infinite',
                backfaceVisibility: 'hidden',
                WebkitFontSmoothing: 'antialiased'
              }}
              onMouseEnter={(e) => e.currentTarget.style.animation = 'none'}
              onMouseLeave={(e) => e.currentTarget.style.animation = 'scalePulse 2s ease-in-out infinite'}
              onClick={() => navigate(recent.continuePath)}
            >
              Tiếp tục✨
            </button>
            <style>{`
              @keyframes scalePulse {
                0%, 100% { transform: scale(1) translateZ(0); }
                50% { transform: scale(1.05) translateZ(0); }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* Pet Display - Full width */}
      {FEATURES.pets && profile && (
        <div className="mb-6 mt-6">
          <PetDisplay
            // The ladder a second time, in the empty half of the pet card: the
            // enemy days only, without the profile slide the banner opens on.
            // Built here rather than inside PetDisplay because the fight is all
            // Dashboard state — the questions, the cutscene, the stage frozen
            // for the length of a battle — and none of it is the pet's business.
            //
            // The same panels as the banner, not a cut-down copy of them: two
            // drawings of one monster is two things to keep in step, and the
            // day this one fell behind would be the day a student saw a monster
            // here they could not fight there.
            aside={EVENT_ENABLED && ladder.stages.length > 0 ? (
              <HeroCarousel>
                {ladder.stages.map((stage) => (
                  <EventStagePanel
                    key={stage.day}
                    stage={stage}
                    hero={eventCharacter}
                    totalDays={ladder.totalDays}
                    ignoreCalendar={ladder.ignoreCalendar}
                    // Smaller than the banner's: this box is about half as wide,
                    // and the sprite has to leave the caption its room.
                    scale={isDesktop ? 1.6 : 1.35}
                    busy={ladder.loading}
                    onFight={() => openEventBattle(stage)}
                  />
                ))}
              </HeroCarousel>
            ) : null}
          />
        </div>
      )}

      {/* Tournament + Recent Activities - Side by side on PC */}
      {(profile?.role === 'user' || profile?.role === 'admin' || profile?.role === 'teacher') && (
        <div className={`grid grid-cols-1 ${FEATURES.tournaments ? 'lg:grid-cols-3' : ''} gap-6 mb-6 mt-10`}>
          {FEATURES.tournaments && (
            <div className="lg:col-span-2 overflow-visible">
              <TournamentWidget />
            </div>
          )}
          <div className="self-start">
            <RecentActivities />
          </div>
        </div>
      )}

      {/* Non-student fallback: just Recent Activities */}
      {profile?.role !== 'user' && profile?.role !== 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1">
            <RecentActivities />
          </div>
        </div>
      )}

      {/* Courses List */}
      <div>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-2">Đang tải...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
              {courses.map((course) => {
                const isLocked = !course.is_active

                const CourseCard = () => (
                  <div className={`relative bg-white border border-gray-200 shadow-sm transition-all duration-200 overflow-hidden ${
                    isLocked
                      ? 'opacity-60 cursor-not-allowed'
                      : 'hover:shadow-lg'
                  }`}
                    style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                  >
                    {/* Teacher tick */}
                    {profile?.role === 'teacher' && (
                      <button
                        className="absolute top-1 right-1 z-20 p-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTickedCourses(prev => {
                            const next = { ...prev };
                            if (next[course.id]) {
                              delete next[course.id];
                            } else {
                              next[course.id] = Date.now();
                            }
                            localStorage.setItem('teacher_ticked_courses', JSON.stringify(next));
                            return next;
                          });
                        }}
                      >
                        <CheckCircle
                          size={22}
                          className={tickedCourses[course.id] ? 'text-green-500' : 'text-white/50'}
                        />
                      </button>
                    )}

                    {/* Corner brackets */}
                    <div className="absolute top-0 left-[10px] w-5 h-[1px] bg-gradient-to-r from-blue-300/40 to-transparent z-10" />
                    <div className="absolute top-0 left-[10px] w-[1px] h-5 bg-gradient-to-b from-blue-300/40 to-transparent z-10" />
                    <div className="absolute bottom-0 right-[10px] w-5 h-[1px] bg-gradient-to-l from-blue-300/40 to-transparent z-10" />
                    <div className="absolute bottom-0 right-[10px] w-[1px] h-5 bg-gradient-to-t from-blue-300/40 to-transparent z-10" />

                    {/* Course Image with Text Overlay */}
                    <div className="aspect-[1.8/1] bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center relative">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-4xl">
                          {course.level_number === 1 ? '🌱' :
                           course.level_number === 2 ? '📚' :
                           course.level_number === 3 ? '🏆' : '🎯'}
                        </div>
                      )}
                      
                      {/* Teacher Circular Completion */}
                      {profile?.role === 'teacher' && courseCompletion[course.id] && (() => {
                        const pct = courseCompletion[course.id].avg
                        const r = 18, c = 2 * Math.PI * r
                        return (
                          <div className="absolute bottom-2 left-2 z-10">
                            <svg width="48" height="48" className="drop-shadow">
                              <circle cx="24" cy="24" r={r} fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                              <circle cx="24" cy="24" r={r} fill="none"
                                stroke={pct >= 70 ? '#22c55e' : pct >= 30 ? '#eab308' : '#ef4444'}
                                strokeWidth="3" strokeLinecap="round"
                                strokeDasharray={c} strokeDashoffset={c - (c * pct / 100)}
                                transform="rotate(-90 24 24)"
                              />
                              <text x="24" y="25" textAnchor="middle" dominantBaseline="middle"
                                className="text-[10px] font-bold fill-white"
                              >{pct}%</text>
                            </svg>
                          </div>
                        )
                      })()}

                      {/* Lock Overlay */}
                      {isLocked && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <div className="text-center text-white">
                            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                           
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Progress Bar */}
                    {!isLocked && profile?.role === 'user' && courseProgress[course.id] && (
                      <div className="px-3 py-2 bg-gray-50 mb-1">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Tiến độ</span>
                          <span className="font-semibold">{courseProgress[course.id].percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 h-2 overflow-hidden"
                          style={{ clipPath: 'polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)' }}
                        >
                          <div
                            className={`h-full transition-all duration-500 ${
                              courseProgress[course.id].percentage < 30
                                ? 'bg-red-500'
                                : courseProgress[course.id].percentage < 70
                                ? 'bg-yellow-500'
                                : 'bg-blue-700'
                            }`}
                            style={{ width: `${courseProgress[course.id].percentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )

                if (isLocked) {
                  return (
                    <div key={course.id} className="group">
                      <CourseCard />
                      {canCreateContent() && <CourseStatsSection courseId={course.id} />}
                    </div>
                  )
                }

                return (
                  <div key={course.id} className="group">
                    <Link
                      to={`/study/course/${course.id}`}
                    >
                      <CourseCard />
                    </Link>
                    {canCreateContent() && <CourseStatsSection courseId={course.id} />}
                  </div>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}

export default Dashboard
