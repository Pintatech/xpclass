import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { usePet } from '../../hooks/usePet'
import { useInventory } from '../../hooks/useInventory'
import { ShoppingBag, Check, Lock, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'

import { assetUrl } from '../../hooks/useBranding';
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

const rarityButtonGradient = {
  common: 'from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600',
  uncommon: 'from-green-400 to-green-500 hover:from-green-500 hover:to-green-600',
  rare: 'from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600',
  epic: 'from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600',
  legendary: 'from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600',
}

const Shop = () => {
  const [searchParams] = useSearchParams()
  const { user, profile, updateProfile, fetchUserProfile } = useAuth()
  const { spendGems, spendXP } = useProgress()
  const { buyEgg } = usePet()
  const { inventory, fetchInventory, incrementNewCount } = useInventory()

  const [items, setItems] = useState([])
  const [purchases, setPurchases] = useState([])
  const [eggCatalog, setEggCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'avatar')
  const [purchasing, setPurchasing] = useState(null)
  const [confirmItem, setConfirmItem] = useState(null)
  const [activeCollection, setActiveCollection] = useState('all')
  const [variantIndex, setVariantIndex] = useState({}) // { [groupKey]: index }

  // Egg-specific state
  const [buyingEggId, setBuyingEggId] = useState(null)
  const [confirmEggCurrency, setConfirmEggCurrency] = useState(null) // 'gems' or 'xp' when confirmItem is an egg
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (user) {
      fetchShopData()
    }
  }, [user])

  const fetchShopData = async () => {
    try {
      setLoading(true)

      const [itemsResult, purchasesResult, eggsResult] = await Promise.all([
        supabase
          .from('shop_items')
          .select('*')
          .eq('is_active', true)
          .order('price'),
        supabase
          .from('user_purchases')
          .select('item_id, purchased_at')
          .eq('user_id', user.id),
        supabase
          .from('collectible_items')
          .select('*')
          .eq('item_type', 'egg')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
      ])

      if (itemsResult.error) throw itemsResult.error
      if (purchasesResult.error) throw purchasesResult.error
      if (eggsResult.error) throw eggsResult.error

      setItems(itemsResult.data || [])
      setPurchases(purchasesResult.data || [])
      setEggCatalog(eggsResult.data || [])
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

      // Play purchase sound
      new Audio(assetUrl('/sound/shop-purchase.mp3')).play().catch(() => {})

      // Refresh purchases
      setPurchases(prev => [...prev, { item_id: item.id, purchased_at: new Date().toISOString() }])
    } catch (err) {
      console.error('Error purchasing item:', err)
      alert('Lỗi khi mua vật phẩm: ' + (err.message || 'Unknown error'))
    } finally {
      setPurchasing(null)
    }
  }

  // Egg purchase handlers
  const handleConfirmEggPurchase = async () => {
    if (!confirmItem || !confirmEggCurrency) return

    const egg = confirmItem
    const currency = confirmEggCurrency
    setBuyingEggId(egg.id)
    setConfirmItem(null)
    setConfirmEggCurrency(null)

    const result = await buyEgg(egg.id, currency)

    if (result.success) {
      new Audio(assetUrl('/sound/shop-purchase.mp3')).play().catch(() => {})
      const spentText = currency === 'xp'
        ? `-${result.xp_spent} XP`
        : `-${result.gems_spent} gems`
      setMessage({ type: 'success', text: `Bought ${result.egg_name}! (${spentText})` })
      await fetchInventory()
      incrementNewCount('eggs')
      if (user) await fetchUserProfile(user.id)
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to buy egg' })
    }

    setBuyingEggId(null)
    setTimeout(() => setMessage(null), 3000)
  }

  const handleToggleHideFrame = async () => {
    try {
      await updateProfile({ hide_frame: !profile?.hide_frame })
    } catch (err) {
      console.error('Error toggling frame visibility:', err)
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
        await updateProfile({ active_title: frameUrl, active_frame_ratio: frameRatio, hide_frame: false })
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
      } else if (item.category === 'pet') {
        const bowlUrl = item.item_data?.bowl_url || item.image_url
        await updateProfile({ active_bowl_url: bowlUrl })
        alert('Đã trang bị bowl!')
      } else if (item.category === 'spaceship') {
        await updateProfile({ active_spaceship_url: item.image_url, active_spaceship_laser: item.item_data?.laser_color || null })
        alert('Đã trang bị spaceship!')
      } else if (item.category === 'hammer') {
        await updateProfile({ active_hammer_url: item.image_url })
        alert('Đã trang bị hammer!')
      }
    } catch (err) {
      console.error('Error equipping item:', err)
      alert('Lỗi khi trang bị: ' + (err.message || 'Unknown error'))
    }
  }

  const categories = [
    { key: 'avatar', label: 'Avatar' },
    { key: 'frame', label: 'Frame' },
    // { key: 'background', label: 'Background' },
    { key: 'pet', label: 'Pet bowl' },
    { key: 'spaceship', label: 'Spaceship' },
    { key: 'hammer', label: 'Hammer' },
    { key: 'egg', label: 'Egg' },
    // { key: 'school', label: 'School things' },
  ]


