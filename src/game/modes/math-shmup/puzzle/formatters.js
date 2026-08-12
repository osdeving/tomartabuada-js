export function formatMultiplication(left, right) {
  return `${left} × ${right}`;
}

export function formatAddition(left, right) {
  return `${left} + ${right}`;
}

export function formatDecomposition(value, parts) {
  if (parts.length <= 1) {
    return `${value}`;
  }

  return `${value} (${parts.join(" + ")})`;
}

export function buildProblemDisplay({ leftValue, rightValue, leftParts, rightParts }) {
  const formulaLabel = formatMultiplication(leftValue, rightValue);

  return {
    formulaLabel,
    questionLabel: `Quanto é ${formulaLabel}?`,
    topLine: `${leftValue}`,
    bottomLine: `${rightValue}`,
    topDecomposition: formatDecomposition(leftValue, leftParts),
    bottomDecomposition: formatDecomposition(rightValue, rightParts),
  };
}
