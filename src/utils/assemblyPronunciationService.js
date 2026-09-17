// AssemblyAI-backed pronunciation assessment.
// Replaces the former Azure Speech SDK service: the API key stays server-side
// behind /api/transcribe, so nothing secret ships in the browser bundle.
//
// AssemblyAI returns a transcript plus per-word confidence, not phoneme-level
// pronunciation scores. Scores below are derived from that: word confidence
// drives accuracy, matched/expected drives completeness, and word timings
// drive fluency. There is no phoneme or syllable breakdown.

const NON_WORD = /[^\p{L}\p{N}']/gu;

export const normalizeWord = (word) => word.toLowerCase().replace(NON_WORD, '').trim();
const normalize = normalizeWord;

export const stripHtml = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || div.innerText || '').trim();
};

const toWords = (text) => text.split(/\s+/).map(normalize).filter(Boolean);

// Walk the expected words in order, consuming transcript words as they match.
// Sequential rather than set-based so repeated words score once each and
// insertions ("um", false starts) don't hand out free credit.
const alignWords = (expectedWords, spokenWords) => {
  let cursor = 0;

  return expectedWords.map((expected) => {
    for (let i = cursor; i < spokenWords.length; i++) {
      if (spokenWords[i].normalized === expected) {
        cursor = i + 1;
        return {
          word: expected,
          accuracyScore: Math.round((spokenWords[i].confidence ?? 0) * 100),
          errorType: 'None',
          syllables: [],
          phonemes: []
        };
      }
    }

    return {
      word: expected,
      accuracyScore: 0,
      errorType: 'Omission',
      syllables: [],
      phonemes: []
    };
  });
};

// Fluency from word timings: pace inside a normal speaking band, no long
// mid-phrase stalls. Returns null when the timings are too sparse to judge.
const scoreFluency = (spokenWords) => {
  const timed = spokenWords.filter(w => typeof w.start === 'number' && typeof w.end === 'number');
  if (timed.length < 2) return null;

  const spanMs = timed[timed.length - 1].end - timed[0].start;
  if (spanMs <= 0) return null;

  const wpm = (timed.length / spanMs) * 60000;

  // 90-180 wpm reads as natural; drift outside costs a point per 2 wpm.
  let score = 100;
  if (wpm < 90) score -= (90 - wpm) / 2;
  else if (wpm > 180) score -= (wpm - 180) / 2;

  let longestGap = 0;
  for (let i = 1; i < timed.length; i++) {
    longestGap = Math.max(longestGap, timed[i].start - timed[i - 1].end);
  }
  if (longestGap > 700) score -= Math.min(25, (longestGap - 700) / 40);

  return Math.max(0, Math.min(100, Math.round(score)));
};

const buildFeedback = (overall, completeness, missingWords) => {
  if (overall >= 90) return 'Excellent! Your pronunciation is very clear.';
  if (missingWords.length > 0 && completeness < 80) {
    return `Try again and include every word — we did not catch: ${missingWords.slice(0, 3).join(', ')}.`;
  }
  if (overall >= 80) return 'Great job. A little more clarity and this is perfect.';
  if (overall >= 70) return 'Understandable. Slow down and pronounce each word fully.';
  return 'Keep practicing. Speak clearly, close to the microphone.';
};

export const assessPronunciation = async (referenceText, audioBlob) => {
  if (!audioBlob || audioBlob.size < 1000) {
    return {
      success: false,
      error: 'AUDIO_TOO_SHORT',
      message: 'Recording is too short or silent. Please speak clearly and try again.'
    };
  }

  const expectedWords = toWords(stripHtml(referenceText));
  if (expectedWords.length === 0) {
    return {
      success: false,
      error: 'NO_REFERENCE_TEXT',
      message: 'This question has no text to read.'
    };
  }

  let payload;
  try {
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
      body: audioBlob
    });

    payload = await response.json();

    if (!response.ok || !payload?.success) {
      return {
        success: false,
        error: 'SERVICE_ERROR',
        message: payload?.error || 'Speech service is unavailable. Please try again.'
      };
    }
  } catch (err) {
    console.error('Transcription request failed:', err);
    return {
      success: false,
      error: 'SERVICE_ERROR',
      message: 'Could not reach the speech service. Check your connection and try again.'
    };
  }

  const recognizedText = payload.text || '';
  if (!recognizedText.trim()) {
    return {
      success: false,
      error: 'NO_SPEECH',
      message: 'No speech was detected. Please speak louder and closer to the microphone.'
    };
  }

  const spokenWords = (payload.words || []).map(w => ({
    normalized: normalize(w.text || ''),
    confidence: w.confidence,
    start: w.start,
    end: w.end
  })).filter(w => w.normalized);

  const words = alignWords(expectedWords, spokenWords);
  const matched = words.filter(w => w.accuracyScore > 0);

  const accuracyScore = matched.length
    ? Math.round(matched.reduce((sum, w) => sum + w.accuracyScore, 0) / matched.length)
    : 0;
  const completenessScore = Math.round((matched.length / expectedWords.length) * 100);
  const fluencyScore = scoreFluency(spokenWords) ?? accuracyScore;

  const overallScore = Math.round(
    accuracyScore * 0.5 + completenessScore * 0.3 + fluencyScore * 0.2
  );

  const missingWords = words.filter(w => w.accuracyScore === 0).map(w => w.word);

  return {
    success: true,
    overallScore,
    accuracyScore,
    fluencyScore,
    completenessScore,
    prosodyScore: null,
    recognizedText,
    referenceText,
    words,
    feedback: buildFeedback(overallScore, completenessScore, missingWords)
  };
};
