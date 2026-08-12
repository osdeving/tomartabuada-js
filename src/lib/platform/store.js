import { createDefaultAppState as createLegacyState } from "../academy/storage";
import { PRACTICE_SECTION_IDS } from "../academy/content";

export const PLATFORM_STORAGE_KEY = "tomar-tabuada.platform.v2";
export const PLATFORM_SCHEMA_VERSION = 2;
const LEGACY_STORAGE_KEY = "tomar-tabuada.mental-math.v1";
const MAX_ATTEMPTS = 2_000;
const MAX_SESSIONS = 120;

export function createPlatformState(now = Date.now()) {
  const legacy = createLegacyState();

  return {
    schemaVersion: PLATFORM_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    settings: {
      theme: "neon",
      sound: true,
      haptics: true,
      reducedMotion: false,
      questionCount: 15,
      timeProfileId: "calmo",
      practiceKind: "adaptive",
      memorizationOperationId: "multiplication",
      memorizationPresetId: "all",
      memorizationPresetIds: ["all"],
      memorizationDifficultyMode: "adaptive",
      memorizationDifficultyTier: "all",
      dailyGoal: 20,
      autoRestCoach: true,
    },
    profile: {
      displayName: "Atleta mental",
      level: 1,
      xp: 0,
    },
    selectedGroupId: "misto",
    selectedModeId: "sparring",
    sectionStats: legacy.stats,
    factProfiles: {},
    attempts: [],
    sessions: [],
    campaign: {},
    records: {
      bestCombo: 0,
      bestScore: {},
      fastestCorrectMs: null,
    },
  };
}

export function loadPlatformState() {
  if (typeof window === "undefined") return createPlatformState();

  try {
    const raw = window.localStorage.getItem(PLATFORM_STORAGE_KEY);

    if (raw) return normalizePlatformState(JSON.parse(raw));

    return migrateLegacyState();
  } catch {
    return createPlatformState();
  }
}

export function savePlatformState(state) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    PLATFORM_STORAGE_KEY,
    JSON.stringify({ ...state, updatedAt: Date.now() }),
  );
}

export function normalizePlatformState(raw) {
  const defaults = createPlatformState(Number(raw?.createdAt) || Date.now());
  const attempts = Array.isArray(raw?.attempts)
    ? raw.attempts.filter(isObject).slice(0, MAX_ATTEMPTS)
    : [];
  const sessions = Array.isArray(raw?.sessions)
    ? raw.sessions.filter(isObject).slice(0, MAX_SESSIONS)
    : [];

  return {
    ...defaults,
    ...raw,
    schemaVersion: PLATFORM_SCHEMA_VERSION,
    settings: { ...defaults.settings, ...(isObject(raw?.settings) ? raw.settings : {}) },
    profile: { ...defaults.profile, ...(isObject(raw?.profile) ? raw.profile : {}) },
    sectionStats: normalizeSectionStats(raw?.sectionStats, defaults.sectionStats),
    factProfiles: isObject(raw?.factProfiles) ? raw.factProfiles : {},
    attempts,
    sessions,
    campaign: isObject(raw?.campaign) ? raw.campaign : {},
    records: {
      ...defaults.records,
      ...(isObject(raw?.records) ? raw.records : {}),
      bestScore: isObject(raw?.records?.bestScore) ? raw.records.bestScore : {},
    },
  };
}

export function appendAttempt(state, attempt) {
  const sectionId = attempt.sectionId;
  const previousSection = state.sectionStats[sectionId] ?? {
    attempts: 0,
    correct: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedAt: 0,
  };
  const currentStreak = attempt.correct ? previousSection.currentStreak + 1 : 0;
  const bestCombo = Math.max(state.records.bestCombo, attempt.combo ?? 0);
  const responseTime = attempt.correct ? Number(attempt.responseTimeMs) : null;
  const fastestCorrectMs = responseTime
    ? state.records.fastestCorrectMs == null
      ? responseTime
      : Math.min(state.records.fastestCorrectMs, responseTime)
    : state.records.fastestCorrectMs;

  return {
    ...state,
    sectionStats: {
      ...state.sectionStats,
      [sectionId]: {
        ...previousSection,
        attempts: previousSection.attempts + 1,
        correct: previousSection.correct + (attempt.correct ? 1 : 0),
        currentStreak,
        bestStreak: Math.max(previousSection.bestStreak, currentStreak),
        lastPlayedAt: attempt.answeredAt,
      },
    },
    attempts: [attempt, ...state.attempts].slice(0, MAX_ATTEMPTS),
    records: {
      ...state.records,
      bestCombo,
      fastestCorrectMs,
    },
  };
}

