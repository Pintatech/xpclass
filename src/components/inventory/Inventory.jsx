import { useState, useEffect, useRef } from 'react'
import { useInventory } from '../../hooks/useInventory'
import { useAuth } from '../../hooks/useAuth'
import { usePet } from '../../hooks/usePet'
import { Package, Box, Layers, Sparkles, Egg, History } from 'lucide-react'
import ChestOpenAnimation from './ChestOpenAnimation'
import EggOpenAnimation from '../pet/EggOpenAnimation'
import CraftingTab from './CraftingTab'

const rarityColors = {
  common: 'border-gray-300 bg-gray-50',
  uncommon: 'border-green-400 bg-green-50',
  rare: 'border-blue-400 bg-blue-50',
  epic: 'border-purple-400 bg-purple-50',
  legendary: 'border-yellow-400 bg-yellow-50',
}

const rarityGlow = {
  common: '',
  uncommon: 'shadow-green-200',
  rare: 'shadow-blue-200 shadow-md',
  epic: 'shadow-purple-300 shadow-lg',
  legendary: 'shadow-yellow-300 shadow-xl',
}

const rarityBadge = {
  common: 'bg-gray-200 text-gray-700',
  uncommon: 'bg-green-200 text-green-800',
  rare: 'bg-blue-200 text-blue-800',
  epic: 'bg-purple-200 text-purple-800',
  legendary: 'bg-yellow-200 text-yellow-800',
}

const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary']

