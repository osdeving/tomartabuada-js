import test from "node:test";
import assert from "node:assert/strict";

import {
  BASIC_MULTIPLICATION_PRESETS,
  BASIC_TIME_LEVELS,
  MEMORIZATION_OPERATIONS,
  MEMORIZATION_TIME_LEVELS,
  buildBasicCandidates,
  createBasicAttempt,
  createBasicTrainingConfig,
  createSeededRandom,
  getMemorizationPresets,
  rankBasicCandidates,
  resolveBasicProgression,
  selectBasicCandidate,
  selectMemorizationQuestion,
} from "../basicMemorization.js";

const NOW = 2_000_000_000_000;

test("expõe presets combináveis e quatro níveis de tempo", () => {
  assert.deepEqual(
    BASIC_MULTIPLICATION_PRESETS.map((preset) => preset.id),
    ["all", "no-squares", "six-to-nine", "above-three"],
  );
  assert.deepEqual(
    BASIC_TIME_LEVELS.map((level) => level.id),
    ["calm", "steady", "challenge", "reflex"],
  );
  assert.ok(
    BASIC_TIME_LEVELS.every(
      (level, index, levels) => index === 0 || level.multiplier < levels[index - 1].multiplier,
    ),
  );
});

test("fachada expõe operações e presets prontos para controles", () => {
  assert.deepEqual(
    MEMORIZATION_OPERATIONS.map(({ id }) => id),
    ["multiplication", "addition", "subtraction"],
  );
  assert.equal(MEMORIZATION_TIME_LEVELS, BASIC_TIME_LEVELS);
  assert.deepEqual(
    getMemorizationPresets("tabuada").map(({ id }) => id),
    ["all", "no-squares", "six-to-nine", "above-three"],
  );
  assert.deepEqual(
    getMemorizationPresets("adição").map(({ id }) => id),
    ["one-digit", "two-digits"],
  );
});

test("fachada materializa o contrato consumido pela sessão atual", () => {
  const question = selectMemorizationQuestion({
    operationId: "multiplication",
    presetId: "six-to-nine",
    timeLevel: "calm",
    seed: "contrato",
  });

  assert.deepEqual(
    pick(question, [
      "questionId",
      "id",
      "sectionId",
      "groupId",
      "answerType",
      "acceptsDecimal",
      "source",
      "sourceId",
      "sourceDocumentId",
      "timeLevel",
    ]),
    {
      questionId: question.id,
      id: question.id,
      sectionId: "tabuada",
      groupId: "memorizar-basico",
      answerType: "exact-number",
      acceptsDecimal: false,
      source: "generated",
      sourceId: question.id,
      sourceDocumentId: "memorizar-basico",
      timeLevel: "calm",
    },
  );
  assert.match(question.prompt, /^\d+ × \d+$/);
  assert.match(question.promptLatex, /^\d+ \\times \d+$/);
  assert.equal(question.answerDisplay, String(question.answer));
  assert.equal(question.answerInput, String(question.answer));
  assert.ok(question.patternTags.includes("memorizar-basico"));
  assert.ok(question.targetResponseMs > 0);
  assert.ok(question.responseWindowMs > question.targetResponseMs);
  assert.ok(question.responseWindowMs > 0);
});

test("fachada evita IDs recentes e carrega o aviso do nível semântico", () => {
  const first = selectMemorizationQuestion({
    operationId: "addition",
    presetId: "two-digits",
    difficultyMode: "fixed",
    difficultyTier: "unity-overflow",
    random: () => 0,
  });
  const next = selectMemorizationQuestion({
    operationId: "addition",
    presetId: "two-digits",
    difficultyMode: "fixed",
    difficultyTier: "unity-overflow",
    recentQuestionIds: [first.questionId],
    random: () => 0,
  });

  assert.notEqual(next.questionId, first.questionId);
  assert.equal(first.levelCue.code, "unity-overflow");
  assert.equal(first.levelCue.presentation, "toast");
  assert.ok(first.levelCue.durationMs < 1_500);
});

test("antirrepetição aceita ID visual ou skillKey e bloqueia a orientação inversa", () => {
  const candidates = buildBasicCandidates({ operation: "multiplication" });
  const eightBySeven = findOrderedFact(candidates, 8, 7);
  const sevenByEight = findOrderedFact(candidates, 7, 8);
  const afterVisualId = rankBasicCandidates(candidates, [], {
    excludeCandidateIds: [eightBySeven.id],
  });
  const afterSkillKey = rankBasicCandidates(candidates, [], {
    excludeCandidateIds: [eightBySeven.skillKey],
  });
  const facadeAfterId = selectMemorizationQuestion({
    operationId: "multiplication",
    recentQuestionIds: [eightBySeven.id],
    random: () => 0,
  });
  const facadeAfterSkill = selectMemorizationQuestion({
    operationId: "multiplication",
    recentQuestionIds: [eightBySeven.skillKey],
    random: () => 0,
  });

  assert.equal(eightBySeven.skillKey, sevenByEight.skillKey);
  assert.equal(
    afterVisualId.some(({ candidate }) => candidate.skillKey === eightBySeven.skillKey),
    false,
  );
  assert.equal(
    afterSkillKey.some(({ candidate }) => candidate.skillKey === eightBySeven.skillKey),
    false,
  );
  assert.notEqual(facadeAfterId.skillKey, eightBySeven.skillKey);
  assert.notEqual(facadeAfterSkill.skillKey, eightBySeven.skillKey);
});

test("tabuada completa cobre as 121 orientações e compartilha domínio comutativo", () => {
  const candidates = buildBasicCandidates({ operation: "multiplication" });
  const keys = new Set(candidates.map((candidate) => candidate.skillKey));
  const sevenByEight = findOrderedFact(candidates, 7, 8);
  const eightBySeven = findOrderedFact(candidates, 8, 7);

  assert.equal(candidates.length, 121);
  assert.equal(keys.size, 66);
  assert.ok(findFact(candidates, 0, 10));
  assert.ok(findFact(candidates, 10, 10));
  assert.notEqual(sevenByEight.id, eightBySeven.id);
  assert.equal(sevenByEight.skillKey, eightBySeven.skillKey);
  assert.equal(sevenByEight.answer, eightBySeven.answer);
  const sharedProfile = rankBasicCandidates(
    candidates,
    [createBasicAttempt(eightBySeven, {
      correct: false,
      responseTimeMs: eightBySeven.targetResponseMs,
      answeredAt: NOW,
    })],
    { now: NOW + 10 },
  ).find(({ candidate }) => candidate.id === sevenByEight.id).profile;
  assert.equal(sharedProfile.attempts, 1);
  assert.equal(sharedProfile.wrong, 1);
  assert.ok(candidates.every((candidate) => candidate.answer === candidate.left * candidate.right));
});

test("filtros de tabuada preservam tabela à esquerda e multiplicador à direita", () => {
  const noSquares = buildBasicCandidates({
    operation: "multiplication",
    presetIds: ["no-squares"],
  });
  const selectedTables = buildBasicCandidates({
    operation: "multiplication",
    presetIds: ["six-to-nine"],
  });
  const aboveThree = buildBasicCandidates({
    operation: "multiplication",
    presetIds: ["above-three"],
  });
  const hardSubset = buildBasicCandidates({
    operation: "multiplication",
    presetIds: ["six-to-nine", "above-three", "no-squares"],
  });

  assert.equal(noSquares.length, 110);
  assert.ok(noSquares.every((candidate) => candidate.left !== candidate.right));
  assert.equal(selectedTables.length, 44);
  assert.ok(selectedTables.every(({ left }) => left >= 6 && left <= 9));
  assert.ok(findOrderedFact(selectedTables, 8, 2));
  assert.equal(findOrderedFact(selectedTables, 2, 8), null);
  assert.equal(aboveThree.length, 77);
  assert.ok(aboveThree.every(({ right }) => right >= 4));
  assert.ok(findOrderedFact(aboveThree, 2, 8));
  assert.equal(findOrderedFact(aboveThree, 8, 2), null);
  assert.equal(hardSubset.length, 24);
  assert.ok(
    hardSubset.every(
      (candidate) =>
        candidate.left >= 6 &&
        candidate.left <= 9 &&
        candidate.right >= 4 &&
        candidate.left !== candidate.right,
    ),
  );
  assert.equal(findOrderedFact(hardSubset, 8, 2), null);
  assert.equal(findFact(hardSubset, 7, 7), null);
  assert.ok(findOrderedFact(hardSubset, 8, 7));
});

