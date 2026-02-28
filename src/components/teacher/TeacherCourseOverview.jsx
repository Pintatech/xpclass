import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useAuth } from '../../hooks/useAuth';
import { ArrowLeft, Star, Flag, Users, X, ChevronDown, ChevronRight, ClipboardCheck } from 'lucide-react';

const ratingColor = {
  wow: 'bg-green-500',
  good: 'bg-yellow-400',
  ok: 'bg-red-500',
};

const ratingLabel = {
  wow: 'Wow',
  good: 'Good',
  ok: 'Ok',
};

const attendanceLabel = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

const homeworkLabel = {
  wow: 'Wow',
  good: 'Good',
  ok: 'Ok',
};

const perfXP = { ok: 30, good: 60, wow: 90 };
const hwXP = { ok: 15, good: 30, wow: 45 };
const MAX_XP = 135;

const calcXP = (rec) => {
  if (!rec) return null;
  const isPresent = rec.attendance_status === 'present' || rec.attendance_status === 'late';
  if (!isPresent) return 0;
  const perf = perfXP[rec.performance_rating] || 0;
  const hw = hwXP[rec.homework_status] || 0;
  if (perf === 0 && hw === 0) return null;
  return Math.max(perf + hw - (rec.attendance_status === 'late' ? 15 : 0), 0);
};

const calcClassXPRate = (students, lessons, recordMap) => {
  if (!students.length || !lessons.length) return null;
  let totalPct = 0;
  let countStudents = 0;
  for (const student of students) {
    let sum = 0;
    let count = 0;
    for (const lesson of lessons) {
      const xp = calcXP(recordMap[`${lesson.id}_${student.id}`]);
      if (xp !== null) {
        sum += xp;
        count++;
      }
    }
    if (count > 0) {
      totalPct += (sum / count) / MAX_XP * 100;
      countStudents++;
    }
  }
  if (countStudents === 0) return null;
  const pct = totalPct / countStudents;
  return Math.round(pct / 10 * 10) / 10; // scale 0-10, one decimal
};

const XPRateCircle = ({ rate }) => {
  const size = 48;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (rate / 10) * circumference;
  const color = rate >= 8 ? '#16a34a' : rate >= 5 ? '#ca8a04' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{rate}</span>
        </div>
      </div>
      <span className="text-[10px] text-gray-400 font-medium">XP Rate</span>
    </div>
  );
};

