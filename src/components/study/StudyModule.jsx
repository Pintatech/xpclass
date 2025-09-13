import { Routes, Route, Navigate } from 'react-router-dom'
import LevelList from './LevelList'
import UnitList from './UnitList'
import SessionList from './SessionList'
import ExerciseList from './ExerciseList'
import FlashcardExercise from '../exercises/FlashcardExercise'
import CombinedLearningWrapper from '../exercises/CombinedLearningWrapper'
import AudioFlashcardExercise from '../exercises/AudioFlashcardExercise'
import SentencePronunciationWrapper from '../exercises/SentencePronunciationWrapper'
import VocabSessionWrapper from '../exercises/VocabSessionWrapper'

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
      <Route path="pronunciation" element={<CombinedLearningWrapper />} />
      <Route path="video" element={<CombinedLearningWrapper />} />
      <Route path="combined-learning" element={<CombinedLearningWrapper />} />
      <Route path="audio-flashcard" element={<AudioFlashcardExercise />} />
      <Route path="sentence-pronunciation" element={<SentencePronunciationWrapper />} />
      <Route path="vocab-session" element={<VocabSessionWrapper />} />
    </Routes>
  )
}

export default StudyModule
