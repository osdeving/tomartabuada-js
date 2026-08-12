import { getPresetById } from "../content";
import {
  buildBinaryFact,
  buildUnaryFact,
  createOrderedSkillKey,
  getPresetTiming,
} from "./shared";
import { getSquareFacts } from "./squareFacts";

const trickCache = new Map();

export function getTrickFacts(presetId) {
  if (!trickCache.has(presetId)) {
    trickCache.set(presetId, buildTrickFacts(presetId));
  }

  return trickCache.get(presetId) ?? [];
}

function buildTrickFacts(presetId) {
  switch (presetId) {
    case "x11":
      return buildTimesElevenFacts();
    case "mesma-dezena":
      return buildSameTensFacts();
    case "termina-5":
      return getSquareFacts("termina-5", "tricks");
    case "cinquenta":
    default:
      return getSquareFacts("cinquenta", "tricks");
  }
}

function buildTimesElevenFacts() {
  const preset = getPresetById("tricks", "x11");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let value = 11; value <= 99; value += 1) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    const middle = tens + ones;
    const answer = value * 11;

    facts.push(
      buildBinaryFact({
        ...timing,
        sectionId: "tricks",
        presetId: "x11",
        skillKey: createOrderedSkillKey("mul11", value),
        left: value,
        operator: "x",
        right: 11,
        answer,
        hint: "Guarde as pontas e some os vizinhos no meio.",
        breakdown:
          middle < 10
            ? `${value} x 11 -> ${tens} | ${middle} | ${ones} = ${answer}.`
            : `${value} x 11 -> ${tens} | ${middle} | ${ones}. Como ${middle} passou de 9, sobe 1 para a esquerda e fica ${answer}.`,
        solutionLatex:
          middle < 10
            ? `${value} \\times 11 = ${tens}\\,|\\,${middle}\\,|\\,${ones} = ${answer}`
            : `${value} \\times 11 = ${tens}\\,|\\,${middle}\\,|\\,${ones} \\Rightarrow ${answer}`,
      }),
    );
  }

  return facts;
}

function buildSameTensFacts() {
  const preset = getPresetById("tricks", "mesma-dezena");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let tens = 2; tens <= 9; tens += 1) {
    for (let unitA = 1; unitA <= 5; unitA += 1) {
      const unitB = 10 - unitA;
      const left = tens * 10 + unitA;
      const right = tens * 10 + unitB;
      const front = tens * (tens + 1);
      const tail = String(unitA * unitB).padStart(2, "0");
      const answer = left * right;

      facts.push(
        buildBinaryFact({
          ...timing,
          sectionId: "tricks",
          presetId: "mesma-dezena",
          skillKey: createOrderedSkillKey("same-tens", left, right),
          left,
          operator: "x",
          right,
          answer,
          hint: "Frente: dezena vezes o próximo número. Final: produto das unidades.",
          breakdown: `${left} x ${right} -> frente ${tens} x ${tens + 1} = ${front}; final ${unitA} x ${unitB} = ${tail}; resposta ${answer}.`,
          solutionLatex: `${left} \\times ${right} = ${tens} \\times ${tens + 1}\\,|\\,${tail} = ${answer}`,
        }),
      );
    }
  }

  return facts;
}
