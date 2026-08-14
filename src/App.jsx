import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CampaignJourney } from "./components/platform/CampaignJourney";
import { AppChrome } from "./components/platform/AppChrome";
import { HomeDashboard } from "./components/platform/HomeDashboard";
import { ReportsDashboard } from "./components/platform/ReportsDashboard";
import { SettingsDrawer } from "./components/platform/SettingsDrawer";
import { TheoryLibrary } from "./components/platform/TheoryLibrary";
import { TrainingHub } from "./components/platform/TrainingHub";
import { SessionArena } from "./components/session/SessionArena";
import { SessionSummary } from "./components/session/SessionSummary";
import { useTrainingSession } from "./hooks/useTrainingSession";
import { buildHomeDashboard, buildReportsDashboard } from "./lib/platform/insights";
import { getTheoryTargetForTopic, loadTheoryChapters, preloadPracticeContent } from "./lib/platform/content";
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
import {
  createTrainingConfigSnapshot,
  getTrainingStartupIntent,
  markTrainingStarted,
  rememberTrainingSelection,
} from "./lib/platform/trainingResume";

const LazyGameSection = lazy(() => import("./game/GameSection").then((module) => ({ default: module.GameSection })));

function App() {
  const initialStateRef = useRef(null);
  if (!initialStateRef.current) initialStateRef.current = loadPlatformState();
  const startupIntentRef = useRef(undefined);
  if (startupIntentRef.current === undefined) {
    startupIntentRef.current = getTrainingStartupIntent(initialStateRef.current);
  }

  const [platformState, setPlatformState] = useState(initialStateRef.current);
  const [activeView, setActiveView] = useState(() => startupIntentRef.current?.viewId ?? "inicio");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [arcadeOpen, setArcadeOpen] = useState(false);
  const [theoryChapterId, setTheoryChapterId] = useState(null);
  const [theoryLessonId, setTheoryLessonId] = useState(null);
  const [theoryChapters, setTheoryChapters] = useState([]);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [trainingConfig, setTrainingConfig] = useState(() => createInitialTrainingConfig(
    initialStateRef.current,
    startupIntentRef.current?.config,
  ));
  const trainingConfigRef = useRef(trainingConfig);
  trainingConfigRef.current = trainingConfig;
  const [sessionConfig, setSessionConfig] = useState(null);
  const [sessionStartRequest, setSessionStartRequest] = useState(null);
  const [sessionStarting, setSessionStarting] = useState(false);
  const sessionStartSequenceRef = useRef(0);
  const pendingSessionStartRef = useRef(null);
  const launchedSessionStartRef = useRef(null);

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

  useEffect(() => {
    if (activeView !== "teoria" || theoryChapters.length) return undefined;
    let cancelled = false;
    loadTheoryChapters()
      .then((chapters) => {
        if (!cancelled) setTheoryChapters(chapters);
      })
      .catch((error) => {
        console.error("Não foi possível carregar as técnicas.", error);
      });
    return () => { cancelled = true; };
  }, [activeView, theoryChapters.length]);

  useEffect(() => {
    if (!["treinar", "campanha"].includes(activeView)) return;
    preloadPracticeContent().catch((error) => {
      console.error("Não foi possível pré-carregar os exercícios.", error);
    });
  }, [activeView]);

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
    config: sessionConfig ?? trainingConfig,
    platformState,
    onAttempt: handleAttempt,
    onFinish: handleSessionFinish,
  });

  useEffect(() => {
    if (!sessionStartRequest) return;
    const { config: requestedConfig, id, remember } = sessionStartRequest;
    if (launchedSessionStartRef.current === id) return;
    launchedSessionStartRef.current = id;

    void trainingSession.begin()
      .then((started) => {
        if (!started || pendingSessionStartRef.current?.id !== id) return;
        completePendingSessionStart(id);
        if (remember) {
          setPlatformState((current) => markTrainingStarted(current, requestedConfig));
        }
      })
      .catch((error) => {
        if (pendingSessionStartRef.current?.id !== id) return;
        completePendingSessionStart(id);
        trainingSession.cancelPendingBegin();
        console.error("Não foi possível iniciar a sessão.", error);
      });
  }, [sessionStartRequest, trainingSession.begin, trainingSession.cancelPendingBegin]);

  const homeDashboard = useMemo(() => buildHomeDashboard(platformState), [platformState]);
  const reportsDashboard = useMemo(() => buildReportsDashboard(platformState), [platformState]);
  const trainingPreview = useMemo(() => ({
    groupMastery: Object.fromEntries(
      reportsDashboard.groups.map((group) => [group.id, group.attempts ? `${group.mastery}% domínio` : "novo"]),
    ),
    adaptiveMessage: adaptiveSetupMessage(platformState, trainingConfig.groupId),
  }), [platformState, reportsDashboard.groups, trainingConfig.groupId]);

  function navigate(viewId, groupId = null) {
    cancelPendingSessionStart();
    if (groupId) {
      updateTrainingConfig({
        practiceKind: "adaptive",
        groupId,
      });
    }
    setActiveView(viewId);
    window.scrollTo({ top: 0, behavior: platformState.settings.reducedMotion ? "auto" : "smooth" });
  }

  function updateTrainingConfig(patch) {
    cancelPendingSessionStart();
    const nextConfig = {
      ...trainingConfigRef.current,
      ...patch,
      campaignStage: null,
      chapterOrder: null,
      theoryTopicIds: null,
      sectionIds: null,
      sourceChapterOrder: null,
    };
    trainingConfigRef.current = nextConfig;
    setTrainingConfig(nextConfig);
    setPlatformState((current) => rememberTrainingSelection({
      ...current,
      selectedGroupId: patch.groupId ?? current.selectedGroupId,
      selectedModeId: patch.modeId ?? current.selectedModeId,
      settings: patch.questionCount || patch.timeProfileId || patch.practiceKind || patch.memorization
        ? persistTrainingSettings(current.settings, patch)
        : current.settings,
    }, nextConfig));
  }

  function startSession(overrides = {}) {
    if (pendingSessionStartRef.current) return;
    const effectiveConfig = {
      ...trainingConfigRef.current,
      ...overrides,
      settings: trainingConfigRef.current.settings,
    };
    const request = {
      id: sessionStartSequenceRef.current + 1,
      config: effectiveConfig,
      remember: !isContextualTraining(effectiveConfig),
    };
    sessionStartSequenceRef.current = request.id;
    pendingSessionStartRef.current = request;
    void trainingSession.unlockAudio(effectiveConfig);
    setSessionConfig(effectiveConfig);
    setSessionStartRequest(request);
    setSessionStarting(true);
    setSummary(null);
  }

  function completePendingSessionStart(requestId) {
    if (pendingSessionStartRef.current?.id !== requestId) return;
    pendingSessionStartRef.current = null;
    if (launchedSessionStartRef.current === requestId) launchedSessionStartRef.current = null;
    setSessionStartRequest(null);
    setSessionStarting(false);
  }

  function cancelPendingSessionStart() {
    if (!pendingSessionStartRef.current) return false;
    pendingSessionStartRef.current = null;
    launchedSessionStartRef.current = null;
    sessionStartSequenceRef.current += 1;
    trainingSession.cancelPendingBegin();
    setSessionConfig(null);
    setSessionStartRequest(null);
    setSessionStarting(false);
    return true;
  }

  function updateSettings(patch) {
    setPlatformState((current) => updatePlatformSettings(current, patch));
    const nextTrainingConfig = {
      ...trainingConfigRef.current,
      settings: { ...trainingConfigRef.current.settings, ...patch },
    };
    trainingConfigRef.current = nextTrainingConfig;
    setTrainingConfig(nextTrainingConfig);
    setSessionConfig((current) => current ? {
      ...current,
      settings: { ...current.settings, ...patch },
    } : current);
  }

  function startCampaignStage(stage) {
    startSession({
      practiceKind: "adaptive",
      modeId: "campanha",
      groupId: stage.groupId,
      questionCount: stage.questionCount,
      campaignStage: stage,
      theoryTopicIds: null,
      sectionIds: null,
      sourceChapterOrder: null,
    });
  }

  function practiceTheoryChapter(chapter) {
    const canonicalChapterOrder = chapter.sourceKind === "full-book" ? null : chapter.order;
    startSession({
      practiceKind: "adaptive",
      modeId: "sparring",
      groupId: chapter.groupId,
      questionCount: 12,
      campaignStage: null,
      chapterOrder: canonicalChapterOrder,
      theoryTopicIds: chapter.theoryTopicIds ?? chapter.topics?.map((topic) => topic.id) ?? null,
      sectionIds: chapter.sourceKind === "full-book" ? chapter.sectionIds : null,
      sourceChapterOrder: chapter.sourceKind === "full-book" ? chapter.sourceOrder : null,
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
    cancelPendingSessionStart();
    trainingSession.cancelPendingBegin();
    window.localStorage.removeItem(PLATFORM_STORAGE_KEY);
    const next = createPlatformState();
    initialStateRef.current = next;
    startupIntentRef.current = null;
    setPlatformState(next);
    const nextTrainingConfig = createInitialTrainingConfig(next);
    trainingConfigRef.current = nextTrainingConfig;
    setTrainingConfig(nextTrainingConfig);
    setSessionConfig(null);
    setSessionStartRequest(null);
    setSessionStarting(false);
    setActiveView("inicio");
    setSummary(null);
    setTheoryChapterId(null);
    setTheoryLessonId(null);
    setSettingsOpen(false);
  }

  if (arcadeOpen) {
    return (
      <Suspense fallback={<main className="summary-screen"><p>Preparando o arcade…</p></main>}>
        <LazyGameSection onExit={() => setArcadeOpen(false)} />
      </Suspense>
    );
  }

  if (summary) {
    return (
      <SessionSummary
        summary={summary}
        onRetry={() => startSession(sessionConfig ?? {})}
        onReviewTheory={async (topicId) => {
          const target = await getTheoryTargetForTopic(topicId);
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
        audioSettings={platformState.settings}
        feedback={trainingSession.feedback}
        levelNotice={trainingSession.levelNotice}
        nudge={trainingSession.nudge}
        onAnswerKey={trainingSession.handleAnswerKey}
        onAudioSettingsChange={updateSettings}
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
          onQuickStart={() => startSession({
            practiceKind: "adaptive",
            modeId: "sparring",
            campaignStage: null,
            chapterOrder: null,
            theoryTopicIds: null,
            sectionIds: null,
            sourceChapterOrder: null,
          })}
          selectedGroupId={trainingConfig.groupId}
        />
      ) : activeView === "treinar" ? (
        <TrainingHub
          config={trainingConfig}
          onChange={updateTrainingConfig}
          onOpenArcade={() => {
            cancelPendingSessionStart();
            setArcadeOpen(true);
          }}
          onStart={() => startSession({
            chapterOrder: null,
            theoryTopicIds: null,
            sectionIds: null,
            sourceChapterOrder: null,
          })}
          preview={trainingPreview}
          starting={sessionStarting}
        />
      ) : activeView === "campanha" ? (
        <CampaignJourney campaign={platformState.campaign} onStartStage={startCampaignStage} />
      ) : activeView === "teoria" ? (
        <TheoryLibrary
          chapters={theoryChapters}
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
          onUpdate={updateSettings}
          settings={platformState.settings}
        />
      ) : null}
    </AppChrome>
  );
}

function adaptiveSetupMessage(state, groupId) {
  const group = getPracticeGroup(groupId);
  const relevant = state.attempts.filter((attempt) => group.sectionIds.includes(attempt.sectionId)).slice(0, 16);
  if (!relevant.length) return "Começa leve, aprende seu ritmo e mistura contas já estudadas com variações novas.";
  const accuracy = relevant.filter((attempt) => attempt.correct).length / relevant.length;
  if (accuracy < 0.62) return "Vou aliviar um pouco, reforçar padrões recorrentes e devolver confiança antes de subir.";
  if (accuracy > 0.88) return "Seu desempenho recente está forte; espere contas um passo mais difíceis, no perfil de tempo que você escolheu.";
  return "O nível atual está saudável. Vou alternar revisão, novidade e padrões já conhecidos.";
}

function createInitialTrainingConfig(state, resumedConfig = null) {
  const settings = state.settings;
  const persisted = createTrainingConfigSnapshot(resumedConfig ?? {
    practiceKind: settings.practiceKind,
    modeId: state.selectedModeId,
    groupId: state.selectedGroupId,
    questionCount: settings.questionCount,
    timeProfileId: settings.timeProfileId,
    memorization: {
      operationId: settings.memorizationOperationId,
      presetId: settings.memorizationPresetId,
      presetIds: settings.memorizationPresetIds,
      difficultyMode: settings.memorizationDifficultyMode,
      difficultyTier: settings.memorizationDifficultyTier,
    },
  });
  return {
    ...persisted,
    campaignStage: null,
    theoryTopicIds: null,
    sectionIds: null,
    sourceChapterOrder: null,
    settings,
  };
}

function persistTrainingSettings(settings, patch) {
  return {
    ...settings,
    ...(patch.questionCount ? { questionCount: patch.questionCount } : {}),
    ...(patch.timeProfileId ? { timeProfileId: patch.timeProfileId } : {}),
    ...(patch.practiceKind ? { practiceKind: patch.practiceKind } : {}),
    ...(patch.memorization ? {
      memorizationOperationId: patch.memorization.operationId,
      memorizationPresetId: patch.memorization.presetId,
      memorizationPresetIds: patch.memorization.operationId === "multiplication"
        ? patch.memorization.presetIds
        : [],
      memorizationDifficultyMode: patch.memorization.difficultyMode,
      memorizationDifficultyTier: patch.memorization.difficultyTier,
    } : {}),
  };
}

function isContextualTraining(config) {
  return Boolean(
    config.campaignStage
    || config.chapterOrder
    || config.theoryTopicIds
    || config.sectionIds
    || config.sourceChapterOrder,
  );
}

export default App;
