import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Package, X } from 'lucide-react'
import { EVENT_SHOP_ITEMS, EVENT_SHOP_RARITY } from '../../config/eventShop'
import { assetUrl } from '../../hooks/useBranding'

/**
 * The event shop's window display.
 *
 * Nothing here is buyable in the app — the trade is made with a teacher — so
 * the cards deliberately have no buy button and no owned/affordable state. The
 * header says so once, rather than every card carrying a disabled control that
 * looks like something is broken.
 *
 * Portalled for the same reason as EventCharacterPicker: HeroCarousel's
 * transform would otherwise become the containing block for this fixed overlay.
 */
/**
 * An item's artwork.
 *
 * A path is looked up in the assets bucket; anything already absolute is used
 * as it stands, so an item can point straight at an image elsewhere on the web
 * without assetUrl gluing the bucket in front of it.
 *
 * The art is uploaded separately from this list, so an item can exist here
 * before its file does. A failed load falls back to a neutral box rather than
 * the browser's broken-image glyph, which reads as a bug rather than as art on
 * the way.
 */
const imageSrc = (image) => (/^(https?:)?\/\/|^data:/.test(image) ? image : assetUrl(image))

const ItemImage = ({ item }) => {
  const [failed, setFailed] = useState(false)
  const missing = !item.image || failed

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
      {missing ? (
        <Package className="h-8 w-8 text-gray-300" aria-hidden="true" />
      ) : (
        <img
          src={imageSrc(item.image)}
          alt={item.name}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-1"
        />
      )}
    </div>
  )
}

const EventShop = ({ onClose }) => {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-white">
          <h2 className="text-lg font-bold">Cửa hàng sự kiện</h2>
          <p className="text-sm opacity-90">
            Vật phẩm độc quyền, không bán ở cửa hàng thường. Liên hệ giáo viên để đổi.
          </p>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="absolute right-3 top-3 rounded-full p-1 text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {EVENT_SHOP_ITEMS.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            Cửa hàng sẽ mở trong thời gian sự kiện.
          </div>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
            {EVENT_SHOP_ITEMS.map((item) => {
              const rarity = EVENT_SHOP_RARITY[item.rarity] || EVENT_SHOP_RARITY.common
              return (
                <div
                  key={item.id}
                  className={`flex gap-3 rounded-xl border-2 bg-gray-50 p-3 ${rarity.ring}`}
                >
                  <ItemImage item={item} />

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold leading-tight text-gray-800">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="mt-0.5 text-xs leading-snug text-gray-500">{item.description}</p>
                    )}
                    <p className="mt-1 text-sm font-bold text-amber-600">{item.price}</p>
                    {item.note && <p className="text-[10px] text-gray-400">{item.note}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex justify-end border-t border-gray-100 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default EventShop
