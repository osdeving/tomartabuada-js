import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const theory = readJson("../../../data/mental-math-theory.json");
const challengeFiles = [
  readJson("../../../data/full-book-challenges-01-03.json"),
  readJson("../../../data/full-book-challenges-04-06.json"),
  readJson("../../../data/full-book-challenges-08-09.json"),
];
const challenges = challengeFiles.flatMap((file) => file.challenges);
const topicIds = new Set(theory.capitulos.flatMap((chapter) => chapter.secoes.map((section) => section.id)));
const answerTypes = new Set([
  "exact-number",
  "decimal-tolerance",
  "quotient-remainder",
  "rational",
  "boolean",
  "enum",
  "relative-range",
  "open-multistep",
]);
const sectionIds = new Set(["tabuada", "adicao", "subtracao", "divisao", "quadrado", "tricks"]);

test("o banco cobre todos os exercícios formais disponíveis no livro", () => {
  const byChapter = Object.fromEntries(challengeFiles.flatMap((file) =>
    Object.entries(file.statistics.byChapter).map(([chapter, value]) => [chapter, Number(value?.total ?? value)]),
  ));
  assert.deepEqual(byChapter, { 1: 50, 2: 76, 3: 97, 4: 99, 5: 38, 6: 16, 8: 73, 9: 10 });
  assert.equal(challenges.length, 459);

  for (const file of challengeFiles) {
    assert.equal(file.schemaVersion, 1);
    assert.equal(file.source.id, "calculo-mental-use-esse");
    assert.equal(file.statistics.total, file.challenges.length);
    assert.equal(file.statistics.playable, file.challenges.filter((challenge) => challenge.playable).length);
  }
});

test("cada desafio tem contrato, vínculo adaptativo e rastreabilidade", () => {
  const ids = new Set();
  for (const challenge of challenges) {
    assert.ok(challenge.id?.startsWith("somm-"), `id inválido: ${challenge.id}`);
    assert.ok(!ids.has(challenge.id), `id duplicado: ${challenge.id}`);
    ids.add(challenge.id);
    assert.ok(challenge.prompt?.trim(), `enunciado ausente em ${challenge.id}`);
    assert.ok(answerTypes.has(challenge.answer?.type), `resposta inválida em ${challenge.id}`);
    assert.ok(sectionIds.has(challenge.sectionId), `grupo inválido em ${challenge.id}`);
    assert.ok(topicIds.has(challenge.theoryTopicId), `tópico inválido em ${challenge.id}`);
    for (const relatedId of challenge.relatedTheoryTopicIds ?? []) {
      assert.ok(topicIds.has(relatedId), `tópico relacionado inválido em ${challenge.id}`);
    }
    assert.ok(challenge.difficulty >= 1 && challenge.difficulty <= 10, `dificuldade inválida em ${challenge.id}`);
    assert.equal(challenge.source?.documentId, "calculo-mental-use-esse");
    assert.ok(Number.isInteger(challenge.source?.promptPrintedPage), `página impressa ausente em ${challenge.id}`);
    assert.ok(Number.isInteger(challenge.source?.answerPrintedPage), `página de resposta ausente em ${challenge.id}`);
    if (challenge.source.recoveredFromAnswerKey) {
      assert.equal(challenge.source.promptPdfPage, null);
      assert.equal(challenge.source.promptPrintedPage, 58);
    } else {
      assert.equal(challenge.source.promptPdfPage, challenge.source.promptPrintedPage + 26);
    }
    assert.equal(challenge.source.answerPdfPage, challenge.source.answerPrintedPage + 26);
  }
});

test("todo desafio jogável possui uma resposta autoavaliável", () => {
  const autoGradable = new Set([
    "exact-number",
    "decimal-tolerance",
    "quotient-remainder",
    "rational",
    "boolean",
    "enum",
    "relative-range",
  ]);

  for (const challenge of challenges) {
    if (!challenge.playable) continue;
    assert.ok(autoGradable.has(challenge.answer.type), `${challenge.id} não pode ser autoavaliado`);
    if (challenge.answer.type === "exact-number") {
      assert.ok(Number.isFinite(challenge.answer.value), `número inválido em ${challenge.id}`);
    }
  }
});

test("a página 58 ausente é recuperada somente pelo gabarito", () => {
  const recovered = challenges.filter((challenge) => challenge.source.recoveredFromAnswerKey);
  assert.equal(recovered.length, 3);
  assert.ok(recovered.every((challenge) => challenge.sourceChapterOrder === 3));
  assert.ok(recovered.every((challenge) => challenge.exerciseSetTitle.toLocaleLowerCase("pt-BR").includes("11")));
});
