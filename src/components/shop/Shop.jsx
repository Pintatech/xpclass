import { useState, useEffect } from 'react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { ShoppingBag, Check } from 'lucide-react'

const Shop = () => {
  const { user, profile, updateProfile } = useAuth()
  const { spendGems, spendXP } = useProgress()
  const [items, setItems] = useState([])
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('avatar')
  const [purchasing, setPurchasing] = useState(null)
  const [confirmItem, setConfirmItem] = useState(null)

  useEffect(() => {
    if (user) {
      fetchShopData()
    }
  }, [user])

  const fetchShopData = async () => {
    try {
      setLoading(true)

      const [itemsResult, purchasesResult] = await Promise.all([
        supabase
          .from('shop_items')
          .select('*')
          .eq('is_active', true)
          .order('price'),
        supabase
          .from('user_purchases')
          .select('item_id, purchased_at')
          .eq('user_id', user.id)
      ])

      if (itemsResult.error) throw itemsResult.error
      if (purchasesResult.error) throw purchasesResult.error

      setItems(itemsResult.data || [])
      setPurchases(purchasesResult.data || [])
    } catch (err) {
      console.error('Error fetching shop data:', err)
    } finally {
      setLoading(false)
    }
  }

  const isOwned = (itemId) => {
    return purchases.some(p => p.item_id === itemId)
  }

  const isXPItem = (item) => item.price_type === 'xp'

  const canAffordItem = (item) => {
    if (isXPItem(item)) {
      return (profile?.xp || 0) >= item.price
    }
    return (profile?.gems || 0) >= item.price
  }

  const handlePurchase = (item) => {
    if (purchasing || isOwned(item.id)) return

    if (!canAffordItem(item)) {
      alert(isXPItem(item) ? 'Bạn không đủ XP!' : 'Bạn không đủ gems!')
      return
    }

    setConfirmItem(item)
  }

  const confirmPurchase = async () => {
    const item = confirmItem
    if (!item) return
    setConfirmItem(null)
    setPurchasing(item.id)

    try {
      // Deduct currency based on price type
      const result = isXPItem(item)
        ? await spendXP(item.price)
        : await spendGems(item.price)
      if (!result.success) {
        alert(result.error || 'Không thể mua vật phẩm')
        return
      }

      // Record purchase
      const { error } = await supabase
        .from('user_purchases')
        .insert({
          user_id: user.id,
          item_id: item.id
        })

      if (error) throw error

      // Refresh purchases
      setPurchases(prev => [...prev, { item_id: item.id, purchased_at: new Date().toISOString() }])
    } catch (err) {
      console.error('Error purchasing item:', err)
      alert('Lỗi khi mua vật phẩm: ' + (err.message || 'Unknown error'))
    } finally {
      setPurchasing(null)
    }
  }

  const handleEquip = async (item) => {
    try {
      if (item.category === 'avatar') {
        const avatarUrl = item.item_data?.avatar_url || item.image_url
        await updateProfile({ avatar_url: avatarUrl })
        alert('Đã trang bị avatar!')
      } else if (item.category === 'frame') {
        const frameUrl = item.image_url
        const frameRatio = item.item_data?.avatar_ratio || 66
        await updateProfile({ active_title: frameUrl, active_frame_ratio: frameRatio })
        alert('Đã trang bị khung!')
      } else if (item.category === 'background') {
        const { data, error } = await supabase.rpc('equip_background', {
          p_user_id: user.id,
          p_item_id: item.id
        })
        if (error) throw error
        if (data.success) {
          await updateProfile({ active_background_url: data.background_url })
          alert('Đã trang bị background!')
        } else {
          alert(data.error || 'Không thể trang bị background')
        }
      }
    } catch (err) {
      console.error('Error equipping item:', err)
      alert('Lỗi khi trang bị: ' + (err.message || 'Unknown error'))
    }
  }

  const categories = [
    { key: 'avatar', label: 'Avatar' },
    { key: 'frame', label: 'Frame' },
    { key: 'background', label: 'Background' },
    { key: 'school', label: 'School things' },

  ]


//Item nào hiện nút trang bị
  const equippableCategories = ['avatar', 'frame', 'background']

  const isEquipped = (item) => {
    if (item.category === 'avatar') {
      const avatarUrl = item.item_data?.avatar_url || item.image_url
      return profile?.avatar_url === avatarUrl
    }
    if (item.category === 'frame') {
      return profile?.active_title === item.image_url
    }
    if (item.category === 'background') {
      const backgroundUrl = item.item_data?.background_url || item.image_url
      return profile?.active_background_url === backgroundUrl
    }
    return false
  }
  const filteredItems = items
    .filter(item => item.category === activeTab)
    .sort((a, b) => {
      if (isXPItem(a) === isXPItem(b)) return 0
      return isXPItem(a) ? -1 : 1
    })

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Cửa hàng</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-yellow-400 text-white rounded-full px-4 py-2 flex items-center gap-2 font-bold shadow-md">
            <img src="https://xpclass.vn/xpclass/image/study/xp2.png" alt="XP" className="w-5 h-5" />
            {(profile?.xp || 0).toLocaleString()}
          </div>
          <div className="bg-blue-400 text-white rounded-full px-4 py-2 flex items-center gap-2 font-bold shadow-md">
            <img src="https://xpclass.vn/xpclass/image/study/gem.png" alt="Gems" className="w-5 h-5" />
            {profile?.gems || 0}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveTab(cat.key)}
            className={`px-5 py-2 rounded-full font-medium transition-all flex-shrink-0 ${activeTab === cat.key
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Chưa có vật phẩm nào</p>
          <p className="text-sm mt-1">Hãy quay lại sau nhé!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredItems.map(item => {
            const owned = isOwned(item.id)
            const canAfford = canAffordItem(item)

            return (
              <div
                key={item.id}
                className={`relative bg-white rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg ${
                  !owned && !canAfford
                    ? 'border-gray-200 opacity-75'
                    : 'border-gray-200 hover:border-blue-300'
                  }`}
              >
                {/* Equipped badge */}
                {isEquipped(item) && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1 z-10">
                    <Check className="w-3 h-3" />
                  </div>
                )}

                {/* Item image */}
                <div className="aspect-square bg-gray-50 flex items-center justify-center p-4">
                  {item.image_url ? (
                    item.category === 'background' ? (
                      <div
                        className="w-full h-full rounded-lg bg-cover bg-center"
                        style={{ backgroundImage: `url(${item.item_data?.background_url || item.image_url})` }}
                      />
                    ) : (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-contain rounded-lg"
                      />
                    )
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-2xl">
                      {item.category === 'avatar' ? '👤' : '🏷️'}
                    </div>
                  )}
                </div>

                {/* Item info */}
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-gray-800 truncate">{item.name}</h3>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{item.description}</p>
                  )}

                  {/* Price / Action */}
                  <div className="mt-2">
                    {owned ? (
                      equippableCategories.includes(item.category) ? (
                        isEquipped(item) ? (
                          <button
                            disabled
                            className="w-full py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium opacity-60 cursor-not-allowed"
                          >
                            Đã trang bị
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEquip(item)}
                            className="w-full py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                          >
                            Trang bị
                          </button>
                        )
                      ) : (
                        <div className="w-full py-1.5 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium text-center">
                          Đã mua
                        </div>
                      )
                    ) : (
                      <button
                        onClick={() => handlePurchase(item)}
                        disabled={!canAfford || purchasing === item.id}
                        className={`w-full py-1.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors ${canAfford
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                      >
                        {purchasing === item.id ? (
                          'Đang mua...'
                        ) : (
                          <>
                            {isXPItem(item) ? (
                              <img src="https://xpclass.vn/xpclass/image/study/xp2.png" alt="XP" className="w-4 h-4" />
                            ) : (
                              <img src="https://xpclass.vn/xpclass/image/study/gem.png" alt="Gem" className="w-4 h-4" />
                            )}
                            {item.price}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {/* Confirm Modal */}
      {confirmItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmItem(null)}>
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center">
              {confirmItem.image_url && (
                <img src={confirmItem.image_url} alt={confirmItem.name} className="w-24 h-24 object-contain mb-3" />
              )}
              <h3 className="font-bold text-lg text-gray-800">{confirmItem.name}</h3>
              <div className="flex items-center gap-1 mt-2 text-base font-semibold text-gray-600">
                {isXPItem(confirmItem) ? (
                  <img src="https://xpclass.vn/xpclass/image/study/xp2.png" alt="XP" className="w-5 h-5" />
                ) : (
                  <img src="https://xpclass.vn/xpclass/image/study/gem.png" alt="Gem" className="w-5 h-5" />
                )}
                {confirmItem.price}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirmItem(null)}
                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmPurchase}
                className="flex-1 py-2 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
              >
                Mua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Shop
