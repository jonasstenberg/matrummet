// Barrel export for backwards compatibility
// All actions have been split into domain-specific files:
// - recipe-actions.ts: Recipe CRUD, import, likes, AI credits
// - shopping-list-actions.ts: Shopping list operations
// - settings-actions.ts: API keys, profile

export {
  // Recipe operations
  loadMoreRecipes,
  deductAiCredit,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  copyRecipe,
  toggleRecipeLike,
  importRecipeFromUrl,
  fetchUrlPageText,
  downloadAndSaveImage,
  // Share link operations
  createShareLink,
  revokeShareLink,
  getShareLinks,
  copySharedRecipe,
  type ImportRecipeResult,
} from './recipe-actions'

export {
  // Shopping list operations
  addRecipeToShoppingList,
  toggleShoppingListItem,
  clearCheckedItems,
  getUserShoppingLists,
  createShoppingList,
  renameShoppingList,
  deleteShoppingList,
  setDefaultShoppingList,
  addCustomShoppingListItem,
} from './shopping-list-actions'

export {
  // Settings operations
  getApiKeys,
  createApiKey,
  revokeApiKey,
  updateProfileAction,
  type UpdateProfileState,
} from './settings-actions'
