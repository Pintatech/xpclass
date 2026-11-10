import React, { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  CheckCircle2,
  Cloud,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  MoreHorizontal,
  Redo2,
  ShoppingBag,
  Sun,
  SunMoon,
  Undo2,
} from 'lucide-react'

const LIGHT = {
  auto: { icon: SunMoon, label: 'Light: clock' },
  day: { icon: Sun, label: 'Light: day' },
  night: { icon: Moon, label: 'Light: night' },
}

const glass = 'pointer-events-auto bg-white/85 text-slate-700 shadow-md ring-1 ring-black/5 hover:bg-white'

const IconButton = ({ label, onClick, disabled, children, className = '' }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-40 ${glass} ${className}`}
  >
    {children}
  </button>
)

// "Saved" shows briefly after a save; a failed save stays until it is retried.
const SaveStatus = ({ status, onRetry, compact }) => {
  const [justSaved, setJustSaved] = useState(false)
  const prev = useRef(status)
  useEffect(() => {
    const was = prev.current
    prev.current = status
    if (status === 'saved' && (was === 'saving' || was === 'pending')) {
      setJustSaved(true)
      const t = setTimeout(() => setJustSaved(false), 2200)
      return () => clearTimeout(t)
    }
    if (status !== 'saved') setJustSaved(false)
  }, [status])

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="pointer-events-auto flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-rose-500 px-3 text-xs font-extrabold text-white shadow-md active:scale-95"
      >
        <AlertTriangle className="h-4 w-4" />
        {compact ? 'Retry' : 'Not saved · Retry'}
      </button>
    )
  }
  if (status === 'saving' || status === 'pending') {
    return (
      <span className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold ${glass}`} role="status">
        <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
        {!compact && 'Saving…'}
      </span>
    )
  }
  if (justSaved) {
    return (
      <span className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold ${glass}`} role="status">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        {!compact && 'Saved'}
      </span>
    )
  }
  if (compact) return null
  return (
    <span className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-bold text-white/90 drop-shadow" title="Changes save by themselves">
      <Cloud className="h-4 w-4" />
      Auto-save
    </span>
  )
}

const MenuItem = ({ icon: Icon, label, onClick, disabled }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    disabled={disabled}
    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
  >
    <Icon className="h-4 w-4 text-slate-500" />
    {label}
  </button>
)

/**
 * The bar over the top of the pet home. Phones: back, title, save state, undo and a menu. PC: every button.
 */
const HomeTopBar = ({
  compact,
  title,
  subtitle,
  status,
  onRetry,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  lighting,
  onLighting,
  onBack,
  onBackground,
  onDex,
  onShop,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const Light = LIGHT[lighting] || LIGHT.auto

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menuOpen])

  const run = (fn) => () => {
    setMenuOpen(false)
    fn()
  }

  // Browser full screen (hides tabs and the address bar). Esc also leaves it, so follow the browser's state.
  const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled
  const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement)
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      // Full screen belongs to the pet home: leaving the page leaves it too.
      if (document.fullscreenElement) document.exitFullscreen?.().catch?.(() => {})
    }
  }, [])
  const toggleFullscreen = () => {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
    p?.catch?.(() => {})
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-slate-900/45 via-slate-900/15 to-transparent px-3 pb-6 pt-3">
      <div className="flex items-center gap-2">
        <IconButton label="Back" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </IconButton>
        <div className="min-w-0 flex-1 pl-1">
          <h1 className="truncate text-lg font-black leading-tight text-white drop-shadow-md sm:text-xl">{title}</h1>
          <p className="truncate text-[11px] font-bold text-white/85 drop-shadow sm:text-xs">{subtitle}</p>
        </div>

        <SaveStatus status={status} onRetry={onRetry} compact={compact} />
        <IconButton label="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="h-5 w-5" />
        </IconButton>

        {compact ? (
          <div ref={menuRef} className="pointer-events-auto relative">
            <IconButton label="More" onClick={() => setMenuOpen((v) => !v)}>
              <MoreHorizontal className="h-5 w-5" />
            </IconButton>
            {menuOpen && (
              <div role="menu" className="ph-modal-enter absolute right-0 top-12 w-56 overflow-hidden rounded-2xl bg-white py-1.5 shadow-2xl ring-1 ring-black/5">
                <MenuItem icon={Redo2} label="Redo" onClick={run(onRedo)} disabled={!canRedo} />
                <MenuItem icon={ImageIcon} label="Background" onClick={run(onBackground)} />
                <MenuItem icon={BookOpen} label="Pet Dex" onClick={run(onDex)} />
                <MenuItem icon={ShoppingBag} label="Shop" onClick={run(onShop)} />
                <MenuItem icon={Light.icon} label={`${Light.label} (tap to change)`} onClick={onLighting} />
              </div>
            )}
          </div>
        ) : (
          <>
            <IconButton label="Redo (Ctrl+Y)" onClick={onRedo} disabled={!canRedo}>
              <Redo2 className="h-5 w-5" />
            </IconButton>
            <span className="mx-1 h-6 w-px bg-white/40" />
            {canFullscreen && (
              <IconButton label={isFullscreen ? 'Exit full screen (Esc)' : 'Full screen'} onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </IconButton>
            )}
            <IconButton label={`${Light.label} (click to change)`} onClick={onLighting}>
              <Light.icon className="h-5 w-5" />
            </IconButton>
            <button type="button" onClick={onBackground} className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-extrabold transition active:scale-95 ${glass}`}>
              <ImageIcon className="h-4 w-4" />
              Background
            </button>
            <button type="button" onClick={onDex} className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-extrabold transition active:scale-95 ${glass}`}>
              <BookOpen className="h-4 w-4" />
              Dex
            </button>
            <button type="button" onClick={onShop} className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-extrabold transition active:scale-95 ${glass}`}>
              <ShoppingBag className="h-4 w-4" />
              Shop
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default HomeTopBar
