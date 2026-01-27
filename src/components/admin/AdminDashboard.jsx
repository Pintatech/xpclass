// src/components/admin/AdminDashboard.jsx
// Complete production admin dashboard using Supabase and external URLs for media

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  Edit,  
  AlertCircle, 
  CheckCircle, 
  Download, 
  Users,
  BookOpen,
  BarChart3,
  Settings,
  FileText,
  Home,
  Trophy,
  ShoppingBag
} from 'lucide-react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';

// Import existing components
import AdminOverview from './AdminOverview';
import UserManagement from './UserManagement';
import ExerciseManagement from './ExerciseManagement';
import ExerciseBank from './ExerciseBank';
import CourseManagement from './CourseManagement';
import StudentEnrollmentManagement from './StudentEnrollmentManagement';
import UnitManagement from './UnitManagement';
import SessionManagement from './SessionManagement';
import ContentTreeView from './ContentTreeView';
import CohortsManagement from './CohortsManagement';
import StudentLevelsManagement from './StudentLevelsManagement';
import AchievementManagement from './AchievementManagement';
import ShopManagement from './ShopManagement';
import { useCohorts } from '../../hooks/useCohorts';

const AdminDashboard = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [stats, setStats] = useState(null);

  // Get current tab from URL
  const getCurrentTab = () => {
    const path = location.pathname.split('/admin/')[1] || '';
    return path.split('/')[0] || 'overview';
  };

  const [activeTab, setActiveTab] = useState(getCurrentTab());

  // Navigation handler
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'overview') {
      navigate('/admin');
    } else {
      navigate(`/admin/${tabId}`);
    }
  };

  // Update active tab when URL changes
  useEffect(() => {
    setActiveTab(getCurrentTab());
  }, [location]);

  useEffect(() => {
    if (isAdmin()) {
      loadStats();
    }
  }, [isAdmin]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadStats = async () => {
    try {
      setLoading(true);

      // Get content statistics with fallback
      let coursesResult;
      try {
        coursesResult = await supabase.from('courses').select('id', { count: 'exact' });
      } catch (error) {
        if (error.code === 'PGRST205') {
          console.log('Using levels table fallback for admin stats...');
          coursesResult = await supabase.from('levels').select('id', { count: 'exact' });
        } else {
          throw error;
        }
      }

      const [unitsResult, sessionsResult, exercisesResult, usersResult] = await Promise.all([
        supabase.from('units').select('id', { count: 'exact' }),
        supabase.from('sessions').select('id', { count: 'exact' }),
        supabase.from('exercises').select('id, is_active', { count: 'exact' }),
        supabase.from('users').select('id, created_at', { count: 'exact' })
      ]);

      const stats = {
        totalCourses: coursesResult.count || 0,
        totalUnits: unitsResult.count || 0,
        totalSessions: sessionsResult.count || 0,
        totalExercises: exercisesResult.count || 0,
        activeExercises: exercisesResult.data?.filter(ex => ex.is_active).length || 0,
        totalUsers: usersResult.count || 0,
        // Users created in last 7 days
        recentUsers: usersResult.data?.filter(user => {
          const createdAt = new Date(user.created_at);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return createdAt >= weekAgo;
        }).length || 0
      };

      setStats(stats);
    } catch (error) {
      console.error('Error loading stats:', error);
      showNotification('Error loading statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showNotification(`Copied: ${text}`, 'success');
  };

  const handleExportContent = async () => {
    try {
      setLoading(true);
      
      // Export all content with fallback
      let coursesData;
      try {
        coursesData = await supabase.from('courses').select('*');
      } catch (error) {
        if (error.code === 'PGRST205') {
          coursesData = await supabase.from('levels').select('*');
        } else {
          throw error;
        }
      }

      const [unitsData, sessionsData, exercisesData] = await Promise.all([
        supabase.from('units').select('*'),
        supabase.from('sessions').select('*'),
        supabase.from('exercises').select('*')
      ]);

      const exportData = {
        courses: coursesData.data || [],
        units: unitsData.data || [],
        sessions: sessionsData.data || [],
        exercises: exercisesData.data || [],
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `momtek-content-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      showNotification('Content exported successfully!');
    } catch (error) {
      showNotification('Error exporting content: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Show access denied if not admin
  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">🚫</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-600">Admin privileges required to access this page.</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'tree', label: 'Tree View', icon: BookOpen },
    { id: 'bank', label: 'Exercise Bank', icon: FileText },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'cohorts', label: 'Cohorts', icon: Users },
    { id: 'enrollments', label: 'Enrollments', icon: Users },
    { id: 'units', label: 'Units', icon: Settings },
    { id: 'sessions', label: 'Sessions', icon: Edit },
    { id: 'levels', label: 'Student Levels', icon: BarChart3 },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'shop', label: 'Shop', icon: ShoppingBag },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar */}
      <div className="w-64 bg-white shadow-lg border-r flex flex-col">
        {/* Sidebar Header */}
        <div className="p-6 border-b">
          <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-xs text-gray-600">Manage your MomTek platform</p>
        </div>

        {/* Navigation Sidebar */}
        <div className="flex-1 overflow-y-auto">
          <nav className="px-4 py-6 space-y-2">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t">
          <button
            onClick={handleExportContent}
            disabled={loading}
            className="w-full bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs text-green-600 font-medium">Admin Access</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {tabs.find(tab => tab.id === activeTab)?.label || 'Dashboard'}
                </h2>
                <p className="text-sm text-gray-600">
                  {activeTab === 'overview' && 'Platform overview and statistics'}
                  {activeTab === 'tree' && 'Content hierarchy and structure'}
                  {activeTab === 'courses' && 'Manage learning courses and assign teachers'}
                  {activeTab === 'cohorts' && 'Manage student cohorts'}
                  {activeTab === 'enrollments' && 'Assign students to courses'}
                  {activeTab === 'units' && 'Manage curriculum units'}
                  {activeTab === 'levels' && 'Manage student XP levels and badges'}
                  {activeTab === 'achievements' && 'Manage achievements and badges'}
                  {activeTab === 'shop' && 'Manage shop items and pricing'}
                  {activeTab === 'sessions' && 'Manage learning sessions'}
                  {activeTab === 'users' && 'User management and profiles'}
                  {activeTab === 'analytics' && 'Platform analytics and insights'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {/* Quick Stats */}
            {stats && activeTab === 'overview' && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-4 border">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalCourses}</div>
                  <div className="text-sm text-gray-600">Courses</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4 border">
                  <div className="text-2xl font-bold text-green-600">{stats.totalUnits}</div>
                  <div className="text-sm text-gray-600">Units</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4 border">
                  <div className="text-2xl font-bold text-purple-600">{stats.totalSessions}</div>
                  <div className="text-sm text-gray-600">Sessions</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4 border">
                  <div className="text-2xl font-bold text-orange-600">{stats.totalExercises}</div>
                  <div className="text-sm text-gray-600">Exercises</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4 border">
                  <div className="text-2xl font-bold text-indigo-600">{stats.totalUsers}</div>
                  <div className="text-sm text-gray-600">Users</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4 border">
                  <div className="text-2xl font-bold text-pink-600">{stats.recentUsers}</div>
                  <div className="text-sm text-gray-600">New (7d)</div>
                </div>
              </div>
            )}

            {/* Tab Content - Using React Router */}
            <Routes>
              <Route index element={<AdminOverview />} />
              <Route path="tree" element={<ContentTreeView />} />
              <Route path="bank" element={<ExerciseBank />} />
              <Route path="courses" element={<CourseManagement />} />
              <Route path="cohorts" element={<CohortsManagement />} />
              <Route path="enrollments" element={<StudentEnrollmentManagement />} />
              {/* Student Levels Management */}
              <Route path="levels" element={<StudentLevelsManagement />} />
              <Route path="achievements" element={<AchievementManagement />} />
              <Route path="shop" element={<ShopManagement />} />
              <Route path="units" element={<UnitManagement />} />
              <Route path="sessions" element={<SessionManagement />} />
              {/* Redirect legacy exercises path to bank */}
              <Route path="exercises" element={<ExerciseBank />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="analytics" element={<AnalyticsView stats={stats} />} />
            </Routes>
          </div>
        </div>
      </div>

      {/* Notification Display */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          notification.type === 'error' 
            ? 'bg-red-500 text-white' 
            : 'bg-green-500 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Analytics View Component
const AnalyticsView = ({ stats }) => {
  const [detailedStats, setDetailedStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDetailedStats();
  }, []);

  const loadDetailedStats = async () => {
    try {
      setLoading(true);

      // Get exercise type distribution
      const { data: exercises } = await supabase
        .from('exercises')
        .select('exercise_type, xp_reward, difficulty_level');

      // Get user progress data
      const { data: userProgress } = await supabase
        .from('user_progress')
        .select('status, score, attempts');

      // Process exercise types
      const exerciseTypes = {};
      exercises?.forEach(ex => {
        exerciseTypes[ex.exercise_type] = (exerciseTypes[ex.exercise_type] || 0) + 1;
      });

      // Process completion rates
      const completionStats = {
        completed: userProgress?.filter(p => p.status === 'completed').length || 0,
        in_progress: userProgress?.filter(p => p.status === 'in_progress').length || 0,
        not_started: userProgress?.filter(p => p.status === 'not_started').length || 0
      };

      // Average scores
      const completedProgress = userProgress?.filter(p => p.score !== null) || [];
      const avgScore = completedProgress.length > 0 
        ? Math.round(completedProgress.reduce((sum, p) => sum + p.score, 0) / completedProgress.length)
        : 0;

      setDetailedStats({
        exerciseTypes,
        completionStats,
        avgScore,
        totalAttempts: userProgress?.reduce((sum, p) => sum + (p.attempts || 0), 0) || 0
      });

    } catch (error) {
      console.error('Error loading detailed stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Content Overview */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Content Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Content</p>
            <p className="text-2xl font-bold text-blue-600">
              {(stats?.totalCourses || 0) + (stats?.totalUnits || 0) + (stats?.totalSessions || 0)}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Active Exercises</p>
            <p className="text-2xl font-bold text-green-600">{stats?.activeExercises || 0}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Avg Score</p>
            <p className="text-2xl font-bold text-purple-600">{detailedStats?.avgScore || 0}%</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Attempts</p>
            <p className="text-2xl font-bold text-orange-600">{detailedStats?.totalAttempts || 0}</p>
          </div>
        </div>
      </div>

      {/* Exercise Types Distribution */}
      {detailedStats?.exerciseTypes && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Exercise Types</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(detailedStats.exerciseTypes).map(([type, count]) => (
              <div key={type} className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600 capitalize">{type.replace('_', ' ')}</div>
                <div className="text-xl font-bold text-gray-800">{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion Statistics */}
      {detailedStats?.completionStats && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Progress Distribution</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{detailedStats.completionStats.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{detailedStats.completionStats.in_progress}</div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-600">{detailedStats.completionStats.not_started}</div>
              <div className="text-sm text-gray-600">Not Started</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-4 text-left hover:bg-blue-100 transition-colors">
            <div className="font-medium text-blue-800">Create New Content</div>
            <div className="text-sm text-blue-600">Add courses, units, or exercises</div>
          </button>
          <button className="bg-green-50 border-2 border-dashed border-green-300 rounded-lg p-4 text-left hover:bg-green-100 transition-colors">
            <div className="font-medium text-green-800">Bulk Operations</div>
            <div className="text-sm text-green-600">Import/export content</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;