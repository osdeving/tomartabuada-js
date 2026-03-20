export const STORAGE_KEY = "tabuada-sprint.progress.v2";
export const FACTORS = Array.from({ length: 9 }, (_, index) => index + 1);
export const DEFAULT_SELECTED_FACTORS = [2, 3, 4, 5, 6, 7, 8, 9];
export const PRODUCT_BANDS = [
  { id: "band-1", label: "1-12", min: 1, max: 12 },
  { id: "band-2", label: "13-24", min: 13, max: 24 },
  { id: "band-3", label: "25-40", min: 25, max: 40 },
  { id: "band-4", label: "41-56", min: 41, max: 56 },
  { id: "band-5", label: "57-81", min: 57, max: 81 },
];

export const FACTS = buildFacts();
export const DEFAULT_SELECTED_FACT_IDS = FACTS.filter(
  (fact) => fact.a >= 2 && fact.b >= 2,
).map((fact) => fact.id);

function buildFacts() {
  const facts = [];

  for (let a = 1; a <= 9; a += 1) {
    for (let b = 1; b <= 9; b += 1) {
      const product = a * b;

      facts.push({
        id: getFactId(a, b),
        a,
        b,
        product,
        bandId: getBandId(product),
      });
    }
  }

  return facts;
}

export function getFactId(a, b) {
  return `${a}x${b}`;
}

export function getCanonicalFactId(a, b) {
  return `${Math.min(a, b)}x${Math.max(a, b)}`;
}

export function getBandId(product) {
  const band = PRODUCT_BANDS.find(
    (candidate) => product >= candidate.min && product <= candidate.max,
  );

  return band?.id ?? PRODUCT_BANDS.at(-1).id;
}

function createFactStats() {
  return {
    attempts: 0,
    correct: 0,
    incorrect: 0,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    ease: 1.75,
    intervalMs: 45_000,
    dueAt: 0,
    lastAnsweredAt: 0,
    avgTimeMs: 0,
    bestTimeMs: 0,
    lastOutcome: "new",
  };
}

function createBandStats() {
  return {
    attempts: 0,
    correct: 0,
    incorrect: 0,
  };
}

export function createDefaultProgress() {
  return {
    version: 3,
    selectedFactIds: getDefaultSelectedFactIds(),
    factStats: Object.fromEntries(
      FACTS.map((fact) => [fact.id, createFactStats()]),
    ),
    bandStats: Object.fromEntries(
      PRODUCT_BANDS.map((band) => [band.id, createBandStats()]),
    ),
    history: [],
    totalAnswers: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastSessionAt: 0,
  };
}

export function normalizeProgress(rawProgress) {
  if (!rawProgress || typeof rawProgress !== "object") {
    return createDefaultProgress();
  }

  const base = createDefaultProgress();
  const rawSelectedFactors = Array.isArray(rawProgress.selectedFactors)
    ? rawProgress.selectedFactors
        .map((value) => Number(value))
        .filter((value) => FACTORS.includes(value))
    : DEFAULT_SELECTED_FACTORS;
  const selectedFactIdSet = new Set(FACTS.map((fact) => fact.id));
  const rawSelectedFactIds = Array.isArray(rawProgress.selectedFactIds)
    ? rawProgress.selectedFactIds.filter((factId) => selectedFactIdSet.has(factId))
    : [];
  const migratedSelectedFactIds = rawSelectedFactIds.length
    ? rawSelectedFactIds
    : rawSelectedFactors.length
      ? getFactIdsForFactors(rawSelectedFactors)
      : base.selectedFactIds;
  const migratedSelectedFactIdSet = new Set(migratedSelectedFactIds);

  return {
    ...base,
    ...rawProgress,
    selectedFactIds: FACTS.filter((fact) => migratedSelectedFactIdSet.has(fact.id)).map(
      (fact) => fact.id,
    ),
    factStats: Object.fromEntries(
      FACTS.map((fact) => [
        fact.id,
        {
          ...createFactStats(),
          ...getMigratedFactStats(rawProgress, fact),
        },
      ]),
    ),
    bandStats: Object.fromEntries(
      PRODUCT_BANDS.map((band) => [
        band.id,
        {
          ...createBandStats(),
          ...(rawProgress.bandStats?.[band.id] ?? {}),
        },
      ]),
    ),
    history: Array.isArray(rawProgress.history)
      ? rawProgress.history.slice(0, 240)
      : [],
    totalAnswers: Number(rawProgress.totalAnswers) || 0,
    currentStreak: Number(rawProgress.currentStreak) || 0,
    bestStreak: Number(rawProgress.bestStreak) || 0,
    lastSessionAt: Number(rawProgress.lastSessionAt) || 0,
  };
}

