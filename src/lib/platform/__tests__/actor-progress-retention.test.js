import assert from "node:assert/strict";
import test from "node:test";
import { selectActorPlatformState } from "../actorState.js";
import {
  appendAttempt,
  calculateSessionXp,
  completeSession,
  createPlatformState,
  normalizePlatformState,
  recordCampaignResult,
} from "../store.js";

function session(id, userId, overrides = {}) {
  return {
    id,
    userId,
    modeId: "sparring",
    groupId: "base",
    recordKey: "sparring:base:calmo",
    score: 100,
    correct: 5,
    accuracy: 1,
    bestCombo: 5,
    startedAt: 1,
    endedAt: 2,
    ...overrides,
  };
}

test("agregados do ator sobrevivem à compactação global de sessões e tentativas", () => {
  const liaSummary = session("lia-session", "user-lia", {
    campaignStageId: "stage-add",
    score: 500,
    correct: 10,
    accuracy: 0.9,
    stars: 2,
    passed: true,
    bestCombo: 3,
    endedAt: 10,
  });
  let state = createPlatformState(0);
  state = appendAttempt(state, {
    id: "lia-attempt",
    sessionId: liaSummary.id,
    userId: "user-lia",
    sectionId: "adicao",
    correct: true,
    combo: 3,
    responseTimeMs: 900,
    answeredAt: 9,
  });
  state = completeSession(state, liaSummary);
  state = recordCampaignResult(state, {
    id: "stage-add",
    targetAccuracy: 0.8,
  }, liaSummary, liaSummary.stars);

  for (let index = 0; index < 121; index += 1) {
    state = completeSession(state, session(`bia-session-${index}`, "user-bia", {
      endedAt: 100 + index,
    }));
  }
  for (let index = 0; index < 2_001; index += 1) {
    state = appendAttempt(state, {
      id: `bia-attempt-${index}`,
      sessionId: `bia-session-${index % 121}`,
      userId: "user-bia",
      sectionId: "subtracao",
      correct: true,
      combo: 1,
      responseTimeMs: 1_000,
      answeredAt: 1_000 + index,
    });
  }

  assert.equal(state.sessions.some((entry) => entry.userId === "user-lia"), false);
  assert.equal(state.attempts.some((entry) => entry.userId === "user-lia"), false);

  const lia = selectActorPlatformState(state, "user-lia");
  assert.equal(lia.profile.xp, calculateSessionXp(liaSummary));
  assert.equal(lia.sectionStats.adicao.attempts, 1);
  assert.equal(lia.sectionStats.adicao.correct, 1);
  assert.equal(lia.records.bestCombo, 3);
  assert.equal(lia.records.fastestCorrectMs, 900);
  assert.equal(lia.records.bestScore[liaSummary.recordKey], 500);
  assert.deepEqual(lia.campaign["stage-add"], {
    completed: true,
    attempts: 1,
    bestAccuracy: 0.9,
    bestScore: 500,
    stars: 2,
    lastPlayedAt: 10,
  });

  const roundTripped = normalizePlatformState(JSON.parse(JSON.stringify(state)));
  assert.equal(selectActorPlatformState(roundTripped, "user-lia").profile.xp, calculateSessionXp(liaSummary));
});

test("estado anterior ao multiusuário continua pertencendo ao convidado", () => {
  const state = createPlatformState(0);
  state.profile = { displayName: "Veterano", xp: 750, level: 4 };
  state.sectionStats.adicao = {
    attempts: 40,
    correct: 32,
    currentStreak: 2,
    bestStreak: 9,
    lastPlayedAt: 123,
  };
  state.records = {
    bestCombo: 9,
    fastestCorrectMs: 450,
    bestScore: { "sparring:base": 2_000 },
  };
  state.campaign = {
    "stage-add": { completed: true, attempts: 2, bestAccuracy: 1, bestScore: 2_000, stars: 3 },
  };

  const guest = selectActorPlatformState(state);
  assert.equal(guest.profile.xp, 750);
  assert.equal(guest.sectionStats.adicao.attempts, 40);
  assert.equal(guest.records.bestScore["sparring:base"], 2_000);
  assert.equal(guest.campaign["stage-add"].completed, true);

  const authenticated = selectActorPlatformState(state, "user-lia");
  assert.equal(authenticated.profile.xp, 0);
  assert.equal(authenticated.sectionStats.adicao.attempts, 0);
  assert.deepEqual(authenticated.campaign, {});

  const afterAuthenticatedPlay = completeSession(state, session("lia-new", "user-lia"));
  assert.equal(selectActorPlatformState(afterAuthenticatedPlay).profile.xp, 750);
  assert.equal(selectActorPlatformState(afterAuthenticatedPlay).sectionStats.adicao.attempts, 40);
});
