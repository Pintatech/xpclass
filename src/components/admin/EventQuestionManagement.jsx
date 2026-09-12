import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, Eye, EyeOff, Search, X, Image as ImageIcon, Timer, BookOpen } from 'lucide-react'
import { supabase } from '../../supabase/client'
import {
  DEFAULT_SPEECH_PASS,
  MIXED,
  QUESTION_TYPES,
  SPEECH_PASS_RANGE,
  STORY_MIN_LEVEL,
  answerSummary,
  blankPayload,
  payloadIssues,
  questionType,
  SECONDS_RANGE,
  secondsIssues
} from '../../config/eventQuestions'
import { HERO_LIVES, REPLAY_HP_BY_DAY, STAGES, maxRoundQuestions, monsterHpFor, replayHpFor } from '../../config/eventLadder'

// A fight runs until the monster dies or the student is out of lives, so the
// longest one the week can throw is the last day's monster plus two mistakes.
// A type stocked to here can never run a day dry.
const ROUND_CAP = maxRoundQuestions()

// What one day's REDO asks at the outside. This climbs like the days do — on a
// shallower curve of its own, see REPLAY_HP_BY_DAY — so unlike the reading
// types there is no single number to stock every day to, and the hint below has
// to name the day being edited.
const replayRound = (day) => replayHpFor(day) + HERO_LIVES - 1
// The span, for the shared pool, which has no day of its own to be counted
// against and must therefore cover the worst one.
const REPLAY_ROUND_RANGE = [
  Math.min(...REPLAY_HP_BY_DAY),
  Math.max(...REPLAY_HP_BY_DAY)
].map((hp) => hp + HERO_LIVES - 1)

/**
 * The event battle's question bank.
 *
 * Deliberately separate from PetManagement's question tab: that one edits
 * pet_question_bank, which only knows a stem with four choices. This bank has a
 * `type` per row and a payload whose shape depends on it, so the form has to
 * change with the type — which is the whole reason this screen exists rather
 * than another column on the pet editor.
 */

const LEVELS = [1, 2, 3, 4, 5]

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400'

/** A row of the editor with a delete button on the end. */
const Removable = ({ children, onRemove, canRemove }) => (
  <div className="flex items-center gap-2">
    {children}
    <button
      type="button"
      onClick={onRemove}
      disabled={!canRemove}
      className="shrink-0 p-2 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-400"
      aria-label="Xoá"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
)

/**
 * The type-specific half of the form. Everything else about a row — the stem,
 * the image, the level — is the same whatever it asks, and lives in the modal.
 *
 * Each branch edits `payload` through `onChange`, which replaces it wholesale;
 * these are small objects and the immutability keeps the draft state honest.
 */
const PayloadEditor = ({ type, payload, onChange, day, onDayChange }) => {
  const set = (patch) => onChange({ ...payload, ...patch })

  if (type === 'multiple_choice') {
    const choices = payload.choices || []
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">
          Lựa chọn <span className="font-normal text-gray-500">— chọn nút tròn ở đáp án đúng</span>
        </p>
        {choices.map((choice, i) => (
          <Removable
            key={i}
            canRemove={choices.length > 2}
            onRemove={() => {
              const next = choices.filter((_, j) => j !== i)
              // The correct answer has to follow its choice, or removing an
              // earlier row silently re-points it at a different one.
              const answer = payload.answer_index
              set({
                choices: next,
                answer_index: answer === i ? 0 : answer > i ? answer - 1 : answer
              })
            }}
          >
            <input
              type="radio"
              name="mc-answer"
              checked={payload.answer_index === i}
              onChange={() => set({ answer_index: i })}
              className="w-4 h-4 shrink-0 text-green-600"
            />
            <input
              value={choice}
              onChange={(e) => set({ choices: choices.map((c, j) => (j === i ? e.target.value : c)) })}
              placeholder={`Lựa chọn ${'ABCDEF'[i]}`}
              className={inputCls}
            />
          </Removable>
        ))}
        {choices.length < 6 && (
          <button
            type="button"
            onClick={() => set({ choices: [...choices, ''] })}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            + Thêm lựa chọn
          </button>
        )}
      </div>
    )
  }

  if (type === 'true_false') {
    return (
      <div className="flex gap-3">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => set({ answer: v })}
            className={`flex-1 py-3 rounded-lg border-2 font-bold transition-colors ${
              payload.answer === v
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {v ? 'Đúng' : 'Sai'}
          </button>
        ))}
      </div>
    )
  }

  if (type === 'fill_blank') {
    const answers = payload.answers || []
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">
          Đáp án được chấp nhận
          <span className="font-normal text-gray-500"> — thêm mọi cách viết đúng, ví dụ &quot;is&quot; và &quot;&apos;s&quot;</span>
        </p>
        {answers.map((a, i) => (
          <Removable
            key={i}
            canRemove={answers.length > 1}
            onRemove={() => set({ answers: answers.filter((_, j) => j !== i) })}
          >
            <input
              value={a}
              onChange={(e) => set({ answers: answers.map((x, j) => (j === i ? e.target.value : x)) })}
              placeholder="Đáp án"
              className={inputCls}
            />
          </Removable>
        ))}
        <button
          type="button"
          onClick={() => set({ answers: [...answers, ''] })}
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          + Thêm cách viết
        </button>
      </div>
    )
  }

  if (type === 'reorder') {
    const words = payload.answer || []
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">
          Câu đúng <span className="font-normal text-gray-500">— gõ cả câu, cách nhau bằng dấu cách</span>
        </p>
        {/* Typed as a sentence and split on save rather than edited as a list of
            word boxes: an admin thinks in sentences, and the game only ever
            needs the tokens. */}
        <input
          value={words.join(' ')}
          onChange={(e) => set({ answer: e.target.value.split(/\s+/).filter(Boolean) })}
          placeholder="She is my sister"
          className={inputCls}
        />
        {words.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {words.map((w, i) => (
              <span key={i} className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-sm">
                {w}
              </span>
            ))}
            <span className="px-2 py-1 text-sm text-gray-400">{words.length} từ</span>
          </div>
        )}
      </div>
    )
  }

  if (type === 'unscramble') {
    const word = payload.answer || ''
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">
          Từ đúng <span className="font-normal text-gray-500">— các chữ cái sẽ được xáo trộn trong game</span>
        </p>
        <input
          value={word}
          onChange={(e) => set({ answer: e.target.value })}
          placeholder="elephant"
          className={inputCls}
        />
        {word && (
          <div className="flex flex-wrap gap-1 pt-1">
            {[...word].map((c, i) => (
              <span key={i} className="w-7 h-7 flex items-center justify-center bg-gray-100 border border-gray-200 rounded text-sm font-bold uppercase">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (type === 'matching') {
    const pairs = payload.pairs || []
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">
          Các cặp <span className="font-normal text-gray-500">— cột phải sẽ được xáo trộn trong game</span>
        </p>
        {pairs.map(([left, right], i) => (
          <Removable
            key={i}
            canRemove={pairs.length > 2}
            onRemove={() => set({ pairs: pairs.filter((_, j) => j !== i) })}
          >
            <input
              value={left}
              onChange={(e) => set({ pairs: pairs.map((p, j) => (j === i ? [e.target.value, p[1]] : p)) })}
              placeholder="cat"
              className={inputCls}
            />
            <span className="shrink-0 text-gray-400">→</span>
            <input
              value={right}
              onChange={(e) => set({ pairs: pairs.map((p, j) => (j === i ? [p[0], e.target.value] : p)) })}
              placeholder="mèo"
              className={inputCls}
            />
          </Removable>
        ))}
        {pairs.length < 5 && (
          <button
            type="button"
            onClick={() => set({ pairs: [...pairs, ['', '']] })}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            + Thêm cặp
          </button>
        )}
        <p className="text-xs text-gray-500">
          Ba cặp là vừa: một trận có mười câu, và bốn cặp mười lần là quá dài.
        </p>
      </div>
    )
  }

  if (type === 'pronunciation') {
    const pass = payload.pass ?? DEFAULT_SPEECH_PASS
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Câu cần đọc</label>
          <input
            value={payload.text || ''}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="I have a red bike"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-gray-500">
            Ngắn thôi — một câu học sinh đọc được trong một hơi. Câu càng dài
            càng nhiều chỗ máy nghe nhầm.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Ngày đánh lại <span className="font-normal text-gray-500">— trận nào đọc câu này</span>
          </label>
          <select
            value={day ?? ''}
            onChange={(e) => onDayChange(e.target.value === '' ? '' : Number(e.target.value))}
            className={inputCls}
          >
            <option value="">Mọi ngày (dùng chung)</option>
            {STAGES.map((s) => <option key={s.day} value={s.day}>Ngày {s.day}</option>)}
          </select>
          {/* The shared pool is a fallback, not a blend: a day with phrases of
              its own never draws these. Said here because "mọi ngày" otherwise
              reads as "and also every day", which is the opposite. */}
          {/* Named for the day being edited rather than as one figure for the
              week: the redo ladder climbs, so "mỗi ngày cần N" would be wrong on
              six days out of seven. The shared pool gets the span instead — it
              can be drawn on any day that has none of its own, so the only safe
              number for it is the worst day's. */}
          <p className="mt-1 text-xs text-gray-500">
            Câu dùng chung chỉ xuất hiện ở những ngày chưa có câu riêng.{' '}
            {day
              ? `Ngày ${day} cần ${replayRound(day)} câu cho một cấp độ.`
              : `Mỗi ngày cần ${REPLAY_ROUND_RANGE[0]}–${REPLAY_ROUND_RANGE[1]} câu cho một cấp độ, tuỳ ngày.`}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Điểm đạt <span className="font-normal text-gray-500">— {pass}%</span>
          </label>
          <input
            type="range"
            min={SPEECH_PASS_RANGE.min}
            max={SPEECH_PASS_RANGE.max}
            step={5}
            value={pass}
            onChange={(e) => set({ pass: Number(e.target.value) })}
            className="w-full"
          />
          {/* Said plainly because the number looks like a pronunciation grade
              and is not one: it is how much of the sentence the recogniser has
              to hear back. Asking for 100 fails honest readers over one word. */}
          <p className="mt-1 text-xs text-gray-500">
            Phần trăm số từ máy nghe được, không phải điểm phát âm. Đừng đặt
            100% — chỉ một từ nghe nhầm là học sinh trượt oan.
          </p>
        </div>
      </div>
    )
  }

  return null
}

const emptyDraft = () => ({
  type: 'multiple_choice',
  question: '',
  payload: blankPayload('multiple_choice'),
  image_url: '',
  category: '',
  min_level: 1,
  seconds: '',
  // Which passage this question is about. '' is a standalone question, which is
  // what every row was before reading rounds existed and still a perfectly
  // valid thing to write — a day falls back to these when its stories have no
  // questions of that day's type.
  story_id: '',
  // Spoken rows only: which day's REDO asks this phrase. Blank is the shared
  // pool every day falls back on.
  stage_day: ''
})

const emptyStory = () => ({ title: '', body: '', image_url: '', category: 'reading', min_level: 1, stage_day: '' })

/**
 * How many questions a passage placed on a given day needs before a fight will
 * open on it — a kill's worth of right answers plus the mistakes allowed on the
 * way, which is the same arithmetic openEventBattle draws its round with.
 *
 * OF THAT DAY'S TYPE, not in total: a day asks one kind of question throughout,
 * so twenty multiple-choice questions stock a passage for day 1 and leave it
 * useless on day 4.
 */
const dayRoundSize = (day) => monsterHpFor(day) + HERO_LIVES - 1

/**
 * What a day asks, for the day picker. The boss asks MIXED, and running that
 * through questionType would silently label day 7 "Chọn đáp án" — the fallback
 * for an unknown type — which is the one label that would send a teacher off to
 * write the wrong questions for it.
 */
const dayTypeLabel = (stage) =>
  stage.questions === MIXED ? 'Tổng hợp' : questionType(stage.questions).label

/**
 * The reading passages, edited in their own modal.
 *
 * Kept beside the question bank rather than on a screen of its own because the
 * two are written together: a passage is worth nothing without questions about
 * it, and the question form picks from this list.
 */
const StoryManager = ({ stories, onClose, onSave, onDelete, counts, saving }) => {
  const [draft, setDraft] = useState(null)
  const issues = draft
    ? [
        ...(draft.title.trim() ? [] : ['Cần nhập tên truyện.']),
        ...(draft.body.trim() ? [] : ['Cần nhập nội dung truyện.'])
      ]
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Truyện đọc</h3>
            <p className="text-sm text-gray-500">
              Học sinh đọc truyện trước, rồi trả lời câu hỏi về truyện đó.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDraft(emptyStory())}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Thêm truyện
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {draft ? (
          <div className="space-y-4 px-6 py-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tên truyện</label>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Mai and the Lost Cat"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nội dung <span className="font-normal text-gray-500">— để trống một dòng giữa các đoạn</span>
              </label>
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={10}
                placeholder={'Mai has a small cat. Its name is Miu.\n\nOne morning, Miu is not in the house…'}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-500">
                Nên ngắn — khoảng 4-6 câu. Học sinh đọc trên điện thoại, giữa trận đấu.
              </p>
            </div>
            {/* The day is what makes a passage reachable at all: a fight looks
                up the story for the day it is on, so an unplaced one is never
                read. Paired with the level here because the two together are
                the address — one day holds one passage per level. */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Ngày <span className="font-normal text-gray-500">— trận nào đọc truyện này</span>
                </label>
                <select
                  value={draft.stage_day ?? ''}
                  onChange={(e) => setDraft({ ...draft, stage_day: e.target.value === '' ? '' : Number(e.target.value) })}
                  className={inputCls}
                >
                  <option value="">Chưa gán ngày</option>
                  {STAGES.map((s) => (
                    <option key={s.day} value={s.day}>
                      Ngày {s.day} — {dayTypeLabel(s)} ({dayRoundSize(s.day)} câu)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Cấp độ</label>
                <select
                  value={draft.min_level}
                  onChange={(e) => setDraft({ ...draft, min_level: Number(e.target.value) })}
                  className={inputCls}
                >
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Chủ đề</label>
                <input
                  value={draft.category || ''}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ảnh (không bắt buộc)</label>
                <input
                  value={draft.image_url || ''}
                  onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                  placeholder="https://…"
                  className={inputCls}
                />
              </div>
            </div>

            {issues.length > 0 && (
              <ul className="list-inside list-disc rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            )}

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button onClick={() => setDraft(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
                Huỷ
              </button>
              <button
                onClick={async () => { await onSave(draft); setDraft(null) }}
                disabled={issues.length > 0 || saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Đang lưu…' : 'Lưu truyện'}
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {stories.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-gray-500">
                Chưa có truyện nào. Thêm một truyện, rồi gán câu hỏi vào truyện đó.
              </p>
            )}
            {stories.map((story) => (
              <div key={story.id} className="flex items-start gap-3 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-gray-800">{story.title}</span>
                    {/* An unplaced passage is never read by anyone, so it is
                        flagged the same way an unstocked one is rather than
                        being left to look finished. */}
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
                      story.stage_day ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {story.stage_day ? `Ngày ${story.stage_day}` : 'Chưa gán ngày'}
                    </span>
                    {/* Not "+": one day holds one passage per level and a student
                        reads the highest at or below their own, so a level-3
                        text is not also the level-4 reader's unless nothing
                        harder was written. Below the reading level there is no
                        passage at all. */}
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
                      story.min_level >= STORY_MIN_LEVEL ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {story.min_level >= STORY_MIN_LEVEL
                        ? `Cấp ${story.min_level}`
                        : `Cấp ${story.min_level} — chưa đọc truyện`}
                    </span>
                    {/* A passage with no questions never reaches a student, so
                        it is worth saying out loud rather than leaving to be
                        discovered by a day that quietly falls back. */}
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
                      counts[story.id]?.total ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {counts[story.id]?.total || 0} câu hỏi
                    </span>
                  </div>

                  {/* Per type, because a day draws only one of them. Ten fills a
                      round; fewer makes a short fight, which is why the thin
                      ones are called out rather than just listed. */}
                  {counts[story.id]?.total > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {QUESTION_TYPES.filter((t) => counts[story.id].byType[t.id]).map((t) => {
                        const n = counts[story.id].byType[t.id]
                        return (
                          <span
                            key={t.id}
                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                              n >= ROUND_CAP ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'
                            }`}
                            title={n >= ROUND_CAP ? 'Đủ cho trận dài nhất' : `Chỉ ${n} câu — ngày khó có thể hết câu hỏi`}
                          >
                            {t.label} {n}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{story.body}</p>
                </div>
                <button
                  onClick={() => setDraft({ ...story })}
                  className="shrink-0 p-2 text-gray-400 hover:text-blue-600"
                  aria-label="Sửa"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(story)}
                  className="shrink-0 p-2 text-gray-400 hover:text-red-600"
                  aria-label="Xoá"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const EventQuestionManagement = () => {
  const [rows, setRows] = useState([])
  const [stories, setStories] = useState([])
  const [storiesOpen, setStoriesOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState(null) // the row being added or edited
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { text, tone }

  const notify = (text, tone = 'success') => {
    setMessage({ text, tone })
    setTimeout(() => setMessage(null), 3000)
  }

  const fetchRows = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('event_question_bank')
      .select('*')
      .order('type', { ascending: true })
      .order('min_level', { ascending: true })
    if (error) notify(error.message, 'error')
    setRows(data || [])
    setLoading(false)
  }

  // A missing event_stories table (the migration has not been run on this
  // database yet) leaves the list empty and the rest of the screen working —
  // the same tolerance the battle has, for the same reason.
  const fetchStories = async () => {
    // By day first, because the day is what a teacher is filling in: the list
    // reads as the week, with the unplaced passages gathered at the end.
    const { data } = await supabase
      .from('event_stories')
      .select('*')
      .order('stage_day', { ascending: true, nullsFirst: false })
      .order('min_level', { ascending: true })
      .order('title', { ascending: true })
    setStories(data || [])
  }

  // Mount only; every later refresh is triggered by a write, which calls
  // fetchRows itself.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchRows(); fetchStories() }, [])

  /**
   * Each story's questions, counted per type.
   *
   * Per type and not just a total, because a round only ever draws ONE type —
   * whichever the day asks for. A passage with twenty questions that are all
   * multiple choice still opens an empty-feeling fight on a fill-in-the-blank
   * day, and the total alone would say it was well stocked.
   */
  const storyCounts = useMemo(() => {
    const c = {}
    for (const r of rows) {
      if (!r.story_id) continue
      if (!c[r.story_id]) c[r.story_id] = { total: 0, byType: {} }
      c[r.story_id].total += 1
      c[r.story_id].byType[r.type] = (c[r.story_id].byType[r.type] || 0) + 1
    }
    return c
  }, [rows])

  const saveStory = async (draft) => {
    setSaving(true)
    const record = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      image_url: draft.image_url?.trim() || null,
      category: draft.category?.trim() || null,
      // Empty means unplaced, and unplaced has to be NULL rather than 0: the
      // battle looks the day up by equality, and a 0 would be a day that does
      // not exist rather than a passage waiting for one.
      stage_day: draft.stage_day === '' || draft.stage_day == null ? null : Number(draft.stage_day),
      min_level: draft.min_level
    }
    const { error } = draft.id
      ? await supabase
          .from('event_stories')
          .update({ ...record, updated_at: new Date().toISOString() })
          .eq('id', draft.id)
      : await supabase.from('event_stories').insert(record)
    setSaving(false)
    if (error) { notify(error.message, 'error'); return }
    notify(draft.id ? 'Đã cập nhật truyện' : 'Đã thêm truyện')
    fetchStories()
  }

  // The FK is ON DELETE SET NULL, so the questions survive as standalone rows
  // rather than going down with the passage. Said out loud, because "xoá truyện"
  // sounds like it takes the questions with it.
  const removeStory = async (story) => {
    const n = storyCounts[story.id] || 0
    const warning = n
      ? `\n\n${n} câu hỏi sẽ trở thành câu hỏi rời (không thuộc truyện nào), không bị xoá.`
      : ''
    if (!confirm(`Xoá truyện "${story.title}"?${warning}`)) return
    const { error } = await supabase.from('event_stories').delete().eq('id', story.id)
    if (error) { notify(error.message, 'error'); return }
    notify('Đã xoá truyện')
    fetchStories()
    fetchRows()
  }

  const counts = useMemo(() => {
    const c = {}
    for (const r of rows) c[r.type] = (c[r.type] || 0) + 1
    return c
  }, [rows])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter !== 'all' && r.type !== filter) return false
      if (!q) return true
      return (
        r.question.toLowerCase().includes(q) ||
        answerSummary(r.type, r.payload).toLowerCase().includes(q)
      )
    })
  }, [rows, filter, search])

  // Validation runs on the draft as it is typed, so the save button reports the
  // problem instead of the database rejecting it after a round trip. The CHECK
  // is still what guarantees the shape — see payloadIssues.
  const issues = draft
    ? [
        ...payloadIssues(draft.type, draft.payload, draft.question),
        ...secondsIssues(draft.seconds)
      ]
    : []

  const save = async () => {
    if (!draft || issues.length) return
    setSaving(true)
    const record = {
      type: draft.type,
      // For a spoken row the stem IS the phrase, so it is derived rather than
      // typed twice. Two boxes that have to match are two chances to disagree,
      // and the one that matters is the one the student hears themselves read.
      question: draft.type === 'pronunciation'
        ? String(draft.payload?.text || '').trim()
        : draft.question.trim(),
      payload: draft.payload,
      image_url: draft.image_url?.trim() || null,
      category: draft.category?.trim() || null,
      min_level: draft.min_level,
      seconds: String(draft.seconds).trim() === '' ? null : Number(draft.seconds),
      story_id: draft.story_id || null,
      // Only a spoken row carries a day. For every other type the day is the
      // type — day 2 IS the true/false day — so writing one here would be a
      // second, disagreeing answer to a question already settled by STAGES.
      stage_day: draft.type === 'pronunciation' && draft.stage_day !== ''
        ? Number(draft.stage_day)
        : null
    }
    const { error } = draft.id
      ? await supabase
          .from('event_question_bank')
          .update({ ...record, updated_at: new Date().toISOString() })
          .eq('id', draft.id)
      : await supabase.from('event_question_bank').insert(record)
    setSaving(false)
    if (error) { notify(error.message, 'error'); return }
    setDraft(null)
    notify(draft.id ? 'Đã cập nhật câu hỏi' : 'Đã thêm câu hỏi')
    fetchRows()
  }

  const remove = async (row) => {
    if (!confirm(`Xoá câu hỏi này?\n\n${row.question}`)) return
    const { error } = await supabase.from('event_question_bank').delete().eq('id', row.id)
    if (error) { notify(error.message, 'error'); return }
    notify('Đã xoá câu hỏi')
    fetchRows()
  }

  const toggleActive = async (row) => {
    const { error } = await supabase
      .from('event_question_bank')
      .update({ is_active: !row.is_active })
      .eq('id', row.id)
    if (error) { notify(error.message, 'error'); return }
    fetchRows()
  }

  // Changing the type throws the payload away rather than trying to carry it
  // over: the shapes have nothing in common, and a half-migrated payload would
  // fail the CHECK in a way the admin could not see.
  const changeType = (type) => setDraft((d) => ({ ...d, type, payload: blankPayload(type) }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ngân hàng câu hỏi sự kiện</h2>
          <p className="text-sm text-gray-500">
            Mỗi ngày của sự kiện hỏi một loại câu khác nhau — xem src/config/eventLadder.js.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStoriesOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            <BookOpen className="h-4 w-4" /> Truyện đọc ({stories.length})
          </button>
          <button
            onClick={() => setDraft(emptyDraft())}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Thêm câu hỏi
          </button>
        </div>
      </div>

      {storiesOpen && (
        <StoryManager
          stories={stories}
          counts={storyCounts}
          saving={saving}
          onSave={saveStory}
          onDelete={removeStory}
          onClose={() => setStoriesOpen(false)}
        />
      )}

      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          message.tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tất cả ({rows.length})
        </button>
        {QUESTION_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              filter === t.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label} ({counts[t.id] || 0})
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm câu hỏi…"
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-gray-400">Đang tải…</p>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-gray-400">Chưa có câu hỏi nào.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {visible.map((row) => (
            <div
              key={row.id}
              className={`flex items-start gap-3 p-4 ${row.is_active ? '' : 'bg-gray-50 opacity-60'}`}
            >
              {row.image_url ? (
                <img src={row.image_url} alt="" className="w-12 h-12 shrink-0 object-contain rounded border border-gray-200" />
              ) : (
                <div className="w-12 h-12 shrink-0 rounded border border-dashed border-gray-200" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">
                    {questionType(row.type).label}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    Lv {row.min_level}
                  </span>
                  {row.seconds > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-semibold">
                      <Timer className="w-3 h-3" /> {row.seconds}s
                    </span>
                  )}
                  {row.category && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{row.category}</span>
                  )}
                </div>
                <p className="mt-1 font-medium text-gray-900 truncate">{row.question}</p>
                <p className="text-sm text-green-700 truncate">{answerSummary(row.type, row.payload)}</p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => toggleActive(row)} className="p-2 text-gray-400 hover:text-gray-700"
                  aria-label={row.is_active ? 'Ẩn câu hỏi' : 'Hiện câu hỏi'}>
                  {row.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => setDraft({ ...row, image_url: row.image_url || '', category: row.category || '', seconds: row.seconds ?? '', stage_day: row.stage_day ?? '' })}
                  className="p-2 text-gray-400 hover:text-blue-600" aria-label="Sửa">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(row)} className="p-2 text-gray-400 hover:text-red-600" aria-label="Xoá">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">
                {draft.id ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
              </h3>
              <button onClick={() => setDraft(null)} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Đóng">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Loại câu hỏi</label>
                <select value={draft.type} onChange={(e) => changeType(e.target.value)} className={inputCls}>
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {questionType(draft.type).hint} · Thời gian:{' '}
                  <strong>{questionType(draft.type).seconds} giây</strong> mỗi câu
                </p>
              </div>

              {/* Which passage this question is about. A question can stand on
                  its own — that is what the whole bank was before reading rounds
                  — so "no story" stays a first-class choice rather than
                  something to be talked out of. */}
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <BookOpen className="h-4 w-4" /> Thuộc truyện nào
                </label>
                <select
                  value={draft.story_id || ''}
                  onChange={(e) => setDraft({ ...draft, story_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">— Câu hỏi rời (không thuộc truyện nào) —</option>
                  {stories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.stage_day ? `ngày ${s.stage_day}` : 'chưa gán ngày'}, cấp {s.min_level})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Học sinh đọc truyện trước, rồi trả lời các câu hỏi về truyện đó.
                </p>
              </div>

              {/* Hidden for a spoken row, whose stem is the phrase itself and is
                  filled in from the payload on save — there is nothing to ask
                  beyond "say this", and an empty second box invites an admin to
                  write a Vietnamese instruction that the student then tries to
                  read aloud in English. */}
              {draft.type !== 'pronunciation' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nội dung câu hỏi
                    {draft.type === 'fill_blank' && (
                      <span className="font-normal text-gray-500"> — dùng ___ cho chỗ trống</span>
                    )}
                  </label>
                  <textarea
                    value={draft.question}
                    onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                    rows={2}
                    placeholder={draft.type === 'fill_blank' ? 'My name ___ Nam.' : 'Nội dung câu hỏi…'}
                    className={inputCls}
                  />
                </div>
              )}

              {/* An image is optional on every type, and works the same on all of
                  them: it is shown above the answer area, so a photo over a
                  fill_blank stem turns it into naming the picture. */}
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <ImageIcon className="w-4 h-4" /> Ảnh minh hoạ <span className="font-normal text-gray-500">(không bắt buộc)</span>
                </label>
                <div className="flex items-start gap-3">
                  <input
                    value={draft.image_url}
                    onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                    placeholder="https://…"
                    className={inputCls}
                  />
                  {draft.image_url?.trim() && (
                    <img
                      src={draft.image_url}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded border border-gray-200 object-contain"
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                      onLoad={(e) => { e.currentTarget.style.visibility = 'visible' }}
                    />
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <PayloadEditor
                  type={draft.type}
                  payload={draft.payload}
                  onChange={(payload) => setDraft({ ...draft, payload })}
                  day={draft.stage_day}
                  onDayChange={(stage_day) => setDraft({ ...draft, stage_day })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Cấp độ tối thiểu</label>
                  <select
                    value={draft.min_level}
                    onChange={(e) => setDraft({ ...draft, min_level: Number(e.target.value) })}
                    className={inputCls}
                  >
                    {LEVELS.map((l) => <option key={l} value={l}>Lv {l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Nhóm</label>
                  <input
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    placeholder="vocabulary"
                    className={inputCls}
                  />
                </div>
                {/* Blank means "use the default for this type", which is what the
                    placeholder shows. Only fill it in for a question that genuinely
                    needs its own clock — an override nobody remembers setting is
                    worse than a default everyone can find. */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Thời gian</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={SECONDS_RANGE.min}
                      max={SECONDS_RANGE.max}
                      value={draft.seconds}
                      onChange={(e) => setDraft({ ...draft, seconds: e.target.value })}
                      placeholder={String(questionType(draft.type).seconds)}
                      className={inputCls}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      giây
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {String(draft.seconds).trim() === ''
                      ? `Mặc định theo loại (${questionType(draft.type).seconds}s)`
                      : 'Riêng cho câu này'}
                  </p>
                </div>
              </div>

              {issues.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {issues.map((issue) => <li key={issue}>• {issue}</li>)}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button onClick={() => setDraft(null)} className="px-4 py-2 font-medium text-gray-600 hover:text-gray-900">
                Huỷ
              </button>
              <button
                onClick={save}
                disabled={issues.length > 0 || saving}
                className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {saving ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EventQuestionManagement
