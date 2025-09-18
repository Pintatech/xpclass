import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useProgress } from '../../hooks/useProgress'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { 
  Target, 
  Star, 
  CheckCircle, 
  Gift,
  Clock,
  Trophy
} from 'lucide-react'

const DailyQuest = () => {
  const { user } = useAuth()
  const { getDailyQuest, claimDailyQuestReward } = useProgress()
  const [quest, setQuest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (user) {
      fetchTodayQuest()
    }
  }, [user])

  const fetchTodayQuest = async () => {
    try {
      setLoading(true)
      const questData = await getDailyQuest()
      setQuest(questData)
    } catch (error) {
      console.error('Error fetching daily quest:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartQuest = () => {
    if (quest && quest.exercise_id) {
      // Navigate to exercise based on exercise type
      const exerciseType = quest.exercise_type
      const exerciseId = quest.exercise_id
      const sessionId = quest.session_id
      let exerciseUrl = ''
      
      switch (exerciseType) {
        case 'multiple_choice':
          exerciseUrl = `/study/multiple-choice?exerciseId=${exerciseId}${sessionId ? `&sessionId=${sessionId}` : ''}`
          break
        case 'flashcard':
          exerciseUrl = `/study/flashcard?exerciseId=${exerciseId}${sessionId ? `&sessionId=${sessionId}` : ''}`
          break
        case 'audio_flashcard':
          exerciseUrl = `/study/audio-flashcard?exerciseId=${exerciseId}${sessionId ? `&sessionId=${sessionId}` : ''}`
          break
        case 'pronunciation':
          exerciseUrl = `/study/pronunciation?exerciseId=${exerciseId}${sessionId ? `&sessionId=${sessionId}` : ''}`
          break
        case 'video':
          exerciseUrl = `/study/video?exerciseId=${exerciseId}${sessionId ? `&sessionId=${sessionId}` : ''}`
          break
        case 'quiz':
          exerciseUrl = `/study/quiz?exerciseId=${exerciseId}${sessionId ? `&sessionId=${sessionId}` : ''}`
          break
        case 'listening':
          exerciseUrl = `/study/listening?exerciseId=${exerciseId}${sessionId ? `&sessionId=${sessionId}` : ''}`
          break
        case 'speaking':
          exerciseUrl = `/study/speaking?exerciseId=${exerciseId}${sessionId ? `&sessionId=${sessionId}` : ''}`
          break
        default:
          // Fallback to a generic exercise route or show error
          console.error('Unknown exercise type:', exerciseType)
          alert('Loại bài tập không được hỗ trợ: ' + exerciseType)
          return
      }
      
      // Navigate to the correct exercise URL
      window.location.href = exerciseUrl
    }
  }

  const handleClaimReward = async () => {
    if (!quest || quest.status !== 'completed') return

    try {
      setClaiming(true)
      const result = await claimDailyQuestReward(quest.quest_id)

      if (result.success) {
        // Refresh quest status
        await fetchTodayQuest()
        // Show success message
        alert(`🎉 Chúc mừng! Bạn đã nhận được ${result.xpEarned} XP!`)
      } else {
        alert(`Có lỗi xảy ra: ${result.error}`)
      }
    } catch (error) {
      console.error('Error claiming reward:', error)
      alert('Có lỗi xảy ra khi nhận thưởng!')
    } finally {
      setClaiming(false)
    }
  }

  const getQuestStatusIcon = () => {
    switch (quest?.status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      case 'claimed':
        return <Gift className="w-6 h-6 text-purple-500" />
      default:
        return <Target className="w-6 h-6 text-blue-500" />
    }
  }

  const getQuestStatusText = () => {
    switch (quest?.status) {
      case 'completed':
        return 'Hoàn thành'
      case 'claimed':
        return 'Đã nhận thưởng'
      default:
        return 'Ready'
    }
  }

  const getQuestStatusColor = () => {
    switch (quest?.status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'claimed':
        return 'text-purple-600 bg-purple-50 border-purple-200'
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200'
    }
  }

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
        <Card.Content className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            <span className="ml-3 text-gray-600">Đang tải quest...</span>
          </div>
        </Card.Content>
      </Card>
    )
  }

  if (!quest) {
    return (
      <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
        <Card.Content className="p-6">
          <div className="text-center">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Không có quest hôm nay</h3>
            <p className="text-gray-500">Hãy quay lại vào ngày mai để nhận quest mới!</p>
          </div>
        </Card.Content>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
      <Card.Content className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getQuestStatusIcon()}
            <div>
              <h3 className="text-lg font-bold text-gray-900">Daily Quest</h3>
              <p className="text-sm text-gray-600">Intellect training has arrived!</p>
            </div>
          </div>
        
        </div>

        {/* Quest Content */}
        <div className="bg-white rounded-lg p-4 mb-4 border border-orange-100">    
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Level:</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                {quest.level_title}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Unit:</span>
              <span className="text-sm font-medium text-gray-800">{quest.unit_title}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Session:</span>
              <span className="text-sm font-medium text-gray-800">{quest.session_title}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Exercise:</span>
              <span className="text-sm font-medium text-gray-800">{quest.exercise_title}</span>
            </div>

          </div>
        </div>

        {/* XP Reward */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-medium text-gray-700">Phần thưởng:</span>
            <span className="text-lg font-bold text-yellow-600">{quest.xp_reward} XP</span>
          </div>
          <Trophy className="w-6 h-6 text-yellow-500" />
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {quest.status === 'available' && (
            <Button 
              onClick={handleStartQuest}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Bắt đầu Quest
            </Button>
          )}
          
          {quest.status === 'completed' && (
            <Button 
              onClick={handleClaimReward}
              disabled={claiming}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {claiming ? 'Đang nhận...' : 'Nhận Thưởng'}
            </Button>
          )}
          
          {quest.status === 'claimed' && (
            <div className="flex-1 text-center font-medium py-2 px-4 rounded-lg">
            Đã nhận thưởng
            </div>
          )}
        </div>

        {/* Progress Info */}
        <div className="mt-4 pt-4 border-t border-orange-200">
          <p className="text-xs text-gray-500 text-center">
            Quest sẽ được làm mới vào ngày mai lúc 00:00
          </p>
        </div>
      </Card.Content>
    </Card>
  )
}

export default DailyQuest
