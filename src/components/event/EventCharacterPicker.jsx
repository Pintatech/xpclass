import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import EventCharacter from './EventCharacter'
import { CHARACTER_LIST, getCharacter } from '../../config/eventCharacter'

/**
 * Character chooser for the event hero.
 *
 * The tiles are live idle sprites rather than stills, so what you pick is what
 * you get. Only the stage is clickable-to-attack — a tile can't hold an
 * interactive sprite without nesting a control inside a control.
 */
const EventCharacterPicker = ({ characterId, onChoose, onClose }) => {
  const [selected, setSelected] = useState(characterId)
  const preview = getCharacter(selected)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const confirm = () => {
    onChoose?.(selected)
    onClose?.()
  }

  // Portalled for the same reason as EventStatsPanel: HeroCarousel's transform
  // would otherwise be the containing block for this fixed overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 text-white">
          <h2 className="text-lg font-bold">Chọn nhân vật</h2>
          <p className="text-sm opacity-90">Bấm vào nhân vật để xem đòn đánh.</p>
        </div>

        {/* Stage — the selected character, clickable to attack. */}
        <div className="flex h-44 items-end justify-center bg-gradient-to-b from-sky-100 to-blue-200">
          <EventCharacter key={preview.id} config={preview} scale={3} />
        </div>

        <div className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-5">
          {CHARACTER_LIST.map((c) => {
            const active = c.id === selected
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-2 transition-colors ${
                  active ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex h-16 w-full items-end justify-center">
                  <EventCharacter config={c} scale={1.3} interactive={false} />
                </div>
                <span className={`text-[11px] font-semibold leading-tight ${active ? 'text-blue-700' : 'text-gray-600'}`}>
                  {c.name}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Huỷ
          </button>
          <button
            onClick={confirm}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Chọn
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default EventCharacterPicker