const TeacherCourseOverview = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [courseData, setCourseData] = useState({}); // { courseId: { students, lessons, records } }
  const [loading, setLoading] = useState(true);
  const [popover, setPopover] = useState(null); // { courseId, studentId, lessonId, x, y }
  const [expandedStudent, setExpandedStudent] = useState(null); // "courseId_studentId"
  const popoverRef = useRef(null);

  useEffect(() => {
    if (user && !authLoading) {
      fetchCourses();
    }
  }, [user, authLoading]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      let coursesList;

      if (isAdmin()) {
        const { data, error } = await supabase
          .from('courses')
          .select('id, title, level_number, description')
          .eq('is_active', true)
          .order('level_number');
        if (error) throw error;
        coursesList = data || [];
      } else {
        const { data: courseTeachers, error } = await supabase
          .from('course_teachers')
          .select('course:courses(id, title, level_number, description)')
          .eq('teacher_id', user.id);
        if (error) throw error;
        coursesList = (courseTeachers || [])
          .map(ct => ct.course)
          .filter(c => c && c.is_active !== false)
          .sort((a, b) => a.level_number - b.level_number);
      }

      setCourses(coursesList);

      // Fetch data for all courses in parallel
      const dataMap = {};
      await Promise.all(coursesList.map(async (course) => {
        dataMap[course.id] = await fetchCourseData(course.id);
      }));
      setCourseData(dataMap);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseData = async (courseId) => {
    // Fetch students
    const { data: enrollments } = await supabase
      .from('course_enrollments')
      .select(`
        student_id,
        student:users!student_id(id, full_name, avatar_url)
      `)
      .eq('course_id', courseId)
      .eq('is_active', true);

    const students = (enrollments || []).map(e => e.student).filter(Boolean);

    // Fetch all lesson_info for this course
    const { data: lessons } = await supabase
      .from('lesson_info')
      .select('id, session_date, lesson_name, skill, feedback')
      .eq('course_id', courseId)
      .order('session_date', { ascending: true });

    const lessonList = lessons || [];

    // Fetch all lesson_records for these lessons
    let records = [];
    if (lessonList.length > 0) {
      const lessonIds = lessonList.map(l => l.id);
      const { data: recs } = await supabase
        .from('lesson_records')
        .select('id, lesson_info_id, student_id, attendance_status, homework_status, homework_notes, performance_rating, notes, star_flag')
        .in('lesson_info_id', lessonIds);
      records = recs || [];
    }

    // Index records by lessonId+studentId
    const recordMap = {};
    records.forEach(r => {
      const key = `${r.lesson_info_id}_${r.student_id}`;
      recordMap[key] = r;
    });

    return { students, lessons: lessonList, recordMap };
  };

  const handleDotClick = (e, courseId, studentId, lessonId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({
      courseId,
      studentId,
      lessonId,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
    });
  };

  const getPopoverData = () => {
    if (!popover) return null;
    const data = courseData[popover.courseId];
    if (!data) return null;
    const lesson = data.lessons.find(l => l.id === popover.lessonId);
    const rec = data.recordMap[`${popover.lessonId}_${popover.studentId}`];
    return { lesson, record: rec };
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-2 text-gray-600">Loading...</p>
      </div>
    );
  }

  const popoverData = getPopoverData();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/teacher')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-xl font-bold text-gray-900">Điểm danh</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {courses.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No Courses Assigned</h3>
          </div>
        ) : (
          courses.map(course => {
            const data = courseData[course.id];
            const students = data?.students || [];
            const lessons = data?.lessons || [];

            const classXPRate = calcClassXPRate(students, lessons, data?.recordMap || {});

            return (
              <div key={course.id} className="bg-white rounded-lg shadow-sm border">
                {/* Course Header */}
                <div className="p-5 border-b bg-blue-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {classXPRate !== null && <XPRateCircle rate={classXPRate} />}
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Course {course.level_number}: {course.title}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {students.length} student{students.length !== 1 ? 's' : ''} &middot; {lessons.length} lesson{lessons.length !== 1 ? 's' : ''} recorded
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/teacher/class-reports?tab=roll-call&course=${course.id}`)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Điểm danh
                  </button>
                </div>

                {students.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">No students enrolled</div>
                ) : lessons.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">No lessons recorded yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Lesson date headers */}
                    <div className="flex items-center border-b bg-gray-50 px-4 py-2">
                      <div className="w-52 flex-shrink-0 text-xs font-medium text-gray-500 uppercase">Student</div>
                      <div className="flex gap-3 flex-1 min-w-0">
                        {lessons.slice(-8).map(lesson => (
                          <div key={lesson.id} className="w-7 flex-shrink-0 text-center">
                            <span className="text-[10px] text-gray-400 leading-none">
                              {new Date(lesson.session_date + 'T00:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Student rows */}
                    {students.map(student => {
                      const expandKey = `${course.id}_${student.id}`;
                      const isExpanded = expandedStudent === expandKey;

                      return (
                        <div key={student.id} className="border-b last:border-b-0">
                          <div className="flex items-center px-4 py-3 hover:bg-gray-50">
                            {/* Student info */}
                            <div className="w-52 flex-shrink-0 flex items-center gap-2">
                              <button
                                onClick={() => setExpandedStudent(isExpanded ? null : expandKey)}
                                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                              >
                                {isExpanded
                                  ? <ChevronDown className="w-4 h-4" />
                                  : <ChevronRight className="w-4 h-4" />
                                }
                              </button>
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                {student.avatar_url ? (
                                  <img src={student.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                                ) : (
                                  <span className="text-blue-600 font-semibold text-sm">
                                    {student.full_name?.charAt(0).toUpperCase() || 'S'}
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-sm font-medium text-blue-600 truncate cursor-pointer hover:underline"
                                onClick={() => navigate(`/teacher/student-history/${course.id}/${student.id}`)}
                              >
                                {student.full_name}
                              </span>
                            </div>

                            {/* Lesson dots */}
                            <div className="flex gap-3 flex-1 min-w-0">
                              {lessons.slice(-8).map(lesson => {
                                const rec = data.recordMap[`${lesson.id}_${student.id}`];
                                const rating = rec?.performance_rating || '';
                                const dotColor = ratingColor[rating] || 'bg-gray-300';
                                const isActive = popover?.lessonId === lesson.id && popover?.studentId === student.id;

                                return (
                                  <button
                                    key={lesson.id}
                                    onClick={(e) => handleDotClick(e, course.id, student.id, lesson.id)}
                                    className={`w-7 h-7 rounded-full flex-shrink-0 transition-all flex items-center justify-center ${dotColor} ${
                                      isActive ? 'ring-2 ring-blue-500 ring-offset-1 scale-110' : 'hover:scale-110 hover:ring-2 hover:ring-gray-300'
                                    }`}
                                    title={`${lesson.session_date} - ${ratingLabel[rating] || 'No rating'}`}
                                  >
                                    {rec?.star_flag === 'star' && <Star className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300 drop-shadow" />}
                                    {rec?.star_flag === 'flag' && <Flag className="w-3.5 h-3.5 fill-red-600 text-red-600 drop-shadow" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Expanded detail panel */}
                          {isExpanded && (
                            <div className="bg-gray-50 px-4 pb-4">
                              <div className="overflow-x-auto rounded-lg border bg-white">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100 text-gray-600">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">Date</th>
                                      <th className="px-3 py-2 text-left font-medium">Lesson</th>
                                      <th className="px-3 py-2 text-center font-medium">Attendance</th>
                                      <th className="px-3 py-2 text-center font-medium">Performance</th>
                                      <th className="px-3 py-2 text-left font-medium">Notes</th>
                                      <th className="px-3 py-2 text-center font-medium">Homework</th>
                                      <th className="px-3 py-2 text-left font-medium">HW Notes</th>
                                      <th className="px-3 py-2 text-center font-medium">Star/Flag</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {[...lessons].reverse().slice(0, 8).map(lesson => {
                                      const rec = data.recordMap[`${lesson.id}_${student.id}`];
                                      return (
                                        <tr key={lesson.id} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                                            {new Date(lesson.session_date + 'T00:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                                          </td>
                                          <td className="px-3 py-2 text-gray-900">{lesson.lesson_name || '-'}</td>
                                          <td className="px-3 py-2 text-center">
                                            {rec?.attendance_status ? (
                                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                                rec.attendance_status === 'present' ? 'bg-green-100 text-green-700' :
                                                rec.attendance_status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                                                rec.attendance_status === 'absent' ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-600'
                                              }`}>
                                                {attendanceLabel[rec.attendance_status] || rec.attendance_status}
                                              </span>
                                            ) : <span className="text-gray-300">-</span>}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            {rec?.performance_rating ? (
                                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                                rec.performance_rating === 'wow' ? 'bg-green-100 text-green-700' :
                                                rec.performance_rating === 'good' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                              }`}>
                                                {ratingLabel[rec.performance_rating] || rec.performance_rating}
                                              </span>
                                            ) : <span className="text-gray-300">-</span>}
                                          </td>
                                          <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate">{rec?.notes || <span className="text-gray-300">-</span>}</td>
                                          <td className="px-3 py-2 text-center">
                                            {rec?.homework_status ? (
                                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                                rec.homework_status === 'wow' ? 'bg-green-100 text-green-700' :
                                                rec.homework_status === 'good' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                              }`}>
                                                {homeworkLabel[rec.homework_status] || rec.homework_status}
                                              </span>
                                            ) : <span className="text-gray-300">-</span>}
                                          </td>
                                          <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate">{rec?.homework_notes || <span className="text-gray-300">-</span>}</td>
                                          <td className="px-3 py-2 text-center">
                                            {rec?.star_flag === 'star' && <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 inline" />}
                                            {rec?.star_flag === 'flag' && <Flag className="w-4 h-4 fill-red-500 text-red-500 inline" />}
                                            {!rec?.star_flag && <span className="text-gray-300">-</span>}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              {lessons.length > 8 && (
                                <div className="mt-2 text-center">
                                  <button
                                    onClick={() => navigate(`/teacher/student-history/${course.id}/${student.id}`)}
                                    className="text-sm text-blue-600 hover:underline font-medium"
                                  >
                                    View all {lessons.length} lessons
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Popover */}
      {popover && popoverData && (
        <div
          ref={popoverRef}
          className="fixed z-50 bg-white rounded-lg shadow-xl border p-4 w-72"
          style={{
            left: Math.min(popover.x - 144, window.innerWidth - 300),
            top: popover.y,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900 text-sm">
              {popoverData.lesson?.session_date
                ? new Date(popoverData.lesson.session_date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })
                : 'Lesson'}
            </h4>
            <button onClick={() => setPopover(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {popoverData.lesson?.lesson_name && (
            <p className="text-xs text-gray-500 mb-3">{popoverData.lesson.lesson_name}</p>
          )}

          {!popoverData.record ? (
            <p className="text-sm text-gray-400">No record for this lesson</p>
          ) : (
            <div className="space-y-1 text-xs">
              {/* Star/Flag + Attendance inline */}
              <div className="flex items-center gap-2">
                {popoverData.record.attendance_status && (
                  <span className={`font-medium px-1.5 py-0.5 rounded capitalize ${
                    popoverData.record.attendance_status === 'present' ? 'bg-green-100 text-green-700' :
                    popoverData.record.attendance_status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                    popoverData.record.attendance_status === 'absent' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{attendanceLabel[popoverData.record.attendance_status] || popoverData.record.attendance_status}</span>
                )}
                {popoverData.record.star_flag === 'star' && <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />}
                {popoverData.record.star_flag === 'flag' && <Flag className="w-3.5 h-3.5 fill-red-500 text-red-500" />}
              </div>

              {/* Performance tag + note on one row */}
              {(popoverData.record.performance_rating || popoverData.record.notes) && (
                <div className="flex items-center gap-1.5">
                  {popoverData.record.performance_rating && (
                    <span className={`font-medium px-1.5 py-0.5 rounded shrink-0 ${
                      popoverData.record.performance_rating === 'wow' ? 'bg-green-100 text-green-700' :
                      popoverData.record.performance_rating === 'good' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      Class: {ratingLabel[popoverData.record.performance_rating] || popoverData.record.performance_rating}
                    </span>
                  )}
                  {popoverData.record.notes && (
                    <span className="text-gray-600 truncate">{popoverData.record.notes}</span>
                  )}
                </div>
              )}

              {/* Homework tag + note on one row */}
              {(popoverData.record.homework_status || popoverData.record.homework_notes) && (
                <div className="flex items-center gap-1.5">
                  {popoverData.record.homework_status && (
                    <span className={`font-medium px-1.5 py-0.5 rounded shrink-0 ${
                      popoverData.record.homework_status === 'wow' ? 'bg-green-100 text-green-700' :
                      popoverData.record.homework_status === 'good' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      Home: {homeworkLabel[popoverData.record.homework_status] || popoverData.record.homework_status}
                    </span>
                  )}
                  {popoverData.record.homework_notes && (
                    <span className="text-gray-600 truncate">{popoverData.record.homework_notes}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherCourseOverview;
