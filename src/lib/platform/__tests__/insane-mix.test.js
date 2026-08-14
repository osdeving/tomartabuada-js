import assert from "node:assert/strict";
import test from "node:test";

import { answersMatch, normalizeUserAnswer } from "../answers.js";
import {
  INSANE_MIX_CATALOG,
  INSANE_MIX_GENERATOR_IDS,
  INSANE_MIX_GROUP_ID,
  createInsaneMixRandom,
  evaluateInsaneExpression,
  formatInsaneExpression,
  formatInsaneExpressionLatex,
  generateInsaneMixQuestion,
  getInsaneMixTargetRating,
  rankInsaneMixPatterns,
  selectInsaneMixQuestion,
  validateInsaneMixCatalog,
} from "../insaneMix.js";

test("valida o catálogo, geradores e todas as referências orientadas por dados", () => {
  assert.equal(validateInsaneMixCatalog(INSANE_MIX_CATALOG), INSANE_MIX_CATALOG);
  assert.equal(INSANE_MIX_GROUP_ID, "mix-insano");
  assert.equal(INSANE_MIX_CATALOG.schemaVersion, 1);

  const patternIds = new Set(INSANE_MIX_CATALOG.patterns.map((pattern) => pattern.id));
  const groupIds = new Set(INSANE_MIX_CATALOG.groups.map((group) => group.id));
  const grouped = new Set(INSANE_MIX_CATALOG.groups.flatMap((group) => group.patternIds));
  const progressed = new Set(INSANE_MIX_CATALOG.progression.flatMap((entry) => entry.groupIds));
  assert.deepEqual(grouped, patternIds);
  assert.deepEqual(progressed, groupIds);
  assert.deepEqual(
    new Set(INSANE_MIX_CATALOG.patterns.map((pattern) => pattern.generator)),
    new Set(INSANE_MIX_GENERATOR_IDS),
  );

  const unknownGenerator = structuredClone(INSANE_MIX_CATALOG);
  unknownGenerator.patterns[0].generator = "eval-string";
  assert.throws(() => validateInsaneMixCatalog(unknownGenerator), /Unknown Insane Mix generator/);

  const brokenGroupReference = structuredClone(INSANE_MIX_CATALOG);
  brokenGroupReference.groups[0].patternIds[0] = "missing.pattern";
  assert.throws(() => validateInsaneMixCatalog(brokenGroupReference), /unknown pattern/);

  const brokenProgressionReference = structuredClone(INSANE_MIX_CATALOG);
  brokenProgressionReference.progression[0].groupIds[0] = "missing-group";
  assert.throws(() => validateInsaneMixCatalog(brokenProgressionReference), /unknown group/);

  const brokenNodeReference = structuredClone(INSANE_MIX_CATALOG);
  const compound = brokenNodeReference.patterns.find((pattern) =>
    pattern.generator === "compound-expression");
  compound.params.requiredNode = "javascript-expression";
  assert.throws(() => validateInsaneMixCatalog(brokenNodeReference), /unknown node/);

  const brokenCurve = structuredClone(INSANE_MIX_CATALOG);
  brokenCurve.selection.scoreEvidenceStep = 0;
  assert.throws(() => validateInsaneMixCatalog(brokenCurve), /scoreEvidenceStep/);

  const lateProgression = structuredClone(INSANE_MIX_CATALOG);
  lateProgression.progression[0].minRating += 1;
  assert.throws(() => validateInsaneMixCatalog(lateProgression), /must start at ratingScale.min/);

  const duplicateMembership = structuredClone(INSANE_MIX_CATALOG);
  duplicateMembership.groups[1].patternIds.push(duplicateMembership.groups[0].patternIds[0]);
  assert.throws(() => validateInsaneMixCatalog(duplicateMembership), /exactly one group/);

  const unknownOperation = structuredClone(INSANE_MIX_CATALOG);
  unknownOperation.patterns[0].operations.push("modulo");
  assert.throws(() => validateInsaneMixCatalog(unknownOperation), /unknown operation/);

  const malformedNestedRange = structuredClone(INSANE_MIX_CATALOG);
  delete malformedNestedRange.patterns[0].params.left.max;
  assert.throws(() => validateInsaneMixCatalog(malformedNestedRange), /both min and max/);
});