export function getDefaultSelectedFactIds() {
  return [...DEFAULT_SELECTED_FACT_IDS];
}

export function getFactIdsForFactors(selectedFactors) {
  const selectedSet = new Set(selectedFactors);

  return FACTS.filter(
    (fact) => selectedSet.has(fact.a) || selectedSet.has(fact.b),
  ).map((fact) => fact.id);
}

export function getActiveFacts(selectedFactIds) {
  const selectedSet = new Set(selectedFactIds);

  return FACTS.filter((fact) => selectedSet.has(fact.id));
}

export function getAccuracy(stats) {
  if (!stats?.attempts) {
    return null;
  }

  return stats.correct / stats.attempts;
}

export function getMasteryScore(stats) {
  if (!stats) {
    return 0;
  }

  if (!stats.attempts) {
    return 0.12;
  }

  const accuracyScore = getAccuracy(stats) ?? 0;
  const intervalScore = clamp(stats.intervalMs / (20 * 60 * 1000), 0, 1);
  const streakScore = clamp(stats.consecutiveCorrect / 5, 0, 1);

  return clamp(
    accuracyScore * 0.58 + intervalScore * 0.24 + streakScore * 0.18,
    0,
    1,
  );
}

export function getBandInsights(progress) {
  return PRODUCT_BANDS.map((band) => {
    const summary = progress.bandStats[band.id];
    const recentItems = progress.history
      .filter((item) => item.bandId === band.id)
      .slice(0, 18);

    const overallAccuracy = summary.attempts
      ? summary.correct / summary.attempts
      : null;
    const recentAccuracy = recentItems.length
      ? recentItems.filter((item) => item.correct).length / recentItems.length
      : null;

    const pressure =
      Math.max(0, 0.78 - (overallAccuracy ?? 0.78)) * 1.8 +
      Math.max(0, 0.72 - (recentAccuracy ?? 0.72)) * 1.2;

    return {
      ...band,
      attempts: summary.attempts,
      accuracy: overallAccuracy,
      recentAttempts: recentItems.length,
      recentAccuracy,
      focusBoost: clamp(pressure, 0, 1.8),
    };
  });
}

export function getFactorInsights(progress) {
  return FACTORS.map((factor) => {
    const relatedFacts = FACTS.filter(
      (fact) => fact.a === factor || fact.b === factor,
    );

    const aggregate = relatedFacts.reduce(
      (summary, fact) => {
        const stats = progress.factStats[fact.id];

        summary.attempts += stats.attempts;
        summary.correct += stats.correct;
        summary.mastery += getMasteryScore(stats);
        return summary;
      },
      { attempts: 0, correct: 0, mastery: 0 },
    );

    return {
      factor,
      attempts: aggregate.attempts,
      accuracy: aggregate.attempts
        ? aggregate.correct / aggregate.attempts
        : null,
      mastery: aggregate.mastery / relatedFacts.length,
    };
  }).sort((left, right) => {
    const masteryGap = left.mastery - right.mastery;

    if (masteryGap !== 0) {
      return masteryGap;
    }

    return (left.accuracy ?? 0) - (right.accuracy ?? 0);
  });
}

export function getSmartFactorSelection(progress) {
  const weakestFactors = getFactorInsights(progress)
    .filter((entry) => entry.attempts > 0)
    .slice(0, 4)
    .map((entry) => entry.factor);

  return weakestFactors.length >= 2
    ? weakestFactors.sort((a, b) => a - b)
    : [6, 7, 8, 9];
}

