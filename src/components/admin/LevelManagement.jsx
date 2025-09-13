import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  AlertCircle, 
  CheckCircle,
  Eye,
  Copy
} from 'lucide-react';

const LevelManagement = () => {
  const [levels, setLevels] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchLevels();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchLevels = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .order('level_number');

      if (error) throw error;
      setLevels(data || []);
    } catch (error) {
      console.error('Error fetching levels:', error);
      showNotification('Error loading levels: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLevel = async (levelData) => {
    try {
      setLoading(true);
      
      if (editingLevel) {
        // Update existing level
        const { error } = await supabase
          .from('levels')
          .update(levelData)
          .eq('id', editingLevel.id);

        if (error) throw error;
        showNotification('Level updated successfully!');
      } else {
        // Create new level
        const { error } = await supabase
          .from('levels')
          .insert(levelData);

        if (error) throw error;
        showNotification('Level created successfully!');
      }

      setShowModal(false);
      setEditingLevel(null);
      await fetchLevels();
    } catch (error) {
      console.error('Error saving level:', error);
      showNotification('Error saving level: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLevel = async (levelId) => {
    if (!confirm('Are you sure? This will delete the level and all its related content.')) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('levels')
        .delete()
        .eq('id', levelId);

      if (error) throw error;
      showNotification('Level deleted successfully!');
      await fetchLevels();
    } catch (error) {
      console.error('Error deleting level:', error);
      showNotification('Error deleting level: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyLevelId = (levelId) => {
    navigator.clipboard.writeText(levelId);
    showNotification('Level ID copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Level Management</h2>
          <p className="text-gray-600">Create and manage learning levels</p>
        </div>
        <button
          onClick={() => {
            setEditingLevel(null);
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Level
        </button>
      </div>

      {/* Levels List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading && levels.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading levels...</p>
          </div>
        ) : levels.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No levels yet</h3>
            <p className="text-gray-600 mb-4">Create your first level to get started</p>
            <button
              onClick={() => {
                setEditingLevel(null);
                setShowModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create First Level
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thumbnail
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title & Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Difficulty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requirements
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {levels.map((level) => (
                  <tr key={level.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                        {level.thumbnail_url ? (
                          <img 
                            src={level.thumbnail_url} 
                            alt={level.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">
                            {level.level_number === 1 ? '🌱' : 
                             level.level_number === 2 ? '📚' : 
                             level.level_number === 3 ? '🏆' : '🎯'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-800 font-bold">{level.level_number}</span>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Level {level.level_number}</div>
                          <button
                            onClick={() => copyLevelId(level.id)}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            Copy ID
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{level.title}</div>
                        <div className="text-sm text-gray-600">{level.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        level.difficulty_label === 'Beginner' 
                          ? 'bg-green-100 text-green-800'
                          : level.difficulty_label === 'Intermediate'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {level.difficulty_label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{level.unlock_requirement} XP</div>
                      <div className="text-sm text-gray-600">to unlock</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingLevel(level);
                            setShowModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Edit level"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLevel(level.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete level"
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
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <LevelModal
          level={editingLevel}
          onSave={handleSaveLevel}
          onCancel={() => {
            setShowModal(false);
            setEditingLevel(null);
          }}
          loading={loading}
        />
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          notification.type === 'error' 
            ? 'bg-red-500 text-white' 
            : 'bg-green-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Level Modal Component
const LevelModal = ({ level, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    title: level?.title || '',
    description: level?.description || '',
    level_number: level?.level_number || '',
    difficulty_label: level?.difficulty_label || 'Beginner',
    color_theme: level?.color_theme || 'blue',
    unlock_requirement: level?.unlock_requirement || 0,
    thumbnail_url: level?.thumbnail_url || ''
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.level_number || formData.level_number < 1) {
      newErrors.level_number = 'Level number must be greater than 0';
    }

    if (formData.unlock_requirement < 0) {
      newErrors.unlock_requirement = 'Unlock requirement cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSave({
        ...formData,
        level_number: parseInt(formData.level_number),
        unlock_requirement: parseInt(formData.unlock_requirement)
      });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {level ? 'Edit Level' : 'Create New Level'}
          </h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Level Number *
              </label>
              <input
                type="number"
                min="1"
                value={formData.level_number}
                onChange={(e) => handleInputChange('level_number', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.level_number ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="1"
              />
              {errors.level_number && (
                <p className="text-red-600 text-sm mt-1">{errors.level_number}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Difficulty
              </label>
              <select
                value={formData.difficulty_label}
                onChange={(e) => handleInputChange('difficulty_label', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.title ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., Basic English"
            />
            {errors.title && (
              <p className="text-red-600 text-sm mt-1">{errors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.description ? 'border-red-300' : 'border-gray-300'
              }`}
              rows="3"
              placeholder="Describe what students will learn in this level..."
            />
            {errors.description && (
              <p className="text-red-600 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Thumbnail URL
            </label>
            <input
              type="url"
              value={formData.thumbnail_url}
              onChange={(e) => handleInputChange('thumbnail_url', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/image.jpg"
            />
            <p className="text-sm text-gray-500 mt-1">
              Optional: URL to an image for this level (400x400px recommended)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color Theme
              </label>
              <select
                value={formData.color_theme}
                onChange={(e) => handleInputChange('color_theme', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="purple">Purple</option>
                <option value="orange">Orange</option>
                <option value="red">Red</option>
                <option value="pink">Pink</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unlock Requirement (XP)
              </label>
              <input
                type="number"
                min="0"
                value={formData.unlock_requirement}
                onChange={(e) => handleInputChange('unlock_requirement', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.unlock_requirement ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0"
              />
              {errors.unlock_requirement && (
                <p className="text-red-600 text-sm mt-1">{errors.unlock_requirement}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {level ? 'Update Level' : 'Create Level'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LevelManagement;

