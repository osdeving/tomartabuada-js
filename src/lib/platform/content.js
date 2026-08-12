import challengeData from "../../data/mental-math-challenges.json";
import theoryData from "../../data/mental-math-theory.json";
import { getPresets } from "../academy/content";
import { getPracticeFacts } from "../academy/facts/index";
import { createQuestionFromFact } from "../academy/facts/shared";
import { selectNextChallenge } from "../adaptive";
import { getPracticeGroup } from "./experience";

const CATALOG_SAMPLE_SIZE = 320;
const bookCandidates = challengeData.desafios
  .filter(isNumericBookChallenge)
  .map(normalizeBookChallenge);
const generatedCatalogCache = new Map();

export const CONTENT_METADATA = {
  source: challengeData.source,
  totalBookExercises: challengeData.estatisticas.total,
  playableBookExercises: challengeData.estatisticas.jogaveis,
  numericBookExercises: bookCandidates.length,
  chapterCount: theoryData.capitulos.length,
};

export const THEORY_CHAPTERS = theoryData.capitulos.map(normalizeTheoryChapter);

export const THEORY_INDEX = THEORY_CHAPTERS.flatMap((chapter) =>
  chapter.topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    patternKeys: [...new Set([...(chapter.patterns ?? []), ...(topic.tags ?? [])])],
    sectionIds: inferSectionIds([...(chapter.patterns ?? []), ...(topic.tags ?? [])]),
    skillPrefixes: inferSkillPrefixes([...(chapter.patterns ?? []), ...(topic.tags ?? [])]),
  })),
);

export function selectAdaptiveQuestion({
  attempts = [],
  baselineAttempts = [],
  chapterOrder = null,
  currentDifficulty = 3,
  groupId = "misto",
  mode = "sparring",
  recentQuestionIds = [],
  sectionPool = null,
  responseScale = 1,
}) {
  const group = getPracticeGroup(groupId);
  const allowedSections = sectionPool?.length
    ? [...new Set(sectionPool.map(([sectionId]) => sectionId))]
    : group.sectionIds;
  const generatedCandidates = buildGeneratedCatalog(sectionPool, allowedSections)
    .filter((candidate) => Math.abs(candidate.difficulty - currentDifficulty) <= 2);
  const relevantBookCandidates = bookCandidates.filter((candidate) => {
    if (!allowedSections.includes(candidate.sectionId)) return false;
    if (chapterOrder != null && candidate.chapter !== chapterOrder) return false;
    return Math.abs(candidate.difficulty - currentDifficulty) <= 1;
  });
  const fallbackBookCandidates = chapterOrder == null
    ? bookCandidates.filter((candidate) => allowedSections.includes(candidate.sectionId))
    : bookCandidates.filter((candidate) => candidate.chapter === chapterOrder);
  const candidates = [
    ...sampleCandidates(generatedCandidates, 190),
    ...sampleCandidates(
      relevantBookCandidates.length ? relevantBookCandidates : fallbackBookCandidates,
      130,
    ),
  ].filter((candidate) => !recentQuestionIds.includes(candidate.id));
  const fallbackCandidates = candidates.length
    ? candidates
    : [...generatedCandidates, ...relevantBookCandidates].slice(0, CATALOG_SAMPLE_SIZE);
  const result = selectNextChallenge(fallbackCandidates, {
    attempts,
    baselineAttempts,
    currentDifficulty,
    groupIds: allowedSections,
    mode: normalizeAdaptiveMode(mode),
    theoryIndex: THEORY_INDEX,
  });

  if (!result?.challenge) return null;

  return materializeQuestion(result.challenge, result.plan, responseScale);
}

export function getTheoryChapter(chapterId) {
  return THEORY_CHAPTERS.find((chapter) => chapter.id === chapterId) ?? THEORY_CHAPTERS[0];
}

export function getTheoryChapterForTopic(topicId) {
  return THEORY_CHAPTERS.find((chapter) => chapter.topics.some((topic) => topic.id === topicId)) ?? null;
}

