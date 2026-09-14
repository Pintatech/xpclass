import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, Gift, Package, X } from 'lucide-react'
import SpriteAnimation from '../ui/SpriteAnimation'
import { preloadSheets } from '../ui/spriteSheetCache'
import { animationSrc, arrivalOf, bodyPad, spriteMetrics } from '../../config/eventCharacter'
import { questionType, secondsFor } from '../../config/eventQuestions'
import { HERO_ATK, HERO_LIVES } from '../../config/eventLadder'
import { celebrate, primeCelebration } from '../../utils/celebrate'
import { promptFor } from './prompts'
import { shuffle } from './prompts/shared'


// Time to cross the arena in each direction. The sprite transform transition
// uses the same number, so the run cycle and the travel stay in step.
const APPROACH = 380
// How far the two FIGURES overlap once the attacker arrives — not their frame
// boxes, which are mostly transparent padding. A few pixels of overlap reads as
// contact, and the attack frames reach 30-100px further out again, so the
// weapon lands well inside the defender.
const MELEE_OVERLAP = 12
// Both fighters are drawn at this scale; bodyPad needs it to convert the
// configs' frame-space body bounds into screen pixels.
const FIGHTER_SCALE = 3
// Where in the swing the hit lands, as a fraction of the attack animation.
const IMPACT_AT = 0.4
const SETTLE = 220
// How long a fighter with no entrance sheet takes to fade onto the floor. Matches
// the animate-spawn-fade keyframes, so the two kinds of arrival end together.
const SPAWN_FADE = 500

// Served from our own origin rather than the ui-assets bucket, like the rest of
// the event art. The elsewhere-in-the-repo idiom is a fresh Audio() per play,
// but a swing has to be heard on the frame it lands, and the first one would
// still be fetching — so this is loaded once when the battle opens.
const SLASH_SRC = `${import.meta.env.BASE_URL}event/sfx/sword-slash.mp3`
const SLASH_VOLUME = 0.45
// The monster has no sword. Pitched a little under the hero's slash so a miss
// is heard as a blow taken rather than one landed.
const PUNCH_SRC = `${import.meta.env.BASE_URL}event/sfx/punch.mp3`
const PUNCH_VOLUME = 0.4

// The battle theme sits well under both blows: it is the room the fight happens
// in, and a child reading a passage aloud over it has to stay the loudest thing
// on the screen.
const MUSIC_VOLUME = 0.22
// How long the theme takes to duck away once the fight is decided. The victory
// fanfare fires on the blow that lands, so the music has to be leaving by then
// rather than cut dead under it.
const MUSIC_FADE = 700

// A drop lands on the floor where the monster fell and has to be clicked up: the
// result panel does not appear until it is. The banking is already done — this
// is theatre — but it is the beat the whole fight pays out in, so it is the
// student who ends it rather than a timer.
//
// The failsafe on the payout: how long the victory screen will wait for a roll
// that never comes back before showing the result without it. Not a deadline —
// a payout that arrives at any point before this still gets its drop on the
// floor — so it is set to "something has gone wrong", not to "long enough".
const PAYOUT_TIMEOUT = 8000

// Loot card colours. ItemDropNotification has its own palette, but that one is
// built for a white page — over the arena the rarity has to read as a glow.
const LOOT_RARITY = {
  common:    { tint: '#94a3b8', glow: 'rgba(148,163,184,0.35)', label: 'Thường' },
  uncommon:  { tint: '#4ade80', glow: 'rgba(74,222,128,0.4)',   label: 'Ít gặp' },
  rare:      { tint: '#60a5fa', glow: 'rgba(96,165,250,0.45)',  label: 'Hiếm' },
  epic:      { tint: '#c084fc', glow: 'rgba(192,132,252,0.5)',  label: 'Sử thi' },
  legendary: { tint: '#fbbf24', glow: 'rgba(251,191,36,0.55)',  label: 'Huyền thoại' }
}

// Worst to best, which is the order LOOT_RARITY is written in — but relying on
// key order for a ranking would be a trap for whoever adds a tier.
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']

const rarestOf = (drops) =>
  drops.reduce(
    (best, d) => (RARITY_ORDER.indexOf(d.rarity) > RARITY_ORDER.indexOf(best) ? d.rarity : best),
    'common'
  )

// A chest wearing an item's clothes, so the floor drop and the result card can
// render either without asking which one they were handed. A chest's rarity is
// spelled `chest_type` and reaches further than an item's — chests go up to
// legendary, which is why LOOT_RARITY carries a tone no item can roll.
const asFloorDrop = (chest) => ({
  name: chest.name,
  image_url: chest.image_url,
  rarity: chest.chest_type,
  chest: true
})

// One thing the win paid out, as a tile in the result panel's row.
//
// Upright rather than a wide card with the art beside the words: a haul is read
// across, and stacked cards pushed the close button off a short screen by the
// third drop. The art leads, since that is what is recognised — the name and the
// rarity are confirmation.
const LootTile = ({ drop, icon: Icon = Package }) => {
  const tone = LOOT_RARITY[drop.rarity] || LOOT_RARITY.common
  return (
    <div
      className="animate-loot-pop flex w-24 flex-col items-center rounded-xl border px-2 py-2"
      style={{
        borderColor: tone.tint,
        background: 'rgba(255,255,255,0.08)',
        boxShadow: `0 0 26px ${tone.glow}`
      }}
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/40">
        {drop.image_url ? (
          <img src={drop.image_url} alt={drop.name} className="h-10 w-10 object-contain" />
        ) : (
          <Icon className="h-6 w-6" style={{ color: tone.tint }} />
        )}
        {drop.quantity > 1 && (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-black/80 px-1.5 text-[10px] font-bold text-white">
            ×{drop.quantity}
          </span>
        )}
      </div>
      {/* Truncated rather than wrapped: an even row of tiles survives one long
          item name, and the full name is a hover away. */}
      <p className="mt-1.5 w-full truncate text-center text-xs font-bold text-white" title={drop.name}>
        {drop.name}
      </p>
      <p className="text-[10px] font-semibold" style={{ color: tone.tint }}>{tone.label}</p>
    </div>
  )
}

