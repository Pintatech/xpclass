import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { CheckCircle, XCircle, Clock, Minus, RotateCcw } from 'lucide-react';

const StudentExerciseMatrix = ({ selectedCourse }) => {
  const { user, isAdmin } = useAuth();
  const [students, setStudents] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [progressMatrix, setProgressMatrix] = useState(new Map());
  const [loading, setLoading] = useState(false);

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

      // Build exercises list with session info
      const exerciseList = [];
      const exerciseIds = [];
      (assignments || []).forEach(assignment => {
        const exercise = assignment.exercise;
        if (exercise?.id) {
          const session = sessions.find(s => s.id === assignment.session_id);
          exerciseList.push({
            ...exercise,
            session_title: session?.title || 'Unknown Session',
            session_number: session?.session_number || 0
          });
          exerciseIds.push(exercise.id);
        }
      });

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
                      <div className="flex items-center justify-center space-x-1">
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
    </div>
  );
};

export default StudentExerciseMatrix;