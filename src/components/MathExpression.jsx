import katex from "katex";

function renderMath(expression, displayMode = false) {
  if (!expression) {
    return "";
  }

  try {
    return katex.renderToString(expression, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
    });
  } catch {
    return expression;
  }
}

export function MathExpression({
  expression,
  displayMode = false,
  className = "",
}) {
  if (!expression) {
    return null;
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderMath(expression, displayMode) }}
    />
  );
}
