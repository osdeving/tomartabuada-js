import { mergeAdaptiveConfig, normalizeMode } from "./config.js";
import { normalizeAttempts, normalizeStringArray } from "./model.js";

export function getAttemptMetrics(rawAttempts, options = {}) {
  const attempts = normalizeAttempts(rawAttempts);
  const correct = attempts.filter((attempt) => attempt.correct).length;
  const wrong = attempts.length - correct;
  const responseTimes = attempts
    .map((attempt) => attempt.responseTimeMs)
    .filter(isFiniteNonNegative);
  const paceRatios = attempts
    .map((attempt) => attempt.paceRatio)
    .filter(isFiniteNonNegative);
  const streaks = getStreakMetrics(attempts);
  const firstTimestamp = attempts[0]?.timestamp ?? null;
  const lastTimestamp = attempts.at(-1)?.timestamp ?? null;
  const durationMs =
    attempts.length > 1 ? Math.max(0, lastTimestamp - firstTimestamp) : 0;
  const confidence = attempts.length ? 1 - Math.exp(-attempts.length / 10) : 0;

  return {
    attempts: attempts.length,
    correct,
    wrong,
    accuracy: attempts.length ? round(correct / attempts.length, 4) : null,
    confidence: round(confidence, 4),
    currentStreak: streaks.current,
    bestStreak: streaks.best,
    currentErrorStreak: streaks.currentErrors,
    bestErrorStreak: streaks.bestErrors,
    averageResponseTimeMs: nullableRound(mean(responseTimes)),
    medianResponseTimeMs: nullableRound(median(responseTimes)),
    p90ResponseTimeMs: nullableRound(percentile(responseTimes, 0.9)),
    averagePaceRatio: nullableRound(mean(paceRatios), 4),
    medianPaceRatio: nullableRound(median(paceRatios), 4),
    timeouts: attempts.filter((attempt) => attempt.timedOut).length,
    hintsUsed: sum(attempts.map((attempt) => attempt.hintsUsed)),
    reveals: attempts.filter((attempt) => attempt.revealed).length,
    skips: attempts.filter((attempt) => attempt.skipped).length,
    score: sum(attempts.map((attempt) => attempt.score)),
    durationMs: Number(options.durationMs) >= 0 ? Number(options.durationMs) : durationMs,
    firstTimestamp,
    lastTimestamp,
    mastery: calculateMastery({
      attempts: attempts.length,
      accuracy: attempts.length ? correct / attempts.length : null,
      paceRatio: mean(paceRatios),
      confidence,
    }),
  };
}

export function getStreakMetrics(rawAttempts) {
  const attempts = normalizeAttempts(rawAttempts);
  let current = 0;
  let best = 0;
  let currentErrors = 0;
  let bestErrors = 0;

  for (const attempt of attempts) {
    if (attempt.correct) {
      current += 1;
      currentErrors = 0;
      best = Math.max(best, current);
    } else {
      current = 0;
      currentErrors += 1;
      bestErrors = Math.max(bestErrors, currentErrors);
    }
  }

  return { current, best, currentErrors, bestErrors };
}

export function buildGroupReports(rawAttempts) {
  return aggregateAttemptReports(rawAttempts, (attempt) => attempt.groupId, "groupId");
}

export function buildSkillReports(rawAttempts) {
  return aggregateAttemptReports(rawAttempts, (attempt) => attempt.skillKey, "skillKey");
}

export function buildPatternReports(rawAttempts) {
  return aggregateAttemptReports(rawAttempts, (attempt) => attempt.patternKey, "patternKey");
}

export function aggregateAttemptReports(rawAttempts, keySelector, keyName = "id") {
  const attempts = normalizeAttempts(rawAttempts);
  const buckets = new Map();

  for (const attempt of attempts) {
    const key = String(keySelector(attempt) || "geral");
    const bucket = buckets.get(key) ?? [];
    bucket.push(attempt);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, entries]) => ({ [keyName]: key, ...getAttemptMetrics(entries) }))
    .sort(compareReports);
}