//Item nào hiện nút trang bị
  const equippableCategories = ['avatar', 'frame', 'background', 'pet', 'spaceship', 'hammer']

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
    if (item.category === 'pet') {
      const bowlUrl = item.item_data?.bowl_url || item.image_url
      return profile?.active_bowl_url === bowlUrl
    }
    if (item.category === 'spaceship') {
      return profile?.active_spaceship_url === item.image_url
    }
    if (item.category === 'hammer') {
      return profile?.active_hammer_url === item.image_url
    }
    return false
  }
  // Reset collection when switching category tabs
  useEffect(() => {
    setActiveCollection('all')
  }, [activeTab])

  const filteredItems = items
    .filter(item => item.category === activeTab)
    .sort((a, b) => {
      if (isXPItem(a) === isXPItem(b)) return 0
      return isXPItem(a) ? -1 : 1
    })

  // Get unique collections for the active tab
  const collections = [...new Set(filteredItems.map(item => item.item_data?.collection).filter(Boolean))]

  const displayedItems = activeCollection === 'all'
    ? filteredItems
    : filteredItems.filter(item => item.item_data?.collection === activeCollection)

  // Group items by avatar_group (items without a group stay as single entries)
  const groupedDisplayItems = (() => {
    const groups = []
    const groupMap = {}
    displayedItems.forEach(item => {
      const data = typeof item.item_data === 'string' ? JSON.parse(item.item_data) : item.item_data
      const groupKey = data?.avatar_group
      if (groupKey) {
        if (!groupMap[groupKey]) {
          groupMap[groupKey] = { groupKey, variants: [] }
          groups.push(groupMap[groupKey])
        }
        groupMap[groupKey].variants.push(item)
      } else {
        groups.push({ groupKey: null, variants: [item] })
      }
    })
    groups.forEach(g => g.variants.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))
    groups.sort((a, b) => a.variants[0].name.localeCompare(b.variants[0].name, undefined, { numeric: true }))
    return groups
  })()

  const sortedEggs = eggCatalog.sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity))

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
      {/* Message Toast */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 font-semibold text-sm ${
            message.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}
          style={{ animation: 'slideInFromTop 0.3s ease-out' }}
        >
          <span>{message.type === 'success' ? '✨' : '❌'}</span>
          {message.text}
          <style>{`@keyframes slideInFromTop { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <img src={assetUrl('/icon/navigation/shop.svg')} alt="Shop" className="w-8 h-8" />
          <h1 className="text-2xl font-bold text-gray-900">Shop</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-yellow-400 text-white rounded-full px-4 py-2 flex items-center gap-2 font-bold shadow-md">
            <img src={assetUrl('/image/study/xp.png')} alt="XP" className="w-5 h-5" />
            {(profile?.xp || 0).toLocaleString()}
          </div>
          <div className="bg-blue-400 text-white rounded-full px-4 py-2 flex items-center gap-2 font-bold shadow-md">
            <img src={assetUrl('/image/study/gem.png')} alt="Gems" className="w-5 h-5" />
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

      {/* Collection Sub-tabs */}
      {activeTab !== 'egg' && collections.length > 0 && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          <button
            onClick={() => setActiveCollection('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex-shrink-0 ${
              activeCollection === 'all'
                ? 'bg-blue-100 text-blue-700 shadow-sm'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            All
          </button>
          {collections.map(col => (
            <button
              key={col}
              onClick={() => setActiveCollection(col)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex-shrink-0 ${
                activeCollection === col
                  ? 'bg-blue-100 text-blue-700 shadow-sm'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {col}
            </button>
          ))}
        </div>
      )}

      {/* Egg Grid */}
      {activeTab === 'egg' ? (
        sortedEggs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Chưa có trứng nào</p>
            <p className="text-sm mt-1">Hãy quay lại sau nhé!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {sortedEggs.map(egg => {
              const canAffordGems = (profile?.gems || 0) >= egg.price_gems

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
                      <span className="text-4xl">🥚</span>
                    )}
                  </div>

                  {/* Egg Name */}
                  <h3 className="text-sm font-bold text-gray-800 mb-2 text-center">{egg.name}</h3>

                  {/* Buy Buttons */}
                  <div className="space-y-2">
                    {egg.price_gems > 0 && (
                      <button
                        onClick={() => { setConfirmItem(egg); setConfirmEggCurrency('gems') }}
                        disabled={buyingEggId === egg.id || !canAffordGems}
                        className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                          canAffordGems
                            ? `bg-gradient-to-r ${rarityButtonGradient[egg.rarity]} text-white`
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        } disabled:opacity-50`}
                      >
                        <img src={assetUrl('/image/study/gem.png')} alt="Gem" className="w-3.5 h-3.5" />
                        {buyingEggId === egg.id ? '...' : egg.price_gems}
                      </button>
                    )}

                    {egg.price_xp > 0 && (
                      <button
                        onClick={() => { setConfirmItem(egg); setConfirmEggCurrency('xp') }}
                        disabled={buyingEggId === egg.id || (profile?.xp || 0) < egg.price_xp}
                        className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                          (profile?.xp || 0) >= egg.price_xp
                            ? `bg-gradient-to-r ${rarityButtonGradient[egg.rarity]} text-white`
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        } disabled:opacity-50`}
                      >
                        <img src={assetUrl('/image/study/xp.png')} alt="XP" className="w-3.5 h-3.5" />
                        {buyingEggId === egg.id ? '...' : egg.price_xp}
                      </button>
                    )}

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
        )
      ) : (
        /* Regular Items Grid */
        groupedDisplayItems.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Chưa có vật phẩm nào</p>
            <p className="text-sm mt-1">Hãy quay lại sau nhé!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {groupedDisplayItems.map(group => {
              const idx = group.groupKey ? (variantIndex[group.groupKey] || 0) : 0
              const item = group.variants[idx]
              const hasVariants = group.variants.length > 1
              const owned = isOwned(item.id)
              const canAfford = canAffordItem(item)
              return (
                <div
                  key={group.groupKey || item.id}
                  className={`relative bg-white rounded-xl border-2 overflow-hidden transition-all duration-200 ${
                    !owned && !canAfford
                      ? 'border-gray-200 grayscale opacity-60'
                      : `hover:shadow-xl hover:scale-[1.03] ${
                          owned
                            ? 'border-green-300 hover:border-green-400 hover:shadow-green-100'
                            : 'border-gray-200 hover:border-blue-400 hover:shadow-blue-100'}`
                    }`}
                >
                  {/* Equipped badge */}
                  {isEquipped(item) && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1 z-10">
                      <Check className="w-3 h-3" />
                    </div>
                  )}

                  {/* Owned badge for variants */}
                  {hasVariants && owned && !isEquipped(item) && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 z-10">
                      <Check className="w-3 h-3" />
                    </div>
                  )}

                  {/* XP bonus badge */}
                  {item.item_data?.xp_bonus > 0 && (
                    <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 rounded-full px-1.5 py-0.5 text-[10px] font-bold z-10 shadow">
                      +{item.item_data.xp_bonus}% XP
                    </div>
                  )}

                  {/* Item image with variant arrows */}
                  <div className="aspect-square bg-gray-50 flex items-center justify-center p-4 relative">
                    {!owned && !canAfford && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
                        <Lock className="w-6 h-6 text-white drop-shadow" />
                      </div>
                    )}
                    {hasVariants && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setVariantIndex(prev => ({ ...prev, [group.groupKey]: (idx - 1 + group.variants.length) % group.variants.length })) }}
                          className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-0.5 shadow z-10"
                        >
                          <ChevronLeft className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setVariantIndex(prev => ({ ...prev, [group.groupKey]: (idx + 1) % group.variants.length })) }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-0.5 shadow z-10"
                        >
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                      </>
                    )}
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
                          style={item.category === 'hammer' ? { transform: 'rotate(90deg)' } : undefined}
                        />
                      )
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-2xl">
                        {item.category === 'avatar' ? '👤' : '🏷️'}
                      </div>
                    )}
                  </div>

                  {/* Variant dots — always rendered to keep layout stable */}
                  <div className="flex justify-center gap-1 py-1 min-h-[20px]">
                    {hasVariants && group.variants.map((v, i) => (
                      <button
                        key={v.id}
                        onClick={() => setVariantIndex(prev => ({ ...prev, [group.groupKey]: i }))}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i === idx
                            ? 'bg-blue-500 scale-125'
                            : isOwned(v.id) ? 'bg-green-300' : 'bg-gray-300'
                        }`}
                      />
                    ))}
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
                            <div className="space-y-1">
                              <button
                                disabled
                                className="w-full py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium opacity-60 cursor-not-allowed"
                              >
                                Đã trang bị
                              </button>
                              {item.category === 'frame' && (
                                <button
                                  onClick={handleToggleHideFrame}
                                  className={`w-full py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                                    profile?.hide_frame
                                      ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                      : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                  }`}
                                >
                                  {profile?.hide_frame ? (
                                    <><Eye className="w-3 h-3" /> Hiện khung</>
                                  ) : (
                                    <><EyeOff className="w-3 h-3" /> Ẩn khung</>
                                  )}
                                </button>
                              )}
                            </div>
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
                          className={`w-full py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all duration-100 shadow-md ${canAfford
                              ? 'bg-gradient-to-b from-blue-400 to-blue-600 text-white hover:from-blue-500 hover:to-blue-700 active:scale-95 active:shadow-inner active:translate-y-0.5'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                            }`}
                        >
                          {purchasing === item.id ? (
                            <span className="animate-pulse">...</span>
                          ) : (
                            <>
                              {isXPItem(item) ? (
                                <img src={assetUrl('/image/study/xp.png')} alt="XP" className="w-4 h-4" />
                              ) : (
                                <img src={assetUrl('/image/study/gem.png')} alt="Gem" className="w-4 h-4" />
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
        )
      )}

      {/* Confirm Modal */}
      {confirmItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setConfirmItem(null); setConfirmEggCurrency(null) }}>
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center">
              {confirmItem.image_url && (
                <img src={confirmItem.image_url} alt={confirmItem.name} className="w-24 h-24 object-contain mb-3" />
              )}
              <h3 className="font-bold text-lg text-gray-800">{confirmItem.name}</h3>
              <div className="flex items-center gap-1 mt-2 text-base font-semibold text-gray-600">
                {confirmEggCurrency ? (
                  confirmEggCurrency === 'xp' ? (
                    <>
                      <img src={assetUrl('/image/study/xp.png')} alt="XP" className="w-5 h-5" />
                      {confirmItem.price_xp}
                    </>
                  ) : (
                    <>
                      <img src={assetUrl('/image/study/gem.png')} alt="Gem" className="w-5 h-5" />
                      {confirmItem.price_gems}
                    </>
                  )
                ) : (
                  <>
                    {isXPItem(confirmItem) ? (
                      <img src={assetUrl('/image/study/xp.png')} alt="XP" className="w-5 h-5" />
                    ) : (
                      <img src={assetUrl('/image/study/gem.png')} alt="Gem" className="w-5 h-5" />
                    )}
                    {confirmItem.price}
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setConfirmItem(null); setConfirmEggCurrency(null) }}
                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmEggCurrency ? handleConfirmEggPurchase : confirmPurchase}
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