function buildGeneratedCatalog(sectionPool, allowedSections) {
  const poolKey = sectionPool?.length
    ? sectionPool.map((entry) => entry.join(":" )).join("|")
    : allowedSections.join("|");

  if (generatedCatalogCache.has(poolKey)) return generatedCatalogCache.get(poolKey);

  const requested = sectionPool?.length
    ? sectionPool
    : allowedSections.flatMap((sectionId) =>
        getPresets(sectionId).map((preset) => [sectionId, preset.id]),
      );
  const seen = new Set();
  const catalog = [];

  for (const [sectionId, presetId] of requested) {
    const presets = getPresets(sectionId);
    const presetIndex = Math.max(0, presets.findIndex((preset) => preset.id === presetId));
    const facts = getPracticeFacts(sectionId, presetId);

    for (const fact of facts) {
      const id = `gerado:${sectionId}:${presetId}:${fact.skillKey}`;
      if (seen.has(id)) continue;
      seen.add(id);
      catalog.push({
        id,
        questionId: id,
        sectionId,
        groupId: sectionId,
        skillKey: fact.skillKey,
        patternKey: presetId,
        patternTags: [presetId, sectionId],
        theoryTopicId: theoryTopicFor(sectionId, presetId),
        source: "generated",
        difficulty: generatedDifficulty(fact, presetIndex, presets.length),
        responseWindowMs: fact.responseWindowMs,
        fact,
      });
    }
  }

  generatedCatalogCache.set(poolKey, catalog);
  return catalog;
}

function normalizeBookChallenge(item) {
  const sectionId = mapBookSection(item.tags);
  const difficulty = Math.max(1, Math.min(10, Math.round(1 + ((item.dificuldade - 1) * 9) / 11)));
  const answer = normalizedNumericAnswer(item.resposta);
  const promptLatex = isMathOnlyPrompt(item.prompt) ? toLatex(item.prompt) : null;

  return {
    id: item.id,
    questionId: item.id,
    sectionId,
    groupId: sectionId,
    skillKey: `livro:${item.capituloOrdem}:${item.grupoId}:${item.exercicio}`,
    patternKey: item.grupoId,
    patternTags: item.tags,
    theoryTopicId: closestTheoryTopic(item.capituloId, item.tags),
    source: "book",
    sourceId: item.id,
    difficulty,
    responseWindowMs: bookResponseWindow(item, answer),
    chapter: item.capituloOrdem,
    chapterId: item.capituloId,
    page: item.origem.pagina,
    prompt: localizePrompt(item.prompt),
    promptLatex,
    answer,
    answerDisplay: normalizeAnswerDisplay(item.resposta, answer),
    acceptsDecimal: !Number.isInteger(answer),
    hint: item.instrucao,
    breakdown: `${item.instrucao} Exercício ${item.exercicio} do capítulo ${item.capituloOrdem}.`,
  };
}

function materializeQuestion(challenge, plan, responseScale) {
  let question;

  if (challenge.source === "book") {
    question = {
      id: challenge.id,
      sectionId: challenge.sectionId,
      presetId: challenge.patternKey,
      skillKey: challenge.skillKey,
      prompt: challenge.prompt,
      promptLatex: challenge.promptLatex,
      answer: challenge.answer,
      answerDisplay: challenge.answerDisplay,
      acceptsDecimal: challenge.acceptsDecimal,
      hint: challenge.hint,
      breakdown: challenge.breakdown,
      solutionLatex: challenge.promptLatex
        ? `${challenge.promptLatex} = ${toLatex(String(challenge.answerDisplay))}`
        : null,
      source: "book",
      sourceId: challenge.sourceId,
      chapter: challenge.chapter,
      page: challenge.page,
    };
  } else {
    question = {
      ...createQuestionFromFact(challenge.fact),
      source: "generated",
      sourceId: challenge.id,
      answerDisplay: String(challenge.fact.answer),
      acceptsDecimal: false,
    };
  }

  const adaptiveScale = Number(plan?.difficulty?.responseWindowScale) || 1;
  const responseWindowMs = Math.max(
    2_500,
    Math.min(30_000, Math.round(challenge.responseWindowMs * adaptiveScale * responseScale)),
  );

  return {
    ...question,
    questionId: challenge.id,
    groupId: challenge.groupId,
    patternKey: challenge.patternKey,
    patternTags: challenge.patternTags,
    theoryTopicId: challenge.theoryTopicId,
    difficulty: plan?.difficulty?.nextLevel ?? challenge.difficulty,
    responseWindowMs,
    selectionReasons: plan?.difficulty?.reason ? [plan.difficulty.reason] : [],
    adaptation: plan,
  };
}