const rarityCardColors = {
  common: 'border-gray-300 bg-gray-50',
  uncommon: 'border-green-300 bg-green-50',
  rare: 'border-blue-300 bg-blue-50',
  epic: 'border-purple-300 bg-purple-50',
  legendary: 'border-yellow-300 bg-yellow-50',
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

const Inventory = () => {
  const { refreshProfile } = useAuth()
  const {
    inventory,
    unopenedChests,
    recipes,
    craftHistory,
    loading,
    openChest,
    craftRecipe,
    getItemQuantity,
    getEggsInInventory,
    fetchInventory,
    newCounts,
    markTabViewed,
    craftResult: craftResultFromHook,
    clearCraftResult,
  } = useInventory()
  const { openEgg, allPets } = usePet()

  const [activeTab, setActiveTab] = useState('items')

  useEffect(() => {
    markTabViewed(activeTab)
  }, [activeTab])
  const [chestResult, setChestResult] = useState(null)
  const [openingChest, setOpeningChest] = useState(null)
  const [craftingId, setCraftingId] = useState(null)
  const [openingEggResult, setOpeningEggResult] = useState(null)
  const [openingEggRarity, setOpeningEggRarity] = useState(null)
  const [showCraftFail, setShowCraftFail] = useState(false)
  const [showCraftSuccess, setShowCraftSuccess] = useState(false)
  const audioPlayedRef = useRef(false)

  // Show failure animation when craft fails
  useEffect(() => {
    if (craftResultFromHook?.craft_failed && !audioPlayedRef.current) {
      audioPlayedRef.current = true
      setShowCraftFail(true)
      // Play failure sound
      const audio = new Audio('https://xpclass.vn/xpclass/sound/craft_fail.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {})
      const timer = setTimeout(() => {
        setShowCraftFail(false)
        audioPlayedRef.current = false
        clearCraftResult()
      }, 2000)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [craftResultFromHook?.craft_failed])

  // Show success animation when craft succeeds
  useEffect(() => {
    if (craftResultFromHook?.success && !audioPlayedRef.current) {
      audioPlayedRef.current = true
      setShowCraftSuccess(true)
      // Play success sound
      const audio = new Audio('https://xpclass.vn/xpclass/sound/craft_success.mp3')
      audio.volume = 0.5
      audio.play().catch(() => {})
      const timer = setTimeout(() => {
        setShowCraftSuccess(false)
        audioPlayedRef.current = false
        clearCraftResult()
      }, 2000)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [craftResultFromHook?.success])

  const myEggs = getEggsInInventory()

  // Group inventory by set_name (exclude eggs)
  const groupedInventory = {}
  inventory.forEach(entry => {
    if (!entry.item || entry.item.item_type === 'egg') return
    const group = entry.item.set_name || 'Other'
    if (!groupedInventory[group]) groupedInventory[group] = []
    groupedInventory[group].push(entry)
  })

  const handleOpenChest = async (userChest) => {
    setOpeningChest(userChest)
    const result = await openChest(userChest.id)
    if (result?.success) {
      setChestResult(result)
    } else {
      setOpeningChest(null)
      alert(result?.error || 'Failed to open chest')
    }
  }

  const handleCloseChestAnimation = () => {
    setChestResult(null)
    setOpeningChest(null)
  }

  const handleCraft = async (recipeId) => {
    setCraftingId(recipeId)
    await craftRecipe(recipeId)
    setCraftingId(null)
    // craftResult is now managed by useInventory hook
  }

  const handleOpenEgg = async (egg) => {
    setOpeningEggRarity(egg.item?.rarity || egg.rarity)
    const result = await openEgg(egg.item_id || egg.id)

    if (result.success) {
      setOpeningEggResult(result)
      await fetchInventory()
      if (refreshProfile) await refreshProfile()
    } else {
      setOpeningEggRarity(null)
      alert(result.error || 'Failed to open egg')
    }
  }

  const handleEggAnimationClose = () => {
    setOpeningEggResult(null)
    setOpeningEggRarity(null)
  }

  const handleEggNickname = async (nickname) => {
    if (!openingEggResult?.user_pet_id || !nickname) return
    try {
      const { supabase } = await import('../../supabase/client')
      await supabase
        .from('user_pets')
        .update({ nickname })
        .eq('id', openingEggResult.user_pet_id)
    } catch (error) {
      console.error('Error setting nickname:', error)
    }
  }

  const tabs = [
    { id: 'items', label: 'My Items', icon: Package, count: inventory.filter(i => i.item?.item_type !== 'egg').length, newCount: newCounts.items },
    { id: 'eggs', label: 'Eggs', icon: Egg, count: myEggs.reduce((sum, e) => sum + e.quantity, 0), newCount: newCounts.eggs },
    { id: 'chests', label: 'Chests', icon: Box, count: unopenedChests.length, newCount: newCounts.chests },
    { id: 'crafting', label: 'Crafting', icon: Layers, count: recipes.length },
    { id: 'history', label: 'History', icon: History, count: craftHistory.length },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-600">Your collected items, chests, and crafting recipes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {tab.newCount > 0 && activeTab !== tab.id && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ===== MY ITEMS TAB ===== */}
      {activeTab === 'items' && (
        <div className="space-y-6">
          {Object.keys(groupedInventory).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No items yet</h3>
              <p className="text-gray-500">Complete exercises to earn collectible items!</p>
            </div>
          ) : (
            Object.entries(groupedInventory).map(([setName, entries]) => (
              <div key={setName}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{setName}</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {entries.map(entry => (
                    <div
                      key={entry.id}
                      className={`relative rounded-xl border-2 p-3 transition-all hover:scale-105 ${rarityColors[entry.item.rarity]} ${rarityGlow[entry.item.rarity]}`}
                    >
                      <div className="aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden mb-2">
                        {entry.item.image_url ? (
                          <img src={entry.item.image_url} alt={entry.item.name} className="w-full h-full object-contain" />
                        ) : (
                          <Package className="w-8 h-8 text-gray-300" />
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-900 truncate text-center">{entry.item.name}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${rarityBadge[entry.item.rarity]}`}>
                          {entry.item.rarity}
                        </span>
                      </div>
                      {/* Quantity badge */}
                      {entry.quantity > 1 && (
                        <div className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">
                          {entry.quantity}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===== EGGS TAB ===== */}
      {activeTab === 'eggs' && (
        <div>
          {myEggs.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
              <Egg className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No eggs yet</h3>
              <p className="text-gray-500">Buy eggs from the shop, earn them from exercises, chests, or crafting!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {myEggs
                .sort((a, b) => rarityOrder.indexOf(a.item?.rarity) - rarityOrder.indexOf(b.item?.rarity))
                .map(entry => {
                  const egg = entry.item
                  if (!egg) return null

                  return (
                    <div
                      key={entry.id}
                      className={`relative border-2 rounded-xl p-4 transition-all hover:shadow-lg cursor-pointer ${rarityCardColors[egg.rarity]}`}
                      onClick={() => handleOpenEgg(entry)}
                    >
                      {/* Quantity Badge */}
                      {entry.quantity > 1 && (
                        <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md">
                          {entry.quantity}
                        </div>
                      )}

                      {/* Rarity Badge */}
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mb-3 ${rarityBadge[egg.rarity]}`}>
                        {egg.rarity.toUpperCase()}
                      </span>

                      {/* Egg Image */}
                      <div className={`w-full aspect-square rounded-xl bg-gradient-to-br ${rarityEggGradient[egg.rarity]} flex items-center justify-center mb-3 shadow-inner`}>
                        {egg.image_url ? (
                          <img src={egg.image_url} alt={egg.name} className="w-3/4 h-3/4 object-contain" />
                        ) : (
                          <span className="text-4xl">🥚</span>
                        )}
                      </div>

                      {/* Name */}
                      <h3 className="text-sm font-bold text-gray-800 mb-2 text-center">{egg.name}</h3>

                      {/* Open Button */}
                      <button
                        className={`w-full py-2 bg-gradient-to-r ${rarityButtonGradient[egg.rarity]} text-white font-bold rounded-lg transition-colors text-sm`}
                      >
                        Open
                      </button>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* ===== CHESTS TAB ===== */}
      {activeTab === 'chests' && (
        <div className="space-y-4">
          {unopenedChests.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Box className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No chests to open</h3>
              <p className="text-gray-500">Complete sessions and milestones to earn chests!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {unopenedChests.map(uc => {
                const chestRarityStyles = {
                  common: { border: 'border-gray-300', bg: 'bg-gradient-to-br from-gray-100 to-gray-200', icon: 'text-gray-600', label: 'text-gray-600', btn: 'from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600' },
                  uncommon: { border: 'border-green-400', bg: 'bg-gradient-to-br from-green-100 to-green-200', icon: 'text-green-600', label: 'text-green-600', btn: 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600' },
                  rare: { border: 'border-blue-400', bg: 'bg-gradient-to-br from-blue-100 to-blue-200', icon: 'text-blue-600', label: 'text-blue-600', btn: 'from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600' },
                  epic: { border: 'border-purple-400', bg: 'bg-gradient-to-br from-purple-100 to-purple-200', icon: 'text-purple-600', label: 'text-purple-600', btn: 'from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600' },
                  legendary: { border: 'border-yellow-400', bg: 'bg-gradient-to-br from-yellow-100 to-amber-200', icon: 'text-yellow-600', label: 'text-yellow-600', btn: 'from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600' },
                }
                const rs = chestRarityStyles[uc.chest?.chest_type] || chestRarityStyles.common

                return (
                  <div key={uc.id} className={`bg-white rounded-xl border-2 ${rs.border} p-4 hover:shadow-md transition-shadow`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-16 h-16 ${rs.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        {uc.chest?.image_url ? (
                          <img src={uc.chest.image_url} alt={uc.chest.name} className="w-12 h-12 object-contain" />
                        ) : (
                          <Box className={`w-8 h-8 ${rs.icon}`} />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{uc.chest?.name || 'Chest'}</h4>
                        <p className={`text-xs font-medium capitalize ${rs.label}`}>
                          {uc.chest?.chest_type || 'common'} - {uc.chest?.items_per_open} items
                        </p>
                        <p className="text-xs text-gray-400">From: {uc.source}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenChest(uc)}
                      disabled={!!openingChest}
                      className={`w-full bg-gradient-to-r ${rs.btn} text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                      <Sparkles className="w-4 h-4" />
                      Open Chest
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== CRAFTING TAB ===== */}
      {activeTab === 'crafting' && (
        <CraftingTab
          recipes={recipes}
          inventory={inventory}
          getItemQuantity={getItemQuantity}
          onCraft={handleCraft}
          craftingId={craftingId}
        />
      )}

      {/* ===== HISTORY TAB ===== */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {craftHistory.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No crafts yet</h3>
              <p className="text-gray-500">Items you craft will appear here.</p>
            </div>
          ) : (
            craftHistory.map(craft => {
              const recipe = craft.recipe
              if (!recipe) return null
              return (
                <div key={craft.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    {recipe.result_image_url ? (
                      <img src={recipe.result_image_url} alt={recipe.name} className="w-10 h-10 object-contain" />
                    ) : (
                      <Sparkles className="w-6 h-6 text-purple-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{recipe.name}</p>
                    <p className="text-sm text-gray-500">
                      {recipe.result_type === 'xp' && `+${recipe.result_xp} XP`}
                      {recipe.result_type === 'gems' && `+${recipe.result_gems} Gems`}
                      {recipe.result_type === 'cosmetic' && 'Cosmetic'}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(craft.crafted_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Chest Open Animation Modal */}
      {chestResult && (
        <ChestOpenAnimation
          result={chestResult}
          chestType={openingChest?.chest?.chest_type}
          onClose={handleCloseChestAnimation}
        />
      )}

      {/* Egg Open Animation Modal */}
      {openingEggResult && (
        <EggOpenAnimation
          result={openingEggResult}
          eggRarity={openingEggRarity}
          allPets={allPets}
          onClose={handleEggAnimationClose}
          onNickname={handleEggNickname}
        />
      )}

      {/* Craft Failure Animation */}
      {showCraftFail && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50" style={{ minHeight: '100dvh' }}>
          <p
            className="text-4xl font-bold text-red-400 bg-black/10 px-8 py-4"
            style={{
              textShadow: '0 2px 10px rgba(239, 68, 68, 0.6)',
              animation: 'fadeInUp 0.3s ease-out'
            }}
          >
            Thất bại T_T
          </p>
          <style>{`
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(30px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </div>
      )}

      {/* Craft Success Animation */}
      {showCraftSuccess && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50" style={{ minHeight: '100dvh' }}>
          <p
            className="text-3xl font-bold text-green-500 bg-black/10 px-8 py-4"
            style={{
              textShadow: '0 2px 10px rgba(34, 197, 94, 0.6)',
              animation: 'fadeInUp 0.3s ease-out'
            }}
          >
            Thành công ( ﾉ･o･ )ﾉ
          </p>
          <style>{`
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(30px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </div>
      )}

    </div>
  )
}

export default Inventory
