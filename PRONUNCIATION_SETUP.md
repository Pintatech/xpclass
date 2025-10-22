# Pronunciation Exercise Setup with Microsoft Azure Speech Services

This guide explains how to set up and use the pronunciation exercise feature with Microsoft Azure Speech Services.

## Features

- **Real-time Pronunciation Assessment**: Uses Azure Cognitive Services Speech SDK to assess pronunciation
- **Detailed Scoring**: Provides scores for:
  - Overall Pronunciation Score
  - Accuracy (phoneme-level correctness)
  - Fluency (rhythm and naturalness)
  - Completeness (how much of the text was spoken)
- **Word-level Feedback**: Shows individual word scores
- **Audio Playback**: Optional reference audio for students
- **IPA Phonetic Notation**: Optional phonetic transcription display
- **Bulk Import**: Easy bulk question creation

## Prerequisites

1. **Azure Account**: You need an Azure subscription
2. **Speech Service Resource**: Create a Speech Service resource in Azure Portal

## Step 1: Create Azure Speech Service

1. Go to [Azure Portal](https://portal.azure.com)
2. Click "Create a resource"
3. Search for "Speech"
4. Select "Speech" by Microsoft
5. Click "Create"
6. Fill in the details:
   - **Subscription**: Your Azure subscription
   - **Resource group**: Create new or use existing
   - **Region**: Choose closest region (e.g., Southeast Asia, East US)
   - **Name**: Give it a unique name
   - **Pricing tier**: Choose F0 (Free) for testing or S0 for production
7. Click "Review + create" then "Create"

## Step 2: Get API Keys

1. Go to your Speech Service resource
2. Click on "Keys and Endpoint" in the left menu
3. Copy **KEY 1** (or KEY 2)
4. Note the **Location/Region** (e.g., "southeastasia", "eastus")

## Step 3: Configure Environment Variables

Add these to your `.env` file in the project root:

```env
# Azure Speech Service Configuration
VITE_AZURE_SPEECH_KEY=your_key_here
VITE_AZURE_SPEECH_REGION=southeastasia
```

**Important**:
- Never commit your `.env` file to version control
- Add `.env` to your `.gitignore`
- For production, use environment variables in your hosting platform

## Step 4: Install Dependencies

Install the Microsoft Cognitive Services Speech SDK:

```bash
npm install microsoft-cognitiveservices-speech-sdk
```

## Step 5: Update Database Schema

The pronunciation exercise type should already be supported in your database. If you get a constraint error, follow these steps:

### Option A: Run the complete SQL script

In your Supabase SQL Editor, run the script at `src/supabase/update_pronunciation_constraint.sql`

### Option B: Manual steps

1. **First, check what exercise types exist** in your database:
```sql
SELECT DISTINCT exercise_type, COUNT(*) as count
FROM exercises
GROUP BY exercise_type
ORDER BY exercise_type;
```

2. **Then update the constraint** to include ALL existing types plus 'pronunciation':
```sql
-- Drop existing constraint
ALTER TABLE exercises
DROP CONSTRAINT IF EXISTS exercises_exercise_type_check;

-- Add updated constraint with ALL types (adjust based on what you found in step 1)
ALTER TABLE exercises
ADD CONSTRAINT exercises_exercise_type_check
CHECK (exercise_type IN (
  'flashcard',
  'fill_blank',
  'multiple_choice',
  'video',
  'quiz',
  'listening',
  'speaking',
  'pronunciation',
  'dropdown',
  'drag_drop',
  'ai_fill_blank'
));
```

**Important**: Make sure to include ALL exercise types that currently exist in your database in the constraint, otherwise you'll get a violation error.

## Step 6: Create Storage Bucket for Audio (Optional)

If you want to upload reference audio files:

1. In Supabase Dashboard, go to **Storage**
2. Create a new bucket named `exercise-audio`
3. Set it to **Public** for easy access
4. Update RLS policies if needed

## Usage Guide

### For Admins: Creating Pronunciation Exercises

1. Go to Admin Panel → Exercise Management
2. Click "Create Exercise"
3. Select "Pronunciation" as exercise type
4. Add questions using one of these methods:

#### Method 1: Individual Entry
- Click "Add Question"
- Enter the text/word/phrase to pronounce
- (Optional) Add IPA phonetic notation
- (Optional) Upload or link reference audio
- (Optional) Add pronunciation tips
- Set difficulty level

#### Method 2: Bulk Import
- Click "Bulk Import"
- Use this format (one per line):
  ```
  text | phonetic | difficulty | audio_url
  ```
- Example:
  ```
  Hello | həˈloʊ | easy | https://example.com/hello.mp3
  Beautiful | ˈbjuːtɪf(ə)l | medium
  Pronunciation | prəˌnʌnsiˈeɪʃən | hard
  ```
- Only text is required, other fields are optional

### For Students: Practicing Pronunciation

1. Go to the pronunciation exercise
2. Read the word/phrase displayed
3. (Optional) Click "Listen" to hear reference audio
4. Click the microphone button to start recording
5. Speak clearly into your microphone
6. Click stop when done
7. View your scores:
   - **Overall Score**: Combined assessment
   - **Accuracy**: How correctly you pronounced each sound
   - **Fluency**: How natural and smooth your speech was
   - **Completeness**: Whether you spoke all the required words
8. Click "Next" to continue

## Troubleshooting

### "Azure Speech Service not configured" Error
- Make sure you've added `VITE_AZURE_SPEECH_KEY` to your `.env` file
- Restart your development server after adding environment variables

### Microphone Not Working
- Browser must have microphone permission
- Check browser console for permission errors
- Try using HTTPS (required for microphone access in most browsers)
- On Safari/iOS, ensure microphone permissions are enabled in Settings

### Low Recognition Accuracy
- Speak clearly and at moderate speed
- Reduce background noise
- Use a good quality microphone
- Ensure correct language setting (currently set to 'en-US')

### API Quota Exceeded
- Free tier: 5 audio hours per month
- Upgrade to S0 (Standard) tier for production use
- Monitor usage in Azure Portal

## Pricing

Azure Speech Service pricing (as of 2024):

- **Free (F0)**:
  - 5 audio hours/month for speech-to-text
  - Great for development and testing

- **Standard (S0)**:
  - Pay-as-you-go
  - $1 per audio hour for standard speech-to-text
  - $2.75 per audio hour for pronunciation assessment
  - First 5 hours free each month

Check [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) for current rates.

## Advanced Configuration

### Change Recognition Language

In `PronunciationExercise.jsx`, line 97:

```javascript
speechConfig.speechRecognitionLanguage = 'en-US'  // Change this
```

Supported languages:
- `en-US` - English (United States)
- `en-GB` - English (United Kingdom)
- `en-AU` - English (Australia)
- `zh-CN` - Chinese (Mandarin, Simplified)
- And [many more](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support)

### Adjust Grading System

In `PronunciationExercise.jsx`, line 102-106:

```javascript
const pronunciationAssessmentConfig = new sdk.PronunciationAssessmentConfig(
  referenceText,
  sdk.PronunciationAssessmentGradingSystem.HundredMark,  // or FivePoint
  sdk.PronunciationAssessmentGranularity.Phoneme,         // Word, or FullText
  true  // Enable miscue (extra/missing words detection)
)
```

## Security Best Practices

1. **Never expose API keys in client code**: Currently keys are in environment variables which are bundled. For production, consider:
   - Creating a backend proxy endpoint
   - Using Azure AD authentication
   - Implementing token refresh logic

2. **Implement rate limiting**: Add server-side rate limiting to prevent API abuse

3. **Monitor usage**: Set up Azure alerts for unusual usage patterns

## Resources

- [Azure Speech Service Documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/)
- [Pronunciation Assessment Reference](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment)
- [Speech SDK for JavaScript](https://learn.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/)
- [IPA Phonetic Generator](https://tophonetics.com/)

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify Azure credentials and quotas
3. Ensure microphone permissions are granted
4. Test with a simple word first (e.g., "hello")

---

**Created by**: Claude Code Assistant
**Last Updated**: 2025
