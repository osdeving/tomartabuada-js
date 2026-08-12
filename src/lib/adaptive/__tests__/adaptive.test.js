import test from "node:test";
import assert from "node:assert/strict";

import {
  SessionRevisionConflictError,
  assessDifficulty,
  buildLearnerReport,
  createMemoryStorageAdapter,
  createPracticeSession,
  createSessionRepository,
  detectFatigue,
  recommendTheory,
  recordSessionAttempt,
  selectNextChallenge,
} from "../index.js";

const NOW = 1_900_000_000_000;

function attempt(index, overrides = {}) {
  return {
    id: `a-${index}`,
    timestamp: NOW - (30 - index) * 10_000,
    groupId: "tabuada",
    sectionId: "tabuada",
    skillKey: `mul:${index % 4}:${index % 7}`,
    patternKey: "tabuada-geral",
    difficulty: 5,
    correct: true,
    responseTimeMs: 3_000,
    responseWindowMs: 10_000,
    ...overrides,
  };
}

test("reduz bastante a dificuldade depois de uma sequência de erros", () => {
  const attempts = Array.from({ length: 6 }, (_, index) =>
    attempt(index, { correct: false, responseTimeMs: 9_500 }),
  );
  const assessment = assessDifficulty(attempts, 6);

  assert.equal(assessment.nextLevel, 4);
  assert.equal(assessment.delta, -2);
  assert.equal(assessment.reasonCode, "error-streak");
});

test("aumenta a dificuldade quando precisão e ritmo mostram domínio", () => {
  const attempts = Array.from({ length: 10 }, (_, index) =>
    attempt(index, { correct: true, responseTimeMs: 3_500 }),
  );
  const assessment = assessDifficulty(attempts, 5);

  assert.equal(assessment.nextLevel, 7);
  assert.equal(assessment.delta, 2);
  assert.equal(assessment.reasonCode, "mastered-fast");
});

test("liga um padrão de erro recorrente à teoria configurada por dados", () => {
  const attempts = Array.from({ length: 5 }, (_, index) =>
    attempt(index, {
      correct: index === 4,
      patternKey: "vai-um",
      skillKey: `add:27:${index + 6}`,
      groupId: "adicao",
    }),
  );
  const recommendations = recommendTheory(attempts, [
    {
      id: "soma-esquerda",
      title: "Somar da esquerda para a direita",
      patternKeys: ["vai-um"],
    },
  ]);

  assert.equal(recommendations[0].topicId, "soma-esquerda");
  assert.match(recommendations[0].reason, /4 de 5/);
});

test("detecta fadiga por queda de precisão, ritmo e erros atípicos", () => {
  const baseline = Array.from({ length: 8 }, (_, index) =>
    attempt(index, {
      timestamp: NOW - (40 - index) * 60_000,
      skillKey: "mul:7:8",
      responseTimeMs: 3_000,
      correct: index !== 7,
    }),
  );
  const recent = Array.from({ length: 8 }, (_, index) =>
    attempt(index + 10, {
      timestamp: NOW - (11 * 60_000) + index * 30_000,
      skillKey: "mul:7:8",
      responseTimeMs: 9_000,
      correct: index < 2,
    }),
  );
  const fatigue = detectFatigue(recent, { baselineAttempts: baseline, now: NOW });

  assert.equal(fatigue.isFatigued, true);
  assert.ok(fatigue.evidence.includes("uncharacteristic-errors"));
  assert.match(fatigue.message, /Tome um ar/);
});

test("seleção adaptativa respeita grupos e favorece fonte do livro em falta", () => {
  const candidates = [
    {
      id: "book-1",
      groupId: "adicao",
      skillKey: "add:7:8",
      patternKey: "passa-10",
      source: "book",
      difficulty: 3,
    },
    {
      id: "generated-1",
      groupId: "adicao",
      skillKey: "add:6:9",
      patternKey: "passa-10",
      source: "generated",
      difficulty: 3,
    },
    {
      id: "outside-group",
      groupId: "divisao",
      skillKey: "div:42:7",
      difficulty: 3,
    },
  ];
  const result = selectNextChallenge(candidates, {
    groupIds: ["adicao"],
    currentDifficulty: 3,
    random: () => 0,
  });

  assert.equal(result.challenge.id, "book-1");
  assert.equal(result.ranked.some((entry) => entry.challengeId === "outside-group"), false);
});

test("sobrevivência perde vidas e encerra na terceira falha", () => {
  let session = createPracticeSession({
    id: "survival-test",
    mode: "survival",
    startedAt: NOW - 60_000,
  });

  for (let index = 0; index < 3; index += 1) {
    session = recordSessionAttempt(
      session,
      attempt(index, { correct: false, timestamp: NOW + index }),
      { now: NOW + index },
    ).session;
  }

  assert.equal(session.modeState.lives, 0);
  assert.equal(session.status, "game-over");
  assert.equal(session.attempts.length, 3);
});

