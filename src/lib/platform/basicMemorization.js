const OPERATIONS = ["multiplication", "addition", "subtraction"];
const DIGIT_PRESETS = ["one-digit", "two-digits"];
const MULTIPLICATION_PRESET_IDS = [
  "all",
  "no-squares",
  "six-to-nine",
  "above-three",
];

export const BASIC_OPERATIONS = Object.freeze({
  MULTIPLICATION: "multiplication",
  ADDITION: "addition",
  SUBTRACTION: "subtraction",
});

export const BASIC_MULTIPLICATION_PRESETS = Object.freeze([
  Object.freeze({
    id: "all",
    label: "Todos",
    description: "Todas as contas das tabuadas de 0 a 10.",
  }),
  Object.freeze({
    id: "no-squares",
    label: "Sem quadrados",
    description: "Retira fatos como 6 × 6 e 7 × 7.",
  }),
  Object.freeze({
    id: "six-to-nine",
    label: "Só 6, 7, 8 e 9",
    description: "Mantém 6, 7, 8 ou 9 como a tabuada à esquerda.",
  }),
  Object.freeze({
    id: "above-three",
    label: "Multiplicadores acima de 3",
    description: "Retira ×0, ×1, ×2 e ×3 de cada tabuada escolhida.",
  }),
]);

export const BASIC_SIZE_PRESETS = Object.freeze([
  Object.freeze({ id: "one-digit", label: "1 dígito" }),
  Object.freeze({ id: "two-digits", label: "2 dígitos" }),
]);

export const MEMORIZATION_OPERATIONS = Object.freeze([
  Object.freeze({
    id: BASIC_OPERATIONS.MULTIPLICATION,
    label: "Tabuada",
    description: "Multiplicações de 0 a 10 para responder sem reconstruir a conta.",
    sectionId: "tabuada",
    symbol: "×",
  }),
  Object.freeze({
    id: BASIC_OPERATIONS.ADDITION,
    label: "Adição",
    description: "Somas que precisam ficar disponíveis de imediato.",
    sectionId: "adicao",
    symbol: "+",
  }),
  Object.freeze({
    id: BASIC_OPERATIONS.SUBTRACTION,
    label: "Subtração",
    description: "Diferenças diretas e empréstimos graduais.",
    sectionId: "subtracao",
    symbol: "−",
  }),
]);

const MEMORIZATION_PRESETS = Object.freeze({
  [BASIC_OPERATIONS.MULTIPLICATION]: BASIC_MULTIPLICATION_PRESETS,
  [BASIC_OPERATIONS.ADDITION]: Object.freeze([
    Object.freeze({
      id: "one-digit",
      label: "1 dígito",
      description: "Somas que passam de 10, como 8 + 7 e 7 + 8.",
    }),
    Object.freeze({
      id: "two-digits",
      label: "2 dígitos",
      description: "Sem vai um, vai um nas unidades e vai um duplo.",
    }),
  ]),
  [BASIC_OPERATIONS.SUBTRACTION]: Object.freeze([
    Object.freeze({
      id: "one-digit",
      label: "1 dígito",
      description: "Diferenças positivas, sem retirar zero nem repetir o mesmo número.",
    }),
    Object.freeze({
      id: "two-digits",
      label: "2 dígitos",
      description: "Sem empréstimo, empréstimo nas unidades e em cascata.",
    }),
  ]),
});

export const BASIC_TIME_LEVELS = Object.freeze([
  Object.freeze({
    id: "calm",
    label: "Com calma",
    description: "Mais tempo para consolidar o caminho mental.",
    multiplier: 1.45,
  }),
  Object.freeze({
    id: "steady",
    label: "Ritmo confortável",
    description: "Pressão leve, sem exigir resposta instantânea.",
    multiplier: 1.15,
  }),
  Object.freeze({
    id: "challenge",
    label: "Desafio",
    description: "Tempo curto para fatos que já estão ficando automáticos.",
    multiplier: 0.9,
  }),
  Object.freeze({
    id: "reflex",
    label: "Reflexo",
    description: "Ritmo de recuperação imediata da memória.",
    multiplier: 0.68,
  }),
]);

export const MEMORIZATION_TIME_LEVELS = BASIC_TIME_LEVELS;

const TIME_LEVEL_BY_ID = new Map(BASIC_TIME_LEVELS.map((level) => [level.id, level]));

const NOTICES = Object.freeze({
  "unity-overflow": Object.freeze({
    code: "unity-overflow",
    label: "Vai um nas unidades",
    technicalLabel: "Unity overflow",
    durationMs: 1_200,
    presentation: "toast",
    politeness: "polite",
  }),
  "double-overflow": Object.freeze({
    code: "double-overflow",
    label: "Vai um duplo",
    technicalLabel: "Double overflow",
    durationMs: 1_350,
    presentation: "toast",
    politeness: "polite",
  }),
  "unity-borrow": Object.freeze({
    code: "unity-borrow",
    label: "Empréstimo nas unidades",
    technicalLabel: "Unity borrow",
    durationMs: 1_200,
    presentation: "toast",
    politeness: "polite",
  }),
  "cascade-borrow": Object.freeze({
    code: "cascade-borrow",
    label: "Empréstimo em cascata",
    technicalLabel: "Cascade borrow",
    durationMs: 1_350,
    presentation: "toast",
    politeness: "polite",
  }),
});

