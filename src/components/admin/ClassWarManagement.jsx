import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { Swords, Shuffle, Play, Square, ArrowLeftRight, Trophy, Users, RefreshCw } from 'lucide-react';

const ClassWarManagement = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [activeWar, setActiveWar] = useState(null);
  const [teamAMembers, setTeamAMembers] = useState([]);
  const [teamBMembers, setTeamBMembers] = useState([]);
  const [teamAName, setTeamAName] = useState('Red Team');
  const [teamBName, setTeamBName] = useState('Blue Team');
  const [warName, setWarName] = useState('Class War');
  const [pastWars, setPastWars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Fetch courses
  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, level_number')
        .eq('is_active', true)
        .order('level_number');
      setCourses(data || []);
    };
    fetchCourses();
  }, []);

  // Fetch data when course is selected
  useEffect(() => {
    if (!selectedCourse) return;
    fetchCourseData();
  }, [selectedCourse]);

  const fetchCourseData = async () => {
    setLoading(true);
    try {
      // Fetch enrolled students
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('student_id, users:student_id(id, full_name, real_name, avatar_url)')
        .eq('course_id', selectedCourse)
        .eq('is_active', true);
      setEnrolledStudents((enrollments || []).map(e => e.users).filter(Boolean));

      // Fetch active war
      const { data: warData } = await supabase
        .from('class_wars')
        .select('*')
        .eq('course_id', selectedCourse)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (warData) {
        setActiveWar(warData);
        setWarName(warData.name || 'Class War');
        setTeamAName(warData.team_a_name);
        setTeamBName(warData.team_b_name);

        // Fetch team members
        const { data: members } = await supabase
          .from('class_war_members')
          .select('user_id, team, users:user_id(id, full_name, real_name, avatar_url)')
          .eq('war_id', warData.id);

        setTeamAMembers((members || []).filter(m => m.team === 'A').map(m => m.users).filter(Boolean));
        setTeamBMembers((members || []).filter(m => m.team === 'B').map(m => m.users).filter(Boolean));
      } else {
        setActiveWar(null);
        setTeamAMembers([]);
        setTeamBMembers([]);
        setTeamAName('Red Team');
        setTeamBName('Blue Team');
        setWarName('Class War');
      }

      // Fetch past wars
      const { data: past } = await supabase
        .from('class_wars')
        .select('*')
        .eq('course_id', selectedCourse)
        .eq('status', 'ended')
        .order('ended_at', { ascending: false })
        .limit(10);
      setPastWars(past || []);
    } catch (err) {
      console.error('Error fetching course data:', err);
      showNotification('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const shuffleTeams = () => {
    const students = [...enrolledStudents];
    // Fisher-Yates shuffle
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

  const handleStartWar = async () => {
    if (teamAMembers.length === 0 || teamBMembers.length === 0) {
      showNotification('Both teams need at least one member', 'error');
      return;
    }

    setSaving(true);
    try {
      // Create the war
      const { data: warData, error: warError } = await supabase
        .from('class_wars')
        .insert({
          course_id: selectedCourse,
          name: warName,
          team_a_name: teamAName,
          team_b_name: teamBName,
          status: 'active',
          created_by: user.id,
        })
        .select()
        .single();

      if (warError) throw warError;

      // Insert team members
      const members = [
        ...teamAMembers.map(s => ({ war_id: warData.id, user_id: s.id, team: 'A' })),
        ...teamBMembers.map(s => ({ war_id: warData.id, user_id: s.id, team: 'B' })),
      ];

      const { error: membersError } = await supabase
        .from('class_war_members')
        .insert(members);

      if (membersError) throw membersError;

      setActiveWar(warData);
      showNotification('Class War started!');
    } catch (err) {
      console.error('Error starting war:', err);
      showNotification('Failed to start war: ' + (err.message || err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEndWar = async () => {
    if (!activeWar) return;
    if (!window.confirm('End this Class War? This cannot be undone.')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('class_wars')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', activeWar.id);

      if (error) throw error;

      showNotification('Class War ended!');
      fetchCourseData();
    } catch (err) {
      console.error('Error ending war:', err);
      showNotification('Failed to end war', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTeams = async () => {
    if (!activeWar) return;
    setSaving(true);
    try {
      // Update war names
      await supabase
        .from('class_wars')
        .update({ name: warName, team_a_name: teamAName, team_b_name: teamBName })
        .eq('id', activeWar.id);

      // Delete existing members and re-insert
      await supabase
        .from('class_war_members')
        .delete()
        .eq('war_id', activeWar.id);

      const members = [
        ...teamAMembers.map(s => ({ war_id: activeWar.id, user_id: s.id, team: 'A' })),
        ...teamBMembers.map(s => ({ war_id: activeWar.id, user_id: s.id, team: 'B' })),
      ];

      if (members.length > 0) {
        await supabase.from('class_war_members').insert(members);
      }

      showNotification('Teams updated!');
    } catch (err) {
      console.error('Error updating teams:', err);
      showNotification('Failed to update teams', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderTeamColumn = (teamLabel, teamName, setTeamName, members, teamKey, themeColors) => (
    <div className={`flex-1 border ${themeColors.border} rounded-xl overflow-hidden`}>
      <div className={`${themeColors.bg} px-4 py-3`}>
        <input
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          className={`bg-transparent border-b ${themeColors.inputBorder} text-white font-bold text-sm w-full outline-none placeholder-white/50`}
          placeholder="Team name..."
        />
        <div className="text-xs text-white/70 mt-1">{members.length} members</div>
      </div>
      <div className="p-3 space-y-1 max-h-80 overflow-y-auto bg-white">
        {members.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No members</p>
        )}
        {members.map(student => (
          <div key={student.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 group">
            <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden shrink-0">
              {student.avatar_url ? (
                <img src={student.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                  {(student.real_name || student.full_name || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <span className="flex-1 text-sm text-gray-700 truncate">{student.real_name || student.full_name}</span>
            <button
              onClick={() => moveToTeam(student, teamKey)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
              title={`Move to ${teamKey === 'A' ? teamBName : teamAName}`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm ${
          notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        }`}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Swords className="w-6 h-6 text-orange-500" />
        <h2 className="text-xl font-bold text-gray-900">Class War Management</h2>
      </div>

      {/* Course selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Course</label>
        <select
          value={selectedCourse || ''}
          onChange={e => setSelectedCourse(e.target.value || null)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">-- Choose a course --</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>
              Level {c.level_number}: {c.title}
            </option>
          ))}
        </select>
      </div>

      {selectedCourse && !loading && (
        <>
          {/* Active war or create new */}
          <div className="bg-white border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                {activeWar ? (
                  <>
                    <Play className="w-4 h-4 text-green-500" />
                    Active War: {activeWar.name}
                  </>
                ) : (
                  <>
                    <Swords className="w-4 h-4 text-gray-400" />
                    Create New War
                  </>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {!activeWar && (
                  <button
                    onClick={shuffleTeams}
                    disabled={enrolledStudents.length < 2}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Shuffle Teams
                  </button>
                )}
                {activeWar && (
                  <>
                    <button
                      onClick={shuffleTeams}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      Reshuffle
                    </button>
                    <button
                      onClick={handleUpdateTeams}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Save Changes
                    </button>
                    <button
                      onClick={handleEndWar}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      <Square className="w-3.5 h-3.5" />
                      End War
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* War name */}
            {!activeWar && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">War Name</label>
                <input
                  value={warName}
                  onChange={e => setWarName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64"
                  placeholder="Class War"
                />
              </div>
            )}

            {/* Enrolled count */}
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
              <Users className="w-4 h-4" />
              <span>{enrolledStudents.length} enrolled students</span>
            </div>

            {/* Team columns */}
            <div className="flex gap-4">
              {renderTeamColumn('Team A', teamAName, setTeamAName, teamAMembers, 'A', {
                bg: 'bg-gradient-to-r from-red-600 to-red-500',
                border: 'border-red-200',
                inputBorder: 'border-white/30',
              })}
              {renderTeamColumn('Team B', teamBName, setTeamBName, teamBMembers, 'B', {
                bg: 'bg-gradient-to-r from-blue-600 to-blue-500',
                border: 'border-blue-200',
                inputBorder: 'border-white/30',
              })}
            </div>

            {/* Start button */}
            {!activeWar && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleStartWar}
                  disabled={saving || teamAMembers.length === 0 || teamBMembers.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg"
                >
                  <Swords className="w-5 h-5" />
                  Start Class War!
                </button>
              </div>
            )}
          </div>

          {/* Past wars */}
          {pastWars.length > 0 && (
            <div className="bg-white border rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-yellow-500" />
                Past Wars
              </h3>
              <div className="space-y-2">
                {pastWars.map(war => (
                  <div key={war.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium text-sm text-gray-900">{war.name}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {war.team_a_name} vs {war.team_b_name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {war.ended_at ? new Date(war.ended_at).toLocaleDateString() : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        </div>
      )}
    </div>
  );
};

export default ClassWarManagement;
