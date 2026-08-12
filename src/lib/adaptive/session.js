import {
  ADAPTIVE_SCHEMA_VERSION,
  DEFAULT_ADAPTIVE_CONFIG,
  clampDifficulty,
  mergeAdaptiveConfig,
  normalizeMode,
} from "./config.js";
import {
  buildSessionReport,
  compareSessionToPersonalBests,
  derivePersonalBests,
  getStreakMetrics,
} from "./analytics.js";
import { createAdaptivePlan } from "./engine.js";
import { cleanId, createAttempt, normalizeAttempts, normalizeStringArray } from "./model.js";
import {
  applyModeAttempt,
  calculateAttemptScore,
  createModeState,
  getActiveCampaignStage,
  getComboCelebration,
  normalizeCampaign,
} from "./modes.js";

let sessionSequence = 0;

export function createPracticeSession(options = {}) {
  const config = mergeAdaptiveConfig(options.config);
  const mode = normalizeMode(options.mode);
  const startedAt = positiveNumber(options.startedAt, Date.now());
  const campaign = mode === "campaign" ? normalizeCampaign(options.campaign) : null;
  const modeState = createModeState(mode, {
    campaign,
    lives: options.lives,
  });
  const stage = campaign ? getActiveCampaignStage(modeState, campaign) : null;
  const requestedGroups = normalizeStringArray(options.groupIds);
  const initialDifficulty = stage?.difficulty ?? options.difficulty ?? config.initialDifficulty;

  return {
    schemaVersion: ADAPTIVE_SCHEMA_VERSION,
    id: cleanId(options.id) || createSessionId(startedAt),
    userId: cleanId(options.userId),
    mode,
    status: "active",
    startedAt,
    updatedAt: startedAt,
    endedAt: null,
    groupIds: requestedGroups.length ? requestedGroups : stage?.groupIds ?? [],
    currentDifficulty: clampDifficulty(initialDifficulty, config),
    score: 0,
    currentCombo: 0,
    bestCombo: 0,
    attempts: [],
    modeState,
    campaign,
    settings: {
      baseResponseWindowMs: positiveNumber(options.baseResponseWindowMs, null),
      autoAdvance: options.autoAdvance !== false,
      inputMode: String(options.inputMode ?? "keyboard"),
    },
  };
}

export function normalizePracticeSession(rawSession, options = {}) {
  if (!rawSession || typeof rawSession !== "object") {
    return createPracticeSession(options);
  }

  const config = mergeAdaptiveConfig(options.config);
  const mode = normalizeMode(rawSession.mode);
  const attempts = normalizeAttempts(rawSession.attempts, {
    sessionId: rawSession.id,
    userId: rawSession.userId,
    mode,
  });
  const streaks = getStreakMetrics(attempts);
  const campaign = mode === "campaign"
    ? normalizeCampaign(rawSession.campaign ?? options.campaign)
    : null;
  const modeState = rawSession.modeState && typeof rawSession.modeState === "object"
    ? { ...rawSession.modeState, mode }
    : createModeState(mode, { campaign, lives: options.lives });
  const startedAt =
    positiveNumber(rawSession.startedAt, null) ?? attempts[0]?.timestamp ?? Date.now();

  return {
    ...rawSession,
    schemaVersion: ADAPTIVE_SCHEMA_VERSION,
    id: cleanId(rawSession.id) || createSessionId(startedAt),
    userId: cleanId(rawSession.userId),
    mode,
    status: normalizeSessionStatus(rawSession.status),
    startedAt,
    updatedAt: positiveNumber(rawSession.updatedAt, startedAt),
    endedAt: positiveNumber(rawSession.endedAt, null),
    groupIds: normalizeStringArray(rawSession.groupIds),
    currentDifficulty: clampDifficulty(rawSession.currentDifficulty, config),
    score: Math.max(0, Math.round(Number(rawSession.score) || sum(attempts.map((item) => item.score)))),
    currentCombo: Math.max(0, Math.round(Number(rawSession.currentCombo) || streaks.current)),
    bestCombo: Math.max(0, Math.round(Number(rawSession.bestCombo) || streaks.best)),
    attempts,
    modeState,
    campaign,
    settings: {
      baseResponseWindowMs: positiveNumber(rawSession.settings?.baseResponseWindowMs, null),
      autoAdvance: rawSession.settings?.autoAdvance !== false,
      inputMode: String(rawSession.settings?.inputMode ?? "keyboard"),
    },
  };
}