test("todos os padrões materializam o contrato da sessão e corrigem pelo answers.js", () => {
  const generatorIds = new Set();
  const questionIds = new Set();

  for (const pattern of INSANE_MIX_CATALOG.patterns) {
    const seed = `contract:${pattern.id}`;
    const question = generateInsaneMixQuestion(pattern, { seed });
    const replay = generateInsaneMixQuestion(pattern.id, { seed });
    const evaluated = evaluateInsaneExpression(question.expressionAst);
    const patternGroup = INSANE_MIX_CATALOG.groups.find((group) =>
      group.patternIds.includes(pattern.id));

    assert.equal(question.id, replay.id, `${pattern.id}: ID precisa depender do conteúdo`);
    assert.equal(question.expressionSignature, replay.expressionSignature, pattern.id);
    assert.match(question.id, new RegExp(`^insane:${escapeRegExp(pattern.id)}:[a-z0-9]+$`));
    assert.equal(question.questionId, question.id);
    assert.equal(question.sourceId, question.id);
    assert.equal(question.sectionId, INSANE_MIX_GROUP_ID);
    assert.equal(question.groupId, INSANE_MIX_GROUP_ID);
    assert.equal(question.patternKey, pattern.id);
    assert.equal(question.generatorId, pattern.generator);
    assert.equal(question.patternGroupId, patternGroup.id);
    assert.equal(question.patternGroupLabel, patternGroup.label);
    assert.equal(question.difficultyRating, pattern.difficultyRating);
    assert.equal(question.difficultyLabel, `D${pattern.difficultyRating} · ${pattern.label}`);
    assert.equal(question.responseWindowMs, pattern.targetResponseMs);
    assert.equal(question.targetResponseMs, pattern.targetResponseMs);
    assert.ok(question.atomIds.includes(pattern.id));
    assert.ok(question.features.length > 0);
    assert.ok(question.operations.length > 0);
    assert.ok(question.operations.every((operation) => pattern.operations.includes(operation)), pattern.id);
    assert.equal(evaluated.input, question.answerInput, pattern.id);
    assert.equal(evaluated.display, question.answerDisplay, pattern.id);
    assert.equal(evaluated.value, question.answer, pattern.id);
    assert.equal(question.answerDisplay, question.answerInput.replace(".", ","));
    assert.ok(Number.isFinite(question.answer));
    assert.ok(Math.abs(question.answer) <= Number.MAX_SAFE_INTEGER);
    assert.equal(
      answersMatch(normalizeUserAnswer(question.answerInput, question), question),
      true,
      `${pattern.id}: resposta com ponto`,
    );
    assert.equal(
      answersMatch(normalizeUserAnswer(question.answerDisplay, question), question),
      true,
      `${pattern.id}: resposta exibida em pt-BR`,
    );
    assertStrictDecimalPrefixIsWrong(question);
    assert.doesNotThrow(() => JSON.stringify(question.expressionAst));
    assert.ok(question.prompt.length > 0);
    assert.ok(question.promptLatex.length > 0);

    generatorIds.add(question.generatorId);
    questionIds.add(question.id);
  }

  assert.deepEqual(generatorIds, new Set(INSANE_MIX_GENERATOR_IDS));
  assert.equal(questionIds.size, INSANE_MIX_CATALOG.patterns.length);
});

test("avalia racionalmente decimal, precedência, porcentagem, potência e raiz", () => {
  const difficultDecimal = binary(
    "sub",
    binary("add", literal(137, 10), literal(58, 10)),
    binary("mul", literal(48, 10), literal(37)),
  );
  assert.deepEqual(evaluateInsaneExpression(difficultDecimal), {
    numerator: "-1581",
    denominator: "10",
    input: "-158.1",
    display: "-158,1",
    value: -158.1,
  });
  assert.equal(formatInsaneExpression(difficultDecimal), "13,7 + 5,8 − 4,8 × 37");
  assert.equal(
    formatInsaneExpressionLatex(difficultDecimal),
    "13{,}7 + 5{,}8 - 4{,}8 \\times 37",
  );

  const specialNodes = binary(
    "add",
    { type: "percent-of", percent: literal(15), value: literal(1300) },
    binary(
      "sub",
      { type: "power", base: literal(10), exponent: 3 },
      { type: "root", degree: 2, radicand: literal(289) },
    ),
  );
  assert.equal(evaluateInsaneExpression(specialNodes).input, "1178");
  assert.match(formatInsaneExpression(specialNodes), /15% de 1300/);
  assert.match(formatInsaneExpressionLatex(specialNodes), /15\\%/);
  assert.match(formatInsaneExpressionLatex(specialNodes), /10\^\{3\}/);
  assert.match(formatInsaneExpressionLatex(specialNodes), /\\sqrt\{289\}/);
  assert.throws(
    () => evaluateInsaneExpression(binary("div", literal(1), literal(0))),
    /Division by zero/,
  );
});

