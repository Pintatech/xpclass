import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, FolderOpen, Pencil, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../../supabase/client';

const EMPTY_FORM = { folderId: '', label: '' };

// Folders in tree order, each with its full path, e.g. "Starters / Đề KT tháng 11"
const buildFolderOptions = (folders) => {
  const childrenOf = {};
  folders.forEach(folder => {
    const parentKey = folder.parent_folder_id || 'root';
    (childrenOf[parentKey] = childrenOf[parentKey] || []).push(folder);
  });

  const options = [];
  const addChildren = (parentKey, parentPath) => {
    (childrenOf[parentKey] || [])
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name))
      .forEach(folder => {
        const path = parentPath ? `${parentPath} / ${folder.name}` : folder.name;
        options.push({ id: folder.id, name: folder.name, path });
        addChildren(folder.id, path);
      });
  };
  addChildren('root', '');
  return options;
};

// Folder picker + button label. Picking a folder fills in its name, unless the admin typed their own label.
const ShortcutFields = ({ folderOptions, value, onChange, disabled }) => {
  const nameOf = (folderId) => folderOptions.find(folder => folder.id === folderId)?.name || '';

  const pickFolder = (folderId) => {
    const hasCustomLabel = value.label.trim() !== '' && value.label !== nameOf(value.folderId);
    onChange({ folderId, label: hasCustomLabel ? value.label : nameOf(folderId) });
  };

  return (
    <>
      <select
        value={value.folderId}
        onChange={(e) => pickFolder(e.target.value)}
        disabled={disabled}
        className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">Chọn thư mục…</option>
        {folderOptions.map(folder => (
          <option key={folder.id} value={folder.id}>{folder.path}</option>
        ))}
      </select>
      <input
        type="text"
        value={value.label}
        onChange={(e) => onChange({ ...value, label: e.target.value })}
        disabled={disabled}
        maxLength={60}
        placeholder="Tên nút"
        className="sm:w-52 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </>
  );
};

/**
 * Admin popup to add, rename, reorder and delete the folder shortcuts on the teacher dashboard.
 */
const FolderShortcutsManager = ({ shortcuts, onChanged, onClose }) => {
  const [folders, setFolders] = useState(null); // null while loading
  const [newShortcut, setNewShortcut] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchFolders = async () => {
      const { data, error } = await supabase
        .from('exercise_folders')
        .select('id, name, parent_folder_id, sort_order');
      if (error) {
        console.error('Error fetching folders:', error);
        setError(`Không tải được danh sách thư mục: ${error.message}`);
      }
      setFolders(data || []);
    };
    fetchFolders();
  }, []);

  const folderOptions = useMemo(() => buildFolderOptions(folders || []), [folders]);
  const pathById = useMemo(
    () => Object.fromEntries(folderOptions.map(folder => [folder.id, folder.path])),
    [folderOptions]
  );

  // Runs one change, then reloads the list so it shows what is really saved. Returns true on success.
  const runChange = async (change, failMessage) => {
    setBusy(true);
    setError('');
    let ok = true;
    try {
      const { error } = await change();
      if (error) throw error;
    } catch (err) {
      console.error(failMessage, err);
      setError(`${failMessage}: ${err.message || 'lỗi không xác định'}`);
      ok = false;
    }
    await onChanged();
    setBusy(false);
    return ok;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const label = newShortcut.label.trim();
    if (!newShortcut.folderId || !label) return;
    const nextOrder = shortcuts.reduce((max, shortcut) => Math.max(max, shortcut.sort_order), -1) + 1;
    const ok = await runChange(
      () => supabase
        .from('teacher_folder_shortcuts')
        .insert({ folder_id: newShortcut.folderId, label, sort_order: nextOrder }),
      'Không thêm được lối tắt'
    );
    if (ok) setNewShortcut(EMPTY_FORM);
  };

  const startEdit = (shortcut) => {
    setError('');
    setEditingId(shortcut.id);
    setEditForm({ folderId: shortcut.folder_id, label: shortcut.label });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const label = editForm.label.trim();
    if (!editForm.folderId || !label) return;
    const ok = await runChange(
      () => supabase
        .from('teacher_folder_shortcuts')
        .update({ folder_id: editForm.folderId, label })
        .eq('id', editingId),
      'Không lưu được thay đổi'
    );
    if (ok) setEditingId(null);
  };

  const handleDelete = (shortcut) => {
    if (!window.confirm(`Xóa lối tắt "${shortcut.label}"?`)) return;
    runChange(
      () => supabase.from('teacher_folder_shortcuts').delete().eq('id', shortcut.id),
      'Không xóa được lối tắt'
    );
  };

  const handleMove = (index, step) => {
    const reordered = [...shortcuts];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(index + step, 0, moved);
    runChange(async () => {
      // Renumber 0..n-1 so the saved order matches the list
      const updates = [];
      reordered.forEach((shortcut, position) => {
        if (shortcut.sort_order !== position) {
          updates.push(
            supabase.from('teacher_folder_shortcuts').update({ sort_order: position }).eq('id', shortcut.id)
          );
        }
      });
      const results = await Promise.all(updates);
      return { error: results.find(result => result.error)?.error };
    }, 'Không đổi được thứ tự');
  };

  return (
    <div className="fixed inset-0 !mt-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Lối tắt thư mục</h2>
            <p className="text-sm text-gray-500 mt-1">
              Các nút này hiện trên trang teacher cho mọi giáo viên. Bấm vào sẽ mở thẳng thư mục đó trong Exercise Bank.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Current shortcuts */}
          {shortcuts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Chưa có lối tắt nào.</p>
          ) : (
            <ul className="border border-gray-200 rounded-lg divide-y divide-gray-200">
              {shortcuts.map((shortcut, index) => (
                <li key={shortcut.id} className="p-3">
                  {editingId === shortcut.id ? (
                    <form onSubmit={handleSaveEdit} className="flex flex-col sm:flex-row gap-2">
                      <ShortcutFields
                        folderOptions={folderOptions}
                        value={editForm}
                        onChange={setEditForm}
                        disabled={busy}
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busy || !editForm.folderId || !editForm.label.trim()}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={busy}
                          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                        >
                          Hủy
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button
                          onClick={() => handleMove(index, -1)}
                          disabled={busy || index === 0}
                          title="Lên trên"
                          aria-label="Lên trên"
                          className="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMove(index, 1)}
                          disabled={busy || index === shortcuts.length - 1}
                          title="Xuống dưới"
                          aria-label="Xuống dưới"
                          className="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                      <FolderOpen className="w-5 h-5 flex-shrink-0 text-blue-600" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{shortcut.label}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {pathById[shortcut.folder_id] || (folders ? 'Không tìm thấy thư mục' : 'Đang tải…')}
                        </div>
                      </div>
                      <button
                        onClick={() => startEdit(shortcut)}
                        disabled={busy}
                        title="Sửa"
                        aria-label="Sửa"
                        className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(shortcut)}
                        disabled={busy}
                        title="Xóa"
                        aria-label="Xóa"
                        className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Add a shortcut */}
          <form onSubmit={handleAdd} className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Thêm lối tắt</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <ShortcutFields
                folderOptions={folderOptions}
                value={newShortcut}
                onChange={setNewShortcut}
                disabled={busy || !folders}
              />
              <button
                type="submit"
                disabled={busy || !newShortcut.folderId || !newShortcut.label.trim()}
                className="flex items-center justify-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Thêm
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FolderShortcutsManager;
