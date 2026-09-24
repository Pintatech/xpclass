import { useState, useEffect, useRef } from 'react'
import { Camera, CameraOff, Circle, Square, RefreshCw } from 'lucide-react'

const MEDIAPIPE_VERSION = '1.0.1'
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

// Face mesh landmark indices
const LM = {
  eyeOuterA: 33,   // one eye's outer corner
  eyeOuterB: 263,  // other eye's outer corner
  cheekA: 234,
  cheekB: 454,
  foreheadTop: 10,
  noseTip: 1,
}

const FILTERS = [
  { id: 'none', label: 'None', emoji: '🙂' },
  { id: 'sunglasses', label: 'Cool', emoji: '🕶️' },
  { id: 'tophat', label: 'Top Hat', emoji: '🎩' },
  { id: 'crown', label: 'Crown', emoji: '👑' },
  { id: 'cat', label: 'Cat', emoji: '🐱' },
  { id: 'clown', label: 'Clown', emoji: '🤡' },
  { id: 'party', label: 'Party', emoji: '🥳' },
]

const pickMimeType = () => {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  return candidates.find(t => window.MediaRecorder?.isTypeSupported?.(t)) || ''
}

// Load the landmarker once per page load and share it between mounts
let landmarkerPromise = null
const loadLandmarker = () => {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
      const create = (delegate) => FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numFaces: 2,
      })
      try {
        return await create('GPU')
      } catch {
        return await create('CPU')
      }
    })().catch(err => {
      landmarkerPromise = null
      throw err
    })
  }
  return landmarkerPromise
}

// Convert landmarks (normalized, unmirrored) into a mirrored, pixel-space face pose
const getFacePose = (landmarks, w, h) => {
  const p = (i) => ({ x: (1 - landmarks[i].x) * w, y: landmarks[i].y * h })
  const a = p(LM.eyeOuterA)
  const b = p(LM.eyeOuterB)
  const left = a.x < b.x ? a : b
  const right = a.x < b.x ? b : a
  const cheekA = p(LM.cheekA)
  const cheekB = p(LM.cheekB)
  return {
    eyeCenter: { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 },
    angle: Math.atan2(right.y - left.y, right.x - left.x),
    eyeWidth: Math.hypot(right.x - left.x, right.y - left.y),
    faceWidth: Math.hypot(cheekB.x - cheekA.x, cheekB.y - cheekA.y),
    forehead: p(LM.foreheadTop),
    nose: p(LM.noseTip),
  }
}

// Exponential smoothing so overlays don't jitter frame to frame
const smoothPose = (prev, next, alpha = 0.5) => {
  if (!prev) return next
  const lerp = (x, y) => x + (y - x) * alpha
  const lerpPt = (u, v) => ({ x: lerp(u.x, v.x), y: lerp(u.y, v.y) })
  return {
    eyeCenter: lerpPt(prev.eyeCenter, next.eyeCenter),
    angle: lerp(prev.angle, next.angle),
    eyeWidth: lerp(prev.eyeWidth, next.eyeWidth),
    faceWidth: lerp(prev.faceWidth, next.faceWidth),
    forehead: lerpPt(prev.forehead, next.forehead),
    nose: lerpPt(prev.nose, next.nose),
  }
}

const drawEmoji = (ctx, emoji, x, y, size, angle) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, 0, 0)
  ctx.restore()
}

// Point offset from the forehead along the face's "up" direction
const aboveForehead = (pose, dist) => ({
  x: pose.forehead.x + Math.sin(pose.angle) * dist,
  y: pose.forehead.y - Math.cos(pose.angle) * dist,
})

