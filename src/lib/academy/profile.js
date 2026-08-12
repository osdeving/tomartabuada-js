const MIN_REVIEW_MS = 20_000;

export function createFactProfile() {
  return {
    attempts: 0,
    correct: 0,
    wrong: 0,
    paceMs: null,
    lastValidMs: null,
    lastSeenAt: 0,
    lastAnsweredAt: 0,
    lastCorrectAt: 0,
    lastWrongAt: 0,
    nextDueAt: 0,
    successStreak: 0,
  };
}

export function normalizeFactProfiles(rawProfiles) {
  if (!rawProfiles || typeof rawProfiles !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(rawProfiles)
      .filter(([skillKey, profile]) => skillKey && profile && typeof profile === "object")
      .map(([skillKey, profile]) => [
        skillKey,
        {
          ...createFactProfile(),
          attempts: Number(profile.attempts) || 0,
          correct: Number(profile.correct) || 0,
          wrong: Number(profile.wrong) || 0,
          paceMs: Number(profile.paceMs) || null,
          lastValidMs: Number(profile.lastValidMs) || null,
          lastSeenAt: Number(profile.lastSeenAt) || 0,
          lastAnsweredAt: Number(profile.lastAnsweredAt) || 0,
          lastCorrectAt: Number(profile.lastCorrectAt) || 0,
          lastWrongAt: Number(profile.lastWrongAt) || 0,
          nextDueAt: Number(profile.nextDueAt) || 0,
          successStreak: Number(profile.successStreak) || 0,
        },
      ]),
  );
}

export function applyFactResult(
  factProfiles,
  question,
  { isCorrect, responseTimeMs, now = Date.now() },
) {
  const previousProfile = factProfiles[question.skillKey] ?? createFactProfile();
  const validResponseMs = isValidMeasuredResponse(question, responseTimeMs)
    ? Math.round(responseTimeMs)
    : null;
  const paceMs = validResponseMs
    ? getSmoothedPace(previousProfile.paceMs, validResponseMs)
    : previousProfile.paceMs;
  const effectiveResponseMs =
    validResponseMs ??
    previousProfile.paceMs ??
    Math.round(question.responseWindowMs * 0.7);
  const successStreak = isCorrect ? previousProfile.successStreak + 1 : 0;
  const nextDueAt = computeNextDueAt({
    question,
    effectiveResponseMs,
    isCorrect,
    now,
    successStreak,
  });

  return {
    ...factProfiles,
    [question.skillKey]: {
      ...previousProfile,
      attempts: previousProfile.attempts + 1,
      correct: previousProfile.correct + (isCorrect ? 1 : 0),
      wrong: previousProfile.wrong + (isCorrect ? 0 : 1),
      paceMs,
      lastValidMs: validResponseMs ?? previousProfile.lastValidMs,
      lastSeenAt: now,
      lastAnsweredAt: now,
      lastCorrectAt: isCorrect ? now : previousProfile.lastCorrectAt,
      lastWrongAt: isCorrect ? previousProfile.lastWrongAt : now,
      nextDueAt,
      successStreak,
    },
  };
}

export function selectScheduledFact(
  facts,
  factProfiles,
  { excludeSkillKeys = [], now = Date.now() } = {},
) {
  if (!facts.length) {
    return null;
  }

  const excluded = new Set(excludeSkillKeys);
  const availableFacts =
    facts.length - excluded.size >= 3
      ? facts.filter((fact) => !excluded.has(fact.skillKey))
      : facts;
  const weightedFacts = availableFacts.map((fact) => ({
    fact,
    weight: getFactWeight(fact, factProfiles[fact.skillKey], now),
  }));
  const totalWeight = weightedFacts.reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );

  if (totalWeight <= 0) {
    return weightedFacts[0]?.fact ?? facts[0];
  }

  let threshold = Math.random() * totalWeight;

  for (const entry of weightedFacts) {
    threshold -= entry.weight;

    if (threshold <= 0) {
      return entry.fact;
    }
  }

  return weightedFacts[weightedFacts.length - 1]?.fact ?? facts[0];
}

function getFactWeight(fact, profile, now) {
  const currentProfile = profile ?? createFactProfile();
  const attempts = currentProfile.attempts;
  const paceRatio =
    currentProfile.paceMs == null
      ? 0.55
      : clamp(currentProfile.paceMs / fact.responseWindowMs, 0.12, 1);
  const errorRatio = attempts
    ? currentProfile.wrong / attempts
    : 0;
  const dueScore = getDueScore(currentProfile, fact, now);
  const staleScore = getStaleScore(currentProfile, fact, now);
  const unseenBoost = attempts ? 0 : 1.2;
  const streakRelief = Math.min(currentProfile.successStreak * 0.08, 0.45);

  return Math.max(
    0.18,
    0.35 +
      unseenBoost +
      paceRatio * 1.35 +
      errorRatio * 1.1 +
      dueScore +
      staleScore -
      streakRelief,
  );
}

function getDueScore(profile, fact, now) {
  if (!profile.nextDueAt) {
    return 0.55;
  }

  if (now < profile.nextDueAt) {
    return 0.08;
  }

  return 0.75 + clamp((now - profile.nextDueAt) / fact.reviewBaseMs, 0, 1.6);
}

function getStaleScore(profile, fact, now) {
  if (!profile.lastSeenAt) {
    return 0.85;
  }

  return clamp((now - profile.lastSeenAt) / (fact.reviewBaseMs * 1.5), 0, 1.2);
}

function computeNextDueAt({
  question,
  effectiveResponseMs,
  isCorrect,
  now,
  successStreak,
}) {
  if (!isCorrect) {
    return now + Math.max(MIN_REVIEW_MS, Math.round(question.reviewBaseMs * 0.22));
  }

  const speedRatio = clamp(
    effectiveResponseMs / question.responseWindowMs,
    0.1,
    1,
  );
  const speedLift = 1.65 - speedRatio;
  const streakLift = 1 + Math.min(successStreak, 6) * 0.2;

  return now + Math.round(question.reviewBaseMs * speedLift * streakLift);
}

function getSmoothedPace(previousPaceMs, responseTimeMs) {
  if (!previousPaceMs) {
    return responseTimeMs;
  }

  return Math.round(previousPaceMs * 0.68 + responseTimeMs * 0.32);
}

function isValidMeasuredResponse(question, responseTimeMs) {
  return (
    Number.isFinite(responseTimeMs) &&
    responseTimeMs > 0 &&
    responseTimeMs <= question.responseWindowMs
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
