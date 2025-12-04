import { useState, useEffect } from 'react'
import Card from '../ui/Card'
import { supabase } from '../../supabase/client'
import {
  BookOpen,
  Trophy,
  X
} from 'lucide-react'

const AdminOverview = () => {
  const [loading, setLoading] = useState(true)
  const [avgCompletion, setAvgCompletion] = useState(0)
  const [courseStats, setCourseStats] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [courseStudents, setCourseStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  useEffect(() => {
    fetchCourseCompletionStats()
  }, [])

  const fetchCourseCompletionStats = async () => {
    try {
      setLoading(true)

      // Get all courses
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .eq('is_active', true)

      if (coursesError) throw coursesError

      if (!courses || courses.length === 0) {
        setAvgCompletion(0)
        setCourseStats([])
        return
      }

      // For each course, calculate completion rate
      const courseCompletions = []

      for (const course of courses) {
        // Get units in course
        const { data: units } = await supabase
          .from('units')
          .select('id')
          .eq('course_id', course.id)

        const unitIds = (units || []).map(u => u.id)
        if (unitIds.length === 0) continue

        // Get sessions
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id')
          .in('unit_id', unitIds)

        const sessionIds = (sessions || []).map(s => s.id)
        if (sessionIds.length === 0) continue

        // Get exercise IDs via assignments
        const { data: assignments } = await supabase
          .from('exercise_assignments')
          .select('exercise_id')
          .in('session_id', sessionIds)

        const exerciseIds = Array.from(new Set((assignments || []).map(a => a.exercise_id)))
        if (exerciseIds.length === 0) continue

        // Get students enrolled in this course
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select('student_id')
          .eq('course_id', course.id)
          .eq('is_active', true)

        const studentIds = (enrollments || []).map(e => e.student_id)
        if (studentIds.length === 0) continue

        // Get user progress
        const { data: progress } = await supabase
          .from('user_progress')
          .select('user_id, exercise_id, status')
          .in('user_id', studentIds)
          .in('exercise_id', exerciseIds)

        // Calculate completion rate for each student
        const studentCompletionRates = studentIds.map(studentId => {
          const studentProgress = (progress || []).filter(p => p.user_id === studentId)
          const completed = studentProgress.filter(p => p.status === 'completed').length
          return exerciseIds.length > 0 ? (completed / exerciseIds.length) * 100 : 0
        })

        const courseAvgCompletion = studentCompletionRates.length > 0
          ? studentCompletionRates.reduce((sum, rate) => sum + rate, 0) / studentCompletionRates.length
          : 0

        courseCompletions.push({
          courseId: course.id,
          courseTitle: course.title,
          avgCompletion: Math.round(courseAvgCompletion)
        })
      }

      // Calculate overall average
      const overallAvg = courseCompletions.length > 0
        ? Math.round(courseCompletions.reduce((sum, c) => sum + c.avgCompletion, 0) / courseCompletions.length)
        : 0

      setAvgCompletion(overallAvg)
      setCourseStats(courseCompletions)

    } catch (error) {
      console.error('Error fetching course completion stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCourseStudents = async (courseId, courseTitle) => {
    try {
      setLoadingStudents(true)
      setSelectedCourse({ id: courseId, title: courseTitle })

      // Get units in course
      const { data: units } = await supabase
        .from('units')
        .select('id')
        .eq('course_id', courseId)

      const unitIds = (units || []).map(u => u.id)
      if (unitIds.length === 0) {
        setCourseStudents([])
        return
      }

      // Get sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .in('unit_id', unitIds)

      const sessionIds = (sessions || []).map(s => s.id)
      if (sessionIds.length === 0) {
        setCourseStudents([])
        return
      }

      // Get exercise IDs via assignments
      const { data: assignments } = await supabase
        .from('exercise_assignments')
        .select('exercise_id')
        .in('session_id', sessionIds)

      const exerciseIds = Array.from(new Set((assignments || []).map(a => a.exercise_id)))
      if (exerciseIds.length === 0) {
        setCourseStudents([])
        return
      }

      // Get students enrolled in this course
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select(`
          student_id,
          student:users!student_id(
            id,
            full_name,
            email
          )
        `)
        .eq('course_id', courseId)
        .eq('is_active', true)

      if (!enrollments || enrollments.length === 0) {
        setCourseStudents([])
        return
      }

      const studentIds = enrollments.map(e => e.student_id)

      // Get user progress
      const { data: progress } = await supabase
        .from('user_progress')
        .select('user_id, exercise_id, status')
        .in('user_id', studentIds)
        .in('exercise_id', exerciseIds)

      // Calculate completion for each student
      const studentsWithCompletion = enrollments.map(enrollment => {
        const student = enrollment.student
        const studentProgress = (progress || []).filter(p => p.user_id === student.id)
        const completed = studentProgress.filter(p => p.status === 'completed').length
        const completionRate = exerciseIds.length > 0 ? Math.round((completed / exerciseIds.length) * 100) : 0

        return {
          ...student,
          completionRate,
          completed,
          total: exerciseIds.length
        }
      })

      // Sort by completion rate descending
      studentsWithCompletion.sort((a, b) => b.completionRate - a.completionRate)

      setCourseStudents(studentsWithCompletion)

    } catch (error) {
      console.error('Error fetching course students:', error)
    } finally {
      setLoadingStudents(false)
    }
  }

  const closeModal = () => {
    setSelectedCourse(null)
    setCourseStudents([])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-gray-600">Loading statistics...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Overview</h1>
          <p className="text-gray-600">Course completion statistics</p>
        </div>
      </div>

      {/* Average Completion Card */}
      <div className="bg-white rounded-lg shadow-sm border p-8">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <Trophy className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-600 mb-2">Overall Average Completion</p>
            <p className="text-6xl font-bold text-gray-900 mb-2">{avgCompletion}%</p>
            <p className="text-sm text-gray-500">Across all courses</p>
          </div>
        </div>
      </div>

      {/* Course Breakdown */}
      {courseStats.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Completion by Course</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courseStats.map((course, index) => (
              <Card
                key={index}
                hover
                className="cursor-pointer"
                onClick={() => fetchCourseStudents(course.courseId, course.courseTitle)}
              >
                <Card.Content className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 mb-2">{course.courseTitle}</p>
                      <p className="text-3xl font-bold text-gray-900">{course.avgCompletion}%</p>
                      <p className="text-xs text-gray-500 mt-1">Average completion</p>
                    </div>
                    <div className="ml-4">
                      <BookOpen className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modal for Course Students */}
      {selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedCourse.title}</h2>
                <p className="text-sm text-gray-600 mt-1">Student Completion Rates</p>
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
              {loadingStudents ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="ml-3 text-gray-600">Loading students...</p>
                </div>
              ) : courseStudents.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">No students enrolled in this course.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {courseStudents.map((student, index) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">
                            {student.full_name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {student.full_name || 'No name'}
                          </div>
                          <div className="text-xs text-gray-600">{student.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-xs text-gray-500">
                            {student.completed}/{student.total} exercises
                          </div>
                        </div>
                        <div className={`text-lg font-bold px-3 py-1 rounded-full ${
                          student.completionRate >= 90 ? 'bg-green-200 text-green-800' :
                          student.completionRate >= 75 ? 'bg-blue-200 text-blue-800' :
                          student.completionRate >= 60 ? 'bg-yellow-200 text-yellow-800' :
                          'bg-red-200 text-red-800'
                        }`}>
                          {student.completionRate}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default AdminOverview