export function detectErrorPatterns(rawAttempts, options = {}) {
  const config = mergeAdaptiveConfig(options.config);
  const minimumAttempts = Math.max(
    2,
    Number(options.minimumAttempts) || config.theoryMinimumAttempts,
  );
  const minimumErrorRate = clamp01(
    Number(options.minimumErrorRate) || config.theoryErrorRate,
  );
  const attempts = normalizeAttempts(rawAttempts);
  const reports = buildPatternReports(attempts);

  return reports
    .map((report) => {
      const entries = attempts.filter((attempt) => attempt.patternKey === report.patternKey);
      const wrongEntries = entries.filter((attempt) => !attempt.correct);
      const recent = entries.slice(-5);
      const recentWrong = recent.filter((attempt) => !attempt.correct).length;
      const theoryTopicIds = mostFrequent(
        wrongEntries.map((attempt) => attempt.theoryTopicId).filter(Boolean),
      );
      const affectedSkills = mostFrequent(wrongEntries.map((attempt) => attempt.skillKey));
      const affectedGroupIds = mostFrequent(wrongEntries.map((attempt) => attempt.groupId));
      const errorRate = report.attempts ? report.wrong / report.attempts : 0;
      const recurrence = recent.length ? recentWrong / recent.length : 0;
      const severity = clamp01(
        errorRate * 0.55 + recurrence * 0.3 + report.confidence * 0.15,
      );

      return {
        ...report,
        errorRate: round(errorRate, 4),
        recentWrong,
        recentAttempts: recent.length,
        affectedSkills,
        affectedGroupIds,
        theoryTopicIds,
        severity: round(severity, 4),
        examples: wrongEntries
          .slice(-3)
          .reverse()
          .map((attempt) => ({
            questionId: attempt.questionId,
            skillKey: attempt.skillKey,
            answerGiven: attempt.answerGiven,
            expectedAnswer: attempt.expectedAnswer,
          })),
      };
    })
    .filter(
      (pattern) =>
        pattern.attempts >= minimumAttempts && pattern.errorRate >= minimumErrorRate,
    )
    .sort((left, right) => right.severity - left.severity || right.wrong - left.wrong);
}

export function recommendTheory(rawAttempts, theoryIndex = [], options = {}) {
  const patterns = detectErrorPatterns(rawAttempts, options);
  const topics = normalizeTheoryIndex(theoryIndex);
  const suggestions = new Map();

  for (const pattern of patterns) {
    const directlyLinked = pattern.theoryTopicIds.map(
      (id) => topics.find((topic) => topic.id === id) ?? { id, title: id },
    );
    const matched = topics.filter((topic) => theoryMatchesPattern(topic, pattern));
    const candidates = [...new Map(
      [...directlyLinked, ...matched].map((candidate) => [candidate.id, candidate]),
    ).values()];

    if (!candidates.length) {
      candidates.push({
        id: `pattern:${pattern.patternKey}`,
        title: `Revisar o padrão ${pattern.patternKey}`,
      });
    }

    for (const candidate of candidates) {
      const id = candidate.id;
      if (!id) {
        continue;
      }

      const previous = suggestions.get(id) ?? {
        topicId: id,
        title: candidate.title || id,
        score: 0,
        patternKeys: [],
        reason: "",
      };
      previous.score += pattern.severity * (candidate.id.startsWith("pattern:") ? 0.8 : 1);
      previous.patternKeys.push(pattern.patternKey);
      previous.reason = `Você errou ${pattern.wrong} de ${pattern.attempts} tentativas neste padrão.`;
      suggestions.set(id, previous);
    }
  }

  return [...suggestions.values()]
    .map((suggestion) => ({
      ...suggestion,
      score: round(suggestion.score, 4),
      patternKeys: [...new Set(suggestion.patternKeys)],
    }))
    .sort((left, right) => right.score - left.score);
}

export function detectFatigue(rawSessionAttempts, options = {}) {
  const config = mergeAdaptiveConfig(options.config);
  const attempts = normalizeAttempts(rawSessionAttempts);
  const recentWindow = Math.max(3, Number(options.recentWindow) || config.fatigueRecentWindow);
  const recent = attempts.slice(-recentWindow);
  const earlierInSession = attempts.slice(0, Math.max(0, attempts.length - recent.length));
  const suppliedBaseline = normalizeAttempts(options.baselineAttempts);
  const baseline = suppliedBaseline.length ? suppliedBaseline : earlierInSession;
  const now = Number(options.now) || Date.now();
  const durationMs = attempts.length ? Math.max(0, now - attempts[0].timestamp) : 0;
  const recentMetrics = getAttemptMetrics(recent);
  const baselineMetrics = getAttemptMetrics(baseline);
  const recentPace = comparablePace(recentMetrics);
  const baselinePace = comparablePace(baselineMetrics);
  const accuracyDrop =
    recentMetrics.accuracy == null || baselineMetrics.accuracy == null
      ? 0
      : baselineMetrics.accuracy - recentMetrics.accuracy;
  const paceIncrease =
    recentPace == null || baselinePace == null || baselinePace === 0
      ? 0
      : recentPace / baselinePace - 1;
  const baselineSkills = new Map(
    buildSkillReports(baseline).map((report) => [report.skillKey, report]),
  );
  const uncharacteristicErrors = recent.filter((attempt) => {
    const previous = baselineSkills.get(attempt.skillKey);
    return !attempt.correct && previous?.attempts >= 3 && previous.accuracy >= 0.75;
  });
  const enoughEvidence =
    durationMs >= config.fatigueMinimumSessionMs &&
    recent.length >= config.fatigueMinimumRecentAttempts &&
    baseline.length >= config.fatigueMinimumBaselineAttempts;
  const evidence = [];

  if (accuracyDrop >= config.fatigueAccuracyDrop) {
    evidence.push("accuracy-drop");
  }

  if (paceIncrease >= config.fatiguePaceIncrease) {
    evidence.push("pace-drop");
  }

  if (uncharacteristicErrors.length >= 2) {
    evidence.push("uncharacteristic-errors");
  }

  if (recentMetrics.currentErrorStreak >= 3) {
    evidence.push("error-streak");
  }

  const isFatigued = enoughEvidence && evidence.length >= 2;
  const minutes = Math.max(1, Math.round(durationMs / 60_000));

  return {
    isFatigued,
    severity: isFatigued ? (evidence.length >= 3 ? "high" : "moderate") : "none",
    durationMs,
    minutes,
    evidence,
    accuracyDrop: round(accuracyDrop, 4),
    paceIncrease: round(paceIncrease, 4),
    uncharacteristicErrorCount: uncharacteristicErrors.length,
    uncharacteristicSkillKeys: [...new Set(uncharacteristicErrors.map((item) => item.skillKey))],
    recent: recentMetrics,
    baseline: baselineMetrics,
    message: isFatigued
      ? `Você já está treinando há ${minutes} minutos e começou a errar contas que normalmente acerta. Tome um ar, descanse um pouco e deixe o cérebro se renovar.`
      : "",
  };
}

export function computeTrend(rawAttempts, options = {}) {
  const attempts = normalizeAttempts(rawAttempts);
  const windowSize = Math.max(3, Number(options.windowSize) || 10);
  const current = attempts.slice(-windowSize);
  const previous = attempts.slice(-windowSize * 2, -windowSize);

  if (current.length < 3 || previous.length < 3) {
    return {
      direction: "insufficient-data",
      accuracyDelta: null,
      paceDelta: null,
      masteryDelta: null,
      current: getAttemptMetrics(current),
      previous: getAttemptMetrics(previous),
    };
  }

  const currentMetrics = getAttemptMetrics(current);
  const previousMetrics = getAttemptMetrics(previous);
  const accuracyDelta = currentMetrics.accuracy - previousMetrics.accuracy;
  const currentPace = comparablePace(currentMetrics);
  const previousPace = comparablePace(previousMetrics);
  const paceDelta =
    currentPace == null || previousPace == null || previousPace === 0
      ? null
      : currentPace / previousPace - 1;
  const masteryDelta = currentMetrics.mastery - previousMetrics.mastery;
  const improvementScore = accuracyDelta * 0.7 - (paceDelta ?? 0) * 0.3;

  return {
    direction:
      improvementScore > 0.055
        ? "improving"
        : improvementScore < -0.055
          ? "declining"
          : "stable",
    accuracyDelta: round(accuracyDelta, 4),
    paceDelta: paceDelta == null ? null : round(paceDelta, 4),
    masteryDelta: round(masteryDelta, 4),
    current: currentMetrics,
    previous: previousMetrics,
  };
}

export function derivePersonalBests(rawSessions) {
  const sessions = normalizeSessions(rawSessions).filter(
    (session) => session.attempts.length > 0,
  );
  const summaries = sessions.map((session) => ({
    sessionId: session.id,
    mode: session.mode,
    ...getAttemptMetrics(session.attempts, {
      durationMs: getSessionDuration(session),
    }),
    score: Number(session.score) || sum(session.attempts.map((attempt) => attempt.score)),
  }));
  const eligibleAccuracy = summaries.filter((summary) => summary.attempts >= 10);
  const eligiblePace = summaries.filter(
    (summary) => summary.attempts >= 10 && summary.medianResponseTimeMs != null,
  );

  return {
    highScore: maxRecord(summaries, "score"),
    bestCombo: maxRecord(summaries, "bestStreak"),
    mostCorrect: maxRecord(summaries, "correct"),
    bestAccuracy: maxRecord(eligibleAccuracy, "accuracy"),
    fastestMedian: minRecord(eligiblePace, "medianResponseTimeMs"),
    longestSurvival: maxRecord(
      summaries.filter((summary) => summary.mode === "survival"),
      "attempts",
    ),
  };
}

