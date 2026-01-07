import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import StudentExerciseMatrix from './StudentExerciseMatrix';
import UnitProgressView from './UnitProgressView';
import {
  BookOpen,
  Users,
  Trophy,
  ChevronDown,
  ChevronRight,
  Grid,
  Eye
} from 'lucide-react';

const TeacherDashboard = () => {
  const { user, isAdmin, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [students, setStudents] = useState([]);
  const [studentProgress, setStudentProgress] = useState([]);
  const [courseStats, setCourseStats] = useState({});
  const [courseExerciseIds, setCourseExerciseIds] = useState([]);
  const [courseSessionIds, setCourseSessionIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [currentView, setCurrentView] = useState('overview'); // 'overview', 'matrix', or 'unit-progress'
  const [hasLoadedCourses, setHasLoadedCourses] = useState(false);

  useEffect(() => {
    console.log('🔄 Effect triggered:', {
      hasUser: !!user,
      userId: user?.id,
      authLoading,
      hasLoadedCourses
    });

    if (user && !authLoading && !hasLoadedCourses) {
      console.log('✅ Conditions met, fetching courses...');
      fetchTeacherCourses();
      setHasLoadedCourses(true);
    }
  }, [user, authLoading, hasLoadedCourses]);

  useEffect(() => {
    if (selectedCourse) {
      fetchCourseStudents();
      fetchCourseStats();
    }
  }, [selectedCourse]);

  const fetchTeacherCourses = async () => {
    try {
      console.log('🔍 Fetching courses for user:', user?.id);

      // If user is admin, fetch all courses. Otherwise, fetch only teacher's assigned courses
      if (!isAdmin()) {
        console.log('Not admin, fetching via course_teachers junction table');

        // Get courses via course_teachers junction table
        const { data: courseTeachers, error: ctError } = await supabase
          .from('course_teachers')
          .select(`
            course:courses(id, title, level_number, description, teacher_id, is_active)
          `)
          .eq('teacher_id', user.id);

        if (ctError) throw ctError;

        // Extract and filter active courses
        const teacherCourses = (courseTeachers || [])
          .map(ct => ct.course)
          .filter(c => c && c.is_active)
          .sort((a, b) => a.level_number - b.level_number);

        console.log('📊 Courses fetched:', teacherCourses);

        setCourses(teacherCourses);
        if (teacherCourses.length > 0) {
          setSelectedCourse(teacherCourses[0].id);
        }
      } else {
        console.log('Admin user, fetching all courses');

        const { data, error } = await supabase
          .from('courses')
          .select('id, title, level_number, description, teacher_id')
          .eq('is_active', true)
          .order('level_number');

        if (error) throw error;

        console.log('📊 Courses fetched:', data);

        setCourses(data || []);
        if (data?.length > 0) {
          setSelectedCourse(data[0].id);
        }
      }

      console.log('✅ Courses loaded successfully');
    } catch (error) {
      console.error('❌ Error fetching teacher courses:', error);
      setCourses([]);
    }
  };

  const fetchCourseStudents = async () => {
    if (!selectedCourse) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`
          student_id,
          assigned_at,
          student:users!student_id(
            id,
            full_name,
            email,
            xp,
            current_level,
            streak_count,
            last_activity_date
          )
        `)
        .eq('course_id', selectedCourse)
        .eq('is_active', true);

      if (error) throw error;
      
      setStudents(data || []);

      // Fetch progress for each student
      if (data?.length > 0) {
        const studentIds = data.map(enrollment => enrollment.student_id);
        
        await fetchStudentProgress(studentIds);
      }
    } catch (error) {
      console.error('Error fetching course students:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentProgress = async (studentIds) => {
    try {
      // 1) Get units in this course
      const { data: units, error: unitsErr } = await supabase
        .from('units')
        .select('id')
        .eq('course_id', selectedCourse);
      if (unitsErr) throw unitsErr;
      

      const unitIds = (units || []).map(u => u.id);
      if (unitIds.length === 0) { setStudentProgress([]); return; }

      // 2) Get sessions in these units
      const { data: sessions, error: sessionsErr } = await supabase
        .from('sessions')
        .select('id')
        .in('unit_id', unitIds);
      if (sessionsErr) throw sessionsErr;
      

      const sessionIds = (sessions || []).map(s => s.id);
      if (sessionIds.length === 0) { setStudentProgress([]); return; }

      // 3) Get exercises via assignments (authoritative)
      const { data: assignments, error: assignErr } = await supabase
        .from('exercise_assignments')
        .select('session_id, exercise:exercises(id, title, exercise_type)')
        .in('session_id', sessionIds);
      if (assignErr) throw assignErr;
      const exerciseIdToMeta = {};
      const exerciseIds = [];
      (assignments || []).forEach(a => {
        const ex = a.exercise;
        if (ex?.id) {
          exerciseIds.push(ex.id);
          exerciseIdToMeta[ex.id] = { ...ex, session_id: a.session_id };
        }
      });
      
      if (exerciseIds.length === 0) { setStudentProgress([]); return; }

      // 4) Fetch user progress for those exercises and students
      const { data: progress, error: progressErr } = await supabase
        .from('user_progress')
        .select('id, user_id, exercise_id, status, score, max_score, attempts, time_spent, completed_at, updated_at')
        .in('user_id', studentIds)
        .in('exercise_id', exerciseIds);
      if (progressErr) throw progressErr;
      

      // 5) Attach exercise meta for rendering
      const withMeta = (progress || []).map(p => ({
        ...p,
        exercise: {
          id: p.exercise_id,
          title: exerciseIdToMeta[p.exercise_id]?.title,
          exercise_type: exerciseIdToMeta[p.exercise_id]?.exercise_type,
        }
      }));

      setStudentProgress(withMeta);
    } catch (error) {
      console.error('Error fetching student progress:', error);
    }
  };

  const fetchCourseStats = async () => {
    if (!selectedCourse) return;

    try {
      // Get course overview stats
      const { count: studentsCount } = await supabase
        .from('course_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', selectedCourse)
        .eq('is_active', true);

      const { data: units } = await supabase
        .from('units')
        .select('id')
        .eq('course_id', selectedCourse);
      const unitIds = (units || []).map(u => u.id);
      let totalExercisesCount = 0;
      let sessionIds = [];
      if (unitIds.length > 0) {
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id')
          .in('unit_id', unitIds);
        sessionIds = (sessions || []).map(s => s.id);
        if (sessionIds.length > 0) {
          const { count: exCount } = await supabase
        .from('exercises')
            .select('id', { count: 'exact', head: true })
            .in('session_id', sessionIds);
          totalExercisesCount = exCount || 0;
        }
      }


      setCourseStats({
        totalStudents: studentsCount || 0,
        totalExercises: totalExercisesCount || 0
      });
      setCourseSessionIds(sessionIds);
      if (sessionIds.length > 0) {
        const { data: exList } = await supabase
          .from('exercise_assignments')
          .select('exercise_id')
          .in('session_id', sessionIds);
        const ids = Array.from(new Set((exList || []).map(e => e.exercise_id)));
        
        setCourseExerciseIds(ids);
      } else {
        setCourseExerciseIds([]);
      }
    } catch (error) {
      console.error('Error fetching course stats:', error);
    }
  };

  const getStudentStats = (studentId) => {
    const courseExerciseSet = new Set(courseExerciseIds);
    const sp = studentProgress.filter(p => p.user_id === studentId && courseExerciseSet.has(p.exercise_id));
    

    const completed = sp.filter(p => p.status === 'completed').length;
    const attempted = sp.filter(p => p.status === 'attempted' || p.status === 'in_progress').length;
    const totalTime = sp.reduce((sum, p) => sum + (p.time_spent || 0), 0);

    const scores = sp
      .filter(p => p.score !== null && (p.max_score || 0) > 0)
      .map(p => (p.score / p.max_score) * 100);

    const averageScore = scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;

    const total = courseExerciseIds.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      completed,
      attempted,
      total,
      averageScore: Math.round(averageScore),
      totalTime: Math.round(totalTime / 60), // minutes
      completionRate
    };
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 75) return 'text-blue-600 bg-blue-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStudentDetailedProgress = (studentId) => {
    return studentProgress
      .filter(p => p.user_id === studentId)
      .sort((a, b) => new Date(b.completed_at || b.updated_at) - new Date(a.completed_at || a.updated_at));
  };

  const selectedCourseData = courses.find(course => course.id === selectedCourse);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-2 text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            onClick={() => navigate('/teacher/exercise-bank')}
            className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg shadow-sm hover:shadow-md cursor-pointer transition-all border border-blue-200"
          >
            <div className="flex items-center space-x-3 mb-2">
              <Eye className="w-8 h-8 text-blue-600" />
              <h3 className="font-semibold text-gray-800">Exercise Bank</h3>
            </div>
            <p className="text-sm text-gray-600">Browse and preview all exercises</p>
          </div>
        </div>

      {/* Course Selection */}
      {courses.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Course
          </label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full max-w-md p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                Course {course.level_number}: {course.title}
                {isAdmin() && course.teacher_id !== user.id ? ' (Other Teacher)' : ''}
              </option>
            ))}
          </select>
          {selectedCourseData && (
            <p className="text-sm text-gray-600 mt-2">{selectedCourseData.description}</p>
          )}
        </div>
      )}

      {/* View Toggle */}
      {selectedCourse && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">View:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentView('overview')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'overview'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Student Overview</span>
              </button>
              <button
                onClick={() => setCurrentView('matrix')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'matrix'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Exercise Matrix</span>
              </button>
              <button
                onClick={() => setCurrentView('unit-progress')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'unit-progress'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Unit Progress</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Course Overview Stats */}
      {selectedCourse && currentView === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Enrolled Students</p>
                <p className="text-2xl font-bold text-gray-900">{courseStats.totalStudents || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookOpen className="w-8 h-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Exercises</p>
                <p className="text-2xl font-bold text-gray-900">{courseStats.totalExercises || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Trophy className="w-8 h-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Completion</p>
                <p className="text-2xl font-bold text-gray-900">
                  {students.length > 0
                    ? Math.round(students.reduce((sum, student) =>
                        sum + getStudentStats(student.student_id).completionRate, 0) / students.length)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Students List */}
      {selectedCourse && currentView === 'overview' && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Student Progress</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading student data...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Students Enrolled</h3>
              <p className="text-gray-600">No students are currently enrolled in this course.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {students.map((enrollment) => {
                const student = enrollment.student;
                const stats = getStudentStats(student.id);
                const detailedProgress = getStudentDetailedProgress(student.id);
                const isExpanded = expandedStudent === student.id;

                return (
                  <div key={student.id} className="p-6">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold">
                              {student.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{student.full_name}</h3>
                          <p className="text-sm text-gray-600">{student.email}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                            <span>Level {student.current_level || 1}</span>
                            <span>{student.xp || 0} XP</span>
                            <span>🔥 {student.streak_count || 0} day streak</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <div className="text-sm font-medium text-gray-900">{stats.completed}/{stats.total}</div>
                          <div className="text-xs text-gray-500">Completed</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-medium px-2 py-1 rounded-full ${getScoreColor(stats.averageScore)}`}>
                            {stats.averageScore}%
                          </div>
                          <div className="text-xs text-gray-500">Avg Score</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium text-gray-900">{stats.totalTime}m</div>
                          <div className="text-xs text-gray-500">Study Time</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-medium px-2 py-1 rounded-full ${getScoreColor(stats.completionRate)}`}>
                            {stats.completionRate}%
                          </div>
                          <div className="text-xs text-gray-500">Progress</div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="text-md font-medium text-gray-900 mb-4">Recent Exercise Progress</h4>
                        {detailedProgress.length === 0 ? (
                          <p className="text-gray-500 text-sm">No exercises completed yet</p>
                        ) : (
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {detailedProgress.slice(0, 10).map((progress) => (
                              <div key={progress.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {progress.exercise?.title || 'Exercise'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {progress.exercise?.session?.title} • {progress.exercise?.exercise_type}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <div className="text-center">
                                    <div className={`text-sm font-medium px-2 py-1 rounded ${
                                      progress.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {progress.status === 'completed' ? 'Completed' : 'Attempted'}
                                    </div>
                                  </div>
                                  {progress.score !== null && progress.max_score > 0 && (
                                    <div className="text-center">
                                      <div className={`text-sm font-medium px-2 py-1 rounded-full ${
                                        getScoreColor((progress.score / progress.max_score) * 100)
                                      }`}>
                                        {Math.round((progress.score / progress.max_score) * 100)}%
                                      </div>
                                    </div>
                                  )}
                                  <div className="text-xs text-gray-500">
                                    {progress.attempts} attempt{progress.attempts !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Student Exercise Matrix */}
      {selectedCourse && currentView === 'matrix' && (
        <StudentExerciseMatrix selectedCourse={selectedCourse} />
      )}

      {/* Unit Progress View */}
      {selectedCourse && currentView === 'unit-progress' && (
        <UnitProgressView selectedCourse={selectedCourse} />
      )}

      {/* No Courses */}
      {courses.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Courses Assigned</h3>
          <p className="text-gray-600">You haven't been assigned to any courses yet. Contact your administrator.</p>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;