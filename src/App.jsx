import { Fragment, useEffect, useEffectEvent, useRef, useState } from "react";
import {
  DEFAULT_SELECTED_FACT_IDS,
  FACTORS,
  FACTS,
  STORAGE_KEY,
  applyAnswer,
  createDefaultProgress,
  formatResponseTime,
  getAccuracy,
  getActiveFacts,
  getBandInsights,
  getFactId,
  getFactIdsForFactors,
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
const ALL_FACT_IDS = FACTS.map((fact) => fact.id);
const DEFAULT_FEEDBACK = {
  tone: "neutral",
  title: "Keypad próprio no celular.",
  detail:
    "O treino agora usa range builder por células. No mobile a resposta entra só pelo keypad, sem teclado nativo.",
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

function describeCellCount(count) {
  return `${count} célula${count === 1 ? "" : "s"} ativa${count === 1 ? "" : "s"}`;
}

function buildFactIdsForRectangle(anchor, current) {
  const rowStart = Math.min(anchor.row, current.row);
  const rowEnd = Math.max(anchor.row, current.row);
  const columnStart = Math.min(anchor.column, current.column);
  const columnEnd = Math.max(anchor.column, current.column);
  const factIds = [];

  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let column = columnStart; column <= columnEnd; column += 1) {
      factIds.push(getFactId(row, column));
    }
  }

  return factIds;
}

function buildRowFactIds(row) {
  return FACTORS.map((column) => getFactId(row, column));
}

function buildColumnFactIds(column) {
  return FACTORS.map((row) => getFactId(row, column));
}

function getSelectionCellFromEvent(event) {
  if (typeof document === "undefined") {
    return null;
  }

  const element = document.elementFromPoint(event.clientX, event.clientY);
  const cellElement = element?.closest?.("[data-selection-cell='true']");

  if (!cellElement) {
    return null;
  }

  const row = Number(cellElement.dataset.row);
  const column = Number(cellElement.dataset.column);

  if (!row || !column) {
    return null;
  }

  return {
    row,
    column,
    id: getFactId(row, column),
  };
}

