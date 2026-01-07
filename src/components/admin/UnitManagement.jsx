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
  Copy,
  Book
} from 'lucide-react';

const UnitManagement = () => {
  const [units, setUnits] = useState([]);
  const [levels, setLevels] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [filterLevel, setFilterLevel] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch units with course info
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select(`
          *,
          courses (
            id,
            title,
            level_number
          )
        `)
        .order('unit_number');

      if (unitsError) throw unitsError;

      // Fetch all courses for dropdown
      const { data: levelsData, error: levelsError } = await supabase
        .from('courses')
        .select('*')
        .order('level_number');

      if (levelsError) throw levelsError;

      setUnits(unitsData || []);
      setLevels(levelsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error loading data: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUnit = async (unitData) => {
    try {
      setLoading(true);
      
      if (editingUnit) {
        // Update existing unit
        const { error } = await supabase
          .from('units')
          .update(unitData)
          .eq('id', editingUnit.id);

        if (error) throw error;
        showNotification('Unit updated successfully!');
      } else {
        // Create new unit
        const { error } = await supabase
          .from('units')
          .insert(unitData);

        if (error) throw error;
        showNotification('Unit created successfully!');
      }

      setShowModal(false);
      setEditingUnit(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving unit:', error);
      showNotification('Error saving unit: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUnit = async (unitId) => {
    if (!confirm('Are you sure? This will delete the unit and all its sessions.')) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unitId);

      if (error) throw error;
      showNotification('Unit deleted successfully!');
      await fetchData();
    } catch (error) {
      console.error('Error deleting unit:', error);
      showNotification('Error deleting unit: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyUnitId = (unitId) => {
    navigator.clipboard.writeText(unitId);
    showNotification('Unit ID copied to clipboard!');
  };

  const filteredUnits = filterLevel
    ? units.filter(unit => unit.course_id === filterLevel)
    : units;

  return (
    <div className="space-y-6">

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter by Course:</label>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Courses</option>
              {levels.map(level => (
                <option key={level.id} value={level.id}>
                  Level {level.level_number}: {level.title}
                </option>
              ))}
            </select>
            {filterLevel && (
              <button
                onClick={() => setFilterLevel('')}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Filter
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setEditingUnit(null);
              setShowModal(true);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Unit
          </button>
        </div>
      </div>

      {/* Units List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading && units.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading units...</p>
          </div>
        ) : filteredUnits.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">📖</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filterLevel ? 'No units in this course' : 'No units yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {filterLevel
                ? 'Create your first unit for this course'
                : 'Create your first unit to get started'
              }
            </p>
            <button
              onClick={() => {
                setEditingUnit(null);
                setShowModal(true);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Create First Unit
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title & Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUnits.map((unit) => (
                  <tr key={unit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Book className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">Unit {unit.unit_number}</div>
                          <button
                            onClick={() => copyUnitId(unit.id)}
                            className="text-xs text-green-600 hover:underline flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            Copy ID
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          Level {unit.courses?.level_number}
                        </div>
                        <div className="text-gray-600">{unit.courses?.title}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{unit.title}</div>
                        <div className="text-sm text-gray-600">{unit.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {unit.estimated_duration ? `${unit.estimated_duration} min` : 'Not set'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingUnit(unit);
                            setShowModal(true);
                          }}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="Edit unit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUnit(unit.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete unit"
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
        <UnitModal
          unit={editingUnit}
          levels={levels}
          onSave={handleSaveUnit}
          onCancel={() => {
            setShowModal(false);
            setEditingUnit(null);
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

// Unit Modal Component
const UnitModal = ({ unit, levels, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    course_id: unit?.course_id || '',
    title: unit?.title || '',
    description: unit?.description || '',
    unit_number: unit?.unit_number || '',
    color_theme: unit?.color_theme || 'green',
    thumbnail_url: unit?.thumbnail_url || '',
    estimated_duration: unit?.estimated_duration || ''
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.course_id) {
      newErrors.course_id = 'Course is required';
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.unit_number || formData.unit_number < 1) {
      newErrors.unit_number = 'Unit number must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSave({
        ...formData,
        unit_number: parseInt(formData.unit_number),
        estimated_duration: formData.estimated_duration ? parseInt(formData.estimated_duration) : null
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
            {unit ? 'Edit Unit' : 'Create New Unit'}
          </h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course *
              </label>
              <select
                value={formData.course_id}
                onChange={(e) => handleInputChange('course_id', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.course_id ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select a course</option>
                {levels.map(level => (
                  <option key={level.id} value={level.id}>
                    Level {level.level_number}: {level.title}
                  </option>
                ))}
              </select>
              {errors.course_id && (
                <p className="text-red-600 text-sm mt-1">{errors.course_id}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Number *
              </label>
              <input
                type="number"
                min="1"
                value={formData.unit_number}
                onChange={(e) => handleInputChange('unit_number', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.unit_number ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="1"
              />
              {errors.unit_number && (
                <p className="text-red-600 text-sm mt-1">{errors.unit_number}</p>
              )}
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
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                errors.title ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., Basic Vocabulary"
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
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                errors.description ? 'border-red-300' : 'border-gray-300'
              }`}
              rows="3"
              placeholder="Describe what students will learn in this unit..."
            />
            {errors.description && (
              <p className="text-red-600 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color Theme
              </label>
              <select
                value={formData.color_theme}
                onChange={(e) => handleInputChange('color_theme', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="green">Green</option>
                <option value="blue">Blue</option>
                <option value="purple">Purple</option>
                <option value="orange">Orange</option>
                <option value="red">Red</option>
                <option value="pink">Pink</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Duration (minutes)
              </label>
              <input
                type="number"
                min="1"
                value={formData.estimated_duration}
                onChange={(e) => handleInputChange('estimated_duration', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Thumbnail URL (Optional)
            </label>
            <input
              type="url"
              value={formData.thumbnail_url}
              onChange={(e) => handleInputChange('thumbnail_url', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              placeholder="https://example.com/image.jpg"
            />
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
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {unit ? 'Update Unit' : 'Create Unit'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UnitManagement;

