import { PRACTICE_GROUPS } from "../../lib/platform/experience";
import { PageHeader } from "./AppChrome";

export function HomeDashboard({ dashboard, onNavigate, onQuickStart, selectedGroupId }) {
  const group = PRACTICE_GROUPS.find((item) => item.id === selectedGroupId) ?? PRACTICE_GROUPS[0];
  const goalProgress = Math.min(100, Math.round((dashboard.todayAttempts / dashboard.dailyGoal) * 100));

  return (
    <div className="page-stack home-page">
      <PageHeader
        eyebrow="Seu centro de treino"
        title={dashboard.greeting}
        description="Uma conta por vez. O desafio acompanha seu ritmo e mostra exatamente onde você está evoluindo."
      />

      <section className="hero-dashboard surface surface--hero">
        <div className="hero-dashboard__copy">
          <span className="live-badge"><i /> Recomendado agora</span>
          <h2>{dashboard.recommendationTitle}</h2>
          <p>{dashboard.recommendationDetail}</p>
          <div className="button-row">
            <button className="button button--primary button--large" type="button" onClick={onQuickStart}>
              Começar sparring <span aria-hidden="true">→</span>
            </button>
            <button className="button button--quiet" type="button" onClick={() => onNavigate("campanha")}>
              Ver campanha
            </button>
          </div>
          <p className="hero-dashboard__meta">
            <span>{group.label}</span>
            <span>•</span>
            <span>{dashboard.suggestedCount} questões</span>
            <span>•</span>
            <span>dificuldade adaptativa</span>
          </p>
        </div>

        <div className="daily-ring" style={{ "--progress": `${goalProgress * 3.6}deg` }}>
          <div className="daily-ring__center">
            <strong>{dashboard.todayAttempts}</strong>
            <span>de {dashboard.dailyGoal} hoje</span>
          </div>
        </div>
      </section>

      <section className="metric-grid metric-grid--four" aria-label="Resumo do desempenho">
        <DashboardMetric label="Precisão geral" value={dashboard.accuracyLabel} detail={dashboard.trendLabel} tone="violet" />
        <DashboardMetric label="Tempo médio" value={dashboard.paceLabel} detail="nas respostas corretas" tone="cyan" />
        <DashboardMetric label="Melhor combo" value={dashboard.bestCombo} detail="respostas em sequência" tone="lime" />
        <DashboardMetric label="Nível" value={dashboard.level} detail={`${dashboard.xpToNext} XP até o próximo`} tone="orange" />
      </section>

      <div className="home-grid">
        <section className="surface focus-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Mapa de habilidade</p>
              <h2>Onde vale insistir</h2>
            </div>
            <button className="text-button" type="button" onClick={() => onNavigate("relatorios")}>Relatório completo →</button>
          </div>
          <div className="skill-bars">
            {dashboard.skillRows.map((skill) => (
              <button key={skill.id} className="skill-bar" type="button" onClick={() => onNavigate("treinar", skill.groupId)}>
                <span className="skill-bar__label"><strong>{skill.label}</strong><small>{skill.attempts} {skill.attempts === 1 ? "tentativa" : "tentativas"}</small></span>
                <span className="skill-bar__track"><i style={{ width: `${skill.mastery}%` }} /></span>
                <strong className="skill-bar__value">{skill.labelValue}</strong>
              </button>
            ))}
          </div>
        </section>

        <aside className="surface coach-card">
          <span className="coach-card__icon" aria-hidden="true">✦</span>
          <p className="eyebrow">Coach adaptativo</p>
          <h2>{dashboard.coachTitle}</h2>
          <p>{dashboard.coachDetail}</p>
          <button className="button button--secondary" type="button" onClick={dashboard.coachAction === "teoria" ? () => onNavigate("teoria") : onQuickStart}>
            {dashboard.coachAction === "teoria" ? "Revisar teoria" : "Treinar agora"}
          </button>
        </aside>
      </div>
    </div>
  );
}

function DashboardMetric({ label, value, detail, tone }) {
  return (
    <article className={`surface dashboard-metric dashboard-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
