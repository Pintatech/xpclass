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
  ChevronDown,
  ChevronRight,
  BookOpen,
  FileText,
  Settings,
  PlayCircle,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';

const ContentTreeView = () => {
  const [treeData, setTreeData] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [parentContext, setParentContext] = useState(null);

  useEffect(() => {
    fetchTreeData();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchTreeData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data with relationships
      const [levelsResult, unitsResult, sessionsResult, exercisesResult] = await Promise.all([
        supabase.from('levels').select('*').order('level_number'),
        supabase.from('units').select('*').order('unit_number'),
        supabase.from('sessions').select('*').order('session_number'),
        supabase.from('exercises').select('*').order('order_index')
      ]);

      const levels = levelsResult.data || [];
      const units = unitsResult.data || [];
      const sessions = sessionsResult.data || [];
      const exercises = exercisesResult.data || [];

      // Build tree structure
      const tree = levels.map(level => ({
        ...level,
        type: 'level',
        children: units
          .filter(unit => unit.level_id === level.id)
          .map(unit => ({
            ...unit,
            type: 'unit',
            children: sessions
              .filter(session => session.unit_id === unit.id)
              .map(session => ({
                ...session,
                type: 'session',
                children: exercises
                  .filter(exercise => exercise.session_id === session.id)
                  .map(exercise => ({
                    ...exercise,
                    type: 'exercise',
                    children: []
                  }))
              }))
          }))
      }));

      setTreeData(tree);
    } catch (error) {
      console.error('Error fetching tree data:', error);
      showNotification('Error loading content tree: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set();
    const collectIds = (nodes) => {
      nodes.forEach(node => {
        allIds.add(node.id);
        if (node.children?.length > 0) {
          collectIds(node.children);
        }
      });
    };
    collectIds(treeData);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const handleCreate = (type, parent = null) => {
    setModalType(type);
    setEditingItem(null);
    setParentContext(parent);
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setModalType(item.type);
    setEditingItem(item);
    setParentContext(null);
    setShowModal(true);
  };

  const handleDelete = async (item) => {
    const confirmMessage = `Are you sure you want to delete this ${item.type}? This will also delete all its children.`;
    if (!confirm(confirmMessage)) return;

    try {
      setLoading(true);
      const tableName = item.type === 'exercise' ? 'exercises' : `${item.type}s`;
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      
      showNotification(`${item.type} deleted successfully!`);
      await fetchTreeData();
    } catch (error) {
      console.error('Error deleting item:', error);
      showNotification(`Error deleting ${item.type}: ` + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData) => {
    try {
      setLoading(true);
      const tableName = modalType === 'exercise' ? 'exercises' : `${modalType}s`;

      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from(tableName)
          .update(formData)
          .eq('id', editingItem.id);

        if (error) throw error;
        showNotification(`${modalType} updated successfully!`);
      } else {
        // Create new item
        const { error } = await supabase
          .from(tableName)
          .insert(formData);

        if (error) throw error;
        showNotification(`${modalType} created successfully!`);
      }

      setShowModal(false);
      setEditingItem(null);
      setParentContext(null);
      await fetchTreeData();
    } catch (error) {
      console.error('Error saving item:', error);
      showNotification(`Error saving ${modalType}: ` + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyId = (id) => {
    navigator.clipboard.writeText(id);
    showNotification('ID copied to clipboard!');
  };

  const getNodeIcon = (type) => {
    switch (type) {
      case 'level': return BookOpen;
      case 'unit': return FileText;
      case 'session': return Settings;
      case 'exercise': return PlayCircle;
      default: return FileText;
    }
  };

  const getNodeColor = (type) => {
    switch (type) {
      case 'level': return 'blue';
      case 'unit': return 'green';
      case 'session': return 'purple';
      case 'exercise': return 'orange';
      default: return 'gray';
    }
  };

  const TreeNode = ({ node, depth = 0 }) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const IconComponent = getNodeIcon(node.type);
    const color = getNodeColor(node.type);

    return (
      <div className="select-none">
        <div 
          className={`flex items-center py-2 px-2 rounded hover:bg-gray-50 group`}
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
        >
          {/* Expand/Collapse Toggle */}
          <div className="w-6 h-6 flex items-center justify-center mr-1">
            {hasChildren ? (
              <button
                onClick={() => toggleNode(node.id)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : null}
          </div>

          {/* Node Icon */}
          <div className={`w-6 h-6 rounded-full bg-${color}-100 flex items-center justify-center mr-3`}>
            <IconComponent className={`w-4 h-4 text-${color}-600`} />
          </div>

          {/* Node Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900 truncate">
                {node.type === 'level' && `Level ${node.level_number}: `}
                {node.type === 'unit' && `Unit ${node.unit_number}: `}
                {node.type === 'session' && `Session ${node.session_number}: `}
                {node.title}
              </h4>
              
              {/* Badges */}
              <div className="flex items-center gap-1">
                {node.type === 'level' && (
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    node.difficulty_label === 'Beginner' 
                      ? 'bg-green-100 text-green-700'
                      : node.difficulty_label === 'Intermediate'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {node.difficulty_label}
                  </span>
                )}
                
                {node.type === 'session' && (
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    node.session_type === 'content' 
                      ? 'bg-blue-100 text-blue-700'
                      : node.session_type === 'vocabulary'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {node.session_type}
                  </span>
                )}

                {node.type === 'exercise' && (
                  <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">
                    {node.exercise_type}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {node.description && (
              <p className="text-sm text-gray-600 truncate mt-1">
                {node.description}
              </p>
            )}

            {/* Meta Info */}
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              {node.type === 'level' && (
                <>
                  <span>{node.children?.length || 0} units</span>
                  <span>{node.unlock_requirement} XP to unlock</span>
                </>
              )}
              {node.type === 'unit' && (
                <>
                  <span>{node.children?.length || 0} sessions</span>
                  {node.estimated_duration && <span>{node.estimated_duration} min</span>}
                </>
              )}
              {node.type === 'session' && (
                <>
                  <span>{node.children?.length || 0} exercises</span>
                  <span>Difficulty: {node.difficulty_level}/5</span>
                  <span>{node.xp_reward} XP</span>
                </>
              )}
              {node.type === 'exercise' && (
                <>
                  <span>Order: {node.order_index}</span>
                  <span>{node.xp_reward} XP</span>
                  {node.estimated_duration && <span>{node.estimated_duration} min</span>}
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => copyId(node.id)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Copy ID"
            >
              <Copy className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleEdit(node)}
              className={`p-1 text-${color}-600 hover:text-${color}-800 rounded`}
              title={`Edit ${node.type}`}
            >
              <Edit className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleDelete(node)}
              className="p-1 text-red-600 hover:text-red-800 rounded"
              title={`Delete ${node.type}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            
            {/* Add child button */}
            {node.type !== 'exercise' && (
              <button
                onClick={() => {
                  const childType = node.type === 'level' ? 'unit' 
                    : node.type === 'unit' ? 'session' 
                    : 'exercise';
                  handleCreate(childType, node);
                }}
                className={`p-1 text-${color}-600 hover:text-${color}-800 rounded`}
                title={`Add ${node.type === 'level' ? 'unit' : node.type === 'unit' ? 'session' : 'exercise'}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => (
              <TreeNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Tree</h2>
          <p className="text-gray-600">Hierarchical view of all learning content</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={expandAll}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
          >
            <Eye className="w-4 h-4" />
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-gray-600 hover:text-gray-800 flex items-center gap-1 text-sm"
          >
            <EyeOff className="w-4 h-4" />
            Collapse All
          </button>
          <button
            onClick={() => handleCreate('level')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Level
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="bg-white rounded-lg shadow-sm border">
        {loading && treeData.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading content tree...</p>
          </div>
        ) : treeData.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">🌳</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No content yet</h3>
            <p className="text-gray-600 mb-4">Create your first level to start building your content tree</p>
            <button
              onClick={() => handleCreate('level')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create First Level
            </button>
          </div>
        ) : (
          <div className="p-4">
            {treeData.map(node => (
              <TreeNode key={node.id} node={node} />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-3">Legend:</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
              <BookOpen className="w-3 h-3 text-blue-600" />
            </div>
            <span className="text-sm">Level</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
              <FileText className="w-3 h-3 text-green-600" />
            </div>
            <span className="text-sm">Unit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-100 rounded-full flex items-center justify-center">
              <Settings className="w-3 h-3 text-purple-600" />
            </div>
            <span className="text-sm">Session</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-100 rounded-full flex items-center justify-center">
              <PlayCircle className="w-3 h-3 text-orange-600" />
            </div>
            <span className="text-sm">Exercise</span>
          </div>
        </div>
      </div>

      {/* Modal for Create/Edit */}
      {showModal && (
        <UniversalModal
          type={modalType}
          item={editingItem}
          parent={parentContext}
          onSave={handleSave}
          onCancel={() => {
            setShowModal(false);
            setEditingItem(null);
            setParentContext(null);
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

// Universal Modal for all types
const UniversalModal = ({ type, item, parent, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState(() => {
    const base = {
      title: item?.title || '',
      description: item?.description || ''
    };

    switch (type) {
      case 'level':
        return {
          ...base,
          level_number: item?.level_number || '',
          difficulty_label: item?.difficulty_label || 'Beginner',
          color_theme: item?.color_theme || 'blue',
          unlock_requirement: item?.unlock_requirement || 0
        };
      case 'unit':
        return {
          ...base,
          level_id: parent?.id || item?.level_id || '',
          unit_number: item?.unit_number || '',
          color_theme: item?.color_theme || 'green',
          estimated_duration: item?.estimated_duration || ''
        };
      case 'session':
        return {
          ...base,
          unit_id: parent?.id || item?.unit_id || '',
          session_number: item?.session_number || '',
          session_type: item?.session_type || 'content',
          difficulty_level: item?.difficulty_level || 1,
          xp_reward: item?.xp_reward || 50,
          estimated_duration: item?.estimated_duration || ''
        };
      case 'exercise':
        return {
          ...base,
          session_id: parent?.id || item?.session_id || '',
          exercise_type: item?.exercise_type || 'combined_learning',
          difficulty_level: item?.difficulty_level || 1,
          xp_reward: item?.xp_reward || 25,
          order_index: item?.order_index || 1,
          is_active: item?.is_active ?? true,
          estimated_duration: item?.estimated_duration || '',
          content: item?.content || {}
        };
      default:
        return base;
    }
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description?.trim()) {
      newErrors.description = 'Description is required';
    }

    // Type-specific validation
    if (type === 'level' && (!formData.level_number || formData.level_number < 1)) {
      newErrors.level_number = 'Level number must be greater than 0';
    }

    if (type === 'unit' && (!formData.unit_number || formData.unit_number < 1)) {
      newErrors.unit_number = 'Unit number must be greater than 0';
    }

    if (type === 'session' && (!formData.session_number || formData.session_number < 1)) {
      newErrors.session_number = 'Session number must be greater than 0';
    }

    if (type === 'exercise' && (!formData.order_index || formData.order_index < 1)) {
      newErrors.order_index = 'Order index must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      // Convert numeric fields
      const processedData = { ...formData };
      
      if (type === 'level') {
        processedData.level_number = parseInt(formData.level_number);
        processedData.unlock_requirement = parseInt(formData.unlock_requirement);
      } else if (type === 'unit') {
        processedData.unit_number = parseInt(formData.unit_number);
        processedData.estimated_duration = formData.estimated_duration ? parseInt(formData.estimated_duration) : null;
      } else if (type === 'session') {
        processedData.session_number = parseInt(formData.session_number);
        processedData.difficulty_level = parseInt(formData.difficulty_level);
        processedData.xp_reward = parseInt(formData.xp_reward);
        processedData.estimated_duration = formData.estimated_duration ? parseInt(formData.estimated_duration) : null;
      } else if (type === 'exercise') {
        processedData.difficulty_level = parseInt(formData.difficulty_level);
        processedData.xp_reward = parseInt(formData.xp_reward);
        processedData.order_index = parseInt(formData.order_index);
        processedData.estimated_duration = formData.estimated_duration ? parseInt(formData.estimated_duration) : null;
      }

      onSave(processedData);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const getModalTitle = () => {
    const action = item ? 'Edit' : 'Create';
    return `${action} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">{getModalTitle()}</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Common fields */}
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
              placeholder={`Enter ${type} title...`}
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
              placeholder={`Describe this ${type}...`}
            />
            {errors.description && (
              <p className="text-red-600 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          {/* Type-specific fields */}
          {type === 'level' && (
            <div className="grid grid-cols-2 gap-4">
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
          )}

          {type === 'unit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Number *
              </label>
              <input
                type="number"
                min="1"
                value={formData.unit_number}
                onChange={(e) => handleInputChange('unit_number', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.unit_number ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.unit_number && (
                <p className="text-red-600 text-sm mt-1">{errors.unit_number}</p>
              )}
            </div>
          )}

          {type === 'session' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Number *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.session_number}
                  onChange={(e) => handleInputChange('session_number', e.target.value)}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.session_number ? 'border-red-300' : 'border-gray-300'
                  }`}
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
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="content">Content</option>
                  <option value="vocabulary">Vocabulary</option>
                  <option value="grammar">Grammar</option>
                  <option value="pronunciation">Pronunciation</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>
          )}

          {type === 'exercise' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exercise Type
                </label>
                <select
                  value={formData.exercise_type}
                  onChange={(e) => handleInputChange('exercise_type', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="combined_learning">Word Pronunciation</option>
                  <option value="flashcard">Flashcard</option>
                  <option value="audio_flashcard">Audio Flashcard</option>
                  <option value="sentence_pronunciation">Sentence Pronunciation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Index *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.order_index}
                  onChange={(e) => handleInputChange('order_index', e.target.value)}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.order_index ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.order_index && (
                  <p className="text-red-600 text-sm mt-1">{errors.order_index}</p>
                )}
              </div>
            </div>
          )}

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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {item ? 'Update' : 'Create'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContentTreeView;