test("filtros explícitos permitem montar uma tabuada personalizada", () => {
  const candidates = buildBasicCandidates({
    operation: "multiplication",
    tables: [8],
    multipliers: [4, 5, 6],
  });

  assert.deepEqual(
    candidates.map(({ left, right }) => [left, right]),
    [[8, 4], [8, 5], [8, 6]],
  );
});

test("adição de um dígito mantém as orientações visuais no mesmo domínio", () => {
  const candidates = buildBasicCandidates({
    operation: "addition",
    presetId: "one-digit",
  });
  const keys = new Set(candidates.map((candidate) => candidate.skillKey));
  const sevenPlusEight = findOrderedFact(candidates, 7, 8);
  const eightPlusSeven = findOrderedFact(candidates, 8, 7);

  assert.equal(candidates.length, 36);
  assert.equal(keys.size, 20);
  assert.ok(candidates.every(({ answer }) => answer > 10));
  assert.ok(findOrderedFact(candidates, 7, 5));
  assert.notEqual(sevenPlusEight.id, eightPlusSeven.id);
  assert.equal(sevenPlusEight.skillKey, eightPlusSeven.skillKey);
  assert.equal(findFact(candidates, 7, 3), null);
  assert.equal(findFact(candidates, 5, 3), null);
  assert.ok(findOrderedFact(candidates, 5, 7));
});

test("adição de dois dígitos classifica a progressão e fornece avisos discretos", () => {
  const candidates = buildBasicCandidates({
    operation: "addition",
    presetId: "two-digits",
  });
  const easy = findFact(candidates, 83, 22);
  const unity = findFact(candidates, 76, 15);
  const double = findFact(candidates, 85, 67);

  assert.equal(candidates.length, 6_561);
  assert.equal(new Set(candidates.map(({ skillKey }) => skillKey)).size, 3_321);
  assert.ok(candidates.every(({ left, right }) => left % 10 !== 0 && right % 10 !== 0));
  assert.equal(findFact(candidates, 60, 15), null);
  assert.equal(easy.difficultyTier, "no-overflow");
  assert.equal(easy.notice, null);
  assert.equal(unity.difficultyTier, "unity-overflow");
  assert.deepEqual(
    pick(unity.notice, ["code", "label", "technicalLabel", "presentation"]),
    {
      code: "unity-overflow",
      label: "Vai um nas unidades",
      technicalLabel: "Unity overflow",
      presentation: "toast",
    },
  );
  assert.equal(double.difficultyTier, "double-overflow");
  assert.equal(double.notice.label, "Vai um duplo");
  assert.equal(double.notice.technicalLabel, "Double overflow");
  assert.ok(double.notice.durationMs < 1_500);
});

test("subtração de um dígito é não-negativa e elimina casos triviais", () => {
  const candidates = buildBasicCandidates({
    operation: "subtraction",
    presetId: "one-digit",
  });

  assert.ok(candidates.length > 0);
  assert.ok(
    candidates.every(
      ({ left, right, answer }) => left <= 9 && right >= 1 && left > right && answer > 0,
    ),
  );
  assert.equal(candidates.some(({ right }) => right === 0), false);
  assert.equal(candidates.some(({ left, right }) => left === right), false);
});

