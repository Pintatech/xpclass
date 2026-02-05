import { useState, useEffect } from 'react'
import { Box, Sparkles, Package } from 'lucide-react'

const rarityColors = {
  common: 'border-gray-300 bg-gray-50 text-gray-700',
  uncommon: 'border-green-400 bg-green-50 text-green-700',
  rare: 'border-blue-400 bg-blue-50 text-blue-700',
  epic: 'border-purple-400 bg-purple-50 text-purple-700',
  legendary: 'border-yellow-400 bg-yellow-50 text-yellow-700',
}

const rarityGlow = {
  common: '',
  uncommon: 'shadow-green-200 shadow-md',
  rare: 'shadow-blue-300 shadow-lg',
  epic: 'shadow-purple-400 shadow-xl',
  legendary: 'shadow-yellow-400 shadow-2xl',
}

const ChestOpenAnimation = ({ result, onClose }) => {
  const [phase, setPhase] = useState('shaking') // shaking -> opening -> revealing -> done
  const [revealedCount, setRevealedCount] = useState(0)

  const items = result?.items || []

  useEffect(() => {
    // Shaking phase
    const shakeTimer = setTimeout(() => setPhase('opening'), 1000)
    return () => clearTimeout(shakeTimer)
  }, [])

  useEffect(() => {
    if (phase === 'opening') {
      const openTimer = setTimeout(() => setPhase('revealing'), 800)
      return () => clearTimeout(openTimer)
    }
  }, [phase])

  useEffect(() => {
    if (phase === 'revealing' && revealedCount < items.length) {
      const revealTimer = setTimeout(() => {
        setRevealedCount(prev => prev + 1)
      }, 400)
      return () => clearTimeout(revealTimer)
    } else if (phase === 'revealing' && revealedCount >= items.length) {
      setTimeout(() => setPhase('done'), 500)
    }
  }, [phase, revealedCount, items.length])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl max-w-md w-full p-6 text-center">
        {/* Chest Name */}
        <h3 className="text-lg font-bold text-white mb-6">
          {result.chest_name || 'Chest'}
        </h3>

        {/* Chest Animation */}
        {(phase === 'shaking' || phase === 'opening') && (
          <div className="flex items-center justify-center py-12">
            <div className={`w-24 h-24 rounded-xl flex items-center justify-center transition-all ${
              phase === 'shaking' ? 'animate-shake' : 'animate-open-chest scale-125 opacity-50'
            }`}>
              <img src="https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/39da6277-d7e8-4885-9cd8-12328bbe53a9/dgifusj-93812081-dcac-461a-b21e-eb324065b502.png?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi8zOWRhNjI3Ny1kN2U4LTQ4ODUtOWNkOC0xMjMyOGJiZTUzYTkvZGdpZnVzai05MzgxMjA4MS1kY2FjLTQ2MWEtYjIxZS1lYjMyNDA2NWI1MDIucG5nIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.71KnXbVROsoT4FQIMdStIfV7AQa1EaMh6G5PiwaVmc0" className=" text-yellow-100" />
            </div>
          </div>
        )}

        {/* Revealed Items */}
        {(phase === 'revealing' || phase === 'done') && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-1 text-yellow-400 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium">Items Received</span>
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border-2 p-3 transition-all duration-500 ${
                    idx < revealedCount
                      ? `${rarityColors[item.rarity]} ${rarityGlow[item.rarity]} opacity-100 scale-100`
                      : 'border-gray-700 bg-gray-800 opacity-30 scale-75'
                  }`}
                >
                  <div className="aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden mb-1.5">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
                    ) : (
                      <Package className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <p className="text-[10px] font-medium truncate text-center">
                    {idx < revealedCount ? item.name : '???'}
                  </p>
                  {idx < revealedCount && item.quantity > 1 && (
                    <p className="text-[10px] text-center opacity-75">x{item.quantity}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Close button */}
        {phase === 'done' && (
          <button
            onClick={onClose}
            className="mt-6 bg-amber-500 text-white px-8 py-2.5 rounded-lg hover:bg-amber-600 transition-colors font-medium"
          >
            Collect
          </button>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0) rotate(0); }
          10% { transform: translateX(-4px) rotate(-2deg); }
          20% { transform: translateX(4px) rotate(2deg); }
          30% { transform: translateX(-6px) rotate(-3deg); }
          40% { transform: translateX(6px) rotate(3deg); }
          50% { transform: translateX(-4px) rotate(-2deg); }
          60% { transform: translateX(4px) rotate(2deg); }
          70% { transform: translateX(-6px) rotate(-3deg); }
          80% { transform: translateX(6px) rotate(3deg); }
          90% { transform: translateX(-4px) rotate(-1deg); }
        }
        .animate-shake {
          animation: shake 0.8s ease-in-out infinite;
        }
        @keyframes openChest {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.8; }
          100% { transform: scale(0.5); opacity: 0; }
        }
        .animate-open-chest {
          animation: openChest 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

export default ChestOpenAnimation
