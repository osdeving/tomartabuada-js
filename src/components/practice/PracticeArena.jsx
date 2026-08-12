import { MathExpression } from "../MathExpression";

function ProblemTerms({ display, fallbackExpression }) {
  if (!display) {
    return (
      <MathExpression
        expression={fallbackExpression}
        displayMode
        className="question-math"
      />
    );
  }

  if (display.kind === "binary") {
    return (
      <div className="problem-terms">
        <div className="problem-term">
          <MathExpression
            expression={display.leftLatex}
            displayMode
            className="problem-term__math"
          />
        </div>
        <div className="problem-operator" aria-hidden="true">
          <MathExpression expression={display.operatorLatex} className="problem-operator__math" />
        </div>
        <div className="problem-term">
          <MathExpression
            expression={display.rightLatex}
            displayMode
            className="problem-term__math"
          />
        </div>
      </div>
    );
  }

  return (
    <MathExpression
      expression={fallbackExpression}
      displayMode
      className="question-math"
    />
  );
}

function PracticeDisplay({ activePreset, answer, cueNonce, cueTone, question }) {
  return (
    <div
      key={`${question?.id ?? "empty"}-${cueNonce}`}
      className={`question-card${cueTone === "danger" ? " is-shaking" : ""}`}
    >
      <div className="question-card__topline">
        <span className="support-chip">{activePreset?.label}</span>
        <span className="support-chip support-chip--soft">{activePreset?.tip}</span>
      </div>

      <p className="question-label">Conta da vez</p>
      <ProblemTerms display={question?.display} fallbackExpression={question?.promptLatex} />

      <div className="answer-display">
        {answer ? (
          <MathExpression expression={answer} displayMode className="answer-math" />
        ) : (
          <span className="answer-placeholder">...</span>
        )}
      </div>
    </div>
  );
}

function PracticeKeypad({
  isResolved,
  keypadRows,
  onKeypadPress,
  onSubmit,
}) {
  return (
    <form className="keypad-panel" onSubmit={onSubmit}>
      <div className="keypad-grid">
        {keypadRows.flat().map((key) => (
          <button
            key={key}
            className={`keypad-key${
              key === "clear" || key === "backspace"
                ? " keypad-key--secondary"
                : ""
            }`}
            type="button"
            disabled={isResolved}
            onClick={() => onKeypadPress(key)}
          >
            {key === "clear" ? "limpar" : key === "backspace" ? "apagar" : key}
          </button>
        ))}
      </div>

      <button className="primary-button keypad-submit" type="submit">
        {isResolved ? "Próxima conta" : "Conferir"}
      </button>
    </form>
  );
}

function PracticeActions({
  onNextQuestion,
  onRevealAnswer,
  onToggleHint,
  showHint,
}) {
  return (
    <div className="action-row action-row--compact">
      <button className="ghost-button" type="button" onClick={onToggleHint}>
        {showHint ? "Esconder dica" : "Mostrar dica"}
      </button>
      <button className="ghost-button" type="button" onClick={onRevealAnswer}>
        Revelar
      </button>
      <button className="ghost-button" type="button" onClick={onNextQuestion}>
        Trocar conta
      </button>
    </div>
  );
}

function PracticeFeedback({ feedback, isWarning, question, showHint }) {
  return (
    <>
      {showHint && feedback?.kind !== "resolved" ? (
        <div className="hint-card">
          <strong>Dica</strong>
          <p>{question?.hint}</p>
        </div>
      ) : null}

      {feedback ? (
        <div className={`feedback-card feedback-card--${feedback.tone}`}>
          <strong>{feedback.title}</strong>
          {feedback.math ? (
            <MathExpression
              expression={feedback.math}
              displayMode
              className="feedback-math"
            />
          ) : null}
          <p>{feedback.detail}</p>
          {isWarning ? <span className="feedback-meta">use o teclado abaixo</span> : null}
        </div>
      ) : null}
    </>
  );
}

export function PracticeArena({
  activePreset,
  answer,
  cueNonce,
  cueTone,
  feedback,
  isResolved,
  isWarning,
  keypadRows,
  metrics,
  question,
  showHint,
  onKeypadPress,
  onNextQuestion,
  onRevealAnswer,
  onSubmit,
  onToggleHint,
}) {
  return (
    <section className="panel arena-panel">
      <div className="arena-layout">
        <PracticeDisplay
          activePreset={activePreset}
          answer={answer}
          cueNonce={cueNonce}
          cueTone={cueTone}
          question={question}
        />

        <PracticeKeypad
          isResolved={isResolved}
          keypadRows={keypadRows}
          onKeypadPress={onKeypadPress}
          onSubmit={onSubmit}
        />

        <PracticeActions
          onNextQuestion={onNextQuestion}
          onRevealAnswer={onRevealAnswer}
          onToggleHint={onToggleHint}
          showHint={showHint}
        />

        <PracticeFeedback
          feedback={feedback}
          isWarning={isWarning}
          question={question}
          showHint={showHint}
        />

        {metrics}
      </div>
    </section>
  );
}
