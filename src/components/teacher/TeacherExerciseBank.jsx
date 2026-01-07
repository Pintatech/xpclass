import React from 'react';
import ExerciseBank from '../admin/ExerciseBank';

/**
 * Teacher Exercise Bank - Read-only view for teachers
 * Wraps the admin ExerciseBank component with teacher-specific context
 */
const TeacherExerciseBank = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header to indicate this is teacher view */}
      <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-blue-900">Exercise Bank</h1>
            <p className="text-sm text-blue-700">Browse and preview all exercises (Read-only)</p>
          </div>
          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
            Teacher View
          </div>
        </div>
      </div>

      {/* Render the ExerciseBank component */}
      <ExerciseBank readOnly={true} />
    </div>
  );
};

export default TeacherExerciseBank;
