import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, Settings } from 'lucide-react';
import { supabase } from '../../supabase/client';
import { fetchOpenableFolderIds } from '../../utils/exerciseBankAccess';
import FolderShortcutsManager from './FolderShortcutsManager';

/**
 * Row of Exercise Bank folder shortcuts on the teacher dashboard.
 * Admins choose the folders (the same for every teacher); teachers just click.
 */
const FolderShortcuts = ({ isAdmin = false }) => {
  const navigate = useNavigate();
  const [shortcuts, setShortcuts] = useState([]);
  const [reachableFolderIds, setReachableFolderIds] = useState(null); // null: every folder can be reached
  const [loaded, setLoaded] = useState(false);
  const [showManager, setShowManager] = useState(false);

  const fetchShortcuts = async () => {
    const { data, error } = await supabase
      .from('teacher_folder_shortcuts')
      .select('id, folder_id, label, sort_order')
      .order('sort_order')
      .order('created_at');
    if (error) {
      console.error('Error fetching folder shortcuts:', error);
    } else {
      setShortcuts(data || []);
    }
  };

  // Folders the teacher can reach: the ones they may open and every parent of those.
  // A shortcut to a parent leads to the folders inside it that the teacher may open.
  const fetchReachableFolderIds = async () => {
    const openable = await fetchOpenableFolderIds();
    if (!openable) return null;
    // With the lock on, teachers get back exactly those folders
    const { data, error } = await supabase.from('exercise_folders').select('id');
    if (error) {
      console.error('Error fetching folders:', error);
      return openable;
    }
    return new Set((data || []).map(folder => folder.id));
  };

  useEffect(() => {
    const load = async () => {
      const [, reachable] = await Promise.all([fetchShortcuts(), fetchReachableFolderIds()]);
      setReachableFolderIds(reachable);
      setLoaded(true);
    };
    load();
  }, []);

  // Hide shortcuts to folders the teacher cannot reach at all
  const visibleShortcuts = reachableFolderIds
    ? shortcuts.filter(shortcut => reachableFolderIds.has(shortcut.folder_id))
    : shortcuts;

  // Teachers see nothing until an admin adds a shortcut they can use
  if (!loaded || (!isAdmin && visibleShortcuts.length === 0)) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-500">Lối tắt:</span>
        {visibleShortcuts.map(shortcut => (
          <button
            key={shortcut.id}
            onClick={() => navigate(`/teacher/exercise-bank?folder=${shortcut.folder_id}`)}
            title={shortcut.label}
            className="flex items-center gap-2 max-w-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg shadow-sm hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors text-sm font-medium"
          >
            <FolderOpen className="w-4 h-4 flex-shrink-0 text-blue-600" />
            <span className="truncate">{shortcut.label}</span>
          </button>
        ))}
        {isAdmin && (shortcuts.length === 0 ? (
          <button
            onClick={() => setShowManager(true)}
            className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Thêm lối tắt
          </button>
        ) : (
          <button
            onClick={() => setShowManager(true)}
            title="Quản lý lối tắt"
            aria-label="Quản lý lối tắt"
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        ))}
      </div>

      {showManager && (
        <FolderShortcutsManager
          shortcuts={shortcuts}
          onChanged={fetchShortcuts}
          onClose={() => setShowManager(false)}
        />
      )}
    </div>
  );
};

export default FolderShortcuts;
