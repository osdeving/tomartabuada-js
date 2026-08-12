import { useMemo, useState } from "react";

export function MathShmupHud({ snapshot }) {
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const nextPrompt = useMemo(() => getNextPrompt(snapshot), [snapshot]);

  return (
    <div className="math-shmup-hud">
      <div className="game-hud__bar">
        <div className="game-hud__mission">
          <div className="game-hud__eyebrow">
            <span className="game-chip">Game</span>
            {snapshot.activePathLabel ? (
              <span className="game-progress">{snapshot.activePathLabel}</span>
            ) : (
              <span className="game-progress">Livre</span>
            )}
          </div>

          <div className="game-hud__question">
            <span className="game-hud__objective-kicker">Conta</span>
            <strong>{snapshot.problemDisplay.questionLabel}</strong>
          </div>

          <div className="game-hud__objective">
            <span className="game-hud__objective-kicker">Agora</span>
            <strong>{nextPrompt}</strong>
          </div>
        </div>

        <button
          className="game-button game-button--ghost game-hud__toggle"
          type="button"
          onClick={() => setIsRadarOpen((current) => !current)}
        >
          {isRadarOpen ? "Fechar radar" : "Radar"}
        </button>
      </div>

      <div className={`game-status game-status--${snapshot.feedback.tone}`}>
        {snapshot.feedback.text}
      </div>

      {isRadarOpen ? (
        <div className="game-hud__drawer">
          <article className="game-panel game-panel--radar">
            <strong>Decomposição</strong>
            <div className="math-shmup-problem">
              <span>{snapshot.problemDisplay.topDecomposition}</span>
              <span>× {snapshot.problemDisplay.bottomDecomposition}</span>
            </div>
          </article>

          <article className="game-panel game-panel--targets">
            <strong>Caminhos</strong>
            <div className="math-paths">
              {snapshot.paths.map((path) => (
                <div
                  key={path.id}
                  className={`math-path${
                    path.active ? " math-path--active" : path.inactive ? " math-path--inactive" : ""
                  }`}
                >
                  <div className="math-path__head">
                    <span>{path.label}</span>
                  </div>

                  <div className="math-path__steps">
                    {path.steps.map((step) => (
                      <div
                        key={step.id}
                        className={`math-step${
                          step.current
                            ? " math-step--current"
                            : step.resolved
                              ? " math-step--resolved"
                              : ""
                        }${step.available ? " math-step--available" : ""}`}
                      >
                        <div className="math-step__head">
                          <span>{step.prompt}</span>
                          <strong>{step.resolved ? step.resultLabel : "____"}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}

function getNextPrompt(snapshot) {
  if (snapshot.currentPrompt) {
    return snapshot.currentPrompt;
  }

  if (snapshot.openingPrompts.length === 1) {
    return snapshot.openingPrompts[0];
  }

  if (snapshot.openingPrompts.length > 1) {
    return "Escolha um primeiro resultado útil";
  }

  return "Nova conta chegando";
}
