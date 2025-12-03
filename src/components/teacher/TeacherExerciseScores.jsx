import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { ArrowLeft, Eye, X, CheckCircle, XCircle } from 'lucide-react';

const TeacherExerciseScores = () => {
  const { user, isAdmin } = useAuth();
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
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentAttempts, setStudentAttempts] = useState([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  useEffect(() => {
    if (user) loadCourses();
  }, [user]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('courses')
        .select('id, title, level_number, teacher_id')
        .eq('is_active', true)
        .order('level_number');

      // If user is admin, fetch all courses. Otherwise, fetch only teacher's courses
      if (!isAdmin()) {
        query = query.eq('teacher_id', user.id);
      }

      const { data, error } = await query;
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
    // Since backend now handles best score logic, we can use simple mapping
    progressRows.forEach(r => map.set(r.user_id, r));
    return map;
  }, [progressRows]);

  const selectedCourseData = courses.find(c => c.id === selectedCourse);
  const selectedExerciseData = exercises.find(e => e.id === selectedExercise);

  const fetchStudentAttempts = async (studentId, studentName) => {
    if (!selectedExercise) return;

    setLoadingAttempts(true);
    setSelectedStudent({ id: studentId, name: studentName });

    try {
      // Fetch question attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('question_attempts')
        .select('*')
        .eq('user_id', studentId)
        .eq('exercise_id', selectedExercise)
        .order('created_at', { ascending: false });

      if (attemptsError) throw attemptsError;

      // Fetch exercise content to get actual questions
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercises')
        .select('content')
        .eq('id', selectedExercise)
        .single();

      if (exerciseError) throw exerciseError;

      // Group by question_id to show latest attempt
      const latestAttempts = {};
      (attemptsData || []).forEach(attempt => {
        if (!latestAttempts[attempt.question_id] ||
            new Date(attempt.created_at) > new Date(latestAttempts[attempt.question_id].created_at)) {
          latestAttempts[attempt.question_id] = attempt;
        }
      });

      // Match attempts with actual question text from exercise content
      const attemptsWithQuestions = Object.values(latestAttempts).map(attempt => {
        let questionText = 'Question not found';

        // Try to find the question in exercise content
        if (exerciseData?.content?.questions) {
          const question = exerciseData.content.questions.find(q => q.id === attempt.question_id);
          if (question) {
            // Remove HTML tags and trim for cleaner display
            questionText = question.question?.replace(/<[^>]*>/g, '').trim() || question.question || 'Question not found';
          }
        }

        return {
          ...attempt,
          questionText
        };
      });

      setStudentAttempts(attemptsWithQuestions);
    } catch (err) {
      console.error('Error fetching student attempts:', err);
      setError(err.message);
    } finally {
      setLoadingAttempts(false);
    }
  };

  const closeModal = () => {
    setSelectedStudent(null);
    setStudentAttempts([]);
  };

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
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin() ? 'Admin Exercise Scores' : 'Exercise Scores'}
          </h1>
          <p className="text-gray-600">
            {isAdmin() 
              ? 'View exercise scores across all courses' 
              : 'Chọn bài tập để xem điểm của học viên'
            }
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
          <select className="w-full border rounded-lg p-2" value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                Course {c.level_number}: {c.title}
                {isAdmin() && c.teacher_id !== user.id ? ' (Other Teacher)' : ''}
              </option>
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
                <th className="text-left py-3 px-6 text-gray-500 font-medium">Actions</th>
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
                    <td className="py-3 px-6 text-sm">
                      {p && (
                        <button
                          onClick={() => fetchStudentAttempts(st.id, st.full_name)}
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
                          title="View detailed attempts"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Details</span>
                        </button>
                      )}
                    </td>
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

      {/* Student Attempts Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Question Attempts</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedStudent.name} • {selectedExerciseData?.title}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {loadingAttempts ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="ml-3 text-gray-600">Loading attempts...</p>
                </div>
              ) : studentAttempts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">No question attempts found for this student.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-gray-600">Correct</span>
                      </div>
                      <p className="text-2xl font-bold text-green-700 mt-1">
                        {studentAttempts.filter(a => a.is_correct).length}
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="text-sm text-gray-600">Incorrect</span>
                      </div>
                      <p className="text-2xl font-bold text-red-700 mt-1">
                        {studentAttempts.filter(a => !a.is_correct).length}
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Accuracy</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700 mt-1">
                        {Math.round((studentAttempts.filter(a => a.is_correct).length / studentAttempts.length) * 100)}%
                      </p>
                    </div>
                  </div>

                  {/* Questions List */}
                  <div className="space-y-3">
                    {studentAttempts.map((attempt, index) => (
                      <div
                        key={attempt.id}
                        className={`border-2 rounded-lg p-4 ${
                          attempt.is_correct
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              {attempt.is_correct ? (
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                              )}
                              <h4 className="font-semibold text-gray-900">
                                Question {index + 1}
                              </h4>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                attempt.is_correct
                                  ? 'bg-green-200 text-green-800'
                                  : 'bg-red-200 text-red-800'
                              }`}>
                                {attempt.is_correct ? 'Correct' : 'Incorrect'}
                              </span>
                            </div>

                            <div className="ml-7 space-y-2">
                              {attempt.questionText && (
                                <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded">
                                  <p className="text-sm font-medium text-gray-700 mb-1">Question:</p>
                                  <p className="text-sm text-gray-900">{attempt.questionText}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium text-gray-700">Student's Answer:</p>
                                <p className={`text-sm ${
                                  attempt.is_correct ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {attempt.selected_answer || 'No answer'}
                                </p>
                              </div>

                              {!attempt.is_correct && (
                                <div>
                                  <p className="text-sm font-medium text-gray-700">Correct Answer:</p>
                                  <p className="text-sm text-green-700">
                                    {attempt.correct_answer}
                                  </p>
                                </div>
                              )}

                              <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                                {attempt.response_time && (
                                  <span>Response time: {(attempt.response_time / 1000).toFixed(1)}s</span>
                                )}
                                {attempt.attempt_number && (
                                  <span>Attempt #{attempt.attempt_number}</span>
                                )}
                                {attempt.created_at && (
                                  <span>{new Date(attempt.created_at).toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherExerciseScores;



