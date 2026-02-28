import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabase/client'
import { X, PlayCircle, Save } from 'lucide-react'

const EditSessionModal = ({ session, onClose, onUpdated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    session_type: 'mixed',
    difficulty_level: 1,
    xp_reward: 50,
    estimated_duration: 15
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sessionTypes = [
    { value: 'vocabulary', label: 'Vocabulary', description: 'Learn new words and meanings' },
    { value: 'grammar', label: 'Grammar', description: 'Practice grammar rules and structures' },
    { value: 'pronunciation', label: 'Pronunciation', description: 'Practice speaking and pronunciation' },
    { value: 'listening', label: 'Listening', description: 'Improve listening comprehension' },
    { value: 'mixed', label: 'Mixed Practice', description: 'Combination of different skills' }
  ]

  const difficultyLevels = [
    { value: 1, label: 'Beginner', color: 'bg-green-100 text-green-800' },
    { value: 2, label: 'Elementary', color: 'bg-blue-100 text-blue-800' },
    { value: 3, label: 'Intermediate', color: 'bg-yellow-100 text-yellow-800' },
    { value: 4, label: 'Advanced', color: 'bg-orange-100 text-orange-800' },
    { value: 5, label: 'Expert', color: 'bg-red-100 text-red-800' }
  ]

  useEffect(() => {
    if (session) {
      setFormData({
        title: session.title || '',
        description: session.description || '',
        session_type: session.session_type || 'mixed',
        difficulty_level: session.difficulty_level || 1,
        xp_reward: session.xp_reward || 50,
        estimated_duration: session.estimated_duration || 15
      })
    }
  }, [session])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('sessions')
        .update({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          session_type: formData.session_type,
          difficulty_level: formData.difficulty_level,
          xp_reward: formData.xp_reward,
          estimated_duration: formData.estimated_duration
        })
        .eq('id', session.id)
        .select()
        .single()

      if (error) throw error

      onUpdated(data)
    } catch (err) {
      console.error('Error updating session:', err)
      setError(err.message || 'Failed to update session')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const getSessionTypeIcon = (type) => {
    switch (type) {
      case 'vocabulary':
        return '📚'
      case 'grammar':
        return '📝'
      case 'pronunciation':
        return '🎤'
      case 'listening':
        return '👂'
      case 'mixed':
        return '🎯'
      default:
        return '📖'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <PlayCircle className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Edit Session
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

          {/* Session Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Family Vocabulary, Present Tense Practice"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="What will students learn in this session?"
              rows={2}
            />
          </div>

          {/* Session Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Type
            </label>
            <div className="grid grid-cols-1 gap-2">
              {sessionTypes.map(type => (
                <label
                  key={type.value}
                  className={`
                    flex items-center p-3 border rounded-lg cursor-pointer transition-colors
                    ${formData.session_type === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="session_type"
                    value={type.value}
                    checked={formData.session_type === type.value}
                    onChange={(e) => handleChange('session_type', e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-lg mr-3">{getSessionTypeIcon(type.value)}</span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{type.label}</div>
                    <div className="text-sm text-gray-600">{type.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Difficulty Level and XP Reward */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty Level
              </label>
              <select
                value={formData.difficulty_level}
                onChange={(e) => handleChange('difficulty_level', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {difficultyLevels.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                XP Reward
              </label>
              <input
                type="number"
                value={formData.xp_reward}
                onChange={(e) => handleChange('xp_reward', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="10"
                max="200"
                step="10"
              />
            </div>
          </div>

          {/* Estimated Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Duration (minutes)
            </label>
            <input
              type="number"
              value={formData.estimated_duration}
              onChange={(e) => handleChange('estimated_duration', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="5"
              max="120"
              step="5"
            />
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div className="bg-white rounded-lg border p-3">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">
                  {getSessionTypeIcon(formData.session_type)}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">
                    {formData.title || 'Session Title'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {formData.description || 'Session description'}
                  </p>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      difficultyLevels.find(d => d.value === formData.difficulty_level)?.color
                    }`}>
                      {difficultyLevels.find(d => d.value === formData.difficulty_level)?.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formData.xp_reward} XP • {formData.estimated_duration} min
                    </span>
                  </div>
                </div>
              </div>
            </div>
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
              className="flex-1 px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{loading ? 'Updating...' : 'Update Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditSessionModal