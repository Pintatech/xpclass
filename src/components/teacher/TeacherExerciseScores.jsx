import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { ArrowLeft } from 'lucide-react';

const TeacherExerciseScores = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [units, setUnits] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [students, setStudents] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) loadCourses();
  }, [user]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, level_number')
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .order('level_number');
      if (error) throw error;
      setCourses(data || []);
      if (data?.length) setSelectedCourse(data[0].id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!selectedCourse) return;
      try {
        setLoading(true);
        // Units
        const { data: unitRows, error: unitErr } = await supabase
          .from('units')
          .select('id, title, unit_number')
          .eq('course_id', selectedCourse)
          .order('unit_number');
        if (unitErr) throw unitErr;
        setUnits(unitRows || []);
        setSelectedUnit(unitRows?.[0]?.id || '');
        // Students in course
        const { data: enrollments, error: enrErr } = await supabase
          .from('course_enrollments')
          .select('student_id, users:student_id(id, full_name, email)')
          .eq('course_id', selectedCourse)
          .eq('is_active', true);
        if (enrErr) throw enrErr;
        const list = (enrollments || []).map(e => ({
          id: e.users?.id || e.student_id,
          full_name: e.users?.full_name,
          email: e.users?.email
        }));
        setStudents(list);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [selectedCourse]);

  useEffect(() => {
    const run = async () => {
      if (!selectedUnit) { setSessions([]); setSelectedSession(''); return; }
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('sessions')
          .select('id, title, session_number')
          .eq('unit_id', selectedUnit)
          .order('session_number');
        if (error) throw error;
        setSessions(data || []);
        setSelectedSession(data?.[0]?.id || '');
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [selectedUnit]);

  useEffect(() => {
    const run = async () => {
      if (!selectedSession) { setExercises([]); setSelectedExercise(''); return; }
      try {
        setLoading(true);
        // Use assignments to list exercises for session
        const { data, error } = await supabase
          .from('exercise_assignments')
          .select('exercise:exercises(id, title, exercise_type)')
          .eq('session_id', selectedSession);
        if (error) throw error;
        const list = (data || []).map(a => a.exercise).filter(Boolean);
        setExercises(list);
        setSelectedExercise(list?.[0]?.id || '');
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [selectedSession]);

  useEffect(() => {
    const run = async () => {
      if (!selectedExercise || students.length === 0) { setProgressRows([]); return; }
      try {
        setLoading(true);
        const studentIds = students.map(s => s.id);
        const { data, error } = await supabase
          .from('user_progress')
          .select('user_id, status, score, max_score, attempts, time_spent, completed_at, updated_at')
          .eq('exercise_id', selectedExercise)
          .in('user_id', studentIds);
        if (error) throw error;
        console.log('📊 Progress data for exercise:', selectedExercise, data);
        setProgressRows(data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [selectedExercise, students]);

  const userIdToProgress = useMemo(() => {
    const map = new Map();
    progressRows.forEach(r => map.set(r.user_id, r));
    return map;
  }, [progressRows]);

  const selectedCourseData = courses.find(c => c.id === selectedCourse);
  const selectedExerciseData = exercises.find(e => e.id === selectedExercise);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/teacher')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exercise Scores</h1>
          <p className="text-gray-600">Chọn bài tập để xem điểm của học viên</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
          <select className="w-full border rounded-lg p-2" value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
            {courses.map(c => (
              <option key={c.id} value={c.id}>Course {c.level_number}: {c.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
          <select className="w-full border rounded-lg p-2" value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}>
            {units.map(u => (
              <option key={u.id} value={u.id}>Unit {u.unit_number} — {u.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
          <select className="w-full border rounded-lg p-2" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>Session {s.session_number} — {s.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Exercise</label>
          <select className="w-full border rounded-lg p-2" value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)}>
            {exercises.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.title} ({ex.exercise_type})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Scores</h3>
              {selectedExerciseData && (
                <p className="text-sm text-gray-600">{selectedExerciseData.title} • {selectedExerciseData.exercise_type}</p>
              )}
            </div>
            {loading && <div className="text-sm text-gray-500">Loading...</div>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 text-gray-500 font-medium">Student</th>
                <th className="text-left py-3 px-6 text-gray-500 font-medium">Status</th>
                <th className="text-left py-3 px-6 text-gray-500 font-medium">Score</th>
                <th className="text-left py-3 px-6 text-gray-500 font-medium">Attempts</th>
                <th className="text-left py-3 px-6 text-gray-500 font-medium">Time</th>
                <th className="text-left py-3 px-6 text-gray-500 font-medium">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map(st => {
                const p = userIdToProgress.get(st.id);
                const scorePct = p?.max_score ? Math.round((p.score / p.max_score) * 100) : null;
                console.log(`👤 Student ${st.full_name} progress:`, p);
                return (
                  <tr key={st.id} className="hover:bg-gray-50">
                    <td className="py-3 px-6">
                      <div className="font-medium text-gray-900">{st.full_name || 'No name'}</div>
                      <div className="text-sm text-gray-600">{st.email}</div>
                    </td>
                    <td className="py-3 px-6 text-sm">{p?.status || '—'}</td>
                    <td className="py-3 px-6 text-sm">{scorePct !== null ? `${scorePct}%` : '—'}</td>
                    <td className="py-3 px-6 text-sm">
                      {p?.attempts ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {p.attempts} attempt{p.attempts !== 1 ? 's' : ''}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-6 text-sm">{p?.time_spent ? Math.round((p.time_spent || 0)/60)+'m' : '—'}</td>
                    <td className="py-3 px-6 text-sm">{p?.completed_at ? new Date(p.completed_at).toLocaleString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}
    </div>
  );
};

export default TeacherExerciseScores;