test("progressão da sessão permanece leve e só chega ao brutal com evidência longa", () => {
  const ratingAt = (correctAnswers) => getInsaneMixTargetRating({
    currentDifficulty: 10,
    attempts: fastAttempts(correctAnswers),
  });
  const curve = [0, 8, 40, 80, 100].map(ratingAt);
  assert.ok(curve.every((rating, index) => index === 0 || rating >= curve[index - 1]));
  assert.ok(curve[0] <= 3, `sem evidência: ${curve[0]}`);
  assert.ok(curve[1] >= 10 && curve[1] <= 15, `8 acertos: ${curve[1]}`);
  assert.ok(curve[2] >= 40 && curve[2] <= 55, `40 acertos: ${curve[2]}`);
  assert.ok(curve[3] >= 90, `80 acertos: ${curve[3]}`);
  assert.ok(curve[4] >= curve[3]);

  assert.equal(getInsaneMixTargetRating({
    currentDifficulty: 10,
    baselineAttempts: fastAttempts(120),
    attempts: [],
  }), 1, "histórico anterior não pula a abertura leve da sessão");

  for (let seed = 0; seed < 500; seed += 1) {
    const opening = selectInsaneMixQuestion({
      currentDifficulty: 10,
      attempts: [],
      seed: `opening:${seed}`,
    });
    assert.ok(opening.difficultyRating <= 3, `${opening.patternKey} abriu em D${opening.difficultyRating}`);
    assert.equal(opening.patternGroupId, "foundation");
  }

  const medium = selectInsaneMixQuestion({
    currentDifficulty: 10,
    attempts: fastAttempts(40),
    seed: "middle",
  });
  const brutal = selectInsaneMixQuestion({
    currentDifficulty: 10,
    attempts: fastAttempts(80),
    seed: "brutal",
  });
  assert.ok(medium.difficultyRating >= 39 && medium.difficultyRating <= 52);
  assert.ok(brutal.difficultyRating >= 90);
});

test("grupos OR controlam unlock, exploração, recência e remediação", () => {
  const opening = rankInsaneMixPatterns({ targetRating: 1 });
  assert.ok(opening.every((entry) => entry.pattern.difficultyRating <= 3));
  assert.ok(opening.every((entry) => groupFor(entry.pattern.id).id === "foundation"));

  const frontier = rankInsaneMixPatterns({ targetRating: 14 });
  const exploration = frontier.find((entry) => entry.pattern.id === "add.single-carry");
  assert.ok(exploration);
  assert.ok(exploration.reasons.includes("exploração controlada do próximo grupo"));
  assert.ok(frontier.every((entry) =>
    groupFor(entry.pattern.id).id === "foundation" || entry.pattern.id === exploration.pattern.id));

  const patternId = "add.single-carry";
  const unseen = ranked(patternId, { targetRating: 15 });
  const immediate = ranked(patternId, {
    targetRating: 15,
    attempts: [attempt("recent", patternId, true, 10)],
  });
  assert.ok(immediate.weight < unseen.weight, "recência deve reduzir repetição imediata");

  const fillers = Array.from({ length: 4 }, (_, index) =>
    attempt(`filler-${index}`, "sub.single-borrow", true, 20 + index));
  const remediated = ranked(patternId, {
    targetRating: 15,
    attempts: [attempt("weak", patternId, false, 10), ...fillers],
  });
  const mastered = ranked(patternId, {
    targetRating: 15,
    attempts: [attempt("strong", patternId, true, 10), ...fillers],
  });
  assert.ok(remediated.weight > mastered.weight, "erros antigos devem receber remediação");

  const duplicate = attempt("same-id", patternId, false, 30);
  const deduplicated = ranked(patternId, {
    targetRating: 15,
    baselineAttempts: [duplicate],
    attempts: [duplicate],
  });
  const single = ranked(patternId, { targetRating: 15, attempts: [duplicate] });
  assert.equal(deduplicated.weight, single.weight);
});

