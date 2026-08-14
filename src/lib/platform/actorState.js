const EMPTY_SECTION_STATS = Object.freeze({
  attempts: 0,
  correct: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastPlayedAt: 0,
});

export const GUEST_ACTOR_PROGRESS_KEY = "actor:guest";

export function actorProgressKey(actorId = null) {
  const normalizedActorId = cleanId(actorId);
  return normalizedActorId ? `actor:user:${normalizedActorId}` : GUEST_ACTOR_PROGRESS_KEY;
}

/**
 * Produces the training state visible to one actor without mutating the
 * persisted device state. An empty actor id represents the local guest.
 *
 * Settings and other configuration fields stay shared; progress fields are
 * rebuilt exclusively from attempts and completed sessions attributed to the
 * selected actor.
 */
export function selectActorPlatformState(platformState, actorId = null) {
  const source = isObject(platformState) ? platformState : {};
  const attempts = asObjectList(source.attempts).filter((attempt) => belongsToActor(attempt, actorId));
  const sessions = asObjectList(source.sessions).filter((session) => belongsToActor(session, actorId));
  const persisted = isObject(source.actorProgress?.[actorProgressKey(actorId)])
    ? source.actorProgress[actorProgressKey(actorId)]
    : null;
  const useLegacyGuestAggregates = !persisted && isLegacyGuestState(source, actorId);

  return {
    ...source,
    profile: persisted
      ? normalizePersistedProfile(source.profile, persisted.profile)
      : useLegacyGuestAggregates && isObject(source.profile)
        ? normalizePersistedProfile({}, source.profile)
        : deriveProfile(source.profile, sessions),
    sectionStats: persisted
      ? normalizePersistedSectionStats(source.sectionStats, persisted.sectionStats)
      : useLegacyGuestAggregates && isObject(source.sectionStats)
        ? normalizePersistedSectionStats(source.sectionStats, source.sectionStats)
        : deriveSectionStats(source.sectionStats, attempts),
    attempts,
    sessions,
    campaign: persisted
      ? cloneObject(persisted.campaign)
      : useLegacyGuestAggregates && isObject(source.campaign) && Object.keys(source.campaign).length
        ? cloneObject(source.campaign)
        : deriveCampaign(sessions),
    records: persisted
      ? normalizePersistedRecords(source.records, persisted.records)
      : useLegacyGuestAggregates && isObject(source.records)
        ? normalizePersistedRecords({}, source.records)
        : deriveRecords(source.records, attempts, sessions),
  };
}

function normalizePersistedProfile(template, rawProfile) {
  const base = isObject(template) ? template : {};
  const profile = isObject(rawProfile) ? rawProfile : {};
  const xp = nonNegativeInteger(profile.xp);
  return {
    ...base,
    ...profile,
    xp,
    level: Math.max(1, Math.floor(xp / 250) + 1),
  };
}

function normalizePersistedRecords(template, rawRecords) {
  const base = deriveRecords(template, [], []);
  const records = isObject(rawRecords) ? rawRecords : {};
  return {
    ...base,
    ...records,
    bestScore: isObject(records.bestScore) ? { ...records.bestScore } : {},
    bestCombo: nonNegativeNumber(records.bestCombo),
    fastestCorrectMs: positiveNumber(records.fastestCorrectMs),
  };
}

function normalizePersistedSectionStats(templates, rawSectionStats) {
  const templateMap = isObject(templates) ? templates : {};
  const statsMap = isObject(rawSectionStats) ? rawSectionStats : {};
  const sectionIds = new Set([...Object.keys(templateMap), ...Object.keys(statsMap)]);

  return Object.fromEntries([...sectionIds].map((sectionId) => {
    const template = isObject(templateMap[sectionId]) ? templateMap[sectionId] : {};
    const stats = isObject(statsMap[sectionId]) ? statsMap[sectionId] : {};
    return [sectionId, {
      ...template,
      ...EMPTY_SECTION_STATS,
      ...stats,
      attempts: nonNegativeInteger(stats.attempts),
      correct: nonNegativeInteger(stats.correct),
      currentStreak: nonNegativeInteger(stats.currentStreak),
      bestStreak: nonNegativeInteger(stats.bestStreak),
      lastPlayedAt: finiteNumber(stats.lastPlayedAt) ?? 0,
    }];
  }));
}

function isLegacyGuestState(source, actorId) {
  if (cleanId(actorId)) return false;
  const hasPersistedActor = isObject(source.actorProgress)
    && Object.values(source.actorProgress).some(isObject);
  if (hasPersistedActor) return false;
  return ![...asObjectList(source.attempts), ...asObjectList(source.sessions)]
    .some((entry) => cleanId(entry.userId));
}

function cloneObject(value) {
  return isObject(value) ? { ...value } : {};
}

function deriveProfile(rawProfile, sessions) {
  const profile = isObject(rawProfile) ? rawProfile : {};
  const xp = sessions.reduce((total, session) => total + sessionXp(session), 0);

  return {
    ...profile,
    xp,
    level: Math.max(1, Math.floor(xp / 250) + 1),
  };
}

