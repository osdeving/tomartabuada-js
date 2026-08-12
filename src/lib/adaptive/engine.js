import {
  DEFAULT_ADAPTIVE_CONFIG,
  MODE_DEFINITIONS,
  clampDifficulty,
  getDifficultyProfile,
  mergeAdaptiveConfig,
  normalizeMode,
} from "./config.js";
import {
  buildGroupReports,
  buildSkillReports,
  detectErrorPatterns,
  detectFatigue,
  getAttemptMetrics,
  recommendTheory,
} from "./analytics.js";
import { normalizeAttempts, normalizeChallenge, normalizeStringArray } from "./model.js";

export function assessDifficulty(rawAttempts, currentDifficulty, options = {}) {
  const config = mergeAdaptiveConfig(options.config);
  const attempts = normalizeAttempts(rawAttempts);
  const recent = attempts.slice(-config.recentWindowSize);
  const metrics = getAttemptMetrics(recent);
  const currentLevel = clampDifficulty(currentDifficulty, config);
  const errorPatterns = detectErrorPatterns(recent, {
    config,
    minimumAttempts: 3,
    minimumErrorRate: 0.6,
  });
  let delta = 0;
  let reasonCode = "gathering-evidence";
  let reason = "Mantendo o nível enquanto reunimos mais tentativas.";

  if (metrics.currentErrorStreak >= config.errorStreakRelief) {
    delta = metrics.currentErrorStreak >= config.errorStreakRelief + 2 ? -2 : -1;
    reasonCode = "error-streak";
    reason = "Uma sequência de erros pede contas mais acessíveis para recuperar o ritmo.";
  } else if (recent.length >= config.minimumAdaptationAttempts) {
    if (metrics.accuracy <= config.muchEasierAccuracy) {
      delta = -2;
      reasonCode = "low-accuracy";
      reason = "A precisão recente caiu bastante; o próximo bloco será mais simples.";
    } else if (
      metrics.accuracy < config.easierAccuracy ||
      (metrics.averagePaceRatio != null && metrics.averagePaceRatio > config.slowPaceRatio)
    ) {
      delta = -1;
      reasonCode = "needs-relief";
      reason = "Precisão ou tempo indicam que vale reduzir um passo da dificuldade.";
    } else if (
      metrics.accuracy >= config.muchHarderAccuracy &&
      metrics.averagePaceRatio != null &&
      metrics.averagePaceRatio <= config.veryFastPaceRatio &&
      recent.length >= 8
    ) {
      delta = 2;
      reasonCode = "mastered-fast";
      reason = "Acertos muito consistentes e rápidos liberaram um salto de dificuldade.";
    } else if (
      metrics.accuracy >= config.harderAccuracy &&
      metrics.averagePaceRatio != null &&
      metrics.averagePaceRatio <= config.fastPaceRatio
    ) {
      delta = 1;
      reasonCode = "ready-to-advance";
      reason = "Boa precisão com respostas rápidas: o desafio pode subir um passo.";
    } else {
      reasonCode = "on-target";
      reason = "O nível atual está produzindo um desafio saudável.";
    }
  }

  if (errorPatterns[0]?.severity >= 0.78 && delta > 0) {
    delta = 0;
    reasonCode = "pattern-remediation";
    reason = "Há um padrão de erro recorrente; ele será consolidado antes de subir o nível.";
  }

  const nextLevel = clampDifficulty(currentLevel + delta, config);
  const effectiveDelta = nextLevel - currentLevel;
  const profile = getDifficultyProfile(nextLevel, config);
  const temporaryRelief = effectiveDelta < 0 ? 1.08 : 1;

  return {
    currentLevel,
    nextLevel,
    delta: effectiveDelta,
    reasonCode,
    reason,
    metrics,
    errorPatterns,
    responseWindowScale: round(profile.responseWindowScale * temporaryRelief, 3),
    profile,
  };
}

export function buildLearnerModel(rawAttempts) {
  const attempts = normalizeAttempts(rawAttempts);
  const skills = buildSkillReports(attempts).map((profile) => ({
    ...profile,
    lastSeenAt: lastValue(
      attempts.filter((attempt) => attempt.skillKey === profile.skillKey),
      "timestamp",
    ),
  }));
  const groups = buildGroupReports(attempts);
  const patterns = detectErrorPatterns(attempts);

  return {
    attempts: attempts.length,
    overall: getAttemptMetrics(attempts),
    skills,
    groups,
    patterns,
    skillProfiles: Object.fromEntries(skills.map((profile) => [profile.skillKey, profile])),
    groupProfiles: Object.fromEntries(groups.map((profile) => [profile.groupId, profile])),
  };
}

