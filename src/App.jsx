import { useEffect, useMemo, useRef, useState } from "react";
import {
  SECTIONS,
  STORAGE_KEY,
  THEORY_TOPICS,
  TRICK_LESSONS,
  applyFactResult,
  clampFlashcardIndex,
  createPracticeQuestion,
  findWeakestSectionId,
  getDefaultPresetId,
  getFlashcardDeck,
  getFlashcardDecks,
  getPresetById,
  getPresets,
  getSectionById,
  getSectionPrimers,
  gradeQuestion,
  isPracticeSection,
  isTabuadaHighlighted,
  loadAppState,
  recordSectionAttempt,
  summarizeStats,
} from "./lib/mathAcademy";
import { MetricCard } from "./components/common/MetricCard";
import { FlashcardsPanel } from "./components/panels/FlashcardsPanel";
import { HeroPanel } from "./components/panels/HeroPanel";
import { InsightsSidebar } from "./components/panels/InsightsSidebar";
import { PracticeSetupPanel } from "./components/panels/PracticeSetupPanel";
import { PracticeSupportPanel } from "./components/panels/PracticeSupportPanel";
import { SectionStrip } from "./components/panels/SectionStrip";
import { TheoryPanel } from "./components/panels/TheoryPanel";
import { PracticeArena } from "./components/practice/PracticeArena";
import { GameSection } from "./game/GameSection";

const FLASHCARD_DECKS = getFlashcardDecks();
const KEYPAD_ROWS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  ["clear", "0", "backspace"],
];

function formatAccuracy(value) {
  return value == null ? "novo" : `${Math.round(value * 100)}%`;
}

