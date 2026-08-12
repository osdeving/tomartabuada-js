import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const CONTENT_FILES = [
  "../../../data/full-book-theory-00-03.json",
  "../../../data/full-book-theory-04-06.json",
  "../../../data/full-book-theory-07-09.json",
  "../../../data/theory-details-01-04.json",
  "../../../data/theory-details-05-08.json",
  "../../../data/theory-details-09-12.json",
  "../../../data/mental-math-theory.json",
  "../../../data/full-book-challenges-01-03.json",
  "../../../data/full-book-challenges-04-06.json",
  "../../../data/full-book-challenges-08-09.json",
  "../../../data/mental-math-challenges.json",
];

const NON_DISPLAY_BRANCHES = new Set([
  "contrato",
  "id",
  "origem",
  "originalTitle",
  "source",
  "sourceErratum",
  "tags",
  "tituloOriginal",
]);

const EDITORIAL_ATTRIBUTION = /\b(?:o livro|no livro|do livro|pelo livro|segundo o livro|de acordo com|com base (?:em|no|na)|o autor|pelo autor|do autor|o texto (?:apresenta|destaca|explica|mostra|observa|recomenda)|a exposição|o glossário|gabarito|(?:no|do|pelo) original|original inglês|página (?:impressa|ausente|\d)|PDF)\b/i;

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

function displayedStrings(value, path = []) {
  if (typeof value === "string") return [{ path: path.join("."), value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => displayedStrings(item, [...path, index]));
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, item]) => (
    NON_DISPLAY_BRANCHES.has(key) ? [] : displayedStrings(item, [...path, key])
  ));
}

test("o conteúdo exibido ensina diretamente, sem atribuições editoriais", () => {
  const violations = CONTENT_FILES.flatMap((file) => (
    displayedStrings(readJson(file))
      .filter(({ value }) => EDITORIAL_ATTRIBUTION.test(value))
      .map(({ path, value }) => `${file}:${path}: ${value}`)
  ));

  assert.deepEqual(violations, []);
});
