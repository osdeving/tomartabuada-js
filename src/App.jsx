import { useEffect, useRef, useState } from "react";
import katex from "katex";
import {
  PRACTICE_SECTION_IDS,
  SECTIONS,
  STORAGE_KEY,
  THEORY_TOPICS,
  TRICK_LESSONS,
  buildDefaultSelections,
  buildInitialStats,
  createQuestion,
  createSectionStats,
  getDefaultPresetId,
  getFlashcardDeck,
  getFlashcardDecks,
  getPresets,
  getSectionById,
  getSectionPrimers,
  gradeQuestion,
  isPracticeSection,
  isTabuadaHighlighted,
} from "./lib/mathAcademy";

const FLASHCARD_DECKS = getFlashcardDecks();
const KEYPAD_ROWS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  ["clear", "0", "backspace"],
];

function renderMath(expression, displayMode = false) {
  if (!expression) {
    return "";
  }

  try {
    return katex.renderToString(expression, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
    });
  } catch {
    return expression;
  }
}

function MathExpression({ expression, displayMode = false, className = "" }) {
  if (!expression) {
    return null;
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderMath(expression, displayMode) }}
    />
  );
}

function createDefaultAppState() {
  return {
    activeSectionId: "teoria",
    selectedPresets: buildDefaultSelections(),
    stats: buildInitialStats(),
    history: [],
    flashcards: {
      deckId: FLASHCARD_DECKS[0].id,
      index: 0,
      revealed: false,
    },
  };
}

function normalizeSelectedPresets(rawSelectedPresets) {
  const defaults = buildDefaultSelections();

  return Object.fromEntries(
    PRACTICE_SECTION_IDS.map((sectionId) => {
      const presets = getPresets(sectionId);
      const requestedPresetId = rawSelectedPresets?.[sectionId];
      const isValid = presets.some((preset) => preset.id === requestedPresetId);

      return [sectionId, isValid ? requestedPresetId : defaults[sectionId]];
    }),
  );
}

function normalizeStats(rawStats) {
  return Object.fromEntries(
    PRACTICE_SECTION_IDS.map((sectionId) => {
      const rawSection = rawStats?.[sectionId];
      const base = createSectionStats();

      return [
        sectionId,
        {
          ...base,
          attempts: Number(rawSection?.attempts) || 0,
          correct: Number(rawSection?.correct) || 0,
          currentStreak: Number(rawSection?.currentStreak) || 0,
          bestStreak: Number(rawSection?.bestStreak) || 0,
          lastPlayedAt: Number(rawSection?.lastPlayedAt) || 0,
        },
      ];
    }),
  );
}

function clampFlashcardIndex(index, length) {
  if (!length) {
    return 0;
  }

  const numericIndex = Number(index) || 0;

  return ((numericIndex % length) + length) % length;
}

function loadAppState() {
  if (typeof window === "undefined") {
    return createDefaultAppState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return createDefaultAppState();
    }

    const parsed = JSON.parse(raw);
    const defaults = createDefaultAppState();
    const flashDeck = getFlashcardDeck(parsed?.flashcards?.deckId);

    return {
      activeSectionId: SECTIONS.some((section) => section.id === parsed?.activeSectionId)
        ? parsed.activeSectionId
        : defaults.activeSectionId,
      selectedPresets: normalizeSelectedPresets(parsed?.selectedPresets),
      stats: normalizeStats(parsed?.stats),
      history: Array.isArray(parsed?.history)
        ? parsed.history.slice(0, 12).filter((item) => item && typeof item === "object")
        : [],
      flashcards: {
        deckId: flashDeck.id,
        index: clampFlashcardIndex(parsed?.flashcards?.index, flashDeck.cards.length),
        revealed: Boolean(parsed?.flashcards?.revealed),
      },
    };
  } catch {
    return createDefaultAppState();
  }
}

function formatAccuracy(value) {
  return value == null ? "novo" : `${Math.round(value * 100)}%`;
}

