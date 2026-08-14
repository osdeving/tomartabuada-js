import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CampaignJourney } from "./components/platform/CampaignJourney";
import { AppChrome } from "./components/platform/AppChrome";
import { CommunityHub } from "./components/platform/CommunityHub";
import { HomeDashboard } from "./components/platform/HomeDashboard";
import { ReportsDashboard } from "./components/platform/ReportsDashboard";
import { SettingsDrawer } from "./components/platform/SettingsDrawer";
import { TheoryLibrary } from "./components/platform/TheoryLibrary";
import { TrainingHub } from "./components/platform/TrainingHub";
import { SessionArena } from "./components/session/SessionArena";
import { SessionSummary } from "./components/session/SessionSummary";
import { useTrainingSession } from "./hooks/useTrainingSession";
import { useCommunity } from "./hooks/useCommunity";
import { selectActorPlatformState } from "./lib/platform/actorState.js";
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
  const community = useCommunity();
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
  const [sessionActorId, setSessionActorId] = useState(null);
  const [queuedDisputeId, setQueuedDisputeId] = useState(null);
  const sessionCommunityContextRef = useRef(null);
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
    const communityContext = sessionCommunityContextRef.current;
    const canCreditCommunity = Boolean(
      communityContext?.userId
      && communityContext.userId === sessionSummary.userId,
    );
    const communityContribution = canCreditCommunity
      ? {
          clanName: communityContext.clanName,
          clanTag: communityContext.clanTag,
          disputeId: communityContext.disputeId,
          points: Math.max(0, Math.round(Number(sessionSummary.score) || 0)),
          status: "pending",
        }
      : null;
    const storedSummary = { ...sessionSummary, xpEarned };
    const enrichedSummary = { ...storedSummary, communityContribution };

    if (communityContext?.disputeId) {
      setQueuedDisputeId((current) => current === communityContext.disputeId ? null : current);
    }

    setPlatformState((current) => {
      if (storedSummary.id && current.sessions.some((session) => session.id === storedSummary.id)) {
        return current;
      }
      let next = completeSession(current, storedSummary);
      if (campaignStage) {
        next = recordCampaignResult(next, campaignStage, storedSummary, storedSummary.stars);
      }
      return next;
    });
    setSummary(enrichedSummary);

    if (communityContribution) {
      void creditCommunitySession(community.recordTrainingPoints, {
        disputeId: communityContext.disputeId,
        points: communityContribution.points,
        sessionId: sessionSummary.id,
      }).then((receipt) => {
        setSummary((current) => current?.id === sessionSummary.id
          ? {
              ...current,
              communityContribution: {
                ...current.communityContribution,
                ...receipt,
              },
            }
          : current);
      });
    }
  }, [community.recordTrainingPoints]);

  const trainingSession = useTrainingSession({
    actorId: sessionActorId,
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

  const actorPlatformState = useMemo(() => {
    const actorState = selectActorPlatformState(platformState, community.currentUser?.id ?? null);
    if (!community.currentUser) return actorState;
    return {
      ...actorState,
      profile: {
        ...actorState.profile,
        displayName: community.currentUser.displayName,
      },
    };
  }, [community.currentUser, platformState]);
  const homeDashboard = useMemo(() => buildHomeDashboard(actorPlatformState), [actorPlatformState]);
  const reportsDashboard = useMemo(() => buildReportsDashboard(actorPlatformState), [actorPlatformState]);
  const trainingPreview = useMemo(() => ({
    groupMastery: Object.fromEntries(
      reportsDashboard.groups.map((group) => [group.id, group.attempts ? `${group.mastery}% domínio` : "novo"]),
    ),
    adaptiveMessage: adaptiveSetupMessage(actorPlatformState, trainingConfig.groupId),
  }), [actorPlatformState, reportsDashboard.groups, trainingConfig.groupId]);
  const queuedDispute = community.disputes.find((dispute) => (
    dispute.id === queuedDisputeId && dispute.status === "active"
  )) ?? null;

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
    const communityContext = buildSessionCommunityContext(
      community.currentUser,
      community.clans,
      community.disputes,
      queuedDisputeId,
    );
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
    sessionCommunityContextRef.current = communityContext;
    setSessionActorId(communityContext?.userId ?? null);
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
    sessionCommunityContextRef.current = null;
    setSessionActorId(null);
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

  function playCommunityDispute(dispute) {
    setQueuedDisputeId(dispute.id);
    navigate("treinar");
  }

  async function finishCommunityDispute(disputeId) {
    const result = await community.finishDispute(disputeId);
    if (queuedDisputeId === disputeId) setQueuedDisputeId(null);
    return result;
  }

  async function logoutCommunity() {
    const result = await community.logout();
    setQueuedDisputeId(null);
    sessionCommunityContextRef.current = null;
    setSessionActorId(null);
    return result;
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
    setQueuedDisputeId(null);
    sessionCommunityContextRef.current = null;
    setSessionActorId(null);
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
      profile={actorPlatformState.profile}
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
        <>
          {queuedDispute ? (
            <DisputeTrainingBanner
              dispute={queuedDispute}
              onCancel={() => setQueuedDisputeId(null)}
            />
          ) : null}
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
        </>
      ) : activeView === "campanha" ? (
        <CampaignJourney campaign={actorPlatformState.campaign} onStartStage={startCampaignStage} />
      ) : activeView === "clas" ? (
        <CommunityHub
          availableOpponents={community.availableOpponents}
          clans={community.clans}
          currentUser={community.currentUser}
          demoAccounts={community.demoAccounts}
          disputes={community.disputes}
          error={community.error}
          members={community.members}
          onCreateDispute={community.createDispute}
          onCreateTeam={community.createTeam}
          onFinishDispute={finishCommunityDispute}
          onLogin={community.login}
          onLogout={logoutCommunity}
          onPlayDispute={playCommunityDispute}
          onRetry={community.refresh}
          onSelectClan={community.selectClan}
          selectedClanId={community.selectedClanId}
          sourceLabel={community.sourceLabel}
          status={community.status}
          teams={community.teams}
        />
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

function DisputeTrainingBanner({ dispute, onCancel }) {
  return (
    <aside className="surface community-training-banner" aria-live="polite">
      <span className="community-versus" aria-hidden="true">VS</span>
      <div>
        <p className="eyebrow">Próxima sessão vale pela disputa</p>
        <strong>{dispute.homeTeam?.name} × {dispute.awayTeam?.name}</strong>
        <small>Os pontos desta rodada entram no seu clã e no placar do confronto.</small>
      </div>
      <button className="button button--quiet" type="button" onClick={onCancel}>Cancelar</button>
    </aside>
  );
}

function buildSessionCommunityContext(currentUser, clans, disputes, queuedDisputeId) {
  if (!currentUser?.id) return null;
  const clan = clans.find((candidate) => candidate.id === currentUser.clanId);
  const dispute = disputes.find((candidate) => (
    candidate.id === queuedDisputeId
    && candidate.status === "active"
    && (teamContainsUser(candidate.homeTeam, currentUser.id)
      || teamContainsUser(candidate.awayTeam, currentUser.id))
  ));

  return {
    userId: currentUser.id,
    clanId: currentUser.clanId ?? null,
    clanName: clan?.name ?? "seu clã",
    clanTag: clan?.tag ?? null,
    disputeId: dispute?.id ?? null,
  };
}

async function creditCommunitySession(recordTrainingPoints, command) {
  try {
    const result = await recordTrainingPoints(command);
    return {
      counted: result?.created !== false,
      disputeScored: Boolean(command.disputeId && result?.dispute),
      status: "credited",
    };
  } catch (error) {
    if (command.disputeId && ["DISPUTE_CLOSED", "FORBIDDEN", "NOT_FOUND"].includes(error?.code)) {
      try {
        const fallback = await recordTrainingPoints({
          points: command.points,
          sessionId: command.sessionId,
        });
        return {
          counted: fallback?.created !== false,
          disputeId: null,
          disputeScored: false,
          message: "O confronto já não aceitava rodadas; os pontos ainda foram somados ao clã.",
          status: "credited",
        };
      } catch (fallbackError) {
        return { message: fallbackError?.message, status: "failed" };
      }
    }
    return { message: error?.message, status: "failed" };
  }
}

function teamContainsUser(team, userId) {
  const members = team?.memberIds ?? team?.members ?? [];
  return members.some((member) => (typeof member === "object" ? member.id : member) === userId);
}

export default App;
