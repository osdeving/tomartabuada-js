import assert from "node:assert/strict";
import test from "node:test";
import {
  answersMatch,
  displayAnswerInput,
  isCompleteAnswer,
  normalizeUserAnswer,
  numericAnswerFromContract,
  serializeUserAnswer,
} from "../answers.js";

function grade(raw, question) {
  const value = normalizeUserAnswer(raw, question);
  return value != null && answersMatch(value, question);
}

test("corrige números exatos e decimais com tolerância", () => {
  assert.equal(grade("1522756", { answerType: "exact-number", answer: 1_522_756 }), true);
  assert.equal(grade("0,4", { answerType: "decimal-tolerance", answer: 0.4, tolerance: 0.001 }), true);
  assert.equal(isCompleteAnswer("0.4", {
    answerType: "decimal-tolerance",
    answer: 0.4,
    answerInput: "0.40",
    acceptsDecimal: true,
    tolerance: 0.001,
  }), true);
});

test("usa o valor numérico do contrato sem confundir separador de milhar", () => {
  assert.equal(numericAnswerFromContract({ valor: 30_000, exibicao: "cerca de 30.000 anos" }), 30_000);
  assert.equal(numericAnswerFromContract({ valor: 18.3333333333, exibicao: "18 1/3 °C" }), 18.33333333);
});

test("corrige quociente e resto sem confundir os dois campos", () => {
  const question = {
    answerType: "quotient-remainder",
    answer: "35|3",
    answerInput: "35|3",
    answerSpec: { quotient: 35, remainder: 3 },
  };
  assert.equal(grade("35|3", question), true);
  assert.equal(grade("33|5", question), false);
  assert.equal(displayAnswerInput("35|3", question), "35 R 3");
});

test("aceita frações equivalentes", () => {
  const question = {
    answerType: "rational",
    answer: "6/35",
    answerInput: "6/35",
    answerSpec: { numerator: 6, denominator: 35 },
  };
  assert.equal(grade("12/70", question), true);
  assert.equal(grade("6/34", question), false);
  assert.equal(isCompleteAnswer("6/35", question), true, "frações corretas podem entrar automaticamente");
  assert.equal(normalizeUserAnswer("35|", { answerType: "quotient-remainder" }), null);
  assert.equal(normalizeUserAnswer("6/", question), null);
  assert.equal(serializeUserAnswer(normalizeUserAnswer("12/70", question)), "12/70");
});

test("só considera completa uma resposta que realmente confere", () => {
  const question = { answerType: "exact-number", answer: 41, answerInput: "41" };
  assert.equal(isCompleteAnswer("4", question), false);
  assert.equal(isCompleteAnswer("42", question), false);
  assert.equal(isCompleteAnswer("41", question), true);
});

test("respeita a forma pedida em equivalência e simplificação", () => {
  const exactForm = {
    answerType: "rational",
    answer: "4/12",
    answerSpec: { type: "rational", form: "exact", numerator: 4, denominator: 12 },
  };
  assert.equal(grade("4/12", exactForm), true);
  assert.equal(grade("1/3", exactForm), false);
});

test("corrige escolhas booleanas, enumerações e estimativas por faixa", () => {
  assert.equal(grade("true", { answerType: "boolean", answer: true }), true);
  assert.equal(grade("false", { answerType: "boolean", answer: false }), true);
  assert.equal(normalizeUserAnswer("", { answerType: "boolean", answer: false }), null);
  assert.equal(grade("sexta-feira", { answerType: "enum", answer: "Sexta-feira" }), true);
  const range = { answerType: "relative-range", answer: 2_584, answerSpec: { min: 2_506.48, max: 2_661.52 } };
  assert.equal(grade("2580", range), true);
  assert.equal(grade("2700", range), false);
});