export function pickNextQuestion(progress, selectedFactIds, previousQuestionId = "") {
  const activeFacts = getActiveFacts(selectedFactIds);

  if (!activeFacts.length) {
    return null;
  }

  const now = Date.now();
  const bandInsights = Object.fromEntries(
    getBandInsights(progress).map((band) => [band.id, band]),
  );

  const weightedFacts = activeFacts.map((fact) => {
    const stats = progress.factStats[fact.id];
    const accuracy = getAccuracy(stats) ?? 0.55;
    const errorRate = 1 - accuracy;
    const overdueRatio =
      stats.dueAt <= now
        ? clamp((now - stats.dueAt) / Math.max(stats.intervalMs, 45_000), 0, 3)
        : 0;

    const dueScore = !stats.attempts
      ? 1.75
      : stats.dueAt <= now
        ? 1.15 + overdueRatio
        : 0.42;
    const difficultyScore =
      1 + errorRate * 2.9 + Math.min(stats.consecutiveWrong, 3) * 0.85;
    const speedScore = stats.avgTimeMs
      ? 1 + clamp((stats.avgTimeMs - 2_800) / 2_200, 0, 1.6)
      : 1.1;
    const bandScore = 1 + (bandInsights[fact.bandId]?.focusBoost ?? 0);
    const recentPenalty =
      activeFacts.length > 1 && fact.id === previousQuestionId ? 0.12 : 1;
    const cooldownPenalty =
      stats.lastAnsweredAt && now - stats.lastAnsweredAt < 25_000 ? 0.35 : 1;
    const noveltyBonus = !stats.attempts ? 1.35 : 1;

    return {
      fact,
      weight: Math.max(
        0.05,
        dueScore *
          difficultyScore *
          speedScore *
          bandScore *
          recentPenalty *
          cooldownPenalty *
          noveltyBonus,
      ),
    };
  });

  const chosen = weightedRandom(weightedFacts);

  return {
    id: chosen.fact.id,
    a: chosen.fact.a,
    b: chosen.fact.b,
    answer: chosen.fact.product,
    product: chosen.fact.product,
    bandId: chosen.fact.bandId,
  };
}

