import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { X, Shuffle, Swords, ArrowLeftRight, Users } from 'lucide-react';

const ClassWarSetupModal = ({ courseId, onClose, onStarted }) => {
  const { user } = useAuth();
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [teamAMembers, setTeamAMembers] = useState([]);
  const [teamBMembers, setTeamBMembers] = useState([]);
  const [teamAName, setTeamAName] = useState('Red Team');
  const [teamBName, setTeamBName] = useState('Blue Team');
  const [warName, setWarName] = useState('Class War');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('student_id, users:student_id(id, full_name, real_name, avatar_url)')
        .eq('course_id', courseId)
        .eq('is_active', true);
      const students = (enrollments || []).map(e => e.users).filter(Boolean);
      setEnrolledStudents(students);
      setLoading(false);
    };
    fetchStudents();
  }, [courseId]);

  const shuffleTeams = () => {
    const students = [...enrolledStudents];
    for (let i = students.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [students[i], students[j]] = [students[j], students[i]];
    }
    const mid = Math.ceil(students.length / 2);
    setTeamAMembers(students.slice(0, mid));
    setTeamBMembers(students.slice(mid));
  };

  const moveToTeam = (student, fromTeam) => {
    if (fromTeam === 'A') {
      setTeamAMembers(prev => prev.filter(s => s.id !== student.id));
      setTeamBMembers(prev => [...prev, student]);
    } else {
      setTeamBMembers(prev => prev.filter(s => s.id !== student.id));
      setTeamAMembers(prev => [...prev, student]);
    }
  };

  const handleStart = async () => {
    if (teamAMembers.length === 0 || teamBMembers.length === 0) return;
    setSaving(true);
    try {
      const { data: warData, error: warError } = await supabase
        .from('class_wars')
        .insert({
          course_id: courseId,
          name: warName,
          team_a_name: teamAName,
          team_b_name: teamBName,
          status: 'active',
          created_by: user.id,
        })
        .select()
        .single();
      if (warError) throw warError;

      const members = [
        ...teamAMembers.map(s => ({ war_id: warData.id, user_id: s.id, team: 'A' })),
        ...teamBMembers.map(s => ({ war_id: warData.id, user_id: s.id, team: 'B' })),
      ];
      const { error: membersError } = await supabase.from('class_war_members').insert(members);
      if (membersError) throw membersError;

      onStarted?.();
      onClose();
    } catch (err) {
      console.error('Error starting war:', err);
      alert('Failed to start war: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const renderTeamCol = (name, setName, members, teamKey, colors) => (
    <div className={`flex-1 border ${colors.border} rounded-xl overflow-hidden`}>
      <div className={`${colors.bg} px-3 py-2`}>
        <input value={name} onChange={e => setName(e.target.value)}
          className="bg-transparent border-b border-white/30 text-white font-bold text-sm w-full outline-none placeholder-white/50"
          placeholder="Team name..." />
        <div className="text-xs text-white/70 mt-0.5">{members.length} members</div>
      </div>
      <div className="p-2 space-y-1 max-h-60 overflow-y-auto bg-white">
        {members.length === 0 && <p className="text-xs text-gray-400 text-center py-3">No members</p>}
        {members.map(s => (
          <div key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 group">
            <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden shrink-0">
              {s.avatar_url ? (
                <img src={s.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-500">
                  {(s.real_name || s.full_name || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <span className="flex-1 text-xs text-gray-700 truncate">{s.real_name || s.full_name}</span>
            <button onClick={() => moveToTeam(s, teamKey)}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 rounded transition-all"
              title="Swap team">
              <ArrowLeftRight className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-purple-600 to-blue-600 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5" />
            <span className="font-bold">Start Class War</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">War Name</label>
                  <input value={warName} onChange={e => setWarName(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56" placeholder="Class War" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {enrolledStudents.length} students
                  </span>
                  <button onClick={shuffleTeams} disabled={enrolledStudents.length < 2}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50">
                    <Shuffle className="w-3.5 h-3.5" /> Shuffle
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                {renderTeamCol(teamAName, setTeamAName, teamAMembers, 'A', {
                  bg: 'bg-gradient-to-r from-red-600 to-red-500', border: 'border-red-200',
                })}
                {renderTeamCol(teamBName, setTeamBName, teamBMembers, 'B', {
                  bg: 'bg-gradient-to-r from-blue-600 to-blue-500', border: 'border-blue-200',
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={handleStart}
            disabled={saving || teamAMembers.length === 0 || teamBMembers.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 text-white font-bold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 shadow">
            <Swords className="w-4 h-4" /> Start War!
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassWarSetupModal;
