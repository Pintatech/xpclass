import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { AlertTriangle, ArrowRight, Clock, Crown, Flag, Flame, Gift, Heart, Pause, Play, Search, Shield, Star, Trophy, Volume2, VolumeX, X, Zap } from 'lucide-react';
import {
  advanceDashRun, createDashRun, DASH_DURATION, DASH_FLAWLESS_BONUS, DASH_MAX_HP, DASH_STAGE_SECONDS, DASH_STAGES, DASH_TURBO_SPEED,
  drainDashEvents, getDashPace, getDashPrompt, getDashRunSpeed, getDashScore, getDashStars, moveDashLane,
  normalizeDashWords, scoreDashGate, summarizeDashRun,
} from '../../../utils/petDash';
import { createDashAudio, readDashMuted, writeDashMuted } from '../../../utils/petDashAudio';
import { assetUrl } from '../../../hooks/useBranding';
import { forgetTrainingRecords, useTrainingRecords } from '../../../hooks/useTrainingRecords';
import {
  applyDashEvents, createDashFx, DASH_LANE_COLORS, disposeDashFx, drawDash, getDashGeometry, isDashFxIdle, prepareDashSprites,
  updateDashFx,
} from './petDashRenderer';
import PetDashLobby from './PetDashLobby';
import './PetDash.css';

const COUNTDOWN_START = 3.2;
const COUNTDOWN_RESUME = 2.4;
const SEGMENT = 0.8;
const IDLE_REDRAW_MS = 250;
const SLOW_FRAME = 0.02;
// 90-120 Hz screens fire up to twice as many frames: below this gap a frame is skipped, which gives a steady
// 60 fps on 120 Hz (smoother than an uneven 120) and halves the work. 60, 75 and 90 Hz draw every frame.
const MIN_FRAME_MS = 10.5;
const DEMO_WORDS = [
  { word: 'quiet', hint: 'yên tĩnh' },
  { word: 'brave', hint: 'dũng cảm' },
  { word: 'tired', hint: 'mệt mỏi' },
];

const STAGE_NAMES = ['Morning run', 'Golden hour', 'Twilight sprint'];
const CHEST_IMAGE = '/image/chest/legendary-chest.png';
// The training track of the other games, about 8% faster each stage so the speed-up is heard as well as seen.
const MUSIC = '/sound/pet-word-scamble-2-faster.mp3';
const MUSIC_RATES = [1, 1.08, 1.16];
// While paused or counting back in, the clue stays covered so a pause never buys reading time.
const HIDDEN_PROMPT = { id: 0, kind: 'idle', label: 'GET READY', text: 'The clue comes back on GO!', image: null, retry: false, alert: null, sniffed: false, chest: false, next: null };

// Everything the HUD shows, as one cheap string. React only re-renders when it changes.
// The lane is left out: a lane change only flips the pads' aria-pressed (see moveToLane).
const hudSignature = (run, turbo) => {
  let first = 0;
  let second = 0;
  let sniffed = 0;
  for (const row of run.rows) {
    if (row.type !== 'gate') continue;
    if (!first) {
      first = row.id;
      sniffed = row.eliminated == null ? 0 : 1;
    } else {
      second = row.id;
      break;
    }
  }
  return `${getDashScore(run)}|${run.hp}|${run.shield ? 1 : 0}|${run.streak}|${run.wordsCompleted}|${Math.ceil(run.duration - run.elapsed)}|${first}|${second}|${sniffed}|${run.rows[0]?.id ?? 0}|${run.feedback?.id ?? 0}|${run.stage}|${run.stageWords[run.stage]}|${run.hurt}|${run.over ? 1 : 0}|${turbo ? 1 : 0}`;
};

const buildHud = (run, turbo = false) => ({
  stage: run.stage,
  stageWords: [...run.stageWords],
  stageCleared: [...run.stageCleared],
  stageFlawless: [...run.stageFlawless],
  goals: run.goals,
  stars: getDashStars(run),
  score: getDashScore(run),
  hp: run.hp,
  hurt: run.hurt,
  shield: run.shield,
  streak: run.streak,
  words: run.wordsCompleted,
  timeLeft: Math.max(0, Math.ceil(run.duration - run.elapsed)),
  final: run.elapsed >= run.duration,
  bonusTime: run.duration > DASH_DURATION,
  lane: run.lane,
  prompt: getDashPrompt(run),
  feedback: run.feedback,
  turbo,
});

const PetAvatar = ({ src, name, className = '' }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed
    ? <img className={className} src={src} alt={name || 'Your pet'} draggable="false" onError={() => setFailed(true)} />
    : <span className={`${className} pd-avatar-fallback`} role="img" aria-label={name || 'Your pet'}>🐾</span>;
};
PetAvatar.propTypes = { src: PropTypes.string, name: PropTypes.string, className: PropTypes.string };

// An image for the canvas: the ref stays empty until the image has loaded.
const useCanvasImage = src => {
  const ref = useRef(null);
  useEffect(() => {
    ref.current = null;
    if (!src) return undefined;
    const img = new Image();
    img.onload = () => { ref.current = { img, ok: true }; };
    img.src = src;
    return () => { img.onload = null; };
  }, [src]);
  return ref;
};

