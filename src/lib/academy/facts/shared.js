let questionCounter = 0;

export function buildBinaryFact(fields) {
  return {
    type: "binary",
    ...fields,
  };
}

export function buildUnaryFact(fields) {
  return {
    type: "unary",
    ...fields,
  };
}

export function mergeFactSets(...factSets) {
  return Array.from(
    new Map(factSets.flat().map((fact) => [fact.skillKey, fact])).values(),
  );
}

export function createQuestionFromFact(fact) {
  questionCounter += 1;

  if (fact.type === "binary") {
    return {
      id: `${fact.sectionId}-${fact.presetId}-${questionCounter}`,
      sectionId: fact.sectionId,
      presetId: fact.presetId,
      skillKey: fact.skillKey,
      prompt: `${fact.left} ${fact.operator} ${fact.right}`,
      promptLatex: `${fact.left} ${getOperatorLatex(fact.operator)} ${fact.right}`,
      answer: fact.answer,
      hint: fact.hint,
      breakdown: fact.breakdown,
      solutionLatex: fact.solutionLatex,
      responseWindowMs: fact.responseWindowMs,
      reviewBaseMs: fact.reviewBaseMs,
      display: {
        kind: "binary",
        leftLatex: `${fact.left}`,
        operatorLatex: getOperatorLatex(fact.operator),
        rightLatex: `${fact.right}`,
      },
    };
  }

  return {
    id: `${fact.sectionId}-${fact.presetId}-${questionCounter}`,
    sectionId: fact.sectionId,
    presetId: fact.presetId,
    skillKey: fact.skillKey,
    prompt: fact.prompt,
    promptLatex: fact.promptLatex ?? fact.prompt,
    answer: fact.answer,
    hint: fact.hint,
    breakdown: fact.breakdown,
    solutionLatex: fact.solutionLatex ?? `${fact.prompt} = ${fact.answer}`,
    responseWindowMs: fact.responseWindowMs,
    reviewBaseMs: fact.reviewBaseMs,
  };
}

export function createCommutativeSkillKey(prefix, left, right) {
  const ordered = [left, right].sort((a, b) => a - b);

  return `${prefix}:${ordered[0]}:${ordered[1]}`;
}

export function createOrderedSkillKey(prefix, ...values) {
  return [prefix, ...values].join(":");
}

export function getOperatorLatex(operatorSymbol) {
  switch (operatorSymbol) {
    case "x":
      return "\\times";
    case "÷":
      return "\\div";
    default:
      return operatorSymbol;
  }
}

export function getPresetTiming(preset) {
  return {
    responseWindowMs: preset.responseWindowMs,
    reviewBaseMs: preset.reviewBaseMs,
  };
}
