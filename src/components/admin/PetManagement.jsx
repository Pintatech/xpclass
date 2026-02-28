import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabase/client'
import { Plus, Edit2, Trash2, Save, X, Eye, EyeOff } from 'lucide-react'

const PetManagement = () => {
  const [pets, setPets] = useState([])
  const [petFoodItems, setPetFoodItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddPet, setShowAddPet] = useState(false)
  const [showAddFood, setShowAddFood] = useState(false)
  const [editingPet, setEditingPet] = useState(null)
  const [message, setMessage] = useState(null)

  // Form state for new pet
  const [newPet, setNewPet] = useState({
    name: '',
    description: '',
    image_url: '',
    rarity: 'common',
    unlock_xp: 0,
    is_active: true
  })

  // Form state for new food item
  const [newFood, setNewFood] = useState({
    name: '',
    description: '',
    image_url: '',
    item_type: 'pet_food',
    rarity: 'common'
  })

  useEffect(() => {
    fetchPets()
    fetchPetFood()
  }, [])

  const fetchPets = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPets(data || [])
    } catch (error) {
      console.error('Error fetching pets:', error)
      showMessage('Failed to load pets', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchPetFood = async () => {
    try {
      const { data, error } = await supabase
        .from('collectible_items')
        .select('*')
        .in('item_type', ['pet_food', 'pet_toy'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setPetFoodItems(data || [])
    } catch (error) {
      console.error('Error fetching pet food:', error)
    }
  }

  const handleAddPet = async () => {
    try {
      const { data, error } = await supabase
        .from('pets')
        .insert([newPet])
        .select()

      if (error) throw error

      // Add default bonus for this pet
      if (data && data[0]) {
        const bonusValue = {
          'common': 5,
          'uncommon': 10,
          'rare': 15,
          'epic': 20,
          'legendary': 25
        }[newPet.rarity] || 5

        await supabase.from('pet_bonuses').insert([{
          pet_id: data[0].id,
          bonus_type: 'xp_boost',
          bonus_value: bonusValue,
          description: 'Pet XP bonus'
        }])
      }

      showMessage('Pet added successfully!', 'success')
      setShowAddPet(false)
      setNewPet({
        name: '',
        description: '',
        image_url: '',
        rarity: 'common',
        unlock_xp: 0,
        is_active: true
      })
      fetchPets()
    } catch (error) {
      console.error('Error adding pet:', error)
      showMessage('Failed to add pet', 'error')
    }
  }

  const handleUpdatePet = async (petId, updates) => {
    try {
      const { error } = await supabase
        .from('pets')
        .update(updates)
        .eq('id', petId)

      if (error) throw error

      showMessage('Pet updated successfully!', 'success')
      setEditingPet(null)
      fetchPets()
    } catch (error) {
      console.error('Error updating pet:', error)
      showMessage('Failed to update pet', 'error')
    }
  }

  const handleDeletePet = async (petId) => {
    if (!confirm('Are you sure you want to delete this pet? This will also delete all user ownership records.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('pets')
        .delete()
        .eq('id', petId)

      if (error) throw error

      showMessage('Pet deleted successfully!', 'success')
      fetchPets()
    } catch (error) {
      console.error('Error deleting pet:', error)
      showMessage('Failed to delete pet', 'error')
    }
  }

  const handleToggleActive = async (petId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('pets')
        .update({ is_active: !currentStatus })
        .eq('id', petId)

      if (error) throw error

      showMessage(`Pet ${!currentStatus ? 'activated' : 'deactivated'}!`, 'success')
      fetchPets()
    } catch (error) {
      console.error('Error toggling pet status:', error)
      showMessage('Failed to update pet status', 'error')
    }
  }

  const handleAddFood = async () => {
    try {
      const { error } = await supabase
        .from('collectible_items')
        .insert([newFood])

      if (error) throw error

      showMessage('Pet food item added successfully!', 'success')
      setShowAddFood(false)
      setNewFood({
        name: '',
        description: '',
        image_url: '',
        item_type: 'pet_food',
        rarity: 'common'
      })
      fetchPetFood()
    } catch (error) {
      console.error('Error adding food item:', error)
      showMessage('Failed to add food item', 'error')
    }
  }

  const handleDeleteFood = async (itemId) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('collectible_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error

      showMessage('Item deleted successfully!', 'success')
      fetchPetFood()
    } catch (error) {
      console.error('Error deleting item:', error)
      showMessage('Failed to delete item', 'error')
    }
  }

  const showMessage = (text, type) => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  const getRarityColor = (rarity) => {
    const colors = {
      common: 'bg-gray-100 text-gray-700',
      uncommon: 'bg-green-100 text-green-700',
      rare: 'bg-blue-100 text-blue-700',
      epic: 'bg-purple-100 text-purple-700',
      legendary: 'bg-yellow-100 text-yellow-700'
    }
    return colors[rarity] || colors.common
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Pet Management</h1>

      {/* Message Toast */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Pets Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Pets ({pets.length})</h2>
          <button
            onClick={() => setShowAddPet(!showAddPet)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"
          >
            {showAddPet ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {showAddPet ? 'Cancel' : 'Add Pet'}
          </button>
        </div>

        {/* Add Pet Form */}
        {showAddPet && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-lg mb-4">Add New Pet</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Pet Name"
                value={newPet.name}
                onChange={(e) => setNewPet({ ...newPet, name: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              />
              <input
                type="text"
                placeholder="Description"
                value={newPet.description}
                onChange={(e) => setNewPet({ ...newPet, description: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              />
              <input
                type="text"
                placeholder="Image URL"
                value={newPet.image_url}
                onChange={(e) => setNewPet({ ...newPet, image_url: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              />
              <select
                value={newPet.rarity}
                onChange={(e) => setNewPet({ ...newPet, rarity: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
              <input
                type="number"
                placeholder="Unlock XP Required"
                value={newPet.unlock_xp}
                onChange={(e) => setNewPet({ ...newPet, unlock_xp: parseInt(e.target.value) || 0 })}
                className="px-4 py-2 border rounded-lg"
              />
            </div>
            <button
              onClick={handleAddPet}
              className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg"
            >
              Add Pet
            </button>
          </div>
        )}

        {/* Pets Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Rarity</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Owners</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pets.map(pet => (
                <tr key={pet.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{pet.name}</div>
                    <div className="text-xs text-gray-500">{pet.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getRarityColor(pet.rarity)}`}>
                      {pet.rarity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(pet.id, pet.is_active)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                        pet.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {pet.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {pet.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <OwnerCount petId={pet.id} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingPet({ ...pet })}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit Pet"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePet(pet.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete Pet"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Pet Modal */}
      {editingPet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Edit Pet</h3>
              <button onClick={() => setEditingPet(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingPet.name}
                  onChange={(e) => setEditingPet({ ...editingPet, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={editingPet.description || ''}
                  onChange={(e) => setEditingPet({ ...editingPet, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
                  type="text"
                  value={editingPet.image_url || ''}
                  onChange={(e) => setEditingPet({ ...editingPet, image_url: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rarity</label>
                <select
                  value={editingPet.rarity}
                  onChange={(e) => setEditingPet({ ...editingPet, rarity: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="common">Common</option>
                  <option value="uncommon">Uncommon</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unlock XP</label>
                <input
                  type="number"
                  value={editingPet.unlock_xp}
                  onChange={(e) => setEditingPet({ ...editingPet, unlock_xp: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingPet(null)}
                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdatePet(editingPet.id, {
                  name: editingPet.name,
                  description: editingPet.description,
                  image_url: editingPet.image_url,
                  rarity: editingPet.rarity,
                  unlock_xp: editingPet.unlock_xp
                })}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pet Food Items Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Pet Food & Items ({petFoodItems.length})</h2>
          <button
            onClick={() => setShowAddFood(!showAddFood)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"
          >
            {showAddFood ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {showAddFood ? 'Cancel' : 'Add Item'}
          </button>
        </div>

        {/* Add Food Form */}
        {showAddFood && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-lg mb-4">Add New Pet Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Item Name"
                value={newFood.name}
                onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              />
              <input
                type="text"
                placeholder="Description"
                value={newFood.description}
                onChange={(e) => setNewFood({ ...newFood, description: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              />
              <input
                type="text"
                placeholder="Image URL"
                value={newFood.image_url}
                onChange={(e) => setNewFood({ ...newFood, image_url: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              />
              <select
                value={newFood.item_type}
                onChange={(e) => setNewFood({ ...newFood, item_type: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="pet_food">Pet Food</option>
                <option value="pet_toy">Pet Toy</option>
              </select>
              <select
                value={newFood.rarity}
                onChange={(e) => setNewFood({ ...newFood, rarity: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
              </select>
            </div>
            <button
              onClick={handleAddFood}
              className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg"
            >
              Add Item
            </button>
          </div>
        )}

        {/* Food Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {petFoodItems.map(item => (
            <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-lg">{item.name}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
                <button
                  onClick={() => handleDeleteFood(item.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getRarityColor(item.rarity)}`}>
                  {item.rarity}
                </span>
                <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                  {item.item_type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Helper component to show owner count
const OwnerCount = ({ petId }) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const fetchCount = async () => {
      const { count: ownerCount } = await supabase
        .from('user_pets')
        .select('*', { count: 'exact', head: true })
        .eq('pet_id', petId)

      setCount(ownerCount || 0)
    }

    fetchCount()
  }, [petId])

  return <span className="text-sm font-semibold">{count} students</span>
}

export default PetManagement
