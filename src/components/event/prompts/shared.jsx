/**
 * Bits every question renderer needs.
 *
 * The renderers are deliberately dumb: they draw an interaction, decide whether
 * what came back was right, and hand the battle a boolean. Nothing here knows
 * about HP, streaks or sprites — that is EventBattle's half of the contract.
 */

export const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

/**
 * Shuffle until the result is not the answer already. A scramble that happens
 * to come out in order is a free question — likely enough with four tokens to
 * be worth the retry, and the cap keeps a one-token or all-identical list from
 * spinning forever.
 */
export const scramble = (arr, tries = 12) => {
  let out = shuffle(arr)
  for (let i = 0; i < tries && out.join('\u0000') === arr.join('\u0000'); i++) out = shuffle(arr)
  return out
}

/**
 * How a typed answer is compared. Case, surrounding space and trailing
 * punctuation are not what is being tested, so none of them count.
 *
 * Diacritics are LEFT ALONE on purpose: half the answers in the bank are
 * Vietnamese, where "má" and "ma" are different words and folding them together
 * would mark a wrong answer right. NFC first, because a keyboard and a seed file
 * can spell the same accented letter with different code points.
 */
export const normalize = (text) =>
  String(text ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[.,!?;:"'()]+|[.,!?;:"'()]+$/g, '')

/** The cut corner the event UI puts on every clickable panel. */
export const CUT =
  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'

const TONES = {
  idle: 'border-white/15 bg-white/[0.07] text-white hover:border-white/30 hover:bg-white/15',
  picked: 'border-blue-400/70 bg-blue-500/25 text-white',
  right: 'border-green-400/80 bg-green-500/25 text-white',
  wrong: 'border-red-400/80 bg-red-500/25 text-white',
  // A token already spent, still holding its slot in the grid so the tray does
  // not reflow under the finger that is tapping it.
  spent: 'border-white/5 bg-white/[0.02] text-transparent'
}

export const tone = (name) => TONES[name] || TONES.idle

/** The shared submit button for the types that commit on purpose, not on tap. */
export const SubmitButton = ({ disabled, onClick, children = 'Trả lời' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{ clipPath: CUT }}
    className="mx-auto mt-3 block border border-blue-400/60 bg-blue-500/30 px-6 py-2 font-bold text-white transition-colors hover:bg-blue-500/50 disabled:cursor-default disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
  >
    {children}
  </button>
)
