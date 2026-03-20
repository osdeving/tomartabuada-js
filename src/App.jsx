import { Fragment, useEffect, useEffectEvent, useRef, useState } from "react";
import {
  FACTORS,
  STORAGE_KEY,
  applyAnswer,
  createDefaultProgress,
  formatResponseTime,
  getAccuracy,
  getActiveFacts,
  getBandInsights,
  getFactId,
  getFactorInsights,
  getMasteryScore,
  getSmartFactorSelection,
  normalizeProgress,
  pickNextQuestion,
} from "./lib/training";

const MOBILE_LAYOUT_QUERY = "(max-width: 920px), (pointer: coarse)";
const KEYPAD_ROWS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  ["clear", "0", "backspace"],
];
const DEFAULT_FEEDBACK = {
  tone: "neutral",
  title: "Sem teclado nativo no celular.",
  detail:
    "No mobile a resposta entra pelo keypad próprio. No desktop você pode usar teclado físico ou clicar nos botões.",
};

function loadProgress() {
  if (typeof window === "undefined") {
    return createDefaultProgress();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeProgress(JSON.parse(raw)) : createDefaultProgress();
  } catch {
    return createDefaultProgress();
  }
}

function sameLocalDay(leftTimestamp, rightTimestamp) {
  const left = new Date(leftTimestamp);
  const right = new Date(rightTimestamp);

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function toPercent(value) {
  return value == null ? "novo" : `${Math.round(value * 100)}%`;
}

function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [question, setQuestion] = useState(null);
  const [answerBuffer, setAnswerBuffer] = useState("");
  const [feedback, setFeedback] = useState(DEFAULT_FEEDBACK);
  const [isCompactLayout, setIsCompactLayout] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
  });

  const questionStartRef = useRef(0);
  const lastQuestionIdRef = useRef("");

  function issueNextQuestion(
    nextProgress,
    selectedFactors = nextProgress.selectedFactors,
    previousQuestionId = question?.id ?? lastQuestionIdRef.current,
  ) {
    const nextQuestion = pickNextQuestion(
      nextProgress,
      selectedFactors,
      previousQuestionId,
    );

    setQuestion(nextQuestion);
    setAnswerBuffer("");

    if (nextQuestion) {
      questionStartRef.current = performance.now();
      lastQuestionIdRef.current = nextQuestion.id;
    }
  }

  function appendDigit(digit) {
    if (!question) {
      return;
    }

    setAnswerBuffer((current) => {
      if (current.length >= 3) {
        return current;
      }

      return current === "0" ? digit : `${current}${digit}`;
    });
  }

  function clearBuffer() {
    setAnswerBuffer("");
  }

  function removeDigit() {
    setAnswerBuffer((current) => current.slice(0, -1));
  }

  function submitAnswer() {
    if (!question) {
      return;
    }

    if (!answerBuffer.length) {
      setFeedback({
        tone: "warning",
        title: "Faltou o número.",
        detail: "Preencha a resposta no keypad antes de enviar.",
      });
      return;
    }

    const responseTimeMs = Math.max(
      300,
      Math.round(performance.now() - questionStartRef.current),
    );
    const result = applyAnswer(
      progress,
      question,
      Number(answerBuffer),
      responseTimeMs,
    );

    setProgress(result.progress);
    setFeedback({
      ...result.feedback,
      meta: formatResponseTime(responseTimeMs),
    });
    issueNextQuestion(result.progress, result.progress.selectedFactors, question.id);
  }

  function applyFactorSelection(nextFactors, nextFeedback = null) {
    const normalizedFactors = Array.from(new Set(nextFactors)).sort((a, b) => a - b);
    const nextProgress = {
      ...progress,
      selectedFactors: normalizedFactors,
    };

    setProgress(nextProgress);

    if (!normalizedFactors.length) {
      setQuestion(null);
      setAnswerBuffer("");
      setFeedback(
        nextFeedback ?? {
          tone: "warning",
          title: "Nenhuma família ativa.",
          detail: "Escolha pelo menos uma tabuada para continuar treinando.",
        },
      );
      return;
    }

    setFeedback(
      nextFeedback ?? {
        tone: "neutral",
        title: "Escopo atualizado.",
        detail: `${normalizedFactors.length} famílias ativas e fila reorganizada.`,
      },
    );
    issueNextQuestion(nextProgress, normalizedFactors, question?.id ?? "");
  }

  function toggleFactor(factor) {
    const nextFactors = progress.selectedFactors.includes(factor)
      ? progress.selectedFactors.filter((value) => value !== factor)
      : [...progress.selectedFactors, factor];

    applyFactorSelection(nextFactors);
  }

  function resetProgress() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Limpar histórico, relatório e prioridades adaptativas?")
    ) {
      return;
    }

    const nextProgress = createDefaultProgress();
    setProgress(nextProgress);
    setFeedback({
      tone: "neutral",
      title: "Histórico zerado.",
      detail: "Tudo voltou para o ponto inicial.",
    });
    issueNextQuestion(nextProgress, nextProgress.selectedFactors, "");
  }

  const handleWindowKeyDown = useEffectEvent((event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      appendDigit(event.key);
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      removeDigit();
      return;
    }

    if (event.key === "Delete" || event.key === "Escape") {
      event.preventDefault();
      clearBuffer();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      submitAnswer();
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return undefined;
  }, [progress]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const media = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const sync = () => setIsCompactLayout(media.matches);

    sync();
    media.addEventListener("change", sync);
    window.addEventListener("resize", sync);

    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    if (question || !progress.selectedFactors.length) {
      return;
    }

    issueNextQuestion(progress, progress.selectedFactors, "");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const listener = (event) => handleWindowKeyDown(event);
    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, []);

  const activeFacts = getActiveFacts(progress.selectedFactors);
  const factorInsights = getFactorInsights(progress);
  const factorInsightMap = Object.fromEntries(
    factorInsights.map((entry) => [entry.factor, entry]),
  );
  const bandInsights = getBandInsights(progress);
  const aggregateTotals = Object.values(progress.factStats).reduce(
    (summary, stats) => {
      summary.attempts += stats.attempts;
      summary.correct += stats.correct;
      return summary;
    },
    { attempts: 0, correct: 0 },
  );
  const overallAccuracy = aggregateTotals.attempts
    ? aggregateTotals.correct / aggregateTotals.attempts
    : null;
  const todayHistory = progress.history.filter((item) =>
    sameLocalDay(item.timestamp, Date.now()),
  );
  const todayCorrect = todayHistory.filter((item) => item.correct).length;
  const todayAccuracy = todayHistory.length ? todayCorrect / todayHistory.length : null;
  const todayAverageTime = todayHistory.length
    ? Math.round(
        todayHistory.reduce((sum, item) => sum + item.responseTimeMs, 0) /
          todayHistory.length,
      )
    : 0;
  const focusBand = [...bandInsights].sort((left, right) => {
    if (right.focusBoost !== left.focusBoost) {
      return right.focusBoost - left.focusBoost;
    }

    return left.min - right.min;
  })[0];
  const dueFactsCount = activeFacts.filter((fact) => {
    const stats = progress.factStats[fact.id];

    return !stats.attempts || stats.dueAt <= Date.now();
  }).length;
  const attemptedHardFacts = activeFacts
    .map((fact) => {
      const stats = progress.factStats[fact.id];
      const accuracy = getAccuracy(stats);
      const mastery = getMasteryScore(stats);

      return {
        ...fact,
        accuracy,
        mastery,
        stats,
        weakness:
          (1 - mastery) * 4 +
          (stats.consecutiveWrong || 0) * 1.4 +
          (accuracy == null ? 0.6 : 1 - accuracy) * 2.4 +
          (stats.avgTimeMs ? Math.min(stats.avgTimeMs / 3_600, 2) : 0.4),
      };
    })
    .sort((left, right) => right.weakness - left.weakness);
  const hardFacts = (attemptedHardFacts.some((entry) => entry.stats.attempts > 0)
    ? attemptedHardFacts.filter((entry) => entry.stats.attempts > 0)
    : attemptedHardFacts
  ).slice(0, 6);
  const smartSelection = getSmartFactorSelection(progress);
  const recentHistory = progress.history.slice(0, 16);
  const masteryMap = Object.fromEntries(
    FACTORS.flatMap((row) =>
      FACTORS.map((column) => {
        const factId = getFactId(row, column);
        const stats = progress.factStats[factId];

        return [
          `${row}-${column}`,
          {
            factId,
            mastery: getMasteryScore(stats),
            accuracy: getAccuracy(stats),
            active:
              progress.selectedFactors.includes(row) ||
              progress.selectedFactors.includes(column),
          },
        ];
      }),
    ),
  );

  return (
    <div className="app-shell">
      <header className="panel hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Tabuada Sprint</p>
          <h1>Treino adaptativo pronto para desktop e mobile.</h1>
          <p className="hero-text">
            A sessão agora roda em React, tem visual novo, relatório persistido,
            repetição espaçada por dificuldade e keypad próprio para o celular
            não abrir teclado nativo feio.
          </p>

          <div className="hero-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() =>
                applyFactorSelection(smartSelection, {
                  tone: "neutral",
                  title: "Reforço inteligente armado.",
                  detail: `Entraram as famílias ${smartSelection.join(", ")} por desempenho.`,
                })
              }
            >
              Reforço inteligente
            </button>
            <button className="secondary-button" type="button" onClick={resetProgress}>
              Limpar histórico
            </button>
          </div>
        </div>

        <div className="hero-metrics">
          <article className="metric-card">
            <span className="metric-label">Hoje</span>
            <strong className="metric-value">{todayHistory.length}</strong>
            <span className="metric-meta">respostas registradas</span>
          </article>

          <article className="metric-card">
            <span className="metric-label">Precisão</span>
            <strong className="metric-value">{toPercent(todayAccuracy)}</strong>
            <span className="metric-meta">na sessão do dia</span>
          </article>

          <article className="metric-card">
            <span className="metric-label">Tempo médio</span>
            <strong className="metric-value">
              {todayAverageTime ? formatResponseTime(todayAverageTime) : "0.0s"}
            </strong>
            <span className="metric-meta">para responder</span>
          </article>

          <article className="metric-card accent-card">
            <span className="metric-label">Fila pronta</span>
            <strong className="metric-value">{dueFactsCount}</strong>
            <span className="metric-meta">
              contas disponíveis para revisão agora
            </span>
          </article>
        </div>
      </header>

      <main className="dashboard">
        <section className="practice-column">
          <section className="panel control-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Escopo</p>
                <h2>Famílias para puxar</h2>
              </div>

              <span className="support-chip">{activeFacts.length} fatos ativos</span>
            </div>

            <div className="factor-grid">
              {FACTORS.map((factor) => {
                const insight = factorInsightMap[factor];
                const isActive = progress.selectedFactors.includes(factor);

                return (
                  <button
                    key={factor}
                    className={`factor-chip ${isActive ? "is-active" : ""}`}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => toggleFactor(factor)}
                  >
                    <span className="factor-title">× {factor}</span>
                    <span className="factor-meta">
                      {insight?.attempts ? toPercent(insight.accuracy) : "sem leitura"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="preset-row">
              <button
                className="mini-button"
                type="button"
                onClick={() => applyFactorSelection(FACTORS)}
              >
                Tudo
              </button>
              <button
                className="mini-button"
                type="button"
                onClick={() => applyFactorSelection([2, 3, 4, 5])}
              >
                Base
              </button>
              <button
                className="mini-button"
                type="button"
                onClick={() => applyFactorSelection([6, 7, 8, 9])}
              >
                Avançado
              </button>
              <button
                className="mini-button"
                type="button"
                onClick={() => applyFactorSelection(smartSelection)}
              >
                Inteligente
              </button>
            </div>
          </section>

          <section className="panel arena-panel">
            <div className="status-strip">
              <span className="status-pill">
                Faixa em foco: {focusBand?.label ?? "1-12"}
              </span>
              <span className="status-pill">
                Melhor streak: {progress.bestStreak}
              </span>
              <span className="status-pill">
                Layout {isCompactLayout ? "mobile" : "desktop"}
              </span>
            </div>

            <div className="question-card">
              <p className="eyebrow">Agora</p>
              <div className="question-value">
                {question ? `${question.a} × ${question.b}` : "Selecione uma família"}
              </div>
              <div className="answer-display" aria-live="polite">
                {answerBuffer || "—"}
              </div>
              <p className="question-hint">
                {isCompactLayout
                  ? "Mobile usa só o keypad abaixo. Nenhum teclado do sistema sobe."
                  : "Teclado físico funciona aqui. O keypad também aceita clique."}
              </p>
            </div>

            <div className={`feedback-card is-${feedback.tone}`}>
              <div>
                <strong>{feedback.title}</strong>
                <p>{feedback.detail}</p>
              </div>
              <span className="feedback-meta">{feedback.meta ?? "adaptativo"}</span>
            </div>

            <div className="micro-metrics">
              <article className="micro-card">
                <span className="metric-label">Streak atual</span>
                <strong>{progress.currentStreak}</strong>
              </article>
              <article className="micro-card">
                <span className="metric-label">Último foco</span>
                <strong>{focusBand?.label ?? "1-12"}</strong>
              </article>
              <article className="micro-card">
                <span className="metric-label">Respondidas</span>
                <strong>{progress.totalAnswers}</strong>
              </article>
            </div>

            <div className="keypad-shell">
              <div className="keypad-header">
                <div>
                  <p className="eyebrow">Keypad</p>
                  <h3>Entrada numérica própria</h3>
                </div>

                <button className="submit-button" type="button" onClick={submitAnswer}>
                  Enter
                </button>
              </div>

              <div className="keypad-grid">
                {KEYPAD_ROWS.flat().map((key) => {
                  const label =
                    key === "backspace"
                      ? "⌫"
                      : key === "clear"
                        ? "limpar"
                        : key;
                  const className =
                    key === "backspace" || key === "clear"
                      ? "keypad-key is-secondary"
                      : "keypad-key";
                  const handleClick =
                    key === "backspace"
                      ? removeDigit
                      : key === "clear"
                        ? clearBuffer
                        : () => appendDigit(key);

                  return (
                    <button
                      key={key}
                      className={className}
                      type="button"
                      onClick={handleClick}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </section>

        <aside className="insights-column">
          <section className="panel report-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Relatório</p>
                <h2>Panorama rápido</h2>
              </div>
            </div>

            <div className="summary-grid">
              <article className="summary-card">
                <span className="metric-label">Acerto global</span>
                <strong>{toPercent(overallAccuracy)}</strong>
                <span className="summary-meta">no histórico salvo</span>
              </article>

              <article className="summary-card">
                <span className="metric-label">Melhor streak</span>
                <strong>{progress.bestStreak}</strong>
                <span className="summary-meta">desde o último reset</span>
              </article>

              <article className="summary-card">
                <span className="metric-label">Fatos ativos</span>
                <strong>{activeFacts.length}</strong>
                <span className="summary-meta">na seleção atual</span>
              </article>

              <article className="summary-card">
                <span className="metric-label">Faixa quente</span>
                <strong>{focusBand?.label ?? "1-12"}</strong>
                <span className="summary-meta">onde o motor insiste mais</span>
              </article>
            </div>
          </section>

          <section className="panel report-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Heurística</p>
                <h2>Faixas que voltam mais</h2>
              </div>
            </div>

            <div className="band-list">
              {bandInsights.map((band) => (
                <article key={band.id} className="band-row">
                  <div className="band-copy">
                    <strong>{band.label}</strong>
                    <span>
                      {band.attempts
                        ? `${toPercent(band.accuracy)} de acerto em ${band.attempts} tentativas`
                        : "Ainda sem histórico"}
                    </span>
                  </div>
                  <div className="band-track">
                    <span
                      className="band-fill"
                      style={{
                        width: `${Math.max(12, Math.round((band.focusBoost / 1.8) * 100))}%`,
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel report-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Risco</p>
                <h2>Contas mais sensíveis</h2>
              </div>
            </div>

            <div className="fact-list">
              {hardFacts.map((fact) => (
                <article key={fact.id} className="fact-row">
                  <div>
                    <strong>
                      {fact.a} × {fact.b}
                    </strong>
                    <span>
                      {fact.stats.attempts
                        ? `${toPercent(fact.accuracy)} de acerto, média ${formatResponseTime(fact.stats.avgTimeMs)}`
                        : "Nova na fila"}
                    </span>
                  </div>
                  <span className="fact-chip">
                    domínio {Math.round(fact.mastery * 100)}%
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section className="panel report-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Mapa</p>
                <h2>Calor de domínio</h2>
              </div>
            </div>

            <div className="heatmap-grid" role="img" aria-label="Mapa de domínio da tabuada">
              <div className="heatmap-label heatmap-corner">×</div>
              {FACTORS.map((column) => (
                <div key={`head-${column}`} className="heatmap-label">
                  {column}
                </div>
              ))}

              {FACTORS.map((row) => (
                <Fragment key={row}>
                  <div className="heatmap-label">
                    {row}
                  </div>

                  {FACTORS.map((column) => {
                    const cell = masteryMap[`${row}-${column}`];

                    return (
                      <div
                        key={`${row}-${column}`}
                        className={`heatmap-cell ${cell.active ? "is-active" : ""}`}
                        title={`${row} × ${column} | domínio ${Math.round(
                          cell.mastery * 100,
                        )}%`}
                        style={{
                          "--heat":
                            cell.accuracy == null
                              ? 0.14
                              : Math.max(0.14, Number(cell.mastery.toFixed(2))),
                        }}
                      >
                        {row * column}
                      </div>
                      );
                  })}
                </Fragment>
              ))}
            </div>
          </section>

          <section className="panel report-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Últimas</p>
                <h2>Respostas recentes</h2>
              </div>
            </div>

            <div className="history-strip">
              {recentHistory.length ? (
                recentHistory.map((item) => (
                  <article
                    key={item.id}
                    className={`history-pill ${item.correct ? "is-correct" : "is-wrong"}`}
                  >
                    <strong>{item.label}</strong>
                    <span>
                      {item.correct ? "certo" : `${item.answer}`} ·{" "}
                      {formatResponseTime(item.responseTimeMs)}
                    </span>
                  </article>
                ))
              ) : (
                <p className="empty-state">
                  Ainda não há respostas suficientes para montar esse painel.
                </p>
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

export default App;