const TIERS = Object.freeze({
  recall: tier("recall", "Recuperação direta", 1, 4_500),
  "cross-ten": tier("cross-ten", "Passa de 10", 1, 4_800),
  "basic-difference": tier("basic-difference", "Diferença direta", 1, 4_800),
  "no-overflow": tier("no-overflow", "Sem vai um", 1, 8_500),
  "unity-overflow": tier(
    "unity-overflow",
    "Vai um nas unidades",
    2,
    10_000,
    NOTICES["unity-overflow"],
  ),
  "double-overflow": tier(
    "double-overflow",
    "Vai um duplo",
    3,
    11_500,
    NOTICES["double-overflow"],
  ),
  "no-borrow": tier("no-borrow", "Sem empréstimo", 1, 8_500),
  "unity-borrow": tier(
    "unity-borrow",
    "Empréstimo nas unidades",
    2,
    10_000,
    NOTICES["unity-borrow"],
  ),
  "cascade-borrow": tier(
    "cascade-borrow",
    "Empréstimo em cascata",
    3,
    11_500,
    NOTICES["cascade-borrow"],
  ),
});

export const BASIC_DIFFICULTY_TIERS = Object.freeze(
  Object.values(TIERS).map((definition) => Object.freeze({ ...definition })),
);

/**
 * Normalizes the data-only configuration consumed by the candidate catalog.
 * Multiplication filters are intersections, so presets can be freely combined.
 */
export function createBasicTrainingConfig(rawConfig = {}) {
  const operation = rawConfig.operation ?? BASIC_OPERATIONS.MULTIPLICATION;
  assertOneOf(operation, OPERATIONS, "operation");

  const timeLevel = rawConfig.timeLevel ?? "steady";
  assertOneOf(timeLevel, BASIC_TIME_LEVELS.map((level) => level.id), "timeLevel");

  const difficultyMode = rawConfig.difficultyMode ?? "adaptive";
  assertOneOf(difficultyMode, ["adaptive", "fixed"], "difficultyMode");

  if (operation === BASIC_OPERATIONS.MULTIPLICATION) {
    const requestedPresetIds = normalizePresetIds(rawConfig);
    const presetIds = requestedPresetIds.length > 1
      ? requestedPresetIds.filter((id) => id !== "all")
      : requestedPresetIds;

    presetIds.forEach((presetId) =>
      assertOneOf(presetId, MULTIPLICATION_PRESET_IDS, "presetIds"),
    );

    return {
      operation,
      presetIds: presetIds.length ? presetIds : ["all"],
      tables: normalizeIntegerList(rawConfig.tables, 0, 10),
      multipliers: normalizeIntegerList(rawConfig.multipliers, 0, 10),
      minimumMultiplier: normalizeBoundedInteger(
        rawConfig.minimumMultiplier ?? rawConfig.minimumFactor,
        0,
        10,
        0,
      ),
      excludeSquares: Boolean(rawConfig.excludeSquares),
      timeLevel,
      difficultyMode,
      difficultyTier: rawConfig.difficultyTier ?? "all",
    };
  }

  const presetId = rawConfig.presetId ?? presetFromDigits(rawConfig.digits);
  assertOneOf(presetId, DIGIT_PRESETS, "presetId");

  return {
    operation,
    presetId,
    timeLevel,
    difficultyMode,
    difficultyTier: rawConfig.difficultyTier ?? "all",
    includeHundredBridge:
      operation === BASIC_OPERATIONS.SUBTRACTION && presetId === "two-digits"
        ? rawConfig.includeHundredBridge !== false
        : false,
  };
}

/** Builds a stable, de-duplicated catalog. No browser or storage API is used. */
export function buildBasicCandidates(rawConfig = {}) {
  const config = createBasicTrainingConfig(rawConfig);

  switch (config.operation) {
    case BASIC_OPERATIONS.MULTIPLICATION:
      return buildMultiplicationCandidates(config);
    case BASIC_OPERATIONS.ADDITION:
      return config.presetId === "one-digit"
        ? buildOneDigitAdditionCandidates(config)
        : buildTwoDigitAdditionCandidates(config);
    case BASIC_OPERATIONS.SUBTRACTION:
      return config.presetId === "one-digit"
        ? buildOneDigitSubtractionCandidates(config)
        : buildTwoDigitSubtractionCandidates(config);
    default:
      return [];
  }
}

/** Presets ready for controls; the returned definitions are immutable. */
export function getMemorizationPresets(operationId) {
  const operation = normalizeOperationId(operationId);
  return MEMORIZATION_PRESETS[operation];
}

/**
 * Compatibility facade for `useTrainingSession`.
 *
 * `attempts` normally contains persisted attempts and `sessionAttempts` the
 * current run. Both accept the existing platform attempt contract.
 */