test("subtração de dois dígitos progride até empréstimo em cascata", () => {
  const candidates = buildBasicCandidates({
    operation: "subtraction",
    presetId: "two-digits",
  });
  const direct = findFact(candidates, 83, 22);
  const borrow = findFact(candidates, 83, 27);
  const cascade = findFact(candidates, 100, 27);

  assert.equal(direct.difficultyTier, "no-borrow");
  assert.equal(borrow.difficultyTier, "unity-borrow");
  assert.equal(borrow.notice.label, "Empréstimo nas unidades");
  assert.equal(cascade.difficultyTier, "cascade-borrow");
  assert.equal(cascade.features.boundaryBridge, true);
  assert.equal(cascade.answer, 73);

  const withoutBridge = buildBasicCandidates({
    operation: "subtraction",
    presetId: "two-digits",
    includeHundredBridge: false,
  });
  assert.equal(withoutBridge.some(({ left }) => left === 100), false);
});

test("níveis de tempo são graduais e preservam mais tempo para contas complexas", () => {
  const windows = BASIC_TIME_LEVELS.map(({ id }) => {
    const candidates = buildBasicCandidates({
      operation: "addition",
      presetId: "two-digits",
      timeLevel: id,
    });
    return findFact(candidates, 85, 67).responseWindowMs;
  });
  const steadyCandidates = buildBasicCandidates({
    operation: "addition",
    presetId: "two-digits",
    timeLevel: "steady",
  });

  assert.ok(windows.every((window, index) => index === 0 || window < windows[index - 1]));
  assert.ok(
    findFact(steadyCandidates, 85, 67).responseWindowMs >
      findFact(steadyCandidates, 83, 22).responseWindowMs,
  );
});

test("progressão adaptativa libera estágios por precisão e ritmo", () => {
  const candidates = buildBasicCandidates({
    operation: "addition",
    presetId: "two-digits",
  });
  const foundation = candidates.filter(({ difficultyTier }) => difficultyTier === "no-overflow");
  const unity = candidates.filter(({ difficultyTier }) => difficultyTier === "unity-overflow");
  const firstStageHistory = makeSuccessfulTierHistory(foundation, 8, 0);
  const afterFoundation = resolveBasicProgression(candidates, firstStageHistory);

  assert.equal(afterFoundation.activeTierId, "unity-overflow");
  assert.deepEqual(afterFoundation.eligibleTierIds, ["no-overflow", "unity-overflow"]);

  const secondStageHistory = [
    ...firstStageHistory,
    ...makeSuccessfulTierHistory(unity, 8, firstStageHistory.length),
  ];
  const afterUnity = resolveBasicProgression(candidates, secondStageHistory);

  assert.equal(afterUnity.activeTierId, "double-overflow");
  assert.deepEqual(afterUnity.eligibleTierIds, [
    "no-overflow",
    "unity-overflow",
    "double-overflow",
  ]);
});

test("queda recente faz a progressão adaptativa aliviar um estágio", () => {
  const candidates = buildBasicCandidates({
    operation: "addition",
    presetId: "two-digits",
  });
  const foundation = candidates.filter(({ difficultyTier }) => difficultyTier === "no-overflow");
  const unity = candidates.filter(({ difficultyTier }) => difficultyTier === "unity-overflow");
  const history = [
    ...makeSuccessfulTierHistory(foundation, 8, 0),
    ...unity.slice(0, 5).map((candidate, index) =>
      createBasicAttempt(candidate, {
        correct: false,
        responseTimeMs: candidate.responseWindowMs * 1.2,
        answeredAt: NOW + 20 + index,
      }),
    ),
  ];
  const progression = resolveBasicProgression(candidates, history);

  assert.equal(progression.activeTierId, "no-overflow");
  assert.equal(progression.reason, "recent-struggle");
});

test("modo fixo permite escolher um estágio exato", () => {
  const candidates = buildBasicCandidates({
    operation: "addition",
    presetId: "two-digits",
  });
  const selection = selectBasicCandidate(candidates, [], {
    difficultyMode: "fixed",
    difficultyTier: "double-overflow",
    random: () => 0,
  });

  assert.equal(selection.progression.mode, "fixed");
  assert.equal(selection.candidate.difficultyTier, "double-overflow");
  assert.ok(selection.ranked.every(({ candidate }) => candidate.difficultyTier === "double-overflow"));
});

