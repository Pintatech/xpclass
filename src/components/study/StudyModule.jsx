import { Routes, Route, Navigate } from 'react-router-dom'
import CourseList from './CourseList'
import UnitList from './UnitList'
import SessionList from './SessionList'
import ExerciseList from './ExerciseList'
import FlashcardExercise from '../exercises/FlashcardExercise'
import VocabSessionWrapper from '../exercises/VocabSessionWrapper'
import MultipleChoiceExercise from '../exercises/MultipleChoiceExercise'
import FillBlankExercise from '../exercises/FillBlankExercise'
import DragDropExercise from '../exercises/DragDropExercise'
import AIFillBlankExercise from '../exercises/AIFillBlankExercise'

const StudyModule = () => {
  return (
    <Routes>
      {/* Main study hierarchy */}
      <Route index element={<Navigate to="/" replace />} />
      {/* Course-based routes */}
      <Route path="course/:courseId" element={<UnitList />} />
      <Route path="course/:courseId/unit/:unitId" element={<SessionList />} />
      <Route path="course/:courseId/unit/:unitId/session/:sessionId" element={<ExerciseList />} />

      {/* Legacy level routes for compatibility */}
      <Route path="level/:levelId" element={<UnitList />} />
      <Route path="level/:levelId/unit/:unitId" element={<SessionList />} />
      <Route path="level/:levelId/unit/:unitId/session/:sessionId" element={<ExerciseList />} />
      
      {/* Exercise routes */}
      <Route path="flashcard" element={<FlashcardExercise />} />
      <Route path="fill-blank" element={<FillBlankExercise />} />
      <Route path="vocab-session" element={<VocabSessionWrapper />} />
      <Route path="multiple-choice" element={<MultipleChoiceExercise />} />
      <Route path="drag-drop" element={<DragDropExercise />} />
      <Route path="ai-fill-blank" element={<AIFillBlankExercise />} />
    </Routes>
  )
}

export default StudyModule
