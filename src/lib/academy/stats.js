import { PRACTICE_SECTION_IDS } from "./content";

export function createSectionStats() {
  return {
    attempts: 0,
    correct: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedAt: 0,
  };
}

export function buildInitialStats() {
  return Object.fromEntries(
    PRACTICE_SECTION_IDS.map((sectionId) => [sectionId, createSectionStats()]),
  );
}

export function normalizeStats(rawStats) {
  return Object.fromEntries(
    PRACTICE_SECTION_IDS.map((sectionId) => {
      const rawSection = rawStats?.[sectionId];
      const base = createSectionStats();

      return [
        sectionId,
        {
          ...base,
          attempts: Number(rawSection?.attempts) || 0,
          correct: Number(rawSection?.correct) || 0,
          currentStreak: Number(rawSection?.currentStreak) || 0,
          bestStreak: Number(rawSection?.bestStreak) || 0,
          lastPlayedAt: Number(rawSection?.lastPlayedAt) || 0,
        },
      ];
    }),
  );
}

export function summarizeStats(stats) {
  const summary = PRACTICE_SECTION_IDS.reduce(
    (accumulator, sectionId) => {
      const sectionStats = stats[sectionId];

      accumulator.attempts += sectionStats.attempts;
      accumulator.correct += sectionStats.correct;
      accumulator.bestStreak = Math.max(
        accumulator.bestStreak,
        sectionStats.bestStreak,
      );
      return accumulator;
    },
    { attempts: 0, correct: 0, bestStreak: 0 },
  );

  return {
    ...summary,
    accuracy: summary.attempts ? summary.correct / summary.attempts : null,
  };
}

export function findWeakestSectionId(stats) {
  const attempted = PRACTICE_SECTION_IDS.filter(
    (sectionId) => stats[sectionId].attempts > 0,
  );

  if (!attempted.length) {
    return "adicao";
  }

  return attempted.sort((left, right) => {
    const leftAccuracy = stats[left].correct / stats[left].attempts;
    const rightAccuracy = stats[right].correct / stats[right].attempts;

    if (leftAccuracy !== rightAccuracy) {
      return leftAccuracy - rightAccuracy;
    }

    return stats[left].attempts - stats[right].attempts;
  })[0];
}

export function recordSectionAttempt(stats, sectionId, isCorrect, now = Date.now()) {
  const previousStats = stats[sectionId] ?? createSectionStats();
  const nextStreak = isCorrect ? previousStats.currentStreak + 1 : 0;

  return {
    ...stats,
    [sectionId]: {
      ...previousStats,
      attempts: previousStats.attempts + 1,
      correct: previousStats.correct + (isCorrect ? 1 : 0),
      currentStreak: nextStreak,
      bestStreak: Math.max(previousStats.bestStreak, nextStreak),
      lastPlayedAt: now,
    },
  };
}