function summarizeStats(stats) {
  const summary = PRACTICE_SECTION_IDS.reduce(
    (accumulator, sectionId) => {
      const sectionStats = stats[sectionId];

      accumulator.attempts += sectionStats.attempts;
      accumulator.correct += sectionStats.correct;
      accumulator.bestStreak = Math.max(
        accumulator.bestStreak,
        sectionStats.bestStreak,
      );
      return accumulator;
    },
    { attempts: 0, correct: 0, bestStreak: 0 },
  );

  return {
    ...summary,
    accuracy: summary.attempts ? summary.correct / summary.attempts : null,
  };
}

function findWeakestSectionId(stats) {
  const attempted = PRACTICE_SECTION_IDS.filter(
    (sectionId) => stats[sectionId].attempts > 0,
  );

  if (!attempted.length) {
    return "adicao";
  }

  return attempted.sort((left, right) => {
    const leftAccuracy = stats[left].correct / stats[left].attempts;
    const rightAccuracy = stats[right].correct / stats[right].attempts;

    if (leftAccuracy !== rightAccuracy) {
      return leftAccuracy - rightAccuracy;
    }

    return stats[left].attempts - stats[right].attempts;
  })[0];
}

function MetricCard({ label, value, detail, accent = false }) {
  return (
    <div className={`metric-card${accent ? " metric-card--accent" : ""}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </div>
  );
}

function App() {
  const initialStateRef = useRef(null);

  if (!initialStateRef.current) {
    initialStateRef.current = loadAppState();
  }

  const initialState = initialStateRef.current;
  const [appState, setAppState] = useState(initialState);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [question, setQuestion] = useState(() => {
    if (!isPracticeSection(initialState.activeSectionId)) {
      return null;
    }

    return createQuestion(
      initialState.activeSectionId,
      initialState.selectedPresets[initialState.activeSectionId],
    );
  });

  const activeSection = getSectionById(appState.activeSectionId);
  const activePresetId = isPracticeSection(activeSection.id)
    ? appState.selectedPresets[activeSection.id]
    : "";
  const activePreset = isPracticeSection(activeSection.id)
    ? getPresets(activeSection.id).find((preset) => preset.id === activePresetId) ??
      getPresets(activeSection.id)[0]
    : null;
  const activeStats = isPracticeSection(activeSection.id)
    ? appState.stats[activeSection.id]
    : null;
  const overallStats = summarizeStats(appState.stats);
  const weakestSection = getSectionById(findWeakestSectionId(appState.stats));
  const flashcardDeck = getFlashcardDeck(appState.flashcards.deckId);
  const flashcardIndex = clampFlashcardIndex(
    appState.flashcards.index,
    flashcardDeck.cards.length,
  );
  const activeFlashcard = flashcardDeck.cards[flashcardIndex] ?? null;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  }, [appState]);

  useEffect(() => {
    if (!isPracticeSection(activeSection.id)) {
      return undefined;
    }

    function handleKeyDown(event) {
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
        backspace();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        clearAnswer();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        submitCurrentAnswer();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function resetPracticeState(nextQuestion) {
    setQuestion(nextQuestion);
    setAnswer("");
    setFeedback(null);
    setShowHint(false);
  }

  function goToSection(sectionId, presetId = null) {
    const nextPresetId =
      presetId ?? appState.selectedPresets[sectionId] ?? getDefaultPresetId(sectionId);

    setAppState((current) => ({
      ...current,
      activeSectionId: sectionId,
      selectedPresets:
        isPracticeSection(sectionId) && presetId
          ? {
              ...current.selectedPresets,
              [sectionId]: nextPresetId,
            }
          : current.selectedPresets,
      flashcards:
        sectionId === "flashcards"
          ? {
              ...current.flashcards,
              revealed: false,
            }
          : current.flashcards,
    }));

    if (isPracticeSection(sectionId)) {
      resetPracticeState(createQuestion(sectionId, nextPresetId));
      return;
    }

    resetPracticeState(null);
  }

  function selectPreset(sectionId, presetId) {
    setAppState((current) => ({
      ...current,
      selectedPresets: {
        ...current.selectedPresets,
        [sectionId]: presetId,
      },
    }));

    if (appState.activeSectionId === sectionId) {
      resetPracticeState(createQuestion(sectionId, presetId));
    }
  }

  function nextQuestion() {
    if (!isPracticeSection(activeSection.id)) {
      return;
    }

    resetPracticeState(createQuestion(activeSection.id, activePresetId));
  }

  function appendDigit(digit) {
    if (feedback?.kind === "resolved") {
      return;
    }

    setAnswer((current) => (current.length >= 4 ? current : `${current}${digit}`));

    if (feedback?.kind === "warning") {
      setFeedback(null);
    }
  }

  function clearAnswer() {
    setAnswer("");

    if (feedback?.kind === "warning") {
      setFeedback(null);
    }
  }

  function backspace() {
    if (feedback?.kind === "resolved") {
      return;
    }

    setAnswer((current) => current.slice(0, -1));

    if (feedback?.kind === "warning") {
      setFeedback(null);
    }
  }

  function revealAnswer() {
    if (!question) {
      return;
    }

    setFeedback({
      kind: "resolved",
      tone: "neutral",
      title: "Confira a correção.",
      math: question.solutionLatex,
      detail: question.breakdown,
    });
  }

  function submitCurrentAnswer() {
    if (!question) {
      return;
    }

    if (feedback?.kind === "resolved") {
      nextQuestion();
      return;
    }

    if (!/^\d+$/.test(answer.trim())) {
      setFeedback({
        kind: "warning",
        tone: "warning",
        title: "Digite a resposta.",
        detail: "Use o teclado do app ou o teclado físico do aparelho.",
      });
      return;
    }

    const result = gradeQuestion(question, answer.trim());

    setFeedback({
      kind: "resolved",
      ...result.feedback,
    });
    setAppState((current) => {
      const previousStats = current.stats[question.sectionId] ?? createSectionStats();
      const nextStreak = result.isCorrect ? previousStats.currentStreak + 1 : 0;

      return {
        ...current,
        stats: {
          ...current.stats,
          [question.sectionId]: {
            ...previousStats,
            attempts: previousStats.attempts + 1,
            correct: previousStats.correct + (result.isCorrect ? 1 : 0),
            currentStreak: nextStreak,
            bestStreak: Math.max(previousStats.bestStreak, nextStreak),
            lastPlayedAt: Date.now(),
          },
        },
        history: [
          {
            id: `${question.id}-${Date.now()}`,
            sectionId: question.sectionId,
            sectionLabel: getSectionById(question.sectionId).label,
            prompt: question.prompt,
            promptLatex: question.promptLatex,
            solutionLatex: question.solutionLatex,
            answer: question.answer,
            correct: result.isCorrect,
          },
          ...current.history,
        ].slice(0, 12),
      };
    });
  }

  function submitPractice(event) {
    event.preventDefault();
    submitCurrentAnswer();
  }

  function handleKeypadPress(key) {
    if (key === "clear") {
      clearAnswer();
      return;
    }

    if (key === "backspace") {
      backspace();
      return;
    }

    appendDigit(key);
  }

  function selectFlashcardDeck(deckId) {
    const deck = getFlashcardDeck(deckId);

    setAppState((current) => ({
      ...current,
      activeSectionId: "flashcards",
      flashcards: {
        deckId: deck.id,
        index: 0,
        revealed: false,
      },
    }));
  }

  function moveFlashcard(step) {
    setAppState((current) => {
      const deck = getFlashcardDeck(current.flashcards.deckId);

      return {
        ...current,
        flashcards: {
          ...current.flashcards,
          index: clampFlashcardIndex(current.flashcards.index + step, deck.cards.length),
          revealed: false,
        },
      };
    });
  }

  function shuffleFlashcard() {
    setAppState((current) => {
      const deck = getFlashcardDeck(current.flashcards.deckId);

      if (deck.cards.length <= 1) {
        return current;
      }

      let nextIndex = current.flashcards.index;

      while (nextIndex === current.flashcards.index) {
        nextIndex = Math.floor(Math.random() * deck.cards.length);
      }

      return {
        ...current,
        flashcards: {
          ...current.flashcards,
          index: nextIndex,
          revealed: false,
        },
      };
    });
  }

  function toggleFlashcard() {
    setAppState((current) => ({
      ...current,
      flashcards: {
        ...current.flashcards,
        revealed: !current.flashcards.revealed,
      },
    }));
  }

  function renderPracticeContent() {
    const isResolved = feedback?.kind === "resolved";
    const isWarning = feedback?.kind === "warning";
    const primers = getSectionPrimers(activeSection.id);

    return (
      <>
        <section className="panel control-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{activeSection.kicker}</p>
              <h2>{activeSection.label}</h2>
              <p className="panel-copy">{activeSection.description}</p>
            </div>
            <div className="status-pill">
              <strong>{activePreset?.label}</strong>
              <span>{activePreset?.detail}</span>
            </div>
          </div>

          <div className="preset-row">
            {getPresets(activeSection.id).map((preset) => (
              <button
                key={preset.id}
                className={`preset-chip${
                  preset.id === activePresetId ? " preset-chip--active" : ""
                }`}
                type="button"
                onClick={() => selectPreset(activeSection.id, preset.id)}
              >
                <strong>{preset.label}</strong>
                <span>{preset.detail}</span>
              </button>
            ))}
          </div>

          {activeSection.id === "tricks" ? (
            <div className="lesson-grid">
              {TRICK_LESSONS.map((lesson) => (
              <button
                  key={lesson.id}
                  className={`lesson-card${
                    lesson.presetId === activePresetId ? " lesson-card--active" : ""
                  }`}
                  type="button"
                  onClick={() => selectPreset("tricks", lesson.presetId)}
                >
                  <strong>{lesson.title}</strong>
                  <span className="lesson-card__rule">{lesson.rule}</span>
                  <MathExpression
                    expression={lesson.exampleLatex}
                    className="lesson-card__math"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel arena-panel">
          <div className="arena-layout">
            <div className="question-card">
              <div className="question-card__topline">
                <span className="support-chip">{activePreset?.label}</span>
                <span className="support-chip support-chip--soft">
                  {activePreset?.tip}
                </span>
              </div>

              <p className="question-label">Conta da vez</p>
              <MathExpression
                expression={question?.promptLatex}
                displayMode
                className="question-math"
              />

              <div className="answer-display">
                {answer ? (
                  <MathExpression expression={answer} displayMode className="answer-math" />
                ) : (
                  <span className="answer-placeholder">...</span>
                )}
              </div>
            </div>

            <form className="keypad-panel" onSubmit={submitPractice}>
              <div className="keypad-grid">
                {KEYPAD_ROWS.flat().map((key) => (
                  <button
                    key={key}
                    className={`keypad-key${
                      key === "clear" || key === "backspace"
                        ? " keypad-key--secondary"
                        : ""
                    }`}
                    type="button"
                    disabled={isResolved}
                    onClick={() => handleKeypadPress(key)}
                  >
                    {key === "clear" ? "limpar" : key === "backspace" ? "apagar" : key}
                  </button>
                ))}
              </div>
              <button className="primary-button keypad-submit" type="submit">
                {isResolved ? "Próxima conta" : "Conferir"}
              </button>

              <div className="action-row action-row--compact">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setShowHint((current) => !current)}
                >
                  {showHint ? "Esconder dica" : "Mostrar dica"}
                </button>
                <button className="ghost-button" type="button" onClick={revealAnswer}>
                  Revelar
                </button>
                <button className="ghost-button" type="button" onClick={nextQuestion}>
                  Trocar conta
                </button>
              </div>

              {showHint && !isResolved ? (
                <div className="hint-card">
                  <strong>Dica</strong>
                  <p>{question?.hint}</p>
                </div>
              ) : null}

              {feedback ? (
                <div className={`feedback-card feedback-card--${feedback.tone}`}>
                  <strong>{feedback.title}</strong>
                  {feedback.math ? (
                    <MathExpression
                      expression={feedback.math}
                      displayMode
                      className="feedback-math"
                    />
                  ) : null}
                  <p>{feedback.detail}</p>
                  {isWarning ? <span className="feedback-meta">use o teclado abaixo</span> : null}
                </div>
              ) : null}

              <div className="micro-metrics">
                <MetricCard
                  label="Tentativas"
                  value={activeStats?.attempts ?? 0}
                  detail="nesta seção"
                />
                <MetricCard
                  label="Precisão"
                  value={formatAccuracy(
                    activeStats?.attempts
                      ? activeStats.correct / activeStats.attempts
                      : null,
                  )}
                  detail="acumulada"
                />
                <MetricCard
                  label="Streak"
                  value={activeStats?.currentStreak ?? 0}
                  detail={`melhor ${activeStats?.bestStreak ?? 0}`}
                />
              </div>
            </form>
          </div>
        </section>

        <section className="panel support-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Apoio</p>
              <h2>Referências rápidas</h2>
            </div>
          </div>

          <div className="support-grid">
            {primers.map((primer) => (
              <article key={primer.title} className="support-card">
                <strong>{primer.title}</strong>
                <p>{primer.body}</p>
              </article>
            ))}
          </div>

          {activeSection.id === "tabuada" ? (
            <div className="table-card">
              <div className="table-card__head">
                <strong>Mapa da tabuada</strong>
                <span>O preset atual destaca a faixa ativa.</span>
              </div>
              <div className="table-grid">
                <div className="table-grid__corner">×</div>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((column) => (
                  <div key={`head-${column}`} className="table-grid__label">
                    {column}
                  </div>
                ))}
                {Array.from({ length: 10 }, (_, rowIndex) => rowIndex + 1).map((row) => (
                  <FragmentRow key={row} row={row} activePresetId={activePresetId} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </>
    );
  }

  function renderTheoryContent() {
    return (
      <section className="panel theory-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Métodos</p>
            <h2>Teoria</h2>
            <p className="panel-copy">
              Estratégias curtas para reduzir atrito mental antes de acelerar.
            </p>
          </div>
        </div>

        <div className="theory-grid">
          {THEORY_TOPICS.map((topic) => (
            <article key={topic.id} className="theory-card">
              <div className="theory-card__head">
                <strong>{topic.title}</strong>
                <span>{topic.summary}</span>
              </div>
              <ol className="theory-steps">
                {topic.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <MathExpression
                expression={topic.exampleLatex}
                displayMode
                className="theory-example"
              />
              {topic.exampleNote ? <p className="panel-copy">{topic.exampleNote}</p> : null}
              <button
                className="ghost-button"
                type="button"
                onClick={() => goToSection(topic.practice.sectionId, topic.practice.presetId)}
              >
                {topic.practice.label}
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderFlashcardsContent() {
    return (
      <section className="panel flashcards-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Revisão</p>
            <h2>Flashcards</h2>
            <p className="panel-copy">
              Revisão curta para manter padrões e famílias sempre quentes.
            </p>
          </div>
          <div className="status-pill">
            <strong>{flashcardDeck.label}</strong>
            <span>{flashcardDeck.detail}</span>
          </div>
        </div>

        <div className="deck-row">
          {FLASHCARD_DECKS.map((deck) => (
            <button
              key={deck.id}
              className={`deck-chip${
                deck.id === flashcardDeck.id ? " deck-chip--active" : ""
              }`}
              type="button"
              onClick={() => selectFlashcardDeck(deck.id)}
            >
              <strong>{deck.label}</strong>
              <span>{deck.cards.length} cards</span>
            </button>
          ))}
        </div>

        <div className="flashcard-layout">
          <button
            className={`flashcard${
              appState.flashcards.revealed ? " flashcard--revealed" : ""
            }`}
            type="button"
            onClick={toggleFlashcard}
          >
            <span className="flashcard__eyebrow">
              {appState.flashcards.revealed ? "verso" : "frente"}
            </span>
            {appState.flashcards.revealed ? (
              activeFlashcard?.backLatex ? (
                <MathExpression
                  expression={activeFlashcard.backLatex}
                  displayMode
                  className="flashcard__math"
                />
              ) : (
                <strong className="flashcard__content">{activeFlashcard?.back}</strong>
              )
            ) : activeFlashcard?.frontLatex ? (
              <MathExpression
                expression={activeFlashcard.frontLatex}
                displayMode
                className="flashcard__math"
              />
            ) : (
              <strong className="flashcard__content">{activeFlashcard?.front}</strong>
            )}
            {appState.flashcards.revealed && activeFlashcard?.note ? (
              <p className="flashcard__note">{activeFlashcard.note}</p>
            ) : null}
            <span className="flashcard__hint">toque para virar</span>
          </button>

          <div className="flashcard-side">
            <div className="micro-metrics">
              <MetricCard
                label="Deck"
                value={flashcardDeck.label}
                detail={`${flashcardDeck.cards.length} cards`}
                accent
              />
              <MetricCard
                label="Posição"
                value={`${flashcardIndex + 1}`}
                detail={`de ${flashcardDeck.cards.length}`}
              />
            </div>

            <div className="action-row action-row--stack">
              <button className="primary-button" type="button" onClick={toggleFlashcard}>
                Virar
              </button>
              <button className="ghost-button" type="button" onClick={() => moveFlashcard(-1)}>
                Anterior
              </button>
              <button className="ghost-button" type="button" onClick={() => moveFlashcard(1)}>
                Próxima
              </button>
              <button className="ghost-button" type="button" onClick={shuffleFlashcard}>
                Embaralhar
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="app-shell">
      <header className="panel hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Cálculo Mental</p>
          <h1>Cálculo Mental</h1>
          <p className="hero-text">
            Treino rápido de operações, padrões numéricos e revisão com foco em
            uso confortável no celular.
          </p>
          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => goToSection("adicao", "com-vai-um")}
            >
              Começar
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => goToSection("teoria")}
            >
              Ver teoria
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => goToSection("flashcards")}
            >
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
            detail={`${SECTIONS.length} áreas`}
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

      <section className="panel section-panel">
        <div className="section-strip">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className={`section-chip${
                section.id === activeSection.id ? " section-chip--active" : ""
              }`}
              type="button"
              onClick={() => goToSection(section.id)}
            >
              <strong>{section.label}</strong>
              <span>{section.kicker}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="dashboard">
        <main className="practice-column">
          {activeSection.id === "teoria"
            ? renderTheoryContent()
            : activeSection.id === "flashcards"
              ? renderFlashcardsContent()
              : renderPracticeContent()}
        </main>

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
                const section = getSectionById(sectionId);
                const stats = appState.stats[sectionId];
                const accuracy = stats.attempts ? stats.correct / stats.attempts : null;

                return (
                  <button
                    key={sectionId}
                    className="progress-row"
                    type="button"
                    onClick={() => goToSection(sectionId)}
                  >
                    <div>
                      <strong>{section.label}</strong>
                      <span>{stats.attempts} tentativas</span>
                    </div>
                    <span className="progress-row__value">
                      {formatAccuracy(accuracy)}
                    </span>
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
              {appState.history.length ? (
                appState.history.map((item) => (
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
                      <MathExpression expression={`${item.answer}`} className="history-pill__answer" />
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
      </div>
    </div>
  );
}

function FragmentRow({ row, activePresetId }) {
  return (
    <>
      <div className="table-grid__label">{row}</div>
      {Array.from({ length: 10 }, (_, columnIndex) => columnIndex + 1).map((column) => {
        const active = isTabuadaHighlighted(activePresetId, row, column);

        return (
          <div
            key={`${row}-${column}`}
            className={`table-grid__cell${
              active ? " table-grid__cell--active" : ""
            }`}
          >
            {row * column}
          </div>
        );
      })}
    </>
  );
}

export default App;
