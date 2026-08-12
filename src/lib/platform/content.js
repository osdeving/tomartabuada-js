import theoryData from "../../data/mental-math-theory.json";
import theoryTopicLessons from "../../data/theory-topic-lessons.json";
import { getPresets } from "../academy/content";
import { getPracticeFacts } from "../academy/facts/index";
import { createQuestionFromFact } from "../academy/facts/shared";
import { selectNextChallenge } from "../adaptive";
import { numericAnswerFromContract } from "./answers";
import { getPracticeGroup } from "./experience";

const CATALOG_SAMPLE_SIZE = 320;
const generatedCatalogCache = new Map();
let theoryChaptersPromise = null;
let bookCandidatesPromise = null;
const PRIMARY_BOOK_DOCUMENT_ID = "calculo-mental-use-esse";

export const CONTENT_METADATA = {
  source: "Course Guidebook, 2011 + Secrets of Mental Math, 2006",
  totalBookExercises: 1_057,
  playableBookExercises: 1_012,
  numericBookExercises: 772,
  adaptiveBookExercises: 874,
  chapterCount: theoryData.capitulos.length,
};

export const THEORY_INDEX = theoryData.capitulos.flatMap((chapter) =>
  chapter.secoes.map((topic) => {
    const topicTags = [...new Set((topic.exemplos ?? []).flatMap((example) => example.tags ?? []))];
    const patternKeys = [...new Set([...(chapter.padroes ?? []), ...topicTags])];
    return {
      id: topic.id,
      title: topic.titulo,
      patternKeys,
      sectionIds: inferSectionIds(patternKeys),
      skillPrefixes: inferSkillPrefixes(patternKeys),
    };
  }),
);

export function loadTheoryChapters() {
  if (theoryChaptersPromise) return theoryChaptersPromise;
  theoryChaptersPromise = Promise.all([
    import("../../data/theory-details-01-04.json"),
    import("../../data/theory-details-05-08.json"),
    import("../../data/theory-details-09-12.json"),
    import("../../data/full-book-theory-00-03.json"),
    import("../../data/full-book-theory-04-06.json"),
    import("../../data/full-book-theory-07-09.json"),
  ]).then((modules) => {
    const [details0104, details0508, details0912, fullBook0003, fullBook0406, fullBook0709] = modules.map((module) => module.default);
    const detailedTheoryByChapter = new Map(
      [details0104, details0508, details0912]
        .flatMap((source) => source.capitulos)
        .map((chapter) => [chapter.capituloId, chapter]),
    );
    const fullBookChapters = [fullBook0003, fullBook0406, fullBook0709]
      .flatMap((source) => source.chapters ?? []);

    return [
      ...fullBookChapters.map(normalizeFullBookChapter),
      ...theoryData.capitulos.map((chapter) => ({
        ...normalizeTheoryChapter(chapter, detailedTheoryByChapter.get(chapter.id)),
        sourceKind: "guidebook",
      })),
    ];
  }).catch((error) => {
    theoryChaptersPromise = null;
    throw error;
  });
  return theoryChaptersPromise;
}

