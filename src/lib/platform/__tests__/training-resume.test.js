import assert from "node:assert/strict";
import test from "node:test";
import {
  createTrainingConfigSnapshot,
  getTrainingStartupIntent,
  markTrainingStarted,
  normalizeTrainingResume,
  rememberTrainingSelection,
} from "../trainingResume.js";

const SURVIVAL_CONFIG = Object.freeze({
  practiceKind: "adaptive",
  modeId: "sobrevivencia",
  groupId: "mix-insano",
  questionCount: 40,
  timeProfileId: "reflexo",
  memorization: {
    operationId: "multiplication",
    presetId: "six-to-nine",
    presetIds: ["six-to-nine", "no-squares"],
    difficultyMode: "adaptive",
    difficultyTier: "all",
  },
});

test("uma escolha isolada é persistida, mas não pula a boas-vindas antes do primeiro play", () => {
  const initial = { profile: { xp: 10 } };
  const next = rememberTrainingSelection(initial, SURVIVAL_CONFIG, 1_000);

  assert.notEqual(next, initial);
  assert.equal(initial.trainingResume, undefined);
  assert.equal(next.trainingResume.lastStartedAt, null);
  assert.equal(next.trainingResume.config.modeId, "sobrevivencia");
  assert.equal(getTrainingStartupIntent(next), null);
});

test("um treino iniciado reabre a configuração anterior pronta, sem sessão ou áudio automáticos", () => {
  const next = markTrainingStarted({}, {
    ...SURVIVAL_CONFIG,
    settings: { music: true, soundEffects: true },
    question: { id: "runtime-question" },
    remainingMs: 321,
  }, 2_000);
  const intent = getTrainingStartupIntent(next);

  assert.deepEqual(intent, {
    viewId: "treinar",
    status: "ready",
    autoStart: false,
    lastStartedAt: 2_000,
    config: SURVIVAL_CONFIG,
  });
  assert.equal("settings" in next.trainingResume.config, false);
  assert.equal("question" in next.trainingResume.config, false);
  assert.equal("remainingMs" in next.trainingResume.config, false);
});

test("mudanças deliberadas depois de jogar viram as escolhas do próximo início", () => {
  const played = markTrainingStarted({}, SURVIVAL_CONFIG, 3_000);
  const changed = rememberTrainingSelection(played, {
    ...SURVIVAL_CONFIG,
    modeId: "sparring",
    groupId: "adicao",
    timeProfileId: "calmo",
  }, 4_000);
  const intent = getTrainingStartupIntent(changed);

  assert.equal(changed.trainingResume.lastStartedAt, 3_000);
  assert.equal(changed.trainingResume.selectedAt, 4_000);
  assert.equal(intent.config.modeId, "sparring");
  assert.equal(intent.config.groupId, "adicao");
  assert.equal(intent.config.timeProfileId, "calmo");
});

test("snapshot sanitiza dados persistidos inválidos e combina filtros de tabuada", () => {
  const normalized = createTrainingConfigSnapshot({
    practiceKind: "desconhecido",
    modeId: "brutal",
    groupId: "inexistente",
    questionCount: 9_999,
    timeProfileId: "ontem",
    memorization: {
      operationId: "multiplication",
      presetId: "inexistente",
      presetIds: ["all", "six-to-nine", "six-to-nine", "inexistente"],
      difficultyMode: "fixed",
      difficultyTier: "cascade-borrow",
    },
  });

  assert.deepEqual(normalized, {
    practiceKind: "adaptive",
    modeId: "sparring",
    groupId: "misto",
    questionCount: 15,
    timeProfileId: "calmo",
    memorization: {
      operationId: "multiplication",
      presetId: "six-to-nine",
      presetIds: ["six-to-nine"],
      difficultyMode: "adaptive",
      difficultyTier: "all",
    },
  });
});

