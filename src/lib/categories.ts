/**
 * Legacy category module — categories are now shared multi-tags.
 * Kept so older imports keep working during the transition.
 */
export {
  createPromptTag as createPromptCategory,
  getActivePromptTagNames as getActivePromptCategoryNames,
  listPromptTags as listPromptCategories,
  setPromptTagActive as setPromptCategoryActive,
  updatePromptTag as updatePromptCategory,
  type PromptTag as PromptCategory
} from "@/lib/tags";

export { ensurePromptTagsForImport as ensurePromptCategoriesForImport } from "@/lib/tags";
