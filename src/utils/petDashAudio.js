const STORAGE_KEY = 'petDash.muted'

export const readDashMuted = () => {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}

export const writeDashMuted = (muted) => {
  try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0') } catch { /* private mode */ }
}

// [frequency, start, duration, wave, volume, slideTo]
const SOUNDS = {
  correct: [[660, 0, 0.09, 'triangle', 0.22], [990, 0.07, 0.16, 'triangle', 0.22]],
  combo: [[660, 0, 0.07, 'triangle', 0.2], [880, 0.06, 0.07, 'triangle', 0.2], [1320, 0.12, 0.2, 'triangle', 0.2]],
  wrong: [[220, 0, 0.22, 'sawtooth', 0.16, 110]],
  hit: [[140, 0, 0.25, 'square', 0.18, 50]],
  dodge: [[520, 0, 0.06, 'sine', 0.1, 700]],
  pickup: [[523, 0, 0.08, 'sine', 0.2], [659, 0.07, 0.08, 'sine', 0.2], [784, 0.14, 0.18, 'sine', 0.2]],
  chest: [[784, 0, 0.08, 'triangle', 0.2], [988, 0.07, 0.08, 'triangle', 0.2], [1175, 0.14, 0.08, 'triangle', 0.2], [1568, 0.21, 0.32, 'triangle', 0.22]],
  tick: [[440, 0, 0.1, 'sine', 0.16]],
  go: [[880, 0, 0.32, 'triangle', 0.22]],
  speedup: [[220, 0, 0.3, 'sawtooth', 0.08, 880], [440, 0.08, 0.34, 'triangle', 0.16, 1760]],
  win: [[523, 0, 0.14, 'triangle', 0.22], [659, 0.14, 0.14, 'triangle', 0.22], [784, 0.28, 0.14, 'triangle', 0.22], [1047, 0.42, 0.4, 'triangle', 0.22]],
  lose: [[392, 0, 0.18, 'triangle', 0.2], [330, 0.18, 0.18, 'triangle', 0.2], [262, 0.36, 0.4, 'triangle', 0.2]],
}

// iPhones and iPads mute Web Audio while the ring/silent switch is on, but not <audio> files, which is
// how the other games play their sounds. Safari 16.4+ can be asked for a media ("playback") session;
// older iOS gets the same session from a silent looping <audio> element started by a tap.
const IOS = typeof navigator !== 'undefined'
  && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

// 0.1 s of silence as an 8 kHz, 8-bit mono WAV.
const silentWavUrl = () => {
  const samples = 800
  const view = new DataView(new ArrayBuffer(44 + samples))
  const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)) }
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 8000, true)
  view.setUint32(28, 8000, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  text(36, 'data')
  view.setUint32(40, samples, true)
  for (let i = 0; i < samples; i++) view.setUint8(44 + i, 128)
  return URL.createObjectURL(new Blob([view], { type: 'audio/wav' }))
}

const setAudioSession = (type) => {
  try { if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = type } catch { /* not supported */ }
}

// As in the other games. iPhones ignore it and play the music at full volume, as in the other games too.
const MUSIC_VOLUME = 0.3

