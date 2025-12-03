import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { CheckCircle, XCircle, Clock, Minus, RotateCcw, Eye, X } from 'lucide-react';

const StudentExerciseMatrix = ({ selectedCourse }) => {
  const { user, isAdmin } = useAuth();
  const [students, setStudents] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [progressMatrix, setProgressMatrix] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [questionAttempts, setQuestionAttempts] = useState([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  useEffect(() => {
    if (selectedCourse) {
      fetchMatrixData();
    }
  }, [selectedCourse]);

  const fetchMatrixData = async () => {
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

      // Get units in this course
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id')
        .eq('course_id', selectedCourse);

      if (unitsError) throw unitsError;

      const unitIds = (units || []).map(u => u.id);
      if (unitIds.length === 0) {
        setExercises([]);
        setProgressMatrix(new Map());
        return;
      }

      // Get sessions in these units
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, title, session_number, unit_id')
        .in('unit_id', unitIds)
        .order('session_number');

      if (sessionsError) throw sessionsError;

      const sessionIds = (sessions || []).map(s => s.id);
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
          const session = sessions.find(s => s.id === assignment.session_id);
          exerciseMap.set(exercise.id, {
            ...exercise,
            session_title: session?.title || 'Unknown Session',
            session_number: session?.session_number || 0
          });
          exerciseIds.push(exercise.id);
        }
      });

      const exerciseList = Array.from(exerciseMap.values());

      // Sort exercises by session number and title
      exerciseList.sort((a, b) => {
        if (a.session_number !== b.session_number) {
          return a.session_number - b.session_number;
        }
        return a.title.localeCompare(b.title);
      });

      setExercises(exerciseList);

      if (studentList.length === 0 || exerciseIds.length === 0) {
        setProgressMatrix(new Map());
        return;
      }

      // Fetch user progress for all students and exercises
      const studentIds = studentList.map(s => s.id);
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('user_id, exercise_id, status, score, max_score, attempts, completed_at')
        .in('user_id', studentIds)
        .in('exercise_id', exerciseIds);

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

  const getStatusIcon = (progress) => {
    if (!progress) {
      return <Minus className="w-4 h-4 text-gray-400" />;
    }

    switch (progress.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'attempted':
      case 'in_progress':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getScorePercentage = (progress) => {
    if (!progress || !progress.max_score || progress.score === null) {
      return null;
    }
    return Math.round((progress.score / progress.max_score) * 100);
  };

  const getScoreColor = (percentage) => {
    if (percentage === null) return 'bg-gray-100';
    if (percentage >= 90) return 'bg-green-200 text-green-800';
    if (percentage >= 75) return 'bg-blue-200 text-blue-800';
    if (percentage >= 60) return 'bg-yellow-200 text-yellow-800';
    return 'bg-red-200 text-red-800';
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

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Student-Exercise Matrix</h3>
            <p className="text-sm text-gray-600">
              {students.length} students • {exercises.length} exercises
            </p>
          </div>
          <button
            onClick={fetchMatrixData}
            className="flex items-center space-x-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border rounded"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-900 border-r">
                Student
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
                          {getStatusIcon(progress)}
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
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Completed</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center space-x-1">
            <XCircle className="w-4 h-4 text-red-600" />
            <span>Failed/Error</span>
          </div>
          <div className="flex items-center space-x-1">
            <Minus className="w-4 h-4 text-gray-400" />
            <span>Not Started</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="px-1.5 py-0.5 bg-green-200 text-green-800 rounded-full">90%+</span>
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