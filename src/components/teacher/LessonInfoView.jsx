const LESSONS = [
  'Lesson 1',
  'Lesson 2',
  'Lesson 3',
  'Lesson 4',
  'Lesson 5',
  'Lesson 6',
  'Lesson 7',
  'Lesson 8',
  'Lesson 9',
  'Lesson 10',
];

const LessonInfoView = ({ lessonInfo, onChange }) => {
  const lessonMode = lessonInfo.lesson_mode || '';

  const handleModeChange = (mode) => {
    onChange({ lesson_mode: mode, lesson_name: '' });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="space-y-5">
          {/* Lesson Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lesson Mode
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleModeChange('theo_chuong_trinh')}
                className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                  lessonMode === 'theo_chuong_trinh'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Theo chương trình
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('bai_tu_chon')}
                className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                  lessonMode === 'bai_tu_chon'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Bài tự chọn
              </button>
            </div>
          </div>

          {/* Lesson Name - conditional on mode */}
          {lessonMode === 'theo_chuong_trinh' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lesson Name
              </label>
              <select
                value={lessonInfo.lesson_name || ''}
                onChange={(e) => onChange({ lesson_name: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select lesson...</option>
                {LESSONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {lessonMode === 'bai_tu_chon' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lesson Name
              </label>
              <input
                type="text"
                placeholder="Enter lesson name..."
                value={lessonInfo.lesson_name || ''}
                onChange={(e) => onChange({ lesson_name: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Skill */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Skill
            </label>
            <select
              value={lessonInfo.skill || ''}
              onChange={(e) => onChange({ skill: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select skill...</option>
              <option value="mixed">Mixed</option>
              <option value="speaking">Speaking</option>
              <option value="listening">Listening</option>
              <option value="writing">Writing</option>
              <option value="reading">Reading</option>
              <option value="phonic">Phonic</option>
              <option value="grammar">Grammar</option>
            </select>
          </div>

          {/* XP Bonus Multiplier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              XP Bonus
            </label>
            <div className="flex gap-3">
              {[
                { value: 1, label: 'x1', desc: 'Normal' },
                { value: 2, label: 'x2', desc: 'Double' },
                { value: 3, label: 'x3', desc: 'Triple' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ xp_bonus: opt.value })}
                  className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                    (lessonInfo.xp_bonus || 1) === opt.value
                      ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label} <span className="text-xs font-normal text-gray-500">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonInfoView;
