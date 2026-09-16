import { useState, useEffect } from 'react'
import { supabase } from '../../supabase/client'
import { EVENT_MONSTERS } from '../../config/eventMonsters'
import Card from '../ui/Card'
import Button from '../ui/Button'
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Package,
  Box,
  Layers,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

const itemTypeOptions = [
  { value: 'item', label: 'Item' },
  { value: 'egg', label: 'Egg' },
  { value: 'pet_food', label: 'Pet Food' },
  { value: 'pet_toy', label: 'Pet Toy' },
  { value: 'background', label: 'Background' },
  { value: 'ball', label: 'Ball' },
  { value: 'ticket', label: 'Ticket' },
]

const rarityOptions = [
  { value: 'common', label: 'Common', color: 'bg-gray-100 text-gray-700' },
  { value: 'uncommon', label: 'Uncommon', color: 'bg-green-100 text-green-700' },
  { value: 'rare', label: 'Rare', color: 'bg-blue-100 text-blue-700' },
  { value: 'epic', label: 'Epic', color: 'bg-purple-100 text-purple-700' },
  { value: 'legendary', label: 'Legendary', color: 'bg-yellow-100 text-yellow-700' },
]

const chestTypeOptions = [
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Epic' },
  { value: 'legendary', label: 'Legendary' },
]

const resultTypeOptions = [
  { value: 'cosmetic', label: 'Cosmetic (Shop Item)' },
  { value: 'xp', label: 'XP' },
  { value: 'gems', label: 'Gems' },
  { value: 'item', label: 'Item (Collectible)' },
]

const defaultItemForm = {
  name: '',
  description: '',
  image_url: '',
  item_type: 'item',
  set_name: '',
  rarity: 'common',
  is_active: true,
  sort_order: 0,
  price_gems: 0,
  price_xp: 0,
}

const defaultChestForm = {
  name: '',
  description: '',
  image_url: '',
  chest_type: 'common',
  loot_table: '[]',
  guaranteed_items: '[]',
  items_per_open: 3,
  is_active: true,
}

const defaultRecipeForm = {
  name: '',
  description: '',
  result_type: 'cosmetic',
  result_shop_item_id: '',
  result_item_id: '',
  result_quantity: 1,
  result_xp: 0,
  result_gems: 0,
  result_image_url: '',
  result_data: '{}',
  ingredients: '[]',
  is_active: true,
  max_crafts_per_user: '',
  success_rate: 100,
}

