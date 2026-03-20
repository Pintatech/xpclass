import React, { useState } from 'react'
import { X, Eye, EyeOff, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import RichTextRenderer from '../ui/RichTextRenderer'

const QuestionModal = ({ exercise, onClose }) => {
  const questions = exercise?.content?.questions || []
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)

  if (questions.length === 0) return null

  const q = questions[currentIndex]
  const exerciseType = exercise.exercise_type

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setShowAnswer(false)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setShowAnswer(false)
    }
  }

  const renderQuestion = () => {
    switch (exerciseType) {
      case 'multiple_choice':
        return <MultipleChoiceQuestion q={q} showAnswer={showAnswer} />
      case 'fill_blank':
        return <FillBlankQuestion q={q} showAnswer={showAnswer} />
      case 'dropdown':
        return <DropdownQuestion q={q} showAnswer={showAnswer} />
      case 'flashcard':
        return <FlashcardQuestion q={q} showAnswer={showAnswer} />
      default:
        return <div className="text-gray-500 text-center">Unsupported question type</div>
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            <span className="font-bold text-gray-800 truncate max-w-xs">{exercise.title}</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {currentIndex + 1} / {questions.length}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Question content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderQuestion()}
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>

          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              showAnswer
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            }`}
          >
            {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showAnswer ? 'Hide Answer' : 'Show Answer'}
          </button>

          <button
            onClick={goNext}
            disabled={currentIndex === questions.length - 1}
            className="flex items-center gap-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// === Question type renderers ===

const MultipleChoiceQuestion = ({ q, showAnswer }) => {
  const correctIndex = q.correct_answer

  return (
    <div className="space-y-4">
      {/* Question text */}
      <div className="text-lg font-semibold text-gray-800">
        <RichTextRenderer content={q.question} />
      </div>

      {/* Question image */}
      {q.image_url && (
        <div className="flex justify-center">
          <img src={q.image_url} alt="" className="max-h-60 rounded-xl object-contain" />
        </div>
      )}

      {/* Options */}
      <div className="grid gap-2">
        {(q.options || []).map((opt, idx) => {
          const isCorrect = idx === correctIndex
          let style = 'bg-gray-50 border-gray-200 text-gray-700'
          if (showAnswer && isCorrect) {
            style = 'bg-green-50 border-green-400 text-green-800 ring-2 ring-green-300'
          }

          return (
            <div
              key={idx}
              className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${style}`}
            >
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border text-xs font-bold mr-3">
                {String.fromCharCode(65 + idx)}
              </span>
              <RichTextRenderer content={opt} />
            </div>
          )
        })}
      </div>

      {/* Explanation */}
      {showAnswer && q.explanation && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <span className="font-bold">Explanation:</span> <RichTextRenderer content={q.explanation} />
        </div>
      )}
    </div>
  )
}

const FillBlankQuestion = ({ q, showAnswer }) => {
  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold text-gray-800">
        <RichTextRenderer content={q.question} />
      </div>

      {q.image_url && (
        <div className="flex justify-center">
          <img src={q.image_url} alt="" className="max-h-60 rounded-xl object-contain" />
        </div>
      )}

      {showAnswer && (
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
          <div className="text-xs text-green-600 font-semibold mb-1 uppercase">Answer</div>
          <div className="text-lg font-bold text-green-800">
            {Array.isArray(q.answers) ? q.answers.join(' / ') : q.answer || q.correct_answer || '—'}
          </div>
        </div>
      )}

      {showAnswer && q.explanation && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <span className="font-bold">Explanation:</span> <RichTextRenderer content={q.explanation} />
        </div>
      )}
    </div>
  )
}

const DropdownQuestion = ({ q, showAnswer }) => {
  // Dropdown questions typically have blanks with options
  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold text-gray-800">
        <RichTextRenderer content={q.question} />
      </div>

      {q.image_url && (
        <div className="flex justify-center">
          <img src={q.image_url} alt="" className="max-h-60 rounded-xl object-contain" />
        </div>
      )}

      {showAnswer && (
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
          <div className="text-xs text-green-600 font-semibold mb-1 uppercase">Answer</div>
          {q.blanks ? (
            <div className="space-y-1">
              {q.blanks.map((blank, idx) => (
                <div key={idx} className="text-base font-bold text-green-800">
                  {blank.label || `Blank ${idx + 1}`}: {blank.correct || blank.answer || '—'}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-lg font-bold text-green-800">
              {q.correct_answer || q.answer || '—'}
            </div>
          )}
        </div>
      )}

      {showAnswer && q.explanation && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <span className="font-bold">Explanation:</span> <RichTextRenderer content={q.explanation} />
        </div>
      )}
    </div>
  )
}

const FlashcardQuestion = ({ q, showAnswer }) => {
  return (
    <div className="space-y-4">
      {/* Front */}
      <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 text-center">
        <div className="text-xs text-indigo-500 font-semibold mb-2 uppercase">Front</div>
        <div className="text-xl font-bold text-gray-800">
          <RichTextRenderer content={q.front || q.question} />
        </div>
        {q.image_url && (
          <div className="flex justify-center mt-3">
            <img src={q.image_url} alt="" className="max-h-48 rounded-xl object-contain" />
          </div>
        )}
      </div>

      {/* Back */}
      {showAnswer && (
        <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6 text-center">
          <div className="text-xs text-green-600 font-semibold mb-2 uppercase">Back</div>
          <div className="text-xl font-bold text-green-800">
            <RichTextRenderer content={q.back || q.answer} />
          </div>
        </div>
      )}
    </div>
  )
}

export default QuestionModal
