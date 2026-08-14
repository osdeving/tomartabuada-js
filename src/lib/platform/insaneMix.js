import rawCatalog from "../../data/insane-mix-patterns.json" with { type: "json" };

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_BIGINT = -MAX_SAFE_BIGINT;
const MAX_GENERATION_ATTEMPTS = 96;
const DEFAULT_RECENT_WINDOW = 8;

export const INSANE_MIX_GROUP_ID = "mix-insano";

export const INSANE_MIX_GENERATOR_IDS = Object.freeze([
  "add-integers",
  "subtract-integers",
  "multiply-integers",
  "linear-chain",
  "integer-power",
  "perfect-root",
  "exact-division",
  "percent-of",
  "decimal-chain",
  "multiply-decimal",
  "compound-expression",
]);

const GENERATOR_ID_SET = new Set(INSANE_MIX_GENERATOR_IDS);
const OPERATION_ID_SET = new Set(["add", "sub", "mul", "div", "percent", "power", "root"]);
const MULTIPLICATION_FEATURE_IDS = new Set([
  "identity",
  "power-of-ten",
  "times-eleven",
  "retrieval-anchor",
]);
const PREFERRED_ATOM_FEATURE_IDS = new Set([
  "anchor",
  "decrement",
  "power-of-ten",
  "times-eleven",
  "exact-division",
]);
const COMPOUND_NODE_IDS = new Set([
  "decimal",
  "percent-of",
  "integer-power",
  "perfect-root",
  "exact-division",
]);
const NODE_OPERATION = Object.freeze({
  "percent-of": "percent",
  "integer-power": "power",
  "perfect-root": "root",
  "exact-division": "div",
});

export const INSANE_MIX_CATALOG = validateInsaneMixCatalog(rawCatalog);

/**
 * Validates every externally configurable identifier before generation starts.
 * Returns the same catalog so callers can validate fixtures without maintaining
 * a second normalization contract.
 */
export function validateInsaneMixCatalog(catalog) {
  if (!isPlainObject(catalog)) throw new TypeError("Insane Mix catalog must be an object");
  if (!Number.isInteger(catalog.schemaVersion) || catalog.schemaVersion < 1) {
    throw new TypeError("Insane Mix catalog needs a positive schemaVersion");
  }

  const scale = catalog.ratingScale;
  assertObject(scale, "ratingScale");
  assertFiniteRange(scale.min, scale.max, "ratingScale");
  if (!Number.isFinite(scale.legacyLevelSize) || scale.legacyLevelSize <= 0) {
    throw new TypeError("ratingScale.legacyLevelSize must be positive");
  }

  assertObject(catalog.selection, "selection");
  const positiveSelectionFields = [
    "windowBelow",
    "windowAbove",
    "candidateBatchSize",
    "recentQuestionWindow",
    "minimumPromotionAttempts",
    "regressionWindow",
    "scoreRatingStep",
    "scoreEvidenceStep",
    "waveRatingStep",
    "waveEvidenceStep",
    "experienceRatingPerSuccess",
  ];
  for (const field of positiveSelectionFields) {
    if (!Number.isFinite(catalog.selection[field]) || catalog.selection[field] <= 0) {
      throw new TypeError(`selection.${field} must be a positive number`);
    }
  }
  if (!Number.isInteger(catalog.selection.candidateBatchSize)) {
    throw new TypeError("selection.candidateBatchSize must be an integer");
  }
  for (const field of [
    "nextGroupExplorationShare",
    "minimumPromotionAccuracy",
    "maximumPromotionPaceRatio",
    "regressionAccuracy",
    "regressionPaceRatio",
    "promotionDelta",
    "fastPromotionDelta",
  ]) {
    if (!Number.isFinite(catalog.selection[field]) || catalog.selection[field] < 0) {
      throw new TypeError(`selection.${field} must be a non-negative number`);
    }
  }
  if (!Number.isFinite(catalog.selection.regressionDelta)
    || catalog.selection.regressionDelta > 0) {
    throw new TypeError("selection.regressionDelta must be a non-positive number");
  }

  if (!Array.isArray(catalog.patterns) || !catalog.patterns.length) {
    throw new TypeError("Insane Mix catalog needs patterns");
  }

  const patternIds = new Set();
  for (const pattern of catalog.patterns) {
    assertObject(pattern, "pattern");
    assertUniqueId(pattern.id, patternIds, "pattern");
    if (!GENERATOR_ID_SET.has(pattern.generator)) {
      throw new RangeError(`Unknown Insane Mix generator: ${pattern.generator}`);
    }
    if (!Number.isFinite(pattern.difficultyRating)
      || pattern.difficultyRating < scale.min
      || pattern.difficultyRating > scale.max) {
      throw new RangeError(`Invalid difficultyRating for pattern ${pattern.id}`);
    }
    if (!Number.isFinite(pattern.weight) || pattern.weight <= 0) {
      throw new TypeError(`Pattern ${pattern.id} needs a positive weight`);
    }
    if (!Number.isFinite(pattern.targetResponseMs) || pattern.targetResponseMs <= 0) {
      throw new TypeError(`Pattern ${pattern.id} needs targetResponseMs`);
    }
    assertStringArray(pattern.features, `pattern ${pattern.id}.features`);
    assertStringArray(pattern.operations, `pattern ${pattern.id}.operations`);
    for (const operation of pattern.operations) {
      if (!OPERATION_ID_SET.has(operation)) {
        throw new RangeError(`Pattern ${pattern.id} has unknown operation ${operation}`);
      }
    }
    if (new Set(pattern.operations).size !== pattern.operations.length) {
      throw new RangeError(`Pattern ${pattern.id} has duplicate operations`);
    }
    assertStringArray(pattern.examples, `pattern ${pattern.id}.examples`);
    assertObject(pattern.params, `pattern ${pattern.id}.params`);
    validateRangeObjects(pattern.params, `pattern ${pattern.id}.params`);
  }

  const groupIds = new Set();
  const patternGroupCounts = new Map([...patternIds].map((patternId) => [patternId, 0]));
  if (!Array.isArray(catalog.groups) || !catalog.groups.length) {
    throw new TypeError("Insane Mix catalog needs groups");
  }
  for (const group of catalog.groups) {
    assertObject(group, "group");
    assertUniqueId(group.id, groupIds, "group");
    if (group.operator !== "OR") {
      throw new RangeError(`Unsupported group operator in ${group.id}: ${group.operator}`);
    }
    assertStringArray(group.patternIds, `group ${group.id}.patternIds`);
    for (const patternId of group.patternIds) {
      if (!patternIds.has(patternId)) {
        throw new RangeError(`Group ${group.id} references unknown pattern ${patternId}`);
      }
      patternGroupCounts.set(patternId, patternGroupCounts.get(patternId) + 1);
    }
  }
  for (const [patternId, count] of patternGroupCounts) {
    if (count !== 1) {
      throw new RangeError(`Pattern ${patternId} must belong to exactly one group; received ${count}`);
    }
  }

  if (!Array.isArray(catalog.progression) || !catalog.progression.length) {
    throw new TypeError("Insane Mix catalog needs progression entries");
  }
  let previousRating = -Infinity;
  const progressionGroupIds = new Set();
  for (const [index, entry] of catalog.progression.entries()) {
    assertObject(entry, "progression entry");
    if (!Number.isFinite(entry.minRating)
      || entry.minRating < scale.min
      || entry.minRating > scale.max
      || entry.minRating < previousRating) {
      throw new RangeError("Insane Mix progression ratings must be ordered and in range");
    }
    if (index === 0 && entry.minRating !== scale.min) {
      throw new RangeError("Insane Mix progression must start at ratingScale.min");
    }
    previousRating = entry.minRating;
    assertStringArray(entry.groupIds, `progression ${entry.minRating}.groupIds`);
    for (const groupId of entry.groupIds) {
      if (!groupIds.has(groupId)) {
        throw new RangeError(`Progression references unknown group ${groupId}`);
      }
      progressionGroupIds.add(groupId);
    }
  }
  for (const groupId of groupIds) {
    if (!progressionGroupIds.has(groupId)) {
      throw new RangeError(`Group ${groupId} is not referenced by progression`);
    }
  }

  for (const pattern of catalog.patterns) {
    const references = pattern.params.percentPatternChoices ?? [];
    if (references != null && !Array.isArray(references)) {
      throw new TypeError(`Pattern ${pattern.id}.percentPatternChoices must be an array`);
    }
    for (const reference of references) {
      if (!patternIds.has(reference)) {
        throw new RangeError(`Pattern ${pattern.id} references unknown pattern ${reference}`);
      }
      const referencedPattern = catalog.patterns.find((candidate) => candidate.id === reference);
      if (referencedPattern.generator !== "percent-of") {
        throw new RangeError(`Pattern ${pattern.id} percentage reference ${reference} is not percent-of`);
      }
    }
    const nodeIds = [
      ...(pattern.params.requiredNode ? [pattern.params.requiredNode] : []),
      ...(pattern.params.requiredNodes ?? []),
    ];
    for (const nodeId of nodeIds) {
      if (!COMPOUND_NODE_IDS.has(nodeId)) {
        throw new RangeError(`Pattern ${pattern.id} references unknown node ${nodeId}`);
      }
      const requiredOperation = NODE_OPERATION[nodeId];
      if (requiredOperation && !pattern.operations.includes(requiredOperation)) {
        throw new RangeError(
          `Pattern ${pattern.id} requires ${nodeId} without operation ${requiredOperation}`,
        );
      }
    }
    if ((pattern.params.requireDecimalMultiplication
      || pattern.params.requireDenseMultiplication
      || pattern.params.minimumDenseMultiplications > 0)
      && !pattern.operations.includes("mul")) {
      throw new RangeError(`Pattern ${pattern.id} requires multiplication without operation mul`);
    }
    if (pattern.params.minimumExactDivisions > 0 && !pattern.operations.includes("div")) {
      throw new RangeError(`Pattern ${pattern.id} requires exact division without operation div`);
    }
    for (const flag of [
      "standardPrecedence",
      "exactArithmetic",
      "exactRationalArithmetic",
      "requireSharedFractionalPart",
    ]) {
      if (pattern.params[flag] != null && pattern.params[flag] !== true) {
        throw new RangeError(`Pattern ${pattern.id}.params.${flag} may only be true when present`);
      }
    }
    if (pattern.params.leadingZero != null && pattern.params.leadingZero !== false) {
      throw new RangeError(`Pattern ${pattern.id}.params.leadingZero must be false`);
    }
    if (pattern.params.sharedTens != null && pattern.params.factorDigits !== 2) {
      throw new RangeError(`Pattern ${pattern.id} with sharedTens requires factorDigits 2`);
    }
    if (pattern.generator === "exact-division"
      && (pattern.params.buildDividendFromFactors !== true || pattern.params.remainder !== 0)) {
      throw new RangeError(
        `Pattern ${pattern.id} exact division requires buildDividendFromFactors=true and remainder=0`,
      );
    }
    if (pattern.generator === "perfect-root"
      && pattern.params.buildRadicandFromRoot !== true) {
      throw new RangeError(
        `Pattern ${pattern.id} perfect root requires buildRadicandFromRoot=true`,
      );
    }
    if (pattern.params.allowedAtomFeatures != null) {
      throw new RangeError(
        `Pattern ${pattern.id}.params.allowedAtomFeatures is deprecated; use preferredAtomFeatures`,
      );
    }
    const preferredAtomFeatures = pattern.params.preferredAtomFeatures;
    if (preferredAtomFeatures != null) {
      assertStringArray(
        preferredAtomFeatures,
        `pattern ${pattern.id}.params.preferredAtomFeatures`,
      );
      for (const feature of preferredAtomFeatures) {
        if (!PREFERRED_ATOM_FEATURE_IDS.has(feature)) {
          throw new RangeError(`Pattern ${pattern.id} has unknown preferred atom feature ${feature}`);
        }
      }
    }
    const multiplicationFeatures = pattern.params.allowedMultiplicationFeatures;
    if (multiplicationFeatures != null) {
      assertStringArray(
        multiplicationFeatures,
        `pattern ${pattern.id}.params.allowedMultiplicationFeatures`,
      );
      for (const feature of multiplicationFeatures) {
        if (!MULTIPLICATION_FEATURE_IDS.has(feature)) {
          throw new RangeError(`Pattern ${pattern.id} has unknown multiplication feature ${feature}`);
        }
      }
      if (!pattern.operations.includes("mul")) {
        throw new RangeError(`Pattern ${pattern.id} configures multiplication without operation mul`);
      }
    }
    validateMinimumConstraint(
      pattern.params.minimumDistinctOperations,
      `pattern ${pattern.id}.params.minimumDistinctOperations`,
      pattern.operations.length,
    );
    validateMinimumConstraint(
      pattern.params.minimumPrecedenceDepth,
      `pattern ${pattern.id}.params.minimumPrecedenceDepth`,
      2,
    );
  }

  return catalog;
}

