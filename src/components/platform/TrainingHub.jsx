import {
  PRACTICE_GROUPS,
  QUESTION_COUNTS,
  SESSION_MODES,
} from "../../lib/platform/experience";
import { PageHeader } from "./AppChrome";

export function TrainingHub({ config, onChange, onOpenArcade, onStart, preview }) {
  const activeMode = SESSION_MODES.find((mode) => mode.id === config.modeId) ?? SESSION_MODES[0];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Arena"
        title="Escolha seu desafio"
        description="Configure antes de entrar. Durante a sessão, a tela fica limpa e o teclado do celular permanece fechado."
      />

      <section className="surface setup-section">
        <div className="section-title-row">
          <div>
            <span className="step-number">01</span>
            <h2>Modo de treino</h2>
          </div>
        </div>
        <div className="mode-grid">
          {SESSION_MODES.map((mode) => (
            <button
              key={mode.id}
              className={`mode-card${config.modeId === mode.id ? " is-selected" : ""}`}
              type="button"
              onClick={() => onChange({ modeId: mode.id })}
            >
              <span className="mode-card__icon" aria-hidden="true">{mode.icon}</span>
              <span className="mode-card__eyebrow">{mode.eyebrow}</span>
              <strong>{mode.label}</strong>
              <p>{mode.description}</p>
              <span className="selection-dot" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="surface setup-section">
        <div className="section-title-row">
          <div>
            <span className="step-number">02</span>
            <h2>Grupo de habilidades</h2>
          </div>
          <span className="section-hint">Você pode mudar isso a qualquer momento</span>
        </div>
        <div className="group-grid">
          {PRACTICE_GROUPS.map((group) => (
            <button
              key={group.id}
              className={`group-card group-card--${group.color}${config.groupId === group.id ? " is-selected" : ""}`}
              type="button"
              onClick={() => onChange({ groupId: group.id })}
            >
              <span className="group-card__signal" aria-hidden="true" />
              <strong>{group.label}</strong>
              <p>{group.description}</p>
              <span className="group-card__mastery">{preview.groupMastery[group.id] ?? "novo"}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="surface launch-card">
        <div className="launch-card__settings">
          <div>
            <p className="eyebrow">Sessão</p>
            <h2>{activeMode.label} · {PRACTICE_GROUPS.find((group) => group.id === config.groupId)?.label}</h2>
            <p>{preview.adaptiveMessage}</p>
          </div>

          {config.modeId === "sparring" ? (
            <div className="segmented-control" aria-label="Quantidade de questões">
              {QUESTION_COUNTS.map((count) => (
                <button
                  key={count}
                  className={config.questionCount === count ? "is-active" : ""}
                  type="button"
                  onClick={() => onChange({ questionCount: count })}
                >
                  {count}
                </button>
              ))}
            </div>
          ) : (
            <div className="mode-rule">
              <strong>{config.modeId === "sobrevivencia" ? "3 vidas" : "60 segundos"}</strong>
              <span>{config.modeId === "sobrevivencia" ? "sem limite de questões" : "o relógio não para"}</span>
            </div>
          )}
        </div>

        <div className="launch-card__actions">
          <button className="button button--primary button--xl" type="button" onClick={onStart}>
            Entrar na arena <span aria-hidden="true">→</span>
          </button>
          <span className="keyboard-note"><kbd>0–9</kbd> começa a responder · não precisa Enter</span>
        </div>
      </section>

      <button className="arcade-link" type="button" onClick={onOpenArcade}>
        <span aria-hidden="true">▰</span>
        <span><strong>Quer variar?</strong><small>Abra o protótipo arcade de multiplicação.</small></span>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