export function applyAnswer(progress, question, answerValue, responseTimeMs) {
  const now = Date.now();
  const correct = Number(answerValue) === question.answer;
  const previousStats = progress.factStats[question.id] ?? createFactStats();
  const quality = correct
    ? responseTimeMs < 1_800
      ? 5
      : responseTimeMs < 3_100
        ? 4
        : responseTimeMs < 4_900
          ? 3
          : 2
    : 0;

  let ease = previousStats.ease;
  let intervalMs = previousStats.intervalMs;
  const consecutiveCorrect = correct
    ? previousStats.consecutiveCorrect + 1
    : 0;
  const consecutiveWrong = correct ? 0 : previousStats.consecutiveWrong + 1;

  if (correct) {
    ease = clamp(
      previousStats.ease + (quality >= 4 ? 0.11 : quality === 3 ? 0.05 : -0.03),
      1.35,
      2.8,
    );

    const baseInterval = previousStats.attempts
      ? previousStats.intervalMs
      : 75_000;
    const speedFactor =
      quality === 5 ? 1.35 : quality === 4 ? 1.18 : quality === 3 ? 0.98 : 0.74;
    const streakFactor = 1 + Math.min(consecutiveCorrect, 5) * 0.16;

    intervalMs = Math.round(
      clamp(baseInterval * ease * speedFactor * streakFactor, 75_000, 90 * 60 * 1000),
    );
  } else {
    ease = clamp(previousStats.ease - 0.2, 1.3, 2.8);
    intervalMs = Math.round(
      clamp(previousStats.intervalMs * 0.42, 20_000, 8 * 60 * 1000),
    );
  }

  const updatedFactStats = {
    ...previousStats,
    attempts: previousStats.attempts + 1,
    correct: previousStats.correct + (correct ? 1 : 0),
    incorrect: previousStats.incorrect + (correct ? 0 : 1),
    consecutiveCorrect,
    consecutiveWrong,
    ease,
    intervalMs,
    dueAt: now + intervalMs,
    lastAnsweredAt: now,
    avgTimeMs: previousStats.attempts
      ? Math.round(
          (previousStats.avgTimeMs * previousStats.attempts + responseTimeMs) /
            (previousStats.attempts + 1),
        )
      : responseTimeMs,
    bestTimeMs: correct
      ? previousStats.bestTimeMs
        ? Math.min(previousStats.bestTimeMs, responseTimeMs)
        : responseTimeMs
      : previousStats.bestTimeMs,
    lastOutcome: correct ? "correct" : "incorrect",
  };

  const previousBandStats =
    progress.bandStats[question.bandId] ?? createBandStats();
  const updatedBandStats = {
    ...previousBandStats,
    attempts: previousBandStats.attempts + 1,
    correct: previousBandStats.correct + (correct ? 1 : 0),
    incorrect: previousBandStats.incorrect + (correct ? 0 : 1),
  };

  const historyItem = {
    id: `${question.id}-${now}`,
    factId: question.id,
    label: `${question.a} × ${question.b}`,
    canonicalLabel: question.id.replace("x", " × "),
    answer: question.answer,
    userAnswer: Number(answerValue),
    correct,
    responseTimeMs,
    timestamp: now,
    bandId: question.bandId,
    product: question.product,
  };

  const currentStreak = correct ? progress.currentStreak + 1 : 0;
  const nextProgress = {
    ...progress,
    factStats: {
      ...progress.factStats,
      [question.id]: updatedFactStats,
    },
    bandStats: {
      ...progress.bandStats,
      [question.bandId]: updatedBandStats,
    },
    history: [historyItem, ...progress.history].slice(0, 240),
    totalAnswers: progress.totalAnswers + 1,
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
    lastSessionAt: now,
  };

  const band = PRODUCT_BANDS.find((entry) => entry.id === question.bandId);
  const lead = correct ? getSuccessLead(responseTimeMs) : getRetryLead(consecutiveWrong);
  const detail = correct
    ? `Volta em ${formatInterval(intervalMs)} se continuar redonda.`
    : `Fica na tela para outra tentativa agora e volta cedo na fila. Faixa ${band?.label ?? question.bandId} ganhou prioridade.`;

  return {
    correct,
    progress: nextProgress,
    feedback: {
      tone: correct ? "success" : "danger",
      title: lead,
      detail,
    },
  };
}

export function formatInterval(intervalMs) {
  if (intervalMs < 60_000) {
    return `${Math.round(intervalMs / 1_000)}s`;
  }

  if (intervalMs < 60 * 60 * 1_000) {
    return `${Math.round(intervalMs / 60_000)}min`;
  }

  const hours = Math.floor(intervalMs / (60 * 60 * 1_000));
  const minutes = Math.round((intervalMs % (60 * 60 * 1_000)) / 60_000);

  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

export function formatResponseTime(responseTimeMs) {
  return `${(responseTimeMs / 1_000).toFixed(responseTimeMs < 10_000 ? 1 : 0)}s`;
}

function getSuccessLead(responseTimeMs) {
  if (responseTimeMs < 1_300) {
    return "Cirúrgico.";
  }

  if (responseTimeMs < 2_400) {
    return "Boa pancada.";
  }

  if (responseTimeMs < 4_200) {
    return "Acertou com margem.";
  }

  return "Certo, mas ainda dá para secar esse tempo.";
}

function getRetryLead(consecutiveWrong) {
  if (consecutiveWrong >= 3) {
    return "Travou. Respira e tenta de novo.";
  }

  if (consecutiveWrong === 2) {
    return "Ainda não entrou. Mais uma.";
  }

  return "Errou. Tenta de novo.";
}

function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  if (!totalWeight) {
    return items[0];
  }

  let threshold = Math.random() * totalWeight;

  for (const item of items) {
    threshold -= item.weight;

    if (threshold <= 0) {
      return item;
    }
  }

  return items.at(-1);
}

function getMigratedFactStats(rawProgress, fact) {
  if (!rawProgress.factStats) {
    return {};
  }

  if (rawProgress.version >= 3) {
    return rawProgress.factStats[fact.id] ?? {};
  }

  return (
    rawProgress.factStats[fact.id] ??
    rawProgress.factStats[getCanonicalFactId(fact.a, fact.b)] ??
    {}
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
