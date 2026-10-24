import React, { Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ProgressProvider } from './hooks/useProgress'
import { InventoryProvider } from './hooks/useInventory'
import { StudentLevelsProvider } from './hooks/useStudentLevels'
import { PetProvider } from './hooks/usePet'
import { BrandingProvider } from './hooks/useBranding'
import Layout from './components/Layout'
import Dashboard from './components/dashboard/Dashboard'
import LoginPage from './components/auth/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { TeacherCourseProvider } from './hooks/useTeacherCourseContext'
import { MissionsProvider } from './hooks/useMissions'
import { REGISTER_PATH } from './config/registration'
import { FEATURES } from './config/features'
import lazyWithReload from './utils/lazyWithReload'
import LoadingSpinner from './components/ui/LoadingSpinner'

// Only the dashboard and login ship in the main bundle; every other page loads
// when it's first opened, so the first visit downloads far less.
const RegisterPage = lazyWithReload(() => import('./components/auth/RegisterPage'))
const NiceTryPage = lazyWithReload(() => import('./components/auth/NiceTryPage'))
const StudyModule = lazyWithReload(() => import('./components/study/StudyModule'))
const Leaderboard = lazyWithReload(() => import('./components/leaderboard/Leaderboard'))
const Progress = lazyWithReload(() => import('./components/progress/Progress'))
const Profile = lazyWithReload(() => import('./components/profile/Profile'))
const Shop = lazyWithReload(() => import('./components/shop/Shop'))
const Inventory = lazyWithReload(() => import('./components/inventory/Inventory'))
const PetInventory = lazyWithReload(() => import('./components/pet/PetInventory'))
const TeacherDashboard = lazyWithReload(() => import('./components/teacher/TeacherDashboard'))
const TeacherExerciseBank = lazyWithReload(() => import('./components/teacher/TeacherExerciseBank'))
const CourseReport = lazyWithReload(() => import('./components/teacher/CourseReport'))
const TeacherClassReports = lazyWithReload(() => import('./components/teacher/rollcall/TeacherClassReports'))
const TeacherCourseOverview = lazyWithReload(() => import('./components/teacher/TeacherCourseOverview'))
const StudentLessonHistory = lazyWithReload(() => import('./components/teacher/reports/StudentLessonHistory'))
const MissionBoard = lazyWithReload(() => import('./components/missions/MissionBoard'))
const LiveBattlePage = lazyWithReload(() => import('./components/livebattle/LiveBattlePage'))
const UnitReportPage = lazyWithReload(() => import('./components/teacher/reports/UnitReportPage'))
const WeaknessAnalysis = lazyWithReload(() => import('./components/teacher/WeaknessAnalysis'))
const GuestEntry = lazyWithReload(() => import('./components/guest/GuestEntry'))
const GuestSessionRunner = lazyWithReload(() => import('./components/guest/GuestSessionRunner'))
const FlashcardExercise = lazyWithReload(() => import('./components/exercises/FlashcardExercise'))
const PronunciationExercise = lazyWithReload(() => import('./components/exercises/PronunciationExercise'))
const MultipleChoiceExercise = lazyWithReload(() => import('./components/exercises/MultipleChoiceExercise'))
const FillBlankExercise = lazyWithReload(() => import('./components/exercises/FillBlankExercise'))
const SpriteLab = lazyWithReload(() => import('./components/event/SpriteLab'))

// Phaser is heavy (~1MB) — lazy-load the game routes so they never touch the main bundle.
const EvoGame = lazyWithReload(() => import('./components/games/evo/EvoGame'))
const PlatformerGame = lazyWithReload(() => import('./components/games/platformer/PlatformerGame'))

// The admin panel statically pulls in ~30 management screens that only admins
// ever open — keep the whole subtree out of the main bundle.
const AdminDashboard = lazyWithReload(() => import('./components/admin/AdminDashboard'))


function App() {
  return (
    <BrandingProvider>
    <AuthProvider>
      <ProgressProvider>
        <MissionsProvider>
        <InventoryProvider>
        <PetProvider>
        <StudentLevelsProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={
              <div className="min-h-dvh flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            }>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              {/* /register is a decoy; the real form lives at REGISTER_PATH */}
              <Route path="/register" element={<NiceTryPage />} />
              <Route path={REGISTER_PATH} element={<RegisterPage />} />
              <Route path="/guest" element={<GuestEntry />} />
              <Route path="/guest/session" element={<GuestSessionRunner />} />
              {/* Public demo links: the same exercise screens, no login and no
                  progress tracking. Share as /demo/... with the usual query params. */}
              <Route path="/demo/flashcard" element={<FlashcardExercise />} />
              <Route path="/demo/pronunciation" element={<PronunciationExercise />} />
              <Route path="/demo/multiple-choice" element={<MultipleChoiceExercise />} />
              <Route path="/demo/fill-blank" element={<FillBlankExercise />} />
              <Route path="/game/evo" element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="fixed inset-0 bg-[#0b1220]" />}>
                    <EvoGame />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/game/platformer" element={
                <ProtectedRoute>
                  <Suspense fallback={<div className="fixed inset-0 bg-sky-300" />}>
                    <PlatformerGame />
                  </Suspense>
                </ProtectedRoute>
              } />
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="study/*" element={<StudyModule />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="progress" element={<Progress />} />
                <Route path="event/sprite-lab" element={<SpriteLab />} />
                <Route path="profile" element={<Profile />} />
                {FEATURES.shop && <Route path="shop" element={<Shop />} />}
                {FEATURES.inventory && <Route path="inventory" element={<Inventory />} />}
                {FEATURES.pets && <Route path="pets" element={<PetInventory />} />}
                {FEATURES.missions && <Route path="missions" element={<MissionBoard />} />}
                <Route path="profile/:userId" element={<Profile />} />
                <Route path="admin/*" element={
                  <ProtectedRoute requireAdmin>
                    <Suspense fallback={
                      <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    }>
                      <AdminDashboard />
                    </Suspense>
                  </ProtectedRoute>
                } />
                <Route path="teacher" element={<TeacherDashboard />} />
                <Route path="teacher/overview" element={<TeacherCourseOverview />} />
                <Route path="teacher/student-history/:courseId/:studentId" element={<StudentLessonHistory />} />
                <Route path="teacher/exercise-bank" element={<TeacherExerciseBank />} />
                <Route path="teacher/live-battle/:courseId" element={<LiveBattlePage />} />
                <Route path="teacher/course-report/:courseId" element={<CourseReport />} />
                <Route path="teacher/unit-report/:courseId" element={<UnitReportPage />} />
                <Route path="teacher/weakness-analysis" element={<WeaknessAnalysis />} />
                <Route path="teacher/class-reports" element={
                  <TeacherCourseProvider>
                    <TeacherClassReports />
                  </TeacherCourseProvider>
                } />
              </Route>
            </Routes>
            </Suspense>
          </Router>
        </StudentLevelsProvider>
        </PetProvider>
        </InventoryProvider>
        </MissionsProvider>
      </ProgressProvider>
    </AuthProvider>
    </BrandingProvider>
  )
}

export default App
