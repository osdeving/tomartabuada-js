import { PageHeader } from "./AppChrome";

export function ReportsDashboard({ report, onTrainGroup }) {
  return (
    <div className="page-stack reports-page">
      <PageHeader
        eyebrow="Performance"
        title="Seu cálculo em dados"
        description="Precisão sem velocidade engana; velocidade sem consistência também. Aqui as duas coisas aparecem juntas."
        actions={<span className="data-freshness">Atualizado localmente · agora</span>}
      />

      <section className="metric-grid metric-grid--four">
        <ReportMetric label="Precisão" value={report.accuracyLabel} delta={report.accuracyTrend} />
        <ReportMetric label="Ritmo correto" value={report.paceLabel} delta={report.paceTrend} />
        <ReportMetric label="Sessões" value={report.sessionCount} delta={`${report.totalAttempts} respostas`} />
        <ReportMetric label="Consistência" value={report.consistencyLabel} delta={report.consistencyDetail} />
      </section>

      <div className="report-main-grid">
        <section className="surface chart-card">
          <div className="section-title-row">
            <div><p className="eyebrow">Últimos 14 dias</p><h2>Precisão e volume</h2></div>
            <span className="chart-legend"><i /> respostas <i /> precisão</span>
          </div>
          <ActivityChart points={report.activity} />
        </section>

        <aside className="surface report-coach-card">
          <p className="eyebrow">Leitura do coach</p>
          <h2>{report.coach.title}</h2>
          <p>{report.coach.detail}</p>
          <dl>
            <div><dt>Padrão mais forte</dt><dd>{report.coach.strongest}</dd></div>
            <div><dt>Maior oportunidade</dt><dd>{report.coach.weakest}</dd></div>
            <div><dt>Melhor horário</dt><dd>{report.coach.bestTime}</dd></div>
          </dl>
          <button className="button button--secondary" type="button" onClick={() => onTrainGroup(report.coach.groupId)}>Treinar oportunidade</button>
        </aside>
      </div>

      <section className="surface group-report-card">
        <div className="section-title-row">
          <div><p className="eyebrow">Por grupo</p><h2>Domínio e velocidade</h2></div>
          <span className="section-hint">O domínio combina acerto, ritmo e recorrência.</span>
        </div>
        <div className="group-report-table" role="table" aria-label="Desempenho por grupo">
          <div className="group-report-table__head" role="row">
            <span>Grupo</span><span>Domínio</span><span>Precisão</span><span>Ritmo</span><span>Treino</span>
          </div>
          {report.groups.map((group) => (
            <div className="group-report-row" role="row" key={group.id}>
              <span><i className={`group-dot group-dot--${group.color}`} /><strong>{group.label}</strong><small>{group.attempts} {group.attempts === 1 ? "tentativa" : "tentativas"}</small></span>
              <span><span className="mastery-track"><i style={{ width: `${group.mastery}%` }} /></span><strong>{group.mastery}%</strong></span>
              <strong>{group.accuracyLabel}</strong>
              <strong>{group.paceLabel}</strong>
              <button className="icon-link" type="button" onClick={() => onTrainGroup(group.id)} aria-label={`Treinar ${group.label}`}>→</button>
            </div>
          ))}
        </div>
      </section>

      <div className="report-bottom-grid">
        <section className="surface patterns-card">
          <div className="section-title-row"><div><p className="eyebrow">Diagnóstico</p><h2>Padrões que pedem revisão</h2></div></div>
          <div className="pattern-list">
            {report.weakPatterns.length ? report.weakPatterns.map((pattern) => (
              <article key={pattern.key}>
                <span className="pattern-list__signal">{pattern.accuracyLabel}</span>
                <div><strong>{pattern.label}</strong><p>{pattern.detail}</p></div>
              </article>
            )) : <p className="empty-report">Continue treinando: depois de algumas respostas, os padrões aparecem aqui.</p>}
          </div>
        </section>

        <section className="surface session-history-card">
          <div className="section-title-row"><div><p className="eyebrow">Histórico</p><h2>Sessões recentes</h2></div></div>
          <div className="session-list">
            {report.sessions.length ? report.sessions.map((session) => (
              <article key={session.id}>
                <span className={`session-list__mode session-list__mode--${session.modeId}`}>{session.modeShort}</span>
                <div><strong>{session.groupLabel}</strong><small>{session.dateLabel} · {session.durationLabel}</small></div>
                <div><strong>{session.accuracyLabel}</strong><small>{session.scoreLabel}</small></div>
              </article>
            )) : <p className="empty-report">Sua primeira sessão vai inaugurar este histórico.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function ReportMetric({ delta, label, value }) {
  return (
    <article className="surface report-metric">
      <span>{label}</span><strong>{value}</strong><small>{delta}</small>
    </article>
  );
}

function ActivityChart({ points }) {
  const maxAttempts = Math.max(1, ...points.map((point) => point.attempts));
  const polyline = points
    .map((point, index) => {
      const x = points.length <= 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 92 - (point.accuracy ?? 0) * 76;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="activity-chart">
      <div className="activity-chart__plot">
        {points.map((point) => (
          <div key={point.date} className="activity-bar" title={`${point.attempts} respostas · ${point.accuracyLabel}`}>
            <i style={{ height: `${Math.max(3, (point.attempts / maxAttempts) * 88)}%` }} />
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={polyline} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="activity-chart__labels">
        {points.map((point, index) => <span key={point.date} className={index % 2 ? "is-hidden-mobile" : ""}>{point.label}</span>)}
      </div>
    </div>
  );
}