test("erros e respostas lentas pesam muito mais que fatos dominados", () => {
  const candidates = buildBasicCandidates({
    operation: "multiplication",
    tables: [6, 7],
    multipliers: [7, 8],
  });
  const weak = findFact(candidates, 7, 8);
  const mastered = findFact(candidates, 6, 7);
  const history = [];

  for (let index = 0; index < 6; index += 1) {
    history.push(
      createBasicAttempt(mastered, {
        correct: true,
        responseTimeMs: mastered.responseWindowMs * 0.25,
        answeredAt: NOW + index * 2,
      }),
      createBasicAttempt(weak, {
        correct: index >= 4,
        responseTimeMs: weak.responseWindowMs * 0.95,
        answeredAt: NOW + index * 2 + 1,
      }),
    );
  }

  // Move recency away from both profiles equally.
  const neutral = candidates.find(
    ({ skillKey }) => skillKey !== weak.skillKey && skillKey !== mastered.skillKey,
  );
  history.push(
    ...Array.from({ length: 6 }, (_, index) =>
      createBasicAttempt(neutral, {
        correct: true,
        responseTimeMs: neutral.responseWindowMs * 0.6,
        answeredAt: NOW + 100 + index,
      }),
    ),
  );

  const ranked = rankBasicCandidates(candidates, history, { now: NOW + 200 });
  const weakWeight = ranked.find(({ candidate }) => candidate.skillKey === weak.skillKey).weight;
  const masteredWeight = ranked.find(
    ({ candidate }) => candidate.skillKey === mastered.skillKey,
  ).weight;

  assert.ok(weakWeight > masteredWeight * 20, `${weakWeight} should dwarf ${masteredWeight}`);
  assert.ok(masteredWeight > 0, "fato dominado nunca é banido completamente");
  assert.equal(ranked[0].candidate.skillKey, weak.skillKey);
});

test("fato frágil conserva frequência material diante de muitos inéditos", () => {
  const candidates = buildBasicCandidates({ operation: "multiplication" });
  const weak = findOrderedFact(candidates, 8, 7);
  const mastered = findOrderedFact(candidates, 7, 6);
  const fillerFacts = uniqueBySkill(
    candidates.filter(
      ({ skillKey }) => skillKey !== weak.skillKey && skillKey !== mastered.skillKey,
    ),
  ).slice(0, 10);
  const history = [
    ...Array.from({ length: 8 }, (_, index) =>
      createBasicAttempt(mastered, {
        correct: true,
        responseTimeMs: mastered.targetResponseMs * 0.2,
        answeredAt: NOW + index,
      }),
    ),
    ...Array.from({ length: 4 }, (_, index) =>
      createBasicAttempt(weak, {
        correct: index === 2,
        responseTimeMs: weak.targetResponseMs * 0.98,
        answeredAt: NOW + 20 + index,
      }),
    ),
    ...fillerFacts.map((candidate, index) =>
      createBasicAttempt(candidate, {
        correct: true,
        responseTimeMs: candidate.targetResponseMs * 0.65,
        answeredAt: NOW + 40 + index,
      }),
    ),
  ];
  const ranked = rankBasicCandidates(candidates, history, { now: NOW + 100 });
  const totalWeight = ranked.reduce((total, { weight }) => total + weight, 0);
  const probabilityFor = (skillKey) =>
    ranked
      .filter(({ candidate }) => candidate.skillKey === skillKey)
      .reduce((total, { weight }) => total + weight, 0) / totalWeight;
  const weakProbability = probabilityFor(weak.skillKey);
  const masteredProbability = probabilityFor(mastered.skillKey);

  assert.ok(weakProbability >= 0.08, `fato frágil ficou em ${formatPercent(weakProbability)}`);
  assert.ok(masteredProbability <= 0.003, `fato instantâneo ficou em ${formatPercent(masteredProbability)}`);
  assert.ok(weakProbability >= masteredProbability * 30);
});

