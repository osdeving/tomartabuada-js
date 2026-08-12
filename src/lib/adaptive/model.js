import {
  ADAPTIVE_SCHEMA_VERSION,
  DEFAULT_ADAPTIVE_CONFIG,
  clampDifficulty,
  normalizeMode,
} from "./config.js";

let localSequence = 0;

export function createAttempt(rawAttempt = {}, context = {}) {
  const timestamp = positiveNumber(
    rawAttempt.timestamp ?? rawAttempt.answeredAt ?? context.timestamp,
    Date.now(),
  );
  const responseTimeMs = nonNegativeNumber(
    rawAttempt.responseTimeMs ?? rawAttempt.responseTime,
    null,
  );
  const responseWindowMs = positiveNumber(
    rawAttempt.responseWindowMs ?? context.responseWindowMs,
    null,
  );
  const correct = readBoolean(rawAttempt.correct ?? rawAttempt.isCorrect);
  const timedOut = readBoolean(rawAttempt.timedOut) || (
    responseTimeMs != null && responseWindowMs != null && responseTimeMs > responseWindowMs
  );
  const sectionId = cleanId(rawAttempt.sectionId ?? context.sectionId);
  const groupId = cleanId(rawAttempt.groupId ?? context.groupId ?? sectionId) || "geral";
  const skillKey = cleanId(rawAttempt.skillKey ?? rawAttempt.questionId) || "desconhecida";
  const patternKey = cleanId(
    rawAttempt.patternKey ??
      rawAttempt.patternId ??
      rawAttempt.presetId ??
      inferPatternKey(skillKey),
  ) || "geral";

  return {
    schemaVersion: ADAPTIVE_SCHEMA_VERSION,
    id: cleanId(rawAttempt.id) || createLocalId("attempt", timestamp),
    sessionId: cleanId(rawAttempt.sessionId ?? context.sessionId),
    userId: cleanId(rawAttempt.userId ?? context.userId),
    timestamp,
    mode: normalizeMode(rawAttempt.mode ?? context.mode),
    questionId: cleanId(rawAttempt.questionId),
    sectionId: sectionId || groupId,
    groupId,
    presetId: cleanId(rawAttempt.presetId),
    skillKey,
    patternKey,
    patternTags: normalizeStringArray(rawAttempt.patternTags ?? rawAttempt.tags),
    theoryTopicId: cleanId(rawAttempt.theoryTopicId),
    source: normalizeSource(rawAttempt.source),
    sourceId: cleanId(rawAttempt.sourceId),
    difficulty: clampDifficulty(
      rawAttempt.difficulty ?? context.difficulty,
      context.config ?? DEFAULT_ADAPTIVE_CONFIG,
    ),
    correct,
    timedOut,
    responseTimeMs,
    responseWindowMs,
    paceRatio:
      responseTimeMs != null && responseWindowMs != null
        ? round(responseTimeMs / responseWindowMs, 4)
        : null,
    hintsUsed: Math.max(0, Math.round(nonNegativeNumber(rawAttempt.hintsUsed, 0))),
    revealed: readBoolean(rawAttempt.revealed),
    skipped: readBoolean(rawAttempt.skipped),
    answerGiven: toSerializableScalar(rawAttempt.answerGiven ?? rawAttempt.userAnswer),
    expectedAnswer: toSerializableScalar(rawAttempt.expectedAnswer ?? rawAttempt.answer),
    score: Math.round(nonNegativeNumber(rawAttempt.score, 0)),
    metadata: normalizeMetadata(rawAttempt.metadata),
  };
}

export function normalizeAttempts(rawAttempts, context = {}) {
  if (!Array.isArray(rawAttempts)) {
    return [];
  }

  return rawAttempts
    .filter((attempt) => attempt && typeof attempt === "object")
    .map((attempt) => createAttempt(attempt, context))
    .sort((left, right) => left.timestamp - right.timestamp);
}

export function normalizeChallenge(rawChallenge = {}, context = {}) {
  const sectionId = cleanId(rawChallenge.sectionId ?? context.sectionId);
  const groupId = cleanId(rawChallenge.groupId ?? sectionId ?? context.groupId) || "geral";
  const skillKey = cleanId(rawChallenge.skillKey ?? rawChallenge.id) || "desconhecida";

  return {
    ...rawChallenge,
    id: cleanId(rawChallenge.id) || skillKey,
    sectionId: sectionId || groupId,
    groupId,
    skillKey,
    patternKey:
      cleanId(rawChallenge.patternKey ?? rawChallenge.patternId ?? rawChallenge.presetId) ||
      inferPatternKey(skillKey),
    patternTags: normalizeStringArray(rawChallenge.patternTags ?? rawChallenge.tags),
    theoryTopicId: cleanId(rawChallenge.theoryTopicId),
    source: normalizeSource(rawChallenge.source),
    difficulty: clampDifficulty(
      rawChallenge.difficulty ?? context.difficulty,
      context.config ?? DEFAULT_ADAPTIVE_CONFIG,
    ),
    responseWindowMs: positiveNumber(
      rawChallenge.responseWindowMs ?? context.responseWindowMs,
      null,
    ),
  };
}

export function inferPatternKey(skillKey) {
  if (typeof skillKey !== "string" || !skillKey.trim()) {
    return "geral";
  }

  return skillKey.split(":", 1)[0] || "geral";
}

export function normalizeStringArray(value) {
  const items = Array.isArray(value) ? value : value == null ? [] : [value];

  return [...new Set(items.map(cleanId).filter(Boolean))];
}

export function cleanId(value) {
  return typeof value === "string" ? value.trim().slice(0, 180) : "";
}

function normalizeSource(source) {
  const normalized = cleanId(source).toLowerCase();

  if (["book", "livro", "pdf", "example", "exercise"].includes(normalized)) {
    return "book";
  }

  if (["generated", "gerado", "random"].includes(normalized)) {
    return "generated";
  }

  return normalized || "catalog";
}

function readBoolean(value) {
  if (value === true || value === 1 || value === "true") {
    return true;
  }

  return false;
}

function positiveNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}

function nonNegativeNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback;
}

function normalizeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => cleanId(key) && isSerializableScalar(item))
      .slice(0, 30),
  );
}

function isSerializableScalar(value) {
  return value == null || ["string", "number", "boolean"].includes(typeof value);
}

function toSerializableScalar(value) {
  return isSerializableScalar(value) ? value ?? null : null;
}

function createLocalId(prefix, timestamp) {
  localSequence = (localSequence + 1) % 1_000_000;
  return `${prefix}-${Math.round(timestamp)}-${localSequence.toString(36)}`;
}

function round(value, precision) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
