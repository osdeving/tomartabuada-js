import { PRACTICE_SECTION_IDS } from "../../lib/mathAcademy";
import { MathExpression } from "../MathExpression";

export function InsightsSidebar({
  history,
  onGoToSection,
  sectionsById,
  stats,
  formatAccuracy,
}) {
  return (
    <aside className="insights-column">
      <section className="panel report-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Progresso</p>
            <h2>Radar</h2>
          </div>
        </div>

        <div className="progress-list">
          {PRACTICE_SECTION_IDS.map((sectionId) => {
            const section = sectionsById[sectionId];
            const sectionStats = stats[sectionId];
            const accuracy = sectionStats.attempts
              ? sectionStats.correct / sectionStats.attempts
              : null;

            return (
              <button
                key={sectionId}
                className="progress-row"
                type="button"
                onClick={() => onGoToSection(sectionId)}
              >
                <div>
                  <strong>{section.label}</strong>
                  <span>{sectionStats.attempts} tentativas</span>
                </div>
                <span className="progress-row__value">{formatAccuracy(accuracy)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel report-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Sessão</p>
            <h2>Últimas contas</h2>
          </div>
        </div>

        <div className="history-list">
          {history.length ? (
            history.map((item) => (
              <div
                key={item.id}
                className={`history-pill history-pill--${
                  item.correct ? "correct" : "wrong"
                }`}
              >
                <MathExpression
                  expression={item.promptLatex}
                  className="history-pill__math"
                />
                <span>{item.sectionLabel}</span>
                {item.correct ? (
                  <MathExpression
                    expression={`${item.answer}`}
                    className="history-pill__answer"
                  />
                ) : (
                  <MathExpression
                    expression={item.solutionLatex}
                    className="history-pill__answer"
                  />
                )}
              </div>
            ))
          ) : (
            <p className="empty-state">
              As últimas contas aparecem aqui conforme você vai treinando.
            </p>
          )}
        </div>
      </section>
    </aside>
  );
}
