import {
  DEFAULT_CAMPAIGN,
  MODE_DEFINITIONS,
  clampDifficulty,
  normalizeMode,
} from "./config.js";

export function createModeState(mode, options = {}) {
  const normalizedMode = normalizeMode(mode);

  if (normalizedMode === "survival") {
    const maxLives = Math.max(
      1,
      Math.round(Number(options.lives) || MODE_DEFINITIONS.survival.defaultLives),
    );
    return {
      mode: normalizedMode,
      status: "active",
      maxLives,
      lives: maxLives,
      wave: 1,
      correctInRun: 0,
      attemptsInRun: 0,
    };
  }

  if (normalizedMode === "campaign") {
    const campaign = normalizeCampaign(options.campaign);
    return {
      mode: normalizedMode,
      status: "active",
      campaignId: campaign.id,
      stageIndex: 0,
      stageAttempts: 0,
      stageCorrect: 0,
      completedStageIds: [],
    };
  }

  return {
    mode: normalizedMode,
    status: "active",
    rounds: 0,
    correct: 0,
  };
}

export function applyModeAttempt(rawModeState, attempt, options = {}) {
  const mode = normalizeMode(options.mode ?? rawModeState?.mode ?? attempt.mode);
  const state = rawModeState ?? createModeState(mode, options);

  if (state.status === "completed" || state.status === "game-over") {
    return {
      state,
      status: state.status,
      events: [],
      accepted: false,
    };
  }

  if (mode === "survival") {
    return applySurvivalAttempt(state, attempt);
  }

  if (mode === "campaign") {
    return applyCampaignAttempt(state, attempt, options.campaign);
  }

  const nextState = {
    ...state,
    rounds: (Number(state.rounds) || 0) + 1,
    correct: (Number(state.correct) || 0) + (isSuccessfulAttempt(attempt) ? 1 : 0),
  };

  return { state: nextState, status: "active", events: [], accepted: true };
}

export function calculateAttemptScore(attempt, options = {}) {
  if (!attempt?.correct || attempt.revealed || attempt.skipped) {
    return 0;
  }

  const mode = normalizeMode(options.mode ?? attempt.mode);
  const combo = Math.max(1, Number(options.combo) || 1);
  const difficulty = clampDifficulty(attempt.difficulty);
  const paceRatio = Number.isFinite(attempt.paceRatio) ? attempt.paceRatio : 0.8;
  const base = 70 + difficulty * 18;
  const speedBonus = 1 + Math.max(0, Math.min(0.75, 1 - paceRatio));
  const comboMultiplier = 1 + Math.min(combo - 1, 20) * 0.055;
  const hintPenalty = Math.max(0.35, 1 - (Number(attempt.hintsUsed) || 0) * 0.22);
  const timeoutPenalty = attempt.timedOut ? 0.4 : 1;
  const modeMultiplier = MODE_DEFINITIONS[mode].scoreMultiplier;

  return Math.round(
    base * speedBonus * comboMultiplier * hintPenalty * timeoutPenalty * modeMultiplier,
  );
}

export function getComboCelebration(combo) {
  const numericCombo = Math.max(0, Math.round(Number(combo) || 0));
  const messages = {
    3: "Combo de 3 — o ritmo encaixou!",
    5: "Combo de 5 — cálculo limpo!",
    10: "Combo de 10 — você entrou no fluxo!",
    20: "Combo de 20 — sequência absurda!",
  };

  if (messages[numericCombo]) {
    return { type: "combo", combo: numericCombo, message: messages[numericCombo] };
  }

  if (numericCombo >= 30 && numericCombo % 10 === 0) {
    return {
      type: "combo",
      combo: numericCombo,
      message: `Combo de ${numericCombo} — domínio em alta!`,
    };
  }

  return null;
}

export function getActiveCampaignStage(rawState, rawCampaign = DEFAULT_CAMPAIGN) {
  const campaign = normalizeCampaign(rawCampaign);
  const stageIndex = Math.max(0, Math.round(Number(rawState?.stageIndex) || 0));
  return campaign.stages[stageIndex] ?? null;
}

export function getCampaignProgress(rawState, rawCampaign = DEFAULT_CAMPAIGN) {
  const campaign = normalizeCampaign(rawCampaign);
  const state = rawState ?? createModeState("campaign", { campaign });
  const stage = getActiveCampaignStage(state, campaign);
  const stageAccuracy = state.stageAttempts
    ? state.stageCorrect / state.stageAttempts
    : null;

  return {
    campaignId: campaign.id,
    title: campaign.title,
    status: state.status,
    stageIndex: state.stageIndex,
    stageCount: campaign.stages.length,
    completedStages: state.completedStageIds?.length ?? 0,
    progress: campaign.stages.length
      ? Math.min(1, (state.completedStageIds?.length ?? 0) / campaign.stages.length)
      : 1,
    activeStage: stage,
    stageAttempts: state.stageAttempts ?? 0,
    stageCorrect: state.stageCorrect ?? 0,
    stageAccuracy,
    requirements: stage
      ? {
          targetCorrect: stage.targetCorrect,
          minimumAttempts: stage.minimumAttempts,
          minimumAccuracy: stage.minimumAccuracy,
        }
      : null,
  };
}

