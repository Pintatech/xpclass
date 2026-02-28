import { useState, useEffect } from 'react';
import { supabase } from '../../../supabase/client';
import { Users } from 'lucide-react';

const gradeOptions = [
  { value: 'wow', label: 'Wow', color: 'bg-green-500 text-white', inactive: 'bg-white text-green-700 border border-green-300 hover:bg-green-100' },
  { value: 'good', label: 'Good', color: 'bg-yellow-500 text-white', inactive: 'bg-white text-yellow-700 border border-yellow-300 hover:bg-yellow-100' },
  { value: 'ok', label: 'Ok', color: 'bg-red-500 text-white', inactive: 'bg-white text-red-700 border border-red-300 hover:bg-red-100' },
];

const HomeworkReportView = ({ students, courseId, records, onChange, onMarkAll, loading: externalLoading }) => {
  const [mode, setMode] = useState('course');
  const [sessions, setSessions] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (courseId && mode === 'course') loadSessions();
  }, [courseId, mode]);

  useEffect(() => {
    if (selectedSession) loadExercises(selectedSession);
    else { setExercises([]); setSelectedExercise(''); }
  }, [selectedSession]);

  useEffect(() => {
    if (selectedExercise && students.length > 0) loadProgress(selectedExercise);
    else setProgress({});
  }, [selectedExercise, students]);

  const loadSessions = async () => {
    const { data: units } = await supabase
      .from('units')
      .select('id, unit_number, title')
      .eq('course_id', courseId)
      .eq('is_active', true)
      .order('unit_number');

    if (!units || units.length === 0) { setSessions([]); return; }

    const { data: sessionsData } = await supabase
      .from('sessions')
      .select('id, unit_id, session_number, title')
      .in('unit_id', units.map(u => u.id))
      .eq('is_active', true)
      .order('session_number');

    const list = (sessionsData || []).map(s => {
      const unit = units.find(u => u.id === s.unit_id);
      return { ...s, display: `Unit ${unit?.unit_number} - Session ${s.session_number}: ${s.title}` };
    });
    setSessions(list);
  };

  const loadExercises = async (sessionId) => {
    const { data: assignments } = await supabase
      .from('exercise_assignments')
      .select('exercise:exercises(id, title, exercise_type)')
      .eq('session_id', sessionId)
      .order('order_index');

    const list = (assignments || []).filter(a => a.exercise).map(a => a.exercise);
    setExercises(list);
    setSelectedExercise('');
  };

  const scoreToGrade = (p) => {
    if (!p || p.status === 'in_progress') return 'ok';
    const pct = p.max_score > 0 ? Math.round((p.score / p.max_score) * 100) : 0;
    if (pct >= 80) return 'wow';
    if (pct > 0) return 'good';
    return 'ok';
  };

  const loadProgress = async (exerciseId) => {
    setLoading(true);
    const { data } = await supabase
      .from('user_progress')
      .select('user_id, status, score, max_score, attempts, completed_at')
      .eq('exercise_id', exerciseId)
      .in('user_id', students.map(s => s.id));

    const map = {};
    (data || []).forEach(p => { map[p.user_id] = p; });
    setProgress(map);

    // Auto-fill homework_status from scores
    students.forEach(s => {
      const grade = scoreToGrade(map[s.id]);
      onChange(s.id, { homework_status: grade });
    });

    setLoading(false);
  };

  if (externalLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setMode('course')}
          className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
            mode === 'course'
              ? 'bg-blue-50 border-blue-500 text-blue-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          From Course
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-blue-50 border-blue-500 text-blue-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Hand Graded
        </button>
      </div>

      {/* Course Mode */}
      {mode === 'course' && (
        <>
          <div className="bg-white rounded-lg shadow-sm border p-4 flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select session...</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.display}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Exercise</label>
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                disabled={!selectedSession}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select exercise...</option>
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.title}</option>
                ))}
              </select>
            </div>
          </div>

          {!selectedExercise ? (
            <div className="p-8 text-center text-gray-500">
              Select a session and exercise to view student grades.
            </div>
          ) : loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading grades...</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border">
              {students.map(student => {
                const p = progress[student.id];
                const record = records[student.id] || {};
                const grade = record.homework_status || '';
                const pct = p && p.max_score > 0 ? Math.round((p.score / p.max_score) * 100) : null;

                return (
                  <div key={student.id} className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        {student.avatar_url ? (
                          <img src={student.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <span className="text-blue-600 font-semibold">
                            {student.full_name?.charAt(0).toUpperCase() || 'S'}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900">{student.full_name}</p>
                      {pct !== null && (
                        <span className="text-sm text-gray-400">{pct}%</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <input
                        type="text"
                        placeholder="Feedback..."
                        value={record.homework_notes || ''}
                        onChange={(e) => onChange(student.id, { homework_notes: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-2 w-48 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-1">
                        {gradeOptions.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => onChange(student.id, { homework_status: opt.value })}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              grade === opt.value ? opt.color : opt.inactive
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Mark All Buttons */}
      <div className="flex flex-wrap gap-2">
        {gradeOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => onMarkAll(opt.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${opt.inactive}`}
          >
            Mark All {opt.label}
          </button>
        ))}
      </div>

      {/* Manual / Hand Graded Mode */}
      {mode === 'manual' && (
        <div className="bg-white rounded-lg shadow-sm border">
          {students.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Students Enrolled</h3>
            </div>
          ) : (
            <div>
              {students.map(student => {
                const record = records[student.id] || {};
                const grade = record.homework_status || '';

                return (
                  <div key={student.id} className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        {student.avatar_url ? (
                          <img src={student.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <span className="text-blue-600 font-semibold">
                            {student.full_name?.charAt(0).toUpperCase() || 'S'}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900">{student.full_name}</p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <input
                        type="text"
                        placeholder="Feedback..."
                        value={record.homework_notes || ''}
                        onChange={(e) => onChange(student.id, { homework_notes: e.target.value })}
                        className="border border-gray-300 rounded-lg px-3 py-2 w-48 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-1">
                        {gradeOptions.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => onChange(student.id, { homework_status: opt.value })}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              grade === opt.value ? opt.color : opt.inactive
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HomeworkReportView;
