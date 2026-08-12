import {
  PRACTICE_SECTION_IDS,
  SECTIONS,
  STORAGE_KEY,
  buildDefaultSelections,
  getFlashcardDeck,
  getPresets,
} from "./content";
import { normalizeFactProfiles } from "./profile";
import { buildInitialStats, normalizeStats } from "./stats";

export function clampFlashcardIndex(index, length) {
  if (!length) {
    return 0;
  }

  const numericIndex = Number(index) || 0;

  return ((numericIndex % length) + length) % length;
}

export function createDefaultAppState() {
  const flashDeck = getFlashcardDeck();

  return {
    activeSectionId: "teoria",
    selectedPresets: buildDefaultSelections(),
    stats: buildInitialStats(),
    history: [],
    factProfiles: {},
    flashcards: {
      deckId: flashDeck.id,
      index: 0,
      revealed: false,
    },
  };
}

export function loadAppState() {
  if (typeof window === "undefined") {
    return createDefaultAppState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return createDefaultAppState();
    }

    const parsed = JSON.parse(raw);
    const defaults = createDefaultAppState();
    const flashDeck = getFlashcardDeck(parsed?.flashcards?.deckId);

    return {
      activeSectionId: SECTIONS.some(
        (section) => section.id === parsed?.activeSectionId,
      )
        ? parsed.activeSectionId
        : defaults.activeSectionId,
      selectedPresets: normalizeSelectedPresets(parsed?.selectedPresets),
      stats: normalizeStats(parsed?.stats),
      history: Array.isArray(parsed?.history)
        ? parsed.history
            .slice(0, 12)
            .filter((item) => item && typeof item === "object")
        : [],
      factProfiles: normalizeFactProfiles(parsed?.factProfiles),
      flashcards: {
        deckId: flashDeck.id,
        index: clampFlashcardIndex(
          parsed?.flashcards?.index,
          flashDeck.cards.length,
        ),
        revealed: Boolean(parsed?.flashcards?.revealed),
      },
    };
  } catch {
    return createDefaultAppState();
  }
}

function normalizeSelectedPresets(rawSelectedPresets) {
  const defaults = buildDefaultSelections();

  return Object.fromEntries(
    PRACTICE_SECTION_IDS.map((sectionId) => {
      const requestedPresetId = rawSelectedPresets?.[sectionId];
      const isValid = getPresets(sectionId).some(
        (preset) => preset.id === requestedPresetId,
      );

      return [sectionId, isValid ? requestedPresetId : defaults[sectionId]];
    }),
  );
}
