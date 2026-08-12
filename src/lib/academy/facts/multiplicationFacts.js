import { getPresetById } from "../content";
import {
  buildBinaryFact,
  createCommutativeSkillKey,
  getPresetTiming,
  mergeFactSets,
} from "./shared";

const multiplicationCache = new Map();

export function getTabuadaFacts(presetId) {
  if (!multiplicationCache.has(presetId)) {
    multiplicationCache.set(presetId, buildTabuadaFacts(presetId));
  }

  return multiplicationCache.get(presetId) ?? [];
}

function buildTabuadaFacts(presetId) {
  switch (presetId) {
    case "base":
      return buildFactRange("base", 2, 5);
    case "pesada":
      return buildFactRange("pesada", 6, 9);
    case "quadrados":
      return buildSquareFacts();
    case "geral":
    default:
      return buildFactRange("geral", 2, 9);
  }
}

function buildFactRange(presetId, min, max) {
  const preset = getPresetById("tabuada", presetId);
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let left = min; left <= max; left += 1) {
    for (let right = left; right <= max; right += 1) {
      facts.push(
        buildBinaryFact({
          ...timing,
          sectionId: "tabuada",
          presetId,
          skillKey: createCommutativeSkillKey("mul", left, right),
          left,
          operator: "x",
          right,
          answer: left * right,
          hint:
            left === right
              ? `Quadrados como ${left}² precisam ficar instantâneos.`
              : `Procure vizinhos conhecidos, como ${left}x${left} ou ${right}x${right}.`,
          breakdown: `${left} x ${right} = ${left * right}. Use famílias já dominadas e quadrados próximos para reduzir busca mental.`,
          solutionLatex: `${left} \\times ${right} = ${left * right}`,
        }),
      );
    }
  }

  return facts;
}

function buildSquareFacts() {
  const preset = getPresetById("tabuada", "quadrados");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let value = 2; value <= 9; value += 1) {
    facts.push(
      buildBinaryFact({
        ...timing,
        sectionId: "tabuada",
        presetId: "quadrados",
        skillKey: createCommutativeSkillKey("mul", value, value),
        left: value,
        operator: "x",
        right: value,
        answer: value * value,
        hint: `Quadrados como ${value}² precisam ficar instantâneos.`,
        breakdown: `${value} x ${value} = ${value * value}. Quadrados são âncoras rápidas para outras contas.`,
        solutionLatex: `${value} \\times ${value} = ${value * value}`,
      }),
    );
  }

  return facts;
}
