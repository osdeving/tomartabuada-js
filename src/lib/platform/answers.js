export function normalizeUserAnswer(value, question) {
  if (question.answerType === "boolean") return String(value) === "true";
  if (question.answerType === "enum") return String(value);
  if (question.answerType === "quotient-remainder") {
    const [quotient, remainder] = String(value).split("|").map(Number);
    return Number.isFinite(quotient) && Number.isFinite(remainder) ? { quotient, remainder } : null;
  }
  if (question.answerType === "rational") {
    const [numerator, denominator] = String(value).split("/").map(Number);
    return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
      ? { numerator, denominator }
      : null;
  }
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized || normalized === ".") return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function numericAnswerFromContract(response) {
  const numeric = Number(response?.valor ?? response?.value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(8)) : null;
}

export function serializeUserAnswer(value) {
  if (value && typeof value === "object") {
    if (Number.isFinite(value.quotient) && Number.isFinite(value.remainder)) {
      return `${value.quotient}|${value.remainder}`;
    }
    if (Number.isFinite(value.numerator) && Number.isFinite(value.denominator)) {
      return `${value.numerator}/${value.denominator}`;
    }
  }
  return value ?? null;
}

export function answersMatch(given, question) {
  const spec = question.answerSpec ?? {};
  if (question.answerType === "boolean") return given === Boolean(question.answer);
  if (question.answerType === "enum") return normalizeChoice(given) === normalizeChoice(question.answer);
  if (question.answerType === "quotient-remainder") {
    return given.quotient === Number(spec.quotient) && given.remainder === Number(spec.remainder);
  }
  if (question.answerType === "rational") {
    if (spec.form === "exact") {
      return given.numerator === Number(spec.numerator) && given.denominator === Number(spec.denominator);
    }
    return given.numerator * Number(spec.denominator) === Number(spec.numerator) * given.denominator;
  }
  if (question.answerType === "relative-range") {
    return Number(given) >= Number(spec.min) && Number(given) <= Number(spec.max);
  }
  return Math.abs(Number(given) - Number(question.answer)) <= Math.max(0.000001, Number(question.tolerance) || 0);
}

export function isCompleteAnswer(value, question) {
  if (!value) return false;
  if (["boolean", "enum"].includes(question.answerType)) return true;
  if (["rational", "quotient-remainder"].includes(question.answerType)) return false;
  const expected = String(question.answerInput ?? question.answerDisplay ?? question.answer).replace(",", ".");
  if (question.acceptsDecimal || question.answerType === "relative-range") {
    const normalized = normalizeUserAnswer(value, question);
    return (normalized != null && answersMatch(normalized, question)) || value.length >= expected.length;
  }
  return value.length >= expected.length;
}

export function displayAnswerInput(value, question) {
  if (question.answerType === "quotient-remainder") return String(value).replace("|", " R ");
  if (question.answerType === "boolean" || question.answerType === "enum") {
    return question.choices?.find((choice) => String(choice.value) === String(value))?.label ?? String(value);
  }
  return String(value).replace(".", ",");
}

function normalizeChoice(value) {
  return String(value)
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