function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [question, setQuestion] = useState(null);
  const [answerBuffer, setAnswerBuffer] = useState("");
  const [feedback, setFeedback] = useState(DEFAULT_FEEDBACK);
  const [dragSelection, setDragSelection] = useState(null);
  const [isCompactLayout, setIsCompactLayout] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
  });

  const questionStartRef = useRef(0);
  const lastQuestionIdRef = useRef("");
  const selectedFactIdSet = new Set(progress.selectedFactIds);

  function issueNextQuestion(
    nextProgress,
    selectedFactIds = nextProgress.selectedFactIds,
    previousQuestionId = question?.id ?? lastQuestionIdRef.current,
  ) {
    const nextQuestion = pickNextQuestion(
      nextProgress,
      selectedFactIds,
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
    issueNextQuestion(result.progress, result.progress.selectedFactIds, question.id);
  }

  function applySelectionSet(nextSelectedFactIds, nextFeedback = null) {
    const nextSelectedFactIdSet = new Set(nextSelectedFactIds);
    const normalizedFactIds = ALL_FACT_IDS.filter((factId) =>
      nextSelectedFactIdSet.has(factId),
    );
    const nextProgress = {
      ...progress,
      selectedFactIds: normalizedFactIds,
    };

    setProgress(nextProgress);
    setDragSelection(null);

    if (!normalizedFactIds.length) {
      setQuestion(null);
      setAnswerBuffer("");
      setFeedback(
        nextFeedback ?? {
          tone: "warning",
          title: "Range vazio.",
          detail: "Pinte pelo menos uma célula para continuar treinando.",
        },
      );
      return;
    }

    setFeedback(
      nextFeedback ?? {
        tone: "neutral",
        title: "Range atualizado.",
        detail: `${describeCellCount(normalizedFactIds.length)} no treino.`,
      },
    );
    issueNextQuestion(nextProgress, normalizedFactIds, question?.id ?? "");
  }

  function applyFactorShortcut(selectedFactors, nextFeedback = null) {
    applySelectionSet(
      getFactIdsForFactors(selectedFactors),
      nextFeedback ?? {
        tone: "neutral",
        title: "Famílias aplicadas.",
        detail: `Entraram todas as contas ligadas a ${selectedFactors.join(", ")}.`,
      },
    );
  }

  function toggleLine(factIds, label) {
    const shouldSelect = factIds.some((factId) => !selectedFactIdSet.has(factId));
    const nextSelection = new Set(progress.selectedFactIds);

    factIds.forEach((factId) => {
      if (shouldSelect) {
        nextSelection.add(factId);
      } else {
        nextSelection.delete(factId);
      }
    });

    applySelectionSet(Array.from(nextSelection), {
      tone: "neutral",
      title: shouldSelect ? `${label} ligada.` : `${label} desligada.`,
      detail: `${describeCellCount(nextSelection.size)} no range atual.`,
    });
  }

  function toggleRow(row) {
    toggleLine(buildRowFactIds(row), `Linha ${row}`);
  }

  function toggleColumn(column) {
    toggleLine(buildColumnFactIds(column), `Coluna ${column}`);
  }

  function toggleAll() {
    const shouldSelectAll = progress.selectedFactIds.length !== ALL_FACT_IDS.length;

    applySelectionSet(shouldSelectAll ? ALL_FACT_IDS : [], {
      tone: "neutral",
      title: shouldSelectAll ? "Grade inteira ligada." : "Grade inteira limpa.",
      detail: shouldSelectAll
        ? "Todas as 81 células entraram no treino."
        : "Nenhuma célula ficou ativa.",
    });
  }

  function mergeSelectionByMode(targetFactIds, mode, nextFeedback = null) {
    const nextSelection = new Set(progress.selectedFactIds);

    targetFactIds.forEach((factId) => {
      if (mode === "paint") {
        nextSelection.add(factId);
      } else {
        nextSelection.delete(factId);
      }
    });

    applySelectionSet(Array.from(nextSelection), nextFeedback);
  }

  function startRangeDrag(event) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const selectionCell = getSelectionCellFromEvent(event);

    if (!selectionCell) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    setDragSelection({
      pointerId: event.pointerId,
      anchor: selectionCell,
      current: selectionCell,
      mode: selectedFactIdSet.has(selectionCell.id) ? "erase" : "paint",
    });
  }

  function moveRangeDrag(event) {
    if (!dragSelection || dragSelection.pointerId !== event.pointerId) {
      return;
    }

    const selectionCell = getSelectionCellFromEvent(event);

    if (!selectionCell || selectionCell.id === dragSelection.current.id) {
      return;
    }

    setDragSelection((current) =>
      current
        ? {
            ...current,
            current: selectionCell,
          }
        : current,
    );
  }

  function finishRangeDrag(event) {
    if (!dragSelection || dragSelection.pointerId !== event.pointerId) {
      return;
    }

    const selectionCell = getSelectionCellFromEvent(event) ?? dragSelection.current;
    const targetFactIds = buildFactIdsForRectangle(
      dragSelection.anchor,
      selectionCell,
    );
    const mode = dragSelection.mode;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragSelection(null);

    mergeSelectionByMode(targetFactIds, mode, {
      tone: "neutral",
      title: mode === "paint" ? "Área pintada." : "Área apagada.",
      detail: `${targetFactIds.length} célula${targetFactIds.length === 1 ? "" : "s"} ${mode === "paint" ? "ligada" : "removida"}${targetFactIds.length === 1 ? "" : "s"} no range.`,
    });
  }

  function cancelRangeDrag(event) {
    if (!dragSelection || dragSelection.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDragSelection(null);
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
    issueNextQuestion(nextProgress, nextProgress.selectedFactIds, "");
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
    if (question || !progress.selectedFactIds.length) {
      return;
    }

    issueNextQuestion(progress, progress.selectedFactIds, "");
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

  const activeFacts = getActiveFacts(progress.selectedFactIds);
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
  const hardFacts = activeFacts
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
    .sort((left, right) => right.weakness - left.weakness)
    .slice(0, 6);
  const smartSelection = getSmartFactorSelection(progress);
  const smartSelectionFactIds = getFactIdsForFactors(smartSelection);
  const recentHistory = progress.history.slice(0, 16);
  const rangePreviewFactIds = dragSelection
    ? buildFactIdsForRectangle(dragSelection.anchor, dragSelection.current)
    : [];
  const rangePreviewFactIdSet = new Set(rangePreviewFactIds);
  const allSelected = progress.selectedFactIds.length === ALL_FACT_IDS.length;
  const selectionMessage = dragSelection
    ? dragSelection.mode === "paint"
      ? `Pintando ${rangePreviewFactIds.length} células`
      : `Apagando ${rangePreviewFactIds.length} células`
    : "Arraste para pintar bloco. Comece em célula ativa para apagar um bloco.";

  function getLineState(factIds) {
    const activeCount = factIds.filter((factId) => selectedFactIdSet.has(factId)).length;

    if (activeCount === factIds.length) {
      return "is-full";
    }

    if (activeCount > 0) {
      return "is-partial";
    }

    return "";
  }

  return (
    <div className="app-shell">
      <header className="panel hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Tabuada Sprint</p>
          <h1>Treino adaptativo com range builder de verdade.</h1>
          <p className="hero-text">
            O escopo voltou para a matriz 10x10 no estilo range builder: arrasta
            para pintar uma área, toca para podar células específicas e o motor
            de repetição só trabalha dentro desse conjunto.
          </p>

          <div className="hero-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() =>
                applyFactorShortcut(smartSelection, {
                  tone: "neutral",
                  title: "Reforço inteligente armado.",
                  detail: `Entraram as famílias ${smartSelection.join(", ")}. Agora você pode podar célula por célula na matriz.`,
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
                <h2>Range builder</h2>
              </div>

              <span className="support-chip">
                {describeCellCount(progress.selectedFactIds.length)}
              </span>
            </div>

            <p className="panel-copy">
              Cabeçalhos ligam linha ou coluna inteira. Clique numa célula para
              alternar só ela. Arraste mouse ou dedo para pintar uma área
              retangular, igual construção de range.
            </p>

            <div className="preset-row">
              <button
                className="mini-button"
                type="button"
                onClick={() => applySelectionSet(DEFAULT_SELECTED_FACT_IDS)}
              >
                Quadrado 2-9
              </button>
              <button className="mini-button" type="button" onClick={toggleAll}>
                {allSelected ? "Limpar tudo" : "Tudo"}
              </button>
              <button
                className="mini-button"
                type="button"
                onClick={() => applyFactorShortcut([8], {
                  tone: "neutral",
                  title: "Linha e coluna do 8 armadas.",
                  detail: "A matriz puxou todas as contas que incluem 8. Agora você pode remover as fáceis com toque.",
                })}
              >
                Foco no 8
              </button>
              <button
                className="mini-button"
                type="button"
                onClick={() => applySelectionSet(smartSelectionFactIds)}
              >
                Faixas fracas
              </button>
            </div>

            <div
              className={`range-status-card ${dragSelection ? `is-${dragSelection.mode}` : ""}`}
            >
              <strong>{selectionMessage}</strong>
              <span>
                {dragSelection
                  ? "Solta para aplicar o bloco inteiro."
                  : "Use o range para excluir contas fáceis, tipo 8×1, sem perder o resto da linha."}
              </span>
            </div>

            <div
              className="range-grid"
              onPointerDown={startRangeDrag}
              onPointerMove={moveRangeDrag}
              onPointerUp={finishRangeDrag}
              onPointerCancel={cancelRangeDrag}
            >
              <button
                className={`range-axis range-corner ${allSelected ? "is-full" : progress.selectedFactIds.length ? "is-partial" : ""}`}
                type="button"
                onClick={toggleAll}
                title="Ligar ou limpar a grade inteira"
              >
                all
              </button>

              {FACTORS.map((column) => (
                <button
                  key={`column-${column}`}
                  className={`range-axis ${getLineState(buildColumnFactIds(column))}`}
                  type="button"
                  onClick={() => toggleColumn(column)}
                  title={`Alternar coluna ${column}`}
                >
                  {column}
                </button>
              ))}

              {FACTORS.map((row) => (
                <Fragment key={row}>
                  <button
                    className={`range-axis ${getLineState(buildRowFactIds(row))}`}
                    type="button"
                    onClick={() => toggleRow(row)}
                    title={`Alternar linha ${row}`}
                  >
                    {row}
                  </button>

                  {FACTORS.map((column) => {
                    const factId = getFactId(row, column);
                    const stats = progress.factStats[factId];
                    const mastery = getMasteryScore(stats);
                    const isSelected = selectedFactIdSet.has(factId);
                    const isPreviewed = rangePreviewFactIdSet.has(factId);
                    const previewClass = isPreviewed
                      ? dragSelection?.mode === "paint"
                        ? "is-preview-paint"
                        : "is-preview-erase"
                      : "";

                    return (
                      <button
                        key={factId}
                        className={`range-cell ${isSelected ? "is-selected" : ""} ${previewClass}`}
                        type="button"
                        data-selection-cell="true"
                        data-row={row}
                        data-column={column}
                        tabIndex={-1}
                        aria-pressed={isSelected}
                        title={`${row} × ${column} = ${row * column}`}
                        style={{
                          "--range-mastery": Math.max(
                            0.12,
                            Number(mastery.toFixed(2)),
                          ),
                        }}
                      >
                        <span className="range-cell-expression">
                          {row}×{column}
                        </span>
                        <span className="range-cell-product">{row * column}</span>
                      </button>
                    );
                  })}
                </Fragment>
              ))}
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
                {question ? `${question.a} × ${question.b}` : "Monte um range"}
              </div>
              <div className="answer-display" aria-live="polite">
                {answerBuffer || "—"}
              </div>
              <p className="question-hint">
                {isCompactLayout
                  ? "No mobile o treino usa só o keypad. Nenhum teclado nativo sobe."
                  : "Teclado físico funciona. O keypad também aceita clique."}
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
                <span className="metric-label">Células no range</span>
                <strong>{progress.selectedFactIds.length}</strong>
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
                <span className="metric-label">Células ativas</span>
                <strong>{activeFacts.length}</strong>
                <span className="summary-meta">no range atual</span>
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
              {hardFacts.length ? (
                hardFacts.map((fact) => (
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
                ))
              ) : (
                <p className="empty-state">
                  Ainda não há células ativas suficientes para apontar risco.
                </p>
              )}
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
