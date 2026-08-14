import {
  BASIC_DIFFICULTY_TIERS,
  MEMORIZATION_OPERATIONS,
  getMemorizationPresets,
} from "./basicMemorization.js";
import {
  PRACTICE_GROUPS,
  QUESTION_COUNTS,
  SESSION_MODES,
  TIME_PROFILES,
} from "./experience.js";

export const TRAINING_RESUME_SCHEMA_VERSION = 1;
export const TRAINING_RESUME_STATE_KEY = "trainingResume";

const DEFAULT_CONFIG = Object.freeze({
  practiceKind: "adaptive",
  modeId: "sparring",
  groupId: "misto",
  questionCount: 15,
  timeProfileId: "calmo",
  memorization: Object.freeze({
    operationId: "multiplication",
    presetId: "all",
    presetIds: Object.freeze(["all"]),
    difficultyMode: "adaptive",
    difficultyTier: "all",
  }),
});

const PRACTICE_KIND_IDS = new Set(["adaptive", "memorization"]);
const MODE_IDS = new Set(SESSION_MODES.map(({ id }) => id));
const GROUP_IDS = new Set(PRACTICE_GROUPS.map(({ id }) => id));
const QUESTION_COUNT_IDS = new Set(QUESTION_COUNTS);
const TIME_PROFILE_IDS = new Set(TIME_PROFILES.map(({ id }) => id));
const OPERATION_IDS = new Set(MEMORIZATION_OPERATIONS.map(({ id }) => id));
const DIFFICULTY_TIER_IDS = new Set([
  "all",
  ...BASIC_DIFFICULTY_TIERS.map(({ id }) => id),
]);

/**
 * Creates the durable, data-only subset of a training configuration.
 *
 * Runtime fields such as `settings`, campaign/theory context, the current
 * question, timers and audio state are deliberately excluded. A restored
 * configuration is therefore always safe to present as a new, ready session.
 */
export function createTrainingConfigSnapshot(rawConfig = {}) {
  const practiceKind = knownString(
    rawConfig.practiceKind,
    PRACTICE_KIND_IDS,
    DEFAULT_CONFIG.practiceKind,
  );
  const modeId = practiceKind === "memorization"
    ? "sparring"
    : knownString(rawConfig.modeId, MODE_IDS, DEFAULT_CONFIG.modeId);

  return {
    practiceKind,
    modeId,
    groupId: knownString(rawConfig.groupId, GROUP_IDS, DEFAULT_CONFIG.groupId),
    questionCount: knownNumber(
      rawConfig.questionCount,
      QUESTION_COUNT_IDS,
      DEFAULT_CONFIG.questionCount,
    ),
    timeProfileId: knownString(
      rawConfig.timeProfileId,
      TIME_PROFILE_IDS,
      DEFAULT_CONFIG.timeProfileId,
    ),
    memorization: normalizeMemorization(rawConfig.memorization),
  };
}

/**
 * Persists a deliberate setup change without treating it as a played session.
 * Once a session has been played, later deliberate changes keep the return
 * intent active and become the configuration shown on the next app launch.
 */
export function rememberTrainingSelection(state, config, now = Date.now()) {
  const previous = normalizeTrainingResume(state?.[TRAINING_RESUME_STATE_KEY]);

  return {
    ...state,
    [TRAINING_RESUME_STATE_KEY]: {
      schemaVersion: TRAINING_RESUME_SCHEMA_VERSION,
      config: createTrainingConfigSnapshot(config),
      selectedAt: normalizeTimestamp(now, Date.now()),
      lastStartedAt: previous?.lastStartedAt ?? null,
    },
  };
}

/** Marks the effective setup used when the user explicitly starts a session. */
export function markTrainingStarted(state, config, now = Date.now()) {
  const startedAt = normalizeTimestamp(now, Date.now());

  return {
    ...state,
    [TRAINING_RESUME_STATE_KEY]: {
      schemaVersion: TRAINING_RESUME_SCHEMA_VERSION,
      config: createTrainingConfigSnapshot(config),
      selectedAt: startedAt,
      lastStartedAt: startedAt,
    },
  };
}

/**
 * Resolves startup navigation after at least one explicit session start.
 *
 * `autoStart` is intentionally always false: the caller should open the
 * training setup with the saved choices, but must wait for a user gesture
 * before creating a session or starting background music/effects.
 */
export function getTrainingStartupIntent(state) {
  const saved = normalizeTrainingResume(state?.[TRAINING_RESUME_STATE_KEY]);
  const previousSession = saved?.lastStartedAt ? null : resumeFromPreviousSession(state);
  const resumable = saved?.lastStartedAt
    ? saved
    : saved && previousSession
      ? { ...saved, lastStartedAt: previousSession.lastStartedAt }
      : previousSession;
  if (!resumable) return null;

  return {
    viewId: "treinar",
    status: "ready",
    autoStart: false,
    lastStartedAt: resumable.lastStartedAt,
    config: resumable.config,
  };
}

