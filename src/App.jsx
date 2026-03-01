import React from 'react'
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
import RegisterPage from './components/auth/RegisterPage'
import StudyModule from './components/study/StudyModule'
import Leaderboard from './components/leaderboard/Leaderboard'
import Progress from './components/progress/Progress'
import Profile from './components/profile/Profile'
import Shop from './components/shop/Shop'
import Inventory from './components/inventory/Inventory'
import PetInventory from './components/pet/PetInventory'
import AdminDashboard from './components/admin/AdminDashboard'
import TeacherDashboard from './components/teacher/TeacherDashboard'
import TeacherExerciseBank from './components/teacher/TeacherExerciseBank'
import TeacherClassReports from './components/teacher/rollcall/TeacherClassReports'
import TeacherCourseOverview from './components/teacher/TeacherCourseOverview'
import StudentLessonHistory from './components/teacher/reports/StudentLessonHistory'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { TeacherCourseProvider } from './hooks/useTeacherCourseContext'


function App() {
  return (
    <BrandingProvider>
    <AuthProvider>
      <ProgressProvider>
        <InventoryProvider>
        <PetProvider>
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
                <Route path="shop" element={<Shop />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="pets" element={<PetInventory />} />
                <Route path="profile/:userId" element={<Profile />} />
                <Route path="admin/*" element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="teacher" element={<TeacherDashboard />} />
                <Route path="teacher/overview" element={<TeacherCourseOverview />} />
                <Route path="teacher/student-history/:courseId/:studentId" element={<StudentLessonHistory />} />
                <Route path="teacher/exercise-bank" element={<TeacherExerciseBank />} />
                <Route path="teacher/class-reports" element={
                  <TeacherCourseProvider>
                    <TeacherClassReports />
                  </TeacherCourseProvider>
                } />
              </Route>
            </Routes>
          </Router>
        </StudentLevelsProvider>
        </PetProvider>
        </InventoryProvider>
      </ProgressProvider>
    </AuthProvider>
    </BrandingProvider>
  )
}

export default App