export function recordSessionAttempt(rawSession, rawAttempt, options = {}) {
  const config = mergeAdaptiveConfig(options.config);
  const session = normalizePracticeSession(rawSession, { ...options, config });

  if (session.status !== "active") {
    return {
      session,
      event: {
        accepted: false,
        reason: "session-not-active",
        messages: [],
      },
    };
  }

  const now = positiveNumber(options.now ?? rawAttempt?.timestamp, Date.now());
  const attemptBase = createAttempt(rawAttempt, {
    sessionId: session.id,
    userId: session.userId,
    mode: session.mode,
    difficulty: session.currentDifficulty,
    responseWindowMs: options.responseWindowMs ?? session.settings.baseResponseWindowMs,
    timestamp: now,
    config,
  });
  const successful =
    attemptBase.correct &&
    !attemptBase.timedOut &&
    !attemptBase.revealed &&
    !attemptBase.skipped;
  const nextCombo = successful ? session.currentCombo + 1 : 0;
  const scoreDelta = calculateAttemptScore(attemptBase, {
    combo: nextCombo,
    mode: session.mode,
  });
  const attempt = { ...attemptBase, score: scoreDelta };
  const attempts = [...session.attempts, attempt];
  const modeResult = applyModeAttempt(session.modeState, attempt, {
    mode: session.mode,
    campaign: session.campaign,
  });
  const plan = createAdaptivePlan({
    attempts,
    baselineAttempts: options.baselineAttempts ?? flattenSessionAttempts(options.previousSessions),
    currentDifficulty: session.currentDifficulty,
    theoryIndex: options.theoryIndex,
    groupIds: session.groupIds,
    mode: session.mode,
    baseResponseWindowMs:
      rawAttempt?.responseWindowMs ?? session.settings.baseResponseWindowMs,
    now,
    config,
  });
  const nextStage = session.mode === "campaign"
    ? getActiveCampaignStage(modeResult.state, session.campaign)
    : null;
  const nextDifficulty = nextStage && modeResult.events.some((event) => event.type === "stage-completed")
    ? nextStage.difficulty
    : plan.difficulty.nextLevel;
  const status = modeResult.status === "game-over" || modeResult.status === "completed"
    ? modeResult.status
    : "active";
  const bestCombo = Math.max(session.bestCombo, nextCombo);
  const score = session.score + scoreDelta;
  const nextSession = {
    ...session,
    status,
    updatedAt: now,
    endedAt: status === "active" ? null : now,
    groupIds: nextStage?.groupIds?.length ? nextStage.groupIds : session.groupIds,
    currentDifficulty: clampDifficulty(nextDifficulty, config),
    score,
    currentCombo: nextCombo,
    bestCombo,
    attempts,
    modeState: modeResult.state,
  };
  const celebrations = buildCelebrations({
    previousSession: session,
    nextSession,
    previousSessions: options.previousSessions,
  });
  const messages = [
    ...celebrations,
    ...modeResult.events,
  ];

  if (plan.fatigue.isFatigued) {
    messages.push({
      type: "rest-suggestion",
      message: plan.fatigue.message,
      severity: plan.fatigue.severity,
    });
  } else if (!attempt.correct && plan.theoryRecommendations[0]) {
    const theory = plan.theoryRecommendations[0];
    messages.push({
      type: "theory-suggestion",
      topicId: theory.topicId,
      message: `${theory.reason} Que tal reler “${theory.title}” antes da próxima rodada?`,
    });
  } else if (!attempt.correct && plan.difficulty.delta < 0) {
    messages.push({
      type: "difficulty-relief",
      message: "Vou aliviar o próximo bloco para você recuperar confiança e ritmo.",
    });
  }

  return {
    session: nextSession,
    event: {
      accepted: true,
      attempt,
      scoreDelta,
      score,
      combo: nextCombo,
      bestCombo,
      mode: modeResult,
      adaptation: plan,
      messages,
    },
  };
}

export function finishPracticeSession(rawSession, options = {}) {
  const session = normalizePracticeSession(rawSession, options);
  const endedAt = positiveNumber(options.endedAt, Date.now());
  const finished = {
    ...session,
    status: session.status === "game-over" ? "game-over" : "completed",
    endedAt: session.endedAt ?? endedAt,
    updatedAt: endedAt,
  };
  const baselineAttempts = flattenSessionAttempts(options.previousSessions);

  return {
    session: finished,
    report: buildSessionReport(finished, {
      ...options,
      baselineAttempts,
      now: endedAt,
    }),
    records: compareSessionToPersonalBests(finished, options.previousSessions),
  };
}

export function pausePracticeSession(rawSession, options = {}) {
  const session = normalizePracticeSession(rawSession, options);
  const now = positiveNumber(options.now, Date.now());
  return {
    ...session,
    status: session.status === "active" ? "paused" : session.status,
    updatedAt: now,
  };
}

export function resumePracticeSession(rawSession, options = {}) {
  const session = normalizePracticeSession(rawSession, options);
  const now = positiveNumber(options.now, Date.now());

  if (session.status !== "paused") {
    return session;
  }

  return { ...session, status: "active", updatedAt: now, endedAt: null };
}

export const createSession = createPracticeSession;
export const recordAttemptInSession = recordSessionAttempt;
export const finishSession = finishPracticeSession;

function buildCelebrations({ previousSession, nextSession, previousSessions }) {
  const celebrations = [];
  const comboCelebration = getComboCelebration(nextSession.currentCombo);
  if (comboCelebration) {
    celebrations.push(comboCelebration);
  }

  const previousBests = derivePersonalBests(previousSessions);
  const oldComboRecord = previousBests.bestCombo?.bestStreak ?? 0;
  if (
    nextSession.currentCombo > oldComboRecord &&
    previousSession.currentCombo <= oldComboRecord &&
    oldComboRecord > 0
  ) {
    celebrations.push({
      type: "personal-record",
      record: "bestCombo",
      value: nextSession.currentCombo,
      message: `Você superou seu recorde de combo: ${nextSession.currentCombo}!`,
    });
  }

  const oldScoreRecord = previousBests.highScore?.score ?? 0;
  if (
    nextSession.score > oldScoreRecord &&
    previousSession.score <= oldScoreRecord &&
    oldScoreRecord > 0
  ) {
    celebrations.push({
      type: "personal-record",
      record: "highScore",
      value: nextSession.score,
      message: `Novo recorde pessoal: ${nextSession.score} pontos!`,
    });
  }

  return celebrations;
}

function flattenSessionAttempts(rawSessions) {
  if (!Array.isArray(rawSessions)) {
    return [];
  }
  return rawSessions.flatMap((session) => normalizeAttempts(session?.attempts));
}

function normalizeSessionStatus(status) {
  return ["active", "paused", "completed", "game-over"].includes(status)
    ? status
    : "active";
}

function createSessionId(timestamp) {
  sessionSequence = (sessionSequence + 1) % 1_000_000;
  return `session-${Math.round(timestamp)}-${sessionSequence.toString(36)}`;
}

function positiveNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}

function sum(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}
