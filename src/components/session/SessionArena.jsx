import { useEffect, useRef } from "react";
import { MathExpression } from "../MathExpression";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"];

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
  const question = session.question;

  useEffect(() => {
    arenaRef.current?.focus({ preventScroll: true });
  }, [question?.id, paused]);

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

      <section className="session-stage" aria-live="polite">
        <div className="question-source-row">
          <span className="difficulty-chip">Nível {session.difficultyLabel}</span>
          {question?.source === "book" ? <span className="book-chip">Do livro · cap. {question.chapter ?? "—"}</span> : null}
          <span className="timer-label">{Math.max(0, remainingMs / 1000).toFixed(1)}s</span>
        </div>

        <div className="session-question" key={question?.id}>
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

        <div className="session-feedback-slot">
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

      <SessionKeypad disabled={Boolean(feedback) || paused} onAnswerKey={onAnswerKey} />

      {paused ? (
        <div className="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <div className="pause-card">
            <span className="pause-card__icon" aria-hidden="true">Ⅱ</span>
            <p className="eyebrow">Respire</p>
            <h2 id="pause-title">Sessão pausada</h2>
            <p>Seu tempo está congelado. Volte quando estiver pronto para manter o foco.</p>
            <button className="button button--primary button--large" type="button" onClick={onResume}>Continuar</button>
            <button className="button button--quiet" type="button" onClick={onExit}>Encerrar e salvar</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SessionKeypad({ disabled, onAnswerKey }) {
  return (
    <div className="session-keypad" aria-label="Teclado numérico">
      {KEYS.map((key) => (
        <button
          key={key}
          className={`session-key${key === "clear" || key === "backspace" ? " session-key--utility" : ""}`}
          type="button"
          disabled={disabled}
          aria-label={key === "clear" ? "Limpar" : key === "backspace" ? "Apagar" : key}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onAnswerKey(key)}
        >
          {key === "clear" ? "limpar" : key === "backspace" ? "⌫" : key}
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
