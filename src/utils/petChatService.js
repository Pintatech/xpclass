// Pet Chat Service - AI-powered pet conversations
// Uses MegaLLM AI to generate pet responses

export const chatWithPet = async (pet, userMessage, chatHistory = [], language = 'vi') => {
  try {
    console.log('🐾 Calling Pet Chat AI...')
    const response = await callMegaLLMPetChat(pet, userMessage, chatHistory, language)
    console.log('✅ Pet response received:', response)
    return response
  } catch (error) {
    console.error('❌ Pet chat error:', error)
    // Fallback to simple responses if AI fails
    return getFallbackResponse(pet, language)
  }
}

// Fallback responses when AI is unavailable
const getFallbackResponse = (pet, language) => {
  const fallbacksVi = [
    `*${pet.nickname || pet.name} vẫy đuôi vui vẻ*`,
    `${pet.nickname || pet.name} nhìn bạn với ánh mắt yêu thương!`,
    `*${pet.nickname || pet.name} kêu lên vui sướng*`,
    `${pet.nickname || pet.name} muốn chơi với bạn!`,
    `*${pet.nickname || pet.name} nhảy nhót quanh bạn*`,
  ]

  const fallbacksEn = [
    `*${pet.nickname || pet.name} wags happily*`,
    `${pet.nickname || pet.name} looks at you lovingly!`,
    `*${pet.nickname || pet.name} makes happy sounds*`,
    `${pet.nickname || pet.name} wants to play with you!`,
    `*${pet.nickname || pet.name} bounces around you*`,
  ]

  const fallbacks = language === 'vi' ? fallbacksVi : fallbacksEn
  return {
    message: fallbacks[Math.floor(Math.random() * fallbacks.length)],
    mood: 'happy'
  }
}

// MegaLLM Pet Chat integration with retry
const callMegaLLMPetChat = async (pet, userMessage, _chatHistory, language, retryCount = 0) => {
  const API_KEY = import.meta.env.VITE_MEGALLM_API_KEY || 'sk-mega-90798a7547487b440a37b054ffbb33cbc57d85cf86929b52bb894def833d784e'

  if (!API_KEY) {
    throw new Error('MegaLLM API key not configured')
  }

  const petName = pet.nickname || pet.name
  const petType = pet.info || 'virtual pet'

  // Simplified prompt for reliability
  const systemPrompt = language === 'vi'
    ? `Bạn tên là ${petName}, một ${petType} dễ thương. Trả lời ngắn (1-2 câu), vui vẻ, có thể dùng emoji. Level: ${pet.level}, Vui: ${pet.happiness}%.`
    : `Your name is ${petName}, a cute ${petType}. Reply short (1-2 sentences), cheerful, can use emojis. Level: ${pet.level}, Happy: ${pet.happiness}%.`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ]

  try {
    console.log('📤 Sending pet chat request to MegaLLM...')

    const response = await fetch('https://ai.megallm.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai-gpt-oss-20b',
        messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    })

    console.log('📥 MegaLLM Pet Chat response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`MegaLLM API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content

    if (!rawContent) {
      if (retryCount < 1) {
        console.warn('⚠️ Empty response, retrying...')
        await new Promise(r => setTimeout(r, 500))
        return callMegaLLMPetChat(pet, userMessage, _chatHistory, language, retryCount + 1)
      }
      console.warn('⚠️ Empty response from AI, using fallback')
      throw new Error('Empty AI response')
    }

    const content = rawContent.trim()
    console.log('🐾 Pet says:', content)

    // Determine mood from response content
    let mood = 'happy'
    if (content.includes('buồn') || content.includes('sad') || content.includes('😢')) {
      mood = 'sad'
    } else if (content.includes('mệt') || content.includes('tired') || content.includes('😴')) {
      mood = 'tired'
    }

    return {
      message: content,
      mood
    }
  } catch (error) {
    console.error('MegaLLM Pet Chat error:', error)
    throw error
  }
}

// Pet Tutor - AI-powered explanations for wrong answers
export const getPetTutorExplanation = async (pet, questionData, language = 'vi') => {
  try {
    console.log('🎓 Calling Pet Tutor AI...')
    const response = await callMegaLLMPetTutor(pet, questionData, language)
    console.log('✅ Pet tutor response received:', response)
    return response
  } catch (error) {
    console.error('❌ Pet tutor error:', error)
    // Fallback response if AI fails
    return getTutorFallbackResponse(pet, language)
  }
}

// Fallback responses when AI tutoring is unavailable
const getTutorFallbackResponse = (pet, language) => {
  const petName = pet?.nickname || pet?.name || 'Pet'
  const fallbacksVi = [
    `*${petName} gãi đầu* Hmm, câu này hơi khó nhỉ! Thử đọc lại đề bài nhé! 📚`,
    `${petName} tin bạn sẽ làm được! Đừng bỏ cuộc nha! 💪`,
    `*${petName} vỗ vai bạn* Sai một lần không sao, quan trọng là học từ sai lầm! ✨`,
  ]
  const fallbacksEn = [
    `*${petName} scratches head* Hmm, this one is tricky! Try reading the question again! 📚`,
    `${petName} believes in you! Don't give up! 💪`,
    `*${petName} pats your shoulder* Making mistakes is okay, what matters is learning from them! ✨`,
  ]
  const fallbacks = language === 'vi' ? fallbacksVi : fallbacksEn
  return {
    message: fallbacks[Math.floor(Math.random() * fallbacks.length)],
    success: false
  }
}

// MegaLLM Pet Tutor integration
const callMegaLLMPetTutor = async (pet, questionData, language, retryCount = 0) => {
  const API_KEY = import.meta.env.VITE_MEGALLM_API_KEY || 'sk-mega-90798a7547487b440a37b054ffbb33cbc57d85cf86929b52bb894def833d784e'

  if (!API_KEY) {
    throw new Error('MegaLLM API key not configured')
  }

  const petName = pet?.nickname || pet?.name || 'Pet'
  const petType = pet?.info || 'virtual pet'
  const { question, selectedAnswer, correctAnswer } = questionData

  // Tutor-focused prompt
  const systemPrompt = language === 'vi'
    ? `Bạn là ${petName}, một ${petType} đang giúp học sinh học bài. Học sinh vừa trả lời sai câu hỏi này:

Câu hỏi: ${question}
Học sinh chọn: ${selectedAnswer}
Đáp án đúng: ${correctAnswer}

Hãy giải thích ngắn gọn (2-3 câu) tại sao đáp án kia đúng, theo cách thân thiện và dễ hiểu. Dùng ngôn ngữ vui vẻ, có thể dùng emoji. Không lặp lại câu hỏi.`
    : `You are ${petName}, a ${petType} helping a student learn. The student just got this question wrong:

Question: ${question}
Student chose: ${selectedAnswer}
Correct answer: ${correctAnswer}

Explain briefly (2-3 sentences) why the correct answer is right, in a friendly and easy-to-understand way. Use cheerful language, emojis are OK. Don't repeat the question.`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: language === 'vi' ? 'Giải thích giúp mình nhé!' : 'Please explain!' }
  ]

  try {
    console.log('📤 Sending pet tutor request to MegaLLM...')

    const response = await fetch('https://ai.megallm.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai-gpt-oss-20b',
        messages,
        max_tokens: 500,
        temperature: 0.7
      })
    })

    console.log('📥 MegaLLM Pet Tutor response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`MegaLLM API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content

    if (!rawContent) {
      if (retryCount < 1) {
        console.warn('⚠️ Empty response, retrying...')
        await new Promise(r => setTimeout(r, 500))
        return callMegaLLMPetTutor(pet, questionData, language, retryCount + 1)
      }
      console.warn('⚠️ Empty response from AI, using fallback')
      throw new Error('Empty AI response')
    }

    const content = rawContent.trim()
    console.log('🎓 Pet tutor says:', content)

    return {
      message: content,
      success: true
    }
  } catch (error) {
    console.error('MegaLLM Pet Tutor error:', error)
    throw error
  }
}

export default chatWithPet
