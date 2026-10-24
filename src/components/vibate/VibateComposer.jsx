import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, RefreshCw, Send } from 'lucide-react'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../hooks/useAuth'
import FaceFilterRecorder from '../exercises/FaceFilterRecorder'

/**
 * Modal: record a face-filter video, preview it, then post it.
 * Pass parentId to post it as a video response to that post.
 */
const VibateComposer = ({ exerciseId, courseId, parentId = null, maxSeconds = 60, onClose, onPosted }) => {
  const { user, isAdmin, isTeacher } = useAuth()
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handlePost = async () => {
    if (!file || !user) return
    setPosting(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop() || 'webm'
      const videoPath = `${user.id}/vibate/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('exercise-videos')
        .upload(videoPath, file, { contentType: file.type })
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      const { data: urlData } = supabase.storage.from('exercise-videos').getPublicUrl(videoPath)

      const { error: insertError } = await supabase.from('vibate_posts').insert({
        exercise_id: exerciseId,
        course_id: courseId,
        user_id: user.id,
        parent_id: parentId,
        caption: caption.trim() || null,
        video_url: urlData.publicUrl,
        video_path: videoPath,
        // Teachers' own posts skip the approval queue; students' always wait for a teacher
        ...((isAdmin() || isTeacher()) && { approved_at: new Date().toISOString(), approved_by: user.id }),
      })
      if (insertError) {
        await supabase.storage.from('exercise-videos').remove([videoPath])
        throw new Error(insertError.message)
      }

      onPosted?.({ isResponse: !!parentId })
      onClose()
    } catch (err) {
      console.error('Vibate post failed:', err)
      setError(err.message || 'Could not post your video. Please try again.')
      setPosting(false)
    }
  }

  // Portal to body so page wrappers can't clip the fullscreen overlay
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {parentId ? 'Reply with a video' : 'New Vibate'}
          </h2>
          <button onClick={onClose} disabled={posting} className="p-1 text-gray-500 hover:text-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!file ? (
          <FaceFilterRecorder maxSeconds={maxSeconds} onRecorded={setFile} />
        ) : (
          <>
            <video src={previewUrl} controls playsInline className="w-full rounded-xl bg-black aspect-[4/3]" />
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              placeholder={parentId ? 'Add a message (optional)' : 'Say something about your video (optional)'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-teal-500"
            />
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setFile(null)}
                disabled={posting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" /> Retake
              </button>
              <button
                onClick={handlePost}
                disabled={posting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 text-white rounded-lg font-medium"
              >
                {posting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {posting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

export default VibateComposer