/** Normalizes persisted data without mutating the stored object. */
export function normalizeTrainingResume(rawResume) {
  if (!isObject(rawResume)) return null;

  const selectedAt = optionalTimestamp(rawResume.selectedAt);
  const lastStartedAt = optionalTimestamp(rawResume.lastStartedAt);
  if (selectedAt == null && lastStartedAt == null) return null;

  return {
    schemaVersion: TRAINING_RESUME_SCHEMA_VERSION,
    config: createTrainingConfigSnapshot(rawResume.config),
    selectedAt: selectedAt ?? lastStartedAt,
    lastStartedAt,
  };
}

function normalizeMemorization(rawMemorization) {
  const raw = isObject(rawMemorization) ? rawMemorization : {};
  const operationId = knownString(
    raw.operationId,
    OPERATION_IDS,
    DEFAULT_CONFIG.memorization.operationId,
  );
  const presets = getMemorizationPresets(operationId);
  const presetIds = new Set(presets.map(({ id }) => id));
  const fallbackPresetId = presets[0]?.id ?? "all";
  let selectedPresetIds = uniqueKnownStrings(raw.presetIds, presetIds);
  let presetId = knownString(raw.presetId, presetIds, selectedPresetIds[0] ?? fallbackPresetId);

  if (operationId === "multiplication") {
    if (!selectedPresetIds.length) selectedPresetIds = [presetId];
    if (selectedPresetIds.length > 1) {
      selectedPresetIds = selectedPresetIds.filter((id) => id !== "all");
    }
    if (!selectedPresetIds.length) selectedPresetIds = ["all"];
    presetId = selectedPresetIds[0];
  } else {
    selectedPresetIds = [];
  }

  const requestedMode = raw.difficultyMode === "fixed" ? "fixed" : "adaptive";
  const requestedTier = knownString(raw.difficultyTier, DIFFICULTY_TIER_IDS, "all");
  const supportsFixedTier = operationId !== "multiplication"
    && presetId === "two-digits"
    && requestedTier !== "all"
    && tierMatchesOperation(requestedTier, operationId);

  return {
    operationId,
    presetId,
    presetIds: selectedPresetIds,
    difficultyMode: requestedMode === "fixed" && supportsFixedTier ? "fixed" : "adaptive",
    difficultyTier: requestedMode === "fixed" && supportsFixedTier ? requestedTier : "all",
  };
}

function resumeFromPreviousSession(state) {
  const sessions = Array.isArray(state?.sessions) ? state.sessions : [];
  const latest = sessions
    .filter((candidate) => {
      if (!isObject(candidate) || ["campaign", "theory"].includes(candidate.trainingContext)) return false;
      if (candidate.practiceKind === "memorization") return true;
      return MODE_IDS.has(candidate.modeId);
    })
    .map((session) => ({
      session,
      startedAt: optionalTimestamp(session.startedAt) ?? optionalTimestamp(session.endedAt),
    }))
    .filter(({ startedAt }) => startedAt != null)
    .sort((left, right) => right.startedAt - left.startedAt)[0];
  if (!latest) return null;

  const settings = isObject(state?.settings) ? state.settings : {};
  const { session, startedAt: lastStartedAt } = latest;

  return {
    config: createTrainingConfigSnapshot({
      practiceKind: session.practiceKind ?? settings.practiceKind,
      modeId: session.modeId ?? state?.selectedModeId,
      groupId: session.groupId ?? state?.selectedGroupId,
      questionCount: settings.questionCount,
      timeProfileId: session.timeProfileId ?? settings.timeProfileId,
      memorization: {
        operationId: session.memorizationOperation ?? settings.memorizationOperationId,
        presetId: session.memorizationPresetIds?.[0] ?? settings.memorizationPresetId,
        presetIds: session.memorizationPresetIds ?? settings.memorizationPresetIds,
        difficultyMode:
          session.memorizationDifficultyMode ?? settings.memorizationDifficultyMode,
        difficultyTier:
          session.memorizationDifficultyTier ?? settings.memorizationDifficultyTier,
      },
    }),
    lastStartedAt,
  };
}

function tierMatchesOperation(tierId, operationId) {
  if (operationId === "addition") {
    return ["no-overflow", "unity-overflow", "double-overflow"].includes(tierId);
  }
  if (operationId === "subtraction") {
    return ["no-borrow", "unity-borrow", "cascade-borrow"].includes(tierId);
  }
  return false;
}

function uniqueKnownStrings(value, allowed) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string" && allowed.has(item)))];
}

function knownString(value, allowed, fallback) {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

function knownNumber(value, allowed, fallback) {
  const normalized = Number(value);
  return allowed.has(normalized) ? normalized : fallback;
}

function optionalTimestamp(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? Math.floor(normalized) : null;
}

function normalizeTimestamp(value, fallback) {
  return optionalTimestamp(value) ?? fallback;
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
