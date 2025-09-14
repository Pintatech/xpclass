import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabase/client'
import {
  Plus,
  Edit,
  Trash2,
  Play,
  Volume2,
  Image,
  Video,
  BookOpen,
  Mic,
  Search,
  Filter,
  HelpCircle,
  Copy,
  X
} from 'lucide-react'

const ExerciseManagement = () => {
  const [exercises, setExercises] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingExercise, setEditingExercise] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')

  // Exercise Types với icons - Only types with actual dedicated components
  const exerciseTypes = {
    'combined_learning': { icon: Image, label: 'Word Pronunciation', color: 'violet' },
    'flashcard': { icon: BookOpen, label: 'Flashcard', color: 'blue' },
    'audio_flashcard': { icon: Volume2, label: 'Audio Flashcard', color: 'purple' },
    'sentence_pronunciation': { icon: Mic, label: 'Sentence Pronunciation', color: 'emerald' },
    'multiple_choice': { icon: HelpCircle, label: 'Multiple Choice', color: 'orange' },
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch exercises with session info
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .select(`
          *,
          sessions (
            id,
            title,
            session_number,
            units (
              id,
              title,
              unit_number,
              levels (
                id,
                title,
                level_number
              )
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (exercisesError) throw exercisesError

      // Fetch sessions for dropdown
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          id,
          title,
          session_number,
          units (
            id,
            title,
            unit_number,
            levels (
              id,
              title,
              level_number
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (sessionsError) throw sessionsError

      setExercises(exercisesData || [])
      setSessions(sessionsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateExercise = async (exerciseData) => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .insert(exerciseData)
        .select()

      if (error) throw error

      await fetchData() // Refresh list
      setShowCreateForm(false)
    } catch (error) {
      console.error('Error creating exercise:', error)
      alert('Lỗi tạo bài tập: ' + error.message)
    }
  }

  const handleUpdateExercise = async (id, exerciseData) => {
    try {
      const { error } = await supabase
        .from('exercises')
        .update(exerciseData)
        .eq('id', id)

      if (error) throw error

      await fetchData() // Refresh list
      setEditingExercise(null)
    } catch (error) {
      console.error('Error updating exercise:', error)
      alert('Lỗi cập nhật bài tập: ' + error.message)
    }
  }

  const handleDeleteExercise = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa bài tập này?')) return

    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id)

      if (error) throw error

      await fetchData() // Refresh list
    } catch (error) {
      console.error('Error deleting exercise:', error)
      alert('Lỗi xóa bài tập: ' + error.message)
    }
  }

  // Filter exercises
  const filteredExercises = exercises.filter(exercise => {
    const matchesSearch = exercise.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exercise.exercise_type.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterType === 'all' || exercise.exercise_type === filterType
    return matchesSearch && matchesFilter
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Đang tải...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Bài tập</h1>
          <p className="text-gray-600">Tạo và quản lý các bài tập học tập</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tạo bài tập mới
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Tìm kiếm bài tập..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="all">Tất cả loại</option>
            {Object.entries(exerciseTypes).map(([type, config]) => (
              <option key={type} value={type}>{config.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-sm text-gray-600">Tổng bài tập</div>
          <div className="text-2xl font-bold">{exercises.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-sm text-gray-600">Đang hoạt động</div>
          <div className="text-2xl font-bold text-green-600">
            {exercises.filter(e => e.is_active).length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-sm text-gray-600">Không hoạt động</div>
          <div className="text-2xl font-bold text-red-600">
            {exercises.filter(e => !e.is_active).length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-sm text-gray-600">Loại phổ biến</div>
          <div className="text-sm font-medium">
            {exercises.length > 0 ? 
              Object.entries(
                exercises.reduce((acc, ex) => {
                  acc[ex.exercise_type] = (acc[ex.exercise_type] || 0) + 1
                  return acc
                }, {})
              ).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'
              : 'N/A'
            }
          </div>
        </div>
      </div>

      {/* Exercise List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bài tập
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loại
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Session
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  XP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredExercises.map((exercise) => {
                const typeConfig = exerciseTypes[exercise.exercise_type] || { 
                  icon: BookOpen, 
                  label: exercise.exercise_type, 
                  color: 'gray' 
                }
                const IconComponent = typeConfig.icon

                return (
                  <tr key={exercise.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{exercise.title}</div>
                      <div className="text-sm text-gray-500">#{exercise.order_index}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <IconComponent className={`w-4 h-4 text-${typeConfig.color}-600`} />
                        <span className="text-sm">{typeConfig.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {exercise.sessions ? (
                          <>
                            <div className="font-medium">{exercise.sessions.title}</div>
                            <div className="text-gray-500">
                              {exercise.sessions.units?.levels?.title} → 
                              {exercise.sessions.units?.title}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">Không có session</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-orange-600">
                        {exercise.xp_reward} XP
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        exercise.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {exercise.is_active ? 'Hoạt động' : 'Tắt'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingExercise(exercise)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExercise(exercise.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {filteredExercises.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Không tìm thấy bài tập nào
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {(showCreateForm || editingExercise) && (
        <ExerciseForm
          exercise={editingExercise}
          sessions={sessions}
          exerciseTypes={exerciseTypes}
          onSave={editingExercise ? 
            (data) => handleUpdateExercise(editingExercise.id, data) : 
            handleCreateExercise
          }
          onCancel={() => {
            setShowCreateForm(false)
            setEditingExercise(null)
          }}
        />
      )}
    </div>
  )
}

// Exercise Form Component
const ExerciseForm = ({ exercise, sessions, exerciseTypes, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    session_id: exercise?.session_id || '',
    title: exercise?.title || '',
    exercise_type: exercise?.exercise_type || 'multiple_choice',
    content: exercise?.content || {},
    difficulty_level: exercise?.difficulty_level || 1,
    xp_reward: exercise?.xp_reward || 10,
    order_index: exercise?.order_index || 1,
    is_active: exercise?.is_active ?? true,
    estimated_duration: exercise?.estimated_duration || 5,
    image_url: exercise?.image_url || '',
    image_urls: exercise?.image_urls || []
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('🔍 Form data being saved:', formData)
    console.log('🔍 Exercise type:', formData.exercise_type)
    onSave(formData)
  }

  const handleContentChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        [key]: value
      }
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">
            {exercise ? 'Chỉnh sửa bài tập' : 'Tạo bài tập mới'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Session Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session
              </label>
              <select
                value={formData.session_id}
                onChange={(e) => setFormData(prev => ({ ...prev, session_id: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Chọn session</option>
                {sessions.map(session => (
                  <option key={session.id} value={session.id}>
                    {session.units?.levels?.title} → {session.units?.title} → {session.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên bài tập
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loại bài tập
                </label>
                <select
                  value={formData.exercise_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, exercise_type: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(exerciseTypes).map(([type, config]) => (
                    <option key={type} value={type}>{config.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL hình ảnh đại diện (Single)
              </label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/image.jpg"
              />
              {formData.image_url && (
                <div className="mt-2">
                  <img 
                    src={formData.image_url} 
                    alt="Preview" 
                    className="w-20 h-20 object-cover rounded-lg border"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Multiple Image URLs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URLs hình ảnh (Multiple) - Cho Combined Learning
              </label>
              <div className="space-y-2">
                {formData.image_urls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => {
                        const newUrls = [...formData.image_urls]
                        newUrls[index] = e.target.value
                        setFormData(prev => ({ ...prev, image_urls: newUrls }))
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder={`Image ${index + 1} URL`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newUrls = formData.image_urls.filter((_, i) => i !== index)
                        setFormData(prev => ({ ...prev, image_urls: newUrls }))
                      }}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      X
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ 
                      ...prev, 
                      image_urls: [...prev.image_urls, ''] 
                    }))
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  + Thêm ảnh
                </button>
              </div>
              
              {/* Preview multiple images */}
              {formData.image_urls.some(url => url) && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {formData.image_urls.map((url, index) => (
                    url && (
                      <div key={index} className="relative">
                        <img 
                          src={url} 
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg border"
                          onError={(e) => {
                            e.target.style.display = 'none'
                          }}
                        />
                        <div className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                          {index + 1}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Độ khó (1-5)
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={formData.difficulty_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, difficulty_level: parseInt(e.target.value) }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  XP thưởng
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.xp_reward}
                  onChange={(e) => setFormData(prev => ({ ...prev, xp_reward: parseInt(e.target.value) }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thứ tự
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.order_index}
                  onChange={(e) => setFormData(prev => ({ ...prev, order_index: parseInt(e.target.value) }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Content based on exercise type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nội dung bài tập
              </label>
              
              {formData.exercise_type === 'combined_learning' && (
                <div className="space-y-3 p-4 border border-gray-200 rounded-lg">
                  <input
                    type="text"
                    placeholder="Từ vựng (word)"
                    value={formData.content.word || ''}
                    onChange={(e) => handleContentChange('word', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="url"
                    placeholder="Audio URL"
                    value={formData.content.audioUrl || ''}
                    onChange={(e) => handleContentChange('audioUrl', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="url"
                    placeholder="Video URL"
                    value={formData.content.videoUrl || ''}
                    onChange={(e) => handleContentChange('videoUrl', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}
              
              {formData.exercise_type === 'flashcard' && (
                <FlashcardEditor
                  cards={formData.content.cards || []}
                  onCardsChange={(cards) => handleContentChange('cards', cards)}
                />
              )}

              {formData.exercise_type === 'multiple_choice' && (
                <MultipleChoiceEditor
                  questions={formData.content.questions || []}
                  onQuestionsChange={(questions) => handleContentChange('questions', questions)}
                />
              )}

              {formData.exercise_type === 'sentence_pronunciation' && (
                <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Video URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/video.mp4"
                      value={formData.content.videoUrl || ''}
                      onChange={(e) => handleContentChange('videoUrl', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sentences with Words (format: sentence | words)
                    </label>
                    <textarea
                      placeholder="Hello, how are you today? | Hello, how, are, you, today&#10;Nice to meet you. | Nice, to, meet, you&#10;Have a great day! | Have, great, day"
                      value={formData.content.sentencesWithWordsText || ''}
                      onChange={(e) => {
                        const sentencesWithWordsText = e.target.value
                        const sentences = sentencesWithWordsText.split('\n').filter(line => line.trim()).map(line => {
                          const [sentenceText, wordsText] = line.split('|').map(part => part.trim())
                          const words = wordsText ? wordsText.split(',').filter(word => word.trim()).map(word => ({ 
                            text: word.trim(), 
                            lang: 'en-US' 
                          })) : []
                          
                          return {
                            text: sentenceText || '', 
                            lang: 'en-US',
                            translation: '',
                            words: words
                          }
                        })
                        handleContentChange('sentencesWithWordsText', sentencesWithWordsText)
                        handleContentChange('sentences', sentences)
                      }}
                      className="w-full p-2 border border-gray-300 rounded-lg h-40"
                      rows="8"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Format: "Sentence | word1, word2, word3" (một dòng một sentence). Words sẽ hiển thị cho từng sentence riêng.
                    </p>
                  </div>
                  
                  {formData.content.sentences && formData.content.sentences.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sentences & Words Preview ({formData.content.sentences.length} câu)
                      </label>
                      <div className="max-h-48 overflow-y-auto space-y-3">
                        {formData.content.sentences.map((sentence, index) => (
                          <div key={index} className="text-sm p-3 bg-emerald-50 rounded border-l-2 border-emerald-200">
                            <div className="font-medium text-emerald-800 mb-2">
                              {index + 1}. {sentence.text}
                            </div>
                            {sentence.words && sentence.words.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {sentence.words.map((word, wordIndex) => (
                                  <span key={wordIndex} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                                    {word.text}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              
              {/* Generic JSON editor for other types */}
              {!['combined_learning', 'flashcard', 'sentence_pronunciation', 'multiple_choice'].includes(formData.exercise_type) && (
                <textarea
                  value={JSON.stringify(formData.content, null, 2)}
                  onChange={(e) => {
                    try {
                      setFormData(prev => ({ ...prev, content: JSON.parse(e.target.value) }))
                    } catch {}
                  }}
                  className="w-full p-2 border border-gray-300 rounded-lg h-32 font-mono text-sm"
                  placeholder='{"key": "value"}'
                />
              )}
            </div>

            {/* Active status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Kích hoạt bài tập
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {exercise ? 'Cập nhật' : 'Tạo mới'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Flashcard Editor Component
const FlashcardEditor = ({ cards, onCardsChange }) => {
  const [localCards, setLocalCards] = useState(cards || [])

  useEffect(() => {
    setLocalCards(cards || [])
  }, [cards])

  const addCard = () => {
    const newCard = {
      id: Date.now(), // Simple ID generation
      front: '',
      back: '',
      image: '',
      audio: ''
    }
    const updatedCards = [...localCards, newCard]
    setLocalCards(updatedCards)
    onCardsChange(updatedCards)
  }

  const updateCard = (index, field, value) => {
    const updatedCards = localCards.map((card, i) => 
      i === index ? { ...card, [field]: value } : card
    )
    setLocalCards(updatedCards)
    onCardsChange(updatedCards)
  }

  const removeCard = (index) => {
    const updatedCards = localCards.filter((_, i) => i !== index)
    setLocalCards(updatedCards)
    onCardsChange(updatedCards)
  }

  return (
    <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Flashcard Cards</h3>
        <button
          type="button"
          onClick={addCard}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          Thêm card
        </button>
      </div>

      {localCards.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>Chưa có card nào. Nhấn "Thêm card" để bắt đầu.</p>
        </div>
      )}

      <div className="space-y-4">
        {localCards.map((card, index) => (
          <div key={card.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-gray-900">Card {index + 1}</h4>
              <button
                type="button"
                onClick={() => removeCard(index)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Từ tiếng Anh (Front)
                </label>
                <input
                  type="text"
                  value={card.front}
                  onChange={(e) => updateCard(index, 'front', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Hello"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nghĩa tiếng Việt (Back)
                </label>
                <input
                  type="text"
                  value={card.back}
                  onChange={(e) => updateCard(index, 'back', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Xin chào"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hình ảnh URL
                </label>
                <input
                  type="url"
                  value={card.image}
                  onChange={(e) => updateCard(index, 'image', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/image.jpg"
                />
                {card.image && (
                  <div className="mt-2">
                    <img 
                      src={card.image} 
                      alt="Preview" 
                      className="w-16 h-16 object-cover rounded-lg border"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Audio URL
                </label>
                <input
                  type="url"
                  value={card.audio}
                  onChange={(e) => updateCard(index, 'audio', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/audio.mp3"
                />
                {card.audio && (
                  <div className="mt-2">
                    <audio controls className="w-full">
                      <source src={card.audio} type="audio/mpeg" />
                      <source src={card.audio} type="audio/wav" />
                      Trình duyệt không hỗ trợ audio.
                    </audio>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {localCards.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          Tổng cộng {localCards.length} card(s)
        </div>
      )}
    </div>
  )
}

// Enhanced Multiple Choice Editor Component
const MultipleChoiceEditor = ({ questions, onQuestionsChange }) => {
  const [localQuestions, setLocalQuestions] = useState(questions || [])
  const [bulkImportMode, setBulkImportMode] = useState(false)
  const [bulkText, setBulkText] = useState('')

  React.useEffect(() => {
    setLocalQuestions(questions || [])
  }, [questions])

  const addQuestion = () => {
    const newQuestion = {
      id: `q${Date.now()}`,
      question: '',
      options: ['', '', '', ''],
      correct_answer: 0,
      explanation: '',
      option_explanations: { 0: '', 1: '', 2: '', 3: '' }
    }
    const updatedQuestions = [...localQuestions, newQuestion]
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const duplicateQuestion = (index) => {
    const questionToDuplicate = { ...localQuestions[index] }
    questionToDuplicate.id = `q${Date.now()}`
    questionToDuplicate.question = `${questionToDuplicate.question} (Copy)`
    const updatedQuestions = [...localQuestions]
    updatedQuestions.splice(index + 1, 0, questionToDuplicate)
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const moveQuestion = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= localQuestions.length) return

    const updatedQuestions = [...localQuestions]
    const temp = updatedQuestions[index]
    updatedQuestions[index] = updatedQuestions[newIndex]
    updatedQuestions[newIndex] = temp
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const updateQuestion = (index, field, value) => {
    const updatedQuestions = localQuestions.map((question, i) =>
      i === index ? { ...question, [field]: value } : question
    )
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const updateOption = (questionIndex, optionIndex, value) => {
    const updatedQuestions = localQuestions.map((question, i) => {
      if (i === questionIndex) {
        const newOptions = [...question.options]
        newOptions[optionIndex] = value
        return { ...question, options: newOptions }
      }
      return question
    })
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const removeQuestion = (index) => {
    const updatedQuestions = localQuestions.filter((_, i) => i !== index)
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const addMultipleOptions = (questionIndex) => {
    const updatedQuestions = localQuestions.map((question, i) => {
      if (i === questionIndex) {
        return { ...question, options: [...question.options, '', ''] }
      }
      return question
    })
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const removeOption = (questionIndex, optionIndex) => {
    const updatedQuestions = localQuestions.map((question, i) => {
      if (i === questionIndex && question.options.length > 2) {
        const newOptions = question.options.filter((_, oi) => oi !== optionIndex)
        return {
          ...question,
          options: newOptions,
          correct_answer: question.correct_answer > optionIndex ? question.correct_answer - 1 : question.correct_answer
        }
      }
      return question
    })
    setLocalQuestions(updatedQuestions)
    onQuestionsChange(updatedQuestions)
  }

  const processBulkImport = () => {
    try {
      // First, try to detect if this is Moodle Cloze format
      if (bulkText.includes('{1:MCV:') || bulkText.includes('{1:MULTICHOICE:') || bulkText.includes('{=')) {
        processMoodleCloze()
        return
      }

      // Original simple format processing
      const lines = bulkText.split('\n').filter(line => line.trim())
      const newQuestions = []

      let currentQuestion = null
      let optionCounter = 0

      lines.forEach((line, index) => {
        const trimmedLine = line.trim()

        // Question line (starts with Q: or number.)
        if (trimmedLine.match(/^(Q:|Question|\d+[\.):])/i)) {
          if (currentQuestion) {
            newQuestions.push(currentQuestion)
          }
          currentQuestion = {
            id: `q${Date.now()}_${index}`,
            question: trimmedLine.replace(/^(Q:|Question|\d+[\.):])\s*/i, ''),
            options: [],
            correct_answer: 0,
            explanation: '',
            option_explanations: {}
          }
          optionCounter = 0
        }
        // Answer options (A:, B:, C:, D: or 1., 2., 3., 4.)
        else if (trimmedLine.match(/^[A-Za-z][\.):]|^\d+[\.)]/)) {
          if (currentQuestion) {
            const optionText = trimmedLine.replace(/^[A-Za-z\d][\.):]?\s*/, '')
            // Check if this is marked as correct (contains *)
            if (optionText.includes('*') || trimmedLine.includes('*')) {
              currentQuestion.correct_answer = optionCounter
              currentQuestion.options.push(optionText.replace('*', '').trim())
            } else {
              currentQuestion.options.push(optionText)
            }
            optionCounter++
          }
        }
        // Explanation line (starts with Explanation:)
        else if (trimmedLine.match(/^(Explanation|Answer):/i)) {
          if (currentQuestion) {
            currentQuestion.explanation = trimmedLine.replace(/^(Explanation|Answer):\s*/i, '')
          }
        }
      })

      if (currentQuestion) {
        newQuestions.push(currentQuestion)
      }

      if (newQuestions.length > 0) {
        const updatedQuestions = [...localQuestions, ...newQuestions]
        setLocalQuestions(updatedQuestions)
        onQuestionsChange(updatedQuestions)
        setBulkText('')
        setBulkImportMode(false)
        alert(`Successfully imported ${newQuestions.length} questions!`)
      }
    } catch (error) {
      alert('Error processing bulk import. Please check your format.')
    }
  }

  const processMoodleCloze = () => {
    try {
      const newQuestions = []

      // Split by question patterns (Question X - ID) - more specific regex
      const questionBlocks = bulkText.split(/(?=Question\s+\d+\s*-\s*[a-zA-Z0-9]+)/i).filter(block => block.trim())

      questionBlocks.forEach((block, blockIndex) => {
        const lines = block.trim().split('\n')
        let questionText = ''
        let options = []
        let correctAnswer = 0
        let explanation = ''

        // Find the cloze pattern in the entire block
        const clozeMatch = block.match(/\{1:MCV:([^}]+)\}/s)
        if (!clozeMatch) return

        // Extract question text (everything before the cloze and after question header)
        const beforeCloze = block.substring(0, block.indexOf('{1:MCV:'))
        const questionLines = beforeCloze.split('\n').filter(line => {
          const trimmed = line.trim()
          return trimmed &&
                 !trimmed.match(/^Question\s+\d+\s*-/i) &&
                 !trimmed.match(/^Which choice completes/i)
        })

        // Join question text and replace blank with proper format
        questionText = questionLines.join(' ')
          .replace(/\s+/g, ' ')
          .replace(/______/g, '______')
          .trim()

        // If question text has a blank, use it as is, otherwise add "Which choice completes the text?"
        if (!questionText.includes('______')) {
          questionText += ' Which choice completes the text so that it conforms to the conventions of Standard English?'
        }

        // Parse cloze options from the matched content
        const optionsContent = clozeMatch[1]
        const rawOptions = optionsContent.split('~').filter(opt => opt.trim())
        const optionExplanations = {}

        rawOptions.forEach((option, index) => {
          if (!option.trim()) return

          const isCorrect = option.startsWith('=')
          const cleanOption = option.replace(/^=/, '')

          // Split by # to separate option text from explanation
          const parts = cleanOption.split('#')
          const optionText = parts[0].trim()
          const optionExplanation = parts.length > 1 ? parts.slice(1).join('#').trim() : ''

          if (optionText) {
            options.push(optionText)

            // Store explanation for this specific option
            optionExplanations[options.length - 1] = optionExplanation || `This is option ${String.fromCharCode(65 + options.length - 1)}.`

            if (isCorrect) {
              correctAnswer = options.length - 1
            }
          }
        })

        // Create question if we have valid data
        if (questionText && options.length >= 2) {
          newQuestions.push({
            id: `q${Date.now()}_${blockIndex}`,
            question: questionText,
            options: options,
            correct_answer: correctAnswer,
            explanation: optionExplanations[correctAnswer] || `The correct answer is: ${options[correctAnswer]}`,
            option_explanations: optionExplanations // Store all explanations
          })
        }
      })

      if (newQuestions.length > 0) {
        const updatedQuestions = [...localQuestions, ...newQuestions]
        setLocalQuestions(updatedQuestions)
        onQuestionsChange(updatedQuestions)
        setBulkText('')
        setBulkImportMode(false)
        alert(`Successfully imported ${newQuestions.length} Moodle Cloze questions!`)
      } else {
        alert('No valid Moodle Cloze questions found. Please check the format.')
      }
    } catch (error) {
      console.error('Moodle Cloze parsing error:', error)
      alert('Error parsing Moodle Cloze format. Please check your format or try the simple format instead.')
    }
  }

  const exportQuestions = () => {
    const exportText = localQuestions.map((q, index) => {
      let text = `Q${index + 1}: ${q.question}\n`
      q.options.forEach((option, oi) => {
        const letter = String.fromCharCode(65 + oi)
        const isCorrect = q.correct_answer === oi ? ' *' : ''
        text += `${letter}: ${option}${isCorrect}\n`
      })
      if (q.explanation) {
        text += `Explanation: ${q.explanation}\n`
      }
      text += '\n'
      return text
    }).join('')

    navigator.clipboard.writeText(exportText)
    alert('Questions copied to clipboard!')
  }

  return (
    <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Multiple Choice Questions</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBulkImportMode(!bulkImportMode)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Bulk Import
          </button>
          {localQuestions.length > 0 && (
            <button
              type="button"
              onClick={exportQuestions}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              <Copy className="w-4 h-4" />
              Export
            </button>
          )}
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>
      </div>

      {/* Bulk Import Mode */}
      {bulkImportMode && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Bulk Import Questions</h4>
          <p className="text-sm text-blue-700 mb-3">
            Format: Q1: Question text / A: Option 1 * / B: Option 2 / C: Option 3 / D: Option 4 / Explanation: Text
            <br />
            (Add * after correct answer)
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="w-full p-3 border border-blue-300 rounded-lg h-40 font-mono text-sm"
            placeholder={`Q1: What does "Hello" mean in Vietnamese?
A: Xin chào *
B: Tạm biệt
C: Cảm ơn
D: Xin lỗi
Explanation: Hello means Xin chào in Vietnamese.

Q2: How do you say "Good morning"?
A: Chào buổi tối
B: Chào buổi sáng *
C: Chào buổi chiều
D: Tạm biệt
Explanation: Good morning is Chào buổi sáng.`}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setBulkImportMode(false)}
              className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={processBulkImport}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Import Questions
            </button>
          </div>
        </div>
      )}

      {localQuestions.length === 0 && !bulkImportMode && (
        <div className="text-center py-8 text-gray-500">
          <HelpCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No questions yet. Click "Add Question" or "Bulk Import" to start.</p>
        </div>
      )}

      <div className="space-y-6">
        {localQuestions.map((question, index) => (
          <div key={question.id} className="border border-gray-200 rounded-lg p-4 bg-orange-50">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-gray-900">Question {index + 1}</h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => moveQuestion(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveQuestion(index, 'down')}
                  disabled={index === localQuestions.length - 1}
                  className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => duplicateQuestion(index)}
                  className="p-1 text-blue-600 hover:text-blue-800"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(index)}
                  className="p-1 text-red-600 hover:text-red-800"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question Text
              </label>
              <textarea
                value={question.question}
                onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="What does 'Hello' mean in Vietnamese?"
                rows="2"
              />
            </div>

            {/* Options */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Answer Options
                </label>
                <button
                  type="button"
                  onClick={() => addMultipleOptions(index)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add 2 more options
                </button>
              </div>
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`question-${index}-correct`}
                      checked={question.correct_answer === optionIndex}
                      onChange={() => updateQuestion(index, 'correct_answer', optionIndex)}
                      className="text-orange-600"
                    />
                    <span className="text-sm font-medium text-gray-600 w-8">
                      {String.fromCharCode(65 + optionIndex)}:
                    </span>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                      className={`flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 ${
                        question.correct_answer === optionIndex
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-300'
                      }`}
                      placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                    />
                    {question.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index, optionIndex)}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Remove option"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Select the radio button to mark the correct answer. Green highlight = correct answer.
              </p>
            </div>

            {/* Explanation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Explanation (shown after answer)
              </label>
              <textarea
                value={question.explanation}
                onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Explain why this is the correct answer..."
                rows="2"
              />
            </div>
          </div>
        ))}
      </div>

      {localQuestions.length > 0 && (
        <div className="text-sm text-gray-600 text-center p-3 bg-gray-50 rounded">
          <strong>Total: {localQuestions.length} question(s)</strong>
          <div className="text-xs mt-1">
            Estimated time: {Math.ceil(localQuestions.length * 0.5)} minutes
          </div>
        </div>
      )}
    </div>
  )
}

export default ExerciseManagement
