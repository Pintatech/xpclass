import React, { useState, useEffect } from 'react'
import { usePet } from '../../hooks/usePet'
import { useInventory } from '../../hooks/useInventory'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabase/client'
import { Lock, ShoppingCart, X } from 'lucide-react'

const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary']

const rarityCardColors = {
  common: 'border-gray-300 bg-gray-50',
  uncommon: 'border-green-300 bg-green-50',
  rare: 'border-blue-300 bg-blue-50',
  epic: 'border-purple-300 bg-purple-50',
  legendary: 'border-yellow-300 bg-yellow-50',
}

const rarityBadgeColors = {
  common: 'text-gray-700 bg-gray-200',
  uncommon: 'text-green-700 bg-green-200',
  rare: 'text-blue-700 bg-blue-200',
  epic: 'text-purple-700 bg-purple-200',
  legendary: 'text-yellow-700 bg-yellow-200',
}

const rarityEggGradient = {
  common: 'from-gray-200 to-gray-400',
  uncommon: 'from-green-200 to-green-400',
  rare: 'from-blue-200 to-blue-400',
  epic: 'from-purple-200 to-purple-500',
  legendary: 'from-yellow-200 to-amber-400',
}

const rarityEggEmoji = {
  common: '🥚',
  uncommon: '🥚',
  rare: '🥚',
  epic: '🥚',
  legendary: '🥚',
}

const rarityButtonGradient = {
  common: 'from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600',
  uncommon: 'from-green-400 to-green-500 hover:from-green-500 hover:to-green-600',
  rare: 'from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600',
  epic: 'from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600',
  legendary: 'from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600',
}