test("candidateBatchSize limita o ranking e preserva probabilidades normalizadas", () => {
  const catalog = structuredClone(INSANE_MIX_CATALOG);
  catalog.selection.candidateBatchSize = 2;
  const rankedPatterns = rankInsaneMixPatterns({ catalog, targetRating: 47 });
  assert.equal(rankedPatterns.length, 2);
  assert.ok(Math.abs(rankedPatterns.reduce((sum, entry) => sum + entry.probability, 0) - 1) < 1e-12);
});

test("composições honram operações mínimas, precedência e subpadrões configurados", () => {
  const constrainedPatterns = INSANE_MIX_CATALOG.patterns.filter((pattern) =>
    pattern.params.minimumDistinctOperations != null
    || pattern.params.minimumPrecedenceDepth != null);
  for (const pattern of constrainedPatterns) {
    for (let index = 0; index < 20; index += 1) {
      const question = generateInsaneMixQuestion(pattern, { seed: `constraints:${pattern.id}:${index}` });
      assert.ok(
        question.operations.length >= (pattern.params.minimumDistinctOperations ?? 0),
        pattern.id,
      );
      assert.ok(
        question.precedenceDepth >= (pattern.params.minimumPrecedenceDepth ?? 0),
        pattern.id,
      );
    }
  }

  const seenPercentPatterns = new Set();
  const percentChoices = INSANE_MIX_CATALOG.patterns.find((pattern) =>
    pattern.id === "compound.percent-arithmetic").params.percentPatternChoices;
  for (let index = 0; index < 120; index += 1) {
    const question = generateInsaneMixQuestion("compound.percent-arithmetic", {
      seed: `percent-choice:${index}`,
    });
    for (const feature of question.features) {
      if (!feature.startsWith("percent-pattern:")) continue;
      seenPercentPatterns.add(feature.slice("percent-pattern:".length));
    }
  }
  assert.deepEqual(seenPercentPatterns, new Set(percentChoices));

  const impossibleOperations = structuredClone(INSANE_MIX_CATALOG);
  const simpleAddition = impossibleOperations.patterns.find((pattern) =>
    pattern.id === "add.one-digit-no-carry");
  simpleAddition.operations.push("sub");
  simpleAddition.params.minimumDistinctOperations = 2;
  assert.throws(
    () => generateInsaneMixQuestion(simpleAddition, { catalog: impossibleOperations, seed: "impossible" }),
    /too few distinct operations/,
  );
});

test("allowedMultiplicationFeatures dirige fatores e antirrepetição troca de padrão", () => {
  const catalog = structuredClone(INSANE_MIX_CATALOG);
  const easyMixed = catalog.patterns.find((pattern) => pattern.id === "mixed.easy-multipliers");
  easyMixed.params.allowedMultiplicationFeatures = ["times-eleven"];
  validateInsaneMixCatalog(catalog);

  for (let index = 0; index < 100; index += 1) {
    const question = generateInsaneMixQuestion(easyMixed, {
      catalog,
      seed: `only-eleven:${index}`,
    });
    walkAst(question.expressionAst, (node) => {
      if (node.type !== "binary" || node.operator !== "mul") return;
      assert.ok(
        node.left.numerator === "11" || node.right.numerator === "11",
        question.prompt,
      );
    });
  }

  const repeated = generateInsaneMixQuestion("add.one-digit-no-carry", { random: () => 0 });
  const replacement = selectInsaneMixQuestion({
    currentDifficulty: 10,
    attempts: [],
    random: () => 0,
    recentQuestionIds: [repeated.id],
  });
  assert.notEqual(replacement.patternKey, repeated.patternKey);
  assert.notEqual(replacement.questionId, repeated.questionId);
});

