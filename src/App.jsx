import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CampaignJourney } from "./components/platform/CampaignJourney";
import { AppChrome } from "./components/platform/AppChrome";
import { HomeDashboard } from "./components/platform/HomeDashboard";
import { ReportsDashboard } from "./components/platform/ReportsDashboard";
import { SettingsDrawer } from "./components/platform/SettingsDrawer";
import { TheoryLibrary } from "./components/platform/TheoryLibrary";
import { TrainingHub } from "./components/platform/TrainingHub";
import { SessionArena } from "./components/session/SessionArena";
import { SessionSummary } from "./components/session/SessionSummary";
import { GameSection } from "./game/GameSection";
import { useTrainingSession } from "./hooks/useTrainingSession";
import { buildHomeDashboard, buildReportsDashboard } from "./lib/platform/insights";
import { getTheoryTargetForTopic, THEORY_CHAPTERS } from "./lib/platform/content";
import { getPracticeGroup } from "./lib/platform/experience";
import {
  appendAttempt,
  calculateSessionXp,
  completeSession,
  createPlatformState,
  exportPlatformData,
  loadPlatformState,
  PLATFORM_STORAGE_KEY,
  recordCampaignResult,
  savePlatformState,
  updatePlatformSettings,
} from "./lib/platform/store";