export function selectMemorizationQuestion({
  operationId = BASIC_OPERATIONS.MULTIPLICATION,
  presetId,
  presetIds,
  attempts = [],
  sessionAttempts = [],
  recentQuestionIds = [],
  random,
  seed,
  now = Date.now(),
  timeLevel = "steady",
  difficultyMode = "adaptive",
  difficultyTier = "all",
  tables,
  multipliers,
  minimumMultiplier,
  minimumFactor,
  excludeSquares,
  includeHundredBridge,
} = {}) {
  const operation = normalizeOperationId(operationId);
  const config = createBasicTrainingConfig({
    operation,
    ...(operation === BASIC_OPERATIONS.MULTIPLICATION
      ? {
          presetIds: normalizeFacadePresetIds(presetIds ?? presetId),
          tables,
          multipliers,
          minimumMultiplier: minimumMultiplier ?? minimumFactor,
          excludeSquares,
        }
      : { presetId: presetId ?? "one-digit", includeHundredBridge }),
    timeLevel,
    difficultyMode,
    difficultyTier,
  });
  const candidates = buildBasicCandidates(config);
  const history = mergeAttemptHistory(attempts, sessionAttempts);
  const selectionOptions = {
    random,
    seed,
    now,
    difficultyMode,
    difficultyTier,
    excludeCandidateIds: recentQuestionIds,
  };
  let selection = selectBasicCandidate(candidates, history, selectionOptions);

  // Small custom catalogs can temporarily exhaust a recent-ID exclusion list.
  if (!selection.candidate && recentQuestionIds.length) {
    selection = selectBasicCandidate(candidates, history, {
      ...selectionOptions,
      excludeCandidateIds: [],
    });
  }

  if (!selection.candidate) {
    return null;
  }

  return materializeMemorizationQuestion(selection.candidate, selection.progression);
}

/**
 * Produces the attempt shape expected by the adaptive selector.
 * `correct` can be supplied or inferred from `answerGiven`.
 */
export function createBasicAttempt(candidate, rawAttempt = {}) {
  assertCandidate(candidate);

  const answeredAt = finiteNumber(
    rawAttempt.answeredAt ?? rawAttempt.timestamp,
    Date.now(),
  );
  const responseTimeMs = positiveNumberOrNull(rawAttempt.responseTimeMs);
  const timedOut =
    Boolean(rawAttempt.timedOut) ||
    (responseTimeMs != null && responseTimeMs > candidate.responseWindowMs);
  const correct =
    typeof rawAttempt.correct === "boolean"
      ? rawAttempt.correct
      : Number(rawAttempt.answerGiven) === candidate.answer;

  return {
    id: rawAttempt.id ?? `${candidate.id}:${answeredAt}`,
    candidateId: candidate.id,
    skillKey: candidate.skillKey,
    operation: candidate.operation,
    presetId: candidate.presetId,
    difficultyTier: candidate.difficultyTier,
    difficultyRank: candidate.difficultyRank,
    answerGiven: rawAttempt.answerGiven ?? null,
    expectedAnswer: candidate.answer,
    correct,
    timedOut,
    responseTimeMs,
    targetResponseMs: candidate.targetResponseMs,
    responseWindowMs: candidate.responseWindowMs,
    answeredAt,
  };
}

/**
 * Resolves the current cognitive tier. In adaptive mode, mastered tiers unlock the
 * next one; a recent collapse temporarily moves the learner one tier down.
 */
export function resolveBasicProgression(candidates, rawHistory = [], options = {}) {
  const context = createHistoryContext(candidates, rawHistory);
  const tiers = uniqueTiers(candidates);
  const difficultyMode = options.difficultyMode ?? "adaptive";
  assertOneOf(difficultyMode, ["adaptive", "fixed"], "difficultyMode");

  if (!tiers.length) {
    return {
      mode: difficultyMode,
      activeTierId: null,
      activeRank: null,
      eligibleTierIds: [],
      metricsByTier: {},
      reason: "empty-catalog",
    };
  }

  const metricsByTier = Object.fromEntries(
    tiers.map((definition) => [
      definition.id,
      buildTierMetrics(context.attemptsByTier.get(definition.id) ?? [], options),
    ]),
  );

  if (difficultyMode === "fixed") {
    const requestedTier = options.difficultyTier ?? "all";

    if (requestedTier !== "all" && !tiers.some((definition) => definition.id === requestedTier)) {
      throw new RangeError(`Unknown difficultyTier: ${requestedTier}`);
    }

    const eligibleTierIds = requestedTier === "all"
      ? tiers.map((definition) => definition.id)
      : [requestedTier];
    const activeTier = requestedTier === "all"
      ? tiers.at(-1)
      : tiers.find((definition) => definition.id === requestedTier);

    return {
      mode: "fixed",
      activeTierId: activeTier.id,
      activeRank: activeTier.rank,
      eligibleTierIds,
      metricsByTier,
      reason: requestedTier === "all" ? "all-tiers" : "fixed-tier",
    };
  }

  let frontierIndex = 0;

  for (let index = 0; index < tiers.length - 1; index += 1) {
    const current = tiers[index];

    if (tierIsMastered(metricsByTier[current.id], options)) {
      frontierIndex = index + 1;
      continue;
    }

    break;
  }

  let reason = frontierIndex ? "tier-unlocked" : "building-foundation";
  const recent = context.orderedAttempts.slice(-(options.regressionWindow ?? 6));

  if (frontierIndex > 0 && learnerNeedsRelief(recent, options)) {
    frontierIndex -= 1;
    reason = "recent-struggle";
  }

  const activeTier = tiers[frontierIndex];

  return {
    mode: "adaptive",
    activeTierId: activeTier.id,
    activeRank: activeTier.rank,
    eligibleTierIds: tiers
      .filter((definition) => definition.rank <= activeTier.rank)
      .map((definition) => definition.id),
    metricsByTier,
    reason,
  };
}

