import { createDefaultAppState as createLegacyState } from "../academy/storage.js";
import { PRACTICE_SECTION_IDS } from "../academy/content.js";
import { actorProgressKey, selectActorPlatformState } from "./actorState.js";
import { DEFAULT_AUDIO_SETTINGS, normalizePlatformSettings } from "./platformSettings.js";
import { normalizeTrainingResume } from "./trainingResume.js";

export const PLATFORM_STORAGE_KEY = "tomar-tabuada.platform.v2";
export const PLATFORM_SCHEMA_VERSION = 4;
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
      ...DEFAULT_AUDIO_SETTINGS,
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
    actorProgress: {},
    selectedGroupId: "misto",
    selectedModeId: "sparring",
    trainingResume: null,
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
  const rawSettings = isObject(raw?.settings) ? raw.settings : {};
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
    settings: normalizePlatformSettings(rawSettings, defaults.settings),
    profile: { ...defaults.profile, ...(isObject(raw?.profile) ? raw.profile : {}) },
    actorProgress: normalizeActorProgress(raw?.actorProgress, defaults),
    sectionStats: normalizeSectionStats(raw?.sectionStats, defaults.sectionStats),
    factProfiles: isObject(raw?.factProfiles) ? raw.factProfiles : {},
    attempts,
    sessions,
    campaign: isObject(raw?.campaign) ? raw.campaign : {},
    trainingResume: normalizeTrainingResume(raw?.trainingResume),
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
  const actorKey = actorProgressKey(attempt.userId);
  const actorProgress = getActorProgress(state, attempt.userId);
  const actorProgressMap = initializeActorProgress(state);
  const nextActorProgress = applyAttemptToActorProgress(actorProgress, attempt);

  return {
    ...state,
    actorProgress: {
      ...actorProgressMap,
      [actorKey]: nextActorProgress,
    },
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
  if (summary.id && state.sessions.some((session) => session.id === summary.id)) {
    return state;
  }
  const recordKey = summary.recordKey ?? `${summary.modeId}:${summary.groupId}`;
  const previousBest = Number(state.records.bestScore[recordKey]) || 0;
  const xpEarned = calculateSessionXp(summary);
  const nextXp = state.profile.xp + xpEarned;
  const nextLevel = Math.max(1, Math.floor(nextXp / 250) + 1);
  const actorKey = actorProgressKey(summary.userId);
  const actorProgress = getActorProgress(state, summary.userId);
  const actorProgressMap = initializeActorProgress(state);
  const actorPreviousBest = Number(actorProgress.records?.bestScore?.[recordKey]) || 0;
  const actorNextXp = (Number(actorProgress.profile?.xp) || 0) + xpEarned;

  return {
    ...state,
    actorProgress: {
      ...actorProgressMap,
      [actorKey]: {
        ...actorProgress,
        profile: {
          ...actorProgress.profile,
          xp: actorNextXp,
          level: Math.max(1, Math.floor(actorNextXp / 250) + 1),
        },
        records: {
          ...actorProgress.records,
          bestScore: {
            ...actorProgress.records?.bestScore,
            [recordKey]: Math.max(actorPreviousBest, Number(summary.score) || 0),
          },
        },
      },
    },
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
  const actorKey = actorProgressKey(summary.userId);
  const actorProgress = getActorProgress(state, summary.userId);
  const actorProgressMap = initializeActorProgress(state);
  const actorPrevious = actorProgress.campaign?.[stage.id] ?? {};
  const actorStageResult = buildCampaignStageResult(actorPrevious, summary, stars, stage.targetAccuracy);

  return {
    ...state,
    actorProgress: {
      ...actorProgressMap,
      [actorKey]: {
        ...actorProgress,
        campaign: {
          ...actorProgress.campaign,
          [stage.id]: actorStageResult,
        },
      },
    },
    campaign: {
      ...state.campaign,
      [stage.id]: buildCampaignStageResult(previous, summary, stars, stage.targetAccuracy),
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

function getActorProgress(state, actorId) {
  const key = actorProgressKey(actorId);
  const persisted = state.actorProgress?.[key];
  if (isObject(persisted)) return persisted;

  const projected = selectActorPlatformState(state, actorId);
  return {
    profile: projected.profile,
    sectionStats: projected.sectionStats,
    campaign: projected.campaign,
    records: projected.records,
  };
}

function initializeActorProgress(state) {
  const existing = isObject(state.actorProgress) ? state.actorProgress : {};
  if (Object.keys(existing).length) return existing;

  const actorIds = new Set([null]);
  for (const entry of [...(state.attempts ?? []), ...(state.sessions ?? [])]) {
    const userId = String(entry?.userId ?? "").trim();
    if (userId) actorIds.add(userId);
  }

  return Object.fromEntries([...actorIds].map((actorId) => {
    const projected = selectActorPlatformState(state, actorId);
    return [actorProgressKey(actorId), {
      profile: projected.profile,
      sectionStats: projected.sectionStats,
      campaign: projected.campaign,
      records: projected.records,
    }];
  }));
}

function applyAttemptToActorProgress(progress, attempt) {
  const sectionId = attempt.sectionId;
  const previousSection = progress.sectionStats?.[sectionId] ?? {
    attempts: 0,
    correct: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedAt: 0,
  };
  const currentStreak = attempt.correct ? previousSection.currentStreak + 1 : 0;
  const responseTime = attempt.correct ? Number(attempt.responseTimeMs) : null;
  const previousFastest = Number(progress.records?.fastestCorrectMs) || null;
  const fastestCorrectMs = responseTime
    ? previousFastest == null
      ? responseTime
      : Math.min(previousFastest, responseTime)
    : previousFastest;

  return {
    ...progress,
    sectionStats: {
      ...progress.sectionStats,
      [sectionId]: {
        ...previousSection,
        attempts: previousSection.attempts + 1,
        correct: previousSection.correct + (attempt.correct ? 1 : 0),
        currentStreak,
        bestStreak: Math.max(previousSection.bestStreak, currentStreak),
        lastPlayedAt: attempt.answeredAt,
      },
    },
    records: {
      ...progress.records,
      bestCombo: Math.max(Number(progress.records?.bestCombo) || 0, attempt.combo ?? 0),
      fastestCorrectMs,
    },
  };
}

function buildCampaignStageResult(previous, summary, stars, targetAccuracy) {
  return {
    completed: Boolean(previous.completed) || summary.accuracy >= Number(targetAccuracy),
    attempts: (Number(previous.attempts) || 0) + 1,
    bestAccuracy: Math.max(Number(previous.bestAccuracy) || 0, Number(summary.accuracy) || 0),
    bestScore: Math.max(Number(previous.bestScore) || 0, Number(summary.score) || 0),
    stars: Math.max(Number(previous.stars) || 0, Number(stars) || 0),
    lastPlayedAt: summary.endedAt,
  };
}

function normalizeActorProgress(rawActorProgress, defaults) {
  if (!isObject(rawActorProgress)) return {};

  return Object.fromEntries(
    Object.entries(rawActorProgress)
      .filter(([key, progress]) => key && isObject(progress))
      .map(([key, progress]) => [key, {
        ...progress,
        profile: {
          ...defaults.profile,
          ...(isObject(progress.profile) ? progress.profile : {}),
        },
        sectionStats: normalizeSectionStats(progress.sectionStats, defaults.sectionStats),
        campaign: isObject(progress.campaign) ? progress.campaign : {},
        records: {
          ...defaults.records,
          ...(isObject(progress.records) ? progress.records : {}),
          bestScore: isObject(progress.records?.bestScore) ? progress.records.bestScore : {},
        },
      }]),
  );
}

function normalizeSectionStats(rawStats, defaults) {
  const sectionIds = [...new Set([
    ...PRACTICE_SECTION_IDS,
    ...Object.keys(isObject(rawStats) ? rawStats : {}),
  ])];
  return Object.fromEntries(
    sectionIds.map((sectionId) => {
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