export function createInsaneMixRandom(seed) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function legacyDifficultyToInsaneRating(difficulty, catalog = INSANE_MIX_CATALOG) {
  const level = clamp(Math.round(finiteNumber(difficulty, 1)), 1, 10);
  return clamp(
    catalog.ratingScale.min + (level - 1) * catalog.ratingScale.legacyLevelSize,
    catalog.ratingScale.min,
    catalog.ratingScale.max,
  );
}

/**
 * Score and survival wave are independent routes to the same semantic rating.
 * Recent accuracy/pace then applies a deliberately small promotion or relief.
 */
export function deriveInsaneMixTargetRating(options = {}) {
  const catalog = options.catalog ?? INSANE_MIX_CATALOG;
  validateInsaneMixCatalog(catalog);
  const session = options.session ?? options.adaptiveSession ?? {};
  const difficulty = options.currentDifficulty ?? options.difficulty
    ?? session.currentDifficulty ?? 1;
  const score = Math.max(0, finiteNumber(options.score ?? session.score, 0));
  const wave = Math.max(1, Math.round(finiteNumber(
    options.wave ?? options.modeState?.wave ?? session.modeState?.wave,
    1,
  )));
  // A Mix Insana always opens lightly. Historical attempts influence
  // remediation weights in rankInsaneMixPatterns, never this session's unlock.
  const attempts = orderedAttempts(
    options.sessionAttempts ?? options.attempts ?? session.attempts,
  );
  const selection = catalog.selection;
  const legacyRating = legacyDifficultyToInsaneRating(difficulty, catalog);
  const scoreRating = catalog.ratingScale.min + Math.floor(score / selection.scoreRatingStep);
  const waveRating = catalog.ratingScale.min + (wave - 1) * selection.waveRatingStep;
  const successfulAttempts = attempts.filter(successfulAttempt).length;
  // Difficulty 1..10 changes very quickly in the legacy engine. Treat it as a
  // desired direction, but unlock its range only after enough solved material.
  // Score and survival waves can provide equivalent evidence after a restored
  // session where the complete attempt history is no longer available.
  const evidenceUnits = Math.max(
    successfulAttempts,
    Math.floor(score / selection.scoreEvidenceStep),
    Math.max(0, wave - 1) * selection.waveEvidenceStep,
  );
  const experienceCap = clamp(
    catalog.ratingScale.min + Math.floor(evidenceUnits * selection.experienceRatingPerSuccess),
    catalog.ratingScale.min,
    catalog.ratingScale.max,
  );
  const cappedLegacyRating = Math.min(legacyRating, experienceCap);
  const evidenceRating = Math.min(
    Math.max(cappedLegacyRating, scoreRating, waveRating),
    experienceCap,
  );
  const recent = attempts.slice(-Math.max(
    selection.minimumPromotionAttempts,
    selection.regressionWindow,
  ));
  const metrics = attemptMetrics(recent);
  let performanceDelta = 0;
  let reason = "base-signals";

  const regressionRecent = attempts.slice(-selection.regressionWindow);
  const regression = attemptMetrics(regressionRecent);
  if (regression.attempts >= Math.max(1, Math.min(4, selection.regressionWindow))
    && (regression.accuracy < selection.regressionAccuracy
      || (regression.averagePaceRatio != null
        && regression.averagePaceRatio > selection.regressionPaceRatio))) {
    performanceDelta = selection.regressionDelta;
    reason = "recent-relief";
  } else if (metrics.attempts >= selection.minimumPromotionAttempts
    && metrics.accuracy >= selection.minimumPromotionAccuracy
    && (metrics.averagePaceRatio == null
      || metrics.averagePaceRatio <= selection.maximumPromotionPaceRatio)) {
    performanceDelta = metrics.accuracy >= 0.95
      && (metrics.averagePaceRatio == null || metrics.averagePaceRatio <= 0.58)
      ? selection.fastPromotionDelta
      : selection.promotionDelta;
    reason = performanceDelta === selection.fastPromotionDelta
      ? "fast-mastery"
      : "ready-to-promote";
  }

  const scaledPerformanceDelta = performanceDelta > 0
    ? Math.min(
        performanceDelta,
        Math.floor(successfulAttempts / selection.minimumPromotionAttempts),
      )
    : performanceDelta;
  const rating = clamp(
    Math.round(evidenceRating + scaledPerformanceDelta),
    catalog.ratingScale.min,
    Math.max(catalog.ratingScale.min, experienceCap),
  );
  return {
    rating,
    legacyRating,
    scoreRating: clamp(scoreRating, catalog.ratingScale.min, catalog.ratingScale.max),
    waveRating: clamp(waveRating, catalog.ratingScale.min, catalog.ratingScale.max),
    performanceDelta: scaledPerformanceDelta,
    experienceCap,
    evidenceUnits,
    successfulAttempts,
    reason,
    metrics,
  };
}

/** Compact numeric facade used by integration code and diagnostics. */
export function getInsaneMixTargetRating(options = {}) {
  return deriveInsaneMixTargetRating(options).rating;
}