export function normalizeCampaign(rawCampaign) {
  const candidate = rawCampaign && typeof rawCampaign === "object"
    ? rawCampaign
    : DEFAULT_CAMPAIGN;
  const stages = Array.isArray(candidate.stages)
    ? candidate.stages
        .filter((stage) => stage && typeof stage === "object" && stage.id)
        .map((stage, index) => ({
          ...stage,
          id: String(stage.id),
          title: String(stage.title ?? stage.id),
          groupIds: Array.isArray(stage.groupIds)
            ? [...new Set(stage.groupIds.map(String).filter(Boolean))]
            : [],
          difficulty: clampDifficulty(stage.difficulty ?? index + 2),
          targetCorrect: Math.max(1, Math.round(Number(stage.targetCorrect) || 8)),
          minimumAttempts: Math.max(1, Math.round(Number(stage.minimumAttempts) || 10)),
          minimumAccuracy: Math.min(
            1,
            Math.max(0, Number(stage.minimumAccuracy) || 0.7),
          ),
        }))
    : [];

  return {
    ...candidate,
    id: String(candidate.id ?? DEFAULT_CAMPAIGN.id),
    title: String(candidate.title ?? DEFAULT_CAMPAIGN.title),
    stages: stages.length ? stages : DEFAULT_CAMPAIGN.stages,
  };
}

function applySurvivalAttempt(state, attempt) {
  const successful = isSuccessfulAttempt(attempt);
  const lostLife = !successful;
  const lives = Math.max(0, (Number(state.lives) || 0) - (lostLife ? 1 : 0));
  const correctInRun = (Number(state.correctInRun) || 0) + (successful ? 1 : 0);
  const attemptsInRun = (Number(state.attemptsInRun) || 0) + 1;
  const wave = 1 + Math.floor(correctInRun / 8);
  const status = lives === 0 ? "game-over" : "active";
  const events = [];

  if (lostLife) {
    events.push({
      type: "life-lost",
      lives,
      message: lives ? `Você perdeu uma vida. Restam ${lives}.` : "Fim da sobrevivência.",
    });
  }

  if (wave > (Number(state.wave) || 1)) {
    events.push({
      type: "wave-advanced",
      wave,
      message: `Onda ${wave}: o ritmo vai apertar.`,
    });
  }

  return {
    state: { ...state, lives, correctInRun, attemptsInRun, wave, status },
    status,
    events,
    accepted: true,
  };
}

function applyCampaignAttempt(state, attempt, rawCampaign) {
  const campaign = normalizeCampaign(rawCampaign);
  const stage = getActiveCampaignStage(state, campaign);

  if (!stage) {
    return {
      state: { ...state, status: "completed" },
      status: "completed",
      events: [],
      accepted: false,
    };
  }

  const stageAttempts = (Number(state.stageAttempts) || 0) + 1;
  const stageCorrect =
    (Number(state.stageCorrect) || 0) + (isSuccessfulAttempt(attempt) ? 1 : 0);
  const accuracy = stageCorrect / stageAttempts;
  const passed =
    stageAttempts >= stage.minimumAttempts &&
    stageCorrect >= stage.targetCorrect &&
    accuracy >= stage.minimumAccuracy;

  if (!passed) {
    return {
      state: { ...state, stageAttempts, stageCorrect },
      status: "active",
      events: [],
      accepted: true,
    };
  }

  const completedStageIds = [...new Set([...(state.completedStageIds ?? []), stage.id])];
  const nextStageIndex = (Number(state.stageIndex) || 0) + 1;
  const campaignCompleted = nextStageIndex >= campaign.stages.length;
  const events = [{
    type: "stage-completed",
    stageId: stage.id,
    message: `Etapa “${stage.title}” concluída!`,
  }];

  if (campaignCompleted) {
    events.push({
      type: "campaign-completed",
      campaignId: campaign.id,
      message: `Campanha “${campaign.title}” concluída!`,
    });
  }

  return {
    state: {
      ...state,
      status: campaignCompleted ? "completed" : "active",
      stageIndex: nextStageIndex,
      stageAttempts: 0,
      stageCorrect: 0,
      completedStageIds,
    },
    status: campaignCompleted ? "completed" : "active",
    events,
    accepted: true,
  };
}

function isSuccessfulAttempt(attempt) {
  return Boolean(
    attempt?.correct && !attempt.timedOut && !attempt.revealed && !attempt.skipped,
  );
}
