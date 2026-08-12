import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const baseTheory = readJson("../../../data/mental-math-theory.json");
const detailFiles = [
  readJson("../../../data/theory-details-01-04.json"),
  readJson("../../../data/theory-details-05-08.json"),
  readJson("../../../data/theory-details-09-12.json"),
];
const topicLessonLinks = readJson("../../../data/theory-topic-lessons.json");
const detailedChapters = detailFiles.flatMap((file) => file.capitulos);
const detailedTips = detailedChapters.flatMap((chapter) => chapter.dicas);

test("a teoria detalhada cobre os 12 capítulos e amplia o material-base", () => {
  const baseIds = baseTheory.capitulos.map((chapter) => chapter.id);
  const detailedIds = detailedChapters.map((chapter) => chapter.capituloId);
  const baseSectionCount = baseTheory.capitulos.flatMap((chapter) => chapter.secoes).length;

  assert.deepEqual(detailedIds, baseIds);
  assert.equal(new Set(detailedIds).size, 12);
  assert.ok(detailedTips.length > baseSectionCount, `${detailedTips.length} dicas deveriam superar ${baseSectionCount} resumos`);

  for (const chapter of detailedChapters) {
    const baseChapter = baseTheory.capitulos.find((item) => item.id === chapter.capituloId);
    assert.ok(baseChapter, `capítulo-base ausente para ${chapter.capituloId}`);
    assert.ok(chapter.dicas.length >= baseChapter.secoes.length, `${chapter.capituloId} perdeu técnicas na expansão`);
  }
});

test("o módulo público importa os três arquivos detalhados", () => {
  const contentSource = readFileSync(new URL("../content.js", import.meta.url), "utf8");
  for (const suffix of ["01-04", "05-08", "09-12"]) {
    assert.match(contentSource, new RegExp(`theory-details-${suffix}\\.json`));
  }
  assert.match(contentSource, /theory-topic-lessons\.json/);
  assert.match(contentSource, /normalizeTheoryChapter\(chapter, detailedTheoryByChapter\.get\(chapter\.id\)\)/);
});

test("cada recomendação teórica abre uma dica explícita do mesmo capítulo", () => {
  const topics = baseTheory.capitulos.flatMap((chapter) =>
    chapter.secoes.map((topic) => ({ chapterId: chapter.id, topicId: topic.id })),
  );
  const mappings = topicLessonLinks.mapeamentos;

  assert.equal(Object.keys(mappings).length, topics.length);
  assert.deepEqual(Object.keys(mappings).sort(), topics.map((topic) => topic.topicId).sort());

  for (const topic of topics) {
    const chapter = detailedChapters.find((item) => item.capituloId === topic.chapterId);
    const lessonId = mappings[topic.topicId];
    assert.ok(chapter.dicas.some((tip) => tip.id === lessonId), `${topic.topicId} aponta para uma dica fora do capítulo: ${lessonId}`);
  }

  assert.equal(mappings["c01-esquerda-direita"], "c01-d02-esquerda-para-direita");
  assert.equal(mappings["c04-divisao-dois-digitos"], "c04-d04-divisao-dois-digitos");
  assert.equal(mappings["c07-fatoracao"], "c07-detalhe-fatoracao");
  assert.equal(mappings["c07-numeros-proximos"], "c07-detalhe-numeros-proximos");
});

test("cada dica oferece contexto, algoritmo acionável e rastreabilidade", () => {
  const ids = new Set();
  const exampleIds = new Set();

  for (const chapter of detailedChapters) {
    chapter.dicas.forEach((tip, tipIndex) => {
      assert.equal(tip.ordem, tipIndex + 1, `ordem inválida em ${tip.id}`);
      assert.ok(tip.id && !ids.has(tip.id), `id duplicado ou vazio: ${tip.id}`);
      ids.add(tip.id);
      assert.ok(tip.titulo?.trim(), `título ausente em ${tip.id}`);
      assert.ok(tip.resumo?.trim(), `resumo ausente em ${tip.id}`);
      assert.ok(tip.porQueFunciona?.trim(), `intuição ausente em ${tip.id}`);
      assert.ok(Array.isArray(tip.quandoUsar) && tip.quandoUsar.length, `uso ausente em ${tip.id}`);
      assert.ok(Array.isArray(tip.armadilhas) && tip.armadilhas.length, `armadilhas ausentes em ${tip.id}`);
      assert.ok(tip.lembrete?.trim(), `lembrete ausente em ${tip.id}`);
      assert.equal(tip.origem?.documentoId, "calculo-mental-dicas", `fonte inválida em ${tip.id}`);
      assert.ok(Array.isArray(tip.origem?.paginas) && tip.origem.paginas.length, `páginas ausentes em ${tip.id}`);
      assert.deepEqual(tip.paginas, tip.origem.paginas, `fontes divergentes em ${tip.id}`);
      assert.ok(tip.algoritmo?.titulo?.trim(), `título do algoritmo ausente em ${tip.id}`);
      assert.ok(tip.algoritmo?.passos?.length >= 2, `algoritmo curto demais em ${tip.id}`);

      tip.algoritmo.passos.forEach((step, stepIndex) => {
        assert.equal(step.ordem, stepIndex + 1, `ordem de passo inválida em ${tip.id}`);
        assert.ok(step.acao?.trim(), `ação ausente no passo de ${tip.id}`);
        assert.ok(step.detalhe?.trim(), `detalhe ausente no passo de ${tip.id}`);
      });
      for (const example of tip.exemplosResolvidos) {
        assert.ok(!exampleIds.has(example.id), `id de exemplo duplicado: ${example.id}`);
        exampleIds.add(example.id);
      }
    });
  }
});

test("os exemplos comentados mostram o caminho da resposta", () => {
  const workedExamples = detailedTips.flatMap((tip) => tip.exemplosResolvidos);
  const tipsWithExamples = detailedTips.filter((tip) => tip.exemplosResolvidos.length);

  assert.ok(workedExamples.length >= detailedTips.length, "deve haver ao menos um exemplo resolvido por dica, em média");
  assert.ok(tipsWithExamples.length / detailedTips.length >= 0.7, "poucas dicas possuem exemplos resolvidos");

  for (const example of workedExamples) {
    assert.ok(example.id?.trim(), "exemplo sem id");
    assert.ok(example.enunciado?.trim(), `enunciado ausente em ${example.id}`);
    assert.notEqual(example.resposta, undefined, `resposta ausente em ${example.id}`);
    assert.ok(example.etapas?.length, `etapas ausentes em ${example.id}`);
    assert.ok(Number.isFinite(example.origem?.pagina), `página ausente em ${example.id}`);
    for (const step of example.etapas) {
      assert.ok(step.explicacao?.trim(), `explicação ausente em ${example.id}`);
    }
  }
});
