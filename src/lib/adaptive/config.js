export const ADAPTIVE_SCHEMA_VERSION = 1;

export const DEFAULT_ADAPTIVE_CONFIG = Object.freeze({
  minDifficulty: 1,
  maxDifficulty: 10,
  initialDifficulty: 3,
  recentWindowSize: 12,
  minimumAdaptationAttempts: 5,
  targetAccuracy: 0.82,
  easierAccuracy: 0.64,
  muchEasierAccuracy: 0.45,
  harderAccuracy: 0.87,
  muchHarderAccuracy: 0.94,
  fastPaceRatio: 0.68,
  veryFastPaceRatio: 0.48,
  slowPaceRatio: 0.96,
  errorStreakRelief: 3,
  bookChallengeShare: 0.35,
  theoryMinimumAttempts: 3,
  theoryErrorRate: 0.6,
  fatigueRecentWindow: 8,
  fatigueMinimumRecentAttempts: 6,
  fatigueMinimumBaselineAttempts: 6,
  fatigueMinimumSessionMs: 10 * 60 * 1000,
  fatigueAccuracyDrop: 0.18,
  fatiguePaceIncrease: 0.25,
});

export const MODE_DEFINITIONS = Object.freeze({
  sparring: Object.freeze({
    id: "sparring",
    label: "Treino / sparring",
    description: "Treino sem eliminação, com foco reforçado nas habilidades frágeis.",
    defaultLives: null,
    scoreMultiplier: 0.85,
    weakSkillBias: 1.55,
  }),
  campaign: Object.freeze({
    id: "campaign",
    label: "Campanha",
    description: "Etapas progressivas com objetivos claros e desbloqueio por domínio.",
    defaultLives: null,
    scoreMultiplier: 1,
    weakSkillBias: 1.2,
  }),
  survival: Object.freeze({
    id: "survival",
    label: "Sobrevivência",
    description: "Erros custam vidas; acertos rápidos aumentam a onda e a pontuação.",
    defaultLives: 3,
    scoreMultiplier: 1.2,
    weakSkillBias: 0.9,
  }),
});

const MODE_ALIASES = Object.freeze({
  treino: "sparring",
  training: "sparring",
  practice: "sparring",
  sparring: "sparring",
  campanha: "campaign",
  campaign: "campaign",
  sobrevivencia: "survival",
  "sobrevivência": "survival",
  survival: "survival",
});

export const DEFAULT_CAMPAIGN = Object.freeze({
  id: "fundamentos-mentais",
  title: "Fundamentos do cálculo mental",
  stages: Object.freeze([
    Object.freeze({
      id: "base-automatica",
      title: "Base automática",
      groupIds: ["tabuada"],
      difficulty: 2,
      targetCorrect: 8,
      minimumAttempts: 10,
      minimumAccuracy: 0.7,
    }),
    Object.freeze({
      id: "fecha-dez",
      title: "Fecha 10",
      groupIds: ["adicao", "subtracao"],
      difficulty: 3,
      targetCorrect: 10,
      minimumAttempts: 12,
      minimumAccuracy: 0.75,
    }),
    Object.freeze({
      id: "dezenas-limpas",
      title: "Dezenas limpas",
      groupIds: ["adicao", "subtracao"],
      difficulty: 4,
      targetCorrect: 12,
      minimumAttempts: 14,
      minimumAccuracy: 0.78,
    }),
    Object.freeze({
      id: "familias-inversas",
      title: "Famílias inversas",
      groupIds: ["tabuada", "divisao"],
      difficulty: 5,
      targetCorrect: 14,
      minimumAttempts: 16,
      minimumAccuracy: 0.8,
    }),
    Object.freeze({
      id: "quadrados-ancora",
      title: "Quadrados como âncora",
      groupIds: ["quadrado", "tabuada"],
      difficulty: 6,
      targetCorrect: 14,
      minimumAttempts: 16,
      minimumAccuracy: 0.82,
    }),
    Object.freeze({
      id: "atalhos-em-combate",
      title: "Atalhos em combate",
      groupIds: ["tricks", "quadrado", "divisao"],
      difficulty: 8,
      targetCorrect: 18,
      minimumAttempts: 20,
      minimumAccuracy: 0.85,
    }),
  ]),
});

export function normalizeMode(mode) {
  if (typeof mode !== "string") {
    return "sparring";
  }

  return MODE_ALIASES[mode.trim().toLowerCase()] ?? "sparring";
}

export function clampDifficulty(value, config = DEFAULT_ADAPTIVE_CONFIG) {
  const numericValue = Number(value);
  const fallback = Number(config.initialDifficulty) || 3;
  const min = Number(config.minDifficulty) || 1;
  const max = Number(config.maxDifficulty) || 10;

  return Math.min(max, Math.max(min, Math.round(Number.isFinite(numericValue) ? numericValue : fallback)));
}

export function getDifficultyProfile(level, config = DEFAULT_ADAPTIVE_CONFIG) {
  const difficulty = clampDifficulty(level, config);
  const min = Number(config.minDifficulty) || 1;
  const max = Number(config.maxDifficulty) || 10;
  const progress = max === min ? 0 : (difficulty - min) / (max - min);

  return {
    level: difficulty,
    responseWindowScale: round(1.42 - progress * 0.78, 2),
    targetPaceRatio: round(0.92 - progress * 0.42, 2),
    generatedChallengeShare: round(0.2 + progress * 0.45, 2),
    noveltyShare: round(0.12 + progress * 0.38, 2),
  };
}

export function mergeAdaptiveConfig(overrides = {}) {
  const merged = { ...DEFAULT_ADAPTIVE_CONFIG, ...overrides };

  if (merged.minDifficulty > merged.maxDifficulty) {
    return {
      ...merged,
      minDifficulty: DEFAULT_ADAPTIVE_CONFIG.minDifficulty,
      maxDifficulty: DEFAULT_ADAPTIVE_CONFIG.maxDifficulty,
    };
  }

  return merged;
}

function round(value, precision) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
