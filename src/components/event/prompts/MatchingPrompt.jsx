import { useEffect, useMemo, useState } from 'react'
import { CUT, SubmitButton, shuffle, tone } from './shared'

/**
 * Nối từ: tap a word on the left, then its meaning on the right.
 *
 * Both columns are shuffled independently, and everything is tracked by the
 * index of the PAIR a word came from — a link is right when the two indices
 * agree. Tapping a linked word breaks its link, so a mistake spotted at the
 * second pair can be undone before the third.
 *
 * Links are labelled at both ends rather than only tinted: three colours on a
 * dark, busy arena is not enough to tell two links apart at a glance, and a
 * number survives being colourblind. A link's number is its LEFT word's row,
 * which is fixed for the whole question — numbering by the order the links were
 * made would renumber the others every time one was broken.
 */
/** The link map without the pair `l` — breaking one link, leaving the rest. */
const unlink = (links, l) =>
  Object.fromEntries(Object.entries(links).filter(([key]) => Number(key) !== l))

const MatchingPrompt = ({ question, disabled, result, onAnswer }) => {
  const pairs = question.payload?.pairs || []

  const [lefts, rights] = useMemo(
    () => [shuffle(pairs.map((_, i) => i)), shuffle(pairs.map((_, i) => i))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question]
  )

  // left pair index → right pair index.
  const [links, setLinks] = useState({})
  const [sel, setSel] = useState(null)

  useEffect(() => {
    setLinks({})
    setSel(null)
  }, [question])

  const linkedRights = new Map(Object.entries(links).map(([l, r]) => [r, Number(l)]))
  const linkCount = Object.keys(links).length
  const done = linkCount === pairs.length

  const tapLeft = (l) => {
    if (disabled || result) return
    if (links[l] !== undefined) {
      setLinks((prev) => unlink(prev, l))
      setSel(null)
      return
    }
    setSel(sel === l ? null : l)
  }

  const tapRight = (r) => {
    if (disabled || result) return
    const owner = linkedRights.get(r)
    if (owner !== undefined) {
      setLinks((prev) => unlink(prev, owner))
      return
    }
    if (sel === null) return
    setLinks((prev) => ({ ...prev, [sel]: r }))
    setSel(null)
  }

  const submit = () => {
    if (disabled || result || !done) return
    const right = lefts.every((l) => links[l] === l)
    onAnswer(right, links)
  }

  // A linked word's badge: the row its left word sits on. Blank while unlinked,
  // so a bare number never reads as a link that is not there.
  const badgeOf = (l) => (links[l] === undefined ? null : lefts.indexOf(l) + 1)

  const shownFor = (l) =>
    result ? (links[l] === l ? 'right' : 'wrong') : links[l] !== undefined ? 'picked' : 'idle'

  const cell = 'flex w-full items-center gap-2 border px-3 py-2.5 text-left text-sm font-medium transition-colors disabled:cursor-default'

  return (
    <div className="mx-auto max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {lefts.map((l) => {
            const badge = badgeOf(l)
            return (
              <button
                key={l}
                type="button"
                onClick={() => tapLeft(l)}
                disabled={disabled || Boolean(result)}
                style={{ clipPath: CUT }}
                className={`${cell} ${tone(sel === l ? 'picked' : shownFor(l))} ${
                  sel === l ? 'ring-2 ring-blue-300/70' : ''
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold">
                  {badge ?? ''}
                </span>
                <span>{pairs[l][0]}</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2">
          {rights.map((r) => {
            const owner = linkedRights.get(r)
            const badge = owner === undefined ? null : lefts.indexOf(owner) + 1
            return (
              <button
                key={r}
                type="button"
                onClick={() => tapRight(r)}
                disabled={disabled || Boolean(result)}
                style={{ clipPath: CUT }}
                className={`${cell} ${tone(
                  owner === undefined ? 'idle' : result ? (owner === r ? 'right' : 'wrong') : 'picked'
                )}`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold">
                  {badge ?? ''}
                </span>
                <span>{pairs[r][1]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {result && !result.right && (
        <p className="mt-3 text-center text-sm text-white/70">
          Đáp án:{' '}
          <span className="font-bold text-green-300">
            {pairs.map(([a, b]) => `${a} – ${b}`).join(' · ')}
          </span>
        </p>
      )}

      {!result && <SubmitButton disabled={disabled || !done} onClick={submit} />}
    </div>
  )
}

export default MatchingPrompt