// Icons rather than emoji: an emoji's first appearance can stall a frame while its font loads.
const DashRules = ({ chestEnabled }) => (
  <ul className="pd-rules">
    <li><i style={{ background: DASH_LANE_COLORS[0].main }}>1</i><i style={{ background: DASH_LANE_COLORS[1].main }}>2</i><i style={{ background: DASH_LANE_COLORS[2].main }}>3</i><span>Run through the gate that matches the clue</span></li>
    {/* A no-break space before each "·" keeps the dot at the end of a line instead of starting the next one. */}
    <li><em data-tone="heart"><Heart size={15} fill="currentColor" /></em><span>A mistake costs a heart and slows the road&nbsp;· 5&nbsp;in&nbsp;a&nbsp;row heals one</span></li>
    <li><em data-tone="star"><Star size={15} fill="currentColor" /></em><span>Clear each {DASH_STAGE_SECONDS}s stage to earn its star</span></li>
    <li><em data-tone="turbo"><Zap size={15} fill="currentColor" /></em><span>The road speeds up every stage&nbsp;· stage 3 is turbo</span></li>
    <li><em data-tone="power"><Search size={15} strokeWidth={2.6} /></em><span>Power-ups: shield, heart, +time, sniff out a wrong gate</span></li>
    {chestEnabled && <li><em data-tone="chest"><Gift size={15} strokeWidth={2.6} /></em><span>Get the chest gate right to win a treasure chest</span></li>}
  </ul>
);
DashRules.propTypes = { chestEnabled: PropTypes.bool };

const RunFacts = () => (
  <div className="pd-run-facts"><span><b>{DASH_DURATION}</b>seconds</span><span><b>{DASH_MAX_HP}</b>hearts</span><span><b>{DASH_STAGES}</b>stages = ★★★</span></div>
);

// Joined with a no-break space before each "·", so a dot ends a line instead of starting the next one.
const CONTROL_HINT = ['← → / A D', 'keys 1 2 3', 'swipe or tap a lane', 'P to pause'].join(`${String.fromCharCode(160)}· `);

// Counts the score up on the results card.
const useCountUp = (target, active) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || target <= 0) { setValue(target); return undefined; }
    let frame;
    const started = performance.now();
    const step = now => {
      const t = Math.min(1, (now - started) / 1100);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, active]);
  return value;
};