export async function selectAdaptiveQuestion({
  attempts = [],
  baselineAttempts = [],
  chapterOrder = null,
  currentDifficulty = 3,
  groupId = "misto",
  mode = "sparring",
  recentQuestionIds = [],
  sectionPool = null,
  responseScale = 1,
  theoryTopicIds = null,
  allowedSectionIds = null,
  sourceChapterOrder = null,
}) {
  const bookCandidates = await loadBookCandidates();
  const group = getPracticeGroup(groupId);
  const allowedSections = sectionPool?.length
    ? [...new Set(sectionPool.map(([sectionId]) => sectionId))]
    : allowedSectionIds?.length
      ? [...new Set(allowedSectionIds)]
      : group.sectionIds;
  const generatedCandidates = buildGeneratedCatalog(sectionPool, allowedSections)
    .filter((candidate) => !theoryTopicIds?.length || theoryTopicIds.includes(candidate.theoryTopicId))
    .filter((candidate) => Math.abs(candidate.difficulty - currentDifficulty) <= 2);
  const relevantBookCandidates = bookCandidates.filter((candidate) => {
    if (!allowedSections.includes(candidate.sectionId)) return false;
    if (chapterOrder != null && candidate.chapter !== chapterOrder) return false;
    if (sourceChapterOrder != null && (
      candidate.sourceDocumentId !== PRIMARY_BOOK_DOCUMENT_ID
      || candidate.sourceChapterOrder !== sourceChapterOrder
    )) return false;
    if (theoryTopicIds?.length && !theoryTopicIds.includes(candidate.theoryTopicId)) return false;
    return Math.abs(candidate.difficulty - currentDifficulty) <= 1;
  });
  const fallbackBookCandidates = bookCandidates.filter((candidate) =>
    allowedSections.includes(candidate.sectionId)
    && (chapterOrder == null || candidate.chapter === chapterOrder)
    && (sourceChapterOrder == null || (
      candidate.sourceDocumentId === PRIMARY_BOOK_DOCUMENT_ID
      && candidate.sourceChapterOrder === sourceChapterOrder
    ))
    && (!theoryTopicIds?.length || theoryTopicIds.includes(candidate.theoryTopicId)),
  );
  const candidates = [
    ...sampleCandidates(generatedCandidates, 190),
    ...sampleCandidates(
      relevantBookCandidates.length ? relevantBookCandidates : fallbackBookCandidates,
      130,
    ),
  ].filter((candidate) => !recentQuestionIds.includes(candidate.id));
  const contextualCandidates = sourceChapterOrder != null && (relevantBookCandidates.length || fallbackBookCandidates.length)
    ? [...relevantBookCandidates, ...fallbackBookCandidates]
    : [...generatedCandidates, ...relevantBookCandidates];
  const fallbackCandidates = candidates.length ? candidates : contextualCandidates.slice(0, CATALOG_SAMPLE_SIZE);
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

export function preloadPracticeContent() {
  return loadBookCandidates();
}

function loadBookCandidates() {
  if (bookCandidatesPromise) return bookCandidatesPromise;
  bookCandidatesPromise = Promise.all([
    import("../../data/mental-math-challenges.json"),
    import("../../data/full-book-challenges-01-03.json"),
    import("../../data/full-book-challenges-04-06.json"),
    import("../../data/full-book-challenges-08-09.json"),
  ])
    .then(([guide, fullBook0103, fullBook0406, fullBook0809]) => [
      ...guide.default.desafios
        .filter(isNumericBookChallenge)
        .map(normalizeBookChallenge),
      ...[fullBook0103.default, fullBook0406.default, fullBook0809.default]
        .flatMap((file) => file.challenges)
        .filter(isPlayableFullBookChallenge)
        .map(normalizeFullBookChallenge),
    ])
    .catch((error) => {
      bookCandidatesPromise = null;
      throw error;
    });
  return bookCandidatesPromise;
}

function isPlayableFullBookChallenge(item) {
  if (!item.playable) return false;
  return [
    "exact-number",
    "decimal-tolerance",
    "quotient-remainder",
    "rational",
    "boolean",
    "enum",
    "relative-range",
  ].includes(item.answer?.type);
}

function normalizeFullBookChallenge(item) {
  const grading = normalizeFullBookAnswer(item.answer);
  const prompt = localizePrompt(item.prompt);
  const promptLatex = isMathOnlyPrompt(prompt) ? toLatex(prompt) : null;
  const answerDigits = grading.inputValue.replace(/[^0-9]/g, "").length;

  return {
    id: item.id,
    questionId: item.id,
    sectionId: item.sectionId,
    groupId: item.sectionId,
    skillKey: `${PRIMARY_BOOK_DOCUMENT_ID}:${item.sourceChapterOrder}:${item.exerciseSetId}:${item.exerciseNumber}`,
    patternKey: item.exerciseSetId,
    patternTags: item.tags ?? [],
    theoryTopicId: item.theoryTopicId,
    relatedTheoryTopicIds: item.relatedTheoryTopicIds ?? [],
    source: "book",
    sourceId: item.id,
    sourceDocumentId: PRIMARY_BOOK_DOCUMENT_ID,
    difficulty: Math.max(1, Math.min(10, Number(item.difficulty) || 1)),
    responseWindowMs: fullBookResponseWindow(item, answerDigits),
    chapter: canonicalChapterOrderForTopic(item.theoryTopicId),
    sourceChapterOrder: item.sourceChapterOrder,
    page: item.source.promptPrintedPage,
    prompt,
    promptLatex,
    answer: grading.expected,
    answerDisplay: grading.display,
    answerInput: grading.inputValue,
    answerType: item.answer.type,
    answerSpec: item.answer,
    choices: grading.choices,
    acceptsDecimal: grading.acceptsDecimal,
    tolerance: grading.tolerance,
    hint: item.exerciseSetTitle,
    breakdown: (item.solutionSteps ?? [])
      .map((step) => [step.expression, step.explanation].filter(Boolean).join(" — "))
      .join(" "),
  };
}

function normalizeFullBookAnswer(answer) {
  if (answer.type === "quotient-remainder") {
    const quotient = Number(answer.quotient);
    const remainder = Number(answer.remainder);
    return {
      expected: `${quotient}|${remainder}`,
      display: answer.display ?? `${quotient}, resto ${remainder}`,
      inputValue: `${quotient}|${remainder}`,
      acceptsDecimal: false,
      tolerance: 0,
      choices: null,
    };
  }
  if (answer.type === "rational") {
    const numerator = Number(answer.numerator);
    const denominator = Number(answer.denominator);
    return {
      expected: `${numerator}/${denominator}`,
      display: answer.display ?? `${numerator}/${denominator}`,
      inputValue: `${numerator}/${denominator}`,
      acceptsDecimal: false,
      tolerance: 0,
      choices: null,
    };
  }
  if (answer.type === "boolean") {
    return {
      expected: Boolean(answer.value),
      display: answer.display ?? (answer.value ? "Sim" : "Não"),
      inputValue: answer.value ? "true" : "false",
      acceptsDecimal: false,
      tolerance: 0,
      choices: [
        { value: true, label: "Sim" },
        { value: false, label: "Não" },
      ],
    };
  }
  if (answer.type === "enum") {
    return {
      expected: String(answer.value),
      display: answer.display ?? String(answer.value),
      inputValue: String(answer.value),
      acceptsDecimal: false,
      tolerance: 0,
      choices: (answer.options ?? []).map((value) => ({ value, label: enumAnswerLabel(value) })),
    };
  }
  if (answer.type === "relative-range") {
    const target = Number(answer.target ?? answer.value);
    return {
      expected: target,
      display: answer.display ?? String(target),
      inputValue: String(target),
      acceptsDecimal: !Number.isInteger(target),
      tolerance: 0,
      choices: null,
    };
  }

  const value = Number(answer.value);
  return {
    expected: value,
    display: answer.display ?? String(value),
    inputValue: String(value),
    acceptsDecimal: answer.type === "decimal-tolerance" || !Number.isInteger(value),
    tolerance: answer.type === "decimal-tolerance" ? Number(answer.tolerance) || 0.001 : 0.000001,
    choices: null,
  };
}

function enumAnswerLabel(value) {
  if (value === "data-invalida") return "Data inválida";
  return String(value).replace(/^./, (character) => character.toLocaleUpperCase("pt-BR"));
}

function canonicalChapterOrderForTopic(topicId) {
  return theoryData.capitulos.find((chapter) => chapter.secoes.some((section) => section.id === topicId))?.ordem ?? null;
}

function fullBookResponseWindow(item, digits) {
  const base = 7_000 + Math.max(0, Number(item.difficulty) - 1) * 1_100;
  return Math.max(6_000, Math.min(30_000, base + Math.max(0, digits - 2) * 650));
}

export async function getTheoryChapter(chapterId) {
  const chapters = await loadTheoryChapters();
  return chapters.find((chapter) => chapter.id === chapterId) ?? chapters[0];
}

export async function getTheoryChapterForTopic(topicId) {
  const chapters = await loadTheoryChapters();
  const fullBookMatch = bestFullBookTheoryMatch(chapters, topicId);
  const canonicalTheoryChapters = chapters.filter((chapter) => chapter.sourceKind === "guidebook");
  return fullBookMatch?.chapter
    ?? canonicalTheoryChapters.find((chapter) => chapter.topics.some((topic) => topic.id === topicId))
    ?? null;
}

export async function getTheoryTargetForTopic(topicId) {
  const chapters = await loadTheoryChapters();
  const fullBookMatch = bestFullBookTheoryMatch(chapters, topicId);
  if (fullBookMatch) {
    return { chapterId: fullBookMatch.chapter.id, lessonId: fullBookMatch.lesson.id };
  }
  const chapter = chapters.find((candidate) =>
    candidate.sourceKind === "guidebook" && candidate.topics.some((topic) => topic.id === topicId),
  );
  if (!chapter) return null;
  const topic = chapter.topics.find((item) => item.id === topicId);
  return {
    chapterId: chapter.id,
    lessonId: topic?.relatedLessonId ?? chapter.lessons[0]?.id ?? null,
  };
}

function bestFullBookTheoryMatch(chapters, topicId) {
  return chapters
    .filter((chapter) => chapter.sourceKind === "full-book")
    .flatMap((chapter) => chapter.lessons
      .filter((lesson) => lesson.theoryTopicIds.includes(topicId))
      .map((lesson) => ({ chapter, lesson })))
    .sort((left, right) => theoryLessonScore(right.lesson, topicId) - theoryLessonScore(left.lesson, topicId))[0]
    ?? null;
}

function theoryLessonScore(lesson, topicId) {
  const isPreview = /\bprévia\b|\bprevia\b/i.test(lesson.title);
  return (lesson.theoryTopicIds[0] === topicId ? 20 : 0)
    + lesson.algorithm.steps.length * 4
    + lesson.workedExamples.length * 10
    - (isPreview ? 100 : 0);
}

function normalizeFullBookChapter(rawChapter) {
  const lessons = (rawChapter.lessons ?? []).map((lesson, index) => normalizeFullBookLesson(lesson, index));
  const theoryTopicIds = [...new Set([
    ...(rawChapter.theoryTopicIds ?? []),
    ...lessons.flatMap((lesson) => lesson.theoryTopicIds),
  ])];
  const headerSearchText = buildSearchIndex([
    rawChapter.title,
    rawChapter.originalTitle,
    rawChapter.summary,
    rawChapter.prerequisites,
  ]);
  const topicSearchText = buildSearchIndex(lessons.flatMap((lesson) => [lesson.title, lesson.tags]));
  const sectionIds = fullBookPracticeSections(rawChapter);
  const groupId = mapSectionsToGroup(sectionIds);

  return {
    id: rawChapter.id,
    order: Number(rawChapter.order) + 1,
    sourceOrder: Number(rawChapter.order),
    title: rawChapter.title,
    originalTitle: rawChapter.originalTitle,
    summary: rawChapter.summary,
    difficulty: rawChapter.difficulty,
    difficultyLabel: difficultyLabel(rawChapter.difficulty),
    prerequisites: rawChapter.prerequisites ?? [],
    patterns: lessons.flatMap((lesson) => lesson.tags),
    lessons,
    workedExampleCount: lessons.reduce((total, lesson) => total + lesson.workedExamples.length, 0),
    algorithmStepCount: lessons.reduce((total, lesson) => total + lesson.algorithm.steps.length, 0),
    topics: theoryTopicIds.map((id, index) => ({ id, order: index + 1, title: id, tags: [] })),
    theoryTopicIds,
    examples: [],
    sectionIds,
    groupId,
    pageLabel: pageLabel(rawChapter.printedPages),
    sourceKind: "full-book",
    sourceLabel: "Livro completo · Three Rivers Press, 2006",
    headerSearchText,
    topicSearchText,
    searchText: buildSearchIndex([headerSearchText, topicSearchText, ...lessons.map((lesson) => lesson.searchText)]),
  };
}

function fullBookPracticeSections(rawChapter) {
  return ({
    0: ["tricks"],
    1: ["adicao", "subtracao"],
    2: ["tabuada", "quadrado"],
    3: ["tricks", "tabuada", "quadrado"],
    4: ["divisao"],
    5: ["adicao", "subtracao", "divisao", "tricks", "quadrado"],
    6: ["adicao", "subtracao", "quadrado", "tricks"],
    7: ["tricks"],
    8: ["quadrado", "tabuada"],
    9: ["tricks"],
  })[Number(rawChapter.order)] ?? ["tricks"];
}

function normalizeFullBookLesson(rawLesson, lessonIndex) {
  const lesson = normalizeDetailedLesson({
    id: rawLesson.id,
    ordem: rawLesson.order,
    titulo: rawLesson.title,
    resumo: rawLesson.summary,
    quandoUsar: rawLesson.whenToUse,
    porQueFunciona: rawLesson.whyItWorks,
    algoritmo: {
      titulo: rawLesson.algorithm?.title,
      passos: (rawLesson.algorithm?.steps ?? []).map((step) => ({
        ordem: step.order,
        acao: step.action,
        detalhe: step.detail,
        expressao: step.expression,
      })),
    },
    exemplosResolvidos: (rawLesson.workedExamples ?? []).map((example) => ({
      id: example.id,
      enunciado: example.question,
      resposta: example.answer,
      etapas: (example.steps ?? []).map((step) => ({ expressao: step.expression, explicacao: step.explanation })),
      conclusao: example.conclusion,
      origem: { pagina: example.source?.printedPage },
      visualizacao: example.visualizacao,
    })),
    armadilhas: rawLesson.pitfalls,
    lembrete: rawLesson.memoryCue,
    tags: rawLesson.tags,
    origem: { documentoId: "calculo-mental-use-esse", paginas: rawLesson.source?.printedPages },
  }, lessonIndex);

  return { ...lesson, theoryTopicIds: rawLesson.theoryTopicIds ?? [] };
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
    sourceDocumentId: item.origem.documentoId,
    difficulty,
    responseWindowMs: bookResponseWindow(item, answer),
    chapter: item.capituloOrdem,
    sourceChapterOrder: item.capituloOrdem,
    chapterId: item.capituloId,
    page: item.origem.pagina,
    prompt: localizePrompt(item.prompt),
    promptLatex,
    answer,
    answerDisplay: normalizeAnswerDisplay(item.resposta, answer),
    answerInput: String(answer),
    answerType: "exact-number",
    answerSpec: item.resposta,
    choices: null,
    acceptsDecimal: !Number.isInteger(answer),
    tolerance: 0.000001,
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
      answerInput: challenge.answerInput,
      answerType: challenge.answerType ?? "exact-number",
      answerSpec: challenge.answerSpec ?? null,
      choices: challenge.choices ?? null,
      acceptsDecimal: challenge.acceptsDecimal,
      tolerance: challenge.tolerance,
      hint: challenge.hint,
      breakdown: challenge.breakdown,
      solutionLatex: challenge.promptLatex
        ? `${challenge.promptLatex} = ${toLatex(String(challenge.answerDisplay))}`
        : null,
      source: "book",
      sourceId: challenge.sourceId,
      sourceDocumentId: challenge.sourceDocumentId,
      chapter: challenge.chapter,
      sourceChapterOrder: challenge.sourceChapterOrder,
      page: challenge.page,
    };
  } else {
    question = {
      ...createQuestionFromFact(challenge.fact),
      source: "generated",
      sourceId: challenge.id,
      sourceDocumentId: "generated",
      answerDisplay: String(challenge.fact.answer),
      answerInput: String(challenge.fact.answer),
      answerType: "exact-number",
      answerSpec: null,
      choices: null,
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

function normalizeTheoryChapter(chapter, detailedChapter = null) {
  const examples = chapter.secoes.flatMap((section) =>
    (section.exemplos ?? []).map((example) => ({
      id: example.id,
      prompt: example.prompt,
      promptLatex: isMathOnlyPrompt(example.prompt) ? toLatex(example.prompt) : null,
      answer: example.resposta,
      note: example.resolucao,
      page: example.origem?.pagina,
      tags: example.tags ?? [],
      searchText: buildSearchIndex([
        example.prompt,
        example.resposta,
        example.resolucao,
        example.tags,
      ]),
    })),
  );
  const detailedLessons = detailedChapter?.dicas ?? detailedChapter?.tips ?? [];
  const lessons = detailedLessons.length
    ? detailedLessons.map((lesson, lessonIndex) => normalizeDetailedLesson(lesson, lessonIndex))
    : chapter.secoes.map((section, sectionIndex) => normalizeFallbackLesson(section, sectionIndex));
  const tags = [...new Set([
    ...(chapter.padroes ?? []),
    ...chapter.secoes.flatMap((section) =>
      (section.exemplos ?? []).flatMap((example) => example.tags ?? []),
    ),
  ])];
  const sectionIds = inferSectionIds(tags);
  const topics = chapter.secoes.map((section) => {
    const topic = {
      id: section.id,
      order: section.ordem,
      title: section.titulo,
      summary: section.resumo,
      steps: section.passos ?? [],
      formulaText: section.formula ?? null,
      formulaLatex: section.formula ? toLatex(section.formula) : null,
      tags: [...new Set((section.exemplos ?? []).flatMap((example) => example.tags ?? []))],
      pages: section.paginas,
    };
    return {
      ...topic,
      relatedLessonId: theoryTopicLessons.mapeamentos[section.id] ?? lessons[0]?.id ?? null,
    };
  });
  const headerSearchText = buildSearchIndex([
    chapter.titulo,
    chapter.tituloOriginal,
    chapter.objetivo,
    ...(chapter.prerequisitos ?? []),
    ...(chapter.padroes ?? []),
  ]);
  const topicSearchText = buildSearchIndex(chapter.secoes.flatMap((section) => [
    section.titulo,
    section.resumo,
    section.formula,
    section.passos,
  ]));
  const searchText = buildSearchIndex([
    headerSearchText,
    topicSearchText,
    ...lessons.map((lesson) => lesson.searchText),
    ...examples.flatMap((example) => [example.prompt, example.note, ...(example.tags ?? [])]),
  ]);

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
    lessons,
    workedExampleCount: lessons.reduce((total, lesson) => total + lesson.workedExamples.length, 0),
    algorithmStepCount: lessons.reduce((total, lesson) => total + lesson.algorithm.steps.length, 0),
    topics,
    examples,
    sectionIds,
    groupId: mapSectionsToGroup(sectionIds),
    pageLabel: pageLabel(chapter.paginasTeoria),
    headerSearchText,
    topicSearchText,
    searchText,
  };
}

function normalizeDetailedLesson(rawLesson, lessonIndex) {
  const rawAlgorithm = rawLesson.algoritmo ?? rawLesson.algorithm ?? {};
  const algorithmSteps = (rawAlgorithm.passos ?? rawAlgorithm.steps ?? []).map((step, stepIndex) => ({
    order: step.ordem ?? step.order ?? stepIndex + 1,
    action: step.acao ?? step.action ?? `Passo ${stepIndex + 1}`,
    detail: step.detalhe ?? step.detail ?? "",
    expression: step.expressao ?? step.expression ?? null,
  }));
  const workedExamples = (rawLesson.exemplosResolvidos ?? rawLesson.workedExamples ?? []).map((example, exampleIndex) => ({
    id: example.id ?? `${rawLesson.id}-resolved-${exampleIndex + 1}`,
    question: example.enunciado ?? example.question ?? "",
    answer: displayTheoryValue(example.resposta ?? example.answer),
    steps: (example.etapas ?? example.steps ?? []).map((step) => ({
      expression: step.expressao ?? step.expression ?? null,
      explanation: step.explicacao ?? step.explanation ?? "",
    })),
    conclusion: example.conclusao ?? example.conclusion ?? "",
    page: example.origem?.pagina ?? example.source?.page ?? null,
    visual: example.visualizacao ?? example.visual ?? null,
  }));
  const pages = rawLesson.origem?.paginas ?? rawLesson.source?.pages ?? rawLesson.paginas ?? rawLesson.pages ?? [];
  const lesson = {
    id: rawLesson.id ?? `detailed-theory-lesson-${lessonIndex + 1}`,
    order: rawLesson.ordem ?? rawLesson.order ?? lessonIndex + 1,
    title: rawLesson.titulo ?? rawLesson.title ?? `Dica ${lessonIndex + 1}`,
    summary: rawLesson.resumo ?? rawLesson.summary ?? "",
    whenToUse: rawLesson.quandoUsar ?? rawLesson.whenToUse ?? [],
    whyItWorks: rawLesson.porQueFunciona ?? rawLesson.whyItWorks ?? "",
    algorithm: {
      title: rawAlgorithm.titulo ?? rawAlgorithm.title ?? "Como aplicar",
      steps: algorithmSteps,
    },
    workedExamples,
    pitfalls: rawLesson.armadilhas ?? rawLesson.pitfalls ?? [],
    memoryCue: rawLesson.lembrete ?? rawLesson.memoryCue ?? "",
    tags: rawLesson.tags ?? [],
    pageLabel: pageLabel(pages),
    sourceLabel: rawLesson.origem?.documentoId === "calculo-mental-use-esse"
      ? "Secrets of Mental Math, 2006"
      : "Course Guidebook, 2011",
  };
  return {
    ...lesson,
    searchText: buildSearchIndex([
      lesson.title,
      lesson.summary,
      lesson.whenToUse,
      lesson.whyItWorks,
      lesson.algorithm.title,
      lesson.algorithm.steps.flatMap((step) => [step.action, step.detail, step.expression]),
      lesson.workedExamples.flatMap((example) => [
        example.question,
        example.answer,
        example.conclusion,
        example.steps.flatMap((step) => [step.expression, step.explanation]),
        example.visual
          ? [
              example.visual.rotulo,
              example.visual.leitura,
              example.visual.inicio,
              example.visual.resultado,
              (example.visual.etapas ?? example.visual.passos ?? []).flatMap((step) => [
                step.expressao,
                step.rotulo,
                step.narracao,
              ]),
            ]
          : null,
      ]),
      lesson.pitfalls,
      lesson.memoryCue,
      lesson.tags,
    ]),
  };
}

function normalizeFallbackLesson(section, sectionIndex) {
  const rawSteps = section.passos?.length
    ? section.passos
    : ["Reconheça o padrão numérico.", section.resumo, "Confira se a ordem de grandeza da resposta faz sentido."];
  const algorithmSteps = rawSteps.map((step, stepIndex) => {
    const [possibleAction, ...detailParts] = String(step).split(":");
    const hasNamedAction = detailParts.length > 0 && possibleAction.length < 42;
    return {
      order: stepIndex + 1,
      action: hasNamedAction ? possibleAction.trim() : `Passo ${stepIndex + 1}`,
      detail: hasNamedAction ? detailParts.join(":").trim() : String(step),
      expression: null,
    };
  });
  const workedExamples = (section.exemplos ?? []).map((example, exampleIndex) => ({
    id: example.id ?? `${section.id}-resolved-${exampleIndex + 1}`,
    question: example.prompt,
    answer: String(example.resposta ?? ""),
    steps: example.resolucao
      ? [{ expression: null, explanation: example.resolucao }]
      : [],
    conclusion: "Use o mesmo encadeamento ao reconhecer outro exemplo com a mesma estrutura.",
    page: example.origem?.pagina ?? section.paginas?.[0] ?? null,
  }));
  const lesson = {
    id: section.id ?? `theory-lesson-${sectionIndex + 1}`,
    order: section.ordem ?? sectionIndex + 1,
    title: section.titulo ?? `Técnica ${sectionIndex + 1}`,
    summary: section.resumo ?? "",
    whenToUse: ["Quando a conta apresentar este mesmo padrão ou puder ser reorganizada para chegar a ele."],
    whyItWorks: section.resumo ?? "A técnica reorganiza a conta em etapas menores e mais fáceis de manter na memória.",
    algorithm: {
      title: `Como aplicar ${String(section.titulo ?? "a técnica").toLocaleLowerCase("pt-BR")}`,
      steps: algorithmSteps,
    },
    workedExamples,
    pitfalls: [],
    memoryCue: section.formula ?? "Quebre a conta, resolva a parte mais simples e recombine.",
    tags: [...new Set((section.exemplos ?? []).flatMap((example) => example.tags ?? []))],
    pageLabel: pageLabel(section.paginas ?? []),
  };
  return {
    ...lesson,
    searchText: buildSearchIndex([
      lesson.title,
      lesson.summary,
      lesson.whenToUse,
      lesson.whyItWorks,
      lesson.algorithm.title,
      lesson.algorithm.steps.flatMap((step) => [step.action, step.detail, step.expression]),
      lesson.workedExamples.flatMap((example) => [
        example.question,
        example.answer,
        example.conclusion,
        example.steps.flatMap((step) => [step.expression, step.explanation]),
      ]),
      lesson.memoryCue,
      lesson.tags,
    ]),
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
  return numericAnswerFromContract(response);
}

function normalizeAnswerDisplay(response, answer) {
  return String(response.exibicao ?? answer).trim() || String(answer);
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

function buildSearchIndex(values) {
  return values
    .flat(Infinity)
    .filter((value) => value != null && value !== "")
    .map(String)
    .join(" ")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[×·]/g, "x")
    .replace(/[÷:]/g, "/")
    .replace(/\s+/g, " ");
}

function displayTheoryValue(value) {
  if (value == null) return "";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return value.map(displayTheoryValue).filter(Boolean).join(", ");
  return String(value.exibicao ?? value.display ?? value.valor ?? value.value ?? "");
}

function difficultyLabel(level) {
  if (level <= 2) return "Fundação";
  if (level <= 4) return "Essencial";
  if (level <= 6) return "Intermediário";
  if (level <= 8) return "Avançado";
  return "Maestria";
}

function pageLabel(pages = []) {
  const sorted = [...new Set(pages.map(Number).filter(Number.isFinite))].sort((left, right) => left - right);
  if (!sorted.length) return "";
  if (sorted.length === 1) return `p. ${sorted[0]}`;
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];
  for (const page of sorted.slice(1)) {
    if (page === end + 1) {
      end = page;
      continue;
    }
    ranges.push(start === end ? String(start) : `${start}–${end}`);
    start = page;
    end = page;
  }
  ranges.push(start === end ? String(start) : `${start}–${end}`);
  return `pp. ${ranges.join(", ")}`;
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
