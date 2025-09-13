import { useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { ArrowLeft, Volume2, Play, Pause } from 'lucide-react'

const AudioFlashcardExercise = () => {
  const [currentCard, setCurrentCard] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)

  const audioCards = [
    {
      id: 1,
      audio: '/audio/cat.mp3',
      image: '/images/cat.jpg',
      word: 'Cat',
      meaning: 'Con mèo',
      options: ['Dog', 'Cat', 'Bird', 'Fish']
    }
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link to="/study">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flashcard âm thanh</h1>
          <p className="text-gray-600">Học với âm thanh và hình ảnh</p>
        </div>
      </div>

      <Card>
        <Card.Content className="text-center py-12">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Volume2 className="w-10 h-10 text-purple-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Flashcard âm thanh
          </h3>
          <p className="text-gray-600">
            Tính năng này đang được phát triển...
          </p>
        </Card.Content>
      </Card>
    </div>
  )
}

export default AudioFlashcardExercise