test("validator falha cedo quando flags declarativas contradizem o motor", () => {
  assertInvalidCatalog((catalog) => {
    catalog.patterns.find((pattern) => pattern.id === "add.multi-digit-no-carry")
      .params.leadingZero = true;
  }, /leadingZero must be false/);
  assertInvalidCatalog((catalog) => {
    catalog.patterns.find((pattern) => pattern.id === "mul.same-tens-complement")
      .params.factorDigits = 3;
  }, /requires factorDigits 2/);
  assertInvalidCatalog((catalog) => {
    catalog.patterns.find((pattern) => pattern.id === "div.fact-family")
      .params.remainder = 1;
  }, /exact division requires/);
  assertInvalidCatalog((catalog) => {
    catalog.patterns.find((pattern) => pattern.id === "root.perfect-square")
      .params.buildRadicandFromRoot = false;
  }, /perfect root requires/);
  assertInvalidCatalog((catalog) => {
    catalog.patterns.find((pattern) => pattern.id === "power.ten")
      .params.exactArithmetic = false;
  }, /exactArithmetic may only be true/);
  assertInvalidCatalog((catalog) => {
    catalog.patterns.find((pattern) => pattern.id === "chain.add-sub-clean")
      .params.allowedAtomFeatures = ["decrement"];
  }, /allowedAtomFeatures is deprecated/);
});

test("IDs atômicos compostos são genéricos e features descrevem o conteúdo observado", () => {
  const compoundPatterns = INSANE_MIX_CATALOG.patterns.filter((pattern) =>
    pattern.generator === "compound-expression");
  const observedAtomIds = new Set();

  for (const pattern of compoundPatterns) {
    for (let index = 0; index < 120; index += 1) {
      const question = generateInsaneMixQuestion(pattern, {
        seed: `semantic-atoms:${pattern.id}:${index}`,
      });
      const internalAtomIds = question.atomIds.filter((atomId) => atomId !== pattern.id);
      assert.ok(internalAtomIds.every((atomId) => atomId.startsWith("compound:")), question.prompt);
      internalAtomIds.forEach((atomId) => observedAtomIds.add(atomId));
    }
  }

  for (const atomId of [
    "compound:percent-of",
    "compound:power",
    "compound:dense-mul",
    "compound:regrouping-add",
    "compound:easy-mul",
  ]) {
    assert.ok(observedAtomIds.has(atomId), `${atomId} precisa ser exercitado`);
  }

  const configuredPalette = structuredClone(INSANE_MIX_CATALOG);
  const longChain = configuredPalette.patterns.find((pattern) =>
    pattern.id === "chain.long-easy-atoms");
  longChain.params.preferredAtomFeatures = ["times-eleven", "decrement"];
  let sawGenericDecrement = false;
  for (let index = 0; index < 100; index += 1) {
    const question = generateInsaneMixQuestion(longChain, {
      catalog: configuredPalette,
      seed: `preferred-eleven:${index}`,
    });
    walkAst(question.expressionAst, (node) => {
      if (node.type !== "binary" || node.operator !== "mul") return;
      assert.ok(node.left.numerator === "11" || node.right.numerator === "11", question.prompt);
    });
    if (question.atomIds.includes("compound:decrement")) sawGenericDecrement = true;
  }
  assert.equal(sawGenericDecrement, true);
});

test("cadeias que declaram carry e borrow garantem ambos", () => {
  for (let index = 0; index < 1_000; index += 1) {
    const integerChain = generateInsaneMixQuestion("chain.add-sub-regroup", {
      seed: `integer-carry-borrow:${index}`,
    });
    assert.equal(hasRegroupingOperation(integerChain.expressionAst, "add", 0), true);
    assert.equal(hasRegroupingOperation(integerChain.expressionAst, "sub", 0), true);

    const decimalChain = generateInsaneMixQuestion("decimal.add-sub-regroup", {
      seed: `decimal-carry-borrow:${index}`,
    });
    assert.equal(hasRegroupingOperation(decimalChain.expressionAst, "add", 3), true);
    assert.equal(hasRegroupingOperation(decimalChain.expressionAst, "sub", 3), true);
  }
});