// Synthesized sound effects, one background music file, and a word read aloud when the player taps its
// speaker button on the results card. Each part silently does nothing when the browser lacks Web Audio,
// speech synthesis or the file.
export const createDashAudio = (initialMuted = false) => {
  let muted = initialMuted
  let context = null
  let keepAlive = null

  const ensureContext = () => {
    if (context) return context
    const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
    if (!Ctor) return null
    setAudioSession('playback')
    try { context = new Ctor() } catch { context = null }
    return context
  }

  // Wakes the sound after the system stopped it: the audio context in any state but running ('suspended',
  // or iOS's 'interrupted' after a call, Siri or a notification) and the music if it was paused under us.
  // iOS only allows this from a tap that ends (touchend, click) or a key, so the game calls it on those.
  const resume = () => {
    const ctx = ensureContext()
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {})
    if (musicOn && !muted && music?.el.paused) music.el.play().catch(() => {})
  }

  // Runs inside a tap (the start button), which mobile browsers require before they play anything.
  const unlock = () => {
    resume()
    prerender()
    if (IOS && !navigator.audioSession && !keepAlive) {
      try {
        keepAlive = new Audio(silentWavUrl())
        keepAlive.loop = true
        keepAlive.play().catch(() => {})
      } catch { keepAlive = null }
    }
  }

  const schedule = (ctx, notes, at) => {
    for (const [freq, start, duration, wave, volume, slideTo] of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = wave
      osc.frequency.setValueAtTime(freq, at + start)
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + start + duration)
      gain.gain.setValueAtTime(0.0001, at + start)
      gain.gain.exponentialRampToValueAtTime(volume, at + start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + start + duration)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at + start)
      osc.stop(at + start + duration + 0.02)
    }
  }

  // Building oscillators and envelopes at the moment of a hit costs the main thread a few milliseconds on a
  // slow phone, in the very frame that also shows the hit. Each sound is rendered once into a buffer
  // (offline, one at a time), after which playing it is a single buffer source.
  const buffers = {}
  let prerendering = false
  const prerender = () => {
    const Offline = typeof window !== 'undefined' && (window.OfflineAudioContext || window.webkitOfflineAudioContext)
    if (prerendering || !Offline || !context) return
    prerendering = true
    const names = Object.keys(SOUNDS)
    const next = () => {
      const name = names.shift()
      if (!name || !context) return
      const notes = SOUNDS[name]
      const seconds = Math.max(...notes.map(([, start, duration]) => start + duration)) + 0.05
      try {
        const offline = new Offline(1, Math.ceil(seconds * context.sampleRate), context.sampleRate)
        schedule(offline, notes, 0)
        const done = (buffer) => { buffers[name] = buffer; next() }
        const rendered = offline.startRendering()
        // Older Safari reports the result through oncomplete instead of a promise.
        if (rendered?.then) rendered.then(done, next)
        else offline.oncomplete = (event) => done(event.renderedBuffer)
      } catch { next() }
    }
    next()
  }

  const play = (name) => {
    if (muted) return
    const ctx = ensureContext()
    const notes = SOUNDS[name]
    if (!ctx || !notes) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const buffer = buffers[name]
    if (!buffer) {
      schedule(ctx, notes, ctx.currentTime)
      return
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start()
  }

  // Only from a tap on a speaker button (the results card), so no unlocking is needed first.
  // force: the player asked to hear the word, so it plays even when the game sound is off.
  const speak = (text, { force = false } = {}) => {
    if ((muted && !force) || !text || typeof window === 'undefined' || !window.speechSynthesis) return
    try {
      const synth = window.speechSynthesis
      // cancel() right before speak() can drop the new word in some browsers: only cut off a word still playing.
      if (synth.speaking || synth.pending) synth.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = 0.95
      utterance.volume = 0.9
      synth.speak(utterance)
    } catch { /* speech is a bonus */ }
  }

  // Background music: an mp3 played by a plain <audio> element, exactly like the other games, so it keeps
  // its pitch when sped up (playbackRate) and plays even with an iPhone's silent switch on. While it plays,
  // iOS treats the page as media playback, which also keeps the sound effects audible.
  // (Routing it through Web Audio to tame its volume on iOS, which ignores audio.volume, was tried: when
  // that audio context stays silent on a phone, the music went silent with it.)
  let music = null
  let musicOn = false

  // No audio context here: it is made in the first tap (see unlock), which iOS needs for it to sound.
  const loadMusic = (url) => {
    if (music?.url === url) return
    music?.el.pause()
    const el = new Audio(url)
    el.loop = true
    el.preload = 'auto'
    el.volume = MUSIC_VOLUME
    music = { el, url }
  }

  // Starts or resumes the music; call it from a tap, which mobile browsers require for play().
  const playMusic = (url, rate = 1) => {
    loadMusic(url)
    musicOn = true
    music.el.playbackRate = rate
    if (!muted) music.el.play().catch(() => {})
  }

  const pauseMusic = () => {
    musicOn = false
    music?.el.pause()
  }

  return {
    play,
    speak,
    resume,
    unlock,
    playMusic,
    pauseMusic,
    // Loads the file ahead (on the ready screen) so the run starts with music straight away.
    prepareMusic: loadMusic,
    setMusicRate(rate) {
      if (music) music.el.playbackRate = rate
    },
    // Back to the beginning, for the next run.
    stopMusic() {
      pauseMusic()
      if (music) music.el.currentTime = 0
    },
    get muted() { return muted },
    setMuted(value) {
      muted = Boolean(value)
      if (muted) {
        try { window.speechSynthesis?.cancel() } catch { /* noop */ }
        music?.el.pause()
      } else if (musicOn) music?.el.play().catch(() => {})
    },
    dispose() {
      try { window.speechSynthesis?.cancel() } catch { /* noop */ }
      if (music) {
        music.el.pause()
        music.el.removeAttribute('src')
        music.el.load()
        music = null
      }
      if (keepAlive) {
        keepAlive.pause()
        URL.revokeObjectURL(keepAlive.src)
        keepAlive = null
      }
      context?.close?.().catch(() => {})
      context = null
      setAudioSession('auto')
    },
  }
}