test("recência evita repetição imediata sem zerar a revisão", () => {
  const candidates = buildBasicCandidates({
    operation: "multiplication",
    tables: [7],
    multipliers: [6, 8, 9],
  });
  const recentCandidate = candidates[0];
  const staleCandidate = candidates[1];
  const fillerCandidate = candidates[2];
  const history = [
    createBasicAttempt(staleCandidate, {
      correct: false,
      responseTimeMs: staleCandidate.responseWindowMs,
      answeredAt: NOW,
    }),
    createBasicAttempt(recentCandidate, {
      correct: false,
      responseTimeMs: recentCandidate.responseWindowMs,
      answeredAt: NOW + 1,
    }),
    ...Array.from({ length: 5 }, (_, index) =>
      createBasicAttempt(fillerCandidate, {
        correct: true,
        responseTimeMs: fillerCandidate.responseWindowMs * 0.6,
        answeredAt: NOW + 2 + index,
      }),
    ),
    createBasicAttempt(recentCandidate, {
      correct: false,
      responseTimeMs: recentCandidate.responseWindowMs,
      answeredAt: NOW + 20,
    }),
  ];
  const ranked = rankBasicCandidates(candidates, history, { now: NOW + 21 });
  const recentWeight = ranked.find(
    ({ candidate }) => candidate.skillKey === recentCandidate.skillKey,
  ).weight;
  const staleWeight = ranked.find(
    ({ candidate }) => candidate.skillKey === staleCandidate.skillKey,
  ).weight;

  assert.ok(staleWeight > recentWeight);
  assert.ok(recentWeight > 0);
});

test("seed e gerador injetável tornam a seleção reproduzível", () => {
  const candidates = buildBasicCandidates({
    operation: "multiplication",
    presetIds: ["six-to-nine", "above-three"],
  });
  const firstRandom = createSeededRandom("sessao-42");
  const secondRandom = createSeededRandom("sessao-42");
  const firstSequence = Array.from({ length: 8 }, () =>
    selectBasicCandidate(candidates, [], { random: firstRandom }).candidate.id,
  );
  const secondSequence = Array.from({ length: 8 }, () =>
    selectBasicCandidate(candidates, [], { random: secondRandom }).candidate.id,
  );

  assert.deepEqual(firstSequence, secondSequence);
  assert.equal(
    selectBasicCandidate(candidates, [], { seed: "fixa" }).candidate.id,
    selectBasicCandidate(candidates, [], { seed: "fixa" }).candidate.id,
  );
});

test("configuração rejeita valores desconhecidos cedo", () => {
  assert.throws(
    () => createBasicTrainingConfig({ operation: "division" }),
    /Unknown operation/,
  );
  assert.throws(
    () =>
      createBasicTrainingConfig({
        operation: "multiplication",
        presetIds: ["impossível"],
      }),
    /Unknown presetIds/,
  );
  assert.throws(
    () => createBasicTrainingConfig({ operation: "addition", timeLevel: "warp" }),
    /Unknown timeLevel/,
  );
});

function makeSuccessfulTierHistory(candidates, count, offset) {
  return Array.from({ length: count }, (_, index) => {
    const candidate = candidates[index % Math.min(candidates.length, 6)];
    return createBasicAttempt(candidate, {
      correct: true,
      responseTimeMs: candidate.responseWindowMs * 0.45,
      answeredAt: NOW + offset + index,
    });
  });
}

function findFact(candidates, first, second) {
  return candidates.find(
    ({ left, right }) =>
      (left === first && right === second) || (left === second && right === first),
  ) ?? null;
}

function findOrderedFact(candidates, left, right) {
  return candidates.find((candidate) => candidate.left === left && candidate.right === right) ?? null;
}

function uniqueBySkill(candidates) {
  const seen = new Set();
  return candidates.filter(({ skillKey }) => {
    if (seen.has(skillKey)) return false;
    seen.add(skillKey);
    return true;
  });
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function pick(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}