const drawCatFace = (ctx, pose) => {
  const { faceWidth: fw, angle } = pose
  // Ears
  ctx.save()
  const top = aboveForehead(pose, fw * 0.1)
  ctx.translate(top.x, top.y)
  ctx.rotate(angle)
  for (const side of [-1, 1]) {
    const cx = side * fw * 0.32
    ctx.beginPath()
    ctx.moveTo(cx - fw * 0.16, 0)
    ctx.lineTo(cx + side * fw * 0.04, -fw * 0.38)
    ctx.lineTo(cx + fw * 0.16, 0)
    ctx.closePath()
    ctx.fillStyle = '#f97316'
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx - fw * 0.08, -fw * 0.03)
    ctx.lineTo(cx + side * fw * 0.03, -fw * 0.26)
    ctx.lineTo(cx + fw * 0.08, -fw * 0.03)
    ctx.closePath()
    ctx.fillStyle = '#fda4af'
    ctx.fill()
  }
  ctx.restore()

  // Nose + whiskers
  ctx.save()
  ctx.translate(pose.nose.x, pose.nose.y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.ellipse(0, 0, fw * 0.07, fw * 0.05, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#ec4899'
  ctx.fill()
  ctx.strokeStyle = '#1f2937'
  ctx.lineWidth = Math.max(2, fw * 0.012)
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    for (const dy of [-0.05, 0.02, 0.09]) {
      ctx.beginPath()
      ctx.moveTo(side * fw * 0.1, fw * dy * 0.6)
      ctx.lineTo(side * fw * 0.42, fw * dy * 1.6)
      ctx.stroke()
    }
  }
  ctx.restore()
}