export function completeSession(state, summary) {
  const recordKey = summary.recordKey ?? `${summary.modeId}:${summary.groupId}`;
  const previousBest = Number(state.records.bestScore[recordKey]) || 0;
  const xpEarned = calculateSessionXp(summary);
  const nextXp = state.profile.xp + xpEarned;
  const nextLevel = Math.max(1, Math.floor(nextXp / 250) + 1);

  return {
    ...state,
    profile: {
      ...state.profile,
      xp: nextXp,
      level: nextLevel,
    },
    sessions: [{ ...summary, xpEarned }, ...state.sessions].slice(0, MAX_SESSIONS),
    records: {
      ...state.records,
      bestScore: {
        ...state.records.bestScore,
        [recordKey]: Math.max(previousBest, summary.score),
      },
    },
  };
}

export function calculateSessionXp(summary) {
  return Math.max(0, Math.round((Number(summary.score) || 0) / 20) + (Number(summary.correct) || 0) * 2);
}

export function recordCampaignResult(state, stage, summary, stars) {
  const previous = state.campaign[stage.id] ?? {};

  return {
    ...state,
    campaign: {
      ...state.campaign,
      [stage.id]: {
        completed: summary.accuracy >= stage.targetAccuracy,
        attempts: (Number(previous.attempts) || 0) + 1,
        bestAccuracy: Math.max(Number(previous.bestAccuracy) || 0, summary.accuracy),
        bestScore: Math.max(Number(previous.bestScore) || 0, summary.score),
        stars: Math.max(Number(previous.stars) || 0, stars),
        lastPlayedAt: summary.endedAt,
      },
    },
  };
}

export function updatePlatformSettings(state, patch) {
  return {
    ...state,
    settings: { ...state.settings, ...patch },
  };
}

export function exportPlatformData(state) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: "Cálculo Mental",
      schemaVersion: PLATFORM_SCHEMA_VERSION,
      data: state,
    },
    null,
    2,
  );
}

function migrateLegacyState() {
  const next = createPlatformState();

  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return next;

    const legacy = JSON.parse(legacyRaw);

    return normalizePlatformState({
      ...next,
      sectionStats: legacy.stats,
      factProfiles: legacy.factProfiles,
      attempts: (Array.isArray(legacy.history) ? legacy.history : []).map((entry) => ({
        id: entry.id,
        sessionId: "legacy",
        modeId: "sparring",
        groupId: entry.sectionId,
        sectionId: entry.sectionId,
        skillKey: entry.skillKey,
        prompt: entry.prompt,
        promptLatex: entry.promptLatex,
        expectedAnswer: entry.answer,
        givenAnswer: entry.correct ? entry.answer : null,
        correct: Boolean(entry.correct),
        responseTimeMs: Number(entry.responseTime) || null,
        answeredAt: Date.now(),
        source: "legacy",
      })),
    });
  } catch {
    return next;
  }
}

function normalizeSectionStats(rawStats, defaults) {
  return Object.fromEntries(
    PRACTICE_SECTION_IDS.map((sectionId) => {
      const raw = isObject(rawStats?.[sectionId]) ? rawStats[sectionId] : {};
      return [
        sectionId,
        {
          ...defaults[sectionId],
          attempts: Number(raw.attempts) || 0,
          correct: Number(raw.correct) || 0,
          currentStreak: Number(raw.currentStreak) || 0,
          bestStreak: Number(raw.bestStreak) || 0,
          lastPlayedAt: Number(raw.lastPlayedAt) || 0,
        },
      ];
    }),
  );
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
