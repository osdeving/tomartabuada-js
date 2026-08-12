import { getPresetById } from "../content";
import {
  buildBinaryFact,
  createCommutativeSkillKey,
  getPresetTiming,
  mergeFactSets,
} from "./shared";

const additionCache = new Map();

export function getAdditionFacts(presetId) {
  if (!additionCache.has(presetId)) {
    additionCache.set(presetId, buildAdditionFacts(presetId));
  }

  return additionCache.get(presetId) ?? [];
}

function buildAdditionFacts(presetId) {
  switch (presetId) {
    case "complementos-10":
      return buildComplementFacts();
    case "passa-10":
      return buildCrossTenFacts();
    case "misto-1-algarismo":
      return mergeFactSets(buildComplementFacts(), buildCrossTenFacts());
    case "sem-vai-um":
      return buildNoCarryFacts();
    case "com-vai-um":
      return buildCarryFacts();
    case "ponte-100":
      return buildBridgeFacts();
    case "misto":
    default:
      return mergeFactSets(
        buildComplementFacts(),
        buildCrossTenFacts(),
        buildNoCarryFacts(),
        buildCarryFacts(),
        buildBridgeFacts(),
      );
  }
}

function buildComplementFacts() {
  const preset = getPresetById("adicao", "complementos-10");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let left = 1; left <= 5; left += 1) {
    const right = 10 - left;

    facts.push(
      buildBinaryFact({
        ...timing,
        sectionId: "adicao",
        presetId: "complementos-10",
        skillKey: createCommutativeSkillKey("add", left, right),
        left,
        operator: "+",
        right,
        answer: 10,
        hint: "Reconheça o par que fecha 10 sem contar.",
        breakdown: `${left} + ${right} fecha 10.`,
        solutionLatex: `${left} + ${right} = 10`,
      }),
    );
  }

  return facts;
}

function buildCrossTenFacts() {
  const preset = getPresetById("adicao", "passa-10");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let left = 2; left <= 9; left += 1) {
    for (let right = left; right <= 9; right += 1) {
      const answer = left + right;

      if (answer <= 10) {
        continue;
      }

      const toTen = 10 - left;
      const rest = right - toTen;

      facts.push(
        buildBinaryFact({
          ...timing,
          sectionId: "adicao",
          presetId: "passa-10",
          skillKey: createCommutativeSkillKey("add", left, right),
          left,
          operator: "+",
          right,
          answer,
          hint: "Feche 10 primeiro e some o que sobrou.",
          breakdown: `${left} + ${right} = ${left} + ${toTen} + ${rest} = 10 + ${rest} = ${answer}.`,
          solutionLatex: `${left} + ${right} = ${left} + ${toTen} + ${rest} = ${answer}`,
        }),
      );
    }
  }

  return facts;
}

function buildNoCarryFacts() {
  const preset = getPresetById("adicao", "sem-vai-um");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let left = 12; left <= 89; left += 1) {
    for (let right = left; right <= 89; right += 1) {
      if (
        left % 10 + (right % 10) >= 10 ||
        Math.floor(left / 10) + Math.floor(right / 10) >= 10
      ) {
        continue;
      }

      const tensPart = Math.floor(right / 10) * 10;
      const onesPart = right % 10;
      const answer = left + right;

      facts.push(
        buildBinaryFact({
          ...timing,
          sectionId: "adicao",
          presetId: "sem-vai-um",
          skillKey: createCommutativeSkillKey("add", left, right),
          left,
          operator: "+",
          right,
          answer,
          hint: "Feche as dezenas primeiro e deixa as unidades por último.",
          breakdown: `${left} + ${right} = ${left} + ${tensPart} + ${onesPart} = ${left + tensPart} + ${onesPart} = ${answer}.`,
          solutionLatex: `${left} + ${right} = ${left} + ${tensPart} + ${onesPart} = ${answer}`,
        }),
      );
    }
  }

  return facts;
}

function buildCarryFacts() {
  const preset = getPresetById("adicao", "com-vai-um");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let left = 12; left <= 89; left += 1) {
    for (let right = left; right <= 89; right += 1) {
      if (left % 10 + (right % 10) < 10) {
        continue;
      }

      const tensPart = Math.floor(right / 10) * 10;
      const onesPart = right % 10;
      const onesSum = (left % 10) + onesPart;
      const answer = left + right;

      facts.push(
        buildBinaryFact({
          ...timing,
          sectionId: "adicao",
          presetId: "com-vai-um",
          skillKey: createCommutativeSkillKey("add", left, right),
          left,
          operator: "+",
          right,
          answer,
          hint: "Quando as unidades passam de 9, nasce mais uma dezena.",
          breakdown: `${left} + ${right} = ${left} + ${tensPart} + ${onesPart} = ${left + tensPart} + ${onesPart} = ${answer}. Como ${left % 10} + ${onesPart} = ${onesSum}, entra 1 dezena nova.`,
          solutionLatex: `${left} + ${right} = ${left} + ${tensPart} + ${onesPart} = ${answer}`,
        }),
      );
    }
  }

  return facts;
}

function buildBridgeFacts() {
  const preset = getPresetById("adicao", "ponte-100");
  const timing = getPresetTiming(preset);
  const offsets = [-6, -5, -4, -3, -2, 2, 3, 4, 5, 6];
  const facts = [];

  for (let left = 23; left <= 88; left += 1) {
    for (const offset of offsets) {
      const right = 100 - left + offset;

      if (right < 11 || right > 99 || right < left) {
        continue;
      }

      const answer = left + right;
      const adjustText = offset > 0 ? `+ ${offset}` : `- ${Math.abs(offset)}`;

      facts.push(
        buildBinaryFact({
          ...timing,
          sectionId: "adicao",
          presetId: "ponte-100",
          skillKey: createCommutativeSkillKey("add", left, right),
          left,
          operator: "+",
          right,
          answer,
          hint: "Use o 100 como ponte e só depois ajuste o excesso ou a falta.",
          breakdown: `${left} + ${right} = ${left} + ${100 - left} ${adjustText} = 100 ${adjustText} = ${answer}.`,
          solutionLatex:
            offset > 0
              ? `${left} + ${right} = 100 + ${offset} = ${answer}`
              : `${left} + ${right} = 100 - ${Math.abs(offset)} = ${answer}`,
        }),
      );
    }
  }

  return facts;
}
