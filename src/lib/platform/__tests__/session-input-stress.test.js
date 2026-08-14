import assert from "node:assert/strict";
import test from "node:test";
import {
  answersMatch,
  normalizeUserAnswer,
} from "../answers.js";
import { reduceAnswerInput } from "../sessionInput.js";

const CASES_PER_FAMILY = 320;

test("estressa o motor puro de resposta com entradas determinísticas", () => {
  const random = createSeededRandom(0x5eedc0de);
  const cases = [
    ...buildExactCases(random, CASES_PER_FAMILY, false),
    ...buildExactCases(random, CASES_PER_FAMILY, true),
    ...buildDecimalCases(random, CASES_PER_FAMILY),
    ...buildRangeCases(random, CASES_PER_FAMILY),
    ...buildRationalCases(random, CASES_PER_FAMILY),
    ...buildQuotientRemainderCases(random, CASES_PER_FAMILY),
  ];

  for (const item of cases) {
    assertInputCase(item);
  }

  assert.equal(cases.length, CASES_PER_FAMILY * 6);
});

test("normalização rejeita valores numéricos não finitos", () => {
  const question = { answerType: "exact-number", answer: 1 };

  for (const raw of ["NaN", "Infinity", "-Infinity", "1e309", "-1e309"]) {
    assert.equal(normalizeUserAnswer(raw, question), null, raw);
  }
});

function assertInputCase({ canonical, label, question, wrong }) {
  const canonicalRun = typeInput(canonical, question, label);
  const finalCanonical = canonicalRun.at(-1);

  assert.ok(finalCanonical, `${label}: a entrada canônica deve produzir transições`);
  assert.equal(finalCanonical.value, canonical, `${label}: valor canônico preservado`);
  assert.equal(finalCanonical.submission, "correct", `${label}: canônica submete acerto`);
  assert.equal(matches(finalCanonical.value, question, label), true, `${label}: canônica confere`);

  for (const transition of canonicalRun.slice(0, -1)) {
    assert.equal(transition.submission, null, `${label}: prefixo não submete`);
    assert.equal(matches(transition.value, question, label), false, `${label}: prefixo não confere`);
  }

  const wrongRun = typeInput(wrong, question, `${label}:errada`);
  const finalWrong = wrongRun.at(-1);

  assert.ok(finalWrong, `${label}: a entrada errada deve produzir transições`);
  assert.equal(finalWrong.value, wrong, `${label}: valor errado preservado`);
  assert.equal(matches(finalWrong.value, question, label), false, `${label}: errada não confere`);
  for (const transition of wrongRun) {
    assert.equal(transition.submission, null, `${label}: errada nunca submete sozinha`);
    assert.equal(matches(transition.value, question, label), false, `${label}: errada permanece incorreta`);
  }

  const submitted = reduceAnswerInput(finalWrong.value, "submit", question);
  assert.equal(submitted.submission, "explicit", `${label}: Enter submete explicitamente`);
  assert.equal(matches(submitted.value, question, label), false, `${label}: Enter registra erro`);
}

function typeInput(raw, question, label) {
  let value = "";
  const transitions = [];

  for (const key of inputKeys(raw)) {
    const transition = reduceAnswerInput(value, key, question);
    assertFiniteNormalized(transition.value, question, label);
    transitions.push(transition);
    value = transition.value;
  }

  return transitions;
}

function matches(raw, question, label) {
  const normalized = normalizeUserAnswer(raw, question);
  assertFiniteValue(normalized, label);
  return normalized != null && answersMatch(normalized, question);
}

function assertFiniteNormalized(raw, question, label) {
  assertFiniteValue(normalizeUserAnswer(raw, question), label);
}

function assertFiniteValue(value, label) {
  if (value == null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    assert.equal(Number.isFinite(value), true, `${label}: número deve ser finito`);
    return;
  }

  for (const numeric of Object.values(value)) {
    assert.equal(Number.isFinite(numeric), true, `${label}: campo estruturado deve ser finito`);
  }
}