test("configuração de memorização restaura apenas nível compatível com a operação", () => {
  const valid = createTrainingConfigSnapshot({
    practiceKind: "memorization",
    modeId: "sobrevivencia",
    memorization: {
      operationId: "subtraction",
      presetId: "two-digits",
      difficultyMode: "fixed",
      difficultyTier: "cascade-borrow",
    },
  });
  const incompatible = createTrainingConfigSnapshot({
    practiceKind: "memorization",
    memorization: {
      operationId: "addition",
      presetId: "two-digits",
      difficultyMode: "fixed",
      difficultyTier: "cascade-borrow",
    },
  });

  assert.equal(valid.modeId, "sparring");
  assert.equal(valid.memorization.difficultyMode, "fixed");
  assert.equal(valid.memorization.difficultyTier, "cascade-borrow");
  assert.equal(incompatible.memorization.difficultyMode, "adaptive");
  assert.equal(incompatible.memorization.difficultyTier, "all");
});

test("checkpoint sobrevive a JSON e registros corrompidos não geram intenção de início", () => {
  const state = markTrainingStarted({}, SURVIVAL_CONFIG, 5_000);
  const fromJson = JSON.parse(JSON.stringify(state));

  assert.deepEqual(getTrainingStartupIntent(fromJson), getTrainingStartupIntent(state));
  assert.equal(normalizeTrainingResume(null), null);
  assert.equal(normalizeTrainingResume({ config: SURVIVAL_CONFIG }), null);
  assert.equal(getTrainingStartupIntent({ trainingResume: { lastStartedAt: "inválido" } }), null);
});

test("histórico anterior à feature também recupera o último treino comum", () => {
  const intent = getTrainingStartupIntent({
    selectedModeId: "sparring",
    selectedGroupId: "misto",
    settings: {
      practiceKind: "adaptive",
      questionCount: 25,
      timeProfileId: "calmo",
    },
    sessions: [
      { modeId: "campanha", startedAt: 9_000 },
      {
        practiceKind: "adaptive",
        modeId: "sobrevivencia",
        groupId: "mix-insano",
        timeProfileId: "ritmo",
        startedAt: 8_000,
      },
    ],
  });

  assert.equal(intent.viewId, "treinar");
  assert.equal(intent.status, "ready");
  assert.equal(intent.autoStart, false);
  assert.equal(intent.lastStartedAt, 8_000);
  assert.equal(intent.config.modeId, "sobrevivencia");
  assert.equal(intent.config.groupId, "mix-insano");
  assert.equal(intent.config.questionCount, 25);
  assert.equal(intent.config.timeProfileId, "ritmo");
});

test("escolha nova prevalece sobre histórico legado sem fingir um novo play", () => {
  const legacyState = {
    sessions: [{
      modeId: "sobrevivencia",
      groupId: "mix-insano",
      timeProfileId: "ritmo",
      startedAt: 8_000,
    }],
  };
  const changed = rememberTrainingSelection(legacyState, {
    ...SURVIVAL_CONFIG,
    modeId: "sparring",
    groupId: "adicao",
    timeProfileId: "calmo",
  }, 9_000);
  const intent = getTrainingStartupIntent(changed);

  assert.equal(changed.trainingResume.lastStartedAt, null);
  assert.equal(intent.lastStartedAt, 8_000);
  assert.equal(intent.config.modeId, "sparring");
  assert.equal(intent.config.groupId, "adicao");
  assert.equal(intent.config.timeProfileId, "calmo");
});

test("fallback legado ordena por data e ignora sessões contextuais", () => {
  const intent = getTrainingStartupIntent({
    sessions: [
      { modeId: "sparring", groupId: "adicao", startedAt: 2_000 },
      { modeId: "sparring", groupId: "quadrado", trainingContext: "theory", startedAt: 9_000 },
      { modeId: "campanha", groupId: "base", trainingContext: "campaign", startedAt: 10_000 },
      { modeId: "sobrevivencia", groupId: "mix-insano", endedAt: 7_000 },
    ],
  });

  assert.equal(intent.lastStartedAt, 7_000);
  assert.equal(intent.config.modeId, "sobrevivencia");
  assert.equal(intent.config.groupId, "mix-insano");
});
