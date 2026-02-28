import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabase/client'
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Trophy,
  Users,
  FileText
} from 'lucide-react'

const TestResultsView = ({ selectedCourse }) => {
  const [testSessions, setTestSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState('')
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(false)
  const [expandedStudent, setExpandedStudent] = useState(null)
  const [expandedAttempt, setExpandedAttempt] = useState(null)

  // Fetch test sessions for this course
  useEffect(() => {
    if (!selectedCourse) return
    const fetchTestSessions = async () => {
      const { data: units } = await supabase
        .from('units')
        .select('id')
        .eq('course_id', selectedCourse)
      const unitIds = (units || []).map(u => u.id)
      if (unitIds.length === 0) { setTestSessions([]); return }

      // Fetch all sessions in this course
      const { data: sessions, error: sessErr } = await supabase
        .from('sessions')
        .select('id, title, passing_score, max_attempts, time_limit_minutes, unit_id, is_test')
        .in('unit_id', unitIds)
        .order('title')

      if (sessErr) { console.error('Error fetching sessions:', sessErr); return }

      // Find sessions with test_attempts (works even if is_test wasn't set)
      const sessionIds = (sessions || []).map(s => s.id)
      let sessionsWithAttempts = new Set()
      if (sessionIds.length > 0) {
        const { data: attemptSessions, error: attErr } = await supabase
          .from('test_attempts')
          .select('session_id')
          .in('session_id', sessionIds)
        if (attErr) console.error('Error fetching test_attempts:', attErr)
        ;(attemptSessions || []).forEach(a => sessionsWithAttempts.add(a.session_id))
      }

      // Include sessions that are is_test OR have test_attempts
      const testSessions = (sessions || []).filter(s =>
        s.is_test || sessionsWithAttempts.has(s.id)
      )

      console.log('📝 Test sessions found:', testSessions.length, 'from', sessions?.length, 'total sessions')
      console.log('📝 Sessions with attempts:', [...sessionsWithAttempts])

      setTestSessions(testSessions)
      if (testSessions.length > 0 && !selectedSession) {
        setSelectedSession(testSessions[0].id)
      }
    }
    fetchTestSessions()
  }, [selectedCourse])

  // Fetch attempts for selected session
  useEffect(() => {
    if (!selectedSession) return
    const fetchAttempts = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('test_attempts')
          .select(`
            *,
            user:users!user_id (id, full_name, email),
            test_question_attempts (*)
          `)
          .eq('session_id', selectedSession)
          .in('status', ['completed', 'timed_out'])
          .order('created_at', { ascending: false })

        if (error) throw error
        setAttempts(data || [])
      } catch (err) {
        console.error('Error fetching test attempts:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAttempts()
  }, [selectedSession])

  // Group attempts by student, show best attempt
  const studentResults = (() => {
    const byStudent = {}
    attempts.forEach(a => {
      const sid = a.user?.id
      if (!sid) return
      if (!byStudent[sid]) {
        byStudent[sid] = { student: a.user, attempts: [] }
      }
      byStudent[sid].attempts.push(a)
    })

    return Object.values(byStudent)
      .map(({ student, attempts: studentAttempts }) => {
        const best = studentAttempts.reduce((b, a) => (!b || (a.score || 0) > (b.score || 0)) ? a : b, null)
        return { student, attempts: studentAttempts, best }
      })
      .sort((a, b) => (b.best?.score || 0) - (a.best?.score || 0))
  })()

  const session = testSessions.find(s => s.id === selectedSession)
  const passingScore = session?.passing_score || 70

  const passedCount = studentResults.filter(r => r.best?.passed).length
  const totalStudents = studentResults.length
  const avgScore = totalStudents > 0
    ? Math.round(studentResults.reduce((sum, r) => sum + (r.best?.score || 0), 0) / totalStudents)
    : 0

  const formatTime = (seconds) => {
    if (!seconds) return '-'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const getScoreColor = (score, passed) => {
    if (passed) return 'text-green-600 bg-green-100'
    if (score >= 50) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  if (testSessions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No tests found in this course.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Test selector */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Test</label>
        <select
          value={selectedSession}
          onChange={(e) => { setSelectedSession(e.target.value); setExpandedStudent(null) }}
          className="w-full max-w-md p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {testSessions.map(s => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>

      {/* Stats cards */}
      {session && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <Users className="w-6 h-6 text-blue-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-gray-900">{totalStudents}</div>
            <div className="text-xs text-gray-500">Students</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <Trophy className="w-6 h-6 text-green-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-green-600">{passedCount}/{totalStudents}</div>
            <div className="text-xs text-gray-500">Passed</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <CheckCircle className="w-6 h-6 text-purple-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-gray-900">{avgScore}%</div>
            <div className="text-xs text-gray-500">Avg Score</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <Clock className="w-6 h-6 text-orange-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-gray-900">{session.time_limit_minutes || '∞'}</div>
            <div className="text-xs text-gray-500">Time Limit (min)</div>
          </div>
        </div>
      )}

      {/* Student results table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Student Results</h3>
          <span className="text-sm text-gray-500">Pass: {passingScore}%</span>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-500 text-sm">Loading results...</p>
          </div>
        ) : studentResults.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No submissions yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {studentResults.map(({ student, attempts: studentAttempts, best }) => {
              const isExpanded = expandedStudent === student.id
              return (
                <div key={student.id}>
                  {/* Student row */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-blue-600 text-sm font-semibold">{student.full_name?.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{student.full_name}</div>
                        <div className="text-xs text-gray-500">{studentAttempts.length} attempt{studentAttempts.length !== 1 ? 's' : ''}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className={`inline-block text-sm font-bold px-2.5 py-1 rounded-full ${getScoreColor(best?.score, best?.passed)}`}>
                          {best?.score ?? 0}%
                        </span>
                      </div>
                      <div className="w-16 text-center">
                        {best?.passed
                          ? <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Pass</span>
                          : <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Fail</span>
                        }
                      </div>
                      <div className="text-xs text-gray-500 w-14 text-right">
                        {formatTime(best?.time_used_seconds)}
                      </div>
                    </div>
                  </div>

                  {/* Expanded: attempt list */}
                  {isExpanded && (
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 space-y-2">
                      {studentAttempts.map((attempt, ai) => {
                        const isAttemptExpanded = expandedAttempt === attempt.id
                        return (
                          <div key={attempt.id} className="bg-white rounded-lg border border-gray-200">
                            {/* Attempt summary row */}
                            <div
                              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => setExpandedAttempt(isAttemptExpanded ? null : attempt.id)}
                            >
                              <div className="flex items-center gap-3">
                                {isAttemptExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                <span className="text-xs font-medium text-gray-700">
                                  Attempt {studentAttempts.length - ai}
                                </span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getScoreColor(attempt.score, attempt.passed)}`}>
                                  {attempt.score}%
                                </span>
                                {attempt.status === 'timed_out' && (
                                  <span className="text-xs text-orange-600 flex items-center gap-1">
                                    <Clock size={10} /> Timed out
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400">{formatTime(attempt.time_used_seconds)}</span>
                                <span className="text-xs text-gray-400">
                                  {new Date(attempt.completed_at || attempt.created_at).toLocaleDateString()}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {attempt.test_question_attempts?.filter(q => q.is_correct).length || 0}/{attempt.test_question_attempts?.length || 0} correct
                                </span>
                              </div>
                            </div>

                            {/* Question details (toggled) */}
                            {isAttemptExpanded && attempt.test_question_attempts?.length > 0 && (
                              <div className="border-t border-gray-100 px-3 py-2 space-y-1.5">
                                {attempt.test_question_attempts
                                  .sort((a, b) => a.question_index - b.question_index)
                                  .map((qa, qi) => {
                                    const formatAnswer = (val) => {
                                      if (val === null || val === undefined) return '-'
                                      if (typeof val === 'object') return JSON.stringify(val)
                                      return String(val)
                                    }
                                    return (
                                      <div
                                        key={qi}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
                                          qa.is_correct ? 'bg-green-50' : 'bg-red-50'
                                        }`}
                                      >
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                          qa.is_correct ? 'bg-green-500' : 'bg-red-500'
                                        }`}>
                                          {qa.is_correct ? <CheckCircle size={12} className="text-white" /> : <XCircle size={12} className="text-white" />}
                                        </div>
                                        <span className="text-gray-500 w-8 shrink-0">Q{qi + 1}</span>
                                        <span className="text-gray-400 w-20 shrink-0 capitalize">{qa.exercise_type?.replace('_', ' ')}</span>
                                        {!qa.is_correct && (
                                          <>
                                            <span className="text-red-600 truncate max-w-[150px]" title={formatAnswer(qa.selected_answer)}>
                                              {formatAnswer(qa.selected_answer)}
                                            </span>
                                            <span className="text-gray-400">→</span>
                                            <span className="text-green-700 font-medium truncate max-w-[150px]" title={formatAnswer(qa.correct_answer)}>
                                              {formatAnswer(qa.correct_answer)}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    )
                                  })
                                }
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default TestResultsView
