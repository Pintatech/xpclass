import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const WIDTH = { md: 'sm:max-w-2xl', lg: 'sm:max-w-3xl' }

/** A titled group inside a sheet: icon, title, count, then its items in a grid (`grid` sets the columns). */
export const SheetGroup = ({ icon: Icon, tone, title, n, grid, children }) => (
  <section className="mt-5 first:mt-1">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700">
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      {title}
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black tabular-nums text-slate-500">{n}</span>
    </h3>
    <div className={`grid ${grid}`}>{children}</div>
  </section>
)

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The shell of every profile pop-up: a bottom sheet on phones, a dialog on larger screens. Drawn on document.body
 * so it covers the phone bottom bar. Esc, the X and a tap outside close it. While it is open the page behind does
 * not scroll and Tab stays inside.
 */
const Sheet = ({ title, sub, lead, count, size = 'md', onClose, children }) => {
  const rootRef = useRef(null)
  const scrollRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const root = rootRef.current
    const before = document.activeElement
    // Focus the list itself: arrow keys, Page Down and Space then scroll it.
    scrollRef.current?.focus({ preventScroll: true })

    const onKey = (e) => {
      if (e.key === 'Escape') {
        // Esc inside a field only leaves the field.
        if (e.target?.closest?.('input, textarea, select')) return
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !root) return
      const items = [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!root.contains(active) || active === scrollRef.current) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    // Wheel and touch moves only scroll the list. No scroll bar is taken away from the page, so nothing jumps.
    const guard = (e) => {
      if (!e.cancelable || e.ctrlKey) return
      const scroller = e.target instanceof Element ? e.target.closest('.pf-scroll') : null
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight + 1) e.preventDefault()
    }

    window.addEventListener('keydown', onKey)
    root?.addEventListener('wheel', guard, { passive: false })
    root?.addEventListener('touchmove', guard, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKey)
      root?.removeEventListener('wheel', guard)
      root?.removeEventListener('touchmove', guard)
      if (before && document.contains(before)) before.focus?.({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pf-backdrop absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div
        className={`pf-sheet relative flex w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px] ${WIDTH[size] || WIDTH.md}`}
        style={{ maxHeight: 'min(90vh, 900px)' }}
      >
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
          <span className="h-1 w-9 rounded-full bg-slate-300" />
        </div>
        <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-2 sm:px-6 sm:pt-5">
          {lead}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black leading-tight tracking-tight text-slate-800">{title}</h2>
            {sub && <div className="truncate text-xs font-bold text-slate-500">{sub}</div>}
          </div>
          {count != null && <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm font-black tabular-nums text-slate-600">{count}</span>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="pf-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div ref={scrollRef} tabIndex={-1} className="pf-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-6 outline-none sm:px-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Sheet
