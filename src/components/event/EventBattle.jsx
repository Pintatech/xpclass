import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import SpriteAnimation from '../ui/SpriteAnimation'
import { preloadSheets } from '../ui/spriteSheetCache'
import { animationSrc, bodyPad, spriteMetrics } from '../../config/eventCharacter'
import { STATS, damageFrom, scaleMonster } from '../../config/eventStats'

const QUESTION_COUNT = 10

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

// Served from our own origin rather than the ui-assets bucket, like the rest of
// the event art. The elsewhere-in-the-repo idiom is a fresh Audio() per play,
// but a swing has to be heard on the frame it lands, and the first one would
// still be fetching — so this is loaded once when the battle opens.
const SLASH_SRC = `${import.meta.env.BASE_URL}event/sfx/sword-slash.mp3`
const SLASH_VOLUME = 0.45

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

const durationOf = (anim) => (anim ? (anim.frames / anim.fps) * 1000 : 500)

/** One fighter. `action` and `travel` are driven by the battle, not by clicking. */
const Fighter = ({ config, action, scale, flip, flash, travel = 0, boxRef }) => {
  const { anim, src, renderScale, footPad, shiftX, shiftY } =
    spriteMetrics(config, action, scale, flip)

  return (
    <div
      ref={boxRef}
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
          style={{
            filter: flash
              ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.5)) brightness(2.2) saturate(0.3)'
              : 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))',
            transition: 'filter 0.12s'
          }}
        />
      </div>
    </div>
  )
}

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

