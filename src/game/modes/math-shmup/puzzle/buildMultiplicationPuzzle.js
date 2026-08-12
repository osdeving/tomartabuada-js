import { buildProblemDisplay, formatMultiplication } from "./formatters";

let puzzleCounter = 0;

export function createMultiplicationPuzzle(config) {
  const leftValue = createValueFromDigits(config.otherFactorDigits);
  const rightValue = createValueFromDigits(config.decomposedFactorDigits);
  const leftParts = splitIntoPlaceValues(leftValue);
  const rightParts = splitIntoPlaceValues(rightValue);
  const total = leftValue * rightValue;
  const finalStep = createStep("final", formatMultiplication(leftValue, rightValue), total, {
    kind: "final",
  });

  const atomicSteps = buildAtomicSteps(leftParts, rightParts);
  const columnSteps = buildColumnSteps(leftValue, rightParts);
  const rowSteps = buildRowSteps(leftParts, rightValue);
  const paths = dedupePaths([
    createPath("direct", "Direto", [finalStep]),
    rightParts.length > 1 ? createPath("columns", "Colunas", [...columnSteps, finalStep]) : null,
    leftParts.length > 1 ? createPath("rows", "Linhas", [...rowSteps, finalStep]) : null,
    atomicSteps.length > 1 ? createPath("atomic", "Blocos", [...atomicSteps, finalStep]) : null,
  ].filter(Boolean));

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

function buildAtomicSteps(leftParts, rightParts) {
  const steps = [];

  rightParts.forEach((rightPart, columnIndex) => {
    leftParts.forEach((leftPart, rowIndex) => {
      steps.push(
        createStep(
          `atomic-${columnIndex}-${rowIndex}`,
          formatMultiplication(leftPart, rightPart),
          leftPart * rightPart,
          { kind: "atomic" },
        ),
      );
    });
  });

  return steps;
}

function buildColumnSteps(leftValue, rightParts) {
  return rightParts.map((rightPart, index) =>
    createStep(
      `column-${index}`,
      formatMultiplication(leftValue, rightPart),
      leftValue * rightPart,
      { kind: "column" },
    ),
  );
}

function buildRowSteps(leftParts, rightValue) {
  return leftParts.map((leftPart, index) =>
    createStep(
      `row-${index}`,
      formatMultiplication(leftPart, rightValue),
      leftPart * rightValue,
      { kind: "row" },
    ),
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

function splitIntoPlaceValues(value) {
  if (value < 10) {
    return [value];
  }

  const tens = Math.floor(value / 10) * 10;
  const ones = value % 10;

  return ones ? [tens, ones] : [tens];
}

function sample(items) {
  return items[randomInt(0, items.length - 1)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