function App() {
  const initialStateRef = useRef(null);
  if (!initialStateRef.current) initialStateRef.current = loadPlatformState();

  const [platformState, setPlatformState] = useState(initialStateRef.current);
  const [activeView, setActiveView] = useState("inicio");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [arcadeOpen, setArcadeOpen] = useState(false);
  const [theoryChapterId, setTheoryChapterId] = useState(null);
  const [theoryLessonId, setTheoryLessonId] = useState(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [trainingConfig, setTrainingConfig] = useState(() => ({
    modeId: initialStateRef.current.selectedModeId ?? "sparring",
    groupId: initialStateRef.current.selectedGroupId ?? "misto",
    questionCount: initialStateRef.current.settings.questionCount ?? 15,
    campaignStage: null,
    settings: initialStateRef.current.settings,
  }));
  const [shouldBeginSession, setShouldBeginSession] = useState(false);

  useEffect(() => savePlatformState(platformState), [platformState]);

  useEffect(() => {
    document.documentElement.dataset.theme = platformState.settings.theme;
    document.documentElement.classList.toggle("reduce-motion", platformState.settings.reducedMotion);
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue("--browser-theme").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor || "#0c1024");
  }, [platformState.settings.theme, platformState.settings.reducedMotion]);

  useEffect(() => {
    function captureInstallPrompt(event) {
      event.preventDefault();
      setDeferredInstallPrompt(event);
    }

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, []);

  const handleAttempt = useCallback((attempt) => {
    setPlatformState((current) => appendAttempt(current, attempt));
  }, []);

  const handleSessionFinish = useCallback((sessionSummary, campaignStage) => {
    const xpEarned = calculateSessionXp(sessionSummary);
    const enrichedSummary = { ...sessionSummary, xpEarned };

    setPlatformState((current) => {
      let next = completeSession(current, enrichedSummary);
      if (campaignStage) {
        next = recordCampaignResult(next, campaignStage, enrichedSummary, enrichedSummary.stars);
      }
      return next;
    });
    setSummary(enrichedSummary);
  }, []);

  const trainingSession = useTrainingSession({
    config: trainingConfig,
    platformState,
    onAttempt: handleAttempt,
    onFinish: handleSessionFinish,
  });

  useEffect(() => {
    if (!shouldBeginSession) return;
    trainingSession.begin();
    setSummary(null);
    setShouldBeginSession(false);
  }, [shouldBeginSession, trainingSession.begin]);

  const homeDashboard = useMemo(() => buildHomeDashboard(platformState), [platformState]);
  const reportsDashboard = useMemo(() => buildReportsDashboard(platformState), [platformState]);
  const trainingPreview = useMemo(() => ({
    groupMastery: Object.fromEntries(
      reportsDashboard.groups.map((group) => [group.id, group.attempts ? `${group.mastery}% domínio` : "novo"]),
    ),
    adaptiveMessage: adaptiveSetupMessage(platformState, trainingConfig.groupId),
  }), [platformState, reportsDashboard.groups, trainingConfig.groupId]);

  function navigate(viewId, groupId = null) {
    if (groupId) {
      setTrainingConfig((current) => ({ ...current, groupId, campaignStage: null }));
    }
    setActiveView(viewId);
    window.scrollTo({ top: 0, behavior: platformState.settings.reducedMotion ? "auto" : "smooth" });
  }

  function updateTrainingConfig(patch) {
    setTrainingConfig((current) => ({ ...current, ...patch, campaignStage: null, chapterOrder: null }));
    setPlatformState((current) => ({
      ...current,
      selectedGroupId: patch.groupId ?? current.selectedGroupId,
      selectedModeId: patch.modeId ?? current.selectedModeId,
      settings: patch.questionCount
        ? { ...current.settings, questionCount: patch.questionCount }
        : current.settings,
    }));
  }

  function startSession(overrides = {}) {
    setTrainingConfig((current) => ({
      ...current,
      ...overrides,
      settings: platformState.settings,
    }));
    setShouldBeginSession(true);
  }

  function startCampaignStage(stage) {
    startSession({
      modeId: "campanha",
      groupId: stage.groupId,
      questionCount: stage.questionCount,
      campaignStage: stage,
    });
  }

  function practiceTheoryChapter(chapter) {
    startSession({
      modeId: "sparring",
      groupId: chapter.groupId,
      questionCount: 12,
      campaignStage: null,
      chapterOrder: chapter.order,
    });
  }

  async function installApp() {
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    setDeferredInstallPrompt(null);
  }

  function exportData() {
    const blob = new Blob([exportPlatformData(platformState)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `calculo-mental-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function resetProgress() {
    const confirmed = window.confirm("Apagar todo o progresso, recordes e histórico deste navegador?");
    if (!confirmed) return;
    window.localStorage.removeItem(PLATFORM_STORAGE_KEY);
    const next = createPlatformState();
    initialStateRef.current = next;
    setPlatformState(next);
    setTrainingConfig({
      modeId: "sparring",
      groupId: "misto",
      questionCount: 15,
      campaignStage: null,
      settings: next.settings,
    });
    setSettingsOpen(false);
  }

  if (arcadeOpen) {
    return <GameSection onExit={() => setArcadeOpen(false)} />;
  }

  if (summary) {
    return (
      <SessionSummary
        summary={summary}
        onRetry={() => startSession()}
        onReviewTheory={(topicId) => {
          const target = getTheoryTargetForTopic(topicId);
          setTheoryChapterId(target?.chapterId ?? null);
          setTheoryLessonId(target?.lessonId ?? null);
          setSummary(null);
          navigate("teoria");
        }}
        onClose={() => {
          setSummary(null);
          navigate("relatorios");
        }}
      />
    );
  }

  if (trainingSession.active && trainingSession.session) {
    return (
      <SessionArena
        answer={trainingSession.answer}
        feedback={trainingSession.feedback}
        nudge={trainingSession.nudge}
        onAnswerKey={trainingSession.handleAnswerKey}
        onExit={trainingSession.exit}
        onPause={trainingSession.pause}
        onResume={trainingSession.resume}
        paused={trainingSession.paused}
        remainingMs={trainingSession.remainingMs}
        remainingRatio={trainingSession.remainingRatio}
        session={trainingSession.session}
      />
    );
  }

  return (
    <AppChrome
      activeView={activeView}
      onNavigate={navigate}
      onOpenSettings={() => setSettingsOpen(true)}
      profile={platformState.profile}
    >
      {activeView === "inicio" ? (
        <HomeDashboard
          dashboard={homeDashboard}
          onNavigate={navigate}
          onQuickStart={() => startSession({ modeId: "sparring", campaignStage: null, chapterOrder: null })}
          selectedGroupId={trainingConfig.groupId}
        />
      ) : activeView === "treinar" ? (
        <TrainingHub
          config={trainingConfig}
          onChange={updateTrainingConfig}
          onOpenArcade={() => setArcadeOpen(true)}
          onStart={() => startSession({ chapterOrder: null })}
          preview={trainingPreview}
        />
      ) : activeView === "campanha" ? (
        <CampaignJourney campaign={platformState.campaign} onStartStage={startCampaignStage} />
      ) : activeView === "teoria" ? (
        <TheoryLibrary
          chapters={THEORY_CHAPTERS}
          initialChapterId={theoryChapterId}
          initialLessonId={theoryLessonId}
          onPractice={practiceTheoryChapter}
        />
      ) : (
        <ReportsDashboard
          report={reportsDashboard}
          onTrainGroup={(groupId) => navigate("treinar", groupId)}
        />
      )}

      {settingsOpen ? (
        <SettingsDrawer
          installAvailable={Boolean(deferredInstallPrompt)}
          onClose={() => setSettingsOpen(false)}
          onExport={exportData}
          onInstall={installApp}
          onReset={resetProgress}
          onUpdate={(patch) => setPlatformState((current) => updatePlatformSettings(current, patch))}
          settings={platformState.settings}
        />
      ) : null}
    </AppChrome>
  );
}

function adaptiveSetupMessage(state, groupId) {
  const group = getPracticeGroup(groupId);
  const relevant = state.attempts.filter((attempt) => group.sectionIds.includes(attempt.sectionId)).slice(0, 16);
  if (!relevant.length) return "Começa leve, aprende seu ritmo e mistura exercícios reconhecíveis do livro.";
  const accuracy = relevant.filter((attempt) => attempt.correct).length / relevant.length;
  if (accuracy < 0.62) return "Vou aliviar um pouco, reforçar padrões recorrentes e devolver confiança antes de subir.";
  if (accuracy > 0.88) return "Seu desempenho recente está forte; espere menos tempo e contas um passo mais difíceis.";
  return "O nível atual está saudável. Vou alternar revisão, novidade e exemplos do livro.";
}

export default App;
