import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ProgressProvider } from './hooks/useProgress'
import { StudentLevelsProvider } from './hooks/useStudentLevels'
import Layout from './components/Layout'
import Dashboard from './components/dashboard/Dashboard'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import StudyModule from './components/study/StudyModule'
import Leaderboard from './components/leaderboard/Leaderboard'
import Progress from './components/progress/Progress'
import Profile from './components/profile/Profile'
import AdminDashboard from './components/admin/AdminDashboard'
import TeacherDashboard from './components/teacher/TeacherDashboard'
import TeacherExerciseScores from './components/teacher/TeacherExerciseScores'
import ProtectedRoute from './components/auth/ProtectedRoute'


function App() {
  return (
    <AuthProvider>
      <ProgressProvider>
        <StudentLevelsProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="study/*" element={<StudyModule />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="progress" element={<Progress />} />
                <Route path="profile" element={<Profile />} />
                <Route path="profile/:userId" element={<Profile />} />
                <Route path="admin/*" element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="teacher" element={<TeacherDashboard />} />
                <Route path="teacher/exercises" element={<TeacherExerciseScores />} />
              </Route>
            </Routes>
          </Router>
        </StudentLevelsProvider>
      </ProgressProvider>
    </AuthProvider>
  )
}

export default App