function normalizeTheoryChapter(chapter) {
  const examples = chapter.secoes.flatMap((section) =>
    (section.exemplos ?? []).map((example) => ({
      id: example.id,
      prompt: example.prompt,
      promptLatex: isMathOnlyPrompt(example.prompt) ? toLatex(example.prompt) : null,
      answer: example.resposta,
      note: example.resolucao,
      page: example.origem?.pagina,
      tags: example.tags ?? [],
    })),
  );
  const tags = [...new Set([
    ...(chapter.padroes ?? []),
    ...chapter.secoes.flatMap((section) =>
      (section.exemplos ?? []).flatMap((example) => example.tags ?? []),
    ),
  ])];
  const sectionIds = inferSectionIds(tags);

  return {
    id: chapter.id,
    order: chapter.ordem,
    title: chapter.titulo,
    originalTitle: chapter.tituloOriginal,
    summary: chapter.objetivo,
    difficulty: chapter.dificuldade,
    difficultyLabel: difficultyLabel(chapter.dificuldade),
    prerequisites: chapter.prerequisitos,
    patterns: chapter.padroes,
    topics: chapter.secoes.map((section) => ({
      id: section.id,
      order: section.ordem,
      title: section.titulo,
      summary: section.resumo,
      steps: section.passos ?? [],
      formulaText: section.formula ?? null,
      formulaLatex: section.formula ? toLatex(section.formula) : null,
      tags: [...new Set((section.exemplos ?? []).flatMap((example) => example.tags ?? []))],
      pages: section.paginas,
    })),
    examples,
    sectionIds,
    groupId: mapSectionsToGroup(sectionIds),
    pageLabel: pageLabel(chapter.paginasTeoria),
    searchText: [
      chapter.titulo,
      chapter.tituloOriginal,
      chapter.objetivo,
      ...(chapter.padroes ?? []),
      ...chapter.secoes.flatMap((section) => [section.titulo, section.resumo]),
    ].join(" ").toLocaleLowerCase("pt-BR"),
  };
}

function isNumericBookChallenge(item) {
  const answer = normalizedNumericAnswer(item.resposta);
  return item.jogavel &&
    item.resposta?.tipo === "numero" &&
    Number.isFinite(item.resposta.valor) &&
    Number.isInteger(answer) &&
    String(Math.abs(answer)).length <= 6;
}

function localizePrompt(prompt) {
  return String(prompt)
    .replace(/\b1 million\b/gi, "1 milhão")
    .replace(/\bmillion\b/gi, "milhão")
    .replace(/\bbillion\b/gi, "bilhão");
}

function normalizedNumericAnswer(response) {
  const displayNumber = Number(String(response.exibicao ?? "").replace(/[^0-9,.-]/g, "").replace(",", "."));
  if (Number.isFinite(displayNumber)) return displayNumber;
  return Number(Number(response.valor).toFixed(8));
}

function normalizeAnswerDisplay(response, answer) {
  const raw = String(response.exibicao ?? answer).replace(/[^0-9,.-]/g, "").replace(",", ".");
  return raw && Number.isFinite(Number(raw)) ? raw : String(Number(answer.toFixed(8)));
}

function mapBookSection(tags = []) {
  const tagSet = new Set(tags);
  if (tagSet.has("adicao")) return "adicao";
  if (tagSet.has("subtracao")) return "subtracao";
  if (["divisao", "divisibilidade", "fracoes"].some((tag) => tagSet.has(tag))) return "divisao";
  if (["quadrado", "quadrados", "cubos", "raiz-quadrada", "raiz-cubica"].some((tag) => tagSet.has(tag))) return "quadrado";
  if (tagSet.has("tabuada")) return "tabuada";
  if (tagSet.has("multiplicacao")) return "tricks";
  return "tricks";
}

