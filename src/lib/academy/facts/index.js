import { selectScheduledFact } from "../profile";
import { getAdditionFacts } from "./additionFacts";
import { getDivisionFacts } from "./divisionFacts";
import { getTabuadaFacts } from "./multiplicationFacts";
import { createQuestionFromFact } from "./shared";
import { getSquareFacts } from "./squareFacts";
import { getSubtractionFacts } from "./subtractionFacts";
import { getTrickFacts } from "./trickFacts";

export function createPracticeQuestion(
  sectionId,
  presetId,
  { factProfiles = {}, excludeSkillKeys = [], now = Date.now() } = {},
) {
  const facts = getPracticeFacts(sectionId, presetId);

  if (!facts.length) {
    return null;
  }

  const selectedFact = selectScheduledFact(facts, factProfiles, {
    excludeSkillKeys,
    now,
  });

  return selectedFact ? createQuestionFromFact(selectedFact) : null;
}

export function getPracticeFacts(sectionId, presetId) {
  switch (sectionId) {
    case "tabuada":
      return getTabuadaFacts(presetId);
    case "adicao":
      return getAdditionFacts(presetId);
    case "subtracao":
      return getSubtractionFacts(presetId);
    case "divisao":
      return getDivisionFacts(presetId);
    case "quadrado":
      return getSquareFacts(presetId);
    case "tricks":
      return getTrickFacts(presetId);
    default:
      return [];
  }
}

export function gradeQuestion(question, rawAnswer) {
  const answerValue = Number(rawAnswer);
  const isCorrect = answerValue === question.answer;

  return {
    isCorrect,
    feedback: isCorrect
      ? {
          tone: "success",
          title: "Entrou limpo.",
          math: question.solutionLatex,
          detail: question.breakdown,
        }
      : {
          tone: "danger",
          title: "Ainda não.",
          detail: "A conta não fechou. Ajuste a resposta e tente outra vez.",
        },
  };
}
