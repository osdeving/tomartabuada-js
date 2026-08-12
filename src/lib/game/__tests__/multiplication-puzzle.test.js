import assert from "node:assert/strict";
import test from "node:test";

import {
  createMultiplicationPuzzle,
  splitIntoMentalParts,
} from "../../../game/modes/math-shmup/puzzle/buildMultiplicationPuzzle.js";
import { createPuzzleSession } from "../../../game/modes/math-shmup/puzzle/createPuzzleSession.js";

const CONFIG = {
  decomposedFactorDigits: [2],
  otherFactorDigits: [1, 2],
};

test("52 × 38 começa por dezenas redondas nos dois fatores", () => {
  const puzzle = createMultiplicationPuzzle(CONFIG, {
    leftValue: 52,
    rightValue: 38,
  });

  assert.deepEqual(puzzle.leftParts, [50, 2]);
  assert.deepEqual(puzzle.rightParts, [30, 8]);
  assert.deepEqual(puzzle.paths.map((path) => path.id), ["mental"]);
  assert.deepEqual(
    puzzle.paths[0].steps.map(({ prompt, result }) => [prompt, result]),
    [
      ["50 × 30", 1_500],
      ["50 × 8", 400],
      ["1500 + 400", 1_900],
      ["2 × 30", 60],
      ["2 × 8", 16],
      ["60 + 16", 76],
      ["1900 + 76", 1_976],
    ],
  );
  assert.equal(puzzle.paths[0].steps.some((step) => step.prompt === "50 × 38"), false);
  assert.equal(puzzle.paths[0].steps.at(-1).result, 52 * 38);
});

test("o Radar do jogo oferece 50 × 30 como único primeiro passo de 52 × 38", () => {
  const session = createPuzzleSession(CONFIG, {
    leftValue: 52,
    rightValue: 38,
  });
  const snapshot = session.getSnapshot();

  assert.equal(snapshot.currentPrompt, "50 × 30");
  assert.deepEqual(snapshot.openingPrompts, ["50 × 30"]);
  assert.equal(snapshot.paths[0].label, "Dezenas e ajustes");
  assert.equal(snapshot.paths[0].steps[0].prompt, "50 × 30");
  assert.equal(snapshot.paths[0].steps[0].available, true);
});

test("arredondamentos para cima conservam os sinais dos ajustes", () => {
  const cases = [
    {
      factors: [49, 21],
      parts: [[50, -1], [20, 1]],
      prompts: ["1000 + 50", "20 + 1", "1050 − 21"],
    },
    {
      factors: [61, 29],
      parts: [[60, 1], [30, -1]],
      prompts: ["1800 − 60", "30 − 1", "1740 + 29"],
    },
    {
      factors: [49, 29],
      parts: [[50, -1], [30, -1]],
      prompts: ["1500 − 50", "30 − 1", "1450 − 29"],
    },
  ];

  cases.forEach(({ factors, parts, prompts }) => {
    const puzzle = createMultiplicationPuzzle(CONFIG, {
      leftValue: factors[0],
      rightValue: factors[1],
    });
    const mentalPath = puzzle.paths.find((path) => path.id === "mental");

    assert.deepEqual([puzzle.leftParts, puzzle.rightParts], parts);
    prompts.forEach((prompt) => {
      assert.ok(
        mentalPath.steps.some((step) => step.prompt === prompt),
        `${factors.join(" × ")} deveria incluir ${prompt}`,
      );
    });
    assert.equal(mentalPath.steps.at(-1).result, factors[0] * factors[1]);
  });
});

test("um fator curto permite caminho direto sem perder a decomposição", () => {
  const cases = [
    {
      factors: [7, 38],
      mental: [["7 × 30", 210], ["7 × 8", 56], ["210 + 56", 266]],
    },
    {
      factors: [7, 39],
      mental: [["7 × 40", 280], ["7 × 1", 7], ["280 − 7", 273]],
    },
  ];

  cases.forEach(({ factors, mental }) => {
    const puzzle = createMultiplicationPuzzle(CONFIG, {
      leftValue: factors[0],
      rightValue: factors[1],
    });

    assert.deepEqual(puzzle.paths.map((path) => path.id), ["mental", "direct"]);
    assert.deepEqual(
      puzzle.paths[0].steps.map(({ prompt, result }) => [prompt, result]),
      mental,
    );
    assert.equal(puzzle.paths[1].steps[0].result, factors[0] * factors[1]);
  });
});

test("a regra só sobe para a próxima dezena quando o ajuste é 1", () => {
  assert.deepEqual(
    [28, 29, 30, 31, 38, 39].map(splitIntoMentalParts),
    [[20, 8], [30, -1], [30], [30, 1], [30, 8], [40, -1]],
  );
});

test("fixture rejeita fatores fora do domínio do Arcade", () => {
  assert.throws(
    () => createMultiplicationPuzzle(CONFIG, { leftValue: 0, rightValue: 38 }),
    /leftValue precisa ser um inteiro entre 2 e 89/,
  );
});

test("todos os pares do Arcade preservam o produto e começam pelo bloco mais simples", () => {
  for (let leftValue = 2; leftValue <= 89; leftValue += 1) {
    for (let rightValue = 2; rightValue <= 89; rightValue += 1) {
      const puzzle = createMultiplicationPuzzle(CONFIG, { leftValue, rightValue });

      for (const path of puzzle.paths) {
        assert.equal(path.steps.at(-1).result, leftValue * rightValue);
      }

      if (puzzle.leftParts.length > 1 && puzzle.rightParts.length > 1) {
        assert.equal(puzzle.paths.length, 1);
        assert.equal(
          puzzle.paths[0].steps[0].prompt,
          `${puzzle.leftParts[0]} × ${puzzle.rightParts[0]}`,
        );
      }
    }
  }
});
