import { MetricCard } from "../common/MetricCard";

export function HeroPanel({
  overallStats,
  weakestSection,
  onStart,
  onShowTheory,
  onShowFlashcards,
  formatAccuracy,
  sectionCount,
}) {
  return (
    <header className="panel hero-panel">
      <div className="hero-copy">
        <p className="eyebrow">Cálculo Mental</p>
        <h1>Cálculo Mental</h1>
        <p className="hero-text">
          Treino rápido de operações, padrões numéricos e revisão com foco em
          uso confortável no celular.
        </p>
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={onStart}>
            Começar
          </button>
          <button className="ghost-button" type="button" onClick={onShowTheory}>
            Ver teoria
          </button>
          <button className="ghost-button" type="button" onClick={onShowFlashcards}>
            Revisar
          </button>
        </div>
      </div>

      <div className="hero-metrics">
        <MetricCard
          label="Precisão"
          value={formatAccuracy(overallStats.accuracy)}
          detail={`${overallStats.correct} acertos`}
          accent
        />
        <MetricCard
          label="Tentativas"
          value={overallStats.attempts}
          detail={`${sectionCount} áreas`}
        />
        <MetricCard
          label="Streak"
          value={overallStats.bestStreak}
          detail="melhor sequência"
        />
        <MetricCard
          label="Atenção"
          value={weakestSection.label}
          detail="seção mais frágil"
        />
      </div>
    </header>
  );
}