/** ATK/DEF beside the HP bar, so a spent point is visible in the fight itself. */
const StatChips = ({ atk, def, align = 'left' }) => (
  <div className={`mt-1 flex gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
    {STATS.filter((stat) => stat.key !== 'hp').map((stat) => (
      <span
        key={stat.key}
        className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white drop-shadow"
        style={{ background: `${stat.color}cc` }}
      >
        {stat.short} {stat.key === 'atk' ? atk : def}
      </span>
    ))}
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
  heroStats,
  heroLevel = 1,
  monster,
  questions = [],
  background,
  onClose,
  onFinish
}) => {
  // The monster is read once, at the level the fight starts on, so levelling up
  // from this battle's reward can't move the goalposts mid-fight.
  const foe = useMemo(() => scaleMonster(monster, heroLevel), [monster, heroLevel])
  const heroMaxHp = heroStats?.maxHp || 30
  const heroAtk = heroStats?.atk || 6
  const heroDef = heroStats?.def || 3

  const [phase, setPhase] = useState('playing') // playing | victory | defeat
  const [heroHp, setHeroHp] = useState(heroMaxHp)
  const [monsterHp, setMonsterHp] = useState(foe.maxHp)
  const [reward, setReward] = useState(null)
  const [endedBy, setEndedBy] = useState(null) // kill | death | timeout
  const [qIndex, setQIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [locked, setLocked] = useState(false)
  const [picked, setPicked] = useState(null)
  const [popup, setPopup] = useState(null) // { side, text }
  const [shake, setShake] = useState(false)
  const [resultVisible, setResultVisible] = useState(false)

  // Per-fighter: which sheet is playing, how far it has travelled, whether it
  // is running home (which faces it the other way), and the hit flash.
  const [heroState, setHeroState] = useState({ action: 'idle', travel: 0, back: false, flash: false })
  const [monsterState, setMonsterState] = useState({ action: 'idle', travel: 0, back: false, flash: false })

  const slashRef = useRef(null)
  const chainRef = useRef(0)
  // HP is mirrored in refs because the end-of-exchange check runs from a
  // timeout, where the state variables it closed over are already stale.
  const heroHpRef = useRef(heroMaxHp)
  const monsterHpRef = useRef(foe.maxHp)
  const heroBox = useRef(null)
  const monsterBox = useRef(null)
  const timers = useRef([])

  const after = useCallback((ms, fn) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const round = useMemo(() => shuffle(questions).slice(0, QUESTION_COUNT), [questions])
  const question = round[qIndex]

  const choices = useMemo(() => {
    if (!question) return []
    return shuffle(question.choices.map((text, i) => ({ text, index: i })))
  }, [question])

  // Hero swings only — the monster's blows land on their own hit flash and
  // shake, and giving both sides the same slash made every exchange sound the
  // same whether you had answered right or wrong.
  useEffect(() => {
    const audio = new Audio(SLASH_SRC)
    audio.preload = 'auto'
    audio.volume = SLASH_VOLUME
    slashRef.current = audio
    return () => { slashRef.current = null }
  }, [])

  const playSlash = useCallback(() => {
    const audio = slashRef.current
    if (!audio) return
    // Restarting beats overlapping: swings are ~1.5s apart, and a new slash
    // cutting off the tail of the last one is what a fresh hit should sound
    // like. Rejects if the browser is still withholding autoplay.
    try {
      audio.currentTime = 0
      audio.play().catch(() => {})
    } catch {
      // Some browsers throw on currentTime before enough is buffered.
    }
  }, [])

  useEffect(() => {
    const all = []
    for (const cfg of [hero, monster]) {
      for (const name of Object.keys(cfg.animations)) all.push(animationSrc(cfg, name))
    }
    preloadSheets(all)
  }, [hero, monster])

  const finish = useCallback((won, by = won ? 'kill' : 'death') => {
    setEndedBy(by)
    const dies = won && monster.animations.die
    if (dies) setMonsterState((s) => ({ ...s, action: 'die' }))
    setPhase(won ? 'victory' : 'defeat')
    after(dies ? 1100 : 400, () => setResultVisible(true))
    // The caller writes the XP and reports how much it was worth, so the result
    // screen can show it without this component knowing the levelling rules.
    Promise.resolve(onFinish?.({ won, correct: correctCount, total: round.length, monster }))
      .then((xp) => { if (typeof xp === 'number') setReward(xp) })
      .catch(() => {})
  }, [correctCount, round.length, onFinish, monster, after])

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

  const answer = (choice) => {
    if (locked || !question) return
    setLocked(true)
    setPicked(choice.index)

    const right = choice.index === question.answer_index
    const chain = hero.attackChain?.length ? hero.attackChain : ['attack1']
    let total

    if (right) {
      const swing = chain[chainRef.current % chain.length]
      chainRef.current += 1
      setCorrectCount((c) => c + 1)
      setStreak((s) => s + 1)

      total = chargeAndStrike('hero', swing, () => {
        // The streak bonus doubles the swing before armour, so it stays worth
        // chasing however much DEF the monster has stacked up.
        playSlash()
        const damage = damageFrom(heroAtk, foe.def, streak >= 2 ? 2 : 1)
        monsterHpRef.current -= damage
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
        const damage = damageFrom(foe.atk, heroDef)
        heroHpRef.current -= damage
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
      setPicked(null)

      if (monsterHpRef.current <= 0) finish(true)
      else if (heroHpRef.current <= 0) finish(false)
      else if (qIndex + 1 >= round.length) {
        // Out of questions with both still standing: whoever kept the larger
        // share of their health takes it. Making this an automatic loss is what
        // an earlier version did, and it quietly made HP and DEF worthless —
        // ten questions cap the swings, so surviving longer has to be a way to
        // win or the only stat that matters is ATK.
        finish(heroHpRef.current / heroMaxHp > monsterHpRef.current / foe.maxHp, 'timeout')
      } else {
        setQIndex((i) => i + 1)
        setLocked(false)
      }
    })
  }

  const over = phase !== 'playing'

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
        imageRendering: 'pixelated',
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
            <HpBar value={heroHp} max={heroMaxHp} color="linear-gradient(90deg,#22c55e,#84cc16)" />
            <StatChips atk={heroAtk} def={heroDef} />
          </div>
          <div>
            <div className="mb-1 text-right text-sm font-bold text-white drop-shadow">{monster.name}</div>
            <HpBar value={monsterHp} max={foe.maxHp} align="right" color="linear-gradient(90deg,#f43f5e,#f97316)" />
            <StatChips atk={foe.atk} def={foe.def} align="right" />
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
              scale={FIGHTER_SCALE}
              boxRef={monsterBox}
            />
          </div>
        </div>

        {over && resultVisible && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 text-center">
            <div className={`text-4xl font-black drop-shadow ${phase === 'victory' ? 'text-yellow-300' : 'text-red-400'}`}>
              {phase === 'victory' ? 'Chiến thắng!' : 'Thất bại!'}
            </div>
            <p className="mt-2 text-white/80">Đúng {correctCount}/{round.length} câu</p>
            {endedBy === 'timeout' && (
              <p className="mt-1 text-sm text-white/60">
                Hết câu hỏi — {phase === 'victory' ? 'bạn còn nhiều máu hơn' : 'đối thủ còn nhiều máu hơn'}
              </p>
            )}
            {reward !== null && (
              <p className="mt-1 text-lg font-bold text-yellow-300 drop-shadow">+{reward} EXP</p>
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

        {question && !over ? (
          <>
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="font-semibold tracking-wide text-white/50">
                Câu {qIndex + 1}/{round.length}
              </span>
              {streak >= 2 && (
                <span className="rounded-full bg-yellow-400/20 px-2 py-0.5 font-bold text-yellow-300">
                  Chuỗi {streak} · sát thương x2
                </span>
              )}
            </div>

            <p className="mb-4 text-center text-lg font-semibold text-white drop-shadow md:text-xl">
              {question.question}
            </p>

            <div className="mx-auto grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2">
              {choices.map((choice, i) => {
                const isRight = choice.index === question.answer_index
                const show = picked !== null
                const tone = show && isRight
                  ? 'border-green-400/80 bg-green-500/25 text-white'
                  : show && picked === choice.index
                    ? 'border-red-400/80 bg-red-500/25 text-white'
                    : 'border-white/15 bg-white/[0.07] text-white hover:border-white/30 hover:bg-white/15'
                return (
                  <button
                    key={choice.index}
                    onClick={() => answer(choice)}
                    disabled={locked}
                    style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                    className={`flex items-center gap-3 border px-4 py-3 text-left font-medium transition-colors disabled:cursor-default ${tone}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white/15 text-xs font-bold">
                      {'ABCD'[i]}
                    </span>
                    <span>{choice.text}</span>
                  </button>
                )
              })}
            </div>
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