const PetDash = ({
  petImageUrl, petName = 'Your pet', wordBank = [], currentLevel = 1, onGameEnd, onClose,
  hideClose = false, scoreToBeat = null, leaderboard = [], pvpOpponentPetUrl, chestEnabled = false,
  showRecords = false, scoreBonusPercent = 0,
}) => {
  const words = useMemo(() => normalizeDashWords(wordBank), [wordBank]);
  // Training mode only: PvP keeps its plain ready card.
  const records = useTrainingRecords('petdash', { enabled: showRecords });
  const runRef = useRef(null);
  if (!runRef.current) runRef.current = createDashRun(currentLevel);
  const [banner, setBanner] = useState(null);
  const [phase, setPhase] = useState('ready');
  const [hud, setHud] = useState(() => buildHud(runRef.current));
  const [result, setResult] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [muted, setMuted] = useState(readDashMuted);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fxRef = useRef(null);
  if (!fxRef.current) fxRef.current = createDashFx();
  const phaseRef = useRef('ready');
  const wordsRef = useRef(words);
  const levelRef = useRef(currentLevel);
  const submittedRef = useRef(false);
  const activeRef = useRef(true);
  const touchRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const fieldRef = useRef(null);
  const approachRef = useRef(null);
  const padsRef = useRef([]);
  const ringRef = useRef(null);
  const layoutRef = useRef({ w: 0, h: 0, top: 0, bottom: 0 });
  const qualityRef = useRef({ dprCap: 2, slow: 0 });
  const petRef = useCanvasImage(petImageUrl);
  const chestRef = useCanvasImage(chestEnabled ? assetUrl(CHEST_IMAGE) : null);
  const audioRef = useRef(null);
  const countdownRef = useRef({ left: 0, timer: 0 });
  const hudKeyRef = useRef('');
  const demoRef = useRef(null);
  if (!demoRef.current) demoRef.current = { time: 0, run: createDashRun() };
  const reducedMotionRef = useRef(false);
  const startRef = useRef(null);

  wordsRef.current = words;
  levelRef.current = currentLevel;

  const score = hud.score;
  const nextToBeat = [...leaderboard].filter(entry => entry.score > score).sort((a, b) => a.score - b.score)[0]
    || (scoreToBeat?.score > score ? scoreToBeat : null);
  const shownScore = useCountUp(result?.score ?? 0, phase === 'results');

  const changePhase = useCallback(next => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const publishHud = useCallback((run, force = false) => {
    const turbo = !run.over && getDashRunSpeed(run, levelRef.current) >= DASH_TURBO_SPEED;
    const key = hudSignature(run, turbo);
    if (!force && key === hudKeyRef.current) return;
    hudKeyRef.current = key;
    setHud(buildHud(run, turbo));
  }, []);

  const beginCountdown = useCallback(seconds => {
    countdownRef.current.left = seconds;
    countdownRef.current.label = '';
    window.clearTimeout(countdownRef.current.timer);
    setCountdown('');
    changePhase('countdown');
  }, [changePhase]);

  const startGame = () => {
    if (words.length < 3) return;
    audioRef.current?.unlock();
    audioRef.current?.playMusic(assetUrl(MUSIC), MUSIC_RATES[0]);
    const run = createDashRun(currentLevel, { chest: chestEnabled });
    runRef.current = run;
    disposeDashFx(fxRef.current);
    fxRef.current = createDashFx();
    submittedRef.current = false;
    setSubmitting(false);
    setSubmitError('');
    setResult(null);
    setBanner({ id: 0, text: 'Stage 1', detail: `${STAGE_NAMES[0]} · find ${run.goals[0]} words` });
    publishHud(run, true);
    beginCountdown(COUNTDOWN_START);
  };
  // The keyboard handler is registered once; it always calls the latest startGame.
  startRef.current = startGame;

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== 'playing' && phaseRef.current !== 'countdown') return;
    audioRef.current?.pauseMusic();
    window.clearTimeout(countdownRef.current.timer);
    setCountdown('');
    changePhase('paused');
  }, [changePhase]);

  // Coming back from another app, iOS may have stopped the sound: taps and keys wake it up again.
  const resumeGame = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    audioRef.current?.resume();
    audioRef.current?.playMusic(assetUrl(MUSIC), MUSIC_RATES[runRef.current.stage]);
    beginCountdown(COUNTDOWN_RESUME);
  }, [beginCountdown]);

  // Lanes only change while the road runs, so a pause cannot be used to line up the next gate.
  // Lanes change several times per gate, so the pads are updated directly instead of re-rendering the game.
  const moveToLane = useCallback(lane => {
    if (phaseRef.current !== 'playing') return;
    const run = runRef.current;
    if (!moveDashLane(run, lane)) return;
    padsRef.current.forEach((pad, i) => pad?.setAttribute('aria-pressed', String(i === run.lane)));
    ringRef.current?.style.setProperty('--ring', String(run.lane));
  }, []);
  const move = useCallback(direction => moveToLane(runRef.current.lane + direction), [moveToLane]);

  const toggleMute = useCallback(() => {
    const next = !audioRef.current?.muted;
    audioRef.current?.setMuted(next);
    audioRef.current?.resume();
    writeDashMuted(next);
    setMuted(next);
  }, []);

  const sayWord = word => {
    audioRef.current?.resume();
    audioRef.current?.speak(word, { force: true });
  };

  useEffect(() => {
    const countdownState = countdownRef.current;
    activeRef.current = true;
    reducedMotionRef.current = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    audioRef.current = createDashAudio(readDashMuted());
    audioRef.current.prepareMusic(assetUrl(MUSIC));
    prepareDashSprites();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // iOS lets sound start again (after a call, Siri or a notification) only from a tap
    // that ends or a key. The lane pads act on pointerdown, which does not count, so the end of every tap
    // anywhere wakes the sound here.
    const wake = () => audioRef.current?.resume();
    const wakeEvents = ['touchend', 'pointerup', 'click', 'keydown'];
    wakeEvents.forEach(type => window.addEventListener(type, wake, { capture: true, passive: true }));
    return () => {
      wakeEvents.forEach(type => window.removeEventListener(type, wake, { capture: true }));
      activeRef.current = false;
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(countdownState.timer);
      audioRef.current?.dispose();
      disposeDashFx(fxRef.current);
    };
  }, []);

  // Keep the canvas sharp and tell the renderer where the road area sits.
  const measure = useCallback(() => {
    const stage = stageRef.current;
    const field = fieldRef.current;
    const canvas = canvasRef.current;
    if (!stage || !field || !canvas) return;
    const s = stage.getBoundingClientRect();
    const f = field.getBoundingClientRect();
    if (!s.width || !s.height) return;
    const dpr = Math.min(qualityRef.current.dprCap, window.devicePixelRatio || 1);
    const width = Math.round(s.width * dpr);
    const height = Math.round(s.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    layoutRef.current = { w: s.width, h: s.height, top: f.top - s.top, bottom: f.bottom - s.top, dpr };
  }, []);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (stageRef.current) observer.observe(stageRef.current);
    if (fieldRef.current) observer.observe(fieldRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);
  useLayoutEffect(measure, [phase, measure]);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const current = phaseRef.current;
      const onButton = event.target?.closest?.('button');
      if (current === 'ready' && (event.key === 'Enter' || event.code === 'Space') && !onButton) {
        event.preventDefault();
        startRef.current?.();
        return;
      }
      if (current === 'playing') {
        if (['ArrowLeft', 'a', 'A'].includes(event.key)) { event.preventDefault(); move(-1); }
        if (['ArrowRight', 'd', 'D'].includes(event.key)) { event.preventDefault(); move(1); }
        if (['1', '2', '3'].includes(event.key)) { event.preventDefault(); moveToLane(Number(event.key) - 1); }
      }
      if (event.key === 'm' || event.key === 'M') toggleMute();
      if (event.code === 'Space' || event.key === 'Escape' || event.key === 'p' || event.key === 'P') {
        if (current === 'playing' || current === 'countdown' || current === 'paused') {
          // Buttons retain their normal Space activation.
          if (event.code === 'Space' && onButton) return;
          event.preventDefault();
          if (current === 'paused') resumeGame(); else pauseGame();
        }
      }
    };
    const onHidden = () => { if (document.hidden) pauseGame(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', pauseGame);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', pauseGame);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [move, moveToLane, pauseGame, resumeGame, toggleMute]);

  // One animation loop: the simulation advances at its own pace, the canvas redraws every frame
  // and React only re-renders when something the HUD shows actually changed.
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    let frame = 0;
    let previous = performance.now();
    let lastDraw = 0;
    const approach = { el: null, left: -1, urgent: null };

    const updateDemo = dt => {
      const demo = demoRef.current;
      demo.time += dt;
      const run = demo.run;
      const bank = wordsRef.current.length >= 3 ? wordsRef.current : DEMO_WORDS;
      const cycle = demo.time * 0.2;
      const index = Math.floor(cycle);
      const choices = [0, 1, 2].map(i => bank[(index * 3 + i) % bank.length]);
      const correctLane = index % 3;
      run.rows = [{ id: index + 1, type: 'gate', mode: 'hint', target: choices[correctLane], choices, correctLane, progress: cycle % 1 }];
      run.lane = Math.round(1 + Math.sin(demo.time * 0.9));
      run.distance += dt * 7;
      return { run, phase: 0.5 - 0.5 * Math.cos(demo.time * 0.18) };
    };

    const handleEvents = (events, layout) => {
      const audio = audioRef.current;
      applyDashEvents(fxRef.current, events, getDashGeometry(layout), { reducedMotion: reducedMotionRef.current });
      for (const event of events) {
        // Words are not read aloud during the run, only the music and the effects play; the results card
        // still reads a word when its speaker button is tapped.
        if (event.type === 'correct') {
          audio?.play(event.chest ? 'chest' : event.streak % 5 === 0 ? 'combo' : 'correct');
        } else if (event.type === 'wrong') {
          audio?.play('wrong');
          navigator.vibrate?.(60);
        } else if (event.type === 'hit') {
          audio?.play('hit');
          navigator.vibrate?.(80);
        } else if (event.type === 'star' || event.type === 'flawless') {
          audio?.play('combo');
        } else if (event.type === 'stage') {
          const run = runRef.current;
          setBanner({
            id: event.stage,
            tag: event.stage === DASH_STAGES - 1 ? 'TURBO!' : 'SPEED UP!',
            text: `Stage ${event.stage + 1}`,
            detail: `${STAGE_NAMES[event.stage]} · find ${run.goals[event.stage]} words`,
          });
          audio?.play('speedup');
          audio?.setMusicRate(MUSIC_RATES[event.stage]);
        } else if (event.type === 'dodge') audio?.play('dodge');
        else if (event.type === 'pickup') audio?.play('pickup');
      }
    };

    // The countdown bar inside the clue card is written straight to the DOM every frame.
    const updateApproach = run => {
      const bar = approachRef.current;
      if (!bar) return;
      if (bar !== approach.el) Object.assign(approach, { el: bar, left: -1, urgent: null });
      const gate = run.rows.find(row => row.type === 'gate');
      const left = gate ? Math.max(0, Math.min(1, 1 - gate.progress)) : 0;
      if (Math.abs(left - approach.left) > 0.003) {
        bar.style.transform = `scaleX(${left.toFixed(3)})`;
        approach.left = left;
      }
      const urgent = left < 0.3;
      if (urgent !== approach.urgent) {
        bar.dataset.urgent = String(urgent);
        approach.urgent = urgent;
      }
    };

    // Sustained slow frames on a high-density screen: step the pixel density down (2, 1.5, 1) instead of stuttering.
    const watchQuality = seconds => {
      const quality = qualityRef.current;
      if (quality.dprCap <= 1) return;
      quality.slow = seconds > SLOW_FRAME ? quality.slow + seconds : Math.max(0, quality.slow - seconds * 0.5);
      if (quality.slow > 1.5) {
        quality.dprCap = Math.max(1, Math.min(quality.dprCap, window.devicePixelRatio || 1) - 0.5);
        quality.slow = 0;
        measure();
      }
    };

    const tick = now => {
      frame = requestAnimationFrame(tick);
      if (now - previous < MIN_FRAME_MS) return;
      const raw = Math.max(0, (now - previous) / 1000);
      const dt = Math.min(0.05, raw);
      previous = now;
      const layout = layoutRef.current;
      if (!layout.w || !layout.h) return;
      const current = phaseRef.current;
      const fx = fxRef.current;
      let run = runRef.current;
      let phaseOverride;
      let running = false;
      let speed = 5;
      let pace = 1;

      if (current === 'ready') {
        const demo = updateDemo(dt);
        run = demo.run;
        phaseOverride = demo.phase;
        running = true;
      } else if (current === 'countdown') {
        const cd = countdownRef.current;
        cd.left -= dt;
        const segment = Math.ceil(Math.max(0, cd.left) / SEGMENT);
        if (segment <= 1) {
          setCountdown('GO!');
          audioRef.current?.play('go');
          window.clearTimeout(cd.timer);
          cd.timer = window.setTimeout(() => { if (activeRef.current) setCountdown(''); }, 700);
          changePhase('playing');
        } else {
          const label = String(segment - 1);
          if (label !== cd.label) { cd.label = label; setCountdown(label); audioRef.current?.play('tick'); }
        }
      } else if (current === 'playing') {
        watchQuality(raw);
        advanceDashRun(run, dt, wordsRef.current, levelRef.current);
        const events = drainDashEvents(run);
        if (events.length) handleEvents(events, layout);
        running = !run.over;
        speed = getDashRunSpeed(run, levelRef.current);
        pace = getDashPace(run);
        if (run.over) {
          const summary = summarizeDashRun(run);
          publishHud(run, true);
          setResult(summary);
          audioRef.current?.stopMusic();
          audioRef.current?.play(summary.stars > 0 ? 'win' : 'lose');
          changePhase('results');
        } else publishHud(run);
      }
      if (current !== 'ready') updateApproach(run);

      updateDashFx(fx, dt, run.lane, speed, running, reducedMotionRef.current, pace);
      // Pause and results screens cover the road: once effects settle, a few redraws a second are enough.
      if ((current === 'paused' || current === 'results') && isDashFxIdle(fx) && now - lastDraw < IDLE_REDRAW_MS) return;
      lastDraw = now;
      const dpr = layout.dpr || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawDash(ctx, {
        w: layout.w, h: layout.h, layout, run, fx, pet: petRef.current, chest: chestRef.current, t: now / 1000, running, speed,
        phase: phaseOverride, reducedMotion: reducedMotionRef.current, hideLabels: current === 'paused' || current === 'countdown',
      });
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [changePhase, publishHud, measure, petRef, chestRef]);

  // The next clue's picture is fetched and decoded while it is still the NEXT clue, so showing it costs nothing.
  const nextImage = hud.prompt.next?.image;
  useEffect(() => {
    if (!nextImage) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = nextImage;
    img.decode?.().catch(() => {});
  }, [nextImage]);

  useEffect(() => {
    if (!banner || phase !== 'playing') return undefined;
    const timer = window.setTimeout(() => setBanner(null), 2300);
    return () => window.clearTimeout(timer);
  }, [banner, phase]);

  const finishGame = async () => {
    if (submittedRef.current || !result) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    forgetTrainingRecords('petdash');
    try {
      await onGameEnd(result.score, {
        wordsCompleted: result.wordsCompleted,
        stars: result.stars,
        distance: result.distance,
        bestStreak: result.bestStreak,
        accuracy: result.accuracy,
        chestCollected: result.chestCollected,
      });
    } catch {
      submittedRef.current = false;
      if (activeRef.current) {
        setSubmitting(false);
        setSubmitError('Could not save your run. Please try again.');
      }
    }
  };

  const handlePointerDown = event => {
    if (phaseRef.current !== 'playing' || event.button > 0) return;
    touchRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handlePointerUp = event => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 25 && Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    else if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
      const rect = event.currentTarget.getBoundingClientRect();
      moveToLane(Math.floor((event.clientX - rect.left) / rect.width * 3));
    }
  };

  const inRun = phase === 'countdown' || phase === 'playing' || phase === 'paused';
  const prompt = phase === 'playing' || !hud.prompt.id ? hud.prompt : HIDDEN_PROMPT;
  const stars = result?.stars ?? 0;
  const nextStage = result ? result.stages.findIndex(stage => !stage.cleared) : -1;

  // A new record, measured with the score that gets saved: PetDisplay adds the level bonus the same way.
  // Only a run with a star is saved (Collect rewards), so only that one can claim a record.
  let recordBadge = null;
  const board = records.data;
  if (phase === 'results' && result && showRecords && !hideClose && stars > 0 && board) {
    const saved = result.score + Math.round(result.score * scoreBonusPercent / 100);
    if (board.ranked && board.record?.scope === 'all' && saved > board.record.score) recordBadge = { kind: 'record', Icon: Crown, text: 'New game record!' };
    else if (board.ranked && saved > (board.week.top?.score ?? 0)) recordBadge = { kind: 'week', Icon: Trophy, text: 'Top score this week!' };
    else if (!board.best) recordBadge = { kind: 'personal', Icon: Star, text: 'Your first record!' };
    else if (saved > board.best.score) recordBadge = { kind: 'personal', Icon: Star, text: board.best.scope === 'week' ? 'Best run this week!' : 'New personal best!' };
  }

  const reviewList = (list, showChoice) => (
    <ul>
      {list.map(word => (
        <li key={word.word}>
          <button type="button" className="pd-say" onClick={() => sayWord(word.word)} aria-label={`Hear ${word.word}`}><Volume2 size={14} /></button>
          <strong>{word.word}</strong>
          <span>{word.hint}{showChoice && word.chosen && <em>you chose “{word.chosen}”</em>}</span>
        </li>
      ))}
    </ul>
  );

  return createPortal(
    <div className="pd-overlay" role="dialog" aria-modal="true" aria-label="Pet Dash">
      <div className="pd-game" ref={stageRef} data-phase={phase}>
        <canvas className="pd-canvas" ref={canvasRef} aria-hidden="true" />

        <div className="pd-layout">
          <div className="pd-top">
            {phase === 'ready' && (
              <div className="pd-ready-top">
                <div className="pd-topline">
                  <span className="pd-pill"><Flag size={13} /> PET TRAINING</span>
                  <div className="pd-topline-actions">
                    {/* Sound can be set before the run: the music starts with Let's run. */}
                    <button type="button" className="pd-icon-button" aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted} onClick={toggleMute}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
                    {(!hideClose || words.length < 3) && <button type="button" className="pd-icon-button" aria-label="Close Pet Dash" onClick={onClose}><X size={20} /></button>}
                  </div>
                </div>
                <h1 className="pd-title">Pet<span>Dash</span></h1>
                <p className="pd-tagline">Read the clue. Run through the right gate.</p>
              </div>
            )}
            {(inRun || phase === 'results') && (
              <header className="pd-hud">
                <div className="pd-hud-row">
                  <div className="pd-chip pd-score">
                    <span>SCORE</span>
                    <strong key={hud.words} data-bump={hud.words > 0}>{score}</strong>
                  </div>
                  <div className="pd-chip pd-hearts" key={`hurt-${hud.hurt}`} data-hurt={hud.hurt > 0} aria-label={`${hud.hp} of ${DASH_MAX_HP} hearts${hud.shield ? ', shield active' : ''}`}>
                    {Array.from({ length: DASH_MAX_HP }, (_, i) => {
                      const fill = Math.max(0, Math.min(1, hud.hp - i));
                      return (
                        <span key={i} className="pd-heart-slot" data-fill={fill >= 1 ? 'full' : fill > 0 ? 'half' : 'empty'}>
                          <Heart size={21} className="pd-heart-bg" />
                          <Heart size={21} fill="currentColor" className="pd-heart-fg" />
                        </span>
                      );
                    })}
                    {hud.shield && <Shield size={20} className="pd-active-shield" fill="currentColor" />}
                  </div>
                  <div className="pd-hud-actions">
                    <div className="pd-chip pd-timer" data-urgent={hud.timeLeft <= 10 && !hud.final} data-bonus={hud.bonusTime}>
                      {hud.final ? <em>FINAL</em> : <><Clock size={14} />{hud.timeLeft}<small>s</small></>}
                    </div>
                    <button type="button" className="pd-icon-button" aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted} onClick={toggleMute}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
                    {/* On the results screen the HUD sits behind the card, and only the card's buttons may end the run. */}
                    {inRun && <button type="button" className="pd-icon-button" aria-label="Pause game" onClick={pauseGame}><Pause size={17} /></button>}
                    {inRun && !hideClose && <button type="button" className="pd-icon-button" aria-label="Close Pet Dash" onClick={onClose}><X size={17} /></button>}
                  </div>
                </div>
                <div className="pd-stages" aria-label={`Stage ${hud.stage + 1} of 3, ${hud.stars} stars${hud.turbo ? ', turbo' : ''}`}>
                  {hud.goals.map((goal, i) => {
                    const progress = `${Math.min(hud.stageWords[i], goal)}/${goal}`;
                    const turbo = hud.turbo && i === hud.stage;
                    return (
                      <div key={i} className="pd-stage" data-turbo={turbo} data-state={hud.stageFlawless[i] ? 'flawless' : hud.stageCleared[i] ? 'done' : i === hud.stage ? 'now' : i < hud.stage ? 'missed' : 'next'}>
                        <div className="pd-stage-bar"><i style={{ width: `${Math.min(100, hud.stageWords[i] / goal * 100)}%` }} /></div>
                        <Star size={18} fill={hud.stageCleared[i] ? 'currentColor' : 'none'} className={hud.stageCleared[i] ? 'pd-star-earned pd-star-pop' : 'pd-star-empty'} />
                        <small>{hud.stageFlawless[i] ? 'Flawless!' : turbo ? <><Zap size={10} fill="currentColor" />TURBO {progress}</> : i === hud.stage || hud.stageCleared[i] ? progress : ''}</small>
                      </div>
                    );
                  })}
                </div>
                {nextToBeat && (
                  <div className="pd-rival"><Trophy size={12} /><span>{nextToBeat.name}: {nextToBeat.score}</span><div><i style={{ width: `${Math.min(100, score / nextToBeat.score * 100)}%` }} /></div></div>
                )}
              </header>
            )}
          </div>

          <div className="pd-field" ref={fieldRef} tabIndex={-1} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={() => { touchRef.current = null; }}>
            {inRun && (
              <div className="pd-stack">
                <div className="pd-prompt" data-kind={prompt.kind} data-retry={prompt.retry} data-chest={prompt.chest} key={`prompt-${prompt.id || prompt.kind}`} role="status" aria-live="polite">
                  <span className="pd-prompt-label">{prompt.label}</span>
                  <div className="pd-prompt-body">
                    {prompt.image && <img src={prompt.image} alt="" draggable="false" decoding="async" onError={event => { event.currentTarget.style.display = 'none'; }} />}
                    <strong>{prompt.text}</strong>
                  </div>
                  {(prompt.sniffed || prompt.chest || (prompt.alert && prompt.kind === 'gate')) && (
                    <div className="pd-prompt-chips">
                      {/* Icons instead of emoji: the first emoji of a run can stall a frame while its font loads. */}
                      {prompt.chest && <span className="pd-chip-chest"><Gift size={11} />Chest gate · get it right to win it</span>}
                      {prompt.sniffed && <span className="pd-chip-sniff"><Search size={11} />1 wrong gate closed</span>}
                      {prompt.alert && prompt.kind === 'gate' && <span className="pd-prompt-alert">{prompt.alert === 'dodge' ? <><AlertTriangle size={11} />Barrier first</> : <><Star size={11} fill="currentColor" />Bonus first</>}</span>}
                    </div>
                  )}
                  {prompt.next && <div className="pd-prompt-next"><b>NEXT</b><span>{prompt.next.text}</span></div>}
                  {prompt.kind === 'gate' && <i className="pd-approach" ref={approachRef} aria-hidden="true" />}
                </div>
                <div className="pd-stack-row">
                  {hud.feedback ? (
                    <div className={`pd-toast ${hud.feedback.good ? 'pd-toast-good' : 'pd-toast-bad'}`} key={`toast-${hud.feedback.id}`}>
                      {hud.feedback.tag && <span className="pd-toast-tag">{hud.feedback.tag}</span>}
                      <strong>{hud.feedback.title}</strong>
                      <span>{hud.feedback.detail}</span>
                    </div>
                  ) : <span />}
                  {hud.streak >= 2 && (
                    <div className="pd-combo" key={`combo-${hud.streak}`}><Flame size={16} /><b>{hud.streak}× combo</b><span>next +{scoreDashGate(hud.streak + 1)}</span></div>
                  )}
                </div>
                {banner && phase === 'playing' && <div className="pd-banner" key={`banner-${banner.id}`}>{banner.tag && <em><Zap size={12} fill="currentColor" />{banner.tag}</em>}<strong>{banner.text}</strong><span>{banner.detail}</span></div>}
              </div>
            )}
            {countdown && <div className="pd-countdown" key={`count-${countdown}`} aria-hidden="true">{countdown}</div>}
          </div>

          <div className="pd-bottom">
            {phase === 'ready' && (
              <div className="pd-ready-card" data-lobby={showRecords || undefined}>
                {pvpOpponentPetUrl && <div className="pd-opponent"><PetAvatar src={pvpOpponentPetUrl} name="Opponent pet" /><span>Challenge accepted. Make every word count.</span></div>}
                {showRecords
                  ? <PetDashLobby records={records} rules={<><RunFacts /><DashRules chestEnabled={chestEnabled} /><p className="pd-control-hint">{CONTROL_HINT}</p></>} />
                  : <><DashRules chestEnabled={chestEnabled} /><RunFacts /></>}
                {words.length < 3
                  ? <div className="pd-bank-error" role="alert">This run needs at least 3 different words and meanings. Ask your teacher to add vocabulary, then try again.</div>
                  : <button type="button" className="pd-primary" onClick={startGame}>Let’s run <ArrowRight size={20} /></button>}
                {words.length < 3 && <button type="button" className="pd-secondary" onClick={onClose}>Back to training</button>}
                {!showRecords && <p className="pd-control-hint">{CONTROL_HINT}</p>}
                {!showRecords && nextToBeat && <div className="pd-ready-target"><Trophy size={14} /> Score to beat: <strong>{nextToBeat.score}</strong> · {nextToBeat.name}</div>}
              </div>
            )}
            {inRun && (
              <div className="pd-controls">
                {[0, 1, 2].map(lane => (
                  <button
                    type="button"
                    key={lane}
                    ref={el => { padsRef.current[lane] = el; }}
                    className="pd-lane-pad"
                    style={{ '--lane': DASH_LANE_COLORS[lane].main, '--lane-dark': DASH_LANE_COLORS[lane].dark, gridRow: 1, gridColumn: lane + 1 }}
                    aria-label={`Move to lane ${lane + 1}`}
                    aria-pressed={hud.lane === lane}
                    onPointerDown={event => { if (event.pointerType !== 'mouse' || event.button === 0) { event.preventDefault(); moveToLane(lane); } }}
                    onClick={event => { if (event.detail === 0) moveToLane(lane); }}
                  >{lane + 1}</button>
                ))}
                <span className="pd-lane-ring" ref={ringRef} style={{ '--ring': hud.lane }} aria-hidden="true" />
              </div>
            )}
          </div>
        </div>

        {phase === 'paused' && (
          <div className="pd-pause-layer">
            <div className="pd-card pd-pause-card">
              <span className="pd-eyebrow">TAKE A BREATHER</span>
              <Pause size={38} />
              <h2>Trail paused.</h2>
              <p>Your pet is waiting right here.</p>
              <button type="button" className="pd-primary" onClick={resumeGame}><Play size={18} fill="currentColor" /> Keep running</button>
              {!hideClose && <button type="button" className="pd-secondary" onClick={onClose}>Leave run</button>}
            </div>
          </div>
        )}

        {phase === 'results' && result && (
          <div className="pd-results">
            <div className="pd-card pd-result-card">
              <span className="pd-eyebrow">{result.reason === 'lives' ? 'A LITTLE REST, THEN ANOTHER RUN' : 'THAT’S A WRAP'}</span>
              <div className="pd-result-pet"><PetAvatar src={petImageUrl} name={petName} /></div>
              <div className="pd-result-stars">{[1, 2, 3].map(n => <Star key={n} size={40} fill={stars >= n ? 'currentColor' : 'none'} className={stars >= n ? 'pd-star-earned pd-star-pop' : 'pd-star-empty'} style={{ '--i': n }} />)}</div>
              <h2>{stars >= 3 ? 'Trail superstar!' : stars >= 1 ? 'What a run!' : result.reason === 'lives' ? 'Out of hearts!' : 'Keep practicing!'}</h2>
              <p className="pd-result-line">{petName} found <strong>{result.wordsCompleted}</strong> correct {result.wordsCompleted === 1 ? 'word' : 'words'}.</p>
              {recordBadge && <div className="pd-new-best" data-kind={recordBadge.kind}><recordBadge.Icon size={16} fill="currentColor" />{recordBadge.text}</div>}
              <div className="pd-final-score"><span>RUN SCORE</span><strong>{shownScore}</strong>
                <small>Play {result.baseScore}{result.timeBonus > 0 && ` · Time +${result.timeBonus}`}{result.heartBonus > 0 && ` · Hearts +${result.heartBonus}`}</small>
              </div>
              <div className="pd-result-stats">
                <span><b>{result.accuracy}%</b>accuracy</span>
                <span><b>{result.bestStreak}×</b>best combo</span>
                <span><b>{result.distance} m</b>distance</span>
              </div>
              <ul className="pd-result-stages">
                {result.stages.map((stage, i) => (
                  <li key={i} data-cleared={stage.cleared}>
                    <Star size={14} fill={stage.cleared ? 'currentColor' : 'none'} />
                    <span>{STAGE_NAMES[i]}{stage.flawless && <em>Flawless +{DASH_FLAWLESS_BONUS}</em>}</span>
                    <b>{stage.words}/{stage.goal}</b>
                  </li>
                ))}
              </ul>
              {nextStage >= 0 && <p className="pd-result-tip">Next star: find {result.stages[nextStage].goal} words in Stage {nextStage + 1} · {STAGE_NAMES[nextStage]}.</p>}
              {result.mastered.length > 0 && (
                <div className="pd-review pd-review-good"><span>REDEEMED ON THE SECOND TRY</span>{reviewList(result.mastered, false)}</div>
              )}
              {result.missed.length > 0 && (
                <div className="pd-review"><span>WORDS FOR NEXT TIME · TAP 🔊 TO LISTEN</span>{reviewList(result.missed, true)}</div>
              )}
              {result.chestCollected && (
                <div className="pd-result-chest" data-kept={stars > 0}>
                  <img src={assetUrl(CHEST_IMAGE)} alt="" draggable="false" />
                  <span>{stars > 0 ? 'Treasure chest found!' : 'Earn a star to keep the chest.'}</span>
                </div>
              )}
              {submitError && <p className="pd-bank-error" role="alert">{submitError}</p>}
              {/* A run with a star always goes through Collect rewards, so its score and rewards cannot be skipped by mistake. */}
              {(stars > 0 || hideClose) && <button type="button" className="pd-primary" onClick={finishGame} disabled={submitting}>{submitting ? 'Saving…' : hideClose ? 'Submit score' : 'Collect rewards'}<Flag size={18} /></button>}
              {!hideClose && stars === 0 && <button type="button" className="pd-primary" onClick={onClose}>Back to training</button>}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

PetDash.propTypes = {
  petImageUrl: PropTypes.string,
  petName: PropTypes.string,
  wordBank: PropTypes.array,
  currentLevel: PropTypes.number,
  onGameEnd: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  hideClose: PropTypes.bool,
  scoreToBeat: PropTypes.shape({ score: PropTypes.number, name: PropTypes.string }),
  leaderboard: PropTypes.array,
  pvpOpponentPetUrl: PropTypes.string,
  chestEnabled: PropTypes.bool,
  // Shows the records and leaderboards on the ready screen (training mode).
  showRecords: PropTypes.bool,
  // The level bonus PetDisplay adds to a saved score, so the results card can tell a new record.
  scoreBonusPercent: PropTypes.number,
};
export default PetDash;
