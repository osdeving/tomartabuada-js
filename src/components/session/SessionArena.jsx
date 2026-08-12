import { useEffect, useRef } from "react";
import { MathExpression } from "../MathExpression";

const INTEGER_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"];
const DECIMAL_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"];
const STRUCTURED_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "separator", "0", "backspace"];

export function SessionArena({
  answer,
  feedback,
  nudge,
  onAnswerKey,
  onExit,
  onPause,
  onResume,
  paused,
  remainingMs,
  remainingRatio,
  session,
}) {
  const arenaRef = useRef(null);
  const pauseDialogRef = useRef(null);
  const resumeButtonRef = useRef(null);
  const question = session.question;

  useEffect(() => {
    if (paused) resumeButtonRef.current?.focus({ preventScroll: true });
    else arenaRef.current?.focus({ preventScroll: true });
  }, [question?.id, paused]);

  function trapPauseFocus(event) {
    if (event.key !== "Tab") return;
    const controls = [...(pauseDialogRef.current?.querySelectorAll("button:not(:disabled)") ?? [])];
    if (!controls.length) return;
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <main
      ref={arenaRef}
      className={`session-arena${feedback ? ` has-feedback is-${feedback.tone}` : ""}`}
      role="application"
      aria-label="Sessão de cálculo mental"
      tabIndex={-1}
    >
      <header className="session-topbar">
        <button className="session-icon-button" type="button" onClick={onExit} aria-label="Sair da sessão">×</button>
        <div className="session-mode-label">
          <span>{session.modeLabel}</span>
          <strong>{session.groupLabel}</strong>
        </div>
        <button className="session-icon-button" type="button" onClick={onPause} aria-label="Pausar sessão">Ⅱ</button>
      </header>

      <div className="session-progress" aria-label={`${Math.ceil(remainingMs / 1000)} segundos restantes`}>
        <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, remainingRatio))})` }} />
      </div>

      <section className="session-hud" aria-label="Placar da sessão">
        <HudItem label="Questão" value={session.targetCount ? `${session.answered + 1}/${session.targetCount}` : session.answered + 1} />
        {session.modeId === "sobrevivencia" ? (
          <HudItem label="Vidas" value={<span className="lives">{"♥".repeat(session.lives)}{"♡".repeat(Math.max(0, 3 - session.lives))}</span>} />
        ) : (
          <HudItem label="Acertos" value={session.correct} />
        )}
        <HudItem label="Combo" value={`×${session.combo}`} highlight={session.combo >= 3} />
        <HudItem label="Pontos" value={session.score.toLocaleString("pt-BR")} />
      </section>

      <section className="session-stage">
        <div className="question-source-row">
          <span className="difficulty-chip">Nível {session.difficultyLabel}</span>
          {question?.source === "book" ? (
            <span className="book-chip">
              {question.sourceChapterOrder != null || question.chapter != null
                ? `Capítulo ${question.sourceChapterOrder ?? question.chapter}`
                : "Prática guiada"}
            </span>
          ) : null}
          <span className="timer-label">{Math.max(0, remainingMs / 1000).toFixed(1)}s</span>
        </div>

        <div className="session-question" key={question?.id} aria-live="polite" aria-atomic="true">
          <p>Resolva mentalmente</p>
          {question?.promptLatex ? (
            <MathExpression expression={question.promptLatex} displayMode className="session-question__math" />
          ) : (
            <strong className="session-question__text">{question?.prompt}</strong>
          )}
        </div>

        <div className={`session-answer${answer ? " has-value" : ""}`} aria-label={answer ? `Resposta ${answer}` : "Aguardando resposta"}>
          <span>{answer || "_"}</span>
          <i />
        </div>

        <div className="session-feedback-slot" aria-live="polite" aria-atomic="true">
          {feedback ? (
            <div className={`session-feedback session-feedback--${feedback.tone}`}>
              <strong>{feedback.title}</strong>
              <span>{feedback.detail}</span>
            </div>
          ) : nudge ? (
            <div className={`session-nudge session-nudge--${nudge.kind}`}>
              <span aria-hidden="true">{nudge.kind === "rest" ? "☁" : "◫"}</span>
              <p><strong>{nudge.title}</strong>{nudge.detail}</p>
            </div>
          ) : (
            <p className="typing-hint"><kbd>0–9</kbd> Digite e continue. A resposta entra sozinha.</p>
          )}
        </div>
      </section>

      {question?.choices?.length ? (
        <SessionChoices choices={question.choices} disabled={Boolean(feedback) || paused} onAnswerKey={onAnswerKey} />
      ) : (
        <SessionKeypad
          acceptsDecimal={Boolean(question?.acceptsDecimal)}
          answerType={question?.answerType}
          disabled={Boolean(feedback) || paused}
          onAnswerKey={onAnswerKey}
        />
      )}

      {paused ? (
        <div
          ref={pauseDialogRef}
          className="pause-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
          onKeyDown={trapPauseFocus}
        >
          <div className="pause-card">
            <span className="pause-card__icon" aria-hidden="true">Ⅱ</span>
            <p className="eyebrow">Respire</p>
            <h2 id="pause-title">Sessão pausada</h2>
            <p>Seu tempo está congelado. Volte quando estiver pronto para manter o foco.</p>
            <button ref={resumeButtonRef} className="button button--primary button--large" type="button" onClick={onResume}>Continuar</button>
            <button className="button button--quiet" type="button" onClick={onExit}>Encerrar e salvar</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SessionKeypad({ acceptsDecimal, answerType, disabled, onAnswerKey }) {
  const keys = ["rational", "quotient-remainder"].includes(answerType)
    ? STRUCTURED_KEYS
    : acceptsDecimal ? DECIMAL_KEYS : INTEGER_KEYS;
  return (
    <div className="session-keypad" aria-label="Teclado numérico">
      {keys.map((key) => (
        <button
          key={key}
          className={`session-key${key === "clear" || key === "backspace" ? " session-key--utility" : ""}`}
          type="button"
          disabled={disabled}
          aria-label={key === "clear"
            ? "Limpar"
            : key === "backspace"
              ? "Apagar"
              : key === "."
                ? "Vírgula decimal"
                : key === "separator"
                  ? answerType === "rational" ? "Barra da fração" : "Separar quociente e resto"
                  : key}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onAnswerKey(key)}
        >
          {key === "clear"
            ? "limpar"
            : key === "backspace"
              ? "⌫"
              : key === "."
                ? ","
                : key === "separator" ? answerType === "rational" ? "/" : "R" : key}
        </button>
      ))}
    </div>
  );
}

function SessionChoices({ choices, disabled, onAnswerKey }) {
  return (
    <div className={`session-choices${choices.length > 4 ? " session-choices--compact" : ""}`} aria-label="Opções de resposta">
      {choices.map((choice, index) => (
        <button
          key={String(choice.value)}
          type="button"
          disabled={disabled}
          aria-label={`${index + 1}. ${choice.label}`}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onAnswerKey(`choice:${choice.value}`)}
        >
          <kbd aria-hidden="true">{index + 1}</kbd>
          <span>{choice.label}</span>
        </button>
      ))}
    </div>
  );
}

function HudItem({ highlight = false, label, value }) {
  return (
    <div className={`session-hud__item${highlight ? " is-highlighted" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