export function createAdaptivePlan({
  attempts: rawAttempts = [],
  baselineAttempts = [],
  currentDifficulty = DEFAULT_ADAPTIVE_CONFIG.initialDifficulty,
  theoryIndex = [],
  groupIds = [],
  mode = "sparring",
  baseResponseWindowMs = null,
  now = Date.now(),
  config: configOverrides = {},
} = {}) {
  const config = mergeAdaptiveConfig(configOverrides);
  const attempts = normalizeAttempts(rawAttempts);
  const normalizedMode = normalizeMode(mode);
  const assessment = assessDifficulty(attempts, currentDifficulty, { config });
  const fatigue = detectFatigue(attempts, {
    baselineAttempts,
    now,
    config,
  });
  const theoryRecommendations = recommendTheory(attempts, theoryIndex, { config });
  const learner = buildLearnerModel(attempts);
  const allowedGroups = normalizeStringArray(groupIds);
  const focusGroups = learner.groups
    .filter((group) => !allowedGroups.length || allowedGroups.includes(group.groupId))
    .slice()
    .sort((left, right) => left.mastery - right.mastery)
    .slice(0, 3)
    .map((group) => group.groupId);
  const effectiveLevel = fatigue.isFatigued
    ? clampDifficulty(Math.min(assessment.nextLevel, assessment.currentLevel - 1), config)
    : assessment.nextLevel;
  const profile = getDifficultyProfile(effectiveLevel, config);
  const scale = fatigue.isFatigued
    ? Math.max(assessment.responseWindowScale, profile.responseWindowScale * 1.12)
    : assessment.responseWindowScale;
  const responseWindowMs =
    Number(baseResponseWindowMs) > 0
      ? Math.max(1_500, Math.round(Number(baseResponseWindowMs) * scale))
      : null;
  const recurrentPattern = learner.patterns[0] ?? null;
  const modeDefinition = MODE_DEFINITIONS[normalizedMode];

  return {
    mode: normalizedMode,
    difficulty: {
      ...assessment,
      nextLevel: effectiveLevel,
      responseWindowScale: round(scale, 3),
      profile,
    },
    responseWindowMs,
    focusGroups,
    focusPatternKeys: learner.patterns.slice(0, 3).map((pattern) => pattern.patternKey),
    theoryRecommendations,
    fatigue,
    pauseSuggested: fatigue.isFatigued,
    weakSkillBias: modeDefinition.weakSkillBias,
    challengeMix: {
      bookShare: config.bookChallengeShare,
      generatedShare: round(1 - config.bookChallengeShare, 2),
      noveltyShare: profile.noveltyShare,
      remediationShare: recurrentPattern ? round(0.3 + recurrentPattern.severity * 0.35, 2) : 0.2,
    },
    recommendedAction: fatigue.isFatigued
      ? "pause"
      : theoryRecommendations.length
        ? "review-theory"
        : assessment.delta > 0
          ? "advance"
          : assessment.delta < 0
            ? "ease"
            : "continue",
  };
}

export function selectNextChallenge(rawCandidates, options = {}) {
  if (!Array.isArray(rawCandidates) || !rawCandidates.length) {
    return null;
  }

  const config = mergeAdaptiveConfig(options.config);
  const attempts = normalizeAttempts(options.attempts);
  const groupIds = normalizeStringArray(options.groupIds);
  const plan = options.plan ?? createAdaptivePlan({
    attempts,
    baselineAttempts: options.baselineAttempts,
    currentDifficulty: options.currentDifficulty,
    theoryIndex: options.theoryIndex,
    groupIds,
    mode: options.mode,
    now: options.now,
    config,
  });
  const candidates = rawCandidates.map((candidate) =>
    normalizeChallenge(candidate, {
      difficulty: plan.difficulty.nextLevel,
      config,
    }),
  );
  const inAllowedGroups = groupIds.length
    ? candidates.filter((candidate) => groupIds.includes(candidate.groupId))
    : candidates;
  const pool = inAllowedGroups.length ? inAllowedGroups : candidates;
  const learner = buildLearnerModel(attempts);
  const ranked = pool
    .map((challenge) => ({
      challenge,
      ...scoreChallenge(challenge, {
        attempts,
        learner,
        plan,
        mode: options.mode,
        config,
      }),
    }))
    .sort((left, right) => right.weight - left.weight);
  const totalWeight = ranked.reduce((total, item) => total + item.weight, 0);
  const random = typeof options.random === "function" ? options.random : Math.random;
  const randomValue = clampRandom(random());
  let threshold = randomValue * totalWeight;
  let selected = ranked[0];

  for (const item of ranked) {
    threshold -= item.weight;
    if (threshold <= 0) {
      selected = item;
      break;
    }
  }

  return {
    challenge: selected.challenge,
    weight: selected.weight,
    reasons: selected.reasons,
    plan,
    ranked: ranked.map((item) => ({
      challengeId: item.challenge.id,
      skillKey: item.challenge.skillKey,
      weight: item.weight,
      probability: totalWeight ? round(item.weight / totalWeight, 4) : 0,
      reasons: item.reasons,
    })),
  };
}