/** Returns candidates ordered by review urgency, with diagnostics for reports/tests. */
export function rankBasicCandidates(candidates, rawHistory = [], options = {}) {
  if (!Array.isArray(candidates)) {
    throw new TypeError("candidates must be an array");
  }

  const progression = resolveBasicProgression(candidates, rawHistory, options);
  const context = createHistoryContext(candidates, rawHistory);
  const eligibleTierIds = new Set(progression.eligibleTierIds);
  const excludedCandidateKeys = expandCandidateExclusions(
    candidates,
    options.excludeCandidateIds,
  );
  const now = finiteNumber(options.now, Date.now());
  const eligibleVariantCounts = countVariantsBySkill(
    candidates.filter((candidate) => eligibleTierIds.has(candidate.difficultyTier)),
  );

  return candidates
    .filter(
      (candidate) =>
        eligibleTierIds.has(candidate.difficultyTier) &&
        !excludedCandidateKeys.has(candidate.id) &&
        !excludedCandidateKeys.has(candidate.questionId) &&
        !excludedCandidateKeys.has(candidate.variantKey) &&
        !excludedCandidateKeys.has(candidate.skillKey),
    )
    .map((candidate, sourceIndex) => {
      const profile = buildCandidateProfile(
        context.attemptsBySkill.get(candidate.skillKey) ?? [],
        context.orderedAttempts,
      );
      const tierMultiplier =
        progression.mode === "adaptive" &&
        candidate.difficultyTier === progression.activeTierId
          ? 1.3
          : 1;
      const variantCount = eligibleVariantCounts.get(candidate.skillKey) ?? 1;
      const weight = roundWeight(
        (scoreBasicCandidate(candidate, profile, { now }) * tierMultiplier) / variantCount,
      );

      return { candidate, weight, profile, sourceIndex, progression };
    })
    .sort((left, right) =>
      right.weight - left.weight ||
      left.sourceIndex - right.sourceIndex ||
      left.candidate.id.localeCompare(right.candidate.id),
    );
}

/**
 * Weighted adaptive selection. Supply either `random` or `seed` for deterministic
 * behavior. Even mastered facts retain a small, non-zero review probability.
 */
export function selectBasicCandidate(candidates, rawHistory = [], options = {}) {
  const ranked = rankBasicCandidates(candidates, rawHistory, options);

  if (!ranked.length) {
    return {
      candidate: null,
      weight: 0,
      profile: null,
      progression: resolveBasicProgression(candidates, rawHistory, options),
      ranked: [],
    };
  }

  const random = resolveRandom(options);
  const totalWeight = ranked.reduce((total, entry) => total + entry.weight, 0);
  let threshold = normalizeRandomValue(random()) * totalWeight;
  let selected = ranked.at(-1);

  for (const entry of ranked) {
    threshold -= entry.weight;

    if (threshold <= 0) {
      selected = entry;
      break;
    }
  }

  return {
    candidate: selected.candidate,
    weight: selected.weight,
    profile: selected.profile,
    progression: selected.progression,
    ranked,
  };
}

/** Public for explainable reports and focused unit tests. */
export function scoreBasicCandidate(candidate, profile, { now = Date.now() } = {}) {
  assertCandidate(candidate);
  const safeProfile = profile ?? emptyCandidateProfile();

  if (!safeProfile.attempts) {
    return 2.1;
  }

  const recentErrorPressure = safeProfile.recentErrorRate * 7;
  const historicalErrorPressure = safeProfile.errorRate * 6;
  const lastErrorPressure = safeProfile.lastAttempt?.successful === false ? 3.2 : 0;
  const slowPressure = clamp((safeProfile.paceRatio ?? 0.55) - 0.48, 0, 1.7) * 5.2;
  const staleByTurns = clamp(safeProfile.turnsSinceSeen / 12, 0, 1.4);
  const staleByTime = safeProfile.lastSeenAt
    ? clamp((now - safeProfile.lastSeenAt) / (30 * 60_000), 0, 1.5)
    : 1;
  const masteryRelief =
    safeProfile.accuracy >= 0.9 && (safeProfile.paceRatio ?? 1) <= 0.58
      ? 4.5
      : 0;
  const streakRelief = Math.min(safeProfile.fastSuccessStreak * 0.65, 4);
  const numerator =
    0.42 +
    recentErrorPressure +
    historicalErrorPressure +
    lastErrorPressure +
    slowPressure +
    staleByTurns +
    staleByTime;
  const denominator = 1 + masteryRelief + streakRelief;
  const recencyMultiplier = recencyMultiplierFor(safeProfile);

  return Math.max(0.06, (numerator / denominator) * recencyMultiplier);
}

