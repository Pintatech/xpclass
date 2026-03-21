import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabase/client'
import { X, BookOpen, Save, Upload, Trash2 } from 'lucide-react'

const EditUnitModal = ({ unit, onClose, onUpdated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    color_theme: 'blue',
    estimated_duration: 60,
    thumbnail_url: ''
  })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const colorOptions = [
    { value: 'blue', label: 'Ice', class: 'bg-blue-500' },
    { value: 'green', label: 'Forest', class: 'bg-green-500' },
    { value: 'purple', label: 'Pirate', class: 'bg-purple-500' },
    { value: 'orange', label: 'Ninja', class: 'bg-gray-500' },
    { value: 'red', label: 'Dino', class: 'bg-yellow-700' },
    { value: 'yellow', label: 'Desert', class: 'bg-yellow-500' }
  ]

  useEffect(() => {
    if (unit) {
      setFormData({
        title: unit.title || '',
        description: unit.description || '',
        color_theme: unit.color_theme || 'blue',
        estimated_duration: unit.estimated_duration || 60,
        thumbnail_url: unit.thumbnail_url || ''
      })
    }
  }, [unit])

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('course-backgrounds')
        .upload(path, file, { cacheControl: '3600', upsert: true })
      if (uploadError) throw uploadError
      const { data: publicData } = supabase.storage
        .from('course-backgrounds')
        .getPublicUrl(path)
      handleChange('thumbnail_url', publicData.publicUrl)
    } catch (err) {
      console.error('Upload error:', err)
      setError('Upload failed: ' + (err.message || 'Unknown error'))
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('units')
        .update({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          color_theme: formData.color_theme,
          estimated_duration: formData.estimated_duration,
          thumbnail_url: formData.thumbnail_url || null
        })
        .eq('id', unit.id)
        .select()
        .single()

      if (error) throw error

      onUpdated(data)
    } catch (err) {
      console.error('Error updating unit:', err)
      setError(err.message || 'Failed to update unit')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Edit Unit
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Unit Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Basic Vocabulary, Grammar Fundamentals"
              required
            />
          </div>

          {/* Color Theme */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color Theme
            </label>
            <div className="grid grid-cols-3 gap-3">
              {colorOptions.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => handleChange('color_theme', color.value)}
                  className={`
                    px-4 py-3 rounded-lg border-2 transition-all font-medium text-sm
                    ${color.class}
                    ${formData.color_theme === color.value
                      ? 'border-gray-800 ring-2 ring-gray-300 scale-105'
                      : 'border-gray-300 hover:border-gray-400'
                    }
                  `}
                >
                  {color.label}
                </button>
              ))}
            </div>
          </div>

          {/* Background Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Background Image
            </label>
            {formData.thumbnail_url && (
              <img src={formData.thumbnail_url} alt="Preview" className="w-full h-24 object-cover rounded-lg border mb-2" />
            )}
            <div className="flex items-center gap-2">
              <label className={`inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading...' : formData.thumbnail_url ? 'Change' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              {formData.thumbnail_url && (
                <button
                  type="button"
                  onClick={() => handleChange('thumbnail_url', '')}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-500 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Uses theme default if empty</p>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{loading ? 'Updating...' : 'Update Unit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditUnitModal