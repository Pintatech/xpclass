import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const ChestDropNotification = () => {
  const [chest, setChest] = useState(null)
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const handleChest = (e) => {
      setChest(e.detail)
    }
    window.addEventListener('chest-earned', handleChest)
    return () => window.removeEventListener('chest-earned', handleChest)
  }, [])

  useEffect(() => {
    if (chest) {
      setVisible(true)
      setLeaving(false)

      const timer = setTimeout(() => {
        setLeaving(true)
        setTimeout(() => {
          setVisible(false)
          setChest(null)
        }, 500)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [chest])

  if (!visible || !chest) return null

  const dismiss = () => {
    setLeaving(true)
    setTimeout(() => {
      setVisible(false)
      setChest(null)
    }, 300)
  }

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-500 ${
      leaving ? 'opacity-0 translate-x-10' : 'opacity-100 translate-x-0'
    }`}>
      <div className="bg-gradient-to-r from-amber-100 to-yellow-200 border-2 border-amber-400 rounded-xl p-3 shadow-lg flex items-center gap-3 max-w-xs">
        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
          {chest.chest_image_url ? (
            <img src={chest.chest_image_url} alt={chest.chest_name} className="w-10 h-10 object-contain" />
          ) : (
            <span className="text-2xl">📦</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-amber-600 font-medium">Chest Earned!</p>
          <p className="text-sm font-bold text-amber-800 truncate">{chest.chest_name}</p>
          <p className="text-xs text-amber-600 opacity-75">Check your inventory</p>
        </div>
        <button onClick={dismiss} className="p-1 hover:bg-white hover:bg-opacity-50 rounded">
          <X className="w-4 h-4 text-amber-600" />
        </button>
      </div>
    </div>
  )
}

export default ChestDropNotification
