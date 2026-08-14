import {
  displayAnswerInput,
  isCorrectAnswerInput,
} from "./answers.js";

export const MAX_ANSWER_INPUT_LENGTH = 64;

export function reduceAnswerInput(currentValue, key, question) {
  const current = String(currentValue ?? "");

  if (key === "clear") return inputResult("", question);
  if (key === "backspace") return inputResult(current.slice(0, -1), question);
  if (key === "submit") {
    return inputResult(current, question, "explicit");
  }
  if (key.startsWith("choice:")) {
    const selected = key.slice("choice:".length);
    return inputResult(selected, question, "explicit");
  }
  if (key === "sign") {
    const next = current.startsWith("-") ? current.slice(1) : `-${current}`;
    return autoSubmitResult(next, question);
  }
  if (key === "separator") {
    const separator = question.answerType === "rational" ? "/" : "|";
    if (!current || current === "-" || current.includes(separator)) {
      return inputResult(current, question);
    }
    return autoSubmitResult(`${current}${separator}`, question);
  }
  if (key === ".") {
    if (!question.acceptsDecimal || current.includes(".")) {
      return inputResult(current, question);
    }
    return autoSubmitResult(`${current}.`, question);
  }
  if (!/^\d$/.test(key)) return inputResult(current, question);

  const next = `${current}${key}`.slice(0, MAX_ANSWER_INPUT_LENGTH);
  return autoSubmitResult(next, question);
}

function autoSubmitResult(value, question) {
  return inputResult(value, question, isCorrectAnswerInput(value, question) ? "correct" : null);
}

function inputResult(value, question, submission = null) {
  return {
    value,
    displayValue: value ? displayAnswerInput(value, question) : "",
    submission,
  };
}