const drawFilter = (ctx, filterId, pose) => {
  const { eyeCenter, angle, eyeWidth, faceWidth, nose } = pose
  switch (filterId) {
    case 'sunglasses':
      drawEmoji(ctx, '🕶️', eyeCenter.x, eyeCenter.y + eyeWidth * 0.05, eyeWidth * 1.35, angle)
      break
    case 'tophat': {
      const pos = aboveForehead(pose, faceWidth * 0.35)
      drawEmoji(ctx, '🎩', pos.x, pos.y, faceWidth * 0.95, angle)
      break
    }
    case 'crown': {
      const pos = aboveForehead(pose, faceWidth * 0.22)
      drawEmoji(ctx, '👑', pos.x, pos.y, faceWidth * 0.75, angle)
      break
    }
    case 'cat':
      drawCatFace(ctx, pose)
      break
    case 'clown':
      ctx.beginPath()
      ctx.arc(nose.x, nose.y, faceWidth * 0.1, 0, Math.PI * 2)
      ctx.fillStyle = '#ef4444'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(nose.x - faceWidth * 0.03, nose.y - faceWidth * 0.03, faceWidth * 0.025, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fill()
      break
    case 'party': {
      const pos = aboveForehead(pose, faceWidth * 0.3)
      drawEmoji(ctx, '🎉', pos.x, pos.y, faceWidth * 0.8, angle)
      drawEmoji(ctx, '🕶️', eyeCenter.x, eyeCenter.y + eyeWidth * 0.05, eyeWidth * 1.35, angle)
      break
    }
    default:
      break
  }
}

/**
 * Live camera with fun face filters. Records the filtered canvas + mic audio
 * and hands the result back as a File via onRecorded.
 */
const FaceFilterRecorder = ({ maxSeconds = 60, onRecorded }) => {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const landmarkerRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const posesRef = useRef([])
  const filterRef = useRef('sunglasses')
  const lastVideoTimeRef = useRef(-1)
  const timerRef = useRef(null)
  const countdownRef = useRef(null)

  const [cameraState, setCameraState] = useState('starting') // starting | ready | error
  const [cameraError, setCameraError] = useState('')
  const [modelState, setModelState] = useState('loading') // loading | ready | error
  const [filter, setFilter] = useState('sunglasses')
  const [countdown, setCountdown] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => { filterRef.current = filter }, [filter])

  useEffect(() => {
    let cancelled = false

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        setCameraState('ready')
        renderLoop()
      } catch (err) {
        console.error('Camera error:', err)
        if (cancelled) return
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Camera access was blocked. Please allow camera and microphone in your browser settings.'
            : 'Could not start the camera. Make sure no other app is using it.'
        )
        setCameraState('error')
      }
    }

    loadLandmarker()
      .then(lm => { if (!cancelled) { landmarkerRef.current = lm; setModelState('ready') } })
      .catch(err => { console.error('Face model failed to load:', err); if (!cancelled) setModelState('error') })

    start()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      clearInterval(timerRef.current)
      clearInterval(countdownRef.current)
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.onstop = null
        recorderRef.current.stop()
      }
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const renderLoop = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d')

    const tick = () => {
      const w = video.videoWidth
      const h = video.videoHeight
      if (w && h) {
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }

        // Mirrored camera frame (selfie view)
        ctx.save()
        ctx.translate(w, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, w, h)
        ctx.restore()

        const landmarker = landmarkerRef.current
        if (landmarker && video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime
          try {
            const result = landmarker.detectForVideo(video, performance.now())
            const faces = result?.faceLandmarks || []
            posesRef.current = faces.map((lms, i) => smoothPose(posesRef.current[i], getFacePose(lms, w, h)))
          } catch (err) {
            console.error('Face detection error:', err)
          }
        }

        if (filterRef.current !== 'none') {
          posesRef.current.forEach(pose => drawFilter(ctx, filterRef.current, pose))
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  const beginRecording = () => {
    const canvasStream = canvasRef.current.captureStream(30)
    const audioTracks = streamRef.current?.getAudioTracks() || []
    const mixed = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks])
    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(mixed, {
      ...(mimeType && { mimeType }),
      videoBitsPerSecond: 1_000_000,
    })
    chunksRef.current = []
    recorder.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      clearInterval(timerRef.current)
      setIsRecording(false)
      const baseType = (recorder.mimeType || mimeType || 'video/webm').split(';')[0]
      const blob = new Blob(chunksRef.current, { type: baseType })
      const ext = baseType.includes('mp4') ? 'mp4' : 'webm'
      onRecorded?.(new File([blob], `filter-video-${Date.now()}.${ext}`, { type: baseType }))
    }
    recorderRef.current = recorder
    recorder.start(1000)
    setIsRecording(true)
    setElapsed(0)
    const startedAt = Date.now()
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000)
      setElapsed(secs)
      if (secs >= maxSeconds) stopRecording()
    }, 250)
  }

  const startCountdown = () => {
    let n = 3
    setCountdown(n)
    countdownRef.current = setInterval(() => {
      n -= 1
      if (n <= 0) {
        clearInterval(countdownRef.current)
        setCountdown(0)
        beginRecording()
      } else {
        setCountdown(n)
      }
    }, 1000)
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (cameraState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 border-2 border-dashed border-red-200 rounded-xl bg-red-50 text-center">
        <CameraOff className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm text-red-700">{cameraError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
        <video ref={videoRef} playsInline muted className="absolute w-px h-px opacity-0 pointer-events-none" />
        <canvas ref={canvasRef} className="w-full h-full object-contain" />

        {cameraState === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-2">
            <Camera className="w-10 h-10 animate-pulse" />
            <span className="text-sm">Starting camera...</span>
          </div>
        )}

        {cameraState === 'ready' && modelState === 'loading' && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-black/60 text-white text-xs rounded-full">
            <RefreshCw className="w-3 h-3 animate-spin" /> Loading filters...
          </div>
        )}
        {modelState === 'error' && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded-full">
            Filters unavailable — you can still record
          </div>
        )}

        {isRecording && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white text-xs font-semibold rounded-full">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            {formatTime(elapsed)} / {formatTime(maxSeconds)}
          </div>
        )}

        {countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="text-8xl font-black text-white drop-shadow-lg">{countdown}</span>
          </div>
        )}
      </div>

      {/* Filter picker */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            disabled={modelState !== 'ready' && f.id !== 'none'}
            className={`flex-shrink-0 flex flex-col items-center gap-0.5 w-16 py-2 rounded-xl border-2 transition-all disabled:opacity-40 ${
              filter === f.id ? 'border-teal-500 bg-teal-50 scale-105' : 'border-gray-200 hover:border-teal-300'
            }`}
          >
            <span className="text-2xl leading-none">{f.emoji}</span>
            <span className="text-[10px] text-gray-600">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Record controls */}
      {!isRecording ? (
        <button
          type="button"
          onClick={startCountdown}
          disabled={cameraState !== 'ready' || countdown > 0}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
        >
          <Circle className="w-5 h-5 fill-current" />
          {countdown > 0 ? 'Get ready...' : 'Start Recording'}
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors"
        >
          <Square className="w-5 h-5 fill-current" /> Stop
        </button>
      )}
    </div>
  )
}

export default FaceFilterRecorder
