export {
  ADAPTIVE_SCHEMA_VERSION,
  DEFAULT_ADAPTIVE_CONFIG,
  DEFAULT_CAMPAIGN,
  MODE_DEFINITIONS,
  clampDifficulty,
  getDifficultyProfile,
  mergeAdaptiveConfig,
  normalizeMode,
} from "./config.js";

export {
  cleanId,
  createAttempt,
  inferPatternKey,
  normalizeAttempts,
  normalizeChallenge,
  normalizeStringArray,
} from "./model.js";

export {
  aggregateAttemptReports,
  buildGroupReports,
  buildLearnerReport,
  buildPatternReports,
  buildSessionReport,
  buildSkillReports,
  calculateMastery,
  compareSessionToPersonalBests,
  computeTrend,
  derivePersonalBests,
  detectErrorPatterns,
  detectFatigue,
  getAttemptMetrics,
  getStreakMetrics,
  recommendTheory,
} from "./analytics.js";

export {
  assessDifficulty,
  buildLearnerModel,
  createAdaptivePlan,
  scoreChallenge,
  selectNextChallenge,
} from "./engine.js";

export {
  applyModeAttempt,
  calculateAttemptScore,
  createModeState,
  getActiveCampaignStage,
  getCampaignProgress,
  getComboCelebration,
  normalizeCampaign,
} from "./modes.js";

export {
  createPracticeSession,
  createSession,
  finishPracticeSession,
  finishSession,
  normalizePracticeSession,
  pausePracticeSession,
  recordAttemptInSession,
  recordSessionAttempt,
  resumePracticeSession,
} from "./session.js";

export {
  DEFAULT_SESSION_STORAGE_KEY,
  SessionRevisionConflictError,
  createLocalSessionRepository,
  createLocalStorageAdapter,
  createMemoryStorageAdapter,
  createSessionRepository,
} from "./storage.js";