const durationOf = (anim) => (anim ? (anim.frames / anim.fps) * 1000 : 500)

/**
 * One fighter. `action` and `travel` are driven by the battle, not by clicking.
 *
 * `enter` is the fallback entrance for a config with no arrival sheet: nothing
 * to play, so the figure fades onto the floor instead. The keyframes take over
 * the transform for their half second, which is harmless — a fighter only
 * travels once the quiz is unlocked, and that is after the entrance.
 */
const Fighter = ({ config, action, scale, flip, flash, fade = false, enter = false, reverse = false, travel = 0, boxRef }) => {
  const { anim, src, renderScale, footPad, shiftX, shiftY } =
    spriteMetrics(config, action, scale, flip)

  // A recoloured monster (see the placeholder variants in eventMonsters) carries
  // its own filter, which has to survive the hit flash or it changes species
  // every time it is struck.
  const tint = config.filter ? ` ${config.filter}` : ''

  return (
    <div
      ref={boxRef}
      className={enter ? 'animate-spawn-fade' : undefined}
      style={{
        marginBottom: -footPad,
        transform: `translateX(${travel}px)`,
        transition: `transform ${APPROACH}ms linear`
      }}
    >
      <div style={{ transform: shiftX || shiftY ? `translate(${shiftX}px, ${shiftY}px)` : undefined }}>
        <SpriteAnimation
          key={action}
          src={src}
          frameWidth={config.frameWidth}
          frameHeight={config.frameHeight}
          frameCount={anim?.frames}
          fps={anim?.fps || 10}
          loop={action === 'idle' || action === 'run' || action === 'walk'}
          scale={renderScale}
          flip={flip}
          smooth={config.smooth}
          reverse={reverse}
          style={{
            filter: flash
              ? `drop-shadow(0 4px 6px rgba(0,0,0,0.5)) brightness(2.2) saturate(0.3)${tint}`
              : `drop-shadow(0 4px 6px rgba(0,0,0,0.5))${tint}`,
            opacity: fade ? 0 : 1,
            transition: 'filter 0.12s, opacity 0.5s ease-in'
          }}
        />
      </div>
    </div>
  )
}

// No heart on these bars. The hero's is green and the monster's is red, and
// that pairing is what says which side is which at a glance — a red heart
// under the green one fights it. The bar's own colour already reads as health;
// the icon is only needed where ATK and DEF have to be told apart.
const HpBar = ({ value, max, align = 'left', color }) => (
  <div className={`w-40 md:w-56 ${align === 'right' ? 'ml-auto' : ''}`}>
    <div className="h-3 overflow-hidden rounded-full border border-black/30 bg-black/40">
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${Math.max(0, (value / max) * 100)}%`, background: color }}
      />
    </div>
    <div className={`mt-1 text-xs font-bold text-white drop-shadow ${align === 'right' ? 'text-right' : ''}`}>
      {Math.max(0, value)} / {max}
    </div>
  </div>
)

/**
 * The student's lives, as hearts rather than a bar.
 *
 * Three of them, and a wrong answer takes one. A bar was the wrong picture the
 * moment the number got this small: a third of a bar disappearing is a fraction
 * to work out, where a heart going dark is a thing that happened.
 */
const Lives = ({ left, total }) => (
  <div className="flex gap-1.5">
    {Array.from({ length: total }, (_, i) => (
      <img
        key={i}
        src="/event/icon/heart.png"
        alt=""
        className={`h-6 w-6 object-contain transition-all duration-300 md:h-7 md:w-7 ${
          i < left ? 'drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]' : 'opacity-25 grayscale'
        }`}
      />
    ))}
    <span className="sr-only">{left} / {total} mạng</span>
  </div>
)

/**
 * The passage a round is about — shown before the first question, and again
 * whenever it is asked for mid-fight.
 *
 * It takes the question panel's place rather than floating over the arena: the
 * fighters are still arriving while it is read, and a child who is reading
 * should be looking at the same part of the screen they will be answering in.
 *
 * Scrolls at a capped height instead of growing. The panel is `shrink-0`
 * against the arena's `flex-1`, so a long passage would otherwise push the
 * fight off a short screen — and a passage long enough to do that is one the
 * student has to scroll back through anyway.
 */
const StoryPanel = ({ story, first, timeLeft, onClose }) => (
  <div>
    <div className="mb-2 flex items-center gap-2 text-xs">
      <span className="flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2 py-0.5 font-semibold text-blue-200">
        <BookOpen className="h-3.5 w-3.5" />
        Bài đọc
      </span>
      <span className="truncate font-semibold text-white/70">{story.title}</span>
      {/* The open question's clock, still running. Same colours as the badge in
          the question header, because it is the same clock — a re-read costs
          time, and a child is owed the chance to see it going and get back. */}
      {timeLeft !== null && (
        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 font-bold tabular-nums ${
          timeLeft <= 3000
            ? 'bg-red-500/25 text-red-300'
            : timeLeft <= 6000
              ? 'bg-amber-400/20 text-amber-300'
              : 'bg-white/10 text-white/70'
        }`}>
          {Math.ceil(timeLeft / 1000)}s
        </span>
      )}
    </div>

    <div className="max-h-[34vh] overflow-y-auto pr-1">
      {/* Story art carries no answer — unlike a question's image, which is left
          undescribed on purpose — but it is still decoration beside the text it
          illustrates, so it stays out of the reading order. */}
      {story.image_url && (
        <img
          src={story.image_url}
          alt=""
          className="mx-auto mb-3 max-h-28 w-auto rounded-lg object-contain md:max-h-36"
        />
      )}
      {/* Blank lines are paragraphs and single newlines are line breaks; that
          is the whole of the format, because the passage is written in a plain
          textarea by a teacher. `whitespace-pre-line` is what keeps those
          single newlines — without it a line-per-sentence passage reflows into
          one unreadable block. */}
      {story.body.split(/\n\s*\n/).map((para, i) => (
        <p key={i} className="mb-3 whitespace-pre-line text-sm leading-relaxed text-white/90 md:text-base">
          {para.trim()}
        </p>
      ))}
    </div>

    <button
      onClick={onClose}
      className="mt-3 w-full rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
    >
      {first ? 'Đã đọc xong — Chiến đấu!' : 'Quay lại câu hỏi'}
    </button>
  </div>
)