function inferSectionIds(tags = []) {
  const sections = new Set();
  for (const tag of tags) {
    const section = mapBookSection([tag]);
    if (section !== "tricks" || ["multiplicacao", "vezes-11", "estimativa", "calendario", "memoria"].includes(tag)) {
      sections.add(section);
    }
  }
  return sections.size ? [...sections] : ["tricks"];
}

function inferSkillPrefixes(tags) {
  const sections = inferSectionIds(tags);
  return sections.flatMap((section) => ({
    adicao: ["add:"],
    subtracao: ["sub:"],
    tabuada: ["mul:"],
    divisao: ["div:"],
    quadrado: ["square:"],
    tricks: ["mul11:", "same-tens:"],
  })[section] ?? []);
}

function closestTheoryTopic(chapterId, tags) {
  const chapter = theoryData.capitulos.find((item) => item.id === chapterId);
  if (!chapter) return "";
  const section = chapter.secoes.find((item) =>
    (item.exemplos ?? []).some((example) => (example.tags ?? []).some((tag) => tags.includes(tag))),
  );
  return section?.id ?? chapter.secoes[0]?.id ?? "";
}

function theoryTopicFor(sectionId, presetId) {
  const match = THEORY_INDEX.find((topic) =>
    topic.sectionIds.includes(sectionId) && topic.patternKeys.some((key) => presetId.includes(key) || key.includes(presetId)),
  );
  return match?.id ?? THEORY_INDEX.find((topic) => topic.sectionIds.includes(sectionId))?.id ?? "";
}

function generatedDifficulty(fact, presetIndex, presetCount) {
  const presetLift = presetCount <= 1 ? 0 : (presetIndex / (presetCount - 1)) * 4;
  const magnitude = Math.max(Math.abs(Number(fact.left) || 0), Math.abs(Number(fact.right) || 0), Math.abs(Number(fact.answer) || 0));
  const magnitudeLift = magnitude >= 10_000 ? 4 : magnitude >= 1_000 ? 3 : magnitude >= 100 ? 2 : magnitude >= 20 ? 1 : 0;
  return Math.max(1, Math.min(10, Math.round(1 + presetLift + magnitudeLift)));
}

function bookResponseWindow(item, answer) {
  const promptLength = item.prompt.length;
  const digits = String(Math.abs(answer)).length;
  return Math.max(6_000, Math.min(28_000, 8_000 + (item.dificuldade - 1) * 850 + Math.max(0, digits - 2) * 500 + Math.max(0, promptLength - 18) * 80));
}

function sampleCandidates(items, limit) {
  if (items.length <= limit) return items;
  const output = [];
  const step = items.length / limit;
  const offset = Math.random() * step;
  for (let index = 0; index < limit; index += 1) {
    output.push(items[Math.floor((offset + index * step) % items.length)]);
  }
  return output;
}

function isMathOnlyPrompt(prompt) {
  return /^[\d\s.,()+\-×x÷/^²³%=<>≈]+$/u.test(prompt.trim());
}

function toLatex(value) {
  return String(value)
    .replace(/×|\bx\b/giu, "\\times")
    .replace(/÷/g, "\\div")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/≈/g, "\\approx")
    .replace(/→/g, "\\rightarrow")
    .replace(/\|/g, "\\mid");
}

function difficultyLabel(level) {
  if (level <= 2) return "Fundação";
  if (level <= 4) return "Essencial";
  if (level <= 6) return "Intermediário";
  if (level <= 8) return "Avançado";
  return "Maestria";
}

function pageLabel(pages = []) {
  if (!pages.length) return "";
  if (pages.length === 1) return `p. ${pages[0]}`;
  return `pp. ${Math.min(...pages)}–${Math.max(...pages)}`;
}

function mapSectionsToGroup(sectionIds) {
  if (sectionIds.length !== 1) return "misto";
  if (sectionIds[0] === "tricks") return "quadrado";
  return sectionIds[0];
}

function normalizeAdaptiveMode(mode) {
  if (mode === "sobrevivencia") return "survival";
  if (mode === "campanha") return "campaign";
  return "sparring";
}