export function compareSessionToPersonalBests(rawSession, rawPreviousSessions) {
  const session = normalizeSessions([rawSession])[0];

  if (!session || !session.attempts.length) {
    return [];
  }

  const previousSessions = normalizeSessions(rawPreviousSessions).filter(
    (item) => item.id !== session.id,
  );
  const old = derivePersonalBests(previousSessions);
  const current = {
    ...getAttemptMetrics(session.attempts, { durationMs: getSessionDuration(session) }),
    score: Number(session.score) || sum(session.attempts.map((attempt) => attempt.score)),
  };
  const records = [];

  addHigherRecord(records, "highScore", "Novo recorde de pontos!", current.score, old.highScore);
  addHigherRecord(records, "bestCombo", "Novo recorde de combo!", current.bestStreak, old.bestCombo);
  addHigherRecord(records, "mostCorrect", "Mais acertos em uma sessão!", current.correct, old.mostCorrect);

  if (current.attempts >= 10) {
    addHigherRecord(
      records,
      "bestAccuracy",
      "Sua melhor precisão em uma sessão!",
      current.accuracy,
      old.bestAccuracy,
    );
    addLowerRecord(
      records,
      "fastestMedian",
      "Seu ritmo mediano mais rápido!",
      current.medianResponseTimeMs,
      old.fastestMedian,
    );
  }

  return records;
}

export function buildSessionReport(rawSession, options = {}) {
  const session = normalizeSessions([rawSession])[0] ?? {
    id: "",
    mode: "sparring",
    attempts: [],
  };
  const attempts = session.attempts;
  const metrics = getAttemptMetrics(attempts, { durationMs: getSessionDuration(session) });
  const groups = buildGroupReports(attempts);
  const skills = buildSkillReports(attempts);
  const patterns = detectErrorPatterns(attempts, options);

  return {
    schemaVersion: 1,
    sessionId: session.id,
    mode: session.mode,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    metrics,
    trend: computeTrend(attempts, options),
    groups,
    skills,
    errorPatterns: patterns,
    theoryRecommendations: recommendTheory(attempts, options.theoryIndex, options),
    fatigue: detectFatigue(attempts, {
      ...options,
      baselineAttempts: options.baselineAttempts,
      now: session.endedAt || options.now,
    }),
    strongestGroups: groups
      .filter((group) => group.attempts >= 3)
      .slice()
      .sort((left, right) => right.mastery - left.mastery)
      .slice(0, 3),
    focusGroups: groups
      .filter((group) => group.attempts >= 2)
      .slice()
      .sort((left, right) => left.mastery - right.mastery)
      .slice(0, 3),
  };
}

export function buildLearnerReport(rawSessions, options = {}) {
  const sessions = normalizeSessions(rawSessions);
  const attempts = sessions.flatMap((session) => session.attempts);
  const completed = sessions.filter((session) => session.status !== "active");
  const totalDurationMs = sum(sessions.map(getSessionDuration));

  return {
    schemaVersion: 1,
    generatedAt: Number(options.now) || Date.now(),
    sessionCount: sessions.length,
    completedSessionCount: completed.length,
    totalDurationMs,
    overall: getAttemptMetrics(attempts, { durationMs: totalDurationMs }),
    trend: computeTrend(attempts, options),
    groups: buildGroupReports(attempts),
    skills: buildSkillReports(attempts),
    errorPatterns: detectErrorPatterns(attempts, options),
    theoryRecommendations: recommendTheory(attempts, options.theoryIndex, options),
    personalBests: derivePersonalBests(sessions),
    recentSessions: sessions
      .slice()
      .sort((left, right) => right.startedAt - left.startedAt)
      .slice(0, Number(options.recentSessionLimit) || 12)
      .map((session) => ({
        sessionId: session.id,
        mode: session.mode,
        startedAt: session.startedAt,
        status: session.status,
        ...getAttemptMetrics(session.attempts, { durationMs: getSessionDuration(session) }),
      })),
  };
}

export function calculateMastery({ attempts, accuracy, paceRatio, confidence }) {
  if (!attempts || accuracy == null) {
    return 0;
  }

  const paceScore = paceRatio == null ? 0.5 : clamp01(1.25 - paceRatio);
  const rawMastery = accuracy * 0.72 + paceScore * 0.28;
  const evidence = confidence ?? 1 - Math.exp(-attempts / 10);

  return round(rawMastery * (0.55 + evidence * 0.45), 4);
}