test("restrições semânticas difíceis continuam verdadeiras em muitas sementes", () => {
  for (let index = 0; index < 1_000; index += 1) {
    const aligned = generateInsaneMixQuestion("decimal.add-sub-aligned", {
      seed: `aligned:${index}`,
    });
    assertAlignedWithoutRegrouping(aligned.expressionAst);

    const regrouped = generateInsaneMixQuestion("decimal.add-sub-regroup", {
      seed: `regrouped:${index}`,
    });
    assert.equal(hasDecimalRegrouping(regrouped.expressionAst), true);

    const power = generateInsaneMixQuestion("power.small-general", {
      seed: `power:${index}`,
    });
    assert.notEqual(power.expressionAst.base.numerator, "10");

    const roundable = generateInsaneMixQuestion("mul.roundable-factor", {
      seed: `roundable:${index}`,
    });
    const factors = [
      Number(roundable.expressionAst.left.numerator),
      Number(roundable.expressionAst.right.numerator),
    ];
    assert.ok(factors.some(isNearCleanDecadeOrHundred), roundable.prompt);

    const nonNegative = generateInsaneMixQuestion("mixed.easy-multipliers", {
      seed: `non-negative:${index}`,
    });
    walkAst(nonNegative.expressionAst, (node) => {
      assert.ok(evaluateInsaneExpression(node).value >= 0, nonNegative.prompt);
    });

    const hardAtoms = generateInsaneMixQuestion("compound.hard-atoms", {
      seed: `hard-atoms:${index}`,
    });
    assert.equal(hasIntegerRegrouping(hardAtoms.expressionAst), true);

    const allOperations = generateInsaneMixQuestion("compound.brutal-all-operations", {
      seed: `all-operations:${index}`,
    });
    assert.match(allOperations.prompt, /\d{4,7} × \d{4,7}/);
    assert.deepEqual(
      new Set(allOperations.operations),
      new Set(["add", "sub", "mul", "div", "percent", "power", "root"]),
    );
  }
});

test("stress determinístico gera e corrige 50 mil questões cobrindo cada padrão", () => {
  const random = createInsaneMixRandom("insane-mix:50k");
  const seenPatterns = new Set();
  const seenGenerators = new Set();

  for (let index = 0; index < 50_000; index += 1) {
    const pattern = INSANE_MIX_CATALOG.patterns[index % INSANE_MIX_CATALOG.patterns.length];
    const question = generateInsaneMixQuestion(pattern, { random });
    const evaluated = evaluateInsaneExpression(question.expressionAst);
    const normalizedPoint = normalizeUserAnswer(question.answerInput, question);
    const normalizedComma = normalizeUserAnswer(question.answerDisplay, question);

    if (evaluated.input !== question.answerInput) {
      assert.fail(`${index}/${pattern.id}: AST=${evaluated.input}, contrato=${question.answerInput}`);
    }
    if (!Number.isFinite(question.answer) || Math.abs(question.answer) > Number.MAX_SAFE_INTEGER) {
      assert.fail(`${index}/${pattern.id}: resposta insegura ${question.answerInput}`);
    }
    if (!answersMatch(normalizedPoint, question) || !answersMatch(normalizedComma, question)) {
      assert.fail(`${index}/${pattern.id}: round-trip falhou para ${question.answerDisplay}`);
    }
    assertStrictDecimalPrefixIsWrong(question);
    const forbiddenOperations = question.operations.filter((operation) =>
      !pattern.operations.includes(operation));
    if (forbiddenOperations.length) {
      assert.fail(`${index}/${pattern.id}: operações não declaradas ${forbiddenOperations.join(",")}`);
    }

    seenPatterns.add(pattern.id);
    seenGenerators.add(question.generatorId);
  }

  assert.deepEqual(seenPatterns, new Set(INSANE_MIX_CATALOG.patterns.map((pattern) => pattern.id)));
  assert.deepEqual(seenGenerators, new Set(INSANE_MIX_GENERATOR_IDS));
});

function literal(numerator, denominator = 1) {
  return {
    type: "literal",
    numerator: String(numerator),
    denominator: String(denominator),
  };
}

function binary(operator, left, right) {
  return { type: "binary", operator, left, right };
}

function fastAttempts(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `fast-${index}`,
    correct: true,
    responseTimeMs: 1_000,
    responseWindowMs: 5_000,
    timestamp: index + 1,
  }));
}

function attempt(id, patternKey, correct, timestamp) {
  return {
    id,
    patternKey,
    correct,
    responseTimeMs: correct ? 1_500 : 5_000,
    responseWindowMs: 5_000,
    timestamp,
  };
}

