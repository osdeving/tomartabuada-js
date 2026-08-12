import { getPresetById } from "../content";
import {
  buildUnaryFact,
  createOrderedSkillKey,
  getPresetTiming,
  mergeFactSets,
} from "./shared";

const squareCache = new Map();

export function getSquareFacts(presetId, sectionId = "quadrado") {
  const cacheKey = `${sectionId}:${presetId}`;

  if (!squareCache.has(cacheKey)) {
    squareCache.set(cacheKey, buildSquareFacts(presetId, sectionId));
  }

  return squareCache.get(cacheKey) ?? [];
}

function buildSquareFacts(presetId, sectionId) {
  switch (presetId) {
    case "11-19":
      return buildTeenSquareFacts(sectionId, presetId);
    case "termina-5":
      return buildEndingFiveFacts(sectionId, presetId);
    case "cinquenta":
      return buildFiftiesFacts(sectionId, presetId);
    case "misto":
    default:
      return mergeFactSets(
        buildTeenSquareFacts(sectionId, "11-19"),
        buildEndingFiveFacts(sectionId, "termina-5"),
        buildFiftiesFacts(sectionId, "cinquenta"),
      );
  }
}

function buildTeenSquareFacts(sectionId, presetId) {
  const preset = getPresetById("quadrado", presetId);
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let value = 11; value <= 19; value += 1) {
    const delta = value - 10;
    const answer = value * value;

    facts.push(
      buildUnaryFact({
        ...timing,
        sectionId,
        presetId,
        skillKey: createOrderedSkillKey("square", value),
        prompt: `${value}²`,
        promptLatex: `${value}^2`,
        answer,
        hint: "Use a forma 10 + d.",
        breakdown: `${value}² = (10 + ${delta})² = 100 + ${20 * delta} + ${delta * delta} = ${answer}.`,
        solutionLatex: `${value}^2 = (10 + ${delta})^2 = 100 + ${20 * delta} + ${delta * delta} = ${answer}`,
      }),
    );
  }

  return facts;
}

function buildEndingFiveFacts(sectionId, presetId) {
  const preset = getPresetById(sectionId === "tricks" ? "tricks" : "quadrado", presetId);
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let lead = 1; lead <= 9; lead += 1) {
    const value = lead * 10 + 5;
    const answer = value * value;

    facts.push(
      buildUnaryFact({
        ...timing,
        sectionId,
        presetId,
        skillKey: createOrderedSkillKey("square", value),
        prompt: `${value}²`,
        promptLatex: `${value}^2`,
        answer,
        hint: "Ignore o 5, multiplique a frente pelo próximo número e feche com 25.",
        breakdown: `${value}² = ${lead} x ${lead + 1} | 25 = ${answer}.`,
        solutionLatex: `${value}^2 = ${lead} \\times ${lead + 1}\\,|\\,25 = ${answer}`,
      }),
    );
  }

  return facts;
}

function buildFiftiesFacts(sectionId, presetId) {
  const preset = getPresetById(sectionId === "tricks" ? "tricks" : "quadrado", presetId);
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let value = 50; value <= 59; value += 1) {
    const delta = value - 50;
    const answer = value * value;

    facts.push(
      buildUnaryFact({
        ...timing,
        sectionId,
        presetId,
        skillKey: createOrderedSkillKey("square", value),
        prompt: `${value}²`,
        promptLatex: `${value}^2`,
        answer,
        hint: "Veja o número como 50 + d e use 2500 como base.",
        breakdown: `${value}² = (50 + ${delta})² = 2500 + ${100 * delta} + ${delta * delta} = ${answer}.`,
        solutionLatex: `${value}^2 = (50 + ${delta})^2 = 2500 + ${100 * delta} + ${delta * delta} = ${answer}`,
      }),
    );
  }

  return facts;
}
