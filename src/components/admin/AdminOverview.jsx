import { useState, useEffect } from 'react'
import Card from '../ui/Card'
import { supabase } from '../../supabase/client'
import {
  BookOpen,
  Trophy,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  Circle
} from 'lucide-react'

const AdminOverview = () => {
  const [loading, setLoading] = useState(true)
  const [avgCompletion, setAvgCompletion] = useState(0)
  const [courseStats, setCourseStats] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [courseStudents, setCourseStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [expandedStudent, setExpandedStudent] = useState(null)
  const [studentUnitProgress, setStudentUnitProgress] = useState(new Map())

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

      const courseIds = courses.map(c => c.id)

      // Batch: fetch all units, enrollments in parallel
      const [unitsRes, enrollmentsRes] = await Promise.all([
        supabase.from('units').select('id, course_id').in('course_id', courseIds),
        supabase.from('course_enrollments').select('student_id, course_id').in('course_id', courseIds).eq('is_active', true),
      ])

      const allUnits = unitsRes.data || []
      const allEnrollments = enrollmentsRes.data || []
      const allUnitIds = allUnits.map(u => u.id)

      if (allUnitIds.length === 0) {
        setAvgCompletion(0)
        setCourseStats([])
        return
      }

      // Batch: fetch all sessions for all units
      const { data: allSessions } = await supabase
        .from('sessions')
        .select('id, unit_id')
        .in('unit_id', allUnitIds)

      const allSessionIds = (allSessions || []).map(s => s.id)
      if (allSessionIds.length === 0) {
        setAvgCompletion(0)
        setCourseStats([])
        return
      }

      // Batch: fetch all assignments + all progress in parallel
      const allStudentIds = Array.from(new Set(allEnrollments.map(e => e.student_id)))
      const [assignmentsRes, progressRes] = await Promise.all([
        supabase.from('exercise_assignments').select('exercise_id, session_id').in('session_id', allSessionIds),
        allStudentIds.length > 0
          ? supabase.from('user_progress').select('user_id, exercise_id, status').in('user_id', allStudentIds).eq('status', 'completed')
          : Promise.resolve({ data: [] }),
      ])

      const allAssignments = assignmentsRes.data || []
      const allProgress = progressRes.data || []

      // Build lookup maps
      const sessionToUnit = new Map()
      ;(allSessions || []).forEach(s => sessionToUnit.set(s.id, s.unit_id))

      const unitToCourse = new Map()
      allUnits.forEach(u => unitToCourse.set(u.id, u.course_id))

      // Map exercise -> course
      const exerciseToCourse = new Map()
      allAssignments.forEach(a => {
        const unitId = sessionToUnit.get(a.session_id)
        if (unitId) {
          const courseId = unitToCourse.get(unitId)
          if (courseId) exerciseToCourse.set(a.exercise_id, courseId)
        }
      })

      // Group exercises by course
      const courseExercises = new Map()
      exerciseToCourse.forEach((courseId, exerciseId) => {
        if (!courseExercises.has(courseId)) courseExercises.set(courseId, new Set())
        courseExercises.get(courseId).add(exerciseId)
      })

      // Group enrollments by course
      const courseStudentIds = new Map()
      allEnrollments.forEach(e => {
        if (!courseStudentIds.has(e.course_id)) courseStudentIds.set(e.course_id, [])
        courseStudentIds.get(e.course_id).push(e.student_id)
      })

      // Index completed progress
      const completedSet = new Set()
      allProgress.forEach(p => completedSet.add(`${p.user_id}-${p.exercise_id}`))

      // Calculate per-course stats
      const courseCompletions = courses.map(course => {
        const exerciseSet = courseExercises.get(course.id)
        const studentIds = courseStudentIds.get(course.id)
        if (!exerciseSet || exerciseSet.size === 0 || !studentIds || studentIds.length === 0) {
          return { courseId: course.id, courseTitle: course.title, avgCompletion: 0 }
        }

        const exerciseArr = Array.from(exerciseSet)
        const studentCompletionRates = studentIds.map(sid => {
          const completed = exerciseArr.filter(eid => completedSet.has(`${sid}-${eid}`)).length
          return (completed / exerciseArr.length) * 100
        })

        const avg = studentCompletionRates.reduce((sum, r) => sum + r, 0) / studentCompletionRates.length
        return { courseId: course.id, courseTitle: course.title, avgCompletion: Math.round(avg) }
      }).filter(c => c.avgCompletion > 0 || courseExercises.has(c.courseId))

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
        .select('id, unit_id')
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

      // Calculate unit-by-unit progress for detailed view
      await fetchUnitProgress(courseId, units, sessions, assignments, enrollments, progress)

    } catch (error) {
      console.error('Error fetching course students:', error)
    } finally {
      setLoadingStudents(false)
    }
  }

  const fetchUnitProgress = async (courseId, units, sessions, assignments, enrollments, progress) => {
    try {
      // Get full unit data with titles
      const { data: unitsData } = await supabase
        .from('units')
        .select('id, title, unit_number')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .order('unit_number', { ascending: false })

      if (!unitsData) return

      // Fetch exercises via assignments (assignments has session_id and exercise info)
      const sessionIds = sessions.map(s => s.id)
      const { data: assignmentsData } = await supabase
        .from('exercise_assignments')
        .select(`
          session_id,
          exercise:exercises(id)
        `)
        .in('session_id', sessionIds)

      // Extract exercises from assignments
      const exercisesData = (assignmentsData || [])
        .filter(a => a.exercise?.id)
        .map(a => ({
          id: a.exercise.id,
          session_id: a.session_id
        }))

      // Build mapping: session -> unit
      const sessionToUnit = new Map();
      sessions.forEach(s => sessionToUnit.set(s.id, s.unit_id))

      // Build mapping: exercise -> unit
      const exerciseToUnit = new Map();
      exercisesData.forEach(e => {
        const unitId = sessionToUnit.get(e.session_id)
        if (unitId) exerciseToUnit.set(e.id, unitId)
      })

      // Count exercises per unit
      const unitExerciseCounts = new Map();
      exercisesData.forEach(e => {
        const unitId = exerciseToUnit.get(e.id)
        if (unitId) {
          unitExerciseCounts.set(unitId, (unitExerciseCounts.get(unitId) || 0) + 1)
        }
      })

      // Count completed exercises per student per unit
      const studentUnitCompleted = new Map();
      (progress || []).forEach(p => {
        const unitId = exerciseToUnit.get(p.exercise_id)
        if (unitId && p.status === 'completed') {
          const key = `${p.user_id}-${unitId}`
          studentUnitCompleted.set(key, (studentUnitCompleted.get(key) || 0) + 1)
        }
      })

      // Build final progress map with percentages
      const progressMap = new Map();
      enrollments.forEach(enrollment => {
        const student = enrollment.student
        unitsData.forEach(unit => {
          const key = `${student.id}-${unit.id}`
          const completed = studentUnitCompleted.get(key) || 0
          const total = unitExerciseCounts.get(unit.id) || 0
          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

          progressMap.set(key, {
            unitId: unit.id,
            unitTitle: unit.title,
            unitNumber: unit.unit_number,
            completed,
            total,
            percentage,
            status: percentage === 100 ? 'completed' : percentage > 0 ? 'in_progress' : 'not_started'
          })
        })
      })

      setStudentUnitProgress(progressMap)
    } catch (error) {
      console.error('Error fetching unit progress:', error)
    }
  }

  const closeModal = () => {
    setSelectedCourse(null)
    setCourseStudents([])
    setExpandedStudent(null)
    setStudentUnitProgress(new Map())
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
                <div className="space-y-2">
                  {courseStudents.map((student, index) => {
                    const isExpanded = expandedStudent === student.id
                    // Get unit progress for this student
                    const unitKeys = Array.from(studentUnitProgress.keys())
                      .filter(key => key.startsWith(`${student.id}-`))
                    const allStudentUnits = unitKeys
                      .map(key => studentUnitProgress.get(key))
                    const studentUnits = allStudentUnits
                      .filter(unit => unit.total > 0) // Only show units with exercises
                      .sort((a, b) => b.unitNumber - a.unitNumber)
                      .slice(0, 3) // Show only the 3 latest units

                    return (
                      <div key={student.id}>
                        <div
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center space-x-4 flex-1">
                            <button
                              onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
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
                        {isExpanded && studentUnits.length > 0 && (
                          <div className="ml-12 mt-2 p-4 bg-white border rounded-lg">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">Progress by Unit</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {studentUnits.map(unit => {
                                const getProgressBadge = () => {
                                  if (unit.status === 'completed') {
                                    return (
                                      <div className="flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800">
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        <span className="text-sm font-medium">{unit.percentage}%</span>
                                      </div>
                                    )
                                  } else if (unit.status === 'in_progress') {
                                    return (
                                      <div className="flex items-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-800">
                                        <Clock className="w-4 h-4 mr-1" />
                                        <span className="text-sm font-medium">{unit.percentage}%</span>
                                      </div>
                                    )
                                  } else {
                                    return (
                                      <div className="flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                                        <Circle className="w-4 h-4 mr-1" />
                                        <span className="text-sm font-medium">{unit.percentage}%</span>
                                      </div>
                                    )
                                  }
                                }

                                return (
                                  <div key={unit.unitId} className="p-3 bg-gray-50 rounded border">
                                    <div className="flex items-center justify-between mb-2">
                                      <h5 className="text-sm font-medium text-gray-900">{unit.unitTitle}</h5>
                                      {getProgressBadge()}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      Exercises: {unit.completed} / {unit.total}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
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