function ranked(patternId, options) {
  const entry = rankInsaneMixPatterns(options).find((candidate) =>
    candidate.pattern.id === patternId);
  assert.ok(entry, `${patternId} precisa estar no pool`);
  return entry;
}

function groupFor(patternId) {
  return INSANE_MIX_CATALOG.groups.find((group) => group.patternIds.includes(patternId));
}

function walkAst(ast, visit) {
  visit(ast);
  if (ast.type === "binary") {
    walkAst(ast.left, visit);
    walkAst(ast.right, visit);
  } else if (ast.type === "power") {
    walkAst(ast.base, visit);
  } else if (ast.type === "root") {
    walkAst(ast.radicand, visit);
  } else if (ast.type === "percent-of") {
    walkAst(ast.percent, visit);
    walkAst(ast.value, visit);
  }
}

function assertAlignedWithoutRegrouping(ast) {
  walkAst(ast, (node) => {
    if (node.type !== "binary" || !["add", "sub"].includes(node.operator)) return;
    const left = scaledInteger(node.left, 3);
    const right = scaledInteger(node.right, 3);
    if (node.operator === "add") assert.equal(additionCarries(left, right), 0);
    else assert.equal(subtractionBorrows(left, right), 0);
  });
}

function hasDecimalRegrouping(ast) {
  let found = false;
  walkAst(ast, (node) => {
    if (node.type !== "binary" || !["add", "sub"].includes(node.operator)) return;
    const left = scaledInteger(node.left, 3);
    const right = scaledInteger(node.right, 3);
    if (node.operator === "add" && additionCarries(left, right) > 0) found = true;
    if (node.operator === "sub" && subtractionBorrows(left, right) > 0) found = true;
  });
  return found;
}

function hasIntegerRegrouping(ast) {
  let found = false;
  walkAst(ast, (node) => {
    if (node.type !== "binary"
      || node.operator !== "add"
      || node.left.type !== "literal"
      || node.right.type !== "literal"
      || node.left.denominator !== "1"
      || node.right.denominator !== "1") return;
    if (additionCarries(Number(node.left.numerator), Number(node.right.numerator)) > 0) found = true;
  });
  return found;
}

function scaledInteger(ast, scale) {
  const evaluated = evaluateInsaneExpression(ast);
  const numerator = BigInt(evaluated.numerator);
  const denominator = BigInt(evaluated.denominator);
  const multiplier = 10n ** BigInt(scale);
  assert.equal((numerator * multiplier) % denominator, 0n);
  return Number(numerator * multiplier / denominator);
}

function additionCarries(left, right) {
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

function subtractionBorrows(left, right) {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  let borrow = 0;
  let count = 0;
  while (a || b) {
    if (a % 10 - borrow < b % 10) {
      borrow = 1;
      count += 1;
    } else {
      borrow = 0;
    }
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return count;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertInvalidCatalog(mutate, expectedError) {
  const catalog = structuredClone(INSANE_MIX_CATALOG);
  mutate(catalog);
  assert.throws(() => validateInsaneMixCatalog(catalog), expectedError);
}

function hasRegroupingOperation(ast, operator, scale) {
  let found = false;
  walkAst(ast, (node) => {
    if (node.type !== "binary" || node.operator !== operator) return;
    const left = scaledInteger(node.left, scale);
    const right = scaledInteger(node.right, scale);
    if (operator === "add" && additionCarries(left, right) > 0) found = true;
    if (operator === "sub" && subtractionBorrows(left, right) > 0) found = true;
  });
  return found;
}

function assertStrictDecimalPrefixIsWrong(question) {
  if (!question.answerInput.includes(".")) return;
  const prefix = question.answerInput.slice(0, -1);
  const normalized = normalizeUserAnswer(prefix, question);
  assert.equal(
    normalized != null && answersMatch(normalized, question),
    false,
    `${question.patternKey}: prefixo ${prefix} não pode corrigir ${question.answerInput}`,
  );
}

function isNearCleanDecadeOrHundred(value) {
  return [10, 100].some((place) => {
    const clean = Math.round(value / place) * place;
    return clean >= 20 && Math.abs(value - clean) >= 1 && Math.abs(value - clean) <= 2;
  });
}
