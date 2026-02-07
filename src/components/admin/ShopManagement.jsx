import { useState, useEffect } from 'react'
import { supabase } from '../../supabase/client'
import Card from '../ui/Card'
import Button from '../ui/Button'
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ShoppingBag
} from 'lucide-react'

const categoryOptions = [
  { value: 'avatar', label: 'Avatar' },
  { value: 'frame', label: 'Frame' },
  { value: 'background', label: 'Background' },
  { value: 'pet', label: 'Pet' },
  { value: 'school', label: 'School Things' },
]

const priceTypeOptions = [
  { value: 'gems', label: 'Gems' },
  { value: 'xp', label: 'XP' },
]

const defaultForm = {
  name: '',
  description: '',
  category: 'avatar',
  price: 0,
  price_type: 'gems',
  image_url: '',
  item_data: '{}',
  is_active: true,
}

const ShopManagement = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .order('category')
        .order('price')

      if (error) throw error
      setItems(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        name: item.name,
        description: item.description || '',
        category: item.category,
        price: item.price,
        price_type: item.price_type || 'gems',
        image_url: item.image_url || '',
        item_data: item.item_data ? JSON.stringify(item.item_data, null, 2) : '{}',
        is_active: item.is_active,
      })
    } else {
      setEditingItem(null)
      setFormData(defaultForm)
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setFormData(defaultForm)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      let parsedItemData = {}
      try {
        parsedItemData = JSON.parse(formData.item_data)
      } catch {
        throw new Error('item_data không phải JSON hợp lệ')
      }

      const payload = {
        name: formData.name,
        description: formData.description || null,
        category: formData.category,
        price: parseInt(formData.price),
        price_type: formData.price_type,
        image_url: formData.image_url || null,
        item_data: parsedItemData,
        is_active: formData.is_active,
      }

      if (editingItem) {
        const { error } = await supabase
          .from('shop_items')
          .update(payload)
          .eq('id', editingItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('shop_items')
          .insert(payload)
        if (error) throw error
      }

      handleCloseModal()
      fetchItems()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vật phẩm này?')) return
    try {
      const { error } = await supabase
        .from('shop_items')
        .delete()
        .eq('id', id)
      if (error) throw error
      fetchItems()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggleActive = async (item) => {
    try {
      const { error } = await supabase
        .from('shop_items')
        .update({ is_active: !item.is_active })
        .eq('id', item.id)
      if (error) throw error
      fetchItems()
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredItems = filterCategory === 'all'
    ? items
    : items.filter(item => item.category === filterCategory)

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Quản lý Shop</h2>
        <div className="text-center py-8 text-gray-600">Đang tải dữ liệu...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quản lý Shop</h2>
          <p className="text-gray-600">Thêm và quản lý vật phẩm trong cửa hàng</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Thêm vật phẩm</span>
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">Lỗi: {error}</div>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filterCategory === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tất cả
        </button>
        {categoryOptions.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilterCategory(cat.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterCategory === cat.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {filteredItems.map(item => (
          <Card key={item.id} className={`p-4 ${!item.is_active ? 'opacity-60' : ''}`}>
            <div className="space-y-3">
              {/* Image */}
              <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
                ) : (
                  <ShoppingBag className="w-12 h-12 text-gray-300" />
                )}
              </div>

              {/* Info */}
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  {!item.is_active && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Ẩn</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {categoryOptions.find(c => c.value === item.category)?.label || item.category}
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {item.price} {item.price_type === 'xp' ? 'XP' : 'Gems'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={() => handleOpenModal(item)} className="flex items-center space-x-1">
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleActive(item)}
                  className={`flex items-center space-x-1 ${item.is_active ? 'text-green-600' : 'text-gray-400'}`}
                >
                  {item.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(item.id)}
                  className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <Card className="p-8 text-center">
          <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có vật phẩm nào</h3>
          <p className="text-gray-600 mb-4">Thêm vật phẩm đầu tiên cho cửa hàng</p>
          <Button onClick={() => handleOpenModal()}>Thêm vật phẩm</Button>
        </Card>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingItem ? 'Sửa vật phẩm' : 'Thêm vật phẩm mới'}
                </h3>
                <Button type="button" variant="ghost" onClick={handleCloseModal}>
                  ✕
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên vật phẩm *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {categoryOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    required
                  />
                </div>

                {/* Price Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại tiền</label>
                  <select
                    value={formData.price_type}
                    onChange={(e) => setFormData({ ...formData, price_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {priceTypeOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL hình ảnh</label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>

                {/* Item Data (JSON) */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dữ liệu thêm (JSON)
                  </label>
                  <textarea
                    value={formData.item_data}
                    onChange={(e) => setFormData({ ...formData, item_data: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={3}
                    placeholder='{"avatar_url": "...", "avatar_ratio": 66}'
                  />
                </div>

                {/* Active */}
                <div className="md:col-span-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Hiển thị trong cửa hàng</span>
                  </label>
                </div>
              </div>

              {/* Preview */}
              {formData.image_url && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Xem trước:</h4>
                  <div className="w-24 h-24 bg-gray-50 rounded-lg overflow-hidden">
                    <img src={formData.image_url} alt="Preview" className="w-full h-full object-contain" />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={handleCloseModal}>Hủy</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Đang lưu...' : editingItem ? 'Cập nhật' : 'Tạo vật phẩm'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShopManagement
