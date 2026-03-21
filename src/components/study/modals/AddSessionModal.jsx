import React, { useState } from 'react'
import { supabase } from '../../../supabase/client'
import { X, PlayCircle, Plus } from 'lucide-react'

const AddSessionModal = ({ unitId, onClose, onCreated }) => {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: existingSessions, error: countError } = await supabase
        .from('sessions')
        .select('session_number')
        .eq('unit_id', unitId)
        .order('session_number', { ascending: false })
        .limit(1)

      if (countError) throw countError

      const nextSessionNumber = existingSessions.length > 0 ? existingSessions[0].session_number + 1 : 1

      const { data, error } = await supabase
        .from('sessions')
        .insert({
          unit_id: unitId,
          title: title.trim(),
          session_number: nextSessionNumber,
          session_type: 'mixed',
          difficulty_level: 1,
          xp_reward: 50,
          unlock_requirement: null,
          is_active: true,
          estimated_duration: 15
        })
        .select()
        .single()

      if (error) throw error

      onCreated(data)
    } catch (err) {
      console.error('Error creating session:', err)
      setError(err.message || 'Failed to create session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <PlayCircle className="w-4 h-4 text-green-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              New Session
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
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Family Vocabulary"
              required
              autoFocus
            />
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>{loading ? 'Creating...' : 'Create'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddSessionModal
