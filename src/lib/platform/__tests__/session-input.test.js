import assert from "node:assert/strict";
import test from "node:test";
import { reduceAnswerInput } from "../sessionInput.js";

function type(keys, question) {
  let state = { value: "", displayValue: "", submission: null };
  const transitions = [];
  for (const key of keys) {
    state = reduceAnswerInput(state.value, key, question);
    transitions.push(state);
  }
  return { state, transitions };
}

test("prefixo ou resposta errada permanecem editáveis até Enter", () => {
  const question = { answerType: "exact-number", answer: 41, answerInput: "41" };
  const partial = type(["4"], question).state;
  assert.deepEqual(partial, { value: "4", displayValue: "4", submission: null });

  const wrong = type(["4", "2"], question).state;
  assert.equal(wrong.value, "42");
  assert.equal(wrong.submission, null);
  assert.equal(reduceAnswerInput(wrong.value, "submit", question).submission, "explicit");
});

test("resposta correta é capturada assim que aparece no visor", () => {
  const question = { answerType: "exact-number", answer: 41, answerInput: "41" };
  const { transitions } = type(["4", "1"], question);
  assert.equal(transitions[0].submission, null);
  assert.equal(transitions[1].submission, "correct");
  assert.equal(
    reduceAnswerInput("", "0", { answerType: "exact-number", answer: 0 }).submission,
    "correct",
  );
});

test("entrada não é truncada pelo tamanho da resposta-modelo", () => {
  const question = {
    answerType: "relative-range",
    answer: 9163,
    answerInput: "9163",
    answerSpec: { min: 8246.7, max: 10079.3 },
    acceptsDecimal: true,
  };
  const { state } = type(["1", "0", "0", "0", "0"], question);
  assert.equal(state.value, "10000");
  assert.equal(state.submission, "correct");
});

test("suporta vírgula visual, negativos e respostas estruturadas", () => {
  const decimal = {
    answerType: "decimal-tolerance",
    answer: -158.1,
    answerInput: "-158.1",
    acceptsDecimal: true,
    tolerance: 0.000001,
  };
  const decimalState = type(["sign", "1", "5", "8", ".", "1"], decimal).state;
  assert.equal(decimalState.displayValue, "-158,1");
  assert.equal(decimalState.submission, "correct");

  const quotient = {
    answerType: "quotient-remainder",
    answer: "35|3",
    answerSpec: { quotient: 35, remainder: 3 },
  };
  const structured = type(["3", "5", "separator"], quotient).state;
  assert.equal(structured.value, "35|");
  assert.equal(structured.submission, null);
  assert.equal(reduceAnswerInput(structured.value, "3", quotient).submission, "correct");
});

test("Enter confirma explicitamente até uma resposta vazia", () => {
  const question = { answerType: "exact-number", answer: 1 };
  assert.equal(reduceAnswerInput("", "submit", question).submission, "explicit");
  assert.equal(reduceAnswerInput("-", "submit", question).submission, "explicit");
});
