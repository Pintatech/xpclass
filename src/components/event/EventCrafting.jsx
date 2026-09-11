import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Hammer, Package, Sparkles, X } from 'lucide-react'
import CraftingTable from '../inventory/CraftingTable'
import { useInventory } from '../../hooks/useInventory'
import { assetUrl } from '../../hooks/useBranding'

/**
 * The crafting table, in the hero banner.
 *
 * This is the real bench, not a way through to one: it mounts the same
 * CraftingTable the inventory page uses and calls the same craft_recipe RPC, so
 * ingredients are spent and results awarded from here. Sharing that component
 * rather than restating it is the point — a second table would be a second set
 * of matching rules to keep in step, and they would drift.
 *
 * Portalled for the same reason as EventShop and the character picker:
 * HeroCarousel puts a transform on its track, which would otherwise make it the
 * containing block for anything fixed inside it and trap this overlay in the
 * banner.
 */
const EventCrafting = ({ onClose }) => {
  const {
    recipes,
    inventory,
    loading,
    getItemQuantity,
    craftRecipe,
    craftResult,
    clearCraftResult
  } = useInventory()

  const [crafting, setCrafting] = useState(false)
  // A result arrives from the shared hook, which the inventory page also reads.
  // Only the newest one should sound, and only once.
  const announced = useRef(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Anything left over is cleared on the way out, or the next opening of the
  // panel would announce a craft that happened minutes ago.
  useEffect(() => () => clearCraftResult(), []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!craftResult || announced.current === craftResult) return
    announced.current = craftResult

    const audio = new Audio(assetUrl(craftResult.success ? '/sound/craft_success.mp3' : '/sound/craft_fail.mp3'))
    audio.volume = 0.5
    audio.play().catch(() => {})

    const timer = setTimeout(() => clearCraftResult(), 2600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [craftResult])

  const handleCraft = async (recipeId) => {
    setCrafting(true)
    try {
      return await craftRecipe(recipeId)
    } finally {
      setCrafting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-r from-purple-600 to-fuchsia-500 px-6 py-4 text-white">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Hammer className="h-5 w-5" />
            Bàn chế tạo
          </h2>
          <p className="text-sm opacity-90">
            Ghép nguyên liệu rơi ra từ trận đấu thành vật phẩm mới.
          </p>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="absolute right-3 top-3 rounded-full p-1 text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto bg-gray-50 p-4">
          {loading && recipes.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">Đang tải nguyên liệu…</div>
          ) : recipes.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="mx-auto mb-2 h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-500">Chưa có công thức nào.</p>
            </div>
          ) : (
            <CraftingTable
              recipes={recipes}
              inventory={inventory}
              getItemQuantity={getItemQuantity}
              onCraft={handleCraft}
              crafting={crafting}
            />
          )}
        </div>

        {/* Over the table rather than beside it: the result is the answer to the
            thing the student just pressed, and the eye is already there. */}
        {craftResult && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div
              className={`animate-loot-pop flex items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl ${
                craftResult.success ? 'bg-white ring-2 ring-green-400' : 'bg-white ring-2 ring-red-300'
              }`}
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-50">
                {craftResult.success && craftResult.result_image_url ? (
                  <img src={craftResult.result_image_url} alt="" className="h-12 w-12 object-contain" />
                ) : craftResult.success ? (
                  <Sparkles className="h-7 w-7 text-purple-500" />
                ) : (
                  <X className="h-7 w-7 text-red-400" />
                )}
              </div>
              <div>
                {craftResult.success ? (
                  <>
                    <p className="text-lg font-bold text-green-600">Thành công ( ﾉ･o･ )ﾉ</p>
                    <p className="text-sm font-semibold text-gray-700">
                      {craftResult.result_item_name || craftResult.result_name}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-red-500">Thất bại T_T</p>
                    {/* A failed craft eats an ingredient, so which one it took is
                        the only thing the student actually needs told. */}
                    {craftResult.lost_item && (
                      <p className="text-sm font-semibold text-gray-700">
                        Mất {craftResult.lost_item.name}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default EventCrafting
