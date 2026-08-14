import {
  PRACTICE_GROUPS,
  QUESTION_COUNTS,
  SESSION_MODES,
  TIME_PROFILES,
} from "../../lib/platform/experience";
import { MEMORIZATION_OPERATIONS } from "../../lib/platform/basicMemorization";
import { BasicMemorizationSetup } from "./BasicMemorizationSetup";
import { PageHeader } from "./AppChrome";

const PRACTICE_KINDS = [
  {
    id: "adaptive",
    eyebrow: "Estratégias e desafios",
    label: "Treino adaptativo",
    description: "Mistura técnicas, exercícios guiados e padrões que acompanham sua evolução.",
    icon: "◎",
  },
  {
    id: "memorization",
    eyebrow: "Fluência essencial",
    label: "Memorizar o básico",
    description: "Tabuada, adição e subtração até a resposta sair sem reconstruir a conta.",
    icon: "↯",
  },
];

export function TrainingHub({ config, onChange, onOpenArcade, onStart, preview }) {
  const practiceKind = config.practiceKind ?? "adaptive";
  const activeMode = SESSION_MODES.find((mode) => mode.id === config.modeId) ?? SESSION_MODES[0];
  const memoryOperation = MEMORIZATION_OPERATIONS.find((item) => item.id === config.memorization?.operationId)
    ?? MEMORIZATION_OPERATIONS[0];
  const timeProfile = TIME_PROFILES.find((profile) => profile.id === config.timeProfileId)
    ?? TIME_PROFILES[1];
  const isSprint = practiceKind === "adaptive" && config.modeId === "sprint";
  const sessionTitle = practiceKind === "memorization"
    ? `Memorizar · ${memoryOperation.label}`
    : `${activeMode.label} · ${PRACTICE_GROUPS.find((group) => group.id === config.groupId)?.label}`;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Centro de treino"
        title="Escolha como você quer evoluir"
        description="Treine estratégias ou automatize as contas básicas. O histórico decide o que merece voltar mais cedo."
      />

      <section className="surface setup-section">
        <div className="section-title-row">
          <div>
            <span className="step-number">01</span>
            <h2>Objetivo do treino</h2>
          </div>
        </div>
        <div className="practice-kind-grid">
          {PRACTICE_KINDS.map((kind) => (
            <button
              aria-pressed={practiceKind === kind.id}
              key={kind.id}
              className={`practice-kind-card${practiceKind === kind.id ? " is-selected" : ""}`}
              type="button"
              onClick={() => onChange({
                practiceKind: kind.id,
                ...(kind.id === "memorization" ? { modeId: "sparring" } : {}),
              })}
            >
              <span className="practice-kind-card__icon" aria-hidden="true">{kind.icon}</span>
              <span>
                <small>{kind.eyebrow}</small>
                <strong>{kind.label}</strong>
                <p>{kind.description}</p>
              </span>
              <i aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      {practiceKind === "memorization" ? (
        <BasicMemorizationSetup
          value={config.memorization ?? { operationId: "multiplication", presetId: "all", presetIds: ["all"] }}
          onChange={(memorization) => onChange({ memorization })}
        />
      ) : (
        <AdaptiveSetup config={config} onChange={onChange} preview={preview} />
      )}

      {!isSprint ? (
        <section className="surface setup-section">
          <div className="section-title-row">
            <div>
              <span className="step-number">{practiceKind === "memorization" ? "04" : "04"}</span>
              <div>
                <h2>Pressão de tempo</h2>
                <p className="section-copy">O nível da conta e o tempo agora são controles separados.</p>
              </div>
            </div>
          </div>
          <div className="time-profile-grid">
            {TIME_PROFILES.map((profile) => (
              <button
                aria-pressed={timeProfile.id === profile.id}
                className={timeProfile.id === profile.id ? "is-selected" : ""}
                key={profile.id}
                type="button"
                onClick={() => onChange({ timeProfileId: profile.id })}
              >
                <span aria-hidden="true">{profile.id === "sem-limite" ? "∞" : profile.id === "calmo" ? "○" : profile.id === "ritmo" ? "◒" : "●"}</span>
                <strong>{profile.label}</strong>
                <small>{profile.description}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface launch-card">
        <div className="launch-card__settings">
          <div>
            <p className="eyebrow">Sessão</p>
            <h2>{sessionTitle}</h2>
            <p>{practiceKind === "memorization"
              ? "O que demora ou falha reaparece. O que sai na lata entra em revisão espaçada."
              : preview.adaptiveMessage}</p>
            <span className="launch-time-chip">
              {isSprint ? "60 segundos totais" : timeProfile.label}
            </span>
          </div>

          {config.modeId === "sparring" ? (
            <div className="segmented-control" aria-label="Quantidade de questões">
              {QUESTION_COUNTS.map((count) => (
                <button
                  aria-pressed={config.questionCount === count}
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
            Começar treino <span aria-hidden="true">→</span>
          </button>
          <span className="keyboard-note"><kbd>0–9</kbd> começa a responder · acertos entram sozinhos · <kbd>Enter</kbd> confirma</span>
        </div>
      </section>

      <button className="arcade-link" type="button" onClick={onOpenArcade}>
        <span aria-hidden="true">▰</span>
        <span>
          <strong>Conheça também o Arcade da multiplicação</strong>
          <small>Outro modo de praticar multiplicação: resolva desafios enquanto joga.</small>
        </span>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

function AdaptiveSetup({ config, onChange, preview }) {
  return (
    <>
      <section className="surface setup-section">
        <div className="section-title-row">
          <div>
            <span className="step-number">02</span>
            <h2>Modo de treino</h2>
          </div>
        </div>
        <div className="mode-grid">
          {SESSION_MODES.map((mode) => (
            <button
              aria-pressed={config.modeId === mode.id}
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
            <span className="step-number">03</span>
            <h2>Grupo de habilidades</h2>
          </div>
          <span className="section-hint">Você pode mudar isso a qualquer momento</span>
        </div>
        <div className="group-grid">
          {PRACTICE_GROUPS.map((group) => (
            <button
              aria-pressed={config.groupId === group.id}
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
    </>
  );
}