const PetShop = () => {
  const { buyEgg } = usePet()
  const { inventory, fetchInventory } = useInventory()
  const { user, profile, fetchUserProfile } = useAuth()

  const [eggCatalog, setEggCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [buyingEggId, setBuyingEggId] = useState(null)
  const [message, setMessage] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null) // { egg, currency }

  useEffect(() => {
    fetchEggCatalog()
  }, [])

  const fetchEggCatalog = async () => {
    try {
      const { data, error } = await supabase
        .from('collectible_items')
        .select('*')
        .eq('item_type', 'egg')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      setEggCatalog(data || [])
    } catch (error) {
      console.error('Error fetching egg catalog:', error)
    } finally {
      setLoading(false)
    }
  }

  const openConfirmModal = (egg, currency) => {
    setConfirmModal({ egg, currency })
  }

  const closeConfirmModal = () => {
    setConfirmModal(null)
  }

  const handleConfirmPurchase = async () => {
    if (!confirmModal) return

    const { egg, currency } = confirmModal
    setBuyingEggId(egg.id)
    closeConfirmModal()

    const result = await buyEgg(egg.id, currency)

    if (result.success) {
      const spentText = currency === 'xp'
        ? `-${result.xp_spent} XP`
        : `-${result.gems_spent} gems`
      setMessage({ type: 'success', text: `Bought ${result.egg_name}! (${spentText})` })
      await fetchInventory()
      if (user) await fetchUserProfile(user.id)
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to buy egg' })
    }

    setBuyingEggId(null)
    setTimeout(() => setMessage(null), 3000)
  }

  const getEggQuantity = (eggId) => {
    const entry = inventory.find(i => i.item_id === eggId)
    return entry?.quantity || 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Egg Shop</h1>
        <p className="text-gray-600">Buy and open eggs to discover new pets!</p>

        {profile && (
          <div className="mt-4 inline-flex items-center gap-4">
            <div className="inline-flex items-center gap-2 bg-blue-100 px-4 py-2 rounded-lg">
              <img src="https://xpclass.vn/xpclass/image/study/gem.png" alt="Gems" className="w-5 h-5" />
              <span className="font-bold text-blue-800">{profile.gems || 0} Gems</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-yellow-100 px-4 py-2 rounded-lg">
              <img src="https://xpclass.vn/xpclass/image/study/xp2.png" alt="XP" className="w-5 h-5" />
              <span className="font-bold text-yellow-600">{profile.xp || 0} XP</span>
            </div>
          </div>
        )}
      </div>

      {/* Message Toast - Fixed Top Right */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* ===== EGG SHOP ===== */}
      <div className="mb-10">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          Buy Eggs
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {eggCatalog.sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)).map(egg => {
            const canAfford = (profile?.gems || 0) >= egg.price_gems

            return (
              <div
                key={egg.id}
                className={`border-2 rounded-xl p-4 transition-all hover:shadow-lg ${rarityCardColors[egg.rarity]}`}
              >
                {/* Rarity Badge */}
                <div className="flex justify-between items-start mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rarityBadgeColors[egg.rarity]}`}>
                    {egg.rarity.toUpperCase()}
                  </span>
                </div>

                {/* Egg Image */}
                <div className={`w-full aspect-square rounded-xl bg-gradient-to-br ${rarityEggGradient[egg.rarity]} flex items-center justify-center mb-3 shadow-inner`}>
                  {egg.image_url ? (
                    <img src={egg.image_url} alt={egg.name} className="w-3/4 h-3/4 object-contain" />
                  ) : (
                    <span className="text-4xl">{rarityEggEmoji[egg.rarity]}</span>
                  )}
                </div>

                {/* Egg Name */}
                <h3 className="text-sm font-bold text-gray-800 mb-2 text-center">{egg.name}</h3>

                {/* Buy Buttons */}
                <div className="space-y-2">
                  {/* Gems Button */}
                  {egg.price_gems > 0 && (
                    <button
                      onClick={() => openConfirmModal(egg, 'gems')}
                      disabled={buyingEggId === egg.id || !canAfford}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                        canAfford
                          ? `bg-gradient-to-r ${rarityButtonGradient[egg.rarity]} text-white`
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      } disabled:opacity-50`}
                    >
                      <img src="https://xpclass.vn/xpclass/image/study/gem.png" alt="Gem" className="w-3.5 h-3.5" />
                      {buyingEggId === egg.id ? '...' : egg.price_gems}
                    </button>
                  )}

                  {/* XP Button */}
                  {egg.price_xp > 0 && (
                    <button
                      onClick={() => openConfirmModal(egg, 'xp')}
                      disabled={buyingEggId === egg.id || (profile?.xp || 0) < egg.price_xp}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                        (profile?.xp || 0) >= egg.price_xp
                          ? `bg-gradient-to-r ${rarityButtonGradient[egg.rarity]} text-white`
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      } disabled:opacity-50`}
                    >
                      <img src="https://xpclass.vn/xpclass/image/study/xp2.png" alt="XP" className="w-3.5 h-3.5" />
                      {buyingEggId === egg.id ? '...' : egg.price_xp}
                    </button>
                  )}

                  {/* No purchase options */}
                  {(!egg.price_gems || egg.price_gems <= 0) && (!egg.price_xp || egg.price_xp <= 0) && (
                    <div className="w-full py-1.5 flex items-center justify-center gap-1 text-gray-400 text-xs">
                      <Lock className="w-3 h-3" />
                      Not for sale
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`relative bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border-2 ${rarityCardColors[confirmModal.egg.rarity]}`}>
            {/* Close Button */}
            <button
              onClick={closeConfirmModal}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Egg Image */}
            <div className={`w-24 h-24 mx-auto rounded-xl bg-gradient-to-br ${rarityEggGradient[confirmModal.egg.rarity]} flex items-center justify-center mb-4 shadow-inner`}>
              {confirmModal.egg.image_url ? (
                <img src={confirmModal.egg.image_url} alt={confirmModal.egg.name} className="w-3/4 h-3/4 object-contain" />
              ) : (
                <span className="text-4xl">{rarityEggEmoji[confirmModal.egg.rarity]}</span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-gray-800 text-center mb-2">
              Buy {confirmModal.egg.name}?
            </h3>
            <div className="flex justify-center mb-4">
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${rarityBadgeColors[confirmModal.egg.rarity]}`}>
                {confirmModal.egg.rarity.toUpperCase()}
              </span>
            </div>

            {/* Price Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
              {/* Current Balance */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Current:</span>
                <span className="font-bold flex items-center gap-1">
                  {confirmModal.currency === 'xp' ? (
                    <>
                      <img src="https://xpclass.vn/xpclass/image/study/xp2.png" alt="XP" className="w-4 h-4" />
                      {profile?.xp || 0} XP
                    </>
                  ) : (
                    <>
                      <img src="https://xpclass.vn/xpclass/image/study/gem.png" alt="Gems" className="w-4 h-4" />
                      {profile?.gems || 0} Gems
                    </>
                  )}
                </span>
              </div>

              {/* Price */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Price:</span>
                <span className="font-bold text-red-500 flex items-center gap-1">
                  {confirmModal.currency === 'xp' ? (
                    <>
                      <img src="https://xpclass.vn/xpclass/image/study/xp2.png" alt="XP" className="w-4 h-4" />
                      -{confirmModal.egg.price_xp} XP
                    </>
                  ) : (
                    <>
                      <img src="https://xpclass.vn/xpclass/image/study/gem.png" alt="Gems" className="w-4 h-4" />
                      -{confirmModal.egg.price_gems} Gems
                    </>
                  )}
                </span>
              </div>

              <hr className="border-gray-200" />

              {/* After Purchase */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">After:</span>
                <span className="font-bold text-green-600 flex items-center gap-1">
                  {confirmModal.currency === 'xp' ? (
                    <>
                      <img src="https://xpclass.vn/xpclass/image/study/xp2.png" alt="XP" className="w-4 h-4" />
                      {(profile?.xp || 0) - confirmModal.egg.price_xp} XP
                    </>
                  ) : (
                    <>
                      <img src="https://xpclass.vn/xpclass/image/study/gem.png" alt="Gems" className="w-4 h-4" />
                      {(profile?.gems || 0) - confirmModal.egg.price_gems} Gems
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={closeConfirmModal}
                className="flex-1 py-2 rounded-lg border-2 border-gray-300 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPurchase}
                className={`flex-1 py-2 rounded-lg bg-gradient-to-r ${rarityButtonGradient[confirmModal.egg.rarity]} text-white font-bold transition-colors`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
  )
}

export default PetShop
