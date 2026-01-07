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
  PlayCircle
} from 'lucide-react';

const SessionManagement = () => {
  const [sessions, setSessions] = useState([]);
  const [units, setUnits] = useState([]);
  const [levels, setLevels] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [filterLevel, setFilterLevel] = useState('');
  const [filterUnit, setFilterUnit] = useState('');

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
      
      // Fetch sessions with unit and level info
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          units (
            id,
            title,
            unit_number,
            courses (
              id,
              title,
              level_number
            )
          )
        `)
        .order('session_number');

      if (sessionsError) throw sessionsError;

      // Fetch all units for dropdown
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

      // Fetch all courses for filter
      const { data: levelsData, error: levelsError } = await supabase
        .from('courses')
        .select('*')
        .order('level_number');

      if (levelsError) throw levelsError;

      setSessions(sessionsData || []);
      setUnits(unitsData || []);
      setLevels(levelsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error loading data: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSession = async (sessionData) => {
    try {
      setLoading(true);
      
      if (editingSession) {
        // Update existing session
        const { error } = await supabase
          .from('sessions')
          .update(sessionData)
          .eq('id', editingSession.id);

        if (error) throw error;
        showNotification('Session updated successfully!');
      } else {
        // Create new session
        const { error } = await supabase
          .from('sessions')
          .insert(sessionData);

        if (error) throw error;
        showNotification('Session created successfully!');
      }

      setShowModal(false);
      setEditingSession(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving session:', error);
      showNotification('Error saving session: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!confirm('Are you sure? This will delete the session and all its exercises.')) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      showNotification('Session deleted successfully!');
      await fetchData();
    } catch (error) {
      console.error('Error deleting session:', error);
      showNotification('Error deleting session: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copySessionId = (sessionId) => {
    navigator.clipboard.writeText(sessionId);
    showNotification('Session ID copied to clipboard!');
  };

  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    const levelMatch = !filterLevel || session.units?.courses?.id === filterLevel;
    const unitMatch = !filterUnit || session.unit_id === filterUnit;
    return levelMatch && unitMatch;
  });

  // Get units for selected level
  const availableUnits = filterLevel 
    ? units.filter(unit => unit.courses?.id === filterLevel)
    : units;

  const sessionTypes = [
    { value: 'mixed', label: 'Mixed' },
    { value: 'vocabulary', label: 'Vocabulary' },
    { value: 'grammar', label: 'Grammar' },
    { value: 'listening', label: 'Listening' }
  ];

  return (
    <div className="space-y-6">


      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Course:</label>
              <select
                value={filterLevel}
                onChange={(e) => {
                  setFilterLevel(e.target.value);
                  setFilterUnit(''); // Reset unit filter when course changes
                }}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Courses</option>
                {levels.map(level => (
                  <option key={level.id} value={level.id}>
                    Level {level.level_number}: {level.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Unit:</label>
              <select
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                disabled={!filterLevel}
              >
                <option value="">All Units</option>
                {availableUnits.map(unit => (
                  <option key={unit.id} value={unit.id}>
                    Unit {unit.unit_number}: {unit.title}
                  </option>
                ))}
              </select>
            </div>

            {(filterLevel || filterUnit) && (
              <button
                onClick={() => {
                  setFilterLevel('');
                  setFilterUnit('');
                }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setEditingSession(null);
              setShowModal(true);
            }}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Session
          </button>
        </div>
      </div>

      {/* Sessions List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading && sessions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading sessions...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filterLevel || filterUnit ? 'No sessions match your filters' : 'No sessions yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              Create your first session to get started
            </p>
            <button
              onClick={() => {
                setEditingSession(null);
                setShowModal(true);
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              Create First Session
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Session
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course & Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title & Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <PlayCircle className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">Session {session.session_number}</div>
                          <button
                            onClick={() => copySessionId(session.id)}
                            className="text-xs text-purple-600 hover:underline flex items-center gap-1"
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
                          Level {session.units?.courses?.level_number}
                        </div>
                        <div className="text-gray-600">
                          Unit {session.units?.unit_number}: {session.units?.title}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{session.title}</div>
                        <div className="text-sm text-gray-600">{session.description}</div>
                        <span className={`inline-flex mt-1 px-2 py-1 text-xs font-semibold rounded-full ${
                          session.session_type === 'mixed'
                            ? 'bg-blue-100 text-blue-800'
                            : session.session_type === 'vocabulary'
                            ? 'bg-green-100 text-green-800'
                            : session.session_type === 'grammar'
                            ? 'bg-yellow-100 text-yellow-800'
                            : session.session_type === 'listening'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {session.session_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-gray-900">
                          Difficulty: {session.difficulty_level}/5
                        </div>
                        <div className="text-gray-600">
                          {session.xp_reward} XP reward
                        </div>
                        <div className="text-gray-600">
                          {session.estimated_duration ? `${session.estimated_duration} min` : 'Duration not set'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingSession(session);
                            setShowModal(true);
                          }}
                          className="text-purple-600 hover:text-purple-900 p-1"
                          title="Edit session"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete session"
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
        <SessionModal
          session={editingSession}
          units={units}
          levels={levels}
          sessionTypes={sessionTypes}
          onSave={handleSaveSession}
          onCancel={() => {
            setShowModal(false);
            setEditingSession(null);
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

// Session Modal Component
const SessionModal = ({ session, units, levels, sessionTypes, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    unit_id: session?.unit_id || '',
    title: session?.title || '',
    description: session?.description || '',
    session_number: session?.session_number || '',
    session_type: session?.session_type || 'mixed',
    difficulty_level: session?.difficulty_level || 1,
    xp_reward: session?.xp_reward || 50,
    estimated_duration: session?.estimated_duration || '',
    thumbnail_url: session?.thumbnail_url || ''
  });
  const [errors, setErrors] = useState({});
  const [selectedLevel, setSelectedLevel] = useState('');

  // Initialize selected level when editing
  useEffect(() => {
    if (session?.unit_id && units.length > 0) {
      const unit = units.find(u => u.id === session.unit_id);
      if (unit?.courses?.id) {
        setSelectedLevel(unit.courses.id);
      }
    }
  }, [session, units]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.unit_id) {
      newErrors.unit_id = 'Unit is required';
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.session_number || formData.session_number < 1) {
      newErrors.session_number = 'Session number must be greater than 0';
    }

    if (formData.difficulty_level < 1 || formData.difficulty_level > 5) {
      newErrors.difficulty_level = 'Difficulty level must be between 1 and 5';
    }

    if (formData.xp_reward < 0) {
      newErrors.xp_reward = 'XP reward cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSave({
        ...formData,
        session_number: parseInt(formData.session_number),
        difficulty_level: parseInt(formData.difficulty_level),
        xp_reward: parseInt(formData.xp_reward),
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

  // Get units for selected level
  const availableUnits = selectedLevel 
    ? units.filter(unit => unit.courses?.id === selectedLevel)
    : units;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {session ? 'Edit Session' : 'Create New Session'}
          </h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => {
                  setSelectedLevel(e.target.value);
                  handleInputChange('unit_id', ''); // Reset unit when course changes
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select a course first</option>
                {levels.map(level => (
                  <option key={level.id} value={level.id}>
                    Level {level.level_number}: {level.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit *
              </label>
              <select
                value={formData.unit_id}
                onChange={(e) => handleInputChange('unit_id', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                  errors.unit_id ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={!selectedLevel}
              >
                <option value="">Select a unit</option>
                {availableUnits.map(unit => (
                  <option key={unit.id} value={unit.id}>
                    Unit {unit.unit_number}: {unit.title}
                  </option>
                ))}
              </select>
              {errors.unit_id && (
                <p className="text-red-600 text-sm mt-1">{errors.unit_id}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Number *
              </label>
              <input
                type="number"
                min="1"
                value={formData.session_number}
                onChange={(e) => handleInputChange('session_number', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                  errors.session_number ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="1"
              />
              {errors.session_number && (
                <p className="text-red-600 text-sm mt-1">{errors.session_number}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Type
              </label>
              <select
                value={formData.session_type}
                onChange={(e) => handleInputChange('session_type', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {sessionTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
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
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                errors.title ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., Greetings and Introductions"
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
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                errors.description ? 'border-red-300' : 'border-gray-300'
              }`}
              rows="3"
              placeholder="Describe what students will practice in this session..."
            />
            {errors.description && (
              <p className="text-red-600 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL hình ảnh đại diện
            </label>
            <input
              type="url"
              value={formData.thumbnail_url}
              onChange={(e) => handleInputChange('thumbnail_url', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="https://example.com/image.jpg"
            />
            {formData.thumbnail_url && (
              <div className="mt-2">
                <img
                  src={formData.thumbnail_url} 
                  alt="Preview" 
                  className="w-20 h-20 object-cover rounded-lg border"
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Difficulty Level (1-5) *
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={formData.difficulty_level}
                onChange={(e) => handleInputChange('difficulty_level', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                  errors.difficulty_level ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="1"
              />
              {errors.difficulty_level && (
                <p className="text-red-600 text-sm mt-1">{errors.difficulty_level}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                XP Reward
              </label>
              <input
                type="number"
                min="0"
                value={formData.xp_reward}
                onChange={(e) => handleInputChange('xp_reward', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                  errors.xp_reward ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="50"
              />
              {errors.xp_reward && (
                <p className="text-red-600 text-sm mt-1">{errors.xp_reward}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                min="1"
                value={formData.estimated_duration}
                onChange={(e) => handleInputChange('estimated_duration', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="15"
              />
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
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {session ? 'Update Session' : 'Create Session'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SessionManagement;

