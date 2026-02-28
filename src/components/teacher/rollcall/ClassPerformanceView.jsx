import { Users, Star, Flag } from 'lucide-react';

const ratingOptions = [
  { value: 'wow', label: 'Wow', color: 'bg-green-500 text-white', inactive: 'bg-white text-green-700 border border-green-300 hover:bg-green-100' },
  { value: 'good', label: 'Good', color: 'bg-yellow-500 text-white', inactive: 'bg-white text-yellow-700 border border-yellow-300 hover:bg-yellow-100' },
  { value: 'ok', label: 'Ok', color: 'bg-red-500 text-white', inactive: 'bg-white text-red-700 border border-red-300 hover:bg-red-100' },
];

const ClassPerformanceView = ({ students, records, onChange, onMarkAll, loading }) => {
  return (
    <div className="space-y-6">
      {/* Mark All Buttons */}
      <div className="flex flex-wrap gap-2">
        {ratingOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => onMarkAll(opt.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${opt.inactive}`}
          >
            Mark All {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Students Enrolled</h3>
          </div>
        ) : (
          <div>
            {students.map(student => {
              const record = records[student.id] || {};
              const rating = record.performance_rating || '';
              const starFlag = record.star_flag || '';

              return (
                <div key={student.id} className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {student.avatar_url ? (
                        <img src={student.avatar_url} alt={student.full_name} className="w-10 h-10 rounded-full" />
                      ) : (
                        <span className="text-blue-600 font-semibold">
                          {student.full_name?.charAt(0).toUpperCase() || 'S'}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">{student.full_name}</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onChange(student.id, { star_flag: starFlag === 'star' ? '' : 'star' })}
                        className="p-1 rounded transition-colors"
                        title="Star (good)"
                      >
                        <Star className={`w-5 h-5 ${starFlag === 'star' ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`} />
                      </button>
                      <button
                        onClick={() => onChange(student.id, { star_flag: starFlag === 'flag' ? '' : 'flag' })}
                        className="p-1 rounded transition-colors"
                        title="Flag (needs attention)"
                      >
                        <Flag className={`w-5 h-5 ${starFlag === 'flag' ? 'fill-red-500 text-red-500' : 'text-gray-300 hover:text-red-300'}`} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <input
                      type="text"
                      placeholder="Feedback..."
                      value={record.notes || ''}
                      onChange={(e) => onChange(student.id, { notes: e.target.value })}
                      className="border border-gray-300 rounded-lg px-3 py-2 w-48 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-1">
                      {ratingOptions.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => onChange(student.id, { performance_rating: opt.value })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            rating === opt.value ? opt.color : opt.inactive
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassPerformanceView;
