import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../supabase/client';
import {
  FileText,
  ArrowLeft,
  ClipboardCheck,
  BarChart3,
  Calendar,
  Save,
  Info,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useTeacherCourse } from '../../../hooks/useTeacherCourseContext';
import { useLessonRecords } from '../../../hooks/useLessonRecords';
import { useLessonInfo } from '../../../hooks/useLessonInfo';

import LessonInfoView from './LessonInfoView';
import RollCallView from './RollCallView';
import HomeworkReportView from './HomeworkReportView';
import ClassPerformanceView from './ClassPerformanceView';
import LessonFeedbackView from './LessonFeedbackView';

const getDraftKey = (courseId, date) => `lesson_draft_${courseId}_${date}`;

const saveDraft = (courseId, date, lessonInfo, records) => {
  try {
    const key = getDraftKey(courseId, date);
    localStorage.setItem(key, JSON.stringify({ lessonInfo, records, savedAt: Date.now() }));
  } catch (e) { /* localStorage full or unavailable */ }
};

const loadDraft = (courseId, date) => {
  try {
    const key = getDraftKey(courseId, date);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    // Expire drafts older than 24 hours
    if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch (e) { return null; }
};

const clearDraft = (courseId, date) => {
  try { localStorage.removeItem(getDraftKey(courseId, date)); } catch (e) { /* */ }
};

const TeacherClassReports = () => {
  const { loading: authLoading } = useAuth();
  const { courses, selectedCourse, setSelectedCourse, selectedDate, setSelectedDate, loading: coursesLoading } = useTeacherCourse();
  const { fetchRecords, saveRecords, loading: recordsLoading } = useLessonRecords();
  const { fetchLessonInfo, saveLessonInfo, loading: infoLoading } = useLessonInfo();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'info');
  const initialCourse = searchParams.get('course');
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({});
  const [lessonInfo, setLessonInfo] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);
  const skipDraftSave = useRef(false);

  // Pre-select course from URL param
  useEffect(() => {
    if (initialCourse && courses.length > 0 && courses.some(c => c.id === initialCourse)) {
      setSelectedCourse(initialCourse);
    }
  }, [initialCourse, courses, setSelectedCourse]);

  const selectedCourseData = courses.find(course => course.id === selectedCourse);

  const tabs = [
    { id: 'info', label: 'Info', icon: Info },
    { id: 'roll-call', label: 'Roll Call', icon: ClipboardCheck },
    { id: 'homework', label: 'Homework', icon: FileText },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare }
  ];

  // Auto-save draft to localStorage on every change
  useEffect(() => {
    if (skipDraftSave.current || !selectedCourse || !selectedDate) return;
    const hasData = Object.keys(records).length > 0 || lessonInfo.lesson_name || lessonInfo.lesson_mode || lessonInfo.feedback;
    if (hasData) {
      saveDraft(selectedCourse, selectedDate, lessonInfo, records);
    }
  }, [records, lessonInfo, selectedCourse, selectedDate]);

  // Warn before closing/refreshing with unsaved data
  useEffect(() => {
    const hasChanges = Object.keys(records).length > 0 || lessonInfo.lesson_name || lessonInfo.lesson_mode || lessonInfo.feedback;
    if (!hasChanges) return;
    const handler = (e) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [records, lessonInfo]);

  // Load data when course/date changes
  useEffect(() => {
    if (selectedCourse && selectedDate) {
      loadData();
    }
  }, [selectedCourse, selectedDate]);

  const loadData = async () => {
    if (!selectedCourse) return;

    try {
      setLoading(true);

      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select(`
          student_id,
          student:users!student_id(
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('course_id', selectedCourse)
        .eq('is_active', true)
        .order('student(full_name)');

      if (enrollError) throw enrollError;

      const studentsList = enrollments
        .map(e => e.student)
        .filter(s => s !== null);
      setStudents(studentsList);

      const existingInfo = await fetchLessonInfo(selectedCourse, selectedDate);

      // Fetch student records linked to this lesson
      const recordsMap = {};
      if (existingInfo?.id) {
        const existing = await fetchRecords(existingInfo.id);
        existing.forEach(record => {
          recordsMap[record.student_id] = record;
        });
      }

      // If DB has data, use it. Otherwise check for a localStorage draft.
      const dbHasData = existingInfo?.id;
      if (dbHasData) {
        skipDraftSave.current = true;
        setLessonInfo(existingInfo);
        setRecords(recordsMap);
        setHasDraft(false);
        clearDraft(selectedCourse, selectedDate);
        skipDraftSave.current = false;
      } else {
        const draft = loadDraft(selectedCourse, selectedDate);
        skipDraftSave.current = true;
        if (draft) {
          setLessonInfo(draft.lessonInfo || { course_id: selectedCourse, session_date: selectedDate });
          setRecords(draft.records || {});
          setHasDraft(true);
          showNotification('Draft restored from previous session');
        } else {
          setLessonInfo({ course_id: selectedCourse, session_date: selectedDate });
          setRecords({});
          setHasDraft(false);
        }
        skipDraftSave.current = false;
      }
    } catch (error) {
      console.error('Error loading lesson data:', error);
      showNotification('Error loading data: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLessonInfoChange = (data) => {
    setLessonInfo(prev => ({
      ...prev,
      course_id: selectedCourse,
      session_date: selectedDate,
      ...data
    }));
  };

  const handleRecordChange = (studentId, data) => {
    setRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        student_id: studentId,
        ...data
      }
    }));
  };

  const getIncompleTabs = () => {
    const missing = [];

    // Info: lesson_mode and lesson_name required
    if (!lessonInfo.lesson_mode || !lessonInfo.lesson_name || !lessonInfo.skill) {
      missing.push('Info');
    }

    // Roll Call: every student needs attendance
    const allHaveAttendance = students.length > 0 && students.every(s =>
      records[s.id]?.attendance_status
    );
    if (!allHaveAttendance) missing.push('Roll Call');

    // Homework (hand graded): every student needs homework_status
    const allHaveHomework = students.length > 0 && students.every(s =>
      records[s.id]?.homework_status
    );
    if (!allHaveHomework) missing.push('Homework');

    // Performance: every student needs performance_rating
    const allHavePerformance = students.length > 0 && students.every(s =>
      records[s.id]?.performance_rating
    );
    if (!allHavePerformance) missing.push('Performance');

    // Feedback: feedback text required
    if (!lessonInfo.feedback?.trim()) missing.push('Feedback');

    return missing;
  };

  const incompleteTabs = getIncompleTabs();
  const canSave = incompleteTabs.length === 0;

  const handleSave = async () => {
    try {
      setSaving(true);

      // 1. Save lesson info first to get the id
      const { xp_bonus, ...lessonInfoForDB } = lessonInfo;
      const savedInfo = await saveLessonInfo({
        ...lessonInfoForDB,
        course_id: selectedCourse,
        session_date: selectedDate
      });

      if (!savedInfo) {
        showNotification('Failed to save lesson info', 'error');
        return;
      }

      // 2. Save student records linked to this lesson
      const recordsArray = Object.values(records).filter(r => r.student_id);
      if (recordsArray.length > 0) {
        const recordsSuccess = await saveRecords(savedInfo.id, recordsArray);
        if (!recordsSuccess) {
          showNotification('Failed to save student records', 'error');
          return;
        }
      }

      // 3. Award XP to students based on attendance, performance, homework
      const bonus = lessonInfo.xp_bonus || 1;
      const perfXP = { ok: 30, good: 60, wow: 90 };
      const hwXP = { ok: 15, good: 30, wow: 45 };

      const xpUpdates = recordsArray
        .map(rec => {
          const isPresent = rec.attendance_status === 'present' || rec.attendance_status === 'late';
          if (!isPresent) return null;

          const perf = perfXP[rec.performance_rating] || 0;
          const hw = hwXP[rec.homework_status] || 0;
          if (perf === 0 && hw === 0) return null;
          let xp = bonus * (perf + hw - (rec.attendance_status === 'late' ? 15 : 0));
          if (xp <= 0) return null;

          return { student_id: rec.student_id, xp };
        })
        .filter(Boolean);

      if (xpUpdates.length > 0) {
        const { error: xpError } = await supabase.rpc('add_xp_batch', {
          updates: xpUpdates
        });
        if (xpError) console.error('[XP] Error awarding XP:', xpError);
      }

      clearDraft(selectedCourse, selectedDate);
      setHasDraft(false);
      showNotification('Saved lesson successfully');
      await loadData();
    } catch (error) {
      console.error('Error saving:', error);
      showNotification('Error saving records', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAll = (field, value) => {
    const newRecords = { ...records };
    students.forEach(student => {
      newRecords[student.id] = {
        ...newRecords[student.id],
        student_id: student.id,
        [field]: value,
      };
    });
    setRecords(newRecords);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  if (authLoading || coursesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-2 text-gray-600">Loading...</p>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Courses Assigned</h3>
          <p className="text-gray-600">You haven't been assigned to any courses yet.</p>
          <button
            onClick={() => navigate('/teacher')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/teacher/overview')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Overview
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Lesson Report</h1>
                {selectedCourseData && (
                  <p className="text-sm text-gray-600">
                    Course {selectedCourseData.level_number}: {selectedCourseData.title}
                  </p>
                )}
              </div>
            </div>

            {/* Course & Date Selector */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Course:</label>
                <select
                  value={selectedCourse || ''}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[200px]"
                >
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.level_number}: {course.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-4 border-b-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-gray-50 text-blue-600 border border-b-0 border-gray-200 -mb-px'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div
            className={`p-4 rounded-lg ${
              notification.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-green-50 border border-green-200 text-green-800'
            }`}
          >
            {notification.message}
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className={activeTab === 'info' ? '' : 'hidden'}>
          <LessonInfoView
            lessonInfo={lessonInfo}
            onChange={handleLessonInfoChange}
          />
        </div>
        <div className={activeTab === 'roll-call' ? '' : 'hidden'}>
          <RollCallView
            students={students}
            records={records}
            onChange={handleRecordChange}
            onMarkAllPresent={() => handleMarkAll('attendance_status', 'present')}
            onMarkAllLate={() => handleMarkAll('attendance_status', 'late')}
            onMarkAllAbsent={() => handleMarkAll('attendance_status', 'absent')}
            loading={loading}
          />
        </div>
        <div className={activeTab === 'homework' ? '' : 'hidden'}>
          <HomeworkReportView
            students={students}
            courseId={selectedCourse}
            records={records}
            onChange={handleRecordChange}
            onMarkAll={(value) => handleMarkAll('homework_status', value)}
            loading={loading}
          />
        </div>
        <div className={activeTab === 'performance' ? '' : 'hidden'}>
          <ClassPerformanceView
            students={students}
            records={records}
            onChange={handleRecordChange}
            onMarkAll={(value) => handleMarkAll('performance_rating', value)}
            loading={loading}
          />
        </div>
        <div className={activeTab === 'feedback' ? '' : 'hidden'}>
          <LessonFeedbackView
            lessonInfo={lessonInfo}
            onChange={handleLessonInfoChange}
          />
        </div>
      </div>

      {/* Save Button - always visible */}
      {selectedCourse && (
        <div className="sticky bottom-0 bg-white border-t shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            {!canSave && (
              <p className="text-sm text-red-500">
                Incomplete: {incompleteTabs.join(', ')}
              </p>
            )}
            {canSave && <div />}
            <button
              onClick={handleSave}
              disabled={!canSave || saving || loading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Lesson'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherClassReports;
