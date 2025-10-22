# Audio Player with Listen Limit Feature

This guide explains how to use the AudioPlayer component with optional listen limits across all exercises.

## Features

- ✅ **Listen Limit**: Restrict how many times students can play audio (1-10 times, or unlimited)
- ✅ **Visual Feedback**: Shows remaining plays and disables button when limit reached
- ✅ **Play/Stop Controls**: Students can stop audio mid-play
- ✅ **Reusable Component**: Works across all exercise types

## For Admins: Setting Audio Limits

### In Pronunciation Exercises

1. Go to **Admin Panel** → **Exercise Management** → **Create/Edit Exercise**
2. Select **Pronunciation** exercise type
3. Add a question with audio:
   - Upload audio file OR paste audio URL
4. **Set Audio Play Limit**:
   - `0` = Unlimited plays (default)
   - `1` = Listen once only
   - `2-10` = Listen that many times

### Example Use Cases

#### Listen Once (High Difficulty)
- **Use for**: Advanced listening comprehension tests
- **Setting**: `max_audio_plays: 1`
- **Behavior**: Student can only listen once, then button is disabled

#### Listen 3 Times (Medium Difficulty)
- **Use for**: Standard pronunciation practice
- **Setting**: `max_audio_plays: 3`
- **Behavior**: Student can replay 3 times, counter shows remaining plays

#### Unlimited (Easy/Practice Mode)
- **Use for**: Beginner exercises, reference pronunciation
- **Setting**: `max_audio_plays: 0` (default)
- **Behavior**: No limit, students can replay as many times as needed

## For Developers: Using AudioPlayer Component

### Basic Usage

```jsx
import AudioPlayer from '../ui/AudioPlayer'

// Unlimited plays (default)
<AudioPlayer
  audioUrl="https://example.com/audio.mp3"
/>

// Listen once only
<AudioPlayer
  audioUrl="https://example.com/audio.mp3"
  maxPlays={1}
/>

// Listen 3 times
<AudioPlayer
  audioUrl="https://example.com/audio.mp3"
  maxPlays={3}
  variant="outline"
  className="mb-4"
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `audioUrl` | string | required | URL of the audio file |
| `maxPlays` | number | `0` | Maximum plays (0 = unlimited) |
| `variant` | string | `'outline'` | Button style variant |
| `className` | string | `''` | Additional CSS classes |
| `disabled` | boolean | `false` | Disable the player |
| `onPlayComplete` | function | - | Callback when audio finishes |
| `onLimitReached` | function | - | Callback when limit reached |

### Advanced Usage with Callbacks

```jsx
<AudioPlayer
  audioUrl="https://example.com/audio.mp3"
  maxPlays={2}
  onPlayComplete={() => {
    console.log('Audio finished playing')
  }}
  onLimitReached={() => {
    console.log('Student reached play limit')
    // Maybe award XP or move to next question
  }}
/>
```

## Implementing in Other Exercises

### Step 1: Import AudioPlayer

```jsx
import AudioPlayer from '../ui/AudioPlayer'
```

### Step 2: Update Exercise Editor

Add `max_audio_plays` field to question schema:

```jsx
const normalizeQuestion = (q) => ({
  // ... other fields
  audio_url: q?.audio_url || '',
  max_audio_plays: q?.max_audio_plays || 0,
})
```

Add UI input in editor:

```jsx
{question.audio_url && (
  <div>
    <label>Audio Play Limit</label>
    <input
      type="number"
      min="0"
      max="10"
      value={question.max_audio_plays || 0}
      onChange={(e) => updateQuestion(index, 'max_audio_plays', parseInt(e.target.value) || 0)}
    />
    <p className="text-xs text-gray-500">
      0 = unlimited, or set max number of plays
    </p>
  </div>
)}
```

### Step 3: Replace Audio Buttons

**Before:**
```jsx
const playAudio = () => {
  const audio = new Audio(currentQuestion.audio_url)
  audio.play()
}

<Button onClick={playAudio}>
  <Volume2 /> Listen
</Button>
```

**After:**
```jsx
<AudioPlayer
  audioUrl={currentQuestion.audio_url}
  maxPlays={currentQuestion.max_audio_plays || 0}
  variant="outline"
/>
```

## Student Experience

### Unlimited Plays (Default)
```
[🔊 Listen]
```
- Button always enabled
- Can replay indefinitely

### Limited Plays (e.g., 3 times)
```
[🔊 Listen (3 left)] [📊 0 / 3 plays]
```

After 1st play:
```
[🔊 Listen (2 left)] [📊 1 / 3 plays]
```

After 3rd play:
```
[🔇 Limit Reached] (disabled)
```

## Exercise Types That Can Use This

- ✅ **Pronunciation** (implemented)
- ✅ **Multiple Choice** (implemented)
- ⚠️ **Fill in the Blank** (needs implementation)
- ⚠️ **Dropdown** (needs implementation)
- ⚠️ **Drag & Drop** (needs implementation)
- ⚠️ **Flashcards** (needs implementation)

## Data Structure

### Question Schema (JSON in database)

```json
{
  "id": "q1",
  "text": "Pronunciation question",
  "audio_url": "https://example.com/hello.mp3",
  "max_audio_plays": 3,
  "phonetic": "həˈloʊ"
}
```

### Exercise Content Structure

```json
{
  "content": {
    "questions": [
      {
        "id": "q1",
        "text": "Hello",
        "audio_url": "https://...",
        "max_audio_plays": 1
      },
      {
        "id": "q2",
        "text": "World",
        "audio_url": "https://...",
        "max_audio_plays": 0
      }
    ]
  }
}
```

## Testing Checklist

- [ ] Create exercise with unlimited audio
- [ ] Create exercise with 1 play limit
- [ ] Create exercise with 3 play limit
- [ ] Verify counter decrements correctly
- [ ] Verify button disables at limit
- [ ] Test stop button functionality
- [ ] Test across different browsers
- [ ] Test on mobile devices

## Troubleshooting

### Audio doesn't play
- Check if `audio_url` is valid and accessible
- Check browser console for CORS errors
- Ensure audio file is in supported format (mp3, wav, ogg)

### Counter doesn't update
- Check React DevTools for state changes
- Verify `max_audio_plays` is a number, not string
- Check console for errors

### Button doesn't disable
- Verify `hasReachedLimit` state is updating
- Check if `max_audio_plays > 0`
- Ensure AudioPlayer component is not remounting

## Future Enhancements

- [ ] Add visual progress bar while playing
- [ ] Add playback speed control (0.5x, 1x, 1.5x, 2x)
- [ ] Add download audio option (for unlimited plays only)
- [ ] Track listen count in analytics
- [ ] Add admin dashboard showing average listen count per question
- [ ] Support for multiple audio files per question (different accents/speakers)

---

**Created by**: Claude Code Assistant
**Last Updated**: 2025
