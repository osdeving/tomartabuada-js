import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const canonicalTheory = readJson("../../../data/mental-math-theory.json");
const fullBookFiles = [
  readJson("../../../data/full-book-theory-00-03.json"),
  readJson("../../../data/full-book-theory-04-06.json"),
  readJson("../../../data/full-book-theory-07-09.json"),
];
const chapters = fullBookFiles.flatMap((file) => file.chapters);
const lessons = chapters.flatMap((chapter) => chapter.lessons);
const examples = lessons.flatMap((lesson) => lesson.workedExamples);
const visuals = examples.map((example) => example.visualizacao).filter(Boolean);
const canonicalTopicIds = new Set(
  canonicalTheory.capitulos.flatMap((chapter) => chapter.secoes.map((section) => section.id)),
);

test("o livro completo forma uma trilha contínua de 10 capítulos", () => {
  assert.deepEqual(chapters.map((chapter) => chapter.order), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(new Set(chapters.map((chapter) => chapter.id)).size, 10);

  for (const file of fullBookFiles) {
    assert.equal(file.schemaVersion, 1);
    assert.equal(file.source.id, "calculo-mental-use-esse");
    assert.match(file.source.paginationNote, /PDF 83/);
    assert.match(file.source.paginationNote, /58/);
  }

  for (const chapter of chapters) {
    assert.ok(chapter.title?.trim(), `título ausente em ${chapter.id}`);
    assert.ok(chapter.summary?.trim(), `resumo ausente em ${chapter.id}`);
    assert.ok(chapter.lessons?.length, `aulas ausentes em ${chapter.id}`);
    assert.ok(Array.isArray(chapter.printedPages) && chapter.printedPages.length, `páginas ausentes em ${chapter.id}`);
    assert.ok(Array.isArray(chapter.pdfPages) && chapter.pdfPages.length, `páginas PDF ausentes em ${chapter.id}`);
  }
});

test("cada aula é acionável, rastreável e ligada ao currículo adaptativo", () => {
  const lessonIds = new Set();
  const exampleIds = new Set();

  for (const chapter of chapters) {
    chapter.lessons.forEach((lesson, lessonIndex) => {
      assert.equal(lesson.order, lessonIndex + 1, `ordem inválida em ${lesson.id}`);
      assert.ok(lesson.id && !lessonIds.has(lesson.id), `id de aula duplicado: ${lesson.id}`);
      lessonIds.add(lesson.id);
      assert.ok(lesson.title?.trim(), `título ausente em ${lesson.id}`);
      assert.ok(lesson.summary?.trim(), `resumo ausente em ${lesson.id}`);
      assert.ok(lesson.whyItWorks?.trim(), `explicação ausente em ${lesson.id}`);
      assert.ok(lesson.whenToUse?.length, `contexto de uso ausente em ${lesson.id}`);
      assert.ok(lesson.algorithm?.steps?.length >= 2, `algoritmo curto em ${lesson.id}`);
      assert.ok(lesson.pitfalls?.length, `armadilhas ausentes em ${lesson.id}`);
      assert.ok(lesson.memoryCue?.trim(), `lembrete ausente em ${lesson.id}`);
      assert.equal(lesson.source?.documentId, "calculo-mental-use-esse", `fonte inválida em ${lesson.id}`);
      assert.ok(lesson.source.printedPages?.length, `página impressa ausente em ${lesson.id}`);
      assert.ok(lesson.source.pdfPages?.length, `página PDF ausente em ${lesson.id}`);
      assert.ok(lesson.theoryTopicIds?.length, `tópico adaptativo ausente em ${lesson.id}`);

      for (const topicId of lesson.theoryTopicIds) {
        assert.ok(canonicalTopicIds.has(topicId), `tópico desconhecido ${topicId} em ${lesson.id}`);
      }
      lesson.algorithm.steps.forEach((step, stepIndex) => {
        assert.equal(step.order, stepIndex + 1, `ordem de algoritmo inválida em ${lesson.id}`);
        assert.ok(step.action?.trim(), `ação ausente em ${lesson.id}`);
        assert.ok(step.detail?.trim(), `detalhe ausente em ${lesson.id}`);
      });

      for (const example of lesson.workedExamples) {
        assert.ok(example.id && !exampleIds.has(example.id), `id de exemplo duplicado: ${example.id}`);
        exampleIds.add(example.id);
        assert.ok(example.question?.trim(), `enunciado ausente em ${example.id}`);
        assert.notEqual(example.answer, undefined, `resposta ausente em ${example.id}`);
        assert.ok(example.steps?.length, `resolução ausente em ${example.id}`);
        assert.ok(Number.isInteger(example.source?.printedPage), `página impressa ausente em ${example.id}`);
        assert.ok(Number.isInteger(example.source?.pdfPage), `página PDF ausente em ${example.id}`);
        assert.notEqual(example.source.printedPage, 58, `o exemplo ${example.id} cita a página ausente 58`);
      }
    });
  }

  assert.ok(lessons.length >= 85, `apenas ${lessons.length} aulas no livro completo`);
  assert.ok(examples.length >= 190, `apenas ${examples.length} exemplos resolvidos`);
});

test("as contas armadas usam visualizações semânticas suportadas", () => {
  const supportedTypes = new Set([
    "conta-armada",
    "cadeia",
    "divisao-longa",
    "criss-cross",
    "raiz-armada",
    "quadrado-balanceado",
  ]);

  assert.ok(visuals.length >= 100, `apenas ${visuals.length} exemplos têm visualização`);
  for (const visual of visuals) {
    assert.ok(supportedTypes.has(visual.tipo), `visualização desconhecida: ${visual.tipo}`);
    assert.ok(visual.rotulo?.trim(), `visualização ${visual.tipo} sem rótulo`);
    assert.ok(visual.leitura?.trim(), `visualização ${visual.rotulo} sem leitura acessível`);
    assert.ok(visual.passos?.length, `visualização ${visual.rotulo} sem navegação por passos`);

    if (visual.tipo === "conta-armada") {
      assert.ok(visual.linhas?.length >= 2 || (visual.parcelas?.length >= 2 && visual.resposta != null));
    }
    if (visual.tipo === "cadeia") assert.ok((visual.etapas ?? visual.passos)?.length >= 2);
    if (visual.tipo === "divisao-longa") {
      assert.ok(visual.divisor != null && visual.dividendo != null && visual.quociente != null);
      assert.ok((visual.etapas ?? visual.passos)?.length);
    }
    if (visual.tipo === "criss-cross") {
      assert.ok(visual.superior != null && visual.inferior != null && visual.resultado != null);
      assert.ok((visual.etapas ?? visual.passos)?.length);
    }
    if (visual.tipo === "raiz-armada") {
      assert.ok(visual.radicando != null && visual.raiz != null);
      assert.ok((visual.tentativas ?? visual.passos)?.length);
    }
    if (visual.tipo === "quadrado-balanceado") {
      assert.ok(visual.numero != null && visual.fatorMenor != null && visual.fatorMaior != null);
      assert.ok(visual.resultado != null);
    }
  }
});

test("a integração pública carrega a biblioteca sob demanda e preserva o índice canônico", () => {
  const contentSource = readFileSync(new URL("../content.js", import.meta.url), "utf8");
  const topicIds = canonicalTheory.capitulos.flatMap((chapter) => chapter.secoes.map((section) => section.id));

  assert.equal(topicIds.length, 45);
  assert.equal(new Set(topicIds).size, 45);
  assert.match(contentSource, /export function loadTheoryChapters/);
  for (const suffix of ["00-03", "04-06", "07-09"]) {
    assert.match(contentSource, new RegExp(`import\\(\"\\.\\.\\/\\.\\.\\/data\\/full-book-theory-${suffix}\\.json\"\\)`));
  }
  assert.match(contentSource, /sourceKind: "guidebook"/);
  assert.match(contentSource, /sourceKind: "full-book"/);
});
