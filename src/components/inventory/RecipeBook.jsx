import { useMemo } from 'react'
import { Lock, Sparkles, BookOpen } from 'lucide-react'
import RecipeCard from './RecipeCard'

const RecipeBook = ({ recipes, inventory, getItemQuantity, onSelectRecipe }) => {
  // Determine discovery & craftability for each recipe
  const categorized = useMemo(() => {
    const ownedItemIds = new Set(
      inventory.filter(e => e.quantity > 0).map(e => e.item_id)
    )

    return recipes.map(recipe => {
      const ings = recipe.ingredients || []
      const discovered = ings.some(ing => ownedItemIds.has(ing.item_id))
      const canCraft = ings.every(ing => getItemQuantity(ing.item_id) >= ing.quantity)
      // Progress: how many unique ingredients does the user have?
      const ingredientsOwned = ings.filter(ing => ownedItemIds.has(ing.item_id)).length
      return { recipe, discovered, canCraft, ingredientsOwned, totalIngredients: ings.length }
    }).sort((a, b) => {
      // Craftable first, then discovered, then undiscovered
      if (a.canCraft !== b.canCraft) return b.canCraft - a.canCraft
      if (a.discovered !== b.discovered) return b.discovered - a.discovered
      return b.ingredientsOwned - a.ingredientsOwned
    })
  }, [recipes, inventory, getItemQuantity])

  if (recipes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No recipes yet</h3>
        <p className="text-gray-500">Recipes will appear here when they're added.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="w-4 h-4 text-purple-600" />
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-purple-700">{categorized.filter(c => c.discovered).length}</span>
          {' / '}
          {categorized.length} recipes discovered
        </p>
      </div>

      {categorized.map(({ recipe, discovered, canCraft, ingredientsOwned, totalIngredients }) => {
        if (discovered) {
          return (
            <div key={recipe.id} className="relative">
              <RecipeCard
                recipe={recipe}
                getItemQuantity={getItemQuantity}
                inventory={inventory}
                readOnly
              />
              {onSelectRecipe && (
                <button
                  onClick={() => onSelectRecipe(recipe)}
                  className="absolute top-3 right-3 text-xs px-2.5 py-1 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors font-medium"
                >
                  Fill Table
                </button>
              )}
            </div>
          )
        }

        // Undiscovered recipe
        return (
          <div
            key={recipe.id}
            className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-5"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lock className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-400">??? Unknown Recipe</h4>
                <p className="text-sm text-gray-400">
                  Collect ingredients to discover this recipe
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-400 rounded-full transition-all"
                      style={{ width: `${totalIngredients > 0 ? (ingredientsOwned / totalIngredients) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    {ingredientsOwned}/{totalIngredients} ingredients
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default RecipeBook