export function rankInsaneMixPatterns(options = {}) {
  const catalog = options.catalog ?? INSANE_MIX_CATALOG;
  validateInsaneMixCatalog(catalog);
  const target = options.targetRating == null
    ? deriveInsaneMixTargetRating({ ...options, catalog })
    : {
        rating: clamp(
          Math.round(finiteNumber(options.targetRating, catalog.ratingScale.min)),
          catalog.ratingScale.min,
          catalog.ratingScale.max,
        ),
        reason: "explicit-target",
      };
  const selection = catalog.selection;
  const minimumRating = target.rating - selection.windowBelow;
  const maximumRating = target.rating + selection.windowAbove;
  const history = orderedAttempts(deduplicateAttempts([
    ...(Array.isArray(options.baselineAttempts) ? options.baselineAttempts : []),
    ...(Array.isArray(options.sessionAttempts)
      ? options.sessionAttempts
      : Array.isArray(options.attempts)
        ? options.attempts
        : []),
  ]));
  const unlockedGroupIds = new Set(catalog.progression
    .filter((entry) => entry.minRating <= target.rating)
    .flatMap((entry) => entry.groupIds));
  const unlockedPatternIds = new Set(catalog.groups
    .filter((group) => unlockedGroupIds.has(group.id))
    .flatMap((group) => group.patternIds));
  const unlockedPatterns = catalog.patterns.filter((pattern) => unlockedPatternIds.has(pattern.id));
  let candidates = unlockedPatterns.filter((pattern) =>
    pattern.difficultyRating >= minimumRating && pattern.difficultyRating <= maximumRating,
  );

  if (!candidates.length) {
    const distance = Math.min(...unlockedPatterns.map((pattern) =>
      Math.abs(pattern.difficultyRating - target.rating)));
    candidates = unlockedPatterns.filter((pattern) =>
      Math.abs(pattern.difficultyRating - target.rating) === distance);
  }

  const nextProgression = catalog.progression.find((entry) => entry.minRating > target.rating);
  const nextGroupPatternIds = new Set(catalog.groups
    .filter((group) => nextProgression?.groupIds.includes(group.id))
    .flatMap((group) => group.patternIds));
  const nextPattern = catalog.patterns
    .filter((pattern) => nextGroupPatternIds.has(pattern.id))
    .sort((left, right) =>
      left.difficultyRating - right.difficultyRating || left.id.localeCompare(right.id))[0];
  if (nextPattern
    && nextProgression.minRating <= maximumRating
    && selection.nextGroupExplorationShare > 0) {
    candidates = [...new Map([...candidates, nextPattern].map((pattern) => [pattern.id, pattern])).values()];
  }

  const ranked = candidates.map((pattern) => {
    const profile = patternProfile(pattern.id, history);
    const distance = Math.abs(pattern.difficultyRating - target.rating);
    const difficultyFit = Math.exp(-distance / 5.5);
    const isExploration = pattern === nextPattern && !unlockedPatternIds.has(pattern.id);
    let weight = pattern.weight * Math.max(0.04, difficultyFit);
    const reasons = [`rating ${pattern.difficultyRating} próximo do alvo ${target.rating}`];

    if (isExploration) {
      weight *= selection.nextGroupExplorationShare;
      reasons.push("exploração controlada do próximo grupo");
    }
    if (!profile.attempts) {
      weight *= 1.08;
      reasons.push("padrão ainda sem evidência");
    } else {
      const weakness = profile.errorRate
        + Math.max(0, (profile.averagePaceRatio ?? 0.75) - 0.78) * 0.45;
      if (pattern.difficultyRating <= target.rating + 1) {
        weight *= 1 + Math.min(1.8, weakness * 1.65);
        if (weakness >= 0.35) reasons.push("remediação de erro ou lentidão");
      } else if (weakness >= 0.45) {
        weight *= 0.52;
        reasons.push("evita sobrecarga acima do alvo");
      }
    }

    const turnsSinceSeen = profile.turnsSinceSeen;
    if (turnsSinceSeen === 0) {
      weight *= 0.12;
      reasons.push("evita repetição imediata");
    } else if (turnsSinceSeen === 1) {
      weight *= 0.3;
      reasons.push("espaça o padrão recente");
    } else if (turnsSinceSeen === 2) {
      weight *= 0.58;
    }

    return {
      pattern,
      profile,
      weight: round(Math.max(0.0001, weight), 8),
      reasons,
      targetRating: target.rating,
    };
  }).sort((left, right) =>
    right.weight - left.weight
    || Math.abs(left.pattern.difficultyRating - target.rating)
      - Math.abs(right.pattern.difficultyRating - target.rating)
    || left.pattern.id.localeCompare(right.pattern.id))
    .slice(0, selection.candidateBatchSize);
  const totalWeight = ranked.reduce((total, entry) => total + entry.weight, 0);

  return ranked.map((entry) => ({
    ...entry,
    probability: totalWeight ? entry.weight / totalWeight : 0,
  }));
}

export function selectInsaneMixPattern(options = {}) {
  const ranked = rankInsaneMixPatterns(options);
  if (!ranked.length) return null;
  return chooseWeightedRanked(ranked, resolveRandom(options));
}

function chooseWeightedRanked(ranked, random) {
  let threshold = normalizedRandom(random())
    * ranked.reduce((total, entry) => total + entry.weight, 0);
  for (const entry of ranked) {
    threshold -= entry.weight;
    if (threshold <= 0) return entry;
  }
  return ranked.at(-1);
}

/** Main facade consumed by the training-session question selector. */
export function selectInsaneMixQuestion(options = {}) {
  const catalog = options.catalog ?? INSANE_MIX_CATALOG;
  const random = resolveRandom(options);
  const session = options.session ?? options.adaptiveSession ?? {};
  const sessionAttempts = options.sessionAttempts ?? options.attempts ?? session.attempts ?? [];
  const target = deriveInsaneMixTargetRating({
    ...options,
    catalog,
    attempts: sessionAttempts,
    currentDifficulty: options.currentDifficulty ?? session.currentDifficulty,
    score: options.score ?? session.score,
    wave: options.wave ?? session.modeState?.wave,
  });
  const ranked = rankInsaneMixPatterns({
    ...options,
    catalog,
    attempts: sessionAttempts,
    targetRating: target.rating,
    random,
  });
  const primarySelection = ranked.length ? chooseWeightedRanked(ranked, random) : null;
  if (!primarySelection) return null;

  const recentQuestionIds = new Set(options.recentQuestionIds ?? []);
  let question = null;
  let selection = primarySelection;
  const rerolls = Math.max(2, catalog.selection.recentQuestionWindow ?? DEFAULT_RECENT_WINDOW);
  const alternatives = [
    primarySelection,
    ...ranked.filter((entry) => entry.pattern.id !== primarySelection.pattern.id),
  ];
  selectionLoop:
  for (const [selectionIndex, candidate] of alternatives.entries()) {
    const generationAttempts = selectionIndex === 0 ? rerolls : Math.min(2, rerolls);
    for (let index = 0; index < generationAttempts; index += 1) {
      question = generateInsaneMixQuestion(candidate.pattern, { catalog, random });
      selection = candidate;
      if (!recentQuestionIds.has(question.questionId)) {
        break selectionLoop;
      }
    }
  }

  return {
    ...question,
    selectionReasons: selection.reasons,
    insaneMix: {
      targetRating: target.rating,
      targetReason: target.reason,
      legacyRating: target.legacyRating,
      scoreRating: target.scoreRating,
      waveRating: target.waveRating,
      performanceDelta: target.performanceDelta,
      patternWeight: selection.weight,
      patternProbability: selection.probability,
    },
  };
}

