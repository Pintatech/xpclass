import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { CheckCircle, XCircle, Clock, Minus, RotateCcw, Eye, X, ChevronDown } from 'lucide-react';

const StudentExerciseMatrix = ({ selectedCourse }) => {
  const { user, isAdmin } = useAuth();
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('all');
  const [students, setStudents] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [progressMatrix, setProgressMatrix] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [questionAttempts, setQuestionAttempts] = useState([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [averageMode, setAverageMode] = useState('all'); // 'all' or 'attempted'
  const [allExercisesFetched, setAllExercisesFetched] = useState(false);

  useEffect(() => {
    if (selectedCourse) {
      fetchUnits();
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedUnit !== 'all') {
      fetchSessions();
    } else {
      setSessions([]);
      setSelectedSession('all');
    }
  }, [selectedUnit]);

  useEffect(() => {
    if (selectedCourse) {
      setShowAllExercises(false);
      setAllExercisesFetched(false);
      fetchMatrixData(15);
    }
  }, [selectedCourse, selectedUnit, selectedSession]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('id, title, unit_number')
        .eq('course_id', selectedCourse)
        .order('unit_number');

      if (error) throw error;

      setUnits(data || []);
      setSelectedUnit('all'); // Reset to "All Units" when course changes
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, title, session_number')
        .eq('unit_id', selectedUnit)
        .order('session_number');

      if (error) throw error;

      setSessions(data || []);
      setSelectedSession('all'); // Reset to "All Sessions" when unit changes
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const fetchMatrixData = async (limit = null) => {
    if (!selectedCourse) return;

    try {
      setLoading(true);

      // Fetch students enrolled in the course
      const { data: enrollments, error: studentsError } = await supabase
        .from('course_enrollments')
        .select(`
          student_id,
          student:users!student_id(
            id,
            full_name,
            email
          )
        `)
        .eq('course_id', selectedCourse)
        .eq('is_active', true);

      if (studentsError) throw studentsError;

      const studentList = (enrollments || []).map(enrollment => enrollment.student);
      setStudents(studentList);

      // Get units in this course (filter by selected unit if not 'all')
      let unitIds = [];
      if (selectedUnit === 'all') {
        const { data: units, error: unitsError } = await supabase
          .from('units')
          .select('id')
          .eq('course_id', selectedCourse);

        if (unitsError) throw unitsError;

        unitIds = (units || []).map(u => u.id);
      } else {
        unitIds = [selectedUnit];
      }

      if (unitIds.length === 0) {
        setExercises([]);
        setProgressMatrix(new Map());
        return;
      }

      // Get sessions in these units (filter by selected session if not 'all')
      let sessionIds = [];
      let sessionsData = [];

      if (selectedSession !== 'all') {
        sessionIds = [selectedSession];
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('id, title, session_number, unit_id')
          .eq('id', selectedSession)
          .single();

        if (sessionError) throw sessionError;
        sessionsData = sessionData ? [sessionData] : [];
      } else {
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('id, title, session_number, unit_id')
          .in('unit_id', unitIds)
          .order('session_number');

        if (sessionsError) throw sessionsError;

        sessionsData = sessions || [];
        sessionIds = sessionsData.map(s => s.id);
      }
      if (sessionIds.length === 0) {
        setExercises([]);
        setProgressMatrix(new Map());
        return;
      }

      // Get exercises via assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('exercise_assignments')
        .select(`
          session_id,
          exercise:exercises(
            id,
            title,
            exercise_type
          )
        `)
        .in('session_id', sessionIds);

      if (assignmentsError) throw assignmentsError;

      // Build exercises list with session info - deduplicate by exercise ID
      const exerciseMap = new Map();
      const exerciseIds = [];
      (assignments || []).forEach(assignment => {
        const exercise = assignment.exercise;
        if (exercise?.id && !exerciseMap.has(exercise.id)) {
          const session = sessionsData.find(s => s.id === assignment.session_id);
          exerciseMap.set(exercise.id, {
            ...exercise,
            session_title: session?.title || 'Unknown Session',
            session_number: session?.session_number || 0
          });
          exerciseIds.push(exercise.id);
        }
      });

      let exerciseList = Array.from(exerciseMap.values());

      // Sort exercises alphabetically by title (descending)
      exerciseList.sort((a, b) => {
        return b.title.localeCompare(a.title);
      });

      // Apply limit if specified
      if (limit) {
        exerciseList = exerciseList.slice(0, limit);
      } else {
        setAllExercisesFetched(true);
      }

      setExercises(exerciseList);

      if (studentList.length === 0 || exerciseList.length === 0) {
        setProgressMatrix(new Map());
        return;
      }

      // Fetch user progress for all students and limited exercises
      const limitedExerciseIds = exerciseList.map(ex => ex.id);
      const studentIds = studentList.map(s => s.id);
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('user_id, exercise_id, status, score, max_score, attempts, completed_at')
        .in('user_id', studentIds)
        .in('exercise_id', limitedExerciseIds);

      if (progressError) throw progressError;

      // Build progress matrix: Map<student_id-exercise_id, progressData>
      const matrix = new Map();
      (progressData || []).forEach(progress => {
        const key = `${progress.user_id}-${progress.exercise_id}`;
        matrix.set(key, progress);
      });

      setProgressMatrix(matrix);

    } catch (error) {
      console.error('Error fetching matrix data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressForCell = (studentId, exerciseId) => {
    return progressMatrix.get(`${studentId}-${exerciseId}`);
  };

  const getScorePercentage = (progress) => {
    if (!progress || !progress.max_score || progress.score === null) {
      return null;
    }
    return Math.round((progress.score / progress.max_score) * 100);
  };

  const getScoreColor = (percentage) => {
    if (percentage === null) return 'bg-gray-100';
    if (percentage >= 90) return 'bg-green-500 text-white';
    if (percentage >= 75) return 'bg-blue-500 text-white';
    if (percentage >= 60) return 'bg-yellow-200 text-yellow-800';
    return 'bg-red-200 text-red-800';
  };

  const getStudentAverage = (studentId) => {
    if (exercises.length === 0) return null;

    let totalPercentage = 0;
    let count = 0;

    exercises.forEach(exercise => {
      const progress = getProgressForCell(studentId, exercise.id);
      if (progress && progress.score !== null && progress.max_score) {
        totalPercentage += (progress.score / progress.max_score) * 100;
        count++;
      } else if (averageMode === 'all') {
        // Only count unattempted as 0% when in 'all' mode
        count++;
      }
    });

    if (count === 0) return null;
    return Math.round(totalPercentage / count);
  };

  const fetchQuestionAttempts = async (studentId, studentName, exerciseId, exerciseTitle) => {
    setLoadingAttempts(true);
    setSelectedCell({ studentId, studentName, exerciseId, exerciseTitle });

    try {
      // Fetch question attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('question_attempts')
        .select('*')
        .eq('user_id', studentId)
        .eq('exercise_id', exerciseId)
        .order('created_at', { ascending: false });

      if (attemptsError) throw attemptsError;

      // Fetch exercise content to get actual questions
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercises')
        .select('content')
        .eq('id', exerciseId)
        .single();

      if (exerciseError) throw exerciseError;

      // Group by question_id to show latest attempt for each question
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

      setQuestionAttempts(attemptsWithQuestions);
    } catch (err) {
      console.error('Error fetching question attempts:', err);
    } finally {
      setLoadingAttempts(false);
    }
  };

  const closeModal = () => {
    setSelectedCell(null);
    setQuestionAttempts([]);
  };

  if (!selectedCourse) {
    return (
      <div className="text-center py-8 text-gray-500">
        Please select a course to view the student-exercise matrix.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading matrix data...</p>
      </div>
    );
  }

  if (students.length === 0 || exercises.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No students or exercises found for this course.
      </div>
    );
  }

  const handleShowAllExercises = async () => {
    if (!allExercisesFetched) {
      await fetchMatrixData(); // Fetch all exercises
    }
    setShowAllExercises(true);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Student-Exercise Matrix</h3>
            <p className="text-sm text-gray-600">
              {students.length} students • {exercises.length} exercises {!showAllExercises && !allExercisesFetched && '(showing first 15)'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Unit Selection */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Unit:</span>
              <div className="relative">
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded px-3 py-1.5 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Units</option>
                  {units.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      Unit {unit.unit_number}: {unit.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 bottom-[5%] transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Session Selection - only show when a unit is selected */}
            {selectedUnit !== 'all' && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Lesson:</span>
                <div className="relative">
                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="appearance-none bg-white border border-gray-300 rounded px-3 py-1.5 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Lessons</option>
                    {sessions.map(session => (
                      <option key={session.id} value={session.id}>
                        Lesson {session.session_number}: {session.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 bottom-[5%] transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              {!allExercisesFetched && !showAllExercises && (
                <button
                  onClick={handleShowAllExercises}
                  className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-600 hover:border-blue-800 rounded whitespace-nowrap"
                >
                  Show All
                </button>
              )}
              <button
                onClick={() => fetchMatrixData(showAllExercises ? null : 15)}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-900 border-r">
                Student
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-900 min-w-[100px] border-r bg-gray-100">
                <div className="space-y-1">
                  <div>Average</div>
                  <button
                    onClick={() => setAverageMode(averageMode === 'all' ? 'attempted' : 'all')}
                    className="text-xs px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors"
                    title={averageMode === 'all' ? 'Currently: All exercises (unattempted = 0%)' : 'Currently: Attempted only'}
                  >
                    {averageMode === 'all' ? 'All' : 'Attempted'}
                  </button>
                </div>
              </th>
              {exercises.map(exercise => (
                <th
                  key={exercise.id}
                  className="px-3 py-3 text-center text-xs font-medium text-gray-600 min-w-[120px] border-r"
                  title={`${exercise.title} (${exercise.exercise_type}) - ${exercise.session_title}`}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-900 truncate">{exercise.title}</div>
                    <div className="text-xs text-gray-500 truncate">{exercise.session_title}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {students.map(student => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="sticky left-0 bg-white px-4 py-3 border-r">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-blue-600 font-semibold text-sm">
                        {student.full_name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {student.full_name || 'No name'}
                      </div>
                      <div className="text-xs text-gray-600">{student.email}</div>
                    </div>
                  </div>
                </td>
                {/* Average Column */}
                <td className="px-2 py-3 text-center border-r bg-gray-50">
                  {(() => {
                    const avg = getStudentAverage(student.id);
                    return avg !== null ? (
                      <span className={`text-sm px-2 py-1 rounded-full font-semibold ${getScoreColor(avg)}`}>
                        {avg}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    );
                  })()}
                </td>
                {exercises.map(exercise => {
                  const progress = getProgressForCell(student.id, exercise.id);
                  const scorePercentage = getScorePercentage(progress);

                  return (
                    <td
                      key={`${student.id}-${exercise.id}`}
                      className="px-2 py-3 text-center border-r"
                    >
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <div className="flex items-center space-x-1">
                          {scorePercentage !== null && (
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getScoreColor(scorePercentage)}`}
                            >
                              {scorePercentage}%
                            </span>
                          )}
                          {progress?.attempts && (
                            <span className="text-xs text-gray-500">
                              {progress.attempts}x
                            </span>
                          )}
                        </div>
                        {progress && (
                          <button
                            onClick={() => fetchQuestionAttempts(student.id, student.full_name, exercise.id, exercise.title)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="View question attempts"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Legend:</h4>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
         
          <div className="flex items-center space-x-1">
            <span className="px-1.5 py-0.5 bg-green-400 text-green-800 rounded-full">90%+</span>
            <span>Excellent</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded-full">75%+</span>
            <span>Good</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="px-1.5 py-0.5 bg-yellow-200 text-yellow-800 rounded-full">60%+</span>
            <span>Fair</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="px-1.5 py-0.5 bg-red-200 text-red-800 rounded-full">&lt;60%</span>
            <span>Needs Help</span>
          </div>
        </div>
      </div>

      {/* Question Attempts Modal */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Question Attempts</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedCell.studentName} • {selectedCell.exerciseTitle}
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
              ) : questionAttempts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">No question attempts found for this exercise.</p>
                  <p className="text-sm text-gray-500 mt-2">This exercise may not have detailed question tracking.</p>
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
                        {questionAttempts.filter(a => a.is_correct).length}
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="text-sm text-gray-600">Incorrect</span>
                      </div>
                      <p className="text-2xl font-bold text-red-700 mt-1">
                        {questionAttempts.filter(a => !a.is_correct).length}
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Accuracy</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-700 mt-1">
                        {Math.round((questionAttempts.filter(a => a.is_correct).length / questionAttempts.length) * 100)}%
                      </p>
                    </div>
                  </div>

                  {/* Questions List */}
                  <div className="space-y-3">
                    {questionAttempts.map((attempt, index) => (
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

export default StudentExerciseMatrix;