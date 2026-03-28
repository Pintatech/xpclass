import React from 'react'
import { CheckCircle, XCircle, Edit3, RefreshCw } from 'lucide-react'

// --- Type-specific renderers ---

const MultipleChoiceReview = ({ question, attempt }) => {
  const options = question.options || []
  const correct = question.correct_answer

  // Try index first, then fall back to matching by option text
  let selected = typeof attempt.selected_answer === 'number'
    ? attempt.selected_answer
    : parseInt(attempt.selected_answer)
  if (isNaN(selected)) {
    selected = options.findIndex(opt => opt === attempt.selected_answer)
  }

  if (!options.length) return <GenericReview attempt={attempt} />

  return (
    <div className="space-y-2">
      {question.question && (
        <div className="text-sm text-gray-800 leading-relaxed mb-2"
          dangerouslySetInnerHTML={{ __html: question.question }} />
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((opt, i) => {
          const isCorrect = i === correct
          const isSelected = i === selected
          let cls = 'border-gray-200 bg-gray-50'
          if (isCorrect) cls = 'border-green-400 bg-green-50'
          else if (isSelected) cls = 'border-red-400 bg-red-50'
          return (
            <div key={i} className={`flex items-center gap-3 px-3 py-2 border rounded-lg ${cls}`}>
              <div className="shrink-0">
                {isCorrect
                  ? <CheckCircle className="w-4 h-4 text-green-500" />
                  : isSelected
                    ? <XCircle className="w-4 h-4 text-red-500" />
                    : <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                }
              </div>
              <span className={`text-sm flex-1 ${isCorrect ? 'text-green-800 font-medium' : isSelected ? 'text-red-800' : 'text-gray-700'}`}>
                {opt}
              </span>
              {isCorrect && isSelected && <span className="text-xs text-green-600 font-medium shrink-0">Your answer ✓</span>}
              {isCorrect && !isSelected && <span className="text-xs text-green-600 font-medium shrink-0">Correct</span>}
              {isSelected && !isCorrect && <span className="text-xs text-red-600 font-medium shrink-0">Your answer</span>}
            </div>
          )
        })}
      </div>
      {question.explanation && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800 mt-2">
          <strong>Explanation:</strong> {question.explanation}
        </div>
      )}
    </div>
  )
}

const FillBlankReview = ({ question, attempt }) => {
  // selected_answer stored as "ans1, ans2, ans3" (one per blank)
  const selectedParts = (attempt.selected_answer || '').split(', ')
  const correctParts = (attempt.correct_answer || '').split(', ')

  const isBlankCorrect = (ans, correctRaw) =>
    (correctRaw || '').split('|').some(a => a.trim().toLowerCase() === (ans || '').trim().toLowerCase())

  // Reconstruct sentence inline if question has _____ markers
  const parts = (question.question || '').split(/_{3,}/)
  if (parts.length > 1) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-800 leading-loose">
          {parts.map((part, i) => {
            const studentAns = selectedParts[i]
            const correctAns = correctParts[i]
            if (i >= parts.length - 1) return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
            const ok = isBlankCorrect(studentAns, correctAns)
            return (
              <React.Fragment key={i}>
                <span dangerouslySetInnerHTML={{ __html: part }} />
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded font-medium ${
                  ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {studentAns || '—'}
                  {!ok && correctAns && (
                    <span className="text-green-700">→ {correctAns.split('|')[0].trim()}</span>
                  )}
                  {ok
                    ? <CheckCircle size={11} className="text-green-500 shrink-0" />
                    : <XCircle size={11} className="text-red-500 shrink-0" />
                  }
                </span>
              </React.Fragment>
            )
          })}
        </p>
        {question.explanation && (
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
            <strong>Explanation:</strong> {question.explanation}
          </div>
        )}
      </div>
    )
  }

  // Fallback list
  return (
    <div className="space-y-2">
      {question.question && <p className="text-sm text-gray-700 leading-relaxed">{question.question}</p>}
      {selectedParts.map((ans, i) => {
        const correctAns = correctParts[i]
        const ok = isBlankCorrect(ans, correctAns)
        return (
          <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            {ok ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
            <span className={`font-medium ${ok ? 'text-green-800' : 'text-red-800'}`}>{ans || '—'}</span>
            {!ok && correctAns && <><span className="text-gray-400">→</span><span className="font-medium text-green-800">{correctAns.split('|')[0].trim()}</span></>}
          </div>
        )
      })}
    </div>
  )
}

const DragDropReview = ({ question, attempt }) => {
  const items = question.items || []
  const dropZones = question.drop_zones || []
  const correctOrder = question.correct_order || []

  const getItemText = (itemId) => items.find(it => it.id === itemId)?.text || itemId

  let userPlacements = {}
  try {
    userPlacements = typeof attempt.selected_answer === 'object'
      ? attempt.selected_answer
      : JSON.parse(attempt.selected_answer || '{}')
  } catch { userPlacements = {} }

  const hasDropZonePlaceholders = question.question?.includes('[DROP_ZONE_')

  if (hasDropZonePlaceholders) {
    const parts = question.question.split(/\[DROP_ZONE_([^\]]+)\]/)
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-800 leading-loose">
          {parts.map((part, i) => {
            if (i % 2 === 0) return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
            const zoneId = part
            const zoneIndex = dropZones.findIndex(z => z.id === zoneId)
            const studentItemId = userPlacements[zoneId]
            const correctItemId = correctOrder[zoneIndex]
            const isCorrect = studentItemId === correctItemId
            return (
              <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded font-medium ${
                isCorrect ? 'bg-green-100 text-green-800' : studentItemId ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {studentItemId ? getItemText(studentItemId) : '—'}
                {!isCorrect && correctItemId && <span className="text-green-700">→ {getItemText(correctItemId)}</span>}
                {isCorrect ? <CheckCircle size={11} className="text-green-500 shrink-0" /> : <XCircle size={11} className="text-red-500 shrink-0" />}
              </span>
            )
          })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {question.question && <p className="text-sm text-gray-800 mb-2">{question.question}</p>}
      <div className="space-y-1.5">
        {dropZones.map((zone, i) => {
          const studentItemId = userPlacements[zone.id]
          const correctItemId = correctOrder[i]
          const isCorrect = studentItemId === correctItemId
          return (
            <div key={zone.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${
              isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              {isCorrect ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
              <span className="text-gray-500 shrink-0">{zone.label || `Zone ${i + 1}`}:</span>
              <span className={`font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                {studentItemId ? getItemText(studentItemId) : '(empty)'}
              </span>
              {!isCorrect && correctItemId && (
                <><span className="text-gray-400">→</span><span className="font-medium text-green-800">{getItemText(correctItemId)}</span></>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const DropdownReview = ({ question, attempt }) => {
  const boldBrackets = (text) => text.replace(/(\[[^\]]+\])/g, '<strong>$1</strong>')
  const selectedParts = (attempt.selected_answer || '').split(', ')

  return (
    <div className="space-y-2">
      {question.question && (
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: boldBrackets(question.question) }} />
      )}
      <div className="space-y-1.5">
        {(question.dropdowns || []).map((dd, i) => {
          const studentAns = (selectedParts[i] || '').trim()
          const correctAns = (dd.correct_answer || '').trim()
          const isCorrect = studentAns === correctAns
          return (
            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              {isCorrect ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
              {dd.label && <span className="text-gray-500">{dd.label}:</span>}
              <span className={`font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>{studentAns || '(none)'}</span>
              {!isCorrect && correctAns && <><span className="text-gray-400">→</span><span className="font-medium text-green-800">{correctAns}</span></>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const GenericReview = ({ attempt }) => {
  const fmt = (val) => {
    if (!val) return '(no answer)'
    if (typeof val === 'object') return JSON.stringify(val, null, 2)
    return String(val)
  }
  return (
    <div className="space-y-2">
      <div className={`p-3 rounded-lg border ${attempt.is_correct ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
        <span className="text-xs font-medium text-gray-500 block mb-1">Your answer</span>
        <pre className="text-sm whitespace-pre-wrap font-sans">{fmt(attempt.selected_answer)}</pre>
      </div>
      {!attempt.is_correct && attempt.correct_answer && (
        <div className="p-3 rounded-lg border border-green-300 bg-green-50">
          <span className="text-xs font-medium text-green-700 block mb-1">Correct answer</span>
          <pre className="text-sm whitespace-pre-wrap font-sans">{fmt(attempt.correct_answer)}</pre>
        </div>
      )}
    </div>
  )
}

// --- Main component ---

const SingleExerciseReview = ({ exercise, questionAttempts, onOverride, overriding }) => {
  const questions = exercise?.content?.questions || []
  const type = exercise?.exercise_type

  const reviewItems = questions
    .map(q => ({ question: q, attempt: questionAttempts.find(a => a.question_id === q.id) }))
    .filter(item => item.attempt)

  const renderQuestion = (question, attempt) => {
    switch (type) {
      case 'multiple_choice': return <MultipleChoiceReview question={question} attempt={attempt} />
      case 'fill_blank': return <FillBlankReview question={question} attempt={attempt} />
      case 'dropdown': return <DropdownReview question={question} attempt={attempt} />
      case 'drag_drop': return <DragDropReview question={question} attempt={attempt} />
      default: return <GenericReview attempt={attempt} />
    }
  }

  if (!reviewItems.length) {
    return <p className="text-gray-500 text-sm text-center py-4">No question attempts to review.</p>
  }

  return (
    <div className="space-y-6">
      {reviewItems.map((item, i) => (
        <div key={item.attempt.id}>
          <div className="flex items-center justify-between gap-2 mb-3">
            {reviewItems.length > 1
              ? <span className="text-base font-semibold text-gray-700">Question {i + 1}</span>
              : <span />
            }
            <div className="flex items-center gap-2">
              {item.attempt.manually_overridden && (
                <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full flex items-center gap-1">
                  <Edit3 size={9} /> Overridden
                </span>
              )}
              <button
                onClick={() => onOverride(item.attempt.id, item.attempt.is_correct)}
                disabled={overriding === item.attempt.id}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors disabled:opacity-50"
              >
                {overriding === item.attempt.id
                  ? <RefreshCw size={11} className="animate-spin" />
                  : <Edit3 size={11} />
                }
                {item.attempt.is_correct ? 'Mark incorrect' : 'Mark correct'}
              </button>
            </div>
          </div>

          {renderQuestion(item.question, item.attempt)}

          {i < reviewItems.length - 1 && <hr className="border-gray-100 mt-4" />}
        </div>
      ))}
    </div>
  )
}

export default SingleExerciseReview
