import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import {
  FolderOpen,
  Plus,
  Search,
  Grid,
  List,
  BookOpen,
  Edit3,
  Mic,
  HelpCircle,
  Copy,
  Brain,
  Video,
  Sparkles,
  Lock,
  ShieldCheck
} from 'lucide-react'
import FolderTree from './ExerciseBank/FolderTree'
import ExerciseBankCard from './ExerciseBank/ExerciseBankCard'
import CreateExerciseModal from './ExerciseBank/CreateExerciseModal'
import CreateFolderModal from './ExerciseBank/CreateFolderModal'
import EditExerciseModal from './ExerciseBank/EditExerciseModal'
import FolderAccessManager from './ExerciseBank/FolderAccessManager'
import { fetchOpenableFolderIds, fetchFolderExerciseCounts, queryBankExercises } from '../../utils/exerciseBankAccess'

const PAGE_SIZE = 20

const ExerciseBank = ({ readOnly = false, allowedTypes = null, isAdmin = false }) => {
  const { isAdmin: isAdminAccount } = useAuth()
  const [folders, setFolders] = useState([])
  const [openableFolderIds, setOpenableFolderIds] = useState(null) // null: every folder can be opened
  const [exercises, setExercises] = useState([])
  const [totalExercises, setTotalExercises] = useState(0)
  const [folderCounts, setFolderCounts] = useState({})
  const [selectedFolder, _setSelectedFolder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'grid' or 'list'
  const [filterType, setFilterType] = useState('all')
  const [showCreateExercise, setShowCreateExercise] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [showEditExercise, setShowEditExercise] = useState(false)
  const [showAccessManager, setShowAccessManager] = useState(false)
  const [editingExercise, setEditingExercise] = useState(null)
  const [foldersLoaded, setFoldersLoaded] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const savedFolderIdRef = useRef(localStorage.getItem('exerciseBank_selectedFolderId'))
  const [searchParams, setSearchParams] = useSearchParams()
  // A link can open a specific folder (?folder=<id>), e.g. the teacher dashboard shortcuts
  const linkedFolderIdRef = useRef(searchParams.get('folder'))
  const requestIdRef = useRef(0)

  const selectedFolderId = selectedFolder?.id ?? null
  const canOpenFolder = (folderId) => !openableFolderIds || openableFolderIds.has(folderId)
  // Teacher with no folders granted yet (only when the lock is on)
  const hasNoFolders = openableFolderIds !== null && openableFolderIds.size === 0

  const setSelectedFolder = (folder) => {
    _setSelectedFolder(folder)
    setCurrentPage(0)
    if (folder) {
      localStorage.setItem('exerciseBank_selectedFolderId', folder.id)
    } else {
      localStorage.removeItem('exerciseBank_selectedFolderId')
    }
  }

  // Loads the folder list and keeps the selected folder up to date (e.g. after a rename)
  const loadFolders = async () => {
    const { data, error } = await supabase
      .from('exercise_folders')
      .select('*')
      .order('sort_order')
    if (error) {
      console.error('Error fetching folders:', error)
      return null
    }
    setFolders(data || [])
    _setSelectedFolder(prev => (prev ? data.find(f => f.id === prev.id) || prev : prev))
    return data || []
  }

  // Linked folder, else the last folder viewed, else the first folder the user may open
  const pickStartFolder = (data, openable) => {
    const canOpen = (folder) => folder && (!openable || openable.has(folder.id))
    const findById = (id) => (id ? data.find(f => f.id === id) : null)
    // First folder inside folderId the user may open, in tree order
    const firstOpenableInside = (folderId, depth = 0) => {
      if (depth > 50) return null
      const children = data
        .filter(f => f.parent_folder_id === folderId)
        .sort((a, b) => a.sort_order - b.sort_order)
      for (const child of children) {
        if (canOpen(child)) return child
        const found = firstOpenableInside(child.id, depth + 1)
        if (found) return found
      }
      return null
    }
    const linked = findById(linkedFolderIdRef.current)
    if (canOpen(linked)) return linked
    // Link to a parent the user sees only by name: open the part inside it they may open
    const insideLinked = linked ? firstOpenableInside(linked.id) : null
    if (insideLinked) return insideLinked
    const saved = findById(savedFolderIdRef.current)
    if (canOpen(saved)) return saved
    // Top of each branch the user may open (root folders when nothing is restricted)
    const tops = openable
      ? data.filter(f => openable.has(f.id) && !openable.has(f.parent_folder_id))
      : data.filter(f => !f.parent_folder_id)
    return tops.sort((a, b) => a.sort_order - b.sort_order)[0] || null
  }

  const refreshCounts = async () => {
    try {
      setFolderCounts(await fetchFolderExerciseCounts())
    } catch (error) {
      console.error('Error fetching folder counts:', error)
    }
  }

  useEffect(() => {
    const init = async () => {
      const [openable, data] = await Promise.all([fetchOpenableFolderIds(), loadFolders()])
      setOpenableFolderIds(openable)
      const startFolder = data ? pickStartFolder(data, openable) : null
      if (startFolder) setSelectedFolder(startFolder)
      setFoldersLoaded(true)
      refreshCounts()
    }
    init()
  }, [])

  // Drop ?folder= once read, so a refresh keeps the folder the user moved to
  useEffect(() => {
    if (!searchParams.has('folder')) return
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('folder')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  // Search once the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim())
      setCurrentPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (!foldersLoaded) return
    fetchExercises()
  }, [foldersLoaded, selectedFolderId, searchTerm, filterType, currentPage])

  const fetchExercises = async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    const from = currentPage * PAGE_SIZE
    const { data, count, error } = await queryBankExercises(source => {
      let query = source
        .select('*', { count: 'exact' })
        .eq('is_in_bank', true)
      if (selectedFolderId) query = query.eq('folder_id', selectedFolderId)
      if (filterType !== 'all') query = query.eq('exercise_type', filterType)
      if (searchTerm) query = query.ilike('title', `%${searchTerm}%`)
      return query
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
    })

    // A newer request has started since; its result wins
    if (requestId !== requestIdRef.current) return
    // Page no longer exists (e.g. its last exercise was deleted): go back to the first page
    if (error?.code === 'PGRST103' && currentPage > 0) {
      setCurrentPage(0)
      return
    }
    if (error) {
      console.error('Error fetching exercises:', error)
    } else {
      setExercises(data || [])
      setTotalExercises(count || 0)
    }
    setLoading(false)
  }

  // After folders are created, renamed or deleted: reload them and which ones the user may open
  const refreshFolders = async () => {
    const [openable] = await Promise.all([fetchOpenableFolderIds(), loadFolders()])
    setOpenableFolderIds(openable)
  }

  // After an exercise is created, edited, duplicated or deleted
  const handleExercisesChanged = () => {
    fetchExercises()
    refreshCounts()
  }

  const handleCreateExercise = () => {
    setShowCreateExercise(true)
  }

  const handleCreateFolder = () => {
    setShowCreateFolder(true)
  }

  const handleEditExercise = (exercise) => {
    setEditingExercise(exercise)
    setShowEditExercise(true)
  }

  const handleCloseEditExercise = () => {
    setShowEditExercise(false)
    setEditingExercise(null)
  }

  const handleExerciseCreated = () => {
    handleExercisesChanged()
    setShowCreateExercise(false)
  }

  const handleFolderCreated = () => {
    refreshFolders()
    setShowCreateFolder(false)
  }

  const exerciseTypes = [
    { value: 'all', label: 'All Types', icon: Grid },
    { value: 'flashcard', label: 'Flashcard', icon: BookOpen },
    { value: 'pronunciation', label: 'Pronunciation', icon: Mic },
    { value: 'fill_blank', label: 'Fill in the Blank', icon: Edit3 },
    { value: 'multiple_choice', label: 'Multiple Choice', icon: HelpCircle },
    { value: 'dropdown', label: 'Dropdown', icon: HelpCircle },
    { value: 'drag_drop', label: 'Drag & Drop', icon: Copy },
    { value: 'ai_fill_blank', label: 'Fill in AI Score', icon: Brain },
    { value: 'video_upload', label: 'Video Upload', icon: Video },
    { value: 'face_filter_video', label: 'Fun Filter Video', icon: Sparkles },
    { value: 'vibate', label: 'Vibate', icon: Video },
  ]

  const breadcrumbs = () => {
    if (!selectedFolder) return []

    const path = []
    let current = selectedFolder

    while (current) {
      path.unshift(current)
      current = folders.find(f => f.id === current.parent_folder_id)
    }

    return path
  }

  // Teachers limited to some folders create folders only inside a folder they may open
  const canCreateFolder = !readOnly && (!openableFolderIds || (selectedFolder && canOpenFolder(selectedFolder.id)))
  const canCreateExercise = (!readOnly || allowedTypes) && !hasNoFolders
  const totalPages = Math.ceil(totalExercises / PAGE_SIZE)

  return (
    <div className="h-full bg-gray-50">
      <div className="flex h-full">
        {/* Sidebar - Folder Tree */}
        <div className="w-[28rem] bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Exercise Bank</h2>
              <div className="flex items-center gap-1">
                {isAdminAccount() && (
                  <button
                    onClick={() => setShowAccessManager(true)}
                    className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Chọn giáo viên nào được xem thư mục nào"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Phân quyền
                  </button>
                )}
                {canCreateFolder && (
                  <button
                    onClick={handleCreateFolder}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Create Folder"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <FolderTree
              folders={folders}
              folderCounts={folderCounts}
              selectedFolder={selectedFolder}
              onSelectFolder={setSelectedFolder}
              onFolderUpdate={refreshFolders}
              readOnly={readOnly}
              isAdmin={isAdmin}
              openableFolderIds={openableFolderIds}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-5 h-5 text-gray-500" />
                <nav className="flex items-center space-x-2 text-sm">
                  <span className="text-gray-500">Exercise Bank</span>
                  {breadcrumbs().map(folder => (
                    <React.Fragment key={folder.id}>
                      <span className="text-gray-400">/</span>
                      {canOpenFolder(folder.id) ? (
                        <button
                          onClick={() => setSelectedFolder(folder)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {folder.name}
                        </button>
                      ) : (
                        <span className="text-gray-400">{folder.name}</span>
                      )}
                    </React.Fragment>
                  ))}
                </nav>
              </div>

              {canCreateExercise && (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleCreateExercise}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Exercise</span>
                  </button>
                </div>
              )}
            </div>

            {/* Search and Filters */}
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 bottom-[5%] transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search exercises..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value)
                  setCurrentPage(0)
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {exerciseTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Exercise Grid/List */}
          <div className="flex-1 overflow-auto p-4">
            {hasNoFolders ? (
              <div className="text-center py-12">
                <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Bạn chưa được cấp thư mục nào</h3>
                <p className="text-gray-500">Liên hệ admin để được cấp quyền xem thư mục trong Exercise Bank.</p>
              </div>
            ) : loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : exercises.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No exercises found</h3>
                <p className="text-gray-500 mb-4">
                  {selectedFolder
                    ? `No exercises in "${selectedFolder.name}" folder`
                    : 'Start by creating your first exercise'
                  }
                </p>
                {canCreateExercise && (
                  <button
                    onClick={handleCreateExercise}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create Exercise
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                    : 'space-y-2'
                }>
                  {exercises.map(exercise => (
                    <ExerciseBankCard
                      key={exercise.id}
                      exercise={exercise}
                      viewMode={viewMode}
                      onUpdate={handleExercisesChanged}
                      onEdit={handleEditExercise}
                      readOnly={(readOnly && !allowedTypes) || (!isAdmin && selectedFolder?.read_only === true)}
                      allowedTypes={allowedTypes}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center space-x-4 mt-6 pb-4">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateExercise && (
        <CreateExerciseModal
          folders={folders}
          selectedFolder={selectedFolder}
          onClose={() => setShowCreateExercise(false)}
          onCreated={handleExerciseCreated}
          allowedTypes={allowedTypes}
          canSelectFolder={canOpenFolder}
        />
      )}

      {showCreateFolder && (
        <CreateFolderModal
          parentFolder={selectedFolder}
          onClose={() => setShowCreateFolder(false)}
          onCreated={handleFolderCreated}
        />
      )}

      {showEditExercise && editingExercise && (
        <EditExerciseModal
          isOpen={showEditExercise}
          onClose={handleCloseEditExercise}
          exercise={editingExercise}
          onUpdate={handleExercisesChanged}
        />
      )}

      {showAccessManager && (
        <FolderAccessManager onClose={() => setShowAccessManager(false)} />
      )}
    </div>
  )
}

export default ExerciseBank