function inputKeys(raw) {
  return [...String(raw)].map((character) => {
    if (character === "-") return "sign";
    if (character === "." || character === ",") return ".";
    if (character === "/" || character === "|") return "separator";
    return character;
  });
}

function buildExactCases(random, count, negative) {
  return Array.from({ length: count }, (_, index) => {
    const magnitude = randomInteger(random, 1_000, 999_999_999);
    const answer = negative ? -magnitude : magnitude;
    const canonical = String(answer);
    return {
      label: `exata-${negative ? "negativa" : "positiva"}-${index}`,
      canonical,
      wrong: changeLeadingDigit(canonical),
      question: {
        answerType: "exact-number",
        answer,
        answerInput: canonical,
        acceptsDecimal: false,
      },
    };
  });
}

function buildDecimalCases(random, count) {
  return Array.from({ length: count }, (_, index) => {
    const negative = index % 2 === 1;
    const whole = randomInteger(random, 1_000, 999_999);
    const hundredths = randomInteger(random, 1, 9) * 10 + randomInteger(random, 1, 9);
    const canonical = `${negative ? "-" : ""}${whole}.${hundredths}`;
    return {
      label: `decimal-${index}`,
      canonical,
      wrong: changeLeadingDigit(canonical),
      question: {
        answerType: "decimal-tolerance",
        answer: Number(canonical),
        answerInput: canonical,
        acceptsDecimal: true,
        tolerance: 0.000001,
      },
    };
  });
}

function buildRangeCases(random, count) {
  return Array.from({ length: count }, (_, index) => {
    const decimal = index % 2 === 1;
    const whole = randomInteger(random, 100_000, 899_999);
    const hundredths = randomInteger(random, 1, 9) * 10 + randomInteger(random, 1, 9);
    const canonical = decimal ? `${whole}.${hundredths}` : String(whole);
    const target = Number(canonical);
    const radius = decimal ? 0.001 : randomInteger(random, 2, 50);
    return {
      label: `faixa-${index}`,
      canonical,
      wrong: changeLeadingDigit(canonical),
      question: {
        answerType: "relative-range",
        answer: target,
        answerInput: canonical,
        answerSpec: { min: target - radius, max: target + radius },
        acceptsDecimal: true,
      },
    };
  });
}

function buildRationalCases(random, count) {
  return Array.from({ length: count }, (_, index) => {
    const negative = index % 3 === 1;
    const exactForm = index % 2 === 0;
    const numerator = exactForm ? randomInteger(random, 2, 19) : 1;
    const signedNumerator = negative ? -numerator : numerator;
    const denominator = randomInteger(random, 20, 999);
    const canonical = `${signedNumerator}/${denominator}`;
    const wrongNumerator = signedNumerator < 0 ? signedNumerator - 1 : signedNumerator + 1;
    return {
      label: `fracao-${exactForm ? "exata" : "equivalente"}-${index}`,
      canonical,
      wrong: `${wrongNumerator}/${denominator}`,
      question: {
        answerType: "rational",
        answer: canonical,
        answerInput: canonical,
        answerSpec: {
          numerator: signedNumerator,
          denominator,
          ...(exactForm ? { form: "exact" } : {}),
        },
      },
    };
  });
}

function buildQuotientRemainderCases(random, count) {
  return Array.from({ length: count }, (_, index) => {
    const quotient = randomInteger(random, 1_000, 999_999);
    const remainder = randomInteger(random, 0, 999);
    const canonical = `${quotient}|${remainder}`;
    return {
      label: `quociente-resto-${index}`,
      canonical,
      wrong: `${Number(changeLeadingDigit(String(quotient)))}|${remainder}`,
      question: {
        answerType: "quotient-remainder",
        answer: canonical,
        answerInput: canonical,
        answerSpec: { quotient, remainder },
      },
    };
  });
}

function changeLeadingDigit(value) {
  const characters = [...String(value)];
  const index = characters[0] === "-" ? 1 : 0;
  characters[index] = characters[index] === "9"
    ? "8"
    : String(Number(characters[index]) + 1);
  return characters.join("");
}

function randomInteger(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
