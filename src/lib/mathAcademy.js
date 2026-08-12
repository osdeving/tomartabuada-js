export {
  PRACTICE_SECTION_IDS,
  SECTIONS,
  STORAGE_KEY,
  THEORY_TOPICS,
  TRICK_LESSONS,
  buildDefaultSelections,
  getDefaultPresetId,
  getFlashcardDeck,
  getFlashcardDecks,
  getPresetById,
  getPresets,
  getSectionById,
  getSectionPrimers,
  isPracticeSection,
  isTabuadaHighlighted,
} from "./academy/content";
export { createPracticeQuestion, gradeQuestion } from "./academy/facts";
export {
  buildInitialStats,
  createSectionStats,
  findWeakestSectionId,
  recordSectionAttempt,
  summarizeStats,
} from "./academy/stats";
export { applyFactResult, createFactProfile } from "./academy/profile";
export { clampFlashcardIndex, createDefaultAppState, loadAppState } from "./academy/storage";

export { createPracticeQuestion as createQuestion } from "./academy/facts";
