import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, MessageCircle, Trash2, Video, Star, CheckCircle, Clock, ShieldCheck } from 'lucide-react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import { saveRecentExercise } from '../../utils/recentExercise'
import LoadingSpinner from '../ui/LoadingSpinner'
import AvatarWithFrame from '../ui/AvatarWithFrame'
import TeacherExerciseNav from '../ui/TeacherExerciseNav'
import VibateComposer from './VibateComposer'

const POST_FIELDS = 'id, user_id, parent_id, caption, video_url, video_path, created_at, approved_at, users(full_name, email, avatar_url)'
const FEED_LIMIT = 30

const displayName = (u) => u?.full_name || u?.email?.split('@')[0] || 'Unknown'

const timeAgo = (iso) => {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

const VibateCard = ({ post, onOpenThread, responseCount, pendingCount = 0, canDelete, onDelete, onApprove, compact = false }) => {
  const name = displayName(post.users)
  const isPending = !post.approved_at
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${isPending ? 'border-amber-300' : 'border-gray-200'}`}>
      {isPending && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 text-amber-800 text-xs font-medium">
          <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Waiting for teacher approval</span>
          {onApprove && (
            <button
              onClick={() => onApprove(post)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-500 hover:bg-teal-600 text-white rounded-md"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Approve
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 p-3">
        <AvatarWithFrame avatarUrl={post.users?.avatar_url} size={compact ? 32 : 40} fallback={name.charAt(0).toUpperCase()} />
        <div className="flex-1 min-w-0">
          <Link to={`/profile/${post.user_id}`} className="block text-sm font-semibold text-gray-900 truncate hover:underline">
            {name}
          </Link>
          <span className="text-xs text-gray-500">{timeAgo(post.created_at)}</span>
        </div>
        {canDelete && (
          <button onClick={() => onDelete(post)} className="p-1.5 text-gray-400 hover:text-red-500" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <video src={post.video_url} controls playsInline preload="metadata" className="w-full bg-black aspect-[4/3]" />
      {(post.caption || responseCount !== undefined) && (
        <div className="p-3 space-y-2">
          {post.caption && <p className="text-sm text-gray-800 break-words">{post.caption}</p>}
          {responseCount !== undefined && (
            <button
              onClick={() => onOpenThread(post.id)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              <MessageCircle className="w-4 h-4" />
              {responseCount === 0 ? 'Be the first to respond' : `${responseCount} ${responseCount === 1 ? 'response' : 'responses'}`}
              {pendingCount > 0 && <span className="text-amber-600">· {pendingCount} pending</span>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Vibate exercise: the teacher sets a prompt, students answer with a face-filter video
 * and can reply to classmates' videos. Posting your own video completes the exercise.
 * The feed is scoped to this exercise within the session's course.
 */
const VibateExercise = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const exerciseId = searchParams.get('exerciseId')
  const sessionId = searchParams.get('sessionId')
  const postId = searchParams.get('postId')

  const { user, isAdmin, isTeacher } = useAuth()
  const { startExercise, completeExerciseWithXP, isExerciseCompleted } = useProgress()

  const [exercise, setExercise] = useState(null)
  const [session, setSession] = useState(null)
  const [posts, setPosts] = useState([])
  const [responseCounts, setResponseCounts] = useState({})
  const [pendingCounts, setPendingCounts] = useState({})
  const [notice, setNotice] = useState(null)
  const [thread, setThread] = useState(null) // { post, responses } when viewing one post
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showComposer, setShowComposer] = useState(false)
  const [xpAwarded, setXpAwarded] = useState(0)

  const courseId = session?.units?.course_id
  const isModerator = isAdmin() || isTeacher()
  const canDelete = (post) => post.user_id === user?.id || isModerator
  const content = exercise?.content || {}

  const openThread = (id) => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    if (id) next.set('postId', id)
    else next.delete('postId')
    return next
  })

  const backToSession = () => {
    if (session?.units) navigate(`/study/course/${session.units.course_id}/unit/${session.units.id}/session/${sessionId}`)
    else navigate(-1)
  }

  useEffect(() => {
    if (exerciseId && user) startExercise(exerciseId)
  }, [exerciseId, user])

  // Exercise + session (the session tells us which course's feed to show)
  useEffect(() => {
    if (!exerciseId) { setError('Exercise ID not found'); setLoading(false); return }
    const loadMeta = async () => {
      const [{ data: ex, error: exError }, sessionResult] = await Promise.all([
        supabase.from('exercises').select('*').eq('id', exerciseId).eq('exercise_type', 'vibate').single(),
        sessionId
          ? supabase.from('sessions').select('id, unit_id, units:unit_id (id, course_id)').eq('id', sessionId).single()
          : Promise.resolve({ data: null }),
      ])
      if (exError) {
        console.error('Vibate exercise load failed:', exError)
        setError('Unable to load exercise data')
        setLoading(false)
        return
      }
      setExercise(ex)
      setSession(sessionResult.data)
      try {
        saveRecentExercise({ ...ex, continuePath: `/study/vibate?exerciseId=${ex.id}&sessionId=${sessionId}` })
      } catch { }
      if (!sessionResult.data) setLoading(false)
    }
    loadMeta()
  }, [exerciseId, sessionId])

  const fetchFeed = useCallback(async () => {
    const { data, error: feedError } = await supabase
      .from('vibate_posts')
      .select(POST_FIELDS)
      .eq('exercise_id', exerciseId)
      .eq('course_id', courseId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(FEED_LIMIT)
    if (feedError) throw feedError

    const ids = data.map(p => p.id)
    const counts = {}
    const pending = {}
    if (ids.length) {
      const { data: replies, error: countError } = await supabase
        .from('vibate_posts')
        .select('parent_id, approved_at')
        .in('parent_id', ids)
      if (countError) throw countError
      // RLS already hides other students' pending replies; only moderators see pending ones from others
      replies.forEach(r => {
        const bucket = r.approved_at ? counts : pending
        bucket[r.parent_id] = (bucket[r.parent_id] || 0) + 1
      })
    }
    setPosts(data)
    setResponseCounts(counts)
    setPendingCounts(pending)
  }, [exerciseId, courseId])

  const fetchThread = useCallback(async () => {
    const [{ data: post, error: postError }, { data: responses, error: respError }] = await Promise.all([
      supabase.from('vibate_posts').select(POST_FIELDS).eq('id', postId).eq('exercise_id', exerciseId).maybeSingle(),
      supabase.from('vibate_posts').select(POST_FIELDS).eq('parent_id', postId).order('created_at', { ascending: true }),
    ])
    if (postError) throw postError
    if (respError) throw respError
    setThread(post ? { post, responses } : null)
  }, [postId, exerciseId])

  const load = useCallback(async () => {
    if (!courseId) return
    setError(null)
    try {
      await (postId ? fetchThread() : fetchFeed())
    } catch (err) {
      console.error('Vibate load failed:', err)
      setError('Could not load videos. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [courseId, postId, fetchThread, fetchFeed])

  useEffect(() => {
    load()
  }, [load])

  const handlePosted = async ({ isResponse }) => {
    load()
    if (!isModerator) setNotice('Sent! Your teacher will check your video before classmates can see it.')
    // Posting your own answer (not a reply) completes the exercise
    if (isResponse || isExerciseCompleted(exerciseId)) return
    try {
      const baseXP = exercise?.xp_reward || 10
      const result = await completeExerciseWithXP(exerciseId, baseXP, { score: 100, max_score: 100, xp_earned: baseXP })
      if (result?.xpAwarded > 0) setXpAwarded(result.xpAwarded)
    } catch (err) {
      console.error('Failed to complete Vibate exercise:', err)
    }
  }

  const handleApprove = async (post) => {
    const { error: approveError } = await supabase
      .from('vibate_posts')
      .update({ approved_at: new Date().toISOString(), approved_by: user.id })
      .eq('id', post.id)
    if (approveError) {
      console.error('Vibate approve failed:', approveError)
      window.alert('Could not approve. Please try again.')
      return
    }
    load()
  }

  const handleDelete = async (post) => {
    const isTopLevel = !post.parent_id
    const msg = isTopLevel ? 'Delete this video and all its responses?' : 'Delete this response?'
    if (!window.confirm(msg)) return

    // Gather storage paths before the row (and its cascaded responses) disappear
    let paths = [post.video_path]
    if (isTopLevel) {
      const { data: replies } = await supabase.from('vibate_posts').select('video_path').eq('parent_id', post.id)
      paths = paths.concat((replies || []).map(r => r.video_path))
    }

    const { error: deleteError } = await supabase.from('vibate_posts').delete().eq('id', post.id)
    if (deleteError) {
      console.error('Vibate delete failed:', deleteError)
      window.alert('Could not delete. Please try again.')
      return
    }
    // Best effort — storage policies may only let owners remove their own files
    supabase.storage.from('exercise-videos').remove(paths).catch(() => {})

    if (isTopLevel && postId) openThread(null)
    else load()
  }

  if (loading) return <LoadingSpinner />

  if (!exercise) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error || 'Exercise not found'}</div>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Go Back</button>
      </div>
    )
  }

  const hasPosted = posts.some(p => p.user_id === user?.id)
  const approveHandler = isModerator ? handleApprove : undefined
  const pendingTotal = isModerator && !postId
    ? posts.filter(p => !p.approved_at).length + Object.values(pendingCounts).reduce((a, b) => a + b, 0)
    : 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {isModerator && sessionId && <TeacherExerciseNav sessionId={sessionId} currentExerciseId={exerciseId} />}

      {postId ? (
        <button onClick={() => openThread(null)} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> All videos
        </button>
      ) : (
        <button onClick={backToSession} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back to exercises
        </button>
      )}

      {!postId && (
        <div className="bg-white rounded-2xl border border-gray-200 border-l-4 border-l-teal-400 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Vibate</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{exercise.title}</h1>
          {content.prompt && <p className="text-gray-800 whitespace-pre-wrap">{content.prompt}</p>}
          {content.instructions && <p className="text-sm text-gray-600 whitespace-pre-wrap">{content.instructions}</p>}
          {courseId && (
            <div className="flex items-center justify-between gap-2 pt-1">
              {hasPosted || isExerciseCompleted(exerciseId) ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700">
                  <CheckCircle className="w-4 h-4" /> Done{xpAwarded > 0 && <span className="inline-flex items-center gap-1 text-yellow-600"><Star className="w-4 h-4" /> +{xpAwarded} XP</span>}
                </span>
              ) : (
                <span className="text-sm text-gray-500">Post your video to complete this exercise.</span>
              )}
              <button
                onClick={() => setShowComposer(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-medium"
              >
                <Plus className="w-4 h-4" /> Post
              </button>
            </div>
          )}
        </div>
      )}

      {!courseId && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Open this exercise from a course session to see and post to the class feed.
        </div>
      )}

      {pendingTotal > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Clock className="w-4 h-4 flex-shrink-0" />
          {pendingTotal} {pendingTotal === 1 ? 'video is' : 'videos are'} waiting for your approval. Students can't see them until you approve.
        </div>
      )}

      {notice && (
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">{notice}</div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {courseId && (postId ? (
        !thread ? (
          !error && <p className="text-center text-gray-500 py-10">This video was removed.</p>
        ) : (
          <>
            <VibateCard post={thread.post} canDelete={canDelete(thread.post)} onDelete={handleDelete} onApprove={approveHandler} />

            <div className="flex items-center justify-between pt-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Responses ({thread.responses.length})
              </h2>
              <button
                onClick={() => setShowComposer(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-medium text-sm"
              >
                <Video className="w-4 h-4" /> Respond
              </button>
            </div>

            {thread.responses.length === 0 ? (
              <p className="text-center text-gray-500 py-6 text-sm">No responses yet. Record one!</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {thread.responses.map(r => (
                  <VibateCard key={r.id} post={r} canDelete={canDelete(r)} onDelete={handleDelete} onApprove={approveHandler} compact />
                ))}
              </div>
            )}
          </>
        )
      ) : posts.length === 0 && !error ? (
        <div className="text-center py-16 text-gray-500">
          <Video className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No videos yet. Be the first to post!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(p => (
            <VibateCard
              key={p.id}
              post={p}
              onOpenThread={openThread}
              responseCount={responseCounts[p.id] || 0}
              pendingCount={pendingCounts[p.id] || 0}
              canDelete={canDelete(p)}
              onDelete={handleDelete}
              onApprove={approveHandler}
            />
          ))}
        </div>
      ))}

      {showComposer && courseId && (
        <VibateComposer
          exerciseId={exerciseId}
          courseId={courseId}
          parentId={postId && thread ? thread.post.id : null}
          maxSeconds={content.max_duration_seconds || 60}
          onClose={() => setShowComposer(false)}
          onPosted={handlePosted}
        />
      )}
    </div>
  )
}

export default VibateExercise
