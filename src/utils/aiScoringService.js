// AI Scoring Service for Fill-in-the-Blank Questions
// This service handles AI-powered answer evaluation

export const callAIScoring = async (question, userAnswer, expectedAnswers, context = 'educational assessment') => {
  try {
    // For now, we'll use a mock AI service
    // In production, this would call OpenAI API or similar
    const mockResponse = await mockAIScoring(question, userAnswer, expectedAnswers, context)
    return mockResponse
  } catch (error) {
    console.error('AI scoring error:', error)
    throw error
  }
}

// Mock AI scoring function (replace with real AI API call)
const mockAIScoring = async (question, userAnswer, expectedAnswers, context) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
  
  const userAnswerLower = userAnswer.toLowerCase().trim()
  const expectedAnswersLower = expectedAnswers.map(answer => answer.toLowerCase().trim())
  
  // Check for exact matches first
  const exactMatch = expectedAnswersLower.includes(userAnswerLower)
  if (exactMatch) {
    return {
      score: 100,
      confidence: 95,
      explanation: "Perfect match! Your answer exactly matches one of the expected answers."
    }
  }
  
  // Check for partial matches
  let bestScore = 0
  let bestExplanation = ""
  
  for (const expected of expectedAnswersLower) {
    const similarity = calculateSimilarity(userAnswerLower, expected)
    if (similarity > bestScore) {
      bestScore = similarity
      bestExplanation = generateExplanation(similarity, userAnswer, expected)
    }
  }
  
  // Check for keyword matches
  const keywordScore = checkKeywordMatches(userAnswerLower, expectedAnswersLower)
  if (keywordScore > bestScore) {
    bestScore = keywordScore
    bestExplanation = "Good! Your answer contains the key concepts, though the wording is different."
  }
  
  return {
    score: Math.round(bestScore),
    confidence: Math.min(95, Math.round(bestScore + Math.random() * 10)),
    explanation: bestExplanation || "Your answer doesn't quite match the expected responses. Try rephrasing or checking your spelling."
  }
}

// Calculate similarity between two strings (simple implementation)
const calculateSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 100
  
  const editDistance = levenshteinDistance(longer, shorter)
  return Math.max(0, ((longer.length - editDistance) / longer.length) * 100)
}

// Levenshtein distance calculation
const levenshteinDistance = (str1, str2) => {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

// Check for keyword matches
const checkKeywordMatches = (userAnswer, expectedAnswers) => {
  const userWords = userAnswer.split(/\s+/)
  let maxKeywordScore = 0
  
  for (const expected of expectedAnswers) {
    const expectedWords = expected.split(/\s+/)
    const commonWords = userWords.filter(word => 
      expectedWords.some(expectedWord => 
        word.includes(expectedWord) || expectedWord.includes(word)
      )
    )
    
    const keywordScore = (commonWords.length / expectedWords.length) * 100
    maxKeywordScore = Math.max(maxKeywordScore, keywordScore)
  }
  
  return maxKeywordScore
}

// Generate explanation based on similarity score
const generateExplanation = (similarity, userAnswer, expected) => {
  if (similarity >= 90) {
    return "Excellent! Your answer is very close to the expected response."
  } else if (similarity >= 70) {
    return "Good answer! You're on the right track with minor differences in wording."
  } else if (similarity >= 50) {
    return "Partial credit! Your answer has some correct elements but needs refinement."
  } else if (similarity >= 30) {
    return "Getting closer! Try to include more key terms from the question."
  } else {
    return "Not quite right. Consider reviewing the question and trying a different approach."
  }
}

// Real AI API integration (for production use)
export const callOpenAIScoring = async (question, userAnswer, expectedAnswers, context) => {
  const API_KEY = process.env.REACT_APP_OPENAI_API_KEY
  
  if (!API_KEY) {
    throw new Error('OpenAI API key not configured')
  }
  
  const prompt = `
You are an educational AI assistant scoring a fill-in-the-blank question.

Question: "${question}"
Student Answer: "${userAnswer}"
Expected Answers: ${JSON.stringify(expectedAnswers)}
Context: ${context}

Please evaluate the student's answer and provide:
1. A score from 0-100 based on correctness and understanding
2. A confidence level from 0-100
3. A brief explanation of your scoring

Consider:
- Exact matches should score 100
- Partial matches should score 50-90
- Conceptual understanding should be rewarded
- Minor spelling/grammar errors should not heavily penalize
- Completely wrong answers should score 0-30

Respond in JSON format:
{
  "score": number,
  "confidence": number,
  "explanation": "string"
}
`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an educational AI assistant that scores student answers fairly and provides helpful feedback.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    
    try {
      return JSON.parse(content)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content)
      throw new Error('Invalid response from AI service')
    }
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw error
  }
}
