import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabase/client';
import { STAGES, eventDay } from '../../../config/eventLadder';
import { getMonster } from '../../../config/eventMonsters';
import { CheckCircle2, Users } from 'lucide-react';

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Which students in a class have cleared each day of the event ladder.
 * Reads event_stage_clears, which is readable by any signed-in user.
 */
const EventProgressView = ({ selectedCourse }) => {
  const [students, setStudents] = useState([]);
  const [clears, setClears] = useState({}); // { `${userId}_${stage}`: row }
  const [loading, setLoading] = useState(true);
  const today = eventDay();

  useEffect(() => {
    if (!selectedCourse) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data: enrollments, error: enrollError } = await supabase
          .from('course_enrollments')
          .select('student_id, student:users!student_id(id, full_name, real_name, avatar_url, real_avatar_url)')
          .eq('course_id', selectedCourse)
          .eq('is_active', true);
        if (enrollError) throw enrollError;

        const list = (enrollments || [])
          .map(e => e.student)
          .filter(Boolean)
          .map(s => ({ ...s, full_name: s.real_name || s.full_name, avatar_url: s.real_avatar_url || s.avatar_url }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));

        const map = {};
        if (list.length > 0) {
          const { data: rows, error: clearsError } = await supabase
            .from('event_stage_clears')
            .select('user_id, stage, clears, first_cleared_at')
            .in('user_id', list.map(s => s.id))
            .gt('clears', 0);
          if (clearsError) throw clearsError;
          (rows || []).forEach(r => { map[`${r.user_id}_${r.stage}`] = r; });
        }

        if (cancelled) return;
        setStudents(list);
        setClears(map);
      } catch (error) {
        console.error('Error loading event progress:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [selectedCourse]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading event progress...</p>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Students Enrolled</h3>
      </div>
    );
  }

  const doneCount = (day) => students.filter(s => clears[`${s.id}_${day}`]).length;

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-gray-900">Event Progress</h2>
        <span className="text-sm text-gray-500">
          {today > 0 ? `Today is day ${today}` : 'The event has not started yet'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
              {STAGES.map(stage => (
                <th
                  key={stage.day}
                  className={`text-center px-2 py-3 font-medium whitespace-nowrap ${stage.day === today ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}
                >
                  <div>Day {stage.day}{stage.boss ? ' 👑' : ''}</div>
                  <div className="text-[10px] font-normal text-gray-400">{getMonster(stage.monster)?.name}</div>
                </th>
              ))}
              <th className="text-center px-3 py-3 font-medium text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map(student => {
              const total = STAGES.filter(s => clears[`${student.id}_${s.day}`]).length;
              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {student.avatar_url ? (
                          <img src={student.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <span className="text-blue-600 font-semibold text-xs">{student.full_name?.charAt(0).toUpperCase() || 'S'}</span>
                        )}
                      </div>
                      <span className="font-medium text-gray-900 whitespace-nowrap">{student.full_name}</span>
                    </div>
                  </td>
                  {STAGES.map(stage => {
                    const row = clears[`${student.id}_${stage.day}`];
                    const locked = stage.day > today;
                    return (
                      <td
                        key={stage.day}
                        className={`px-2 py-2.5 text-center ${stage.day === today ? 'bg-blue-50/60' : ''}`}
                        title={row ? `First cleared ${formatDate(row.first_cleared_at)} · ${row.clears} win${row.clears !== 1 ? 's' : ''}` : locked ? 'Not open yet' : 'Not done'}
                      >
                        {row ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            {row.clears > 1 && <span className="text-[10px] text-gray-400">×{row.clears}</span>}
                          </div>
                        ) : locked ? (
                          <span className="text-gray-200">·</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center font-semibold text-gray-700">
                    {total}/{STAGES.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t">
            <tr>
              <td className="px-4 py-2.5 text-xs font-medium text-gray-500">Done</td>
              {STAGES.map(stage => (
                <td key={stage.day} className={`px-2 py-2.5 text-center text-xs font-medium ${stage.day === today ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}>
                  {doneCount(stage.day)}/{students.length}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default EventProgressView;
