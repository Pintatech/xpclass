import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../supabase/client'
import { useAuth } from '../../../hooks/useAuth'
import { AlertTriangle, ChevronDown, ChevronRight, Folder, Lock, Search, ShieldCheck, X } from 'lucide-react'

// "Not found" codes: the SQL migration has not been run yet
const MISSING_CODES = ['PGRST202', 'PGRST205', '42P01', '42883']

// Lowercase without Vietnamese accents, for search
const normalize = (text) => (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

const teacherName = (teacher) => teacher.real_name || teacher.full_name || teacher.email || ''

// Walks up the folder tree from folderId's parent. Stops after 50 steps in case of a loop.
const forEachAncestor = (parentOf, folderId, visit) => {
  let id = parentOf.get(folderId)
  for (let steps = 0; id && steps < 50; steps++) {
    if (visit(id) === false) return
    id = parentOf.get(id)
  }
}

/**
 * Admin popup: pick a teacher, then tick the Exercise Bank folders they may open.
 * A ticked folder also opens everything inside it.
 */
const FolderAccessManager = ({ onClose }) => {
  const { user } = useAuth()
  const [teachers, setTeachers] = useState([])
  const [folders, setFolders] = useState([])
  const [grants, setGrants] = useState([]) // saved rows: { teacher_id, folder_id }
  const [lockOn, setLockOn] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [teacherId, setTeacherId] = useState(null)
  const [draft, setDraft] = useState(new Set()) // folders ticked for the selected teacher
  const [teacherQuery, setTeacherQuery] = useState('')
  const [folderQuery, setFolderQuery] = useState('')
  const [expanded, setExpanded] = useState(new Set())

  const fetchGrants = async () => {
    const { data, error } = await supabase.from('exercise_folder_access').select('teacher_id, folder_id')
    if (error) throw error
    setGrants(data || [])
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [teacherResult, folderResult, lockResult] = await Promise.all([
          supabase.from('users').select('id, full_name, real_name, email').eq('role', 'teacher'),
          supabase.from('exercise_folders').select('id, name, parent_folder_id, sort_order, read_only'),
          supabase.rpc('exercise_bank_lock_enabled'),
        ])
        if (teacherResult.error) throw teacherResult.error
        if (folderResult.error) throw folderResult.error
        setTeachers((teacherResult.data || []).sort((a, b) => teacherName(a).localeCompare(teacherName(b), 'vi')))
        setFolders(folderResult.data || [])
        setLockOn(lockResult.error ? null : lockResult.data)
        await fetchGrants()
      } catch (err) {
        console.error('Error loading folder access:', err)
        setError(MISSING_CODES.includes(err.code)
          ? 'Chưa chạy file SQL add_exercise_folder_access.sql trên Supabase.'
          : `Không tải được dữ liệu: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const childrenOf = useMemo(() => {
    const map = new Map()
    folders.forEach(folder => {
      const key = folder.parent_folder_id || null
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(folder)
    })
    map.forEach(list => list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name, 'vi')))
    return map
  }, [folders])

  const parentOf = useMemo(() => new Map(folders.map(folder => [folder.id, folder.parent_folder_id])), [folders])

  const savedGrants = useMemo(
    () => new Set(grants.filter(grant => grant.teacher_id === teacherId).map(grant => grant.folder_id)),
    [grants, teacherId]
  )

  const grantCount = useMemo(() => {
    const counts = {}
    grants.forEach(grant => { counts[grant.teacher_id] = (counts[grant.teacher_id] || 0) + 1 })
    return counts
  }, [grants])

  // Edit from what is saved, with the branches holding the teacher's folders opened
  useEffect(() => {
    setDraft(new Set(savedGrants))
    setExpanded(prev => {
      const next = new Set(prev)
      savedGrants.forEach(folderId => forEachAncestor(parentOf, folderId, id => { next.add(id) }))
      return next
    })
  }, [savedGrants, parentOf])

  // How many ticked folders sit inside each folder, shown while it is collapsed
  const tickedInside = useMemo(() => {
    const counts = new Map()
    draft.forEach(folderId => forEachAncestor(parentOf, folderId, id => { counts.set(id, (counts.get(id) || 0) + 1) }))
    return counts
  }, [draft, parentOf])

  // While searching: matching folders and their parents, all expanded
  const searchMatches = useMemo(() => {
    const query = normalize(folderQuery.trim())
    if (!query) return null
    const shown = new Set()
    folders.forEach(folder => {
      if (!normalize(folder.name).includes(query)) return
      shown.add(folder.id)
      forEachAncestor(parentOf, folder.id, id => {
        if (shown.has(id)) return false
        shown.add(id)
      })
    })
    return shown
  }, [folderQuery, folders, parentOf])

  const added = [...draft].filter(id => !savedGrants.has(id))
  const removed = [...savedGrants].filter(id => !draft.has(id))
  const hasChanges = added.length > 0 || removed.length > 0
  const selectedTeacher = teachers.find(teacher => teacher.id === teacherId)
  const teachersWithoutFolders = teachers.filter(teacher => !grantCount[teacher.id]).length
  const shownTeachers = teachers.filter(teacher => {
    const query = normalize(teacherQuery.trim())
    return !query || normalize(teacherName(teacher)).includes(query) || normalize(teacher.email).includes(query)
  })

  const isCoveredByParent = (folderId) => {
    let covered = false
    forEachAncestor(parentOf, folderId, id => {
      if (draft.has(id)) {
        covered = true
        return false
      }
    })
    return covered
  }

  const toggleTick = (folderId) => {
    setDraft(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
        return next
      }
      next.add(folderId)
      // The new tick covers everything inside, so drop the ticks below it
      const seen = new Set()
      const stack = [...(childrenOf.get(folderId) || [])]
      while (stack.length > 0) {
        const child = stack.pop()
        if (seen.has(child.id)) continue
        seen.add(child.id)
        next.delete(child.id)
        stack.push(...(childrenOf.get(child.id) || []))
      }
      return next
    })
  }

  const toggleExpanded = (folderId) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const selectTeacher = (id) => {
    if (id === teacherId) return
    if (hasChanges && !window.confirm('Bỏ các thay đổi chưa lưu?')) return
    setError('')
    setTeacherId(id)
  }

  const copyFrom = (otherTeacherId) => {
    if (!otherTeacherId) return
    setDraft(new Set(grants.filter(grant => grant.teacher_id === otherTeacherId).map(grant => grant.folder_id)))
  }

  const close = () => {
    if (hasChanges && !window.confirm('Đóng và bỏ các thay đổi chưa lưu?')) return
    onClose()
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      // 100 ids per request keeps the URL short
      for (let i = 0; i < removed.length; i += 100) {
        const { error } = await supabase
          .from('exercise_folder_access')
          .delete()
          .eq('teacher_id', teacherId)
          .in('folder_id', removed.slice(i, i + 100))
        if (error) throw error
      }
      if (added.length > 0) {
        const { error } = await supabase
          .from('exercise_folder_access')
          .upsert(
            added.map(folderId => ({ folder_id: folderId, teacher_id: teacherId, granted_by: user?.id })),
            { onConflict: 'folder_id,teacher_id', ignoreDuplicates: true }
          )
        if (error) throw error
      }
    } catch (err) {
      console.error('Error saving folder access:', err)
      setError(`Không lưu được: ${err.message}`)
    }
    // Reload either way so the screen shows what is really saved
    try {
      await fetchGrants()
    } catch (err) {
      console.error('Error reloading folder access:', err)
    }
    setSaving(false)
  }

  const renderFolder = (folder, depth) => {
    if (searchMatches && !searchMatches.has(folder.id)) return null
    const children = childrenOf.get(folder.id) || []
    const isOpen = searchMatches ? true : expanded.has(folder.id)
    const ticked = draft.has(folder.id)
    const covered = !ticked && isCoveredByParent(folder.id)
    const insideCount = tickedInside.get(folder.id) || 0

    return (
      <div key={folder.id}>
        <div className="flex items-center gap-1 py-1 pr-2 rounded hover:bg-gray-50" style={{ paddingLeft: depth * 20 + 4 }}>
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => toggleExpanded(folder.id)}
              aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
              className="p-0.5 rounded text-gray-400 hover:text-gray-700"
            >
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-5 flex-shrink-0" />
          )}
          <label className={`flex items-center gap-2 flex-1 min-w-0 ${covered ? 'cursor-default' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={ticked || covered}
              disabled={covered || saving}
              onChange={() => toggleTick(folder.id)}
              className="w-4 h-4 flex-shrink-0 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <Folder className={`w-4 h-4 flex-shrink-0 ${ticked || covered ? 'text-blue-600' : 'text-gray-400'}`} />
            <span className={`text-sm truncate ${ticked ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{folder.name}</span>
            {folder.read_only && <Lock className="w-3 h-3 flex-shrink-0 text-gray-400" />}
            {covered && <span className="text-xs text-gray-400 flex-shrink-0">theo thư mục cha</span>}
            {!isOpen && insideCount > 0 && (
              <span className="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                {insideCount} bên trong
              </span>
            )}
          </label>
        </div>
        {isOpen && children.map(child => renderFolder(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 !mt-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Phân quyền thư mục
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Chọn giáo viên rồi tick những thư mục họ được xem. Tick một thư mục là mở luôn mọi thư mục con bên trong. Admin luôn thấy tất cả.
            </p>
          </div>
          <button onClick={close} aria-label="Đóng" className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {lockOn === false && !loading && !error && (
          <div className="mx-6 mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Khóa chưa bật: giáo viên vẫn thấy mọi thư mục.
              {teachersWithoutFolders > 0 && ` Còn ${teachersWithoutFolders} giáo viên chưa được cấp thư mục nào.`}
              {' '}Cấp quyền cho mọi giáo viên xong thì chạy file SQL lock_exercise_folder_access.sql.
            </span>
          </div>
        )}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col md:flex-row mt-2">
            {/* Teachers */}
            <div className="md:w-72 max-h-56 md:max-h-none flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-gray-200">
              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={teacherQuery}
                    onChange={(e) => setTeacherQuery(e.target.value)}
                    placeholder="Tìm giáo viên…"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {shownTeachers.map(teacher => {
                  const isSelected = teacher.id === teacherId
                  return (
                    <button
                      key={teacher.id}
                      onClick={() => selectTeacher(teacher.id)}
                      className={`w-full text-left px-4 py-2.5 border-b border-gray-50 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                        {teacherName(teacher)}
                      </div>
                      <div className={`text-xs truncate ${grantCount[teacher.id] ? 'text-gray-500' : 'text-amber-600'}`}>
                        {grantCount[teacher.id] ? `${grantCount[teacher.id]} thư mục` : 'Chưa được cấp thư mục nào'}
                      </div>
                    </button>
                  )
                })}
                {shownTeachers.length === 0 && (
                  <p className="p-4 text-sm text-gray-500 text-center">Không có giáo viên nào.</p>
                )}
              </div>
            </div>

            {/* Folders of the selected teacher */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              {!selectedTeacher ? (
                <div className="flex-1 flex items-center justify-center p-6 text-sm text-gray-500 text-center">
                  Chọn một giáo viên ở bên trái để phân quyền.
                </div>
              ) : (
                <>
                  <div className="p-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        value={folderQuery}
                        onChange={(e) => setFolderQuery(e.target.value)}
                        placeholder="Tìm thư mục…"
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <select
                      value=""
                      onChange={(e) => copyFrom(e.target.value)}
                      disabled={saving}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Sao chép quyền từ…</option>
                      {teachers
                        .filter(teacher => teacher.id !== teacherId && grantCount[teacher.id])
                        .map(teacher => (
                          <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}</option>
                        ))}
                    </select>
                    <button
                      onClick={() => setDraft(new Set())}
                      disabled={saving || draft.size === 0}
                      className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Bỏ tick hết
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2">
                    {(childrenOf.get(null) || []).map(folder => renderFolder(folder, 0))}
                    {searchMatches && searchMatches.size === 0 && (
                      <p className="p-4 text-sm text-gray-500 text-center">Không tìm thấy thư mục nào.</p>
                    )}
                  </div>

                  <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-500 truncate">
                      {hasChanges
                        ? `${added.length + removed.length} thay đổi chưa lưu`
                        : `${teacherName(selectedTeacher)}: ${draft.size} thư mục được tick`}
                    </span>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setDraft(new Set(savedGrants))}
                        disabled={!hasChanges || saving}
                        className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        Hoàn tác
                      </button>
                      <button
                        onClick={save}
                        disabled={!hasChanges || saving}
                        className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
                      >
                        {saving ? 'Đang lưu…' : 'Lưu'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FolderAccessManager
