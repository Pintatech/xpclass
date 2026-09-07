import { useEffect, useMemo, useRef, useState } from 'react'
import SpriteAnimation from '../ui/SpriteAnimation'
import EventCharacter from './EventCharacter'
import { CHARACTER_LIST, animationSrc, getCharacter } from '../../config/eventCharacter'
import { useEventCharacter } from '../../hooks/useEventCharacter'
import { useAuth } from '../../hooks/useAuth'

const NumberField = ({ label, value, onChange, min = 1, max = 512 }) => (
  <label className="flex items-center justify-between gap-3 text-sm">
    <span className="text-gray-600">{label}</span>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value) || min)}
      className="w-20 rounded border border-gray-300 px-2 py-1 text-right"
    />
  </label>
)

/**
 * Scratch page for checking a sprite sheet before it goes in the hero:
 * pick a character and animation, tune the frame box, and drop in any other
 * sheet to test one that isn't in the config yet.
 */
const SpriteLab = () => {
  const { profile } = useAuth()
  const { characterId, chooseCharacter } = useEventCharacter(profile?.id)

  const [inspectId, setInspectId] = useState(characterId)
  const config = getCharacter(inspectId)
  const names = Object.keys(config.animations)

  const [name, setName] = useState('idle')
  const [frameWidth, setFrameWidth] = useState(config.frameWidth)
  const [frameHeight, setFrameHeight] = useState(config.frameHeight)
  const [fps, setFps] = useState(config.animations.idle.fps)
  const [scale, setScale] = useState(4)
  const [flip, setFlip] = useState(false)
  const [dropped, setDropped] = useState(null)
  const [dims, setDims] = useState(null)
  const [log, setLog] = useState([])
  const objectUrlRef = useRef(null)

  const src = dropped?.url || animationSrc(config, name) || animationSrc(config, 'idle')

  // Whatever sheet is on screen, report what it actually is so a mismatched
  // frame box is obvious rather than just "looks slightly wrong".
  useEffect(() => {
    if (!src) return
    let cancelled = false
    const img = new Image()
    img.onload = () => !cancelled && setDims({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => !cancelled && setDims(null)
    img.src = src
    return () => { cancelled = true }
  }, [src])

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  const pickCharacter = (id) => {
    const next = getCharacter(id)
    setInspectId(id)
    setDropped(null)
    setName('idle')
    setFrameWidth(next.frameWidth)
    setFrameHeight(next.frameHeight)
    setFps(next.animations.idle.fps)
  }

  const pickAnimation = (next) => {
    setDropped(null)
    setName(next)
    setFps(config.animations[next]?.fps || 12)
  }

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setDropped({ url, name: file.name })
  }

  const cols = dims ? Math.floor(dims.width / frameWidth) : 0
  const rows = dims ? Math.floor(dims.height / frameHeight) : 0
  const divides = dims ? dims.width % frameWidth === 0 && dims.height % frameHeight === 0 : false
  const declared = dropped ? null : config.animations[name]?.frames

  const summary = useMemo(() => {
    if (!dims) return 'Đang tải sheet…'
    return `${dims.width}×${dims.height}px → ${cols} cột × ${rows} hàng = ${cols * rows} frame`
  }, [dims, cols, rows])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sprite Lab</h1>
        <p className="text-gray-600">Kiểm tra sprite sheet trước khi đưa nhân vật lên hero section.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Raw sheet, stepped at whatever frame box is set on the right. */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]) }}
            className="flex min-h-[320px] items-end justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gradient-to-b from-sky-200 to-emerald-200 p-8"
          >
            <SpriteAnimation
              src={src}
              frameWidth={frameWidth}
              frameHeight={frameHeight}
              frameCount={dropped ? undefined : declared}
              fps={fps}
              scale={scale}
              flip={flip}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
            <div className="font-mono text-gray-700">{summary}</div>
            {dims && !divides && (
              <div className="mt-1 text-amber-600">
                Sheet không chia hết cho khung {frameWidth}×{frameHeight} — chỉnh lại kích thước frame.
              </div>
            )}
            {declared != null && cols * rows > 0 && declared !== cols * rows && (
              <div className="mt-1 text-amber-600">
                Config khai báo {declared} frame nhưng sheet có {cols * rows}.
              </div>
            )}
            <div className="mt-1 text-xs text-gray-500">
              Chia hết không có nghĩa là đúng: sheet Hiệp Sĩ chia hết cho 50 nhưng frame thật rộng 100.
              Nếu nhân vật bị cắt đôi giữa hai frame là khung đang sai.
            </div>
            {dropped && <div className="mt-1 text-gray-500">Đang xem file thả vào: {dropped.name}</div>}
          </div>

          {/* The thing that actually ships: click to attack, then back to idle. */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-gray-700">Click vào nhân vật để tấn công</div>
            <div className="flex items-end gap-6">
              <EventCharacter
                key={config.id}
                config={config}
                scale={4}
                onAttack={(a) => setLog((l) => [a, ...l].slice(0, 6))}
              />
              <div className="font-mono text-xs text-gray-500">
                {log.length ? log.map((a, i) => <div key={i}>{a}</div>) : 'chưa đánh lần nào'}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 text-sm font-semibold text-gray-700">Nhân vật</div>
            <div className="flex flex-wrap gap-2">
              {CHARACTER_LIST.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pickCharacter(c.id)}
                  className={`rounded px-2 py-1 text-xs ${
                    c.id === inspectId ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => chooseCharacter(inspectId)}
              disabled={inspectId === characterId}
              className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-500"
            >
              {inspectId === characterId ? 'Đang dùng ở hero' : 'Dùng nhân vật này ở hero'}
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 text-sm font-semibold text-gray-700">Animation</div>
            <div className="flex flex-wrap gap-2">
              {names.map((n) => (
                <button
                  key={n}
                  onClick={() => pickAnimation(n)}
                  className={`rounded px-2 py-1 text-xs ${
                    !dropped && n === name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm font-semibold text-gray-700">Khung hình</div>
            <NumberField label="Frame width" value={frameWidth} onChange={setFrameWidth} />
            <NumberField label="Frame height" value={frameHeight} onChange={setFrameHeight} />
            <NumberField label="FPS" value={fps} onChange={setFps} min={1} max={60} />
            <NumberField label="Scale" value={scale} onChange={setScale} min={1} max={10} />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} />
              Lật ngang
            </label>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 text-sm font-semibold text-gray-700">Thử sheet khác</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => loadFile(e.target.files?.[0])}
              className="w-full text-xs"
            />
            <p className="mt-2 text-xs text-gray-500">
              Hoặc kéo thả file PNG vào khung xem trước. File chỉ nằm trong trình duyệt, không upload.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SpriteLab
