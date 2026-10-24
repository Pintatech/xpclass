// Vibate: one prompt; students answer with a face-filter video and reply to classmates' videos
const VibateEditor = ({ content, onContentChange }) => {
  const update = (field, value) => onContentChange({ ...content, [field]: value })

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Prompt *</label>
        <textarea
          value={content.prompt || ''}
          onChange={(e) => update('prompt', e.target.value)}
          rows={3}
          placeholder="e.g. Introduce your favourite animal in 3 sentences!"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Instructions (optional)</label>
        <textarea
          value={content.instructions || ''}
          onChange={(e) => update('instructions', e.target.value)}
          rows={2}
          placeholder="Tips shown under the prompt"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Max Recording Length (seconds)</label>
        <input
          type="number"
          min="5"
          max="180"
          value={content.max_duration_seconds || 60}
          onChange={(e) => update('max_duration_seconds', parseInt(e.target.value) || 60)}
          className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>

      <p className="text-xs text-gray-500">
        Students see each other's videos and can reply with their own. Posting their own video completes the exercise.
      </p>
    </div>
  )
}

export default VibateEditor
