import { Routes, Route, Navigate } from 'react-router-dom'
import LevelList from './LevelList'
import UnitList from './UnitList'
import SessionList from './SessionList'
import ExerciseList from './ExerciseList'
import FlashcardExercise from '../exercises/FlashcardExercise'
import AudioFlashcardExercise from '../exercises/AudioFlashcardExercise'
import VocabSessionWrapper from '../exercises/VocabSessionWrapper'
import MultipleChoiceExercise from '../exercises/MultipleChoiceExercise'

const StudyModule = () => {
  return (
    <Routes>
      {/* Main study hierarchy */}
      <Route index element={<Navigate to="/" replace />} />
      <Route path="level/:levelId" element={<UnitList />} />
      <Route path="level/:levelId/unit/:unitId" element={<SessionList />} />
      <Route path="level/:levelId/unit/:unitId/session/:sessionId" element={<ExerciseList />} />
      
      {/* Exercise routes */}
      <Route path="flashcard" element={<FlashcardExercise />} />
      <Route path="audio-flashcard" element={<AudioFlashcardExercise />} />
      <Route path="vocab-session" element={<VocabSessionWrapper />} />
      <Route path="multiple-choice" element={<MultipleChoiceExercise />} />
    </Routes>
  )
}

export default StudyModule