function deriveRecords(rawRecords, attempts, sessions) {
  const records = isObject(rawRecords) ? rawRecords : {};
  const bestScore = {};

  for (const session of sessions) {
    const recordKey = sessionRecordKey(session);
    if (!recordKey) continue;
    bestScore[recordKey] = Math.max(
      Number(bestScore[recordKey]) || 0,
      nonNegativeNumber(session.score),
    );
  }

  const bestCombo = Math.max(
    0,
    ...attempts.map((attempt) => nonNegativeNumber(attempt.combo)),
    ...sessions.map((session) => nonNegativeNumber(session.bestCombo)),
  );
  const correctResponseTimes = attempts
    .filter((attempt) => attempt.correct)
    .map((attempt) => positiveNumber(attempt.responseTimeMs))
    .filter((value) => value != null);

  return {
    ...records,
    bestScore,
    bestCombo,
    fastestCorrectMs: correctResponseTimes.length ? Math.min(...correctResponseTimes) : null,
  };
}

function deriveSectionStats(rawSectionStats, attempts) {
  const templates = isObject(rawSectionStats) ? rawSectionStats : {};
  const sectionIds = new Set(Object.keys(templates));

  for (const attempt of attempts) {
    const sectionId = cleanId(attempt.sectionId);
    if (sectionId) sectionIds.add(sectionId);
  }

  return Object.fromEntries([...sectionIds].map((sectionId) => {
    const sectionAttempts = attempts
      .map((attempt, index) => ({ attempt, index }))
      .filter(({ attempt }) => cleanId(attempt.sectionId) === sectionId)
      .sort(compareAttemptsChronologically)
      .map(({ attempt }) => attempt);
    let currentStreak = 0;
    let bestStreak = 0;

    for (const attempt of sectionAttempts) {
      currentStreak = attempt.correct ? currentStreak + 1 : 0;
      bestStreak = Math.max(bestStreak, currentStreak);
    }

    const lastAttempt = sectionAttempts.at(-1);
    return [sectionId, {
      ...(isObject(templates[sectionId]) ? templates[sectionId] : {}),
      ...EMPTY_SECTION_STATS,
      attempts: sectionAttempts.length,
      correct: sectionAttempts.filter((attempt) => attempt.correct).length,
      currentStreak,
      bestStreak,
      lastPlayedAt: attemptTimestamp(lastAttempt) ?? 0,
    }];
  }));
}

function deriveCampaign(sessions) {
  const campaign = {};

  for (const session of [...sessions].sort(compareSessionsChronologically)) {
    const stageId = cleanId(session.campaignStageId);
    if (!stageId) continue;
    const previous = campaign[stageId] ?? {
      completed: false,
      attempts: 0,
      bestAccuracy: 0,
      bestScore: 0,
      stars: 0,
      lastPlayedAt: 0,
    };

    campaign[stageId] = {
      completed: previous.completed || Boolean(session.passed),
      attempts: previous.attempts + 1,
      bestAccuracy: Math.max(previous.bestAccuracy, normalizedAccuracy(session.accuracy)),
      bestScore: Math.max(previous.bestScore, nonNegativeNumber(session.score)),
      stars: Math.max(previous.stars, nonNegativeInteger(session.stars)),
      lastPlayedAt: sessionTimestamp(session) ?? previous.lastPlayedAt,
    };
  }

  return campaign;
}

function belongsToActor(entry, actorId) {
  return cleanId(entry?.userId) === cleanId(actorId);
}

function sessionXp(session) {
  const hasExplicitXp = session?.xpEarned != null && session.xpEarned !== "";
  const explicitXp = Number(session?.xpEarned);
  if (hasExplicitXp && Number.isFinite(explicitXp) && explicitXp >= 0) return Math.round(explicitXp);
  return Math.max(
    0,
    Math.round(nonNegativeNumber(session?.score) / 20)
      + nonNegativeInteger(session?.correct) * 2,
  );
}

function sessionRecordKey(session) {
  const explicit = cleanId(session?.recordKey);
  if (explicit) return explicit;
  const modeId = cleanId(session?.modeId);
  const groupId = cleanId(session?.groupId);
  return modeId && groupId ? `${modeId}:${groupId}` : "";
}

function compareAttemptsChronologically(left, right) {
  const leftTimestamp = attemptTimestamp(left.attempt);
  const rightTimestamp = attemptTimestamp(right.attempt);
  if (leftTimestamp != null && rightTimestamp != null && leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }
  if (leftTimestamp != null && rightTimestamp == null) return 1;
  if (leftTimestamp == null && rightTimestamp != null) return -1;
  // Platform attempts are stored newest-first, so reverse source order when a
  // legacy entry has no timestamp.
  return right.index - left.index;
}

function compareSessionsChronologically(left, right) {
  return (sessionTimestamp(left) ?? 0) - (sessionTimestamp(right) ?? 0);
}

function attemptTimestamp(attempt) {
  return finiteNumber(attempt?.answeredAt) ?? finiteNumber(attempt?.timestamp);
}

function sessionTimestamp(session) {
  return finiteNumber(session?.endedAt)
    ?? finiteNumber(session?.startedAt)
    ?? finiteNumber(session?.updatedAt);
}

function normalizedAccuracy(value) {
  const accuracy = Number(value);
  return Number.isFinite(accuracy) ? Math.max(0, Math.min(1, accuracy)) : 0;
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.round(nonNegativeNumber(value)));
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function finiteNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanId(value) {
  return String(value ?? "").trim();
}

function asObjectList(value) {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
