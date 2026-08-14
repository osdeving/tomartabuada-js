export function SessionSummary({ onClose, onRetry, onReviewTheory, summary }) {
  const accuracy = Math.round(summary.accuracy * 100);

  return (
    <main className="summary-screen">
      <section className="summary-card surface">
        <div className="summary-celebration" aria-hidden="true">{summary.passed ? "✦" : "↻"}</div>
        <p className="eyebrow">{summary.passed ? "Sessão concluída" : "Treino registrado"}</p>
        <h1>{summary.headline}</h1>
        <p className="summary-card__copy">{summary.message}</p>

        {summary.isNewRecord ? <div className="record-banner">🏆 Novo recorde pessoal: {summary.score.toLocaleString("pt-BR")} pontos</div> : null}
        {summary.communityContribution ? (
          <CommunityReceipt contribution={summary.communityContribution} />
        ) : null}

        <div className="summary-metrics">
          <SummaryMetric label="Precisão" value={`${accuracy}%`} detail={`${summary.correct} de ${summary.answered}`} />
          <SummaryMetric label="Ritmo médio" value={formatPace(summary.averageResponseMs)} detail="por resposta" />
          <SummaryMetric label="Melhor combo" value={`×${summary.bestCombo}`} detail="nesta sessão" />
          <SummaryMetric label="Pontos" value={summary.score.toLocaleString("pt-BR")} detail={`+${summary.xpEarned ?? 0} XP`} />
        </div>

        {summary.insight ? (
          <div className={`summary-insight summary-insight--${summary.insight.kind}`}>
            <span aria-hidden="true">{summary.insight.kind === "theory" ? "◫" : "↗"}</span>
            <div><strong>{summary.insight.title}</strong><p>{summary.insight.detail}</p></div>
            {summary.insight.kind === "theory" && onReviewTheory ? (
              <button className="text-button" type="button" onClick={() => onReviewTheory(summary.insight.topicId)}>Ler teoria →</button>
            ) : null}
          </div>
        ) : null}

        <div className="summary-actions">
          <button className="button button--primary button--large" type="button" onClick={onRetry}>Treinar de novo</button>
          <button className="button button--quiet" type="button" onClick={onClose}>Voltar ao painel</button>
        </div>
      </section>
    </main>
  );
}

function CommunityReceipt({ contribution }) {
  const clanLabel = contribution.clanTag ? `[${contribution.clanTag}]` : contribution.clanName;
  const pending = contribution.status === "pending";
  const failed = contribution.status === "failed";

  return (
    <div
      className={`community-receipt${failed ? " community-receipt--error" : ""}`}
      role={failed ? "alert" : "status"}
      aria-live="polite"
    >
      <span aria-hidden="true">{pending ? "…" : failed ? "!" : "◆"}</span>
      <div>
        <strong>{pending
          ? "Somando seus pontos ao clã…"
          : failed
            ? "A pontuação comunitária não foi sincronizada"
            : `+${contribution.points.toLocaleString("pt-BR")} pontos para ${clanLabel}`}</strong>
        <p>{contribution.message ?? (contribution.disputeScored
          ? "A rodada também entrou no placar da disputa."
          : "A contribuição já aparece no ranking coletivo.")}</p>
      </div>
    </div>
  );
}

function SummaryMetric({ detail, label, value }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function formatPace(value) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return value < 1_000 ? `${Math.round(value)}ms` : `${(value / 1_000).toFixed(1)}s`;
}