function normalizeTheoryIndex(theoryIndex) {
  if (Array.isArray(theoryIndex)) {
    return theoryIndex
      .filter((topic) => topic && typeof topic === "object" && topic.id)
      .map((topic) => ({
        ...topic,
        id: String(topic.id),
        patternKeys: normalizeStringArray(topic.patternKeys ?? topic.patterns),
        sectionIds: normalizeStringArray(topic.sectionIds ?? topic.groups),
        skillKeys: normalizeStringArray(topic.skillKeys),
        skillPrefixes: normalizeStringArray(topic.skillPrefixes),
      }));
  }

  if (theoryIndex && typeof theoryIndex === "object") {
    return Object.entries(theoryIndex).map(([patternKey, topic]) =>
      typeof topic === "string"
        ? { id: topic, title: topic, patternKeys: [patternKey] }
        : {
            ...topic,
            id: String(topic?.id ?? patternKey),
            patternKeys: normalizeStringArray(topic?.patternKeys ?? patternKey),
            sectionIds: normalizeStringArray(topic?.sectionIds),
            skillKeys: normalizeStringArray(topic?.skillKeys),
            skillPrefixes: normalizeStringArray(topic?.skillPrefixes),
          },
    );
  }

  return [];
}

function theoryMatchesPattern(topic, pattern) {
  if (topic.patternKeys?.includes(pattern.patternKey)) {
    return true;
  }

  if (topic.skillKeys?.some((skillKey) => pattern.affectedSkills.includes(skillKey))) {
    return true;
  }

  if (topic.sectionIds?.some((sectionId) => pattern.affectedGroupIds.includes(sectionId))) {
    return true;
  }

  if (
    topic.skillPrefixes?.some((prefix) =>
      pattern.affectedSkills.some((skillKey) => skillKey.startsWith(prefix)),
    )
  ) {
    return true;
  }

  return false;
}

function normalizeSessions(rawSessions) {
  if (!Array.isArray(rawSessions)) {
    return [];
  }

  return rawSessions
    .filter((session) => session && typeof session === "object")
    .map((session, index) => ({
      ...session,
      id: String(session.id ?? `session-${index}`),
      mode: normalizeMode(session.mode),
      status: session.status ?? "completed",
      startedAt: Number(session.startedAt) || session.attempts?.[0]?.timestamp || 0,
      endedAt: Number(session.endedAt) || null,
      attempts: normalizeAttempts(session.attempts),
    }));
}

function getSessionDuration(session) {
  const startedAt = Number(session.startedAt) || session.attempts[0]?.timestamp || 0;
  const endedAt =
    Number(session.endedAt) || session.attempts.at(-1)?.timestamp || startedAt;
  return Math.max(0, endedAt - startedAt);
}

function compareReports(left, right) {
  if (left.mastery !== right.mastery) {
    return left.mastery - right.mastery;
  }

  return right.attempts - left.attempts;
}

function comparablePace(metrics) {
  return metrics.medianPaceRatio ?? metrics.medianResponseTimeMs;
}

function maxRecord(items, property) {
  if (!items.length) {
    return null;
  }

  return items.reduce((best, item) =>
    Number(item[property]) > Number(best[property]) ? item : best,
  );
}

function minRecord(items, property) {
  if (!items.length) {
    return null;
  }

  return items.reduce((best, item) =>
    Number(item[property]) < Number(best[property]) ? item : best,
  );
}

function addHigherRecord(records, type, message, value, previous) {
  if (value == null || (previous && Number(value) <= Number(previous[typeToProperty(type)]))) {
    return;
  }

  records.push({ type, message, value, previousValue: previous?.[typeToProperty(type)] ?? null });
}

function addLowerRecord(records, type, message, value, previous) {
  if (value == null || (previous && Number(value) >= Number(previous[typeToProperty(type)]))) {
    return;
  }

  records.push({ type, message, value, previousValue: previous?.[typeToProperty(type)] ?? null });
}

function typeToProperty(type) {
  const properties = {
    highScore: "score",
    bestCombo: "bestStreak",
    mostCorrect: "correct",
    bestAccuracy: "accuracy",
    fastestMedian: "medianResponseTimeMs",
  };
  return properties[type] ?? type;
}

function mostFrequent(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([value]) => value);
}

function mean(values) {
  return values.length ? sum(values) / values.length : null;
}

function median(values) {
  return percentile(values, 0.5);
}

function percentile(values, ratio) {
  if (!values.length) {
    return null;
  }

  const ordered = values.slice().sort((left, right) => left - right);
  const position = (ordered.length - 1) * clamp01(ratio);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;

  return ordered[lower] * (1 - weight) + ordered[upper] * weight;
}

function sum(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function nullableRound(value, precision = 0) {
  return value == null ? null : round(value, precision);
}

function round(value, precision = 4) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
