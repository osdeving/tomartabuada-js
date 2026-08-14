import assert from "node:assert/strict";
import test from "node:test";
import { selectActorPlatformState } from "../actorState.js";

function fixture() {
  return {
    settings: { theme: "neon", questionCount: 15 },
    selectedGroupId: "misto",
    customConfiguration: { stays: true },
    profile: { displayName: "Perfil local", xp: 99_999, level: 400 },
    sectionStats: {
      addition: { attempts: 999, correct: 999, currentStreak: 999, bestStreak: 999, lastPlayedAt: 999, label: "Adição" },
      division: { attempts: 999, correct: 999, currentStreak: 999, bestStreak: 999, lastPlayedAt: 999 },
    },
    attempts: [
      { id: "lia-3", userId: "user-lia", sectionId: "addition", correct: true, combo: 2, responseTimeMs: 800, answeredAt: 300 },
      { id: "bia-1", userId: "user-bia", sectionId: "division", correct: true, combo: 8, responseTimeMs: 200, answeredAt: 250 },
      { id: "lia-2", userId: "user-lia", sectionId: "addition", correct: false, combo: 0, responseTimeMs: 1_000, answeredAt: 200 },
      { id: "guest-1", sectionId: "addition", correct: true, combo: 12, responseTimeMs: 100, answeredAt: 150 },
      { id: "lia-1", userId: "user-lia", sectionId: "addition", correct: true, combo: 1, responseTimeMs: 1_200, answeredAt: 100 },
    ],
    sessions: [
      {
        id: "lia-campaign-2",
        userId: "user-lia",
        modeId: "campanha",
        groupId: "addition",
        recordKey: "campanha:addition:calmo",
        campaignStageId: "stage-add",
        score: 400,
        correct: 8,
        accuracy: 0.8,
        stars: 2,
        passed: true,
        xpEarned: 36,
        bestCombo: 5,
        endedAt: 400,
      },
      {
        id: "bia-session",
        userId: "user-bia",
        modeId: "sparring",
        groupId: "division",
        score: 2_000,
        correct: 20,
        xpEarned: 140,
        bestCombo: 20,
        endedAt: 350,
      },
      {
        id: "lia-campaign-1",
        userId: "user-lia",
        modeId: "campanha",
        groupId: "addition",
        recordKey: "campanha:addition:calmo",
        campaignStageId: "stage-add",
        score: 280,
        correct: 5,
        accuracy: 0.5,
        stars: 1,
        passed: false,
        bestCombo: 3,
        endedAt: 180,
      },
      {
        id: "lia-legacy-record",
        userId: "user-lia",
        modeId: "sparring",
        groupId: "misto",
        score: 300,
        correct: 4,
        xpEarned: null,
        bestCombo: 4,
        endedAt: 120,
      },
      {
        id: "guest-session",
        modeId: "sparring",
        groupId: "misto",
        score: 900,
        correct: 10,
        xpEarned: 65,
        bestCombo: 10,
        endedAt: 90,
      },
    ],
    campaign: { foreign: { completed: true } },
    records: {
      bestCombo: 999,
      fastestCorrectMs: 1,
      bestScore: { foreign: 999_999 },
      customRecordSetting: true,
    },
  };
}

test("projeta somente tentativas e sessões do ator sem perder configuração compartilhada", () => {
  const state = fixture();
  const projected = selectActorPlatformState(state, " user-lia ");

  assert.deepEqual(projected.attempts.map((attempt) => attempt.id), ["lia-3", "lia-2", "lia-1"]);
  assert.deepEqual(projected.sessions.map((session) => session.id), [
    "lia-campaign-2",
    "lia-campaign-1",
    "lia-legacy-record",
  ]);
  assert.strictEqual(projected.settings, state.settings);
  assert.strictEqual(projected.customConfiguration, state.customConfiguration);
  assert.notStrictEqual(projected, state);
  assert.deepEqual(state.records.bestScore, { foreign: 999_999 });
});

test("recalcula perfil e recordes exclusivamente das sessões e tentativas do ator", () => {
  const projected = selectActorPlatformState(fixture(), "user-lia");

  // 36 explícitos + (280 / 20 arredondado + 5 * 2) + (300 / 20 + 4 * 2)
  assert.deepEqual(projected.profile, { displayName: "Perfil local", xp: 83, level: 1 });
  assert.deepEqual(projected.records.bestScore, {
    "campanha:addition:calmo": 400,
    "sparring:misto": 300,
  });
  assert.equal(projected.records.bestCombo, 5);
  assert.equal(projected.records.fastestCorrectMs, 800);
  assert.equal(projected.records.customRecordSetting, true);
});

test("reconstrói estatísticas por seção em ordem cronológica", () => {
  const projected = selectActorPlatformState(fixture(), "user-lia");

  assert.deepEqual(projected.sectionStats.addition, {
    label: "Adição",
    attempts: 3,
    correct: 2,
    currentStreak: 1,
    bestStreak: 1,
    lastPlayedAt: 300,
  });
  assert.deepEqual(projected.sectionStats.division, {
    attempts: 0,
    correct: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedAt: 0,
  });
});

test("deriva campanha por campaignStageId e mantém os melhores resultados", () => {
  const projected = selectActorPlatformState(fixture(), "user-lia");

  assert.deepEqual(projected.campaign, {
    "stage-add": {
      completed: true,
      attempts: 2,
      bestAccuracy: 0.8,
      bestScore: 400,
      stars: 2,
      lastPlayedAt: 400,
    },
  });
});

test("actorId vazio representa convidado e não herda progresso autenticado", () => {
  const projected = selectActorPlatformState(fixture());

  assert.deepEqual(projected.attempts.map((attempt) => attempt.id), ["guest-1"]);
  assert.deepEqual(projected.sessions.map((session) => session.id), ["guest-session"]);
  assert.equal(projected.profile.xp, 65);
  assert.equal(projected.profile.level, 1);
  assert.equal(projected.records.bestCombo, 12);
  assert.deepEqual(projected.records.bestScore, { "sparring:misto": 900 });
});

test("tolera estado vazio e entradas legadas sem timestamp", () => {
  assert.deepEqual(selectActorPlatformState(null), {
    profile: { xp: 0, level: 1 },
    sectionStats: {},
    attempts: [],
    sessions: [],
    campaign: {},
    records: { bestScore: {}, bestCombo: 0, fastestCorrectMs: null },
  });

  const projected = selectActorPlatformState({
    attempts: [
      { id: "newest", sectionId: "addition", correct: true },
      { id: "middle", sectionId: "addition", correct: true },
      { id: "oldest", sectionId: "addition", correct: false },
    ],
    sessions: [],
  });
  assert.deepEqual(projected.sectionStats.addition, {
    attempts: 3,
    correct: 2,
    currentStreak: 2,
    bestStreak: 2,
    lastPlayedAt: 0,
  });
});