export function generateInsaneMixQuestion(patternOrId, options = {}) {
  const catalog = options.catalog ?? INSANE_MIX_CATALOG;
  const pattern = resolvePattern(patternOrId, catalog);
  const random = resolveRandom(options);
  const generator = GENERATORS[pattern.generator];
  let lastError = null;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const generated = generator(pattern, random, catalog);
      const evaluated = evaluateRational(generated.ast);
      const formatted = formatRational(evaluated);
      const answer = Number(formatted.input);
      if (!Number.isFinite(answer)
        || evaluated.numerator > MAX_SAFE_BIGINT * evaluated.denominator
        || evaluated.numerator < MIN_SAFE_BIGINT * evaluated.denominator) {
        throw new RangeError("Generated answer is outside Number.MAX_SAFE_INTEGER");
      }
      if (String(answer) !== formatted.input) {
        throw new RangeError("Generated answer loses decimal precision in the input contract");
      }
      if (pattern.params.allowNegativeAnswer === false && evaluated.numerator < 0n) {
        throw new RangeError("Pattern does not allow a negative answer");
      }
      if (pattern.params.maximumAnswerScale != null
        && formatted.scale > pattern.params.maximumAnswerScale) {
        throw new RangeError("Generated answer exceeds configured decimal scale");
      }
      const answerDigits = formatted.input.split(".")[0].replace("-", "").length;
      if (pattern.params.maximumAnswerDigits != null
        && answerDigits > pattern.params.maximumAnswerDigits) {
        throw new RangeError("Generated answer exceeds configured digit count");
      }

      const operations = [...new Set(collectAstOperations(generated.ast))];
      if (pattern.params.minimumDistinctOperations != null
        && operations.length < pattern.params.minimumDistinctOperations) {
        throw new RangeError("Generated expression has too few distinct operations");
      }
      const precedenceDepth = expressionPrecedenceDepth(generated.ast);
      if (pattern.params.minimumPrecedenceDepth != null
        && precedenceDepth < pattern.params.minimumPrecedenceDepth) {
        throw new RangeError("Generated expression has insufficient precedence depth");
      }

      const canonical = serializeAst(generated.ast);
      const contentHash = stableHash(`${pattern.id}|${canonical}`);
      const id = `insane:${pattern.id}:${contentHash}`;
      const atomIds = [...new Set([pattern.id, ...(generated.atomIds ?? [])])];
      const features = [...new Set([
        ...pattern.features,
        ...(generated.features ?? []),
      ])];
      const hasDecimal = evaluated.denominator !== 1n;
      const patternGroup = catalog.groups.find((group) => group.patternIds.includes(pattern.id));

      return {
        id,
        questionId: id,
        sectionId: INSANE_MIX_GROUP_ID,
        groupId: INSANE_MIX_GROUP_ID,
        presetId: pattern.id,
        patternKey: pattern.id,
        generatorId: pattern.generator,
        patternGroupId: patternGroup?.id ?? "",
        patternGroupLabel: patternGroup?.label ?? "",
        patternTags: [...new Set([pattern.family, ...features, ...operations])],
        skillKey: `insane:${pattern.id}:${contentHash}`,
        family: pattern.family,
        label: pattern.label,
        difficultyLabel: `D${pattern.difficultyRating} · ${pattern.label}`,
        description: pattern.description,
        difficulty: clamp(Math.ceil(pattern.difficultyRating / 10), 1, 10),
        difficultyRating: pattern.difficultyRating,
        atomIds,
        features,
        operations,
        precedenceDepth,
        expressionAst: generated.ast,
        expressionSignature: canonical,
        prompt: formatInsaneExpression(generated.ast),
        promptLatex: formatInsaneExpressionLatex(generated.ast),
        answer,
        answerInput: formatted.input,
        answerDisplay: formatted.display,
        answerType: hasDecimal ? "decimal-tolerance" : "exact-number",
        answerSpec: null,
        acceptsDecimal: hasDecimal,
        tolerance: hasDecimal ? 0.000001 : 0,
        targetResponseMs: pattern.targetResponseMs,
        responseWindowMs: pattern.targetResponseMs,
        source: "generated",
        sourceId: id,
        sourceDocumentId: "insane-mix-patterns",
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Could not generate a safe question for ${pattern.id}: ${lastError?.message ?? "unknown error"}`,
  );
}

export function evaluateInsaneExpression(ast) {
  const value = evaluateRational(ast);
  const formatted = formatRational(value);
  return {
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
    input: formatted.input,
    display: formatted.display,
    value: Number(formatted.input),
  };
}

export function formatInsaneExpression(ast) {
  return renderAst(ast, false).text;
}

export function formatInsaneExpressionLatex(ast) {
  return renderAst(ast, true).text;
}

const GENERATORS = {
  "add-integers": generateAddition,
  "subtract-integers": generateSubtraction,
  "multiply-integers": generateMultiplication,
  "linear-chain": generateLinearChain,
  "integer-power": generatePower,
  "perfect-root": generateRoot,
  "exact-division": generateExactDivision,
  "percent-of": generatePercent,
  "decimal-chain": generateDecimalChain,
  "multiply-decimal": generateDecimalMultiplication,
  "compound-expression": generateCompoundExpression,
};

function generateAddition(pattern, random) {
  const params = pattern.params;
  let left;
  let right;
  if (params.left && params.right) {
    ({ left, right } = retryValues(() => ({
      left: sampleInteger(params.left, random),
      right: sampleInteger(params.right, random),
    }), ({ left: a, right: b }) => additionMatches(a, b, params)));
  } else {
    const digits = sampleInteger(params.operandDigits ?? { min: 1, max: 2 }, random);
    if (rangeIncludesOnly(params.carryCount, 0)) {
      [left, right] = buildNoCarryPair(digits, random);
    } else {
      ({ left, right } = retryValues(() => ({
        left: randomWithDigits(digits, random),
        right: randomWithDigits(digits, random),
      }), ({ left: a, right: b }) => additionMatches(a, b, params), 500));
    }
  }
  return simpleGenerated(binary("add", integer(left), integer(right)));
}

function generateSubtraction(pattern, random) {
  const params = pattern.params;
  if (params.minuendDigits) {
    const digits = sampleInteger(params.minuendDigits, random);
    let minuend = randomWithDigits(digits, random);
    if (params.excludeTrailingZero && minuend % 10 === 0) minuend += 1;
    const subtrahend = finiteNumber(params.subtrahend, 1);
    return simpleGenerated(binary("sub", integer(minuend), integer(subtrahend)));
  }

  if (params.minuend && params.subtrahend) {
    const values = retryValues(() => ({
      left: sampleInteger(params.minuend, random),
      right: sampleInteger(params.subtrahend, random),
    }), ({ left, right }) => subtractionMatches(left, right, params));
    return simpleGenerated(binary("sub", integer(values.left), integer(values.right)));
  }

  const digits = sampleInteger(params.operandDigits ?? { min: 2, max: 3 }, random);
  let left;
  let right;
  if (params.minimumBorrowChainLength) {
    const chain = clamp(
      sampleInteger({ min: params.minimumBorrowChainLength, max: digits - 1 }, random),
      2,
      digits - 1,
    );
    const power = 10 ** chain;
    const prefix = randomInt(1, Math.max(1, 10 ** (digits - chain) - 1), random);
    left = prefix * power;
    right = randomInt(Math.max(11, 10 ** (chain - 1)), power - 1, random);
  } else if (rangeIncludesOnly(params.borrowCount, 0)) {
    [left, right] = buildNoBorrowPair(digits, random);
  } else {
    ({ left, right } = retryValues(() => {
      const a = randomWithDigits(digits, random);
      const b = randomWithDigits(digits, random);
      return { left: Math.max(a, b), right: Math.min(a, b) };
    }, ({ left: a, right: b }) => subtractionMatches(a, b, params), 600));
  }
  return simpleGenerated(binary("sub", integer(left), integer(right)));
}

function generateMultiplication(pattern, random) {
  const params = pattern.params;
  let left;
  let right;
  if (params.anchorFactorChoices) {
    left = randomWithDigits(sampleInteger(params.generalFactorDigits, random), random);
    right = choose(params.anchorFactorChoices, random);
  } else if (params.powerOfTenExponent) {
    left = randomWithDigits(sampleInteger(params.generalFactorDigits, random), random);
    right = 10 ** sampleInteger(params.powerOfTenExponent, random);
  } else if (params.anchorFactor != null) {
    left = randomWithDigits(sampleInteger(params.generalFactorDigits, random), random);
    right = params.anchorFactor;
  } else if (params.sharedTens) {
    const tens = sampleInteger(params.sharedTens, random);
    const unitA = randomInt(1, 5, random);
    left = tens * 10 + unitA;
    right = tens * 10 + (params.unitsSum - unitA);
  } else if (params.roundableFactorDigits) {
    left = randomWithDigits(sampleInteger(params.generalFactorDigits, random), random);
    const factorDigits = sampleInteger(params.roundableFactorDigits, random);
    const place = 10 ** (factorDigits - 1);
    const base = randomInt(factorDigits === 2 ? 2 : 1, 9, random) * place;
    const distance = sampleInteger(params.distanceFromPowerOfTen, random);
    right = base + (normalizedRandom(random()) < 0.5 ? -distance : distance);
  } else if (params.factorRange) {
    const values = retryValues(() => ({
      left: sampleInteger(params.factorRange, random),
      right: sampleInteger(params.factorRange, random),
    }), ({ left: a, right: b }) => multiplicationRequires(a, b, params.requireAny));
    ({ left, right } = values);
  } else {
    const values = retryValues(() => ({
      left: sampleInteger(params.left, random),
      right: sampleInteger(params.right, random),
    }), ({ left: a, right: b }) => !hasExcludedMultiplicationFeature(a, b, params.excludeFeatures));
    ({ left, right } = values);
  }

  if (params.commutativeOrientation === "either" && normalizedRandom(random()) < 0.5) {
    [left, right] = [right, left];
  }
  return simpleGenerated(binary("mul", integer(left), integer(right)));
}

function generatePower(pattern, random) {
  const params = pattern.params;
  const exponent = sampleInteger(params.exponent, random);
  const base = retryValues(
    () => params.baseChoices
      ? choose(params.baseChoices, random)
      : sampleInteger(params.base, random),
    (value) => !(params.excludeBase ?? []).includes(value),
  );
  const ast = { type: "power", base: integer(base), exponent };
  const value = evaluateRational(ast);
  if (params.maximumAnswerDigits
    && absoluteDigitCount(value.numerator) > params.maximumAnswerDigits) {
    throw new RangeError("Power exceeds configured digits");
  }
  return simpleGenerated(ast);
}

function generateRoot(pattern, random) {
  const params = pattern.params;
  const degree = sampleInteger(params.degree, random);
  const root = sampleInteger(params.root, random);
  const radicand = BigInt(root) ** BigInt(degree);
  return simpleGenerated({
    type: "root",
    degree,
    radicand: integer(radicand),
  });
}

function generateExactDivision(pattern, random) {
  const params = pattern.params;
  const values = retryValues(() => ({
    divisor: sampleInteger(params.divisor, random),
    quotient: sampleInteger(params.quotient, random),
  }), ({ divisor }) =>
    (!params.excludePowerOfTenDivisors || !isPowerOfTen(divisor))
    && (!params.excludeRoundDivisors || divisor % 10 !== 0));
  const dividend = values.divisor * values.quotient;
  return simpleGenerated(binary(
    "div",
    integer(dividend),
    integer(values.divisor),
  ));
}

function generatePercent(pattern, random) {
  const params = pattern.params;
  const percent = params.percentChoices
    ? choose(params.percentChoices, random)
    : retryValues(
        () => sampleInteger(params.percent, random),
        (value) => !(params.excludePercentages ?? []).includes(value),
      );
  let value;
  if (params.preferIntegerResult) {
    const step = 100 / Number(gcd(BigInt(percent), 100n));
    const minimum = Math.ceil(params.value.min / step);
    const maximum = Math.floor(params.value.max / step);
    value = randomInt(minimum, Math.max(minimum, maximum), random) * step;
  } else {
    value = sampleInteger(params.value, random);
  }
  return simpleGenerated({
    type: "percent-of",
    percent: integer(percent),
    value: integer(value),
  });
}

function generateDecimalMultiplication(pattern, random) {
  const params = pattern.params;
  const scale = sampleInteger(params.decimalPlaces, random);
  const integerDigits = sampleInteger(params.decimalIntegerDigits, random);
  const scaled = randomScaledDecimal(integerDigits, scale, random);
  const factor = retryValues(
    () => sampleInteger(params.integerFactor, random),
    (value) => !(params.excludeEasyFactors ?? []).includes(value),
  );
  return simpleGenerated(binary(
    "mul",
    decimalFromScaled(scaled, scale),
    integer(factor),
  ));
}

function generateLinearChain(pattern, random) {
  const params = pattern.params;
  const count = sampleInteger(params.termCount, random);
  const digitRange = params.termDigits ?? { min: 1, max: 2 };
  const needsRegrouping = (params.requiredAtomFeatures ?? []).includes("regrouping");
  const needsBorrow = pattern.features.includes("borrow");
  let current;
  let ast;
  let carryCount = 0;
  let borrowCount = 0;

  if (needsRegrouping) {
    const currentBase = randomInt(50, 89, random);
    current = Math.floor(currentBase / 10) * 10 + randomInt(5, 9, random);
    const right = randomInt(20, 79, random);
    const adjustedRight = right - (right % 10) + randomInt(10 - (current % 10), 9, random);
    ast = binary("add", integer(current), integer(adjustedRight));
    carryCount += countAdditionCarries(current, adjustedRight);
    current += adjustedRight;
  } else {
    current = randomWithDigits(sampleInteger(digitRange, random), random);
    ast = integer(current);
  }

  for (let index = needsRegrouping ? 2 : 1; index < count; index += 1) {
    const operator = index % 2 ? "add" : "sub";
    const digits = sampleInteger(digitRange, random);
    let term;
    if (!needsRegrouping && operator === "add") {
      term = retryValues(
        () => randomWithDigits(digits, random),
        (value) => countAdditionCarries(current, value) === 0,
        180,
        1,
      );
    } else if (!needsRegrouping && operator === "sub") {
      term = retryValues(
        () => randomInt(1, Math.max(1, Math.min(current, 10 ** digits - 1)), random),
        (value) => countSubtractionBorrows(current, value).count === 0,
        180,
        1,
      );
    } else if (operator === "sub") {
      term = retryValues(
        () => randomInt(1, Math.max(1, Math.min(current, 10 ** digits - 1)), random),
        (value) => !needsBorrow
          || borrowCount > 0
          || countSubtractionBorrows(current, value).count > 0,
      );
      borrowCount += countSubtractionBorrows(current, term).count;
    } else {
      term = randomWithDigits(digits, random);
      carryCount += countAdditionCarries(current, term);
    }
    ast = binary(operator, ast, integer(term));
    current = operator === "add" ? current + term : current - term;
  }

  if (needsRegrouping && carryCount < 1) throw new RangeError("Missing carry");
  if (needsBorrow && borrowCount < 1) throw new RangeError("Missing borrow");
  return {
    ast,
    atomIds: [needsRegrouping ? "linear:regrouping" : "linear:clean-add-sub"],
    features: needsRegrouping
      ? [
          ...(carryCount > 0 ? ["carry", `carry-count:${carryCount}`] : []),
          ...(borrowCount > 0 ? ["borrow", `borrow-count:${borrowCount}`] : []),
        ]
      : ["no-carry", "no-borrow"],
  };
}

function generateDecimalChain(pattern, random) {
  const params = pattern.params;
  const requiresCarryAndBorrow = pattern.features.includes("carry")
    && pattern.features.includes("borrow");
  const count = Math.max(sampleInteger(params.termCount, random), requiresCarryAndBorrow ? 3 : 1);
  const scale = sampleInteger(params.decimalPlaces, random);
  const factor = 10 ** scale;
  const integerDigits = sampleInteger(params.integerDigits ?? { min: 1, max: 2 }, random);
  const maximumScaled = (10 ** integerDigits - 1) * factor + factor - 1;
  let values;
  let operators;

  if (params.requireCancellation) {
    const sharedFraction = randomInt(1, factor - 1, random);
    const first = randomScaledDecimal(integerDigits, scale, random);
    const second = randomInt(1, 20, random) * factor + sharedFraction;
    const third = randomInt(1, Math.max(1, Math.floor(second / factor) - 1), random) * factor
      + sharedFraction;
    values = [first, second, third];
    operators = ["add", "sub"];
  } else if (params.minimumRegroupingCount) {
    const first = retryValues(
      () => randomInt(factor, maximumScaled, random),
      (value) => value % factor !== 0,
    );
    const firstFraction = first % factor;
    const secondFraction = randomInt(factor - firstFraction, factor - 1, random);
    const second = randomInt(1, Math.max(1, 10 ** integerDigits - 1), random) * factor
      + secondFraction;
    values = [first, second];
    operators = ["add"];
    let current = first + second;
    if (requiresCarryAndBorrow) {
      const third = retryValues(
        () => randomInt(1, Math.max(1, Math.min(current, maximumScaled)), random),
        (value) => countSubtractionBorrows(current, value).count > 0,
      );
      values.push(third);
      operators.push("sub");
      current -= third;
    }
    while (values.length < count) {
      const operator = values.length % 2 ? "sub" : "add";
      const next = operator === "sub"
        ? randomInt(1, Math.max(1, Math.min(current, maximumScaled)), random)
        : randomInt(1, maximumScaled, random);
      values.push(next);
      operators.push(operator);
      current = operator === "add" ? current + next : current - next;
    }
  } else {
    values = [randomScaledDecimal(integerDigits, scale, random)];
    operators = [];
    let current = values[0];
    while (values.length < count) {
      const operator = values.length % 2 ? "add" : "sub";
      let next;
      if (operator === "sub") {
        next = retryValues(
          () => randomInt(1, Math.max(1, Math.min(current, maximumScaled)), random),
          (value) => matchesRange(countSubtractionBorrows(current, value).count, params.borrowCount),
          500,
        );
      } else {
        next = retryValues(
          () => randomInt(1, maximumScaled, random),
          (value) => matchesRange(countAdditionCarries(current, value), params.carryCount),
          500,
        );
      }
      values.push(next);
      operators.push(operator);
      current = operator === "add" ? current + next : current - next;
    }
  }

  let ast = decimalFromScaled(values[0], scale);
  for (let index = 1; index < values.length; index += 1) {
    ast = binary(operators[index - 1], ast, decimalFromScaled(values[index], scale));
  }
  return {
    ast,
    atomIds: ["decimal:chain"],
    features: [
      "exact-rational",
      ...(requiresCarryAndBorrow ? ["carry", "borrow"] : []),
    ],
  };
}

function generateCompoundExpression(pattern, random, catalog) {
  const params = pattern.params;
  const termCount = sampleInteger(params.termCount, random);
  const requiredNodes = new Set([
    ...(params.requiredNode ? [params.requiredNode] : []),
    ...(params.requiredNodes ?? []),
  ]);
  const atoms = [];
  const operations = new Set(pattern.operations);
  const integerDigits = params.integerDigits
    ?? params.termDigits
    ?? (pattern.difficultyRating >= 90 ? { min: 4, max: 7 } : { min: 1, max: 3 });

  const addAtom = (kind) => atoms.push(makeCompoundAtom(
    kind,
    pattern,
    random,
    integerDigits,
    catalog,
  ));
  for (const node of requiredNodes) addAtom(node);
  if (params.requireDecimalMultiplication && !requiredNodes.has("decimal")) addAtom("decimal-mul");
  if ((params.requiredAtomFeatures ?? []).includes("regrouping")) addAtom("regrouping");
  for (let index = countCompoundKind(atoms, "dense-mul");
    index < (params.minimumDenseMultiplications ?? (params.requireDenseMultiplication ? 1 : 0));
    index += 1) addAtom("dense-mul");
  for (let index = countCompoundKind(atoms, "exact-division");
    index < (params.minimumExactDivisions ?? 0);
    index += 1) addAtom("exact-division");

  if (operations.has("percent") && !atoms.some((atom) => atom.kind === "percent-of")) addAtom("percent-of");
  if (operations.has("power") && !atoms.some((atom) => atom.kind === "integer-power")) addAtom("integer-power");
  if (operations.has("root") && !atoms.some((atom) => atom.kind === "perfect-root")) addAtom("perfect-root");
  if (operations.has("div") && !atoms.some((atom) => atom.kind === "exact-division")) addAtom("exact-division");
  if (operations.has("mul") && !atoms.some((atom) => ["dense-mul", "easy-mul", "decimal-mul"].includes(atom.kind))) {
    addAtom(pattern.features.includes("easy-atoms") ? "easy-mul" : "dense-mul");
  }
  if (pattern.features.includes("decimal") && !atoms.some((atom) => atom.kind.startsWith("decimal"))) {
    addAtom("decimal");
  }

  while (atoms.length < termCount) {
    const choices = compoundFillChoices(pattern, params);
    addAtom(choose(choices, random));
  }
  if (atoms.length > termCount) atoms.length = termCount;

  const allowNegative = params.allowNegativeAnswer === true
    && params.allIntermediateResultsNonNegative !== true;
  if (!allowNegative) {
    atoms.sort((left, right) => compareRationalAbsolute(
      evaluateRational(right.ast),
      evaluateRational(left.ast),
    ));
  }

  let ast = atoms[0].ast;
  let usedSubtraction = false;
  for (let index = 1; index < atoms.length; index += 1) {
    let operator = "add";
    if (operations.has("sub") && (allowNegative ? index % 2 === 0 : index === atoms.length - 1)) {
      operator = "sub";
      usedSubtraction = true;
    }
    ast = binary(operator, ast, atoms[index].ast);
  }
  if (operations.has("sub") && !usedSubtraction && atoms.length > 1) {
    ast = binary("sub", atoms[0].ast, atoms[1].ast);
    for (const atom of atoms.slice(2)) ast = binary("add", ast, atom.ast);
  }

  return {
    ast,
    atomIds: atoms.map((atom) => atom.atomId),
    features: atoms.flatMap((atom) => atom.features ?? []),
  };
}

function makeCompoundAtom(kind, pattern, random, integerDigits, catalog) {
  const scale = sampleInteger(pattern.params.decimalPlaces ?? { min: 1, max: 2 }, random);
  if (kind === "decimal") {
    return atom(
      "decimal",
      decimalFromScaled(randomScaledDecimal(2, scale, random), scale),
      "compound:decimal",
      ["decimal", `decimal-scale:${scale}`],
    );
  }
  if (kind === "decimal-mul") {
    const decimal = decimalFromScaled(randomScaledDecimal(2, scale, random), scale);
    const factor = randomInt(12, 48, random);
    return atom(
      "decimal-mul",
      binary("mul", decimal, integer(factor)),
      "compound:decimal-mul",
      ["decimal", "decimal-multiplication", `decimal-scale:${scale}`],
    );
  }
  if (kind === "percent-of") {
    if (pattern.params.percentPatternChoices?.length) {
      const selectedPatternId = choose(pattern.params.percentPatternChoices, random);
      const selectedPattern = catalog.patterns.find((candidate) =>
        candidate.id === selectedPatternId);
      const generated = generatePercent(selectedPattern, random);
      return atom(
        "percent-of",
        generated.ast,
        "compound:percent-of",
        percentAtomFeatures(generated.ast, selectedPattern.id),
      );
    }
    const percent = choose([5, 10, 15, 17, 25, 37, 50, 75, 90], random);
    const step = 100 / Number(gcd(BigInt(percent), 100n));
    const value = randomInt(2, 80, random) * step;
    const ast = {
      type: "percent-of",
      percent: integer(percent),
      value: integer(value),
    };
    return atom(
      "percent-of",
      ast,
      "compound:percent-of",
      percentAtomFeatures(ast),
    );
  }
  if (kind === "integer-power") {
    const base = randomInt(3, 15, random);
    const exponent = randomInt(2, pattern.difficultyRating >= 90 ? 4 : 3, random);
    return atom(
      "integer-power",
      { type: "power", base: integer(base), exponent },
      "compound:power",
      ["power", `power-exponent:${exponent}`, ...(base === 10 ? ["power-base-ten"] : [])],
    );
  }
  if (kind === "perfect-root") {
    const degree = normalizedRandom(random()) < 0.75 ? 2 : 3;
    const root = randomInt(2, degree === 2 ? 99 : 25, random);
    return atom(
      "perfect-root",
      {
        type: "root",
        degree,
        radicand: integer(BigInt(root) ** BigInt(degree)),
      },
      "compound:perfect-root",
      ["perfect-root", `root-degree:${degree}`],
    );
  }
  if (kind === "exact-division") {
    const divisor = randomInt(pattern.difficultyRating >= 80 ? 101 : 12, pattern.difficultyRating >= 80 ? 999 : 99, random);
    const quotient = randomInt(11, pattern.difficultyRating >= 80 ? 999 : 199, random);
    return atom(
      "exact-division",
      binary("div", integer(divisor * quotient), integer(divisor)),
      "compound:exact-division",
      ["exact-division", `divisor-digits:${String(divisor).length}`],
    );
  }
  if (kind === "easy-mul") {
    const allowedFeatures = resolveCompoundMultiplicationFeatures(pattern);
    const feature = choose(allowedFeatures, random);
    const left = randomInt(2, 99, random);
    const factorByFeature = {
      identity: () => 1,
      "power-of-ten": () => 10 ** randomInt(1, 3, random),
      "times-eleven": () => 11,
      "retrieval-anchor": () => choose([2, 5, 8], random),
    };
    const right = factorByFeature[feature]();
    return atom(
      "easy-mul",
      binary("mul", integer(left), integer(right)),
      "compound:easy-mul",
      ["easy-multiplication", feature, `easy-factor:${right}`],
    );
  }
  if (kind === "dense-mul") {
    const digits = sampleInteger(integerDigits, random);
    const safeDigits = clamp(digits, 2, 7);
    const left = randomWithDigits(safeDigits, random);
    const rightDigits = pattern.difficultyRating >= 90 ? Math.min(7, safeDigits) : Math.min(3, safeDigits);
    const right = randomWithDigits(rightDigits, random);
    return atom(
      "dense-mul",
      binary("mul", integer(left), integer(right)),
      "compound:dense-mul",
      ["dense", `factor-digits:${safeDigits}x${rightDigits}`],
    );
  }
  if (kind === "regrouping") {
    const digits = clamp(sampleInteger(integerDigits, random), 2, 7);
    const leftBase = randomWithDigits(digits, random);
    const rightBase = randomWithDigits(digits, random);
    const leftUnit = randomInt(5, 9, random);
    const rightUnit = randomInt(10 - leftUnit, 9, random);
    const left = Math.floor(leftBase / 10) * 10 + leftUnit;
    const right = Math.floor(rightBase / 10) * 10 + rightUnit;
    return atom(
      "regrouping",
      binary("add", integer(left), integer(right)),
      "compound:regrouping-add",
      [
        "regrouping",
        countAdditionCarries(left, right) === 1 ? "single-carry" : "multiple-carry",
        `carry-count:${countAdditionCarries(left, right)}`,
      ],
    );
  }
  if (kind === "power-ten") {
    const exponent = randomInt(1, 4, random);
    return atom(
      "power-ten",
      binary("mul", integer(randomInt(2, 999, random)), integer(10 ** exponent)),
      "compound:power-ten-mul",
      ["power-of-ten", `power-of-ten-exponent:${exponent}`],
    );
  }
  if (kind === "decrement") {
    const value = randomInt(100, 999_999, random);
    return atom(
      "decrement",
      binary("sub", integer(value), integer(1)),
      "compound:decrement",
      ["decrement", ...(value % 10 === 0 ? ["trailing-zero"] : [])],
    );
  }
  const digits = sampleInteger(integerDigits, random);
  const safeDigits = clamp(digits, 1, 7);
  return atom(
    "integer",
    integer(randomWithDigits(safeDigits, random)),
    "compound:integer",
    ["integer", `integer-digits:${safeDigits}`],
  );
}

function compoundFillChoices(pattern, params) {
  const allowed = new Set(pattern.operations);
  const permitted = (choices) => choices.filter((kind) => {
    if (["easy-mul", "dense-mul", "decimal-mul", "power-ten"].includes(kind)) {
      return allowed.has("mul");
    }
    if (kind === "exact-division") return allowed.has("div");
    if (kind === "percent-of") return allowed.has("percent");
    if (kind === "integer-power") return allowed.has("power");
    if (kind === "perfect-root") return allowed.has("root");
    if (kind === "decrement") return allowed.has("sub");
    return true;
  });
  if (pattern.features.includes("easy-atoms")) {
    const multiplicationFeatures = resolveCompoundMultiplicationFeatures(pattern);
    const preferred = new Set(params.preferredAtomFeatures ?? []);
    return permitted([
      "integer",
      ...(multiplicationFeatures.length ? ["easy-mul"] : []),
      ...(multiplicationFeatures.includes("power-of-ten") ? ["power-ten"] : []),
      ...(preferred.has("decrement") ? ["decrement"] : []),
      ...(preferred.has("exact-division") ? ["exact-division"] : []),
    ]);
  }
  if (params.requireDecimalMultiplication || pattern.features.includes("decimal")) {
    return permitted(["decimal", "decimal-mul", "integer", "percent-of"]);
  }
  if (pattern.features.includes("power") || pattern.features.includes("root")) {
    return permitted(["integer-power", "perfect-root", "integer", "dense-mul"]);
  }
  return permitted(["integer", "dense-mul", "exact-division"]);
}

function resolveCompoundMultiplicationFeatures(pattern) {
  if (pattern.params.allowedMultiplicationFeatures?.length) {
    return pattern.params.allowedMultiplicationFeatures;
  }
  const preferred = new Set(pattern.params.preferredAtomFeatures ?? []);
  const inferred = [
    ...(preferred.has("anchor") ? ["retrieval-anchor"] : []),
    ...(preferred.has("power-of-ten") ? ["power-of-ten"] : []),
    ...(preferred.has("times-eleven") ? ["times-eleven"] : []),
  ];
  return inferred.length
    ? inferred
    : ["identity", "power-of-ten", "times-eleven", "retrieval-anchor"];
}

function percentAtomFeatures(ast, sourcePatternId = null) {
  const percent = formatRational(evaluateRational(ast.percent)).input;
  const result = evaluateRational(ast);
  return [
    "percentage",
    `percent-value:${percent}`,
    ...(result.denominator === 1n ? ["integer-percent-result"] : ["decimal-percent-result"]),
    ...(sourcePatternId ? [`percent-pattern:${sourcePatternId}`] : []),
  ];
}

function simpleGenerated(ast) {
  return { ast, atomIds: [] };
}

function atom(kind, ast, atomId, features = []) {
  return { kind, ast, atomId, features };
}

function countCompoundKind(atoms, kind) {
  return atoms.filter((atomEntry) => atomEntry.kind === kind).length;
}

function binary(operator, left, right) {
  return { type: "binary", operator, left, right };
}

function integer(value) {
  const numeric = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  return { type: "literal", numerator: numeric.toString(), denominator: "1" };
}

function decimalFromScaled(scaled, scale) {
  return rationalLiteral(BigInt(scaled), 10n ** BigInt(scale));
}

function rationalLiteral(numerator, denominator) {
  const value = rational(numerator, denominator);
  return {
    type: "literal",
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
  };
}

function evaluateRational(ast) {
  if (!ast || typeof ast !== "object") throw new TypeError("Invalid expression AST");
  if (ast.type === "literal") return rational(BigInt(ast.numerator), BigInt(ast.denominator));
  if (ast.type === "binary") {
    const left = evaluateRational(ast.left);
    const right = evaluateRational(ast.right);
    if (ast.operator === "add") return addRational(left, right);
    if (ast.operator === "sub") return subtractRational(left, right);
    if (ast.operator === "mul") return multiplyRational(left, right);
    if (ast.operator === "div") return divideRational(left, right);
    throw new RangeError(`Unknown binary operator: ${ast.operator}`);
  }
  if (ast.type === "power") {
    const base = evaluateRational(ast.base);
    const exponent = BigInt(ast.exponent);
    if (exponent < 0n) throw new RangeError("Negative powers are unsupported");
    return rational(base.numerator ** exponent, base.denominator ** exponent);
  }
  if (ast.type === "root") {
    const radicand = evaluateRational(ast.radicand);
    const numerator = exactIntegerRoot(radicand.numerator, ast.degree);
    const denominator = exactIntegerRoot(radicand.denominator, ast.degree);
    return rational(numerator, denominator);
  }
  if (ast.type === "percent-of") {
    return divideRational(
      multiplyRational(evaluateRational(ast.percent), evaluateRational(ast.value)),
      rational(100n, 1n),
    );
  }
  throw new RangeError(`Unknown expression node: ${ast.type}`);
}

function rational(numerator, denominator) {
  if (denominator === 0n) throw new RangeError("Division by zero");
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: sign * numerator / divisor,
    denominator: sign * denominator / divisor,
  };
}

function addRational(left, right) {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function subtractRational(left, right) {
  return rational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiplyRational(left, right) {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divideRational(left, right) {
  if (right.numerator === 0n) throw new RangeError("Division by zero");
  return rational(left.numerator * right.denominator, left.denominator * right.numerator);
}

function formatRational(value) {
  const scale = terminatingScale(value.denominator);
  if (scale == null) throw new RangeError("Answer is not a terminating decimal");
  const sign = value.numerator < 0n ? "-" : "";
  const absolute = value.numerator < 0n ? -value.numerator : value.numerator;
  const multiplier = (10n ** BigInt(scale)) / value.denominator;
  const scaled = absolute * multiplier;
  let digits = scaled.toString();
  if (!scale) return { input: `${sign}${digits}`, display: `${sign}${digits}`, scale: 0 };
  digits = digits.padStart(scale + 1, "0");
  const whole = digits.slice(0, -scale);
  const fractional = digits.slice(-scale).replace(/0+$/, "");
  if (!fractional) return { input: `${sign}${whole}`, display: `${sign}${whole}`, scale: 0 };
  return {
    input: `${sign}${whole}.${fractional}`,
    display: `${sign}${whole},${fractional}`,
    scale: fractional.length,
  };
}

function terminatingScale(denominator) {
  let remaining = denominator;
  let twos = 0;
  let fives = 0;
  while (remaining % 2n === 0n) {
    remaining /= 2n;
    twos += 1;
  }
  while (remaining % 5n === 0n) {
    remaining /= 5n;
    fives += 1;
  }
  return remaining === 1n ? Math.max(twos, fives) : null;
}

function exactIntegerRoot(value, degree) {
  if (!Number.isInteger(degree) || degree < 2) throw new RangeError("Invalid root degree");
  if (value < 0n && degree % 2 === 0) throw new RangeError("Even root of a negative value");
  const sign = value < 0n ? -1n : 1n;
  const target = value < 0n ? -value : value;
  let low = 0n;
  let high = target + 1n;
  while (low + 1n < high) {
    const middle = (low + high) / 2n;
    const power = middle ** BigInt(degree);
    if (power <= target) low = middle;
    else high = middle;
  }
  if (low ** BigInt(degree) !== target) throw new RangeError("Root is not exact");
  return sign * low;
}

function renderAst(ast, latex, parentPrecedence = 0, side = "root") {
  if (ast.type === "literal") {
    const formatted = formatRational(evaluateRational(ast));
    const text = latex ? formatted.input.replace(".", "{,}") : formatted.display;
    return { text, precedence: 5 };
  }
  if (ast.type === "power") {
    const base = renderAst(ast.base, latex, 4, "left");
    const baseText = base.precedence < 4 ? wrap(base.text, latex) : base.text;
    return {
      text: latex ? `${baseText}^{${ast.exponent}}` : `${baseText}${superscript(ast.exponent)}`,
      precedence: 4,
    };
  }
  if (ast.type === "root") {
    const inner = renderAst(ast.radicand, latex).text;
    return {
      text: latex
        ? ast.degree === 2 ? `\\sqrt{${inner}}` : `\\sqrt[${ast.degree}]{${inner}}`
        : `${ast.degree === 2 ? "√" : ast.degree === 3 ? "∛" : `√[${ast.degree}]`}${inner}`,
      precedence: 4,
    };
  }
  if (ast.type === "percent-of") {
    const percent = renderAst(ast.percent, latex).text;
    const value = renderAst(ast.value, latex, 4, "right");
    const valueText = value.precedence < 4 ? wrap(value.text, latex) : value.text;
    return {
      text: latex
        ? `${percent}\\%\\;\\text{de}\\;${valueText}`
        : `${percent}% de ${valueText}`,
      precedence: 4,
    };
  }
  if (ast.type === "binary") {
    const precedence = ["mul", "div"].includes(ast.operator) ? 3 : 2;
    const left = renderAst(ast.left, latex, precedence, "left");
    const right = renderAst(ast.right, latex, precedence, "right");
    const leftNeedsParentheses = left.precedence < precedence;
    const rightNeedsParentheses = right.precedence < precedence
      || (right.precedence === precedence && ["sub", "div"].includes(ast.operator));
    const symbols = latex
      ? { add: "+", sub: "-", mul: "\\times", div: "\\div" }
      : { add: "+", sub: "−", mul: "×", div: "÷" };
    const text = `${leftNeedsParentheses ? wrap(left.text, latex) : left.text} ${symbols[ast.operator]} ${rightNeedsParentheses ? wrap(right.text, latex) : right.text}`;
    const wrapped = precedence < parentPrecedence
      || (precedence === parentPrecedence && side === "right" && ["sub", "div"].includes(ast.operator));
    return { text: wrapped ? wrap(text, latex) : text, precedence: wrapped ? 5 : precedence };
  }
  throw new RangeError(`Unknown expression node: ${ast.type}`);
}

function wrap(text, latex) {
  return latex ? `\\left(${text}\\right)` : `(${text})`;
}

function superscript(value) {
  const glyphs = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
  return String(value).split("").map((character) => glyphs[character] ?? character).join("");
}

function serializeAst(ast) {
  if (ast.type === "literal") return `n:${ast.numerator}/${ast.denominator}`;
  if (ast.type === "binary") return `b:${ast.operator}(${serializeAst(ast.left)},${serializeAst(ast.right)})`;
  if (ast.type === "power") return `p:${ast.exponent}(${serializeAst(ast.base)})`;
  if (ast.type === "root") return `r:${ast.degree}(${serializeAst(ast.radicand)})`;
  if (ast.type === "percent-of") return `pct(${serializeAst(ast.percent)},${serializeAst(ast.value)})`;
  throw new RangeError(`Unknown expression node: ${ast.type}`);
}

function collectAstOperations(ast, output = []) {
  if (ast.type === "binary") {
    output.push(ast.operator);
    collectAstOperations(ast.left, output);
    collectAstOperations(ast.right, output);
  } else if (ast.type === "power") {
    output.push("power");
    collectAstOperations(ast.base, output);
  } else if (ast.type === "root") {
    output.push("root");
    collectAstOperations(ast.radicand, output);
  } else if (ast.type === "percent-of") {
    output.push("percent");
    collectAstOperations(ast.percent, output);
    collectAstOperations(ast.value, output);
  }
  return output;
}

function expressionPrecedenceDepth(ast) {
  const tiers = [];
  walkExpression(ast, (node) => {
    if (node.type === "binary") {
      tiers.push(["add", "sub"].includes(node.operator) ? 1 : 2);
    } else if (node.type === "percent-of") {
      tiers.push(2);
    } else if (["power", "root"].includes(node.type)) {
      tiers.push(3);
    }
  });
  return tiers.length ? Math.max(...tiers) - Math.min(...tiers) : 0;
}

function walkExpression(ast, visit) {
  visit(ast);
  if (ast.type === "binary") {
    walkExpression(ast.left, visit);
    walkExpression(ast.right, visit);
  } else if (ast.type === "power") {
    walkExpression(ast.base, visit);
  } else if (ast.type === "root") {
    walkExpression(ast.radicand, visit);
  } else if (ast.type === "percent-of") {
    walkExpression(ast.percent, visit);
    walkExpression(ast.value, visit);
  }
}

function additionMatches(left, right, params) {
  const result = left + right;
  return matchesRange(result, params.result)
    && (params.resultMin == null || result >= params.resultMin)
    && (params.resultMax == null || result <= params.resultMax)
    && matchesRange(countAdditionCarries(left, right), params.carryCount)
    && matchesDigitRange(result, params.resultDigits);
}

function subtractionMatches(left, right, params) {
  const result = left - right;
  const borrows = countSubtractionBorrows(left, right);
  return (!params.resultNonNegative || result >= 0)
    && (!params.mustCrossTen || (left > 10 && left - right < 10))
    && matchesRange(result, params.result)
    && matchesRange(borrows.count, params.borrowCount)
    && (params.cascadeBorrow !== false || borrows.longestChain < 2);
}

function countAdditionCarries(left, right) {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  let carry = 0;
  let count = 0;
  while (a || b || carry) {
    const total = a % 10 + b % 10 + carry;
    carry = total >= 10 ? 1 : 0;
    if (carry) count += 1;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return count;
}

function countSubtractionBorrows(left, right) {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  let borrow = 0;
  let count = 0;
  let chain = 0;
  let longestChain = 0;
  while (a || b) {
    const upper = a % 10 - borrow;
    const lower = b % 10;
    if (upper < lower) {
      borrow = 1;
      count += 1;
      chain += 1;
      longestChain = Math.max(longestChain, chain);
    } else {
      borrow = 0;
      chain = 0;
    }
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return { count, longestChain };
}

function buildNoCarryPair(digits, random) {
  const leftDigits = [];
  const rightDigits = [];
  for (let index = 0; index < digits; index += 1) {
    const top = index === digits - 1;
    const left = randomInt(top ? 1 : 0, top ? 8 : 9, random);
    const right = randomInt(top ? 1 : 0, Math.max(top ? 1 : 0, 9 - left), random);
    leftDigits.push(left);
    rightDigits.push(right);
  }
  return [digitsToNumber(leftDigits), digitsToNumber(rightDigits)];
}

function buildNoBorrowPair(digits, random) {
  const leftDigits = [];
  const rightDigits = [];
  for (let index = 0; index < digits; index += 1) {
    const top = index === digits - 1;
    const right = randomInt(top ? 1 : 0, top ? 8 : 9, random);
    const left = randomInt(Math.max(top ? 1 : 0, right), 9, random);
    leftDigits.push(left);
    rightDigits.push(right);
  }
  return [digitsToNumber(leftDigits), digitsToNumber(rightDigits)];
}

function digitsToNumber(reverseDigits) {
  return reverseDigits.reduce((total, digit, index) => total + digit * 10 ** index, 0);
}

function multiplicationRequires(left, right, required) {
  if (!required?.length) return true;
  return required.some((feature) => {
    if (feature === "factor-two") return left === 2 || right === 2;
    if (feature === "factor-five") return left === 5 || right === 5;
    if (feature === "perfect-square") return left === right;
    return false;
  });
}

function hasExcludedMultiplicationFeature(left, right, excluded = []) {
  const features = new Set();
  if (isPowerOfTen(left) || isPowerOfTen(right)) features.add("power-of-ten");
  if (left === 11 || right === 11) features.add("times-eleven");
  if (Math.floor(left / 10) === Math.floor(right / 10) && left % 10 + right % 10 === 10) features.add("same-tens");
  if (nearPowerOfTen(left) || nearPowerOfTen(right)) features.add("near-power-of-ten");
  if (left === 2 || right === 2) features.add("factor-two");
  if (left === 5 || right === 5) features.add("factor-five");
  if (left === right) features.add("perfect-square");
  return excluded.some((feature) => features.has(feature));
}

function nearPowerOfTen(value) {
  for (let exponent = 1; exponent <= 8; exponent += 1) {
    if (Math.abs(value - 10 ** exponent) <= 2) return true;
  }
  return false;
}

function isPowerOfTen(value) {
  if (!Number.isInteger(value) || value < 1) return false;
  let current = value;
  while (current > 1 && current % 10 === 0) current /= 10;
  return current === 1;
}

function patternProfile(patternId, attempts) {
  const matching = attempts.filter((attempt) => attempt.patternKey === patternId
    || attempt.presetId === patternId
    || attempt.metadata?.catalogPatternId === patternId);
  if (!matching.length) {
    return {
      attempts: 0,
      errorRate: 0,
      averagePaceRatio: null,
      turnsSinceSeen: Number.POSITIVE_INFINITY,
    };
  }
  const wrong = matching.filter((attempt) => !successfulAttempt(attempt)).length;
  const paced = matching.map(readPaceRatio).filter(Number.isFinite);
  const last = matching.at(-1);
  return {
    attempts: matching.length,
    errorRate: wrong / matching.length,
    averagePaceRatio: paced.length
      ? paced.reduce((total, value) => total + value, 0) / paced.length
      : null,
    turnsSinceSeen: Math.max(0, attempts.length - 1 - attempts.indexOf(last)),
  };
}

function attemptMetrics(attempts) {
  if (!attempts.length) return { attempts: 0, accuracy: null, averagePaceRatio: null };
  const successful = attempts.filter(successfulAttempt).length;
  const paced = attempts.map(readPaceRatio).filter(Number.isFinite);
  return {
    attempts: attempts.length,
    accuracy: successful / attempts.length,
    averagePaceRatio: paced.length
      ? paced.reduce((total, value) => total + value, 0) / paced.length
      : null,
  };
}

function successfulAttempt(attempt) {
  return Boolean(attempt?.correct && !attempt.timedOut && !attempt.revealed && !attempt.skipped);
}

function readPaceRatio(attempt) {
  const explicit = Number(attempt?.paceRatio);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const response = Number(attempt?.responseTimeMs);
  const target = Number(attempt?.targetResponseMs ?? attempt?.responseWindowMs);
  return Number.isFinite(response) && Number.isFinite(target) && target > 0
    ? response / target
    : NaN;
}

function orderedAttempts(value) {
  const attempts = Array.isArray(value) ? value.filter(isPlainObject) : [];
  return attempts.map((attempt, index) => ({ attempt, index }))
    .sort((left, right) => {
      const leftTime = finiteNumber(left.attempt.timestamp ?? left.attempt.answeredAt, NaN);
      const rightTime = finiteNumber(right.attempt.timestamp ?? right.attempt.answeredAt, NaN);
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return left.index - right.index;
    })
    .map(({ attempt }) => attempt);
}

function deduplicateAttempts(attempts) {
  const seen = new Set();
  return attempts.filter((attempt) => {
    const id = typeof attempt?.id === "string" && attempt.id ? `id:${attempt.id}` : null;
    const sessionTimestamp = attempt?.sessionId && Number.isFinite(Number(attempt?.timestamp))
      ? `session:${attempt.sessionId}:${attempt.timestamp}:${attempt.questionId ?? ""}`
      : null;
    const key = id ?? sessionTimestamp;
    if (key == null) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolvePattern(patternOrId, catalog) {
  if (typeof patternOrId === "string") {
    const pattern = catalog.patterns.find((candidate) => candidate.id === patternOrId);
    if (!pattern) throw new RangeError(`Unknown Insane Mix pattern: ${patternOrId}`);
    return pattern;
  }
  if (!isPlainObject(patternOrId) || !catalog.patterns.some((pattern) => pattern.id === patternOrId.id)) {
    throw new TypeError("A catalog pattern or pattern id is required");
  }
  return patternOrId;
}

function sampleInteger(specification, random) {
  if (Number.isFinite(specification)) return Math.trunc(specification);
  if (Array.isArray(specification)) return Math.trunc(choose(specification, random));
  if (!isPlainObject(specification)) throw new TypeError("Expected an integer or range");
  return randomInt(Math.ceil(specification.min), Math.floor(specification.max), random);
}

function randomWithDigits(digits, random) {
  const count = clamp(Math.round(digits), 1, 15);
  const minimum = count === 1 ? 1 : 10 ** (count - 1);
  const maximum = Math.min(Number.MAX_SAFE_INTEGER, 10 ** count - 1);
  return randomInt(minimum, maximum, random);
}

function randomScaledDecimal(integerDigits, scale, random) {
  const factor = 10 ** scale;
  const minimum = integerDigits === 1 ? factor : 10 ** (integerDigits - 1) * factor;
  const maximum = (10 ** integerDigits - 1) * factor + factor - 1;
  return randomInt(minimum, maximum, random);
}

function randomInt(minimum, maximum, random) {
  const min = Math.ceil(Math.min(minimum, maximum));
  const max = Math.floor(Math.max(minimum, maximum));
  return min + Math.floor(normalizedRandom(random()) * (max - min + 1));
}

function retryValues(factory, predicate, attempts = 240, fallback = null) {
  for (let index = 0; index < attempts; index += 1) {
    const value = factory();
    if (predicate(value)) return value;
  }
  if (fallback != null) return fallback;
  throw new RangeError("Could not satisfy generator constraints");
}

function choose(values, random) {
  if (!Array.isArray(values) || !values.length) throw new RangeError("Cannot sample an empty list");
  return values[randomInt(0, values.length - 1, random)];
}

function matchesRange(value, specification) {
  if (specification == null) return true;
  if (Number.isFinite(specification)) return value === Number(specification);
  return value >= specification.min && value <= specification.max;
}

function matchesDigitRange(value, specification) {
  if (specification == null) return true;
  return matchesRange(String(Math.abs(Math.trunc(value))).length, specification);
}

function rangeIncludesOnly(specification, value) {
  return Number.isFinite(specification)
    ? Number(specification) === value
    : specification?.min === value && specification?.max === value;
}

function compareRationalAbsolute(left, right) {
  const a = (left.numerator < 0n ? -left.numerator : left.numerator) * right.denominator;
  const b = (right.numerator < 0n ? -right.numerator : right.numerator) * left.denominator;
  return a < b ? -1 : a > b ? 1 : 0;
}

function absoluteDigitCount(value) {
  return (value < 0n ? -value : value).toString().length;
}

function gcd(left, right) {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}

function stableHash(value) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function hashSeed(seed) {
  const value = String(seed ?? "insane-mix");
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function resolveRandom(options) {
  if (options.random != null) {
    if (typeof options.random !== "function") throw new TypeError("random must be a function");
    return options.random;
  }
  return options.seed == null ? Math.random : createInsaneMixRandom(options.seed);
}

function normalizedRandom(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return clamp(numeric, 0, 0.9999999999999999);
}

function assertUniqueId(value, ids, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} needs an id`);
  if (ids.has(value)) throw new RangeError(`Duplicate ${label} id: ${value}`);
  ids.add(value);
}

function assertObject(value, label) {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be an object`);
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== "string" || !item)) {
    throw new TypeError(`${label} must be a non-empty string array`);
  }
}

function assertFiniteRange(minimum, maximum, label) {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) {
    throw new TypeError(`${label} must contain a valid min/max range`);
  }
}

function validateRangeObjects(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateRangeObjects(entry, `${label}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  const hasMinimum = Object.prototype.hasOwnProperty.call(value, "min");
  const hasMaximum = Object.prototype.hasOwnProperty.call(value, "max");
  if (hasMinimum || hasMaximum) {
    if (!hasMinimum || !hasMaximum) {
      throw new TypeError(`${label} range must define both min and max`);
    }
    assertFiniteRange(value.min, value.max, label);
  }
  for (const [key, child] of Object.entries(value)) {
    validateRangeObjects(child, `${label}.${key}`);
  }
}

function validateMinimumConstraint(value, label, maximum) {
  if (value == null) return;
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new RangeError(`${label} must be an integer from 0 to ${maximum}`);
  }
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function finiteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value, precision = 6) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