const InventoryManagement = () => {
  const [activeSubTab, setActiveSubTab] = useState('items')
  const [items, setItems] = useState([])
  const [chests, setChests] = useState([])
  const [recipes, setRecipes] = useState([])
  const [dropConfig, setDropConfig] = useState({})
  const [shopItems, setShopItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [formData, setFormData] = useState(defaultItemForm)
  const [saving, setSaving] = useState(false)
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    try {
      setLoading(true)
      const [itemsRes, chestsRes, recipesRes, configRes, shopRes] = await Promise.all([
        supabase.from('collectible_items').select('*').order('set_name').order('sort_order'),
        supabase.from('chests').select('*').order('created_at', { ascending: false }),
        supabase.from('recipes').select('*').order('created_at', { ascending: false }),
        supabase.from('drop_config').select('*'),
        supabase.from('shop_items').select('id, name, image_url, category').eq('is_active', true),
      ])

      if (itemsRes.error) throw itemsRes.error
      setItems(itemsRes.data || [])
      setChests(chestsRes.data || [])
      setRecipes(recipesRes.data || [])
      setShopItems(shopRes.data || [])

      const configMap = {}
      ;(configRes.data || []).forEach(c => {
        configMap[c.config_key] = c
      })
      setDropConfig(configMap)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ===== ITEMS CRUD =====
  const handleOpenItemModal = (item = null) => {
    if (item) {
      setEditingRecord(item)
      setFormData({
        name: item.name,
        description: item.description || '',
        image_url: item.image_url || '',
        item_type: item.item_type,
        set_name: item.set_name || '',
        rarity: item.rarity,
        is_active: item.is_active,
        sort_order: item.sort_order || 0,
        price_gems: item.price_gems || 0,
        price_xp: item.price_xp || 0,
      })
    } else {
      setEditingRecord(null)
      setFormData(defaultItemForm)
    }
    setShowModal(true)
  }

  const handleSubmitItem = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        image_url: formData.image_url || null,
        item_type: formData.item_type,
        set_name: formData.set_name || null,
        rarity: formData.rarity,
        is_active: formData.is_active,
        sort_order: parseInt(formData.sort_order) || 0,
        price_gems: parseInt(formData.price_gems) || 0,
        price_xp: parseInt(formData.price_xp) || 0,
      }

      if (editingRecord) {
        const { error } = await supabase.from('collectible_items').update(payload).eq('id', editingRecord.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('collectible_items').insert(payload)
        if (error) throw error
      }
      setShowModal(false)
      fetchAllData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Delete this item?')) return
    try {
      const { error } = await supabase.from('collectible_items').delete().eq('id', id)
      if (error) throw error
      fetchAllData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggleItemActive = async (item) => {
    try {
      const { error } = await supabase.from('collectible_items').update({ is_active: !item.is_active }).eq('id', item.id)
      if (error) throw error
      fetchAllData()
    } catch (err) {
      setError(err.message)
    }
  }

  // ===== CHESTS CRUD =====
  const handleOpenChestModal = (chest = null) => {
    if (chest) {
      setEditingRecord(chest)
      setFormData({
        name: chest.name,
        description: chest.description || '',
        image_url: chest.image_url || '',
        chest_type: chest.chest_type,
        loot_table: JSON.stringify(chest.loot_table || [], null, 2),
        guaranteed_items: JSON.stringify(chest.guaranteed_items || [], null, 2),
        items_per_open: chest.items_per_open || 3,
        is_active: chest.is_active,
      })
    } else {
      setEditingRecord(null)
      setFormData(defaultChestForm)
    }
    setShowModal(true)
  }

  const handleSubmitChest = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let parsedLoot, parsedGuaranteed
      try {
        parsedLoot = JSON.parse(formData.loot_table)
        parsedGuaranteed = JSON.parse(formData.guaranteed_items)
      } catch {
        throw new Error('Invalid JSON in loot table or guaranteed items')
      }

      const payload = {
        name: formData.name,
        description: formData.description || null,
        image_url: formData.image_url || null,
        chest_type: formData.chest_type,
        loot_table: parsedLoot,
        guaranteed_items: parsedGuaranteed,
        items_per_open: parseInt(formData.items_per_open) || 3,
        is_active: formData.is_active,
      }

      if (editingRecord) {
        const { error } = await supabase.from('chests').update(payload).eq('id', editingRecord.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('chests').insert(payload)
        if (error) throw error
      }
      setShowModal(false)
      fetchAllData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteChest = async (id) => {
    if (!window.confirm('Delete this chest?')) return
    try {
      const { error } = await supabase.from('chests').delete().eq('id', id)
      if (error) throw error
      fetchAllData()
    } catch (err) {
      setError(err.message)
    }
  }

  // ===== RECIPES CRUD =====
  const handleOpenRecipeModal = (recipe = null) => {
    if (recipe) {
      setEditingRecord(recipe)
      setFormData({
        name: recipe.name,
        description: recipe.description || '',
        result_type: recipe.result_type,
        result_shop_item_id: recipe.result_shop_item_id || '',
        result_item_id: recipe.result_item_id || '',
        result_quantity: recipe.result_quantity || 1,
        result_xp: recipe.result_xp || 0,
        result_gems: recipe.result_gems || 0,
        result_image_url: recipe.result_image_url || '',
        result_data: JSON.stringify(recipe.result_data || {}, null, 2),
        ingredients: JSON.stringify(recipe.ingredients || [], null, 2),
        is_active: recipe.is_active,
        max_crafts_per_user: recipe.max_crafts_per_user ?? '',
        success_rate: recipe.success_rate ?? 100,
      })
    } else {
      setEditingRecord(null)
      setFormData(defaultRecipeForm)
    }
    setShowModal(true)
  }

  const handleSubmitRecipe = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let parsedIngredients, parsedResultData
      try {
        parsedIngredients = JSON.parse(formData.ingredients)
        parsedResultData = JSON.parse(formData.result_data)
      } catch {
        throw new Error('Invalid JSON in ingredients or result data')
      }

      const payload = {
        name: formData.name,
        description: formData.description || null,
        result_type: formData.result_type,
        result_shop_item_id: formData.result_shop_item_id || null,
        result_item_id: formData.result_item_id || null,
        result_quantity: formData.result_type === 'item' ? (parseInt(formData.result_quantity) || 1) : 1,
        result_xp: parseInt(formData.result_xp) || 0,
        result_gems: parseInt(formData.result_gems) || 0,
        result_image_url: formData.result_image_url || null,
        result_data: parsedResultData,
        ingredients: parsedIngredients,
        is_active: formData.is_active,
        max_crafts_per_user: formData.max_crafts_per_user ? parseInt(formData.max_crafts_per_user) : null,
        success_rate: parseInt(formData.success_rate) || 100,
      }

      if (editingRecord) {
        const { error } = await supabase.from('recipes').update(payload).eq('id', editingRecord.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('recipes').insert(payload)
        if (error) throw error
      }
      setShowModal(false)
      fetchAllData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRecipe = async (id) => {
    if (!window.confirm('Delete this recipe?')) return
    try {
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (error) throw error
      fetchAllData()
    } catch (err) {
      setError(err.message)
    }
  }

  // ===== DROP CONFIG =====
  const handleSaveDropConfig = async (key, value) => {
    try {
      setSaving(true)
      const parsed = JSON.parse(value)
      const existing = dropConfig[key]

      if (existing) {
        const { error } = await supabase.from('drop_config').update({ config_value: parsed, updated_at: new Date().toISOString() }).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('drop_config').insert({ config_key: key, config_value: parsed })
        if (error) throw error
      }
      fetchAllData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const getRarityColor = (rarity) => {
    return rarityOptions.find(r => r.value === rarity)?.color || 'bg-gray-100 text-gray-700'
  }

  const getItemName = (itemId) => {
    const item = items.find(i => i.id === itemId)
    return item ? item.name : itemId?.substring(0, 8) + '...'
  }

  const filteredItems = filterType === 'all' ? items : items.filter(i => i.item_type === filterType)

  // Group items by set_name
  const groupedItems = {}
  filteredItems.forEach(item => {
    const group = item.set_name || 'No Set'
    if (!groupedItems[group]) groupedItems[group] = []
    groupedItems[group].push(item)
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
        <div className="text-center py-8 text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <>
    <div className="space-y-6">

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">{error}</div>
          <button onClick={() => setError(null)} className="text-sm text-red-600 underline mt-1">Dismiss</button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { id: 'items', label: 'Items', icon: Package, count: items.length },
          { id: 'chests', label: 'Chests', icon: Box, count: chests.length },
          { id: 'recipes', label: 'Recipes', icon: Layers, count: recipes.length },
          { id: 'config', label: 'Drop Config', icon: Settings },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeSubTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeSubTab === tab.id ? 'bg-blue-500' : 'bg-gray-200'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ===== ITEMS TAB ===== */}
      {activeSubTab === 'items' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                All
              </button>
              {itemTypeOptions.map(t => (
                <button
                  key={t.value}
                  onClick={() => setFilterType(t.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${filterType === t.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Button onClick={() => handleOpenItemModal()} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Item
            </Button>
          </div>

          {Object.entries(groupedItems).map(([setName, setItems]) => (
            <div key={setName} className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{setName}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {setItems.map(item => (
                  <Card key={item.id} className={`p-3 ${!item.is_active ? 'opacity-50' : ''}`}>
                    <div className="space-y-2">
                      <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
                        ) : (
                          <Package className="w-8 h-8 text-gray-300" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h4>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${getRarityColor(item.rarity)}`}>
                            {item.rarity}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                            {item.item_type}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 pt-1 border-t">
                        <button onClick={() => handleOpenItemModal(item)} className="p-1 hover:bg-gray-100 rounded">
                          <Edit className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button onClick={() => handleToggleItemActive(item)} className="p-1 hover:bg-gray-100 rounded">
                          {item.is_active ? <Eye className="w-3.5 h-3.5 text-green-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
                        </button>
                        <button onClick={() => handleDeleteItem(item.id)} className="p-1 hover:bg-gray-100 rounded">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <Card className="p-8 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No items yet</h3>
              <p className="text-gray-600 mb-4">Create collectible items that students can earn</p>
              <Button onClick={() => handleOpenItemModal()}>Add First Item</Button>
            </Card>
          )}
        </div>
      )}

      {/* ===== CHESTS TAB ===== */}
      {activeSubTab === 'chests' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => handleOpenChestModal()} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Chest
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chests.map(chest => (
              <Card key={chest.id} className={`p-4 ${!chest.is_active ? 'opacity-50' : ''}`}>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {chest.image_url ? (
                        <img src={chest.image_url} alt={chest.name} className="w-full h-full object-contain" />
                      ) : (
                        <Box className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900">{chest.name}</h4>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{chest.chest_type}</span>
                      <p className="text-xs text-gray-500 mt-1">{chest.items_per_open} random items per open</p>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    <p>Loot table: {(chest.loot_table || []).length} entries</p>
                    <p>Guaranteed: {(chest.guaranteed_items || []).length} items</p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <button onClick={() => handleOpenChestModal(chest)} className="p-1 hover:bg-gray-100 rounded">
                      <Edit className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => handleDeleteChest(chest.id)} className="p-1 hover:bg-gray-100 rounded">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {chests.length === 0 && (
            <Card className="p-8 text-center">
              <Box className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No chests yet</h3>
              <p className="text-gray-600 mb-4">Create chests with loot tables for students to open</p>
              <Button onClick={() => handleOpenChestModal()}>Add First Chest</Button>
            </Card>
          )}
        </div>
      )}

      {/* ===== RECIPES TAB ===== */}
      {activeSubTab === 'recipes' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => handleOpenRecipeModal()} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Recipe
            </Button>
          </div>

          {recipes.length === 0 ? (
            <Card className="p-8 text-center">
              <Layers className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No recipes yet</h3>
              <p className="text-gray-600 mb-4">Define crafting recipes for exclusive rewards</p>
              <Button onClick={() => handleOpenRecipeModal()}>Add First Recipe</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[...recipes].sort((a, b) => a.name.localeCompare(b.name)).map(recipe => (
                <div key={recipe.id} className={`flex items-center gap-2 px-2.5 py-1.5 border rounded-lg ${!recipe.is_active ? 'opacity-50' : ''}`}>
                  <div className="w-8 h-8 bg-gray-50 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                    {recipe.result_image_url ? (
                      <img src={recipe.result_image_url} alt={recipe.name} className="w-full h-full object-contain" />
                    ) : (
                      <Layers className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-xs text-gray-900 truncate">{recipe.name}</span>
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded-full flex-shrink-0">
                        {recipe.result_type === 'cosmetic' ? 'Cosmetic' : recipe.result_type === 'xp' ? `${recipe.result_xp} XP` : recipe.result_type === 'item' ? 'Item' : `${recipe.result_gems} Gems`}
                      </span>
                      {recipe.success_rate != null && recipe.success_rate < 100 && (
                        <span className={`text-[10px] font-medium flex-shrink-0 ${recipe.success_rate >= 70 ? 'text-green-600' : recipe.success_rate >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>{recipe.success_rate}%</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {(recipe.ingredients || []).map((ing, idx) => (
                        <span key={idx} className="text-[10px] text-gray-500">{getItemName(ing.item_id)} x{ing.quantity}{idx < (recipe.ingredients || []).length - 1 ? ',' : ''}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => handleOpenRecipeModal(recipe)} className="p-0.5 hover:bg-gray-100 rounded">
                      <Edit className="w-3 h-3 text-gray-400" />
                    </button>
                    <button onClick={() => handleDeleteRecipe(recipe.id)} className="p-0.5 hover:bg-gray-100 rounded">
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== DROP CONFIG TAB ===== */}
      {activeSubTab === 'config' && (
        <DropConfigEditor
          dropConfig={dropConfig}
          onSave={handleSaveDropConfig}
          saving={saving}
          items={items}
          chests={chests}
        />
      )}
    </div>

      {/* ===== MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {activeSubTab === 'items' && (
              <ItemForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmitItem}
                onClose={() => setShowModal(false)}
                editing={!!editingRecord}
                saving={saving}
              />
            )}
            {activeSubTab === 'chests' && (
              <ChestForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmitChest}
                onClose={() => setShowModal(false)}
                editing={!!editingRecord}
                saving={saving}
                items={items}
                shopItems={shopItems}
              />
            )}
            {activeSubTab === 'recipes' && (
              <RecipeForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmitRecipe}
                onClose={() => setShowModal(false)}
                editing={!!editingRecord}
                saving={saving}
                items={items}
                shopItems={shopItems}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ===== FORM COMPONENTS =====

const ItemForm = ({ formData, setFormData, onSubmit, onClose, editing, saving }) => (
  <form onSubmit={onSubmit} className="p-6 space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Item' : 'Add New Item'}</h3>
      <Button type="button" variant="ghost" onClick={onClose}>X</Button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
        <select value={formData.item_type} onChange={e => setFormData({ ...formData, item_type: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
          {itemTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Rarity *</label>
        <select value={formData.rarity} onChange={e => setFormData({ ...formData, rarity: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
          {rarityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Set Name</label>
        <input type="text" value={formData.set_name} onChange={e => setFormData({ ...formData, set_name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Dragon Set" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
        <input type="number" value={formData.sort_order} onChange={e => setFormData({ ...formData, sort_order: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
        <input type="url" value={formData.image_url} onChange={e => setFormData({ ...formData, image_url: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
      </div>
      {['ball', 'ticket', 'egg'].includes(formData.item_type) && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price (Gems)</label>
            <input type="number" min="0" value={formData.price_gems} onChange={e => setFormData({ ...formData, price_gems: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0 = not for sale" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price (XP)</label>
            <input type="number" min="0" value={formData.price_xp} onChange={e => setFormData({ ...formData, price_xp: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0 = not for sale" />
          </div>
        </>
      )}
      <div className="md:col-span-2">
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <span className="text-sm font-medium text-gray-700">Active</span>
        </label>
      </div>
    </div>
    {formData.image_url && (
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Preview:</h4>
        <div className="w-20 h-20 bg-gray-50 rounded-lg overflow-hidden">
          <img src={formData.image_url} alt="Preview" className="w-full h-full object-contain" />
        </div>
      </div>
    )}
    <div className="flex items-center justify-end space-x-3 pt-4 border-t">
      <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
    </div>
  </form>
)

const ChestForm = ({ formData, setFormData, onSubmit, onClose, editing, saving, items, shopItems }) => {
  const parseLootTable = () => {
    try { return JSON.parse(formData.loot_table) } catch { return [] }
  }
  const parseGuaranteedItems = () => {
    try { return JSON.parse(formData.guaranteed_items) } catch { return [] }
  }
  const updateLootTable = (entries) => {
    setFormData({ ...formData, loot_table: JSON.stringify(entries, null, 2) })
  }
  const updateGuaranteedItems = (entries) => {
    setFormData({ ...formData, guaranteed_items: JSON.stringify(entries, null, 2) })
  }

  const lootEntries = parseLootTable()
  const guaranteedEntries = parseGuaranteedItems()
  const totalWeight = lootEntries.reduce((sum, e) => sum + (Number(e.weight) || 0), 0)

  const rewardTypeOptions = [
    { value: 'item', label: 'Item' },
    { value: 'xp', label: 'XP' },
    { value: 'gems', label: 'Gems' },
    { value: 'shop_item', label: 'Shop Item' },
  ]

  const inputClass = "w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Chest' : 'Add New Chest'}</h3>
        <Button type="button" variant="ghost" onClick={onClose}>X</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Chest Type</label>
          <select value={formData.chest_type} onChange={e => setFormData({ ...formData, chest_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            {chestTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Items Per Open</label>
          <input type="number" value={formData.items_per_open} onChange={e => setFormData({ ...formData, items_per_open: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" min="1" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
          <input type="url" value={formData.image_url} onChange={e => setFormData({ ...formData, image_url: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
        </div>
        <div>
          <label className="flex items-center space-x-2 mt-6">
            <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
        </div>

        {/* Loot Table Visual Editor */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Loot Table</label>
          <div className="space-y-2">
            {lootEntries.map((entry, idx) => {
              const pct = totalWeight > 0 ? ((Number(entry.weight) || 0) / totalWeight * 100).toFixed(1) : '0.0'
              const rt = entry.reward_type || 'item'
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-24">
                    {idx === 0 && <div className="text-xs text-gray-500 mb-1">Type</div>}
                    <select value={rt} onChange={e => {
                      const updated = [...lootEntries]
                      const newType = e.target.value
                      updated[idx] = { ...updated[idx], reward_type: newType }
                      if (newType === 'xp' || newType === 'gems') {
                        delete updated[idx].item_id
                        delete updated[idx].shop_item_id
                      } else if (newType === 'shop_item') {
                        delete updated[idx].item_id
                      } else {
                        delete updated[idx].shop_item_id
                      }
                      updateLootTable(updated)
                    }} className={`${inputClass}`}>
                      {rewardTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-0">
                    {idx === 0 && <div className="text-xs text-gray-500 mb-1">{rt === 'xp' || rt === 'gems' ? 'Amount' : 'Item'}</div>}
                    {rt === 'item' && (
                      <select value={entry.item_id || ''} onChange={e => {
                        const updated = [...lootEntries]
                        updated[idx] = { ...updated[idx], item_id: e.target.value }
                        updateLootTable(updated)
                      }} className={`${inputClass} w-full`}>
                        <option value="">-- Select Item --</option>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    )}
                    {rt === 'shop_item' && (
                      <select value={entry.shop_item_id || ''} onChange={e => {
                        const updated = [...lootEntries]
                        updated[idx] = { ...updated[idx], shop_item_id: e.target.value }
                        updateLootTable(updated)
                      }} className={`${inputClass} w-full`}>
                        <option value="">-- Select Shop Item --</option>
                        {(shopItems || []).map(si => (
                          <option key={si.id} value={si.id}>{si.name} ({si.category})</option>
                        ))}
                      </select>
                    )}
                    {(rt === 'xp' || rt === 'gems') && (
                      <div className="text-xs text-gray-400 py-1.5 px-2">Use Min/Max for amount</div>
                    )}
                  </div>
                  <div className="w-20">
                    {idx === 0 && <div className="text-xs text-gray-500 mb-1 text-center">Weight</div>}
                    <input type="number" value={entry.weight ?? ''} min="1" placeholder="Wt" onChange={e => {
                      const updated = [...lootEntries]
                      updated[idx] = { ...updated[idx], weight: Number(e.target.value) || 0 }
                      updateLootTable(updated)
                    }} className={`${inputClass} text-center`} />
                  </div>
                  <div className="w-16">
                    {idx === 0 && <div className="text-xs text-gray-500 mb-1 text-center">Min</div>}
                    <input type="number" value={entry.min_qty ?? ''} min="1" placeholder="Min" onChange={e => {
                      const updated = [...lootEntries]
                      updated[idx] = { ...updated[idx], min_qty: Number(e.target.value) || 1 }
                      updateLootTable(updated)
                    }} className={`${inputClass} text-center`} />
                  </div>
                  <div className="w-16">
                    {idx === 0 && <div className="text-xs text-gray-500 mb-1 text-center">Max</div>}
                    <input type="number" value={entry.max_qty ?? ''} min="1" placeholder="Max" onChange={e => {
                      const updated = [...lootEntries]
                      updated[idx] = { ...updated[idx], max_qty: Number(e.target.value) || 1 }
                      updateLootTable(updated)
                    }} className={`${inputClass} text-center`} />
                  </div>
                  <div className="w-16">
                    {idx === 0 && <div className="text-xs text-gray-500 mb-1 text-center">Chance</div>}
                    <span className="block text-center text-xs font-medium text-blue-600 py-1.5">{pct}%</span>
                  </div>
                  <div className="w-8">
                    {idx === 0 && <div className="text-xs text-gray-500 mb-1">&nbsp;</div>}
                    <button type="button" onClick={() => {
                      updateLootTable(lootEntries.filter((_, i) => i !== idx))
                    }} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
            <button type="button" onClick={() => {
              updateLootTable([...lootEntries, { reward_type: 'item', item_id: '', weight: 10, min_qty: 1, max_qty: 1 }])
            }} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mt-1">
              <Plus size={14} /> Add Loot Entry
            </button>
          </div>
        </div>

        {/* Guaranteed Items Visual Editor */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Guaranteed Rewards</label>
          <div className="space-y-2">
            {guaranteedEntries.map((entry, idx) => {
              const rt = entry.reward_type || 'item'
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-24">
                    {idx === 0 && <div className="text-xs text-gray-500 mb-1">Type</div>}
                    <select value={rt} onChange={e => {
                      const updated = [...guaranteedEntries]
                      const newType = e.target.value
                      updated[idx] = { ...updated[idx], reward_type: newType }
                      if (newType === 'xp' || newType === 'gems') {
                        delete updated[idx].item_id
                        delete updated[idx].shop_item_id
                      } else if (newType === 'shop_item') {
                        delete updated[idx].item_id
                      } else {
                        delete updated[idx].shop_item_id
                      }
                      updateGuaranteedItems(updated)
                    }} className={`${inputClass}`}>
                      {rewardTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-0">
                    {idx === 0 && <div className="text-xs text-gray-500 mb-1">{rt === 'xp' || rt === 'gems' ? 'Amount' : 'Item'}</div>}
                    {rt === 'item' && (
                      <select value={entry.item_id || ''} onChange={e => {
                        const updated = [...guaranteedEntries]
                        updated[idx] = { ...updated[idx], item_id: e.target.value }
                        updateGuaranteedItems(updated)
                      }} className={`${inputClass} w-full`}>
                        <option value="">-- Select Item --</option>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    )}
                    {rt === 'shop_item' && (
                      <select value={entry.shop_item_id || ''} onChange={e => {
                        const updated = [...guaranteedEntries]
                        updated[idx] = { ...updated[idx], shop_item_id: e.target.value }
                        updateGuaranteedItems(updated)
                      }} className={`${inputClass} w-full`}>
                        <option value="">-- Select Shop Item --</option>
                        {(shopItems || []).map(si => (
                          <option key={si.id} value={si.id}>{si.name} ({si.category})</option>
                        ))}
                      </select>
                    )}
                    {(rt === 'xp' || rt === 'gems') && (
                      <div className="text-xs text-gray-400 py-1.5 px-2">Set quantity below</div>
                    )}
                  </div>
                  <div className="w-20">
                    {idx === 0 && <div className="text-xs text-gray-500 mb-1 text-center">Quantity</div>}
                    <input type="number" value={entry.quantity ?? ''} min="1" placeholder="Qty" onChange={e => {
                      const updated = [...guaranteedEntries]
                      updated[idx] = { ...updated[idx], quantity: Number(e.target.value) || 1 }
                      updateGuaranteedItems(updated)
                    }} className={`${inputClass} text-center`} />
                  </div>
                  <div className="w-8">
                    {idx === 0 && <div className="text-xs text-gray-500 mb-1">&nbsp;</div>}
                    <button type="button" onClick={() => {
                      updateGuaranteedItems(guaranteedEntries.filter((_, i) => i !== idx))
                    }} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
            <button type="button" onClick={() => {
              updateGuaranteedItems([...guaranteedEntries, { reward_type: 'item', item_id: '', quantity: 1 }])
            }} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mt-1">
              <Plus size={14} /> Add Guaranteed Reward
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  )
}

const RecipeForm = ({ formData, setFormData, onSubmit, onClose, editing, saving, items, shopItems }) => {
  const parseIngredients = () => {
    try { return JSON.parse(formData.ingredients) } catch { return [] }
  }
  const updateIngredients = (entries) => {
    setFormData({ ...formData, ingredients: JSON.stringify(entries, null, 2) })
  }

  const ingredientEntries = parseIngredients()
  const inputClass = "w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Recipe' : 'Add New Recipe'}</h3>
        <Button type="button" variant="ghost" onClick={onClose}>X</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Name *</label>
          <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Result Type *</label>
          <select value={formData.result_type} onChange={e => setFormData({ ...formData, result_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            {resultTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {formData.result_type === 'cosmetic' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reward Shop Item</label>
            <select value={formData.result_shop_item_id} onChange={e => setFormData({ ...formData, result_shop_item_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select item...</option>
              {shopItems.map(si => <option key={si.id} value={si.id}>{si.name} ({si.category})</option>)}
            </select>
          </div>
        )}
        {formData.result_type === 'xp' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">XP Reward</label>
            <input type="number" value={formData.result_xp} onChange={e => setFormData({ ...formData, result_xp: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" min="0" />
          </div>
        )}
        {formData.result_type === 'gems' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gems Reward</label>
            <input type="number" value={formData.result_gems} onChange={e => setFormData({ ...formData, result_gems: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" min="0" />
          </div>
        )}
        {formData.result_type === 'item' && (<>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reward Item</label>
            <select value={formData.result_item_id} onChange={e => setFormData({ ...formData, result_item_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select item...</option>
              {items.map(item => <option key={item.id} value={item.id}>{item.name} ({item.rarity})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Result Quantity</label>
            <input type="number" value={formData.result_quantity} onChange={e => setFormData({ ...formData, result_quantity: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" min="1" />
          </div>
        </>)}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Crafts Per User</label>
          <input type="number" value={formData.max_crafts_per_user} onChange={e => setFormData({ ...formData, max_crafts_per_user: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Unlimited" min="1" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Success Rate (%)</label>
          <input type="number" value={formData.success_rate} onChange={e => setFormData({ ...formData, success_rate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" min="0" max="100" />
          <p className="text-xs text-gray-500 mt-1">If fail, student loses 1 ingredient (common first)</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Result Image URL</label>
          <input type="url" value={formData.result_image_url} onChange={e => setFormData({ ...formData, result_image_url: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
        </div>

        {/* Ingredients Visual Editor */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Ingredients</label>
          <div className="space-y-2">
            {ingredientEntries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  {idx === 0 && <div className="text-xs text-gray-500 mb-1">Item</div>}
                  <select value={entry.item_id || ''} onChange={e => {
                    const updated = [...ingredientEntries]
                    updated[idx] = { ...updated[idx], item_id: e.target.value }
                    updateIngredients(updated)
                  }} className={`${inputClass} w-full`}>
                    <option value="">-- Select Item --</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-20">
                  {idx === 0 && <div className="text-xs text-gray-500 mb-1 text-center">Quantity</div>}
                  <input type="number" value={entry.quantity ?? ''} min="1" placeholder="Qty" onChange={e => {
                    const updated = [...ingredientEntries]
                    updated[idx] = { ...updated[idx], quantity: Number(e.target.value) || 1 }
                    updateIngredients(updated)
                  }} className={`${inputClass} text-center`} />
                </div>
                <div className="w-8">
                  {idx === 0 && <div className="text-xs text-gray-500 mb-1">&nbsp;</div>}
                  <button type="button" onClick={() => {
                    updateIngredients(ingredientEntries.filter((_, i) => i !== idx))
                  }} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => {
              updateIngredients([...ingredientEntries, { item_id: '', quantity: 1 }])
            }} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mt-1">
              <Plus size={14} /> Add Ingredient
            </button>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center space-x-2">
            <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
        </div>
      </div>
      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  )
}

// The two kinds of win a battle can end in. They are stored as sibling blocks
// under the battle config, and a monster may carry a block of each name too.
const battleOutcomes = [
  { key: 'first_clear', label: 'First Clear', hint: 'The first time this stage is beaten.' },
  { key: 'repeat', label: 'Repeat Win', hint: 'Every rematch after that.' }
]

// Empty is how the drop config spells "not set", and the roll walks up to the
// next level when it finds one. A null, an empty list or an empty block written
// into the JSON would instead be read as a setting — and a `null` where the SQL
// expects an object is a jsonb null rather than a missing key, which stops the
// fallback chain dead. So a cleared field is deleted rather than blanked, at
// every depth, on the way to the textarea.
const pruneEmpty = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const next = {}
  Object.entries(value).forEach(([key, raw]) => {
    const cleaned = pruneEmpty(raw)
    if (cleaned == null) return
    if (typeof cleaned === 'object' && Object.keys(cleaned).length === 0) return
    next[key] = cleaned
  })
  return next
}

// How many random draws a win gets. 0 is a real setting, not a mistake: it means
// the win pays only what it owes outright — the guaranteed items and the chest —
// with nothing drawn at random on top. That is why the parse cannot lean on
// `|| 1`, which would read a deliberate 0 as "unset" and quietly hand back a
// random item.
const clampRolls = (raw) => {
  const n = parseInt(raw, 10)
  return Number.isNaN(n) ? 0 : Math.min(10, Math.max(0, n))
}

// One list of items, used for every pool in the battle config — the shared one,
// an outcome's, and a monster's.
const ItemPool = ({ value, items, onChange, inputClass, empty }) => {
  const list = value || []
  return (
    <div className="space-y-2">
      {list.length === 0 && <p className="text-xs text-gray-400 italic">{empty}</p>}
      {list.map((itemId, idx) => {
        const item = items.find(i => i.id === itemId)
        return (
          <div key={`${itemId}-${idx}`} className="flex items-center gap-2">
            {item?.image_url && <img src={item.image_url} alt="" className="w-6 h-6 object-contain flex-shrink-0" />}
            <span className="flex-1 text-sm text-gray-700 truncate">{item ? item.name : itemId}</span>
            {item && <span className="text-xs text-gray-400 capitalize">{item.rarity}</span>}
            <button type="button" onClick={() => onChange(list.filter((_, i) => i !== idx))}
              className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
              <Trash2 size={14} />
            </button>
          </div>
        )
      })}
      <select value="" onChange={e => {
        if (e.target.value && !list.includes(e.target.value)) onChange([...list, e.target.value])
      }} className={`${inputClass} w-full`}>
        <option value="">+ Add item...</option>
        {items.filter(i => !list.includes(i.id)).map(item => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
    </div>
  )
}

// One named chest, handed over separately from the item. The chest itself is
// picked here rather than a rarity to roll for: a chest already carries its own
// loot table, so choosing between three epic chests at random would be rolling
// on a roll, and the reward set for a stage would not be the one given.
//
// No chest chosen is off, which is what every level defaults to.
const ChestPicker = ({ chest, chests, onChange, inputClass, inherited }) => {
  const set = chest || {}
  const chestId = set.chest_id || ''
  const chance = set.chance
  const chosen = chests.find(c => c.id === chestId)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={chestId}
        onChange={e => onChange(e.target.value
          ? { ...set, chest_id: e.target.value, chance: set.chance ?? 1 }
          : { ...set, chest_id: null })}
        className={`${inputClass} w-52`}>
        <option value="">{inherited ? 'Inherit' : 'No chest'}</option>
        {/* A chest that has since been deactivated stays listed while it is the
            one configured, or the select would show a blank with no clue why. */}
        {chests.filter(c => c.is_active || c.id === chestId).map(c => (
          <option key={c.id} value={c.id}>{c.name} ({c.chest_type})</option>
        ))}
      </select>
      {chestId && (
        <>
          <input type="number" value={chance ?? 1} min="0" max="1" step="0.01"
            onChange={e => onChange({ ...set, chance: parseFloat(e.target.value) || 0 })}
            className={`${inputClass} w-24`} />
          <span className="text-xs text-gray-400">
            {chance === 0 ? 'never' : `${((chance ?? 1) * 100).toFixed(0)}% of wins`}
          </span>
        </>
      )}
      {/* Configured then deleted or deactivated: the roll pays nothing rather
          than substituting another chest, so this has to be visible. */}
      {chestId && !chosen?.is_active && (
        <span className="text-xs font-medium text-red-500">chest no longer active — pays nothing</span>
      )}
    </div>
  )
}

// What a collapsed monster row says about itself, so a table of eight can be
// read without opening any of them.
const monsterLootSummary = (entry) => {
  const parts = []
  const count = (o) => (o?.included_items || []).length + (o?.guaranteed_items || []).length
  const first = count(entry.first_clear)
  const repeat = count(entry.repeat)
  const both = count(entry)
  if (first) parts.push(`${first} on first clear`)
  if (repeat) parts.push(`${repeat} on repeat`)
  if (both) parts.push(`${both} on any win`)
  const rolls = entry.first_clear?.rolls ?? entry.rolls
  if (rolls === 0) parts.push('no random draw')
  else if (rolls > 1) parts.push(`×${rolls} rolls`)
  const chance = entry.first_clear?.base_chance ?? entry.base_chance
  if (chance != null) parts.push(`${(chance * 100).toFixed(0)}% first clear`)
  if (entry.first_clear?.chest?.chest_id) parts.push('chest on first clear')
  else if (entry.chest?.chest_id || entry.repeat?.chest?.chest_id) parts.push('chest')
  return parts.length ? parts.join(' · ') : 'inherits everything'
}

const DropConfigEditor = ({ dropConfig, onSave, saving, items, chests }) => {
  const defaultExercise = { base_chance: 0.30, rarity_weights: { common: 60, uncommon: 25, rare: 12, epic: 3 }, included_items: [] }
  const defaultMilestone = { session_complete: 'common', streak_7: 'uncommon', streak_30: 'rare', challenge_win_top3: 'uncommon' }
  // Mirrors the seed in add_event_stage_ladder.sql, so an unsaved config shows
  // the same odds the database would roll with.
  const defaultBattle = {
    base_chance: 0.5,
    first_clear: { base_chance: 1.0 },
    repeat: { base_chance: 0.2 },
    monsters: {},
    included_items: []
  }

  const [exerciseConfig, setExerciseConfig] = useState(
    JSON.stringify(dropConfig['exercise_drop_rate']?.config_value || defaultExercise, null, 2)
  )
  const [milestoneConfig, setMilestoneConfig] = useState(
    JSON.stringify(dropConfig['milestone_chests']?.config_value || defaultMilestone, null, 2)
  )
  const [battleConfig, setBattleConfig] = useState(
    JSON.stringify(dropConfig['event_battle_drop_rate']?.config_value || defaultBattle, null, 2)
  )

  const parseExercise = () => {
    try { return JSON.parse(exerciseConfig) } catch { return defaultExercise }
  }
  const parseMilestone = () => {
    try { return JSON.parse(milestoneConfig) } catch { return defaultMilestone }
  }
  const parseBattle = () => {
    try { return JSON.parse(battleConfig) } catch { return defaultBattle }
  }
  const updateExercise = (obj) => setExerciseConfig(JSON.stringify(obj, null, 2))
  const updateMilestone = (obj) => setMilestoneConfig(JSON.stringify(obj, null, 2))
  const updateBattle = (obj) => setBattleConfig(JSON.stringify(pruneEmpty(obj), null, 2))

  // Which monster's drop table is open. Only one at a time — eight expanded
  // tables is a wall of item pickers with nothing to tell them apart.
  const [openMonster, setOpenMonster] = useState(null)

  const setOutcome = (slot, patch) =>
    updateBattle({ ...battle, [slot]: { ...(battle[slot] || {}), ...patch } })

  const setMonsterEntry = (id, patch) => {
    const monsters = { ...(battle.monsters || {}) }
    monsters[id] = { ...(monsters[id] || {}), ...patch }
    updateBattle({ ...battle, monsters })
  }

  const setMonsterOutcome = (id, slot, patch) =>
    setMonsterEntry(id, { [slot]: { ...(battle.monsters?.[id]?.[slot] || {}), ...patch } })

  const exercise = parseExercise()
  const milestone = parseMilestone()
  const battle = parseBattle()
  const rarities = ['common', 'uncommon', 'rare', 'epic']
  const chestTypes = ['common', 'uncommon', 'rare', 'epic', 'legendary']
  const totalRarityWeight = rarities.reduce((sum, r) => sum + (Number(exercise.rarity_weights?.[r]) || 0), 0)

  const inputClass = "w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Exercise Drop Rate</h3>
        <p className="text-sm text-gray-500 mb-4">Controls the chance of item drops when a student completes an exercise (score &gt;= 75%)</p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Base Drop Chance</label>
          <div className="flex items-center gap-2">
            <input type="number" value={exercise.base_chance ?? 0.3} min="0" max="1" step="0.01"
              onChange={e => updateExercise({ ...exercise, base_chance: parseFloat(e.target.value) || 0 })}
              className={`${inputClass} w-28`} />
            <span className="text-sm text-gray-500">({((exercise.base_chance || 0) * 100).toFixed(0)}%)</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Rarity Weights</label>
          <div className="space-y-2">
            {rarities.map((rarity) => {
              const weight = Number(exercise.rarity_weights?.[rarity]) || 0
              const pct = totalRarityWeight > 0 ? (weight / totalRarityWeight * 100).toFixed(1) : '0.0'
              return (
                <div key={rarity} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-gray-700 capitalize">{rarity}</span>
                  <input type="number" value={weight} min="0"
                    onChange={e => updateExercise({
                      ...exercise,
                      rarity_weights: { ...exercise.rarity_weights, [rarity]: Number(e.target.value) || 0 }
                    })}
                    className={`${inputClass} w-20 text-center`} />
                  <span className="text-xs font-medium text-blue-600 w-14">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Included Items</label>
          <p className="text-xs text-gray-500 mb-2">Only these items can drop from exercises. If empty, all active items can drop.</p>
          <div className="space-y-2">
            {(exercise.included_items || []).map((itemId, idx) => {
              const item = items.find(i => i.id === itemId)
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-gray-700 truncate">{item ? item.name : itemId}</span>
                  <button type="button" onClick={() => {
                    updateExercise({ ...exercise, included_items: exercise.included_items.filter((_, i) => i !== idx) })
                  }} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
            <select value="" onChange={e => {
              if (e.target.value) {
                const included = exercise.included_items || []
                if (!included.includes(e.target.value)) {
                  updateExercise({ ...exercise, included_items: [...included, e.target.value] })
                }
                e.target.value = ''
              }
            }} className={`${inputClass} w-full`}>
              <option value="">+ Add item to include...</option>
              {items.filter(i => !(exercise.included_items || []).includes(i.id)).map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>

        <Button
          onClick={() => onSave('exercise_drop_rate', exerciseConfig)}
          disabled={saving}
          className="mt-4"
        >
          {saving ? 'Saving...' : 'Save Exercise Config'}
        </Button>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Event Battle Loot</h3>
        <p className="text-sm text-gray-500 mb-1">Controls what a won event battle pays out. Losing never drops.</p>
        <p className="text-xs text-gray-500 mb-4">
          Everything below is optional and falls back to the level above it. A monster uses its own settings first,
          then the outcome (first clear or repeat), then these defaults — so you only fill in what should differ.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Drop Chance</label>
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" value={battle.base_chance ?? 0.5} min="0" max="1" step="0.01"
              onChange={e => updateBattle({ ...battle, base_chance: parseFloat(e.target.value) || 0 })}
              className={`${inputClass} w-28`} />
            <span className="text-sm text-gray-500">({((battle.base_chance || 0) * 100).toFixed(0)}%)</span>
            <span className="ml-3 text-sm text-gray-700">×</span>
            <input type="number" value={battle.rolls ?? 0} min="0" max="10" step="1"
              onChange={e => updateBattle({ ...battle, rolls: clampRolls(e.target.value) })}
              className={`${inputClass} w-20`} />
            <span className="text-sm text-gray-500">rolls</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Rolls are RANDOM draws from the pool, on top of whatever is guaranteed. Each is a separate
            draw at that chance, so 3 rolls at 50% average 1.5 items rather than promising 3, and the same
            item drawn twice stacks as ×2. <strong>Rolls default to 0</strong>, so a win pays only what its
            config names — leave it there unless you want random items as well, and remember an empty pool
            means the whole catalogue.
          </p>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Shared Item Pool</label>
          <p className="text-xs text-gray-500 mb-2">The pool any monster without a list of its own draws from. Every item in a pool is equally likely — rarity colours the item but does not weight the draw, so what a monster can pay is exactly what its list says. If empty, all active items can drop. Kept separate from the exercise list, so a monster kill and a finished exercise can pay out different things.</p>
          <ItemPool
            value={battle.included_items}
            items={items}
            inputClass={inputClass}
            empty="All active items can drop."
            onChange={list => updateBattle({ ...battle, included_items: list })}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Default Chest</label>
          <p className="text-xs text-gray-500 mb-2">
            One named chest, given separately from the item, so a win can pay both, either or neither. The chance
            beside it is how often the win hands it over — 1 for every time.
          </p>
          <ChestPicker
            chest={battle.chest}
            chests={chests}
            inputClass={inputClass}
            onChange={c => updateBattle({ ...battle, chest: c })}
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {battleOutcomes.map(({ key, label, hint }) => {
            const outcome = battle[key] || {}
            return (
              <div key={key} className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
                <p className="text-xs text-gray-500 mb-3">{hint}</p>

                <label className="block text-xs font-medium text-gray-700 mb-1">Drop Chance &amp; Rolls</label>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <input type="number" value={outcome.base_chance ?? ''} min="0" max="1" step="0.01"
                    placeholder={`${battle.base_chance ?? 0.5}`}
                    onChange={e => setOutcome(key, { base_chance: e.target.value === '' ? null : (parseFloat(e.target.value) || 0) })}
                    className={`${inputClass} w-24`} />
                  <span className="text-xs text-gray-400">×</span>
                  <input type="number" value={outcome.rolls ?? ''} min="0" max="10" step="1"
                    placeholder={`${battle.rolls ?? 0}`}
                    onChange={e => setOutcome(key, { rolls: e.target.value === '' ? null : clampRolls(e.target.value) })}
                    className={`${inputClass} w-20`} />
                  <span className="text-xs text-gray-400">
                    {outcome.base_chance == null && outcome.rolls == null
                      ? 'inherits default'
                      : `${((outcome.base_chance ?? battle.base_chance ?? 0.5) * 100).toFixed(0)}% × ${outcome.rolls ?? battle.rolls ?? 0}`}
                  </span>
                </div>

                <label className="block text-xs font-medium text-gray-700 mb-1">Always Drops</label>
                <ItemPool
                  value={outcome.guaranteed_items}
                  items={items}
                  inputClass={inputClass}
                  empty="Nothing guaranteed."
                  onChange={list => setOutcome(key, { guaranteed_items: list })}
                />

                <label className="block text-xs font-medium text-gray-700 mt-3 mb-1">Item Pool</label>
                <ItemPool
                  value={outcome.included_items}
                  items={items}
                  inputClass={inputClass}
                  empty="Uses the shared pool."
                  onChange={list => setOutcome(key, { included_items: list })}
                />

                <label className="block text-xs font-medium text-gray-700 mt-3 mb-1">Chest</label>
                <ChestPicker
                  chest={outcome.chest}
                  chests={chests}
                  inputClass={inputClass}
                  inherited={Boolean(battle.chest?.chest_id)}
                  onChange={c => setOutcome(key, { chest: c })}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Per-Monster Loot</label>
          <p className="text-xs text-gray-500 mb-2">
            Give a monster its own drop table. Put one item in its first-clear pool and set that chance to 1
            to hand it over as a guaranteed reward the first time the stage is beaten, and leave the repeat pool
            with the ordinary items every rematch after that should pay. The chest under each is rolled on top
            of the item, so a boss can pay a trophy and a chest for the same win.
          </p>
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
            {Object.values(EVENT_MONSTERS).map((m) => {
              const entry = battle.monsters?.[m.id] || {}
              const open = openMonster === m.id
              const summary = monsterLootSummary(entry)
              return (
                <div key={m.id}>
                  <button
                    type="button"
                    onClick={() => setOpenMonster(open ? null : m.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                  >
                    <span className="w-32 text-sm font-medium text-gray-800 truncate">{m.name}</span>
                    <span className="flex-1 text-xs text-gray-500 truncate">{summary}</span>
                    {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </button>

                  {open && (
                    <div className="px-3 pb-4 pt-1 bg-gray-50 grid gap-4 md:grid-cols-2">
                      {battleOutcomes.map(({ key, label }) => {
                        const slot = entry[key] || {}
                        // A bare monster chance still counts as its first-clear
                        // chance, which is where the setting used to live.
                        const inherited = key === 'first_clear'
                          ? (entry.base_chance ?? battle.first_clear?.base_chance ?? battle.base_chance ?? 0.5)
                          : (battle.repeat?.base_chance ?? battle.base_chance ?? 0.5)
                        return (
                          <div key={key}>
                            <h5 className="text-xs font-semibold text-gray-700 mb-2">{label}</h5>

                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <input type="number" value={slot.base_chance ?? ''} min="0" max="1" step="0.01"
                                placeholder={`${inherited}`}
                                onChange={e => setMonsterOutcome(m.id, key, {
                                  base_chance: e.target.value === '' ? null : (parseFloat(e.target.value) || 0)
                                })}
                                className={`${inputClass} w-24`} />
                              <span className="text-xs text-gray-400">×</span>
                              <input type="number" value={slot.rolls ?? ''} min="0" max="10" step="1"
                                placeholder={`${battle[key]?.rolls ?? battle.rolls ?? 0}`}
                                onChange={e => setMonsterOutcome(m.id, key, {
                                  rolls: e.target.value === '' ? null : clampRolls(e.target.value)
                                })}
                                className={`${inputClass} w-20`} />
                              <span className="text-xs text-gray-400">
                                {slot.base_chance == null && slot.rolls == null ? 'inherits' : 'chance × rolls'}
                              </span>
                            </div>

                            <p className="text-[11px] font-medium text-gray-500 mb-1">Always drops</p>
                            <ItemPool
                              value={slot.guaranteed_items}
                              items={items}
                              inputClass={inputClass}
                              empty="Nothing guaranteed."
                              onChange={list => setMonsterOutcome(m.id, key, { guaranteed_items: list })}
                            />

                            <p className="text-[11px] font-medium text-gray-500 mb-1 mt-2">Item pool</p>
                            <ItemPool
                              value={slot.included_items}
                              items={items}
                              inputClass={inputClass}
                              empty={(entry.included_items || []).length ? "Uses this monster's pool." : 'Uses the shared pool.'}
                              onChange={list => setMonsterOutcome(m.id, key, { included_items: list })}
                            />

                            <div className="mt-2">
                              <ChestPicker
                                chest={slot.chest}
                                chests={chests}
                                inputClass={inputClass}
                                inherited={Boolean(entry.chest?.chest_id || battle[key]?.chest?.chest_id || battle.chest?.chest_id)}
                                onChange={c => setMonsterOutcome(m.id, key, { chest: c })}
                              />
                            </div>
                          </div>
                        )
                      })}

                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Both Outcomes</label>
                        <p className="text-xs text-gray-500 mb-2">Items this monster can drop whichever kind of win it was. The pools above take priority over this one.</p>
                        <ItemPool
                          value={entry.included_items}
                          items={items}
                          inputClass={inputClass}
                          empty="Uses the shared pool."
                          onChange={list => setMonsterEntry(m.id, { included_items: list })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <Button
          onClick={() => onSave('event_battle_drop_rate', battleConfig)}
          disabled={saving}
          className="mt-4"
        >
          {saving ? 'Saving...' : 'Save Battle Config'}
        </Button>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Milestone Chests</h3>
        <p className="text-sm text-gray-500 mb-4">Maps milestone events to chest types (common/uncommon/rare/epic/legendary)</p>

        <div className="space-y-3">
          {Object.keys(milestone).map((eventKey) => (
            <div key={eventKey} className="flex items-center gap-3">
              <span className="w-44 text-sm text-gray-700">{eventKey.replace(/_/g, ' ')}</span>
              <select value={milestone[eventKey] || 'common'}
                onChange={e => updateMilestone({ ...milestone, [eventKey]: e.target.value })}
                className={`${inputClass} w-32`}>
                {chestTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
              </select>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <input type="text" placeholder="new_event_key" id="new-milestone-key"
              className={`${inputClass} w-44`} />
            <button type="button" onClick={() => {
              const input = document.getElementById('new-milestone-key')
              const key = input.value.trim().replace(/\s+/g, '_')
              if (key && !milestone[key]) {
                updateMilestone({ ...milestone, [key]: 'common' })
                input.value = ''
              }
            }} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
              <Plus size={14} /> Add Event
            </button>
          </div>
        </div>

        <Button
          onClick={() => onSave('milestone_chests', milestoneConfig)}
          disabled={saving}
          className="mt-4"
        >
          {saving ? 'Saving...' : 'Save Milestone Config'}
        </Button>
      </Card>
    </div>
  )
}

export default InventoryManagement
