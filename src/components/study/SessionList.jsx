import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import {
  ArrowLeft,
  Star,
  Lock,
  CheckCircle,
  BookOpen,
  Clock,
  ArrowRight,
  Target,
  PlayCircle,
  Mic,
  Volume2,
  PenTool,
  Brain,
  MessageSquare,
  CreditCard,
  Music2,
  Brush,
  Globe,
  Dice6,
  Dumbbell,
  MessageCircle
} from 'lucide-react'

const SessionList = () => {
  const { levelId, unitId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [level, setLevel] = useState(null)
  const [unit, setUnit] = useState(null)
  const [sessions, setSessions] = useState([])
  const [sessionProgress, setSessionProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()

  useEffect(() => {
    if (user && levelId && unitId) {
      fetchData()
    }
  }, [user, levelId, unitId, location.key])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch level info
      const { data: levelData, error: levelError } = await supabase
        .from('levels')
        .select('*')
        .eq('id', levelId)
        .single()

      if (levelError) throw levelError

      // Fetch unit info
      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .select('*')
        .eq('id', unitId)
        .single()

      if (unitError) throw unitError

      // Fetch sessions for this unit
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('unit_id', unitId)
        .eq('is_active', true)
        .order('session_number')

      if (sessionsError) throw sessionsError

      // Fetch user's session progress (explicit session_progress rows)
      const { data: progressData, error: progressError } = await supabase
        .from('session_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('session_id', sessionsData?.map(s => s.id) || [])

      if (progressError) throw progressError

      // Fetch all exercises for these sessions
      const sessionIds = sessionsData?.map(s => s.id) || []
      const { data: allExercises, error: exercisesErr } = await supabase
        .from('exercises')
        .select('id, session_id, xp_reward, is_active')
        .in('session_id', sessionIds)
        .eq('is_active', true)

      if (exercisesErr) throw exercisesErr

      const exerciseIds = allExercises?.map(e => e.id) || []

      // Fetch user's completed exercises among these
      const { data: userCompleted, error: userProgErr } = await supabase
        .from('user_progress')
        .select('exercise_id, status')
        .eq('user_id', user.id)
        .in('exercise_id', exerciseIds)

      if (userProgErr) throw userProgErr

      // Build maps
      const sessionIdToExercises = {}
      allExercises?.forEach(ex => {
        if (!sessionIdToExercises[ex.session_id]) sessionIdToExercises[ex.session_id] = []
        sessionIdToExercises[ex.session_id].push(ex)
      })

      const completedSet = new Set(
        (userCompleted || []).filter(p => p.status === 'completed').map(p => p.exercise_id)
      )

      // Create progress map, merging DB session_progress with computed from exercise completions
      const progressMap = {}

      // Seed with DB rows first
      progressData?.forEach(progress => {
        progressMap[progress.session_id] = progress
      })

      // Fill/override computed fields
      sessionsData?.forEach(s => {
        const list = sessionIdToExercises[s.id] || []
        const total = list.length
        const completedCount = list.filter(ex => completedSet.has(ex.id)).length
        const xpEarned = list
          .filter(ex => completedSet.has(ex.id))
          .reduce((sum, ex) => sum + (ex.xp_reward || 0), 0)
        const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0

        const existing = progressMap[s.id]
        if (existing) {
          // Merge: prefer explicit completed status, but update xp/progress if higher
          progressMap[s.id] = {
            ...existing,
            xp_earned: Math.max(existing.xp_earned || 0, xpEarned),
            progress_percentage: Math.max(existing.progress_percentage || 0, percentage)
          }
        } else {
          progressMap[s.id] = {
            user_id: user.id,
            session_id: s.id,
            status: total > 0 && completedCount === total ? 'completed' : 'in_progress',
            xp_earned: xpEarned,
            progress_percentage: percentage
          }
        }
      })

      setLevel(levelData)
      setUnit(unitData)
      setSessions(sessionsData || [])
      setSessionProgress(progressMap)
    } catch (err) {
      console.error('Error fetching sessions:', err)
      setError('Không thể tải danh sách session')
    } finally {
      setLoading(false)
    }
  }

  const getSessionImageUrl = (sessionNumber) => {
    const images = {
      1: 'https://xpclass.vn/momtek/svg%20icon/Vocab.svg',
      2: 'https://xpclass.vn/momtek/svg%20icon/Flashcard.svg',
      3: 'https://xpclass.vn/momtek/svg%20icon/Flashcard.svg',
      4: 'https://xpclass.vn/momtek/svg%20icon/Creativity.svg',
      5: 'https://xpclass.vn/momtek/svg%20icon/Quiz.svg',
      6: 'https://xpclass.vn/momtek/svg%20icon/Games.svg',
      7: 'https://xpclass.vn/momtek/svg%20icon/Practice.svg',
      8: 'https://xpclass.vn/momtek/svg%20icon/Test.svg'
    }
    return images[sessionNumber] || images[1]
  }

  const getSessionGrayImageUrl = (sessionNumber) => {
    const images = {
      1: 'https://xpclass.vn/momtek/svg%20icon/gray%20vocab.svg',
      2: 'https://xpclass.vn/momtek/svg%20icon/gray%20flashcard.svg',
      3: 'https://xpclass.vn/momtek/svg%20icon/gray%20flashcard.svg',
      4: 'https://xpclass.vn/momtek/svg%20icon/gray%20creativity.svg',
      5: 'https://xpclass.vn/momtek/svg%20icon/gray%20quiz.svg',
      6: 'https://xpclass.vn/momtek/svg%20icon/gray%20game.svg',
      7: 'https://xpclass.vn/momtek/svg%20icon/gray%20practice.svg',
      8: 'https://xpclass.vn/momtek/svg%20icon/gray%20test.svg'
    }
    return images[sessionNumber] || images[1]
  }

  const getSessionTypeIcon = (sessionType) => {
    const icons = {
      vocabulary: BookOpen,
      grammar: PenTool,
      pronunciation: Mic,
      listening: Volume2,
      mixed: Brain
    }
    return icons[sessionType] || MessageSquare
  }

  const getSessionTypeColor = (sessionType) => {
    const colors = {
      vocabulary: 'text-blue-600 bg-blue-100',
      grammar: 'text-green-600 bg-green-100',
      pronunciation: 'text-red-600 bg-red-100',
      listening: 'text-purple-600 bg-purple-100',
      mixed: 'text-orange-600 bg-orange-100'
    }
    return colors[sessionType] || 'text-gray-600 bg-gray-100'
  }

  const getThemeColors = (colorTheme) => {
    const themes = {
      green: {
        bg: 'from-green-400 to-emerald-500',
        text: 'text-green-700',
        border: 'border-green-200',
        icon: 'bg-green-100 text-green-600'
      },
      blue: {
        bg: 'from-blue-400 to-indigo-500',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: 'bg-blue-100 text-blue-600'
      },
      purple: {
        bg: 'from-purple-400 to-pink-500',
        text: 'text-purple-700',
        border: 'border-purple-200',
        icon: 'bg-purple-100 text-purple-600'
      },
      orange: {
        bg: 'from-orange-400 to-red-500',
        text: 'text-orange-700',
        border: 'border-orange-200',
        icon: 'bg-orange-100 text-orange-600'
      }
    }
    return themes[colorTheme] || themes.blue
  }

  const getSessionStatus = (session, index) => {
    const progress = sessionProgress[session.id]

    // All sessions are now always available (unlocked)
    if (!progress) {
      return { status: 'available', canAccess: true }
    }

    return {
      status: progress.status,
      canAccess: true // Always allow access
    }
  }

  const handleSessionClick = async (session) => {
    try {
      // Check how many exercises this session has
      const { data: exercises, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('session_id', session.id)
        .eq('is_active', true)
        .order('order_index')

      if (error) throw error

      // Check if this is a vocab session (session_number 1 or contains both combined_learning and sentence_pronunciation)
      const hasCombinedLearning = exercises?.some(ex => ex.exercise_type === 'combined_learning')
      const hasSentencePronunciation = exercises?.some(ex => ex.exercise_type === 'sentence_pronunciation')
      const isVocabSession = session.session_number === 1 || (hasCombinedLearning && hasSentencePronunciation) || hasCombinedLearning

      if (isVocabSession && hasCombinedLearning) {
        // Navigate to vocab session wrapper (no specific exerciseId since we handle multiple pairs)
        navigate(`/study/vocab-session?sessionId=${session.id}`)
        return
      }

      if (exercises && exercises.length === 1) {
        // If only one exercise, navigate directly to the exercise
        const exercise = exercises[0]
        const paths = {
          combined_learning: '/study/combined-learning',
          flashcard: '/study/flashcard',
          audio_flashcard: '/study/audio-flashcard',
          snake_ladder: '/study/snake-ladder',
          two_player: '/study/two-player-game',
          sentence_pronunciation: '/study/sentence-pronunciation'
        }
        const exercisePath = paths[exercise.exercise_type] || '/study/flashcard'
        navigate(`${exercisePath}?exerciseId=${exercise.id}&sessionId=${session.id}`)
      } else if (exercises && exercises.length > 1) {
        // If multiple exercises, go to exercise list
        navigate(`/study/level/${levelId}/unit/${unitId}/session/${session.id}`)
      } else {
        // If no exercises, go to exercise list
        navigate(`/study/level/${levelId}/unit/${unitId}/session/${session.id}`)
      }
    } catch (err) {
      console.error('Error checking exercises:', err)
      // Fallback to exercise list
      navigate(`/study/level/${levelId}/unit/${unitId}/session/${session.id}`)
    }
  }

  const renderSessionCard = (session, index) => {
    const { status, canAccess } = getSessionStatus(session, index)
    const isCompleted = status === 'completed'
    const progress = sessionProgress[session.id]
    const theme = getThemeColors(unit?.color_theme || level?.color_theme)
    const isLocked = !canAccess
    const sessionNumber = session.session_number || index + 1
    const sessionImageUrl = getSessionImageUrl(sessionNumber)
    const sessionGrayImageUrl = getSessionGrayImageUrl(sessionNumber)
    const isFirstItem = index === 0

    return (
      <div
        key={session.id}
        onClick={() => !isLocked && handleSessionClick(session)}
        className={`block ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} w-full h-full`}
      >
        <div
          className={`relative overflow-hidden rounded-xl border border-black transition-all duration-300 ${isLocked
              ? 'opacity-60'
              : 'hover:shadow-lg hover:scale-105'
            } w-full h-full`}
          style={{ aspectRatio: '1' }}
        >
          {/* Session Image */}
          {session.image_url ? (
            <>
              <img 
                src={session.image_url} 
                alt={session.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to gradient background if image fails
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'block'
                }}
              />
              {/* Overlay icon */}
              <div className={`absolute inset-0 flex items-center justify-center ${isCompleted ? 'bg-blue-700' : 'bg-gray-100'}`}>
                <img src={isCompleted ? sessionImageUrl : sessionGrayImageUrl} alt="" className="w-12 h-12" />
              </div>
              {/* Fallback background */}
              <div 
                className={`absolute inset-0 flex items-center justify-center ${isCompleted ? 'bg-blue-500' : 'bg-gray-200'}`}
                style={{ display: 'none' }}
              >
                <img src={isCompleted ? sessionImageUrl : sessionGrayImageUrl} alt="" className="w-12 h-12" />
              </div>
            </>
          ) : (
            /* Fallback when no image */
            <div className={`absolute inset-0 flex items-center justify-center ${isCompleted ? 'bg-blue-700' : 'bg-gray-100'}`}>
              <img src={isCompleted ? sessionImageUrl : sessionGrayImageUrl} alt="" className="w-12 h-12" />
            </div>
          )}

          {/* Progress bar overlay removed per design */}

          {/* Overlay with status icon - only show lock when inaccessible */}
          {isLocked && (
            <div className="absolute top-2 right-2">
              <div className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Lock className="w-3 h-3 text-gray-600" />
              </div>
            </div>
          )}



        </div>
        {/* Title below SVG/image */}
        <div className="pt-2 text-center">
          <h3 className="text-black font-bold text-sm truncate">{session.title}</h3>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={fetchData} variant="outline">
          Thử lại
        </Button>
      </div>
    )
  }

  if (!unit || !level) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">Không tìm thấy thông tin</div>
        <Button onClick={() => navigate(`/study/level/${levelId}`)} variant="outline">
          Quay lại
        </Button>
      </div>
    )
  }

  const theme = getThemeColors(unit.color_theme || level.color_theme)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/study/level/${levelId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{unit.title}</h1>
            <p className="text-gray-600">{unit.description}</p>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <Link to="/study" className="hover:text-primary-600">{level.title}</Link>
        <ArrowRight className="w-4 h-4" />
        <span className="text-gray-900 font-medium">{unit.title}</span>
      </div>

      {/* Unit progress summary */}
      <Card className={`bg-gradient-to-r from-${unit.color_theme || level.color_theme}-50 to-${unit.color_theme || level.color_theme}-100 border-${unit.color_theme || level.color_theme}-200`}>
        <Card.Content className="p-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className={`text-2xl font-bold ${theme.text}`}>
                {Object.values(sessionProgress).filter(p => p.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-600">Sessions hoàn thành</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${theme.text}`}>
                {Object.values(sessionProgress).reduce((total, p) => total + (p.xp_earned || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">XP đã kiếm</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${theme.text}`}>
                {Math.round(Object.values(sessionProgress).reduce((total, p) => total + (p.progress_percentage || 0), 0) / Math.max(sessions.length, 1))}%
              </div>
              <div className="text-sm text-gray-600">Tổng tiến độ</div>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Sessions grid */}
      <div className="relative">
        {/* Create ordered sessions array: left column (1,2,5,6) and right column (3,4,7,8) */}
        {(() => {
          const leftColumnSessions = []
          const rightColumnSessions = []

          // Sort sessions by session_number to ensure correct order
          const sortedSessions = [...sessions].sort((a, b) => (a.session_number || 0) - (b.session_number || 0))

          // Arrange sessions according to the specified layout
          sortedSessions.forEach((session, index) => {
            const sessionNum = session.session_number || (index + 1)
            if ([1, 2, 5, 6].includes(sessionNum)) {
              leftColumnSessions.push({ session, originalIndex: index })
            } else if ([3, 4, 7, 8].includes(sessionNum)) {
              rightColumnSessions.push({ session, originalIndex: index })
            }
          })

          return (
            <div className="space-y-12 relative">

              {/* First row: Session 1 only */}
              {leftColumnSessions.find(({ session }) => (session.session_number || 0) === 1) && (
                <div className="flex justify-start relative" style={{ zIndex: 1 }}>
                  <div className="w-32 h-32 relative">
                    {renderSessionCard(leftColumnSessions.find(({ session }) => (session.session_number || 0) === 1).session, leftColumnSessions.find(({ session }) => (session.session_number || 0) === 1).originalIndex)}
                    {/* Connection line down to session 2 */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0.5 h-12 border-l-2 border-dashed border-blue-400"></div>
                  </div>
                </div>
              )}

              {/* Second row: Sessions 2 and 3 */}
              {(() => {
                const session2 = leftColumnSessions.find(({ session }) => (session.session_number || 0) === 2)
                const session3 = rightColumnSessions.find(({ session }) => (session.session_number || 0) === 3)

                if (session2 || session3) {
                  return (
                    <div className="flex justify-between relative" style={{ zIndex: 1 }}>
                      <div className="w-32 h-32 relative">
                        {session2 && renderSessionCard(session2.session, session2.originalIndex)}
                        {/* Connection line to right (session 3) */}
                        {session2 && session3 && (
                          <div className="absolute top-1/2 left-full transform -translate-y-1/2 h-0.5 w-full border-t-2 border-dashed border-blue-400"></div>
                        )}
                      </div>
                      <div className="w-32 h-32 relative">
                        {session3 && renderSessionCard(session3.session, session3.originalIndex)}
                        {/* Connection line down to session 4 */}
                        {session3 && (
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0.5 h-12 border-l-2 border-dashed border-blue-400"></div>
                        )}
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* Third row: Sessions 4 and 5 */}
              {(() => {
                const session4 = rightColumnSessions.find(({ session }) => (session.session_number || 0) === 4)
                const session5 = leftColumnSessions.find(({ session }) => (session.session_number || 0) === 5)

                if (session4 || session5) {
                  return (
                    <div className="flex justify-between relative" style={{ zIndex: 1 }}>
                      <div className="w-32 h-32 relative">
                        {session5 && renderSessionCard(session5.session, session5.originalIndex)}
                        {/* Connection line to right (session 4) */}
                        {session5 && session4 && (
                          <div className="absolute top-1/2 left-full transform -translate-y-1/2 h-0.5 w-full border-t-2 border-dashed border-blue-400"></div>
                        )}
                        {/* Connection line down to session 6 */}
                        {session5 && (
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0.5 h-12 border-l-2 border-dashed border-blue-400"></div>
                        )}
                      </div>
                      <div className="w-32 h-32 relative">
                        {session4 && renderSessionCard(session4.session, session4.originalIndex)}
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* Fourth row: Sessions 6 and 7 */}
              {(() => {
                const session6 = leftColumnSessions.find(({ session }) => (session.session_number || 0) === 6)
                const session7 = rightColumnSessions.find(({ session }) => (session.session_number || 0) === 7)

                if (session6 || session7) {
                  return (
                    <div className="flex justify-between relative" style={{ zIndex: 1 }}>
                      <div className="w-32 h-32 relative">
                        {session6 && renderSessionCard(session6.session, session6.originalIndex)}
                        {/* Connection line to right (session 7) */}
                        {session6 && session7 && (
                          <div className="absolute top-1/2 left-full transform -translate-y-1/2 h-0.5 w-full border-t-2 border-dashed border-blue-400"></div>
                        )}
                      </div>
                      <div className="w-32 h-32 relative">
                        {session7 && renderSessionCard(session7.session, session7.originalIndex)}
                        {/* Connection line down to session 8 */}
                        {session7 && (
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0.5 h-12 border-l-2 border-dashed border-blue-400"></div>
                        )}
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              {/* Fifth row: Session 8 only */}
              {rightColumnSessions.find(({ session }) => (session.session_number || 0) === 8) && (
                <div className="flex justify-end relative" style={{ zIndex: 1 }}>
                  <div className="w-32 h-32 relative">
                    {renderSessionCard(rightColumnSessions.find(({ session }) => (session.session_number || 0) === 8).session, rightColumnSessions.find(({ session }) => (session.session_number || 0) === 8).originalIndex)}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có session nào</h3>
          <p className="text-gray-600">Các session học tập sẽ sớm được cập nhật!</p>
        </div>
      )}
    </div>
  )
}

export default SessionList