function App() {
  const initialStateRef = useRef(null);
  const cueTimeoutRef = useRef(null);
  const questionStartTimeRef = useRef(Date.now());
  const recentSkillKeysRef = useRef([]);

  if (!initialStateRef.current) {
    initialStateRef.current = loadAppState();
  }

  const initialState = initialStateRef.current;
  const lastStandardSectionIdRef = useRef(
    initialState.activeSectionId !== "game" ? initialState.activeSectionId : "teoria",
  );
  const [appState, setAppState] = useState(initialState);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [questionCue, setQuestionCue] = useState({ tone: "", nonce: 0 });
  const [question, setQuestion] = useState(() => {
    if (!isPracticeSection(initialState.activeSectionId)) {
      return null;
    }

    const initialQuestion = buildPracticeQuestion(
      initialState.activeSectionId,
      initialState.selectedPresets[initialState.activeSectionId],
      initialState.factProfiles,
      recentSkillKeysRef.current,
    );

    if (initialQuestion) {
      recentSkillKeysRef.current = [initialQuestion.skillKey];
    }

    return initialQuestion;
  });

  const activeSection = getSectionById(appState.activeSectionId);
  const activePresetId = isPracticeSection(activeSection.id)
    ? appState.selectedPresets[activeSection.id]
    : "";
  const activePreset = isPracticeSection(activeSection.id)
    ? getPresetById(activeSection.id, activePresetId) ?? getPresets(activeSection.id)[0]
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
  const sectionsById = useMemo(
    () => Object.fromEntries(SECTIONS.map((section) => [section.id, section])),
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  }, [appState]);

  useEffect(
    () => () => {
      if (cueTimeoutRef.current) {
        window.clearTimeout(cueTimeoutRef.current);
      }
    },
    [],
  );

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
  }, [activeSection.id, answer, feedback, question]);

  function buildPracticeQuestion(sectionId, presetId, factProfiles, recentSkillKeys) {
    const nextQuestion = createPracticeQuestion(sectionId, presetId, {
      factProfiles,
      excludeSkillKeys: recentSkillKeys,
    });

    return nextQuestion;
  }

  function resetPracticeState(nextQuestion) {
    setQuestion(nextQuestion);
    setAnswer("");
    setFeedback(null);
    setShowHint(false);
    setQuestionCue((current) => ({ ...current, tone: "" }));

    if (nextQuestion) {
      recentSkillKeysRef.current = [
        nextQuestion.skillKey,
        ...recentSkillKeysRef.current.filter(
          (skillKey) => skillKey !== nextQuestion.skillKey,
        ),
      ].slice(0, 3);
      questionStartTimeRef.current = Date.now();
    }
  }

  function clearTransientFeedback() {
    if (feedback?.kind && feedback.kind !== "resolved") {
      setFeedback(null);
    }
  }

  function triggerQuestionCue(tone) {
    if (cueTimeoutRef.current) {
      window.clearTimeout(cueTimeoutRef.current);
    }

    setQuestionCue((current) => ({
      tone,
      nonce: current.nonce + 1,
    }));

    cueTimeoutRef.current = window.setTimeout(() => {
      setQuestionCue((current) => ({ ...current, tone: "" }));
      cueTimeoutRef.current = null;
    }, 420);
  }

  function commitAttempt(currentQuestion, isCorrect) {
    const now = Date.now();
    const responseTime = now - (questionStartTimeRef.current || now);
    const nextFactProfiles = applyFactResult(appState.factProfiles, currentQuestion, {
      isCorrect,
      responseTimeMs: responseTime,
      now,
    });
    const historyEntry = {
      id: `${currentQuestion.id}-${now}`,
      skillKey: currentQuestion.skillKey,
      sectionId: currentQuestion.sectionId,
      sectionLabel: getSectionById(currentQuestion.sectionId).label,
      prompt: currentQuestion.prompt,
      promptLatex: currentQuestion.promptLatex,
      solutionLatex: currentQuestion.solutionLatex,
      answer: currentQuestion.answer,
      correct: isCorrect,
      responseTime,
    };

    setAppState((current) => ({
      ...current,
      stats: recordSectionAttempt(current.stats, currentQuestion.sectionId, isCorrect, now),
      factProfiles: nextFactProfiles,
      history: [historyEntry, ...current.history].slice(0, 12),
    }));

    return nextFactProfiles;
  }

  function goToSection(sectionId, presetId = null) {
    if (sectionId !== "game") {
      lastStandardSectionIdRef.current = sectionId;
    }

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

    if (sectionId === "game") {
      return;
    }

    if (isPracticeSection(sectionId)) {
      resetPracticeState(
        buildPracticeQuestion(
          sectionId,
          nextPresetId,
          appState.factProfiles,
          recentSkillKeysRef.current,
        ),
      );
      return;
    }

    resetPracticeState(null);
  }

  function exitGame() {
    const nextSectionId = lastStandardSectionIdRef.current || "teoria";

    setAppState((current) => ({
      ...current,
      activeSectionId: nextSectionId,
    }));
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
      resetPracticeState(
        buildPracticeQuestion(
          sectionId,
          presetId,
          appState.factProfiles,
          recentSkillKeysRef.current,
        ),
      );
    }
  }

  function nextQuestion() {
    if (!isPracticeSection(activeSection.id)) {
      return;
    }

    resetPracticeState(
      buildPracticeQuestion(
        activeSection.id,
        activePresetId,
        appState.factProfiles,
        recentSkillKeysRef.current,
      ),
    );
  }

  function appendDigit(digit) {
    if (feedback?.kind === "resolved") {
      return;
    }

    setAnswer((current) => (current.length >= 4 ? current : `${current}${digit}`));
    clearTransientFeedback();
  }

  function clearAnswer() {
    setAnswer("");
    clearTransientFeedback();
  }

  function backspace() {
    if (feedback?.kind === "resolved") {
      return;
    }

    setAnswer((current) => current.slice(0, -1));
    clearTransientFeedback();
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
    const nextFactProfiles = commitAttempt(question, result.isCorrect);

    if (result.isCorrect) {
      resetPracticeState(
        buildPracticeQuestion(
          activeSection.id,
          activePresetId,
          nextFactProfiles,
          recentSkillKeysRef.current,
        ),
      );
      return;
    }

    setAnswer("");
    questionStartTimeRef.current = Date.now();
    triggerQuestionCue("danger");
    setFeedback({
      kind: "retry",
      ...result.feedback,
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

  const practiceMetrics = (
    <div className="micro-metrics">
      <MetricCard
        label="Tentativas"
        value={activeStats?.attempts ?? 0}
        detail="nesta seção"
      />
      <MetricCard
        label="Precisão"
        value={formatAccuracy(
          activeStats?.attempts ? activeStats.correct / activeStats.attempts : null,
        )}
        detail="acumulada"
      />
      <MetricCard
        label="Streak"
        value={activeStats?.currentStreak ?? 0}
        detail={`melhor ${activeStats?.bestStreak ?? 0}`}
      />
    </div>
  );

  if (activeSection.id === "game") {
    return <GameSection onExit={exitGame} />;
  }

  return (
    <div className="app-shell">
      <HeroPanel
        overallStats={overallStats}
        weakestSection={weakestSection}
        onStart={() => goToSection("adicao", "misto-1-algarismo")}
        onShowTheory={() => goToSection("teoria")}
        onShowFlashcards={() => goToSection("flashcards")}
        formatAccuracy={formatAccuracy}
        sectionCount={SECTIONS.length}
      />

      <SectionStrip
        sections={SECTIONS}
        activeSectionId={activeSection.id}
        onSelect={goToSection}
      />

      <div className="dashboard">
        <main className="practice-column">
          {activeSection.id === "teoria" ? (
            <TheoryPanel topics={THEORY_TOPICS} onJumpToPractice={goToSection} />
          ) : activeSection.id === "flashcards" ? (
            <FlashcardsPanel
              activeFlashcard={activeFlashcard}
              decks={FLASHCARD_DECKS}
              flashcardDeck={flashcardDeck}
              flashcardIndex={flashcardIndex}
              isRevealed={appState.flashcards.revealed}
              onMove={moveFlashcard}
              onSelectDeck={selectFlashcardDeck}
              onShuffle={shuffleFlashcard}
              onToggle={toggleFlashcard}
            />
          ) : (
            <>
              <PracticeSetupPanel
                activePreset={activePreset}
                activePresetId={activePresetId}
                activeSection={activeSection}
                presets={getPresets(activeSection.id)}
                trickLessons={TRICK_LESSONS}
                onSelectPreset={selectPreset}
              />

              <PracticeArena
                activePreset={activePreset}
                answer={answer}
                cueNonce={questionCue.nonce}
                cueTone={questionCue.tone}
                feedback={feedback}
                isResolved={feedback?.kind === "resolved"}
                isWarning={feedback?.kind === "warning"}
                keypadRows={KEYPAD_ROWS}
                metrics={practiceMetrics}
                question={question}
                showHint={showHint}
                onKeypadPress={handleKeypadPress}
                onNextQuestion={nextQuestion}
                onRevealAnswer={revealAnswer}
                onSubmit={submitPractice}
                onToggleHint={() => setShowHint((current) => !current)}
              />

              <PracticeSupportPanel
                activePresetId={activePresetId}
                activeSection={activeSection}
                primers={getSectionPrimers(activeSection.id)}
                isTabuadaHighlighted={isTabuadaHighlighted}
              />
            </>
          )}
        </main>

        <InsightsSidebar
          history={appState.history}
          onGoToSection={goToSection}
          sectionsById={sectionsById}
          stats={appState.stats}
          formatAccuracy={formatAccuracy}
        />
      </div>
    </div>
  );
}

export default App;
