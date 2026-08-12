import { getPresetById } from "../content";
import {
  buildBinaryFact,
  createOrderedSkillKey,
  getPresetTiming,
} from "./shared";

const divisionCache = new Map();

export function getDivisionFacts(presetId) {
  if (!divisionCache.has(presetId)) {
    divisionCache.set(presetId, buildDivisionFacts(presetId));
  }

  return divisionCache.get(presetId) ?? [];
}

function buildDivisionFacts(presetId) {
  switch (presetId) {
    case "familias-2-5":
      return buildDivisionFamilyFacts("familias-2-5", 2, 5);
    case "familias-6-9":
      return buildDivisionFamilyFacts("familias-6-9", 6, 9);
    case "quadrados":
      return buildDivisionSquareFacts();
    case "toda-tabuada":
    default:
      return buildDivisionFamilyFacts("toda-tabuada", 2, 9);
  }
}

function buildDivisionFamilyFacts(presetId, minDivisor, maxDivisor) {
  const preset = getPresetById("divisao", presetId);
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let divisor = minDivisor; divisor <= maxDivisor; divisor += 1) {
    for (let quotient = 2; quotient <= 10; quotient += 1) {
      const dividend = divisor * quotient;

      facts.push(
        buildBinaryFact({
          ...timing,
          sectionId: "divisao",
          presetId,
          skillKey: createOrderedSkillKey("div", dividend, divisor),
          left: dividend,
          operator: "÷",
          right: divisor,
          answer: quotient,
          hint: `Leia a divisão como: ${divisor} vezes quanto dá ${dividend}?`,
          breakdown: `Pense ao contrário: ${divisor} x ${quotient} = ${dividend}. Então ${dividend} ÷ ${divisor} = ${quotient}.`,
          solutionLatex: `${dividend} \\div ${divisor} = ${quotient}`,
        }),
      );
    }
  }

  return facts;
}

function buildDivisionSquareFacts() {
  const preset = getPresetById("divisao", "quadrados");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let value = 2; value <= 9; value += 1) {
    const dividend = value * value;

    facts.push(
      buildBinaryFact({
        ...timing,
        sectionId: "divisao",
        presetId: "quadrados",
        skillKey: createOrderedSkillKey("div", dividend, value),
        left: dividend,
        operator: "÷",
        right: value,
        answer: value,
        hint: `Leia a divisão como: ${value} vezes quanto dá ${dividend}?`,
        breakdown: `Quadrados conhecidos deixam a resposta mais curta: ${dividend} ÷ ${value} = ${value}.`,
        solutionLatex: `${dividend} \\div ${value} = ${value}`,
      }),
    );
  }

  return facts;
}