export function scoreChallenge(rawChallenge, context = {}) {
  const config = mergeAdaptiveConfig(context.config);
  const challenge = normalizeChallenge(rawChallenge, { config });
  const attempts = normalizeAttempts(context.attempts);
  const learner = context.learner ?? buildLearnerModel(attempts);
  const plan = context.plan ?? createAdaptivePlan({
    attempts,
    currentDifficulty: challenge.difficulty,
    mode: context.mode,
    config,
  });
  const mode = normalizeMode(context.mode ?? plan.mode);
  const modeDefinition = MODE_DEFINITIONS[mode];
  const skill = learner.skillProfiles[challenge.skillKey];
  const group = learner.groupProfiles[challenge.groupId];
  const targetLevel = plan.difficulty.nextLevel;
  const difficultyDistance = Math.abs(challenge.difficulty - targetLevel);
  const difficultyFit = Math.exp(-difficultyDistance / 1.45);
  const weakness = skill ? 1 - skill.mastery : group ? 1 - group.mastery : 0.55;
  const pattern = learner.patterns.find(
    (item) =>
      item.patternKey === challenge.patternKey ||
      challenge.patternTags.includes(item.patternKey),
  );
  const recentSkillKeys = attempts.slice(-4).map((attempt) => attempt.skillKey);
  const lastIndex = recentSkillKeys.lastIndexOf(challenge.skillKey);
  const recentBookAttempts = attempts.slice(-12);
  const bookRatio = recentBookAttempts.length
    ? recentBookAttempts.filter((attempt) => attempt.source === "book").length /
      recentBookAttempts.length
    : 0;
  let weight = Math.max(0.08, difficultyFit);
  const reasons = [`nível ${challenge.difficulty} próximo do alvo ${targetLevel}`];

  weight *= 1 + weakness * modeDefinition.weakSkillBias;
  if (weakness >= 0.5) {
    reasons.push("habilidade ainda frágil");
  }

  if (pattern) {
    const safeRemediation = challenge.difficulty <= targetLevel;
    weight *= safeRemediation ? 1.35 + pattern.severity : 0.55;
    reasons.push(safeRemediation ? "reforça um padrão recorrente" : "evita sobrecarga no padrão frágil");
  }

  if (challenge.source === "book" && bookRatio < config.bookChallengeShare) {
    weight *= 1.75;
    reasons.push("mantém o reconhecimento de padrões já estudados");
  } else if (challenge.source !== "book" && bookRatio > config.bookChallengeShare + 0.12) {
    weight *= 1.3;
    reasons.push("equilibra exemplos conhecidos com variações novas");
  }

  if (lastIndex >= 2) {
    weight *= 0.08;
    reasons.push("reduz repetição imediata");
  } else if (lastIndex >= 0) {
    weight *= 0.35;
    reasons.push("espaça a repetição recente");
  }

  if (!skill) {
    weight *= 1 + plan.challengeMix.noveltyShare;
    reasons.push("coleta evidência de uma habilidade nova");
  }

  if (plan.focusGroups.includes(challenge.groupId)) {
    weight *= 1.2;
    reasons.push("grupo prioritário");
  }

  return { weight: round(Math.max(0.01, weight), 6), reasons };
}

function lastValue(items, property) {
  return items.length ? items.at(-1)?.[property] ?? null : null;
}

function clampRandom(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0.5;
  }
  return Math.min(0.999999999, Math.max(0, numericValue));
}

function round(value, precision = 4) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