test("resposta fora do tempo quebra combo e custa vida na sobrevivência", () => {
  const session = createPracticeSession({
    id: "timeout-test",
    mode: "survival",
    startedAt: NOW - 60_000,
  });
  const result = recordSessionAttempt(
    session,
    attempt(1, {
      correct: true,
      responseTimeMs: 12_000,
      responseWindowMs: 10_000,
      timestamp: NOW,
    }),
    { now: NOW },
  );

  assert.equal(result.session.currentCombo, 0);
  assert.equal(result.session.modeState.lives, 2);
  assert.equal(result.session.modeState.correctInRun, 0);
});

test("modo sem cronômetro mede lentidão sem transformar a resposta correta em timeout", () => {
  const session = createPracticeSession({ id: "untimed-test", startedAt: NOW });
  const result = recordSessionAttempt(
    session,
    attempt(1, {
      correct: true,
      timedOut: false,
      responseTimeMs: 18_000,
      responseWindowMs: 8_000,
      timestamp: NOW + 18_000,
    }),
    { now: NOW + 18_000 },
  );

  assert.equal(result.event.attempt.correct, true);
  assert.equal(result.event.attempt.timedOut, false);
  assert.equal(result.session.currentCombo, 1);
  assert.ok(result.event.attempt.paceRatio > 2);
});

test("elogia combo e avisa quando o recorde anterior é superado", () => {
  const previous = {
    id: "previous",
    mode: "sparring",
    status: "completed",
    startedAt: NOW - 1_000_000,
    endedAt: NOW - 900_000,
    attempts: [attempt(1), attempt(2)],
  };
  let session = createPracticeSession({ id: "combo-test", startedAt: NOW });
  let result;

  for (let index = 0; index < 3; index += 1) {
    result = recordSessionAttempt(
      session,
      attempt(index + 10, { timestamp: NOW + index + 1 }),
      { now: NOW + index + 1, previousSessions: [previous] },
    );
    session = result.session;
  }

  assert.ok(result.event.messages.some((message) => message.type === "combo"));
  assert.ok(
    result.event.messages.some(
      (message) => message.type === "personal-record" && message.record === "bestCombo",
    ),
  );
});

test("campanha avança e conclui etapas descritas em JSON", () => {
  const campaign = {
    id: "mini",
    title: "Mini campanha",
    stages: [
      {
        id: "one",
        title: "Um passo",
        groupIds: ["tabuada"],
        difficulty: 2,
        targetCorrect: 1,
        minimumAttempts: 1,
        minimumAccuracy: 1,
      },
    ],
  };
  const session = createPracticeSession({ mode: "campaign", campaign, startedAt: NOW });
  const result = recordSessionAttempt(
    session,
    attempt(1, { correct: true, timestamp: NOW + 1 }),
    { now: NOW + 1 },
  );

  assert.equal(result.session.status, "completed");
  assert.deepEqual(result.session.modeState.completedStageIds, ["one"]);
  assert.ok(result.event.messages.some((message) => message.type === "campaign-completed"));
});

test("repositório local persiste JSON e protege contra escrita concorrente", () => {
  const adapter = createMemoryStorageAdapter();
  const repository = createSessionRepository({ adapter, key: "test.sessions" });
  const session = createPracticeSession({ id: "stored", startedAt: NOW });
  const firstWrite = repository.saveSession(session);

  assert.equal(firstWrite.revision, 1);
  assert.equal(repository.getSession("stored").id, "stored");
  assert.throws(
    () => repository.saveSession(session, { expectedRevision: 0 }),
    SessionRevisionConflictError,
  );
  assert.equal(JSON.parse(repository.exportJson()).sessions.length, 1);
});

test("relatório mantém visão geral e separação por grupos", () => {
  const session = {
    id: "report",
    mode: "sparring",
    status: "completed",
    startedAt: NOW,
    endedAt: NOW + 100_000,
    attempts: [
      attempt(1, { groupId: "adicao", correct: true }),
      attempt(2, { groupId: "adicao", correct: false }),
      attempt(3, { groupId: "tabuada", correct: true }),
    ],
  };
  const report = buildLearnerReport([session], { now: NOW + 200_000 });

  assert.equal(report.overall.attempts, 3);
  assert.deepEqual(
    report.groups.map((group) => group.groupId).sort(),
    ["adicao", "tabuada"],
  );
  assert.equal(report.sessionCount, 1);
});
