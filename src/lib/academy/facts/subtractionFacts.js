import { getPresetById } from "../content";
import {
  buildBinaryFact,
  createOrderedSkillKey,
  getPresetTiming,
  mergeFactSets,
} from "./shared";

const subtractionCache = new Map();

export function getSubtractionFacts(presetId) {
  if (!subtractionCache.has(presetId)) {
    subtractionCache.set(presetId, buildSubtractionFacts(presetId));
  }

  return subtractionCache.get(presetId) ?? [];
}

function buildSubtractionFacts(presetId) {
  switch (presetId) {
    case "complementos-10":
      return buildComplementFacts();
    case "passa-10":
      return buildCrossTenFacts();
    case "misto-1-algarismo":
      return mergeFactSets(buildComplementFacts(), buildCrossTenFacts());
    case "sem-emprestimo":
      return buildNoBorrowFacts();
    case "com-emprestimo":
      return buildBorrowFacts();
    case "ajuste-redondo":
      return buildRoundAdjustmentFacts();
    case "misto":
    default:
      return mergeFactSets(
        buildComplementFacts(),
        buildCrossTenFacts(),
        buildNoBorrowFacts(),
        buildBorrowFacts(),
        buildRoundAdjustmentFacts(),
      );
  }
}

function buildComplementFacts() {
  const preset = getPresetById("subtracao", "complementos-10");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let right = 1; right <= 9; right += 1) {
    const answer = 10 - right;

    facts.push(
      buildBinaryFact({
        ...timing,
        sectionId: "subtracao",
        presetId: "complementos-10",
        skillKey: createOrderedSkillKey("sub", 10, right),
        left: 10,
        operator: "-",
        right,
        answer,
        hint: "Veja direto o quanto falta para chegar em 10.",
        breakdown: `Se saiu ${right} de 10, sobraram ${answer}.`,
        solutionLatex: `10 - ${right} = ${answer}`,
      }),
    );
  }

  return facts;
}

function buildCrossTenFacts() {
  const preset = getPresetById("subtracao", "passa-10");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let left = 11; left <= 18; left += 1) {
    for (let right = 2; right <= 9; right += 1) {
      const answer = left - right;

      if (answer < 1 || answer > 9 || left - 10 >= right) {
        continue;
      }

      const toTen = left - 10;
      const rest = right - toTen;

      facts.push(
        buildBinaryFact({
          ...timing,
          sectionId: "subtracao",
          presetId: "passa-10",
          skillKey: createOrderedSkillKey("sub", left, right),
          left,
          operator: "-",
          right,
          answer,
          hint: "Desça até 10 e depois tire o resto.",
          breakdown: `${left} - ${right} = ${left} - ${toTen} - ${rest} = 10 - ${rest} = ${answer}.`,
          solutionLatex: `${left} - ${right} = ${left} - ${toTen} - ${rest} = ${answer}`,
        }),
      );
    }
  }

  return facts;
}

function buildNoBorrowFacts() {
  const preset = getPresetById("subtracao", "sem-emprestimo");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let left = 31; left <= 99; left += 1) {
    for (let right = 11; right < left; right += 1) {
      if (left % 10 < right % 10) {
        continue;
      }

      const tensPart = Math.floor(right / 10) * 10;
      const onesPart = right % 10;
      const answer = left - right;

      facts.push(
        buildBinaryFact({
          ...timing,
          sectionId: "subtracao",
          presetId: "sem-emprestimo",
          skillKey: createOrderedSkillKey("sub", left, right),
          left,
          operator: "-",
          right,
          answer,
          hint: "Desça pelas dezenas, depois feche as unidades.",
          breakdown: `${left} - ${right} = ${left} - ${tensPart} - ${onesPart} = ${left - tensPart} - ${onesPart} = ${answer}.`,
          solutionLatex: `${left} - ${right} = ${left} - ${tensPart} - ${onesPart} = ${answer}`,
        }),
      );
    }
  }

  return facts;
}

function buildBorrowFacts() {
  const preset = getPresetById("subtracao", "com-emprestimo");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let left = 31; left <= 99; left += 1) {
    for (let right = 11; right < left; right += 1) {
      if (left % 10 >= right % 10) {
        continue;
      }

      const tensPart = Math.floor(right / 10) * 10;
      const onesPart = right % 10;
      const afterTens = left - tensPart;
      const answer = left - right;

      facts.push(
        buildBinaryFact({
          ...timing,
          sectionId: "subtracao",
          presetId: "com-emprestimo",
          skillKey: createOrderedSkillKey("sub", left, right),
          left,
          operator: "-",
          right,
          answer,
          hint: "Se faltar unidade, transforme 2 em 12, 3 em 13 e assim por diante.",
          breakdown: `${left} - ${right} = ${left} - ${tensPart} - ${onesPart} = ${afterTens} - ${onesPart} = ${answer}. Como ${afterTens % 10} não tira ${onesPart}, pegue 1 dezena e pense em ${afterTens % 10 + 10} - ${onesPart}.`,
          solutionLatex: `${left} - ${right} = ${left} - ${tensPart} - ${onesPart} = ${answer}`,
        }),
      );
    }
  }

  return facts;
}

function buildRoundAdjustmentFacts() {
  const preset = getPresetById("subtracao", "ajuste-redondo");
  const timing = getPresetTiming(preset);
  const facts = [];

  for (let left = 41; left <= 99; left += 1) {
    for (let roundBase = 20; roundBase <= 80; roundBase += 10) {
      for (let offset = 1; offset <= 3; offset += 1) {
        for (const direction of [-1, 1]) {
          const right = roundBase + direction * offset;

          if (right < 11 || right >= left) {
            continue;
          }

          const answer = left - right;
          const adjustText = direction === -1 ? `+ ${offset}` : `- ${offset}`;

          facts.push(
            buildBinaryFact({
              ...timing,
              sectionId: "subtracao",
              presetId: "ajuste-redondo",
              skillKey: createOrderedSkillKey("sub", left, right),
              left,
              operator: "-",
              right,
              answer,
              hint: "Troque o número torto por um número redondo e ajuste no fim.",
              breakdown: `${left} - ${right} = ${left} - ${roundBase} ${adjustText} = ${answer}.`,
              solutionLatex:
                direction === -1
                  ? `${left} - ${right} = ${left} - ${roundBase} + ${offset} = ${answer}`
                  : `${left} - ${right} = ${left} - ${roundBase} - ${offset} = ${answer}`,
            }),
          );
        }
      }
    }
  }

  return facts;
}