/**
 * Full-screen quiz battle: the chosen event character against an event monster.
 * A correct answer sends the hero across the arena to swing; a wrong one sends
 * the monster. Unlike the pet boss battle, which nudges a still image with CSS,
 * both sides here have real run, attack and hurt sheets, so the exchange is the
 * sprite's own animation throughout.
 */
const EventBattle = ({
  hero,
  // Display only: how many monsters this student has beaten, plus one. Nothing
  // in the fight reads it — every student fights the same fight.
  heroLevel = 1,
  monster,
  questions = [],
  // The passage every question in this round is about, or null for a round of
  // loose questions. The caller decides which — see openEventBattle.
  story = null,
  // This stage's battle theme, or null for a silent fight. The CALLER decides
  // whether there is one: a first run at a stage gets its music and a rerun
  // does not, the same way a rerun gets its own hit points and question types.
  // Nothing here knows which kind of run this is.
  music = null,
  background,
  onClose,
  onFinish
}) => {
  // Three lives, one damage, and a monster whose hit points are the right
  // answers it takes to kill. Nothing here is per student.
  const heroMaxHp = HERO_LIVES
  const heroAtk = HERO_ATK
  const foe = monster
  const needed = foe.hp

  // Neither fighter is simply found standing there when the arena opens: each
  // one arrives, on whichever sheet arrivalOf picks for it.
  const heroArrival = useMemo(() => arrivalOf(hero), [hero])
  const foeArrival = useMemo(() => arrivalOf(monster), [monster])

  const [phase, setPhase] = useState('playing') // playing | victory | defeat
  // A round with a passage opens ON the passage: it is read first, before any
  // question is put, and can be reopened at any point in the fight — on the
  // running clock, which is what stops the passage being used as a pause.
  // 'first' is that opening read, 'again' a re-read, null the fight itself.
  const [reading, setReading] = useState(story ? 'first' : null)
  const [heroHp, setHeroHp] = useState(heroMaxHp)
  const [monsterHp, setMonsterHp] = useState(foe.hp)
  // Whether this win was a monster's FIRST defeat, which is the only thing
  // that levels anyone up now. Null until the caller reports back.
  const [levelUp, setLevelUp] = useState(false)
  const [loot, setLoot] = useState([]) // the items this kill dropped, if any
  const [chest, setChest] = useState(null) // the chest it dropped, if any — rolled apart from the items
  const [floorLoot, setFloorLoot] = useState([]) // what of that lies in the arena
  const [repeatWin, setRepeatWin] = useState(false) // a stage beaten again, for no level
  // Four of the ladder’s seven monsters have no `die` sheet. Rather than leave
  // a corpse standing there mid-idle, they recoil and fade off the floor.
  const [foeFaded, setFoeFaded] = useState(false)
  const [pickedUp, setPickedUp] = useState(false)
  // kill | death | exhausted. "exhausted" is the round ending with the monster
  // still standing and the student still on their feet: the pass mark was not
  // met. Not the per-question clock running out, which is just a wrong answer.
  const [endedBy, setEndedBy] = useState(null)
  const [qIndex, setQIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  // Questions waved past ungraded (see `skip`), so the exhausted ending can say
  // why the round ran out rather than blaming the student's answers.
  const [skippedCount, setSkippedCount] = useState(0)
  const [streak, setStreak] = useState(0)
  // Answers are locked until both entrances are done, so the first click can't
  // send a half-assembled hero across the arena.
  const [locked, setLocked] = useState(true)
  // A prompt that has gone away to wait on something slow — the spoken type,
  // sending its audio off to be transcribed. It holds the COUNTDOWN only, not
  // the answer buttons: the seconds on a question are the student's thinking
  // and speaking time, and a round trip over a school's wifi is neither.
  const [promptBusy, setPromptBusy] = useState(false)
  const [spawning, setSpawning] = useState(true)
  // What the current question came back with: { right, response }, or null
  // while it is still open. `response` is whatever its renderer chose to hand
  // over — an index, a string, a map of links — and only that renderer reads
  // it again, to draw its reveal.
  const [result, setResult] = useState(null)
  // Milliseconds left on the current question, or null when no clock is running
  // (between questions, and once the fight is over).
  const [timeLeft, setTimeLeft] = useState(null)
  // Whether the current question ended by running out rather than being
  // answered. Tracked separately instead of inferred from a null response,
  // because "they ran out of time" is a different thing to say to a student
  // than "they got it wrong", even though the monster swings either way.
  const [timedOut, setTimedOut] = useState(false)
  const [popup, setPopup] = useState(null) // { side, text }
  const [shake, setShake] = useState(false)
  const [resultVisible, setResultVisible] = useState(false)

  // Per-fighter: which sheet is playing, how far it has travelled, whether it
  // is running home (which faces it the other way), and the hit flash.
  const [heroState, setHeroState] = useState({ action: heroArrival?.animation || 'idle', travel: 0, back: false, flash: false })
  const [monsterState, setMonsterState] = useState({ action: foeArrival?.animation || 'idle', travel: 0, back: false, flash: false })

  const slashRef = useRef(null)
  const punchRef = useRef(null)
  const musicRef = useRef(null)
  const chainRef = useRef(0)
  // HP is mirrored in refs because the end-of-exchange check runs from a
  // timeout, where the state variables it closed over are already stale.
  const heroHpRef = useRef(heroMaxHp)
  const monsterHpRef = useRef(foe.hp)
  const heroBox = useRef(null)
  const monsterBox = useRef(null)
  const timers = useRef([])

  const after = useCallback((ms, fn) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // The entrance runs once, on the sheets the initial state already put on
  // screen; this only ends it. Both fighters hand back to idle together, on the
  // slower of the two, so the fight starts with the arena settled either way.
  useEffect(() => {
    const spanOf = (cfg, arrival) =>
      arrival ? durationOf(cfg.animations[arrival.animation]) : SPAWN_FADE
    after(Math.max(spanOf(hero, heroArrival), spanOf(monster, foeArrival)), () => {
      setSpawning(false)
      setHeroState((s) => ({ ...s, action: 'idle' }))
      setMonsterState((s) => ({ ...s, action: 'idle' }))
      setLocked(false)
    })
    // Mount only — a fighter never swaps mid-battle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The fight is as long as it takes: the round is not cut to a length, it is
  // ended by one of the two counters emptying. What caps it is arithmetic —
  // `needed` right answers and HERO_LIVES - 1 mistakes is the most any fight can
  // ask — so the pool is shuffled and drawn from in order until then.
  //
  // Everyone on a given day therefore answers the same questions to within the
  // mistakes they make: ten to twelve on day one, sixteen to eighteen on day
  // seven. Running out before either counter empties is a thin bank, not a
  // rule — see the exhausted ending.
  const round = useMemo(
    () => shuffle(questions).slice(0, needed + HERO_LIVES - 1),
    [questions, needed]
  )
  const question = round[qIndex]
  const lastQuestion = qIndex + 1 >= round.length

  // How this question is drawn and how it is worded. Resolved per QUESTION, not
  // per fight: a day is one kind throughout, but the boss's round is mixed, so
  // the panel cannot settle on a renderer at the start and keep it.
  const kind = questionType(question?.type)
  const Prompt = promptFor(question?.type)
  // This question's clock: its own `seconds` if it carries one, otherwise the
  // default for its type.
  const seconds = secondsFor(question)

  // A side per sound: the hero's sword, the monster's fist. They must not share
  // one — an exchange that sounded the same whether you had answered right or
  // wrong is the reason the monster was silent before it had a punch of its own.
  useEffect(() => {
    const load = (src, volume) => {
      const audio = new Audio(src)
      audio.preload = 'auto'
      audio.volume = volume
      return audio
    }
    slashRef.current = load(SLASH_SRC, SLASH_VOLUME)
    punchRef.current = load(PUNCH_SRC, PUNCH_VOLUME)

    // The win fanfare is the shared celebration's, not ours — warmed here so the
    // first win of a session still lands on the frame the monster falls.
    primeCelebration()

    return () => {
      slashRef.current = null
      punchRef.current = null
    }
  }, [])

  const playHit = useCallback((ref) => {
    const audio = ref.current
    if (!audio) return
    // Restarting beats overlapping: blows are ~1.5s apart, and a new one cutting
    // off the tail of the last is what a fresh hit should sound like. Rejects if
    // the browser is still withholding autoplay.
    try {
      audio.currentTime = 0
      audio.play().catch(() => {})
    } catch {
      // Some browsers throw on currentTime before enough is buffered.
    }
  }, [])

  /**
   * Duck the theme out and leave it out. Idempotent — the fight can end on a
   * kill, a death or an empty question pool, and unmounting calls it again.
   *
   * A fade rather than a pause: the fanfare fires on the blow that lands, and a
   * theme cut dead on that frame is heard as a glitch rather than an ending.
   */
  const stopMusic = useCallback(() => {
    const audio = musicRef.current
    if (!audio) return
    musicRef.current = null

    const TICK = 50
    const drop = audio.volume / Math.max(1, Math.round(MUSIC_FADE / TICK))
    const fade = setInterval(() => {
      const next = audio.volume - drop
      if (next <= 0.01) {
        clearInterval(fade)
        audio.pause()
        // Dropping the source frees the download; a fight can be reopened and
        // the next one builds its own element.
        audio.src = ''
      } else {
        audio.volume = next
      }
    }, TICK)
  }, [])

  /**
   * The stage's theme, for as long as the fight lasts.
   *
   * Autoplay is not a risk here even though the browser blocks it: this mounts
   * behind a tapped Fight button, and on most days behind a cutscene the
   * student also tapped through. A rejected play is swallowed all the same —
   * silence is a fine fight, and there is no audio the student has to hear.
   */
  useEffect(() => {
    if (!music) return undefined

    const audio = new Audio(music)
    audio.loop = true
    audio.volume = MUSIC_VOLUME
    audio.play().catch(() => {})
    musicRef.current = audio

    return () => {
      musicRef.current = null
      audio.pause()
      audio.src = ''
    }
  }, [music])

  useEffect(() => {
    const all = []
    for (const cfg of [hero, monster]) {
      for (const name of Object.keys(cfg.animations)) all.push(animationSrc(cfg, name))
    }
    preloadSheets(all)
  }, [hero, monster])

  // Question art is fetched up front, alongside the sprite sheets. The whole
  // round is known at mount, and an image that only began loading when its
  // question came up would pop in mid-fight and shove the arena upward as it
  // landed. Fire-and-forget: the browser cache is the point, not the handle.
  useEffect(() => {
    round.forEach((q) => {
      if (!q?.image_url) return
      const img = new Image()
      img.src = q.image_url
    })
  }, [round])

  const finish = useCallback((won, by = won ? 'kill' : 'death') => {
    setEndedBy(by)
    // The fight is over the moment this runs; what follows — the crumble, the
    // payout, the drop on the floor — is the aftermath, and it is not fought to
    // music.
    stopMusic()
    const dies = won && monster.animations.die
    if (dies) setMonsterState((s) => ({ ...s, action: 'die' }))
    else if (won) {
      setMonsterState((s) => ({ ...s, action: monster.animations.hit ? 'hit' : 'idle' }))
      setFoeFaded(true)
    }
    setPhase(won ? 'victory' : 'defeat')

    // Fanfare and confetti on the blow that lands, not when the result panel
    // opens — the panel waits on the payout and the pickup, and a celebration
    // that arrives that late is scoring a moment that has already passed.
    if (won) celebrate()

    // Nothing is announced until the corpse has finished crumbling, or the fade
    // has taken the place of one.
    const settled = new Promise((resolve) => after(dies ? 1100 : won ? 800 : 400, resolve))

    // The caller banks the XP and rolls for loot, then reports both back, so the
    // result screen can show the payout without this component knowing either
    // the levelling rules or the drop table.
    const payout = Promise.resolve(onFinish?.({ won, correct: correctCount, total: qIndex + 1, monster }))
      .then((paid) => {
        if (paid?.levelUp) setLevelUp(true)
        if (paid?.loot?.length) setLoot(paid.loot)
        if (paid?.chest) setChest(paid.chest)
        if (paid?.firstClear === false) setRepeatWin(true)
        return paid
      })
      .catch(() => null)

    // The result panel waits for the payout however long it takes, so a drop
    // always gets its moment on the floor.
    //
    // This used to RACE the payout against a timer, and the race was lost by the
    // one win that had anything to show: a first clear banks a clear, rolls the
    // drop, and is the only outcome whose chance is 1: several round trips, on
    // the exact fight that pays out. Losing the race meant the panel opened over
    // an empty floor and the loot was first seen on a card — the modal "showing
    // right away". The timer below is now a failsafe for a request that never
    // comes back at all, not a deadline the payout has to beat.
    let ended = false
    const showResult = () => {
      if (ended) return
      ended = true
      setResultVisible(true)
    }

    // Everything the win paid lands on the floor together, chest last — it is
    // the prize, and the eye should end the row on it. The chest used to be held
    // back whenever items also dropped, on the grounds that a box beside its
    // contents reads as a pile; that was written when the floor held one item on
    // a timer, and it meant the best thing in the payout was the one thing that
    // skipped the floor and appeared in the panel instead.
    Promise.all([settled, payout]).then(([, paid]) => {
      if (ended) return
      const grounded = [
        ...(paid?.loot || []),
        ...(paid?.chest ? [asFloorDrop(paid.chest)] : [])
      ]
      if (won && grounded.length) {
        ended = true
        setFloorLoot(grounded)
      } else {
        showResult()
      }
    })

    after(PAYOUT_TIMEOUT, showResult)
  }, [correctCount, qIndex, onFinish, monster, after, stopMusic])

  // The drop waits to be picked up. It used to give way to the result panel on a
  // timer, which meant the panel slid over the loot while the student was still
  // reaching for it — the reward you have to take is the one you remember, and
  // it was being handed over on the way past. Nothing is stuck behind this: the
  // loot is banked the moment the roll resolves, and the close button in the
  // corner is live throughout.
  const pickUpLoot = () => {
    if (pickedUp) return
    setPickedUp(true)
    after(420, () => setResultVisible(true))
  }

  // Measured from the live boxes rather than assumed, because the arena is a
  // percentage layout — the distance differs on every viewport.
  //
  // The edges that matter are the figures' facing edges, not the boxes'. A
  // frame box runs far wider than the art inside it, and by different amounts
  // per character, so closing box-to-box left the two sprites standing roughly
  // 100px apart with nothing but empty pixels between them. Subtracting each
  // side's gutter closes the distance the viewer can actually see.
  //
  // One number serves both directions: whichever side is charging, the gap
  // being closed is between the hero's right edge and the monster's left.
  const gapToCross = () => {
    const h = heroBox.current?.getBoundingClientRect()
    const m = monsterBox.current?.getBoundingClientRect()
    if (!h || !m) return 0
    // The monster is drawn mirrored while it faces the hero.
    const heroFront = h.right - bodyPad(hero, FIGHTER_SCALE).right
    const monsterFront = m.left + bodyPad(monster, FIGHTER_SCALE, true).left
    return Math.max(0, monsterFront - heroFront - MELEE_OVERLAP)
  }

  /**
   * Run in, swing, run home. Returns how long the whole thing takes so the
   * caller can schedule what happens next.
   */
  const chargeAndStrike = (side, attackName, onImpact) => {
    const isHero = side === 'hero'
    const cfg = isHero ? hero : monster
    const setState = isHero ? setHeroState : setMonsterState

    const moveAnim = cfg.animations.run ? 'run' : cfg.animations.walk ? 'walk' : null
    const attackDur = durationOf(cfg.animations[attackName])
    const dist = moveAnim ? gapToCross() : 0
    const travel = isHero ? dist : -dist
    const canMove = Boolean(moveAnim) && dist > 4

    let t = 0
    if (canMove) {
      setState({ action: moveAnim, travel, back: false, flash: false })
      t = APPROACH
    }

    after(t, () => setState((s) => ({ ...s, action: attackName })))
    after(t + attackDur * IMPACT_AT, onImpact)

    const homeAt = t + attackDur
    if (canMove) {
      // Facing flips for the run home, so they don't moonwalk back.
      after(homeAt, () => setState({ action: moveAnim, travel: 0, back: true, flash: false }))
      after(homeAt + APPROACH, () => setState({ action: 'idle', travel: 0, back: false, flash: false }))
      return homeAt + APPROACH + SETTLE
    }

    after(homeAt, () => setState({ action: 'idle', travel: 0, back: false, flash: false }))
    return homeAt + SETTLE
  }

  /**
   * One exchange, from an answered question to the next one.
   *
   * The engine takes a boolean and nothing else. Every kind of question — a
   * tapped choice, a typed word, a rebuilt sentence — grades itself in its own
   * renderer and arrives here the same way, which is why adding a kind touches
   * no part of the fight: the charge, the swing, the streak doubling and the
   * win check below never learn what was asked.
   *
   * `response` is passed straight back to the renderer as `result.response`
   * so it can show what was picked; the battle never interprets it.
   */
  const resolve = (right, response = null) => {
    if (locked || !question) return
    setLocked(true)
    setResult({ right, response })

    const chain = hero.attackChain?.length ? hero.attackChain : ['attack1']
    let total

    if (right) {
      const swing = chain[chainRef.current % chain.length]
      chainRef.current += 1
      setCorrectCount((c) => c + 1)
      setStreak((s) => s + 1)

      total = chargeAndStrike('hero', swing, () => {
        // One right answer, one point off the monster. FLAT — no streak bonus,
        // no multiplier anywhere in the fight. A doubling sounds harmless and is
        // not: it breaks the one promise the whole model is built on, that a
        // monster's hit points are the right answers it takes to kill. With a
        // x2 on three in a row, a flawless day seven died in nine questions
        // instead of sixteen, and the day-to-day ramp flattened with it.
        playHit(slashRef)
        const damage = heroAtk
        monsterHpRef.current = Math.max(0, monsterHpRef.current - damage)
        setMonsterHp(monsterHpRef.current)
        setMonsterState((s) => ({ ...s, action: 'hit', flash: true }))
        setPopup({ side: 'monster', text: `-${damage}` })
        setShake(true)
        after(200, () => {
          setMonsterState((s) => ({ ...s, action: 'idle', flash: false }))
          setShake(false)
        })
      })
    } else {
      setStreak(0)
      total = chargeAndStrike('monster', monster.animations.attack ? 'attack' : 'idle', () => {
        playHit(punchRef)
        // A wrong answer costs a life. Not doubled on a run of them, unlike the
        // hero's streak: at three lives a doubled miss is most of a fighter, and
        // being punished twice over for a bad patch is not what a reading
        // exercise is for. Streaks reward; nothing punishes beyond the miss.
        const damage = 1
        heroHpRef.current = Math.max(0, heroHpRef.current - damage)
        setHeroHp(heroHpRef.current)
        setHeroState((s) => ({ ...s, action: hero.animations.hit ? 'hit' : 'idle', flash: true }))
        setPopup({ side: 'hero', text: `-${damage}` })
        setShake(true)
        after(200, () => {
          setHeroState((s) => ({ ...s, action: 'idle', flash: false }))
          setShake(false)
        })
      })
    }

    after(total, () => {
      setPopup(null)
      setResult(null)
      setTimedOut(false)

      // Whichever counter empties first ends it, on the question it emptied on.
      if (monsterHpRef.current <= 0) finish(true)
      else if (heroHpRef.current <= 0) finish(false)
      // The pool ran dry with both still standing. Not a rule of the fight —
      // the round is drawn long enough that this cannot happen — but a day whose
      // bank is short of questions, which is a loss the student did not earn and
      // a message the teacher needs to see.
      else if (lastQuestion) finish(false, 'exhausted')
      else {
        setQIndex((i) => i + 1)
        setLocked(false)
      }
    })
  }

  /**
   * A question that could not be graded — the spoken type, with no microphone or
   * a transcription that failed. Neither fighter swings: a broken mic must not
   * cost a life, and it must not deal damage either, or denying the microphone
   * becomes a way to win a replay (and its loot) without saying a word.
   *
   * The round is drawn only as long as a fight needs, so skips eat into it, and
   * enough of them run it out — the exhausted ending, a loss that pays nothing.
   */
  const skip = () => {
    if (locked || !question) return
    setSkippedCount((n) => n + 1)
    setResult(null)
    setTimedOut(false)
    if (lastQuestion) {
      setLocked(true)
      finish(false, 'exhausted')
    } else {
      setQIndex((i) => i + 1)
    }
  }

  const over = phase !== 'playing'

  // The countdown reaches `resolve` through a ref rather than naming it as a
  // dependency: `resolve` is rebuilt on every render, so depending on it would
  // tear the interval down and restart it continuously and the clock would never
  // actually reach zero.
  const resolveRef = useRef(resolve)
  useEffect(() => { resolveRef.current = resolve })

  // The current question's clock, kept across the pauses that tear the interval
  // below down: how much is left, and which question it is left on. Without it
  // a question that was interrupted would come back on a full clock.
  const clock = useRef({ question: null, left: 0 })

  useEffect(() => {
    // No clock while the arena is still assembling, during an exchange, before
    // the opening read is done, or once the fight is decided — `locked` covers
    // the first two.
    //
    // Only the OPENING read is untimed, and only because no question has been
    // put yet. A re-read mid-fight runs the clock down like any other second:
    // pausing it turned the passage into a stop button — open the story, take as
    // long as you like over the answer, close it — which is not reading, it is a
    // way round the timer. The countdown stays on screen while the passage is
    // open (see StoryPanel) so the cost is visible rather than sprung.
    // `promptBusy` joins the pause list rather than the reveal's: the question
    // has been ANSWERED by the time it is set — the phrase is spoken and the
    // audio is in flight — so running the clock down over it would time out a
    // student who has already done the thing being timed.
    if (locked || promptBusy || reading === 'first' || over || !question) {
      setTimeLeft(null)
      return undefined
    }

    // A question gets its full time once. Every later run of this effect is the
    // same question resuming out of a pause, on what was banked when the clock
    // last stopped, so a pause never hands back a fresh clock.
    if (clock.current.question !== question) {
      clock.current = { question, left: seconds * 1000 }
    }
    const limit = clock.current.left
    // Measured against a wall-clock deadline rather than counted down tick by
    // tick, so a tab that gets throttled in the background cannot quietly hand
    // out extra time, and a slow frame cannot steal any.
    const deadline = Date.now() + limit
    setTimeLeft(limit)

    const id = setInterval(() => {
      const left = deadline - Date.now()
      setTimeLeft(Math.max(0, left))
      if (left > 0) return
      clearInterval(id)
      // Running out is a wrong answer: the monster swings, the miss streak
      // builds, and the reveal still shows the right answer so the question is
      // not wasted.
      //
      // The passage closes on the way, if it was open. The reveal is the whole
      // consolation for a question lost to the clock, and leaving the story over
      // it would spend the timeout on nothing.
      setReading(null)
      setTimedOut(true)
      resolveRef.current(false, null)
    }, 100)

    // Bank what is left, so whatever stopped the clock — an exchange, the fight
    // ending — gives it back rather than refilling it.
    return () => {
      clearInterval(id)
      clock.current.left = Math.max(0, deadline - Date.now())
    }
  }, [question, locked, promptBusy, reading, over, seconds])

  // The shadow under a row of drops takes the colour of the best thing in it.
  const floorTone = LOOT_RARITY[rarestOf(floorLoot)] || LOOT_RARITY.common

  // The scene fills the whole screen, including behind the question panel, so
  // the panel's blur has something to blur and the two halves read as one
  // continuous view rather than a picture sitting on a black box.
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-slate-900"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        // The arena art is painted rather than pixel art, so it is scaled up
        // smoothly. The sprites set their own image-rendering, which is what
        // keeps them crisp against it — this property inherits.
        imageRendering: 'auto',
        transform: shake ? 'translateX(4px)' : 'none',
        transition: 'transform 0.06s'
      }}
    >
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-transparent to-slate-900/40" />

        <button
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="absolute inset-x-0 top-0 z-20 flex justify-between gap-4 p-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-white drop-shadow">
              {hero.name}
              <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold backdrop-blur-sm">
                Cấp {heroLevel}
              </span>
            </div>
            <Lives left={heroHp} total={heroMaxHp} />
          </div>
          <div>
            <div className="mb-1 text-right text-sm font-bold text-white drop-shadow">{monster.name}</div>
            <HpBar value={monsterHp} max={foe.hp} align="right" color="linear-gradient(90deg,#f43f5e,#f97316)" />
            {/* The pass mark, said out loud: the bar is in hit points, and at one
                damage a hit point is a right answer. */}
            <div className="mt-1 text-right text-[10px] font-bold text-amber-200/90">
              Còn {monsterHp} câu đúng nữa
            </div>
          </div>
        </div>

        {/* Fighters stand on a common floor line */}
        <div className="absolute inset-x-0 bottom-[12%] z-10 flex items-end justify-between px-[8%] md:px-[14%]">
          <div className="relative">
            {popup?.side === 'hero' && (
              <span className="animate-float-up absolute -top-6 left-1/2 z-10 -translate-x-1/2 text-2xl font-black text-red-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">
                {popup.text}
              </span>
            )}
            <Fighter
              config={hero}
              action={heroState.action}
              travel={heroState.travel}
              flip={heroState.back}
              flash={heroState.flash}
              enter={spawning && !heroArrival}
              reverse={spawning && Boolean(heroArrival?.reverse)}
              scale={FIGHTER_SCALE}
              boxRef={heroBox}
            />
          </div>

          <div className="relative">
            {popup?.side === 'monster' && (
              <span className="animate-float-up absolute -top-6 left-1/2 z-10 -translate-x-1/2 text-2xl font-black text-yellow-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">
                {popup.text}
              </span>
            )}
            <Fighter
              config={monster}
              action={monsterState.action}
              travel={monsterState.travel}
              flip={!monsterState.back}
              flash={monsterState.flash}
              fade={foeFaded}
              enter={spawning && !foeArrival}
              reverse={spawning && Boolean(foeArrival?.reverse)}
              scale={FIGHTER_SCALE}
              boxRef={monsterBox}
            />

            {floorLoot.length > 0 && (
              <>
                {/* The shadow stays on the floor while the drops bob above it, so
                    it sits outside the animated button rather than riding along.
                    It widens with the row so a haul of three is not balanced on
                    one item's worth of shadow. */}
                <span
                  className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-2.5 -translate-x-1/2 rounded-full opacity-60 blur-md"
                  style={{ background: floorTone.tint, width: `${3.5 * floorLoot.length}rem` }}
                />
                {/* Nothing moves on until this is clicked, so it has to be
                    obvious that it is waiting for one. Gone the moment the
                    collect animation starts. */}
                {!pickedUp && (
                  <span className="animate-loot-hint pointer-events-none absolute bottom-20 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                    Nhấn để nhặt
                  </span>
                )}
                {/* One button for the whole haul: the drops are already banked,
                    so picking up is a single gesture rather than a chore that
                    scales with how well the fight went. The keyframes carry the
                    centring translate, which is why the row is not offset here. */}
                <button
                  type="button"
                  onClick={pickUpLoot}
                  aria-label={floorLoot.length > 1 ? `Nhặt ${floorLoot.length} vật phẩm` : `Nhặt ${floorLoot[0].name}`}
                  className={`absolute bottom-1 left-1/2 z-20 flex cursor-pointer gap-2 ${
                    pickedUp ? 'animate-loot-collect' : 'animate-loot-drop'
                  }`}
                >
                  {floorLoot.map((drop, i) => {
                    const tone = LOOT_RARITY[drop.rarity] || LOOT_RARITY.common
                    return (
                      <span
                        key={`${drop.id || drop.name}-${i}`}
                        className="relative flex h-14 w-14 items-center justify-center rounded-xl border bg-black/50"
                        style={{ borderColor: tone.tint, boxShadow: `0 0 22px ${tone.glow}` }}
                      >
                        {drop.image_url ? (
                          <img src={drop.image_url} alt="" className="h-11 w-11 object-contain" />
                        ) : drop.chest ? (
                          // The same icon its card uses — one object should not
                          // be a parcel on the floor and a gift in the panel.
                          <Gift className="h-7 w-7" style={{ color: tone.tint }} />
                        ) : (
                          <Package className="h-7 w-7" style={{ color: tone.tint }} />
                        )}
                        {drop.quantity > 1 && (
                          <span className="absolute -bottom-1 -right-1 rounded-full bg-black/80 px-1.5 text-[10px] font-bold text-white">
                            ×{drop.quantity}
                          </span>
                        )}
                      </span>
                    )
                  })}
                </button>
              </>
            )}
          </div>
        </div>

        {over && resultVisible && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 text-center">
            <div className={`text-4xl font-black drop-shadow ${phase === 'victory' ? 'text-yellow-300' : 'text-red-400'}`}>
              {phase === 'victory' ? 'Chiến thắng!' : 'Thất bại!'}
            </div>
            {/* Out of what was ASKED, not out of what was drawn: the round is
                cut long enough for the worst case and ends the moment the
                monster falls, so its length is nobody's score. */}
            <p className="mt-2 text-white/80">Đúng {correctCount}/{qIndex + 1} câu</p>
            {endedBy === 'exhausted' && (
              <p className="mt-1 text-sm text-white/60">
                Hết câu hỏi — cần {needed} câu đúng để hạ {monster.name}
              </p>
            )}
            {endedBy === 'exhausted' && skippedCount > 0 && (
              <p className="mt-1 text-xs text-white/50">
                Bỏ qua {skippedCount} câu vì không chấm được giọng nói
              </p>
            )}
            {/* No points to hand out any more — a level is a monster beaten and
                nothing else, so this says that and stops. */}
            {levelUp && phase === 'victory' && (
              <p className="mt-1 text-lg font-bold text-yellow-300 drop-shadow">
                Lên cấp!
              </p>
            )}
            {repeatWin && (
              <p className="mt-1 text-xs text-white/50">Đã hạ gục trước đó — không lên cấp</p>
            )}
            {/* The whole payout on one line, in the order it lay on the floor —
                items then the chest — so the panel confirms what was just picked
                up rather than re-announcing it piece by piece. One heading over
                the row, not one per drop. */}
            {(loot.length > 0 || chest) && (
              <div className="mt-4 w-full max-w-md px-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                  Chiến lợi phẩm
                </p>
                <div className="mt-2 flex flex-wrap items-start justify-center gap-2">
                  {loot.map((drop, i) => (
                    <LootTile key={`${drop.id || drop.name}-${i}`} drop={drop} />
                  ))}
                  {chest && <LootTile drop={asFloorDrop(chest)} icon={Gift} />}
                </div>
                {chest && (
                  <p className="mt-2 text-xs text-white/50">Mở rương trong Kho đồ</p>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
            >
              Đóng
            </button>
          </div>
        )}
      </div>

      {/* Question panel. Translucent over a blur rather than a solid fill, so
          the arena still reads through it and the two halves feel like one
          screen. Cut corners and the gradient edge match the dashboard hero. */}
      <div
        className="relative shrink-0 border-t border-white/10 bg-slate-900/80 p-4 backdrop-blur-md md:p-6"
        style={{ clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)' }}
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-transparent" />

        {/* The clock as a bar across the panel's top edge. The badge in the
            header gives the number; this gives the same thing without having to
            be read, which is what a student under pressure actually uses. */}
        {timeLeft !== null && (
          <div
            className={`absolute left-0 top-0 h-[3px] transition-[width] duration-100 ease-linear ${
              timeLeft <= 3000 ? 'bg-red-500' : timeLeft <= 6000 ? 'bg-amber-400' : 'bg-blue-400'
            }`}
            style={{ width: `${(timeLeft / (seconds * 1000)) * 100}%` }}
          />
        )}

        {reading && !over ? (
          <StoryPanel
            story={story}
            first={reading === 'first'}
            timeLeft={timeLeft}
            onClose={() => setReading(null)}
          />
        ) : question && !over ? (
          <>
            <div className="mb-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-wide text-white/50">
                  Câu {qIndex + 1}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-white/70">
                  {kind.label}
                </span>
                {timeLeft !== null && (
                  <span className={`rounded-full px-2 py-0.5 font-bold tabular-nums ${
                    timeLeft <= 3000
                      ? 'bg-red-500/25 text-red-300'
                      : timeLeft <= 6000
                        ? 'bg-amber-400/20 text-amber-300'
                        : 'bg-white/10 text-white/70'
                  }`}>
                    {Math.ceil(timeLeft / 1000)}s
                  </span>
                )}
                {timedOut && (
                  <span className="rounded-full bg-red-500/25 px-2 py-0.5 font-bold text-red-300">
                    Hết giờ!
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Encouragement, not a mechanic: the streak does nothing to the
                    damage, and saying it does would be a lie the HP bar tells on
                    the very next hit. */}
                {streak >= 2 && (
                  <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 font-bold text-yellow-300">
                    Chuỗi {streak} 🔥
                  </span>
                )}
                {/* Hidden mid-exchange rather than disabled: what the panel is
                    showing then is the reveal of the answer just given, and the
                    passage would cover the one thing a wrong answer is worth. */}
                {/* Says the clock keeps going, because it does: a student who
                    finds that out by losing a question learns not to look back
                    at the text, which is the opposite of the lesson. */}
                {story && !locked && (
                  <button
                    onClick={() => setReading('again')}
                    title="Đồng hồ vẫn chạy khi đọc lại"
                    className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 font-semibold text-white/70 hover:bg-white/20 hover:text-white"
                  >
                    <BookOpen className="h-3 w-3" />
                    Đọc lại
                  </button>
                )}
              </div>
            </div>

            <p className="mb-1 text-center text-lg font-semibold text-white drop-shadow md:text-xl">
              {question.question}
            </p>
            {/* Question art, for the rows that have it — it works with every
                type, so a photo over a fill_blank stem turns it into naming the
                picture without a new kind of question.

                Height is CAPPED rather than natural: this panel is `shrink-0`
                against the arena's `flex-1`, so every pixel the image takes is
                a pixel the fight loses.

                alt is empty on purpose, and not only because the image is
                decoration — describing it would hand the answer to anyone
                reading it out. Same reason the pet quizzes leave it blank. */}
            {question.image_url && (
              <img
                src={question.image_url}
                alt=""
                className="mx-auto my-2 max-h-24 w-auto rounded-lg object-contain md:max-h-32"
              />
            )}
            {/* What is being asked of them. A day is one kind of question
                throughout, but the boss mixes all six, so the instruction has to
                be on the question rather than announced once at the start. */}
            <p className="mb-4 text-center text-xs text-white/45">{kind.hint}</p>

            <Prompt
              question={question}
              disabled={locked}
              result={result}
              onAnswer={resolve}
              onSkip={skip}
              onBusy={setPromptBusy}
            />
          </>
        ) : (
          !over && <p className="text-center text-white/60">Chưa có câu hỏi nào.</p>
        )}
      </div>
    </div>,
    document.body
  )
}

export default EventBattle