/** Small deterministic PRNG (string or numeric seed) for tests and replayable sessions. */
export function createSeededRandom(seed) {
  let state = hashSeed(seed);

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function getBasicTimeLevel(timeLevelId) {
  return TIME_LEVEL_BY_ID.get(timeLevelId) ?? null;
}

function materializeMemorizationQuestion(candidate, progression) {
  const operation = MEMORIZATION_OPERATIONS.find(({ id }) => id === candidate.operation);
  const patternTags = [
    "memorizar-basico",
    candidate.operation,
    candidate.presetId,
    candidate.difficultyTier,
    ...Object.entries(candidate.features ?? {})
      .filter(([, enabled]) => enabled === true)
      .map(([feature]) => camelToKebab(feature)),
  ];

  return {
    questionId: candidate.id,
    id: candidate.id,
    variantKey: candidate.variantKey,
    sectionId: operation.sectionId,
    groupId: "memorizar-basico",
    presetId: candidate.presetId,
    patternKey: `memorizar:${candidate.operation}:${candidate.difficultyTier}`,
    patternTags: [...new Set(patternTags)],
    skillKey: candidate.skillKey,
    prompt: candidate.prompt,
    promptLatex: `${candidate.left} ${latexOperator(candidate.operation)} ${candidate.right}`,
    answer: candidate.answer,
    answerDisplay: String(candidate.answer),
    answerInput: String(candidate.answer),
    answerType: "exact-number",
    acceptsDecimal: false,
    difficulty: Math.min(10, candidate.difficultyRank * 2 + 1),
    targetResponseMs: candidate.targetResponseMs,
    responseWindowMs: candidate.responseWindowMs,
    source: "generated",
    sourceId: candidate.id,
    sourceDocumentId: "memorizar-basico",
    levelCue: candidate.notice ? { ...candidate.notice } : null,
    timeLevel: candidate.timeLevel,
    memorization: {
      operation: candidate.operation,
      scope: candidate.scope,
      difficultyTier: candidate.difficultyTier,
      difficultyLabel: candidate.difficultyLabel,
      activeTierId: progression.activeTierId,
      progressionReason: progression.reason,
      features: { ...candidate.features },
    },
  };
}

function normalizeOperationId(operationId) {
  const aliases = {
    multiplication: BASIC_OPERATIONS.MULTIPLICATION,
    tabuada: BASIC_OPERATIONS.MULTIPLICATION,
    addition: BASIC_OPERATIONS.ADDITION,
    adicao: BASIC_OPERATIONS.ADDITION,
    "adição": BASIC_OPERATIONS.ADDITION,
    subtraction: BASIC_OPERATIONS.SUBTRACTION,
    subtracao: BASIC_OPERATIONS.SUBTRACTION,
    "subtração": BASIC_OPERATIONS.SUBTRACTION,
  };
  const normalized = aliases[String(operationId ?? "").toLowerCase()];

  if (!normalized) {
    throw new RangeError(`Unknown operationId: ${operationId}`);
  }

  return normalized;
}

function normalizeFacadePresetIds(value) {
  if (value == null || value === "") {
    return ["all"];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return String(value).split("+").filter(Boolean);
}

function mergeAttemptHistory(...collections) {
  const merged = collections.flatMap((collection) =>
    Array.isArray(collection) ? collection : [],
  );
  const seenIds = new Set();

  return merged.filter((attempt) => {
    if (!attempt?.id) {
      return true;
    }

    if (seenIds.has(attempt.id)) {
      return false;
    }

    seenIds.add(attempt.id);
    return true;
  });
}

function latexOperator(operation) {
  if (operation === BASIC_OPERATIONS.MULTIPLICATION) {
    return "\\times";
  }

  return operation === BASIC_OPERATIONS.SUBTRACTION ? "-" : "+";
}

function camelToKebab(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function buildMultiplicationCandidates(config) {
  const presets = new Set(config.presetIds);
  const selectedTables = (config.tables ?? integerRange(0, 10))
    .filter((table) => !presets.has("six-to-nine") || isSixToNine(table));
  const selectedMultipliers = config.multipliers ?? integerRange(0, 10);
  const minimumMultiplier = Math.max(
    config.minimumMultiplier,
    presets.has("above-three") ? 4 : 0,
  );
  const excludeSquares = config.excludeSquares || presets.has("no-squares");
  const candidates = [];

  for (const table of selectedTables) {
    for (const multiplier of selectedMultipliers) {
      if (multiplier < minimumMultiplier) {
        continue;
      }

      if (excludeSquares && table === multiplier) {
        continue;
      }

      const skillKey = commutativeSkillKey("mul", table, multiplier);
      candidates.push(
        makeCandidate({
          operation: config.operation,
          presetId: config.presetIds.join("+"),
          skillKey,
          left: table,
          right: multiplier,
          operator: "×",
          answer: table * multiplier,
          tierDefinition: TIERS.recall,
          timeLevel: config.timeLevel,
          scope: "tabuada-0-10",
          features: {
            square: table === multiplier,
            selectedTable: table,
          },
        }),
      );
    }
  }

  return candidates;
}

function buildOneDigitAdditionCandidates(config) {
  const candidates = [];

  for (let left = 1; left <= 9; left += 1) {
    for (let right = 1; right <= 9; right += 1) {
      if (left + right <= 10) {
        continue;
      }

      candidates.push(
        makeCandidate({
          operation: config.operation,
          presetId: config.presetId,
          skillKey: commutativeSkillKey("add", left, right),
          left,
          right,
          operator: "+",
          answer: left + right,
          tierDefinition: TIERS["cross-ten"],
          timeLevel: config.timeLevel,
          scope: "one-digit",
          features: { crossesTen: true },
        }),
      );
    }
  }

  return candidates;
}

function buildTwoDigitAdditionCandidates(config) {
  const candidates = [];

  for (let left = 11; left <= 99; left += 1) {
    if (left % 10 === 0) {
      continue;
    }

    for (let right = 11; right <= 99; right += 1) {
      if (right % 10 === 0) {
        continue;
      }

      const onesOverflow = left % 10 + (right % 10) >= 10;
      const tensTotal = Math.floor(left / 10) + Math.floor(right / 10) + (onesOverflow ? 1 : 0);
      const tierDefinition = !onesOverflow
        ? TIERS["no-overflow"]
        : tensTotal >= 10
          ? TIERS["double-overflow"]
          : TIERS["unity-overflow"];

      candidates.push(
        makeCandidate({
          operation: config.operation,
          presetId: config.presetId,
          skillKey: commutativeSkillKey("add", left, right),
          left,
          right,
          operator: "+",
          answer: left + right,
          tierDefinition,
          timeLevel: config.timeLevel,
          scope: "two-digits",
          features: {
            onesOverflow,
            tensOverflow: tensTotal >= 10,
          },
        }),
      );
    }
  }

  return candidates;
}

function buildOneDigitSubtractionCandidates(config) {
  const candidates = [];

  for (let left = 2; left <= 9; left += 1) {
    for (let right = 1; right < left; right += 1) {
      candidates.push(
        makeCandidate({
          operation: config.operation,
          presetId: config.presetId,
          skillKey: orderedSkillKey("sub", left, right),
          left,
          right,
          operator: "−",
          answer: left - right,
          tierDefinition: TIERS["basic-difference"],
          timeLevel: config.timeLevel,
          scope: "one-digit",
          features: { nonNegative: true },
        }),
      );
    }
  }

  return candidates;
}

function buildTwoDigitSubtractionCandidates(config) {
  const candidates = [];

  for (let left = 11; left <= 99; left += 1) {
    for (let right = 10; right < left; right += 1) {
      const needsBorrow = left % 10 < right % 10;
      const tierDefinition = needsBorrow ? TIERS["unity-borrow"] : TIERS["no-borrow"];

      candidates.push(
        makeCandidate({
          operation: config.operation,
          presetId: config.presetId,
          skillKey: orderedSkillKey("sub", left, right),
          left,
          right,
          operator: "−",
          answer: left - right,
          tierDefinition,
          timeLevel: config.timeLevel,
          scope: "two-digits",
          features: { needsBorrow, cascadeBorrow: false },
        }),
      );
    }
  }

  // 100 is the natural boundary exercise for a real cascade through a zero.
  // It stays in this preset because both the subtrahend and the result have at
  // most two digits; `boundaryBridge` makes the exception explicit to consumers.
  if (config.includeHundredBridge) {
    for (let right = 11; right <= 99; right += 1) {
      if (right % 10 === 0) {
        continue;
      }

      candidates.push(
        makeCandidate({
          operation: config.operation,
          presetId: config.presetId,
          skillKey: orderedSkillKey("sub", 100, right),
          left: 100,
          right,
          operator: "−",
          answer: 100 - right,
          tierDefinition: TIERS["cascade-borrow"],
          timeLevel: config.timeLevel,
          scope: "two-digits",
          features: {
            needsBorrow: true,
            cascadeBorrow: true,
            boundaryBridge: true,
          },
        }),
      );
    }
  }

  return candidates;
}

function makeCandidate({
  operation,
  presetId,
  skillKey,
  left,
  right,
  operator,
  answer,
  tierDefinition,
  timeLevel,
  scope,
  features,
}) {
  const responseWindowMs = resolveResponseWindowMs(tierDefinition, timeLevel);
  const targetResponseMs = tierDefinition.baseWindowMs;
  const operationPrefix = skillKey.split(":", 1)[0];
  const variantKey = orderedSkillKey(operationPrefix, left, right);

  return {
    id: `basic:${variantKey}`,
    variantKey,
    skillKey,
    operation,
    presetId,
    scope,
    left,
    right,
    operator,
    answer,
    prompt: `${left} ${operator} ${right}`,
    difficultyTier: tierDefinition.id,
    difficultyLabel: tierDefinition.label,
    difficultyRank: tierDefinition.rank,
    notice: tierDefinition.notice ? { ...tierDefinition.notice } : null,
    timeLevel,
    targetResponseMs,
    responseWindowMs,
    features,
  };
}

function resolveResponseWindowMs(tierDefinition, timeLevelId) {
  const level = TIME_LEVEL_BY_ID.get(timeLevelId);
  return Math.max(1_800, Math.round((tierDefinition.baseWindowMs * level.multiplier) / 250) * 250);
}

function createHistoryContext(candidates, rawHistory) {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const candidateBySkill = new Map(candidates.map((candidate) => [candidate.skillKey, candidate]));
  const normalized = (Array.isArray(rawHistory) ? rawHistory : [])
    .map((attempt, sourceIndex) => normalizeAttempt(
      attempt,
      sourceIndex,
      candidateById,
      candidateBySkill,
    ))
    .filter(Boolean)
    .sort(compareAttempts);
  const attemptsBySkill = new Map();
  const attemptsByTier = new Map();

  normalized.forEach((attempt, orderedIndex) => {
    attempt.orderedIndex = orderedIndex;
    appendToMap(attemptsBySkill, attempt.skillKey, attempt);
    appendToMap(attemptsByTier, attempt.difficultyTier, attempt);
  });

  return {
    orderedAttempts: normalized,
    attemptsBySkill,
    attemptsByTier,
  };
}

function normalizeAttempt(rawAttempt, sourceIndex, candidateById, candidateBySkill) {
  if (!rawAttempt || typeof rawAttempt !== "object") {
    return null;
  }

  const candidate = candidateById.get(rawAttempt.candidateId) ??
    candidateById.get(rawAttempt.questionId) ??
    candidateBySkill.get(rawAttempt.skillKey);

  if (!candidate) {
    return null;
  }

  const responseWindowMs = positiveNumberOrNull(rawAttempt.responseWindowMs) ??
    candidate.responseWindowMs;
  const targetResponseMs = positiveNumberOrNull(rawAttempt.targetResponseMs) ??
    candidate.targetResponseMs ??
    responseWindowMs;
  const responseTimeMs = positiveNumberOrNull(rawAttempt.responseTimeMs);
  const timedOut =
    Boolean(rawAttempt.timedOut) ||
    (responseTimeMs != null && responseTimeMs > responseWindowMs);
  const correct = Boolean(rawAttempt.correct);

  return {
    skillKey: candidate.skillKey,
    difficultyTier: candidate.difficultyTier,
    difficultyRank: candidate.difficultyRank,
    successful: correct && !timedOut,
    correct,
    timedOut,
    responseTimeMs,
    targetResponseMs,
    responseWindowMs,
    paceRatio: responseTimeMs == null ? null : responseTimeMs / targetResponseMs,
    answeredAt: finiteNumber(rawAttempt.answeredAt ?? rawAttempt.timestamp, null),
    sourceIndex,
    orderedIndex: sourceIndex,
  };
}

function buildCandidateProfile(attempts, allAttempts) {
  if (!attempts.length) {
    return emptyCandidateProfile(allAttempts.length);
  }

  const wrong = attempts.filter((attempt) => !attempt.successful).length;
  const recent = attempts.slice(-5);
  const paced = attempts.filter((attempt) => attempt.paceRatio != null);
  const paceRatio = paced.length
    ? exponentiallyWeightedAverage(paced.map((attempt) => attempt.paceRatio))
    : null;
  let fastSuccessStreak = 0;

  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    const attempt = attempts[index];

    if (!attempt.successful || attempt.paceRatio == null || attempt.paceRatio > 0.58) {
      break;
    }

    fastSuccessStreak += 1;
  }

  const lastAttempt = attempts.at(-1);

  return {
    attempts: attempts.length,
    correct: attempts.length - wrong,
    wrong,
    accuracy: (attempts.length - wrong) / attempts.length,
    errorRate: wrong / attempts.length,
    recentErrorRate:
      recent.filter((attempt) => !attempt.successful).length / recent.length,
    paceRatio,
    fastSuccessStreak,
    lastAttempt,
    lastSeenAt: lastAttempt.answeredAt,
    turnsSinceSeen: Math.max(0, allAttempts.length - 1 - lastAttempt.orderedIndex),
  };
}

function emptyCandidateProfile(turnsSinceSeen = 0) {
  return {
    attempts: 0,
    correct: 0,
    wrong: 0,
    accuracy: null,
    errorRate: 0,
    recentErrorRate: 0,
    paceRatio: null,
    fastSuccessStreak: 0,
    lastAttempt: null,
    lastSeenAt: null,
    turnsSinceSeen,
  };
}

function buildTierMetrics(attempts, options) {
  const windowSize = options.progressionWindow ?? 12;
  const recent = attempts.slice(-windowSize);
  const successful = recent.filter((attempt) => attempt.successful).length;
  const paced = recent.filter((attempt) => attempt.paceRatio != null);

  return {
    attempts: attempts.length,
    evaluatedAttempts: recent.length,
    accuracy: recent.length ? successful / recent.length : null,
    paceRatio: paced.length
      ? paced.reduce((total, attempt) => total + attempt.paceRatio, 0) / paced.length
      : null,
    uniqueFacts: new Set(attempts.map((attempt) => attempt.skillKey)).size,
  };
}

function tierIsMastered(metrics, options) {
  const minimumAttempts = options.minimumTierAttempts ?? 8;
  const minimumUniqueFacts = options.minimumTierFacts ?? 5;
  const minimumAccuracy = options.minimumTierAccuracy ?? 0.85;
  const maximumPaceRatio = options.maximumTierPaceRatio ?? 0.78;

  return (
    metrics.evaluatedAttempts >= minimumAttempts &&
    metrics.uniqueFacts >= minimumUniqueFacts &&
    metrics.accuracy >= minimumAccuracy &&
    (metrics.paceRatio == null || metrics.paceRatio <= maximumPaceRatio)
  );
}

function learnerNeedsRelief(recent, options) {
  const minimumAttempts = options.minimumRegressionAttempts ?? 4;

  if (recent.length < minimumAttempts) {
    return false;
  }

  const accuracy = recent.filter((attempt) => attempt.successful).length / recent.length;
  const paced = recent.filter((attempt) => attempt.paceRatio != null);
  const paceRatio = paced.length
    ? paced.reduce((total, attempt) => total + attempt.paceRatio, 0) / paced.length
    : null;

  return (
    accuracy < (options.regressionAccuracy ?? 0.55) ||
    (paceRatio != null && paceRatio > (options.regressionPaceRatio ?? 1.08))
  );
}

function recencyMultiplierFor(profile) {
  if (!profile.lastAttempt) {
    return 1;
  }

  const turns = profile.turnsSinceSeen;
  const lastWasWrong = !profile.lastAttempt.successful;

  if (turns === 0) {
    return lastWasWrong ? 0.38 : 0.12;
  }

  if (turns === 1) {
    return lastWasWrong ? 0.58 : 0.28;
  }

  if (turns === 2) {
    return 0.48;
  }

  if (turns <= 4) {
    return 0.72;
  }

  return 1;
}

function uniqueTiers(candidates) {
  const byId = new Map();

  for (const candidate of candidates) {
    if (!candidate?.difficultyTier || byId.has(candidate.difficultyTier)) {
      continue;
    }

    byId.set(candidate.difficultyTier, {
      id: candidate.difficultyTier,
      label: candidate.difficultyLabel,
      rank: candidate.difficultyRank,
    });
  }

  return [...byId.values()].sort((left, right) => left.rank - right.rank);
}

function resolveRandom(options) {
  if (options.random != null) {
    if (typeof options.random !== "function") {
      throw new TypeError("random must be a function");
    }

    return options.random;
  }

  if (options.seed != null) {
    return createSeededRandom(options.seed);
  }

  return Math.random;
}

function normalizeRandomValue(value) {
  if (!Number.isFinite(value)) {
    throw new TypeError("random must return a finite number");
  }

  const normalized = value - Math.floor(value);
  return Math.min(normalized, 1 - Number.EPSILON);
}

function hashSeed(seed) {
  const text = String(seed ?? "basic-memorization");
  let hash = 2_166_136_261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function normalizePresetIds(rawConfig) {
  const rawIds = rawConfig.presetIds ??
    (rawConfig.presetId == null ? ["all"] : [rawConfig.presetId]);

  if (!Array.isArray(rawIds)) {
    throw new TypeError("presetIds must be an array");
  }

  return [...new Set(rawIds.map(String))];
}

function normalizeIntegerList(value, minimum, maximum) {
  if (value == null) {
    return null;
  }

  if (!Array.isArray(value) || !value.length) {
    throw new TypeError("numeric filters must be non-empty arrays");
  }

  return [...new Set(value.map((item) => {
    const normalized = Number(item);

    if (!Number.isInteger(normalized) || normalized < minimum || normalized > maximum) {
      throw new RangeError(`numeric filters must stay between ${minimum} and ${maximum}`);
    }

    return normalized;
  }))];
}

function normalizeBoundedInteger(value, minimum, maximum, fallback) {
  if (value == null) {
    return fallback;
  }

  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized < minimum || normalized > maximum) {
    throw new RangeError(`value must stay between ${minimum} and ${maximum}`);
  }

  return normalized;
}

function presetFromDigits(digits) {
  return Number(digits) === 2 ? "two-digits" : "one-digit";
}

function compareAttempts(left, right) {
  if (left.answeredAt != null && right.answeredAt != null) {
    return left.answeredAt - right.answeredAt || left.sourceIndex - right.sourceIndex;
  }

  return left.sourceIndex - right.sourceIndex;
}

function appendToMap(map, key, value) {
  const entries = map.get(key) ?? [];
  entries.push(value);
  map.set(key, entries);
}

function countVariantsBySkill(candidates) {
  const counts = new Map();

  for (const candidate of candidates) {
    counts.set(candidate.skillKey, (counts.get(candidate.skillKey) ?? 0) + 1);
  }

  return counts;
}

function expandCandidateExclusions(candidates, rawExclusions) {
  const exclusions = new Set(
    (Array.isArray(rawExclusions) ? rawExclusions : [])
      .filter((value) => value != null)
      .map(String),
  );

  // An orientation ID identifies the shared skill too. This keeps 8 × 7 from
  // being followed immediately by 7 × 8 without forcing the UI to know both IDs.
  for (const candidate of candidates) {
    if (
      exclusions.has(candidate.id) ||
      exclusions.has(candidate.questionId) ||
      exclusions.has(candidate.variantKey)
    ) {
      exclusions.add(candidate.skillKey);
    }
  }

  return exclusions;
}

function exponentiallyWeightedAverage(values) {
  let average = values[0];

  for (let index = 1; index < values.length; index += 1) {
    average = average * 0.65 + values[index] * 0.35;
  }

  return average;
}

function commutativeSkillKey(prefix, left, right) {
  return `${prefix}:${Math.min(left, right)}:${Math.max(left, right)}`;
}

function orderedSkillKey(prefix, left, right) {
  return `${prefix}:${left}:${right}`;
}

function isSixToNine(value) {
  return value >= 6 && value <= 9;
}

function integerRange(minimum, maximum) {
  return Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);
}

function tier(id, label, rank, baseWindowMs, notice = null) {
  return Object.freeze({ id, label, rank, baseWindowMs, notice });
}

function assertCandidate(candidate) {
  if (!candidate || typeof candidate !== "object" || !candidate.skillKey) {
    throw new TypeError("candidate must be a basic memorization candidate");
  }
}

function assertOneOf(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new RangeError(`Unknown ${field}: ${value}`);
  }
}

function finiteNumber(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function positiveNumberOrNull(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundWeight(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
