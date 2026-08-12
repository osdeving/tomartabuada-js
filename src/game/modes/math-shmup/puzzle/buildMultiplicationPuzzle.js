import {
  buildProblemDisplay,
  formatAddition,
  formatMultiplication,
  formatSubtraction,
} from "./formatters.js";

let puzzleCounter = 0;

export function createMultiplicationPuzzle(config, fixedValues = {}) {
  const leftValue = resolvePuzzleValue(
    fixedValues.leftValue,
    config.otherFactorDigits,
    "leftValue",
  );
  const rightValue = resolvePuzzleValue(
    fixedValues.rightValue,
    config.decomposedFactorDigits,
    "rightValue",
  );
  const leftParts = splitIntoMentalParts(leftValue);
  const rightParts = splitIntoMentalParts(rightValue);
  const total = leftValue * rightValue;
  const finalStep = createStep("final", formatMultiplication(leftValue, rightValue), total, {
    kind: "final",
  });
  const mentalSteps = buildMentalSteps(leftValue, rightValue, leftParts, rightParts);
  const hasAdjustment = leftParts.length > 1 || rightParts.length > 1;
  const directIsReasonable = leftValue < 10 || rightValue < 10;
  const paths = dedupePaths(
    [
      hasAdjustment
        ? createPath("mental", "Dezenas e ajustes", mentalSteps)
        : null,
      !hasAdjustment || directIsReasonable
        ? createPath("direct", "Direto", [finalStep])
        : null,
    ].filter(Boolean),
  );

  return {
    id: `math-shmup-${++puzzleCounter}`,
    leftValue,
    rightValue,
    leftParts,
    rightParts,
    total,
    paths,
    resultLabels: collectResultLabels(paths),
    problemDisplay: buildProblemDisplay({
      leftValue,
      rightValue,
      leftParts,
      rightParts,
    }),
  };
}

function buildMentalSteps(leftValue, rightValue, leftParts, rightParts) {
  const [leftBase, leftAdjustment = 0] = leftParts;
  const [rightBase, rightAdjustment = 0] = rightParts;

  if (!leftAdjustment && !rightAdjustment) {
    return [
      createStep(
        "mental-base",
        formatMultiplication(leftValue, rightValue),
        leftValue * rightValue,
        { kind: "base" },
      ),
    ];
  }

  if (!leftAdjustment) {
    return buildSingleFactorAdjustment({
      fixedFactor: leftValue,
      base: rightBase,
      adjustment: rightAdjustment,
      idPrefix: "right",
    });
  }

  if (!rightAdjustment) {
    return buildSingleFactorAdjustment({
      fixedFactor: rightValue,
      base: leftBase,
      adjustment: leftAdjustment,
      idPrefix: "left",
    });
  }

  const steps = [];
  const baseProduct = leftBase * rightBase;
  const baseAdjustmentProduct = leftBase * Math.abs(rightAdjustment);
  const baseRowTotal = baseProduct + Math.sign(rightAdjustment) * baseAdjustmentProduct;
  const leftAdjustmentMagnitude = Math.abs(leftAdjustment);
  const adjustmentBaseProduct = leftAdjustmentMagnitude * rightBase;
  const crossProduct = leftAdjustmentMagnitude * Math.abs(rightAdjustment);
  const adjustmentRowTotal = adjustmentBaseProduct + Math.sign(rightAdjustment) * crossProduct;
  const total = baseRowTotal + Math.sign(leftAdjustment) * adjustmentRowTotal;

  steps.push(
    multiplicationStep("base-product", leftBase, rightBase, "base"),
    multiplicationStep(
      "base-right-adjustment",
      leftBase,
      Math.abs(rightAdjustment),
      "adjustment",
    ),
    combinationStep(
      "base-row-total",
      baseProduct,
      baseAdjustmentProduct,
      Math.sign(rightAdjustment),
      "subtotal",
    ),
    multiplicationStep(
      "left-adjustment-base",
      leftAdjustmentMagnitude,
      rightBase,
      "adjustment",
    ),
    multiplicationStep(
      "cross-adjustment",
      leftAdjustmentMagnitude,
      Math.abs(rightAdjustment),
      "adjustment",
    ),
    combinationStep(
      "adjustment-row-total",
      adjustmentBaseProduct,
      crossProduct,
      Math.sign(rightAdjustment),
      "subtotal",
    ),
    combinationStep(
      "mental-total",
      baseRowTotal,
      adjustmentRowTotal,
      Math.sign(leftAdjustment),
      "final",
    ),
  );

  if (total !== leftValue * rightValue) {
    throw new Error("A decomposição mental não preservou o produto.");
  }

  return steps;
}

function buildSingleFactorAdjustment({ fixedFactor, base, adjustment, idPrefix }) {
  const baseProduct = fixedFactor * base;
  const adjustmentProduct = fixedFactor * Math.abs(adjustment);

  return [
    multiplicationStep(`${idPrefix}-base`, fixedFactor, base, "base"),
    multiplicationStep(
      `${idPrefix}-adjustment`,
      fixedFactor,
      Math.abs(adjustment),
      "adjustment",
    ),
    combinationStep(
      `${idPrefix}-total`,
      baseProduct,
      adjustmentProduct,
      Math.sign(adjustment),
      "final",
    ),
  ];
}

function multiplicationStep(id, left, right, kind) {
  return createStep(
    id,
    formatMultiplication(left, right),
    left * right,
    { kind },
  );
}

function combinationStep(id, current, adjustment, direction, kind) {
  const result = current + direction * adjustment;
  return createStep(
    id,
    direction < 0
      ? formatSubtraction(current, adjustment)
      : formatAddition(current, adjustment),
    result,
    { kind },
  );
}

function createPath(id, label, steps) {
  return {
    id,
    label,
    steps,
    signature: steps.map((step) => step.prompt).join(" > "),
  };
}

function createStep(id, prompt, result, meta) {
  return {
    ...meta,
    id,
    prompt,
    result,
    resultLabel: `${result}`,
  };
}

function dedupePaths(paths) {
  const seen = new Set();

  return paths.filter((path) => {
    if (seen.has(path.signature)) {
      return false;
    }

    seen.add(path.signature);
    return true;
  });
}

function collectResultLabels(paths) {
  return Array.from(
    new Set(
      paths.flatMap((path) => path.steps.map((step) => step.resultLabel)),
    ),
  );
}

function createValueFromDigits(digitOptions) {
  const digits = sample(digitOptions);

  if (digits === 1) {
    return randomInt(2, 9);
  }

  let value = 0;

  while (value < 12 || value > 89 || value % 10 === 0) {
    value = randomInt(12, 89);
  }

  return value;
}

export function splitIntoMentalParts(value) {
  if (value < 10) {
    return [value];
  }

  const ones = value % 10;

  if (!ones) {
    return [value];
  }

  // Subir para a próxima dezena só quando falta 1. Ajustes de 2 ou mais
  // permanecem na dezena inferior: 38 vira 30 + 8, nunca 40 - 2.
  const base = ones === 9
    ? Math.ceil(value / 10) * 10
    : Math.floor(value / 10) * 10;
  const adjustment = value - base;

  return [base, adjustment];
}

function resolvePuzzleValue(fixedValue, digitOptions, fieldName) {
  if (fixedValue == null) {
    return createValueFromDigits(digitOptions);
  }

  if (!Number.isInteger(fixedValue) || fixedValue < 2 || fixedValue > 89) {
    throw new TypeError(`${fieldName} precisa ser um inteiro entre 2 e 89.`);
  }

  return fixedValue;
}

function sample(items) {
  return items[randomInt(0, items.length - 1)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
