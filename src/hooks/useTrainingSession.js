import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPracticeSession,
  finishPracticeSession,
  pausePracticeSession,
  recordSessionAttempt,
  resumePracticeSession,
} from "../lib/adaptive";
import { getCampaignStars } from "../lib/platform/campaign";
import {
  answersMatch,
  displayAnswerInput,
  normalizeUserAnswer,
  serializeUserAnswer,
} from "../lib/platform/answers";
import {
  MEMORIZATION_OPERATIONS,
  selectMemorizationQuestion,
} from "../lib/platform/basicMemorization";
import { selectAdaptiveQuestion, THEORY_INDEX } from "../lib/platform/content";
import { getPracticeGroup, getSessionMode, getTimeProfile } from "../lib/platform/experience";
import { FEATURE_FLAGS } from "../lib/platform/features";
import {
  INSANE_MIX_GROUP_ID,
  selectInsaneMixQuestion,
} from "../lib/platform/insaneMix";
import { reduceAnswerInput } from "../lib/platform/sessionInput";
import { useTrainingAudio } from "./useTrainingAudio";

const TIME_TICK_MS = 80;
const UNTYPED_ANSWER_DELAY_MS = 1_350;

export function useTrainingSession({ actorId = null, config, platformState, onAttempt, onFinish }) {
  const {
    finishSession: finishAudioSession,
    pause: pauseAudio,
    playEffect: playAudioEffect,
    resume: resumeAudio,
    startSession: startAudioSession,
    stop: stopAudio,
    unlock: unlockTrainingAudio,
    updateSession: updateAudioSession,
  } = useTrainingAudio({
    effectsEnabled: config.settings?.soundEffects !== false,
    musicEnabled: config.settings?.music !== false,
  });
  const [runtime, setRuntime] = useState(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [nudge, setNudge] = useState(null);
  const [levelNotice, setLevelNotice] = useState(null);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(Date.now());
  const runtimeRef = useRef(runtime);
  const answerRef = useRef(answer);
  const questionStartRef = useRef(Date.now());
  const deadlineRef = useRef(null);
  const advanceTimeoutRef = useRef(null);
  const beginTokenRef = useRef(0);
  const levelNoticeTimeoutRef = useRef(null);
  const finishedRef = useRef(false);
  const gradingRef = useRef(false);
  const pausedAtRef = useRef(null);
  const recentQuestionIdsRef = useRef([]);
  const announcedLevelNoticesRef = useRef(new Set());
  const audioSessionPrimedRef = useRef(false);
  const tickDeadlineRef = useRef(null);
  const tickSecondRef = useRef(null);
  const learnerPlatformState = useMemo(
    () => selectActorTrainingState(platformState, actorId),
    [actorId, platformState],
  );

  useEffect(() => { runtimeRef.current = runtime; }, [runtime]);
  useEffect(() => { answerRef.current = answer; }, [answer]);

  const showLevelNotice = useCallback((question) => {
    if (!FEATURE_FLAGS.sessionProgressNotices) return;
    const tierId = question?.memorization?.difficultyTier;
    const noticeId = question?.levelCue?.code ?? tierId;
    if (!question?.levelCue || !noticeId || announcedLevelNoticesRef.current.has(noticeId)) return;
    announcedLevelNoticesRef.current.add(noticeId);
    setLevelNotice(question.levelCue);
    if (levelNoticeTimeoutRef.current) window.clearTimeout(levelNoticeTimeoutRef.current);
    levelNoticeTimeoutRef.current = window.setTimeout(
      () => setLevelNotice(null),
      question.levelCue.durationMs ?? 1_300,
    );
  }, []);

  const begin = useCallback(async () => {
    const beginToken = beginTokenRef.current + 1;
    beginTokenRef.current = beginToken;
    if (levelNoticeTimeoutRef.current) window.clearTimeout(levelNoticeTimeoutRef.current);
    finishedRef.current = false;
    gradingRef.current = false;
    recentQuestionIdsRef.current = [];
    announcedLevelNoticesRef.current = new Set();
    const adaptiveMode = config.modeId === "sobrevivencia"
      ? "survival"
      : config.modeId === "campanha"
        ? "campaign"
        : "sparring";
    const memorizationSectionId = getMemorizationOperation(config.memorization?.operationId).sectionId;
    const difficultyGroupId = config.practiceKind === "memorization"
      ? memorizationSectionId
      : config.groupId;
    const difficulty = config.campaignStage
      ? Math.max(1, Math.min(10, config.campaignStage.order))
      : config.groupId === INSANE_MIX_GROUP_ID
        ? 1
        : inferStartingDifficulty(learnerPlatformState.attempts, difficultyGroupId);
    const groupIds = config.practiceKind === "memorization"
      ? [memorizationSectionId]
      : getPracticeGroup(config.groupId).sectionIds;
    const adaptiveSession = createPracticeSession({
      id: createTrainingSessionId(),
      mode: adaptiveMode,
      groupIds,
      difficulty,
      lives: 3,
      inputMode: "custom-keypad",
      userId: actorId ?? undefined,
    });
    const question = applyTimeProfile(
      await selectQuestion({
        adaptiveSession,
        config,
        platformState: learnerPlatformState,
        recentQuestionIds: [],
      }),
      config,
    );
    if (beginToken !== beginTokenRef.current) return false;
    if (!question) throw new Error("Nenhuma conta corresponde a esta configuração.");
    const startedAt = Date.now();

    questionStartRef.current = startedAt;
    deadlineRef.current = question.deadlineWindowMs == null
      ? null
      : startedAt + question.deadlineWindowMs;
    answerRef.current = "";
    setNow(startedAt);
    setAnswer("");
    setFeedback(null);
    setNudge(null);
    setLevelNotice(null);
    showLevelNotice(question);
    setPaused(false);
    setRuntime({
      adaptiveSession,
      question,
      answered: 0,
      correct: 0,
      wrong: 0,
      startedAt,
      sessionDeadline: config.modeId === "sprint" ? startedAt + 60_000 : null,
      bestCombo: 0,
    });
    tickDeadlineRef.current = null;
    tickSecondRef.current = null;
    const audioState = buildTrainingAudioState(config, adaptiveSession, question);
    if (audioSessionPrimedRef.current) {
      audioSessionPrimedRef.current = false;
      updateAudioSession(audioState);
    } else {
      startAudioSession(audioState);
    }
    return true;
  }, [actorId, config, learnerPlatformState, showLevelNotice, startAudioSession, updateAudioSession]);

  const unlockAudio = useCallback((nextConfig = config) => {
    audioSessionPrimedRef.current = true;
    startAudioSession(buildTrainingAudioState(nextConfig));
    return unlockTrainingAudio();
  }, [config, startAudioSession, unlockTrainingAudio]);

  const cancelPendingBegin = useCallback(() => {
    beginTokenRef.current += 1;
    audioSessionPrimedRef.current = false;
    stopAudio();
  }, [stopAudio]);

  useEffect(() => {
    if (!runtime || paused || finishedRef.current) return undefined;
    if (!runtime.sessionDeadline && deadlineRef.current == null) return undefined;

    const intervalId = window.setInterval(() => setNow(Date.now()), TIME_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [runtime, paused]);

  useEffect(() => {
    if (!runtime || paused || feedback || finishedRef.current) return;

    if (runtime.sessionDeadline && now >= runtime.sessionDeadline) {
      finalize(runtime);
      return;
    }

    if (runtime.question && deadlineRef.current != null && now >= deadlineRef.current) {
      gradeAnswer(answerRef.current, true);
    }
  }, [now, runtime, paused, feedback]);

  useEffect(() => () => {
    beginTokenRef.current += 1;
    if (advanceTimeoutRef.current) window.clearTimeout(advanceTimeoutRef.current);
    if (levelNoticeTimeoutRef.current) window.clearTimeout(levelNoticeTimeoutRef.current);
  }, []);

  const gradeAnswer = useCallback((rawAnswer, timedOut = false) => {
    const current = runtimeRef.current;
    if (!current?.question || feedback || paused || finishedRef.current || gradingRef.current) return;
    gradingRef.current = true;

    const question = current.question;
    const answeredAt = Date.now();
    const deadlineExpired = deadlineRef.current != null && answeredAt > deadlineRef.current;
    const sessionExpired = current.sessionDeadline != null && answeredAt >= current.sessionDeadline;
    const effectiveTimeout = timedOut || deadlineExpired || sessionExpired;
    const normalized = normalizeUserAnswer(rawAnswer, question);
    const serializedAnswer = serializeUserAnswer(normalized);
    const correct = !effectiveTimeout && normalized != null && answersMatch(normalized, question);
    const responseTimeMs = Math.max(1, answeredAt - questionStartRef.current);
    const result = recordSessionAttempt(
      current.adaptiveSession,
      {
        questionId: question.questionId,
        sectionId: question.sectionId,
        groupId: question.groupId,
        presetId: question.presetId,
        patternKey: question.patternKey,
        patternTags: question.patternTags,
        skillKey: question.skillKey,
        theoryTopicId: question.theoryTopicId,
        correct,
        timedOut: effectiveTimeout,
        responseTimeMs,
        responseWindowMs: question.targetResponseMs ?? question.responseWindowMs,
        difficulty: question.difficulty,
        source: question.source,
        sourceId: question.sourceId,
        sourceDocumentId: question.sourceDocumentId,
        metadata: {
          practiceKind: config.practiceKind ?? "adaptive",
          timeProfileId: config.timeProfileId ?? "calmo",
          memorizationOperation: question.memorization?.operation ?? config.memorization?.operationId ?? "",
          trainingPreset: memorizationScopeKey(config.memorization),
          complexityBand: question.memorization?.difficultyTier ?? "",
          memorizationDifficultyMode: config.memorization?.difficultyMode ?? "adaptive",
          memorizationDifficultyTier: config.memorization?.difficultyTier ?? "all",
          deadlineWindowMs: question.deadlineWindowMs ?? 0,
          difficultyRating: Number(question.difficultyRating) || 0,
          patternGroupId: question.patternGroupId ?? "",
          generatorId: question.generatorId ?? "",
          patternFeatures: (question.features ?? []).join("|"),
          patternOperations: (question.operations ?? []).join("|"),
        },
        answerGiven: serializedAnswer,
        expectedAnswer: question.answer,
        timestamp: answeredAt,
      },
      {
        previousSessions: learnerPlatformState.sessions,
        baselineAttempts: learnerPlatformState.attempts,
        theoryIndex: THEORY_INDEX,
        now: answeredAt,
      },
    );
    const messages = result.event.messages ?? [];
    const comboMessage = messages.find((message) => message.type === "combo" || message.type === "personal-record");
    const coachMessage = messages.find((message) =>
      message.type === "theory-suggestion" ||
      (message.type === "rest-suggestion" && config.settings.autoRestCoach),
    );
    const attempt = {
      ...result.event.attempt,
      prompt: question.prompt,
      promptLatex: question.promptLatex,
      expectedAnswer: question.answer,
      givenAnswer: normalized,
      answeredAt,
      combo: result.event.combo,
      scoreDelta: result.event.scoreDelta,
      chapter: question.chapter,
      sourceChapterOrder: question.sourceChapterOrder,
      sourceDocumentId: question.sourceDocumentId,
      page: question.page,
      practiceKind: config.practiceKind ?? "adaptive",
      timeProfileId: config.timeProfileId ?? "calmo",
      targetResponseMs: question.targetResponseMs ?? question.responseWindowMs,
      deadlineWindowMs: question.deadlineWindowMs,
      memorizationOperation: question.memorization?.operation ?? config.memorization?.operationId ?? null,
      complexityBand: question.memorization?.difficultyTier ?? null,
      difficultyRating: Number(question.difficultyRating) || null,
      patternGroupId: question.patternGroupId ?? null,
      generatorId: question.generatorId ?? null,
      patternFeatures: question.features ?? question.patternTags ?? [],
      patternOperations: question.operations ?? [],
      answerGiven: serializedAnswer,
      givenAnswer: serializedAnswer,
    };

    onAttempt(attempt);
    provideHapticFeedback(correct, config.settings);
    const comboMilestone = correct && result.event.combo >= 5 && result.event.combo % 5 === 0;
    playAudioEffect(comboMilestone ? "combo" : correct ? "correct" : "wrong", {
      combo: result.event.combo,
      voiceCue: comboMilestone
        ? "congratulations"
        : correct && result.event.combo === 3
          ? "correct"
          : !correct && current.wrong === 0
            ? "wrong"
            : false,
    });
    setFeedback({
      tone: correct ? "success" : "danger",
      title: effectiveTimeout ? "Tempo esgotado" : correct ? comboMessage?.message ?? correctMessage(result.event.combo) : "Quase — ajuste o padrão",
      detail: correct
        ? `${formatTime(responseTimeMs)} · +${result.event.scoreDelta} pontos`
        : `Resposta: ${question.answerDisplay ?? question.answer}`,
    });
    if (FEATURE_FLAGS.sessionProgressNotices && coachMessage) {
      setNudge({
        kind: coachMessage.type === "rest-suggestion" ? "rest" : "theory",
        title: coachMessage.type === "rest-suggestion" ? "Seu ritmo mudou." : "Este padrão está se repetindo.",
        detail: coachMessage.message,
        topicId: coachMessage.topicId,
      });
    }

    const nextRuntime = {
      ...current,
      adaptiveSession: result.session,
      answered: current.answered + 1,
      correct: current.correct + (correct ? 1 : 0),
      wrong: current.wrong + (correct ? 0 : 1),
      bestCombo: Math.max(current.bestCombo, result.event.bestCombo),
    };
    runtimeRef.current = nextRuntime;
    setRuntime(nextRuntime);

    advanceTimeoutRef.current = window.setTimeout(async () => {
      const latest = runtimeRef.current;
      if (!latest || finishedRef.current) return;

      const shouldFinish =
        latest.adaptiveSession.status === "game-over" ||
        (config.modeId === "sparring" && latest.answered >= config.questionCount) ||
        (config.modeId === "campanha"
          && latest.answered >= (config.campaignStage?.questionCount ?? config.questionCount ?? 1)) ||
        (config.modeId === "sprint" && latest.sessionDeadline && Date.now() >= latest.sessionDeadline);

      if (shouldFinish) {
        finalize(latest);
        return;
      }

      const nextRecentQuestionIds = [...new Set([
        question.questionId,
        ...(config.practiceKind === "memorization" && question.skillKey ? [question.skillKey] : []),
        ...recentQuestionIdsRef.current,
      ])].slice(0, 8);
      recentQuestionIdsRef.current = nextRecentQuestionIds;
      const nextQuestion = applyTimeProfile(
        await selectQuestion({
          adaptiveSession: latest.adaptiveSession,
          config,
          platformState: learnerPlatformState,
          recentQuestionIds: nextRecentQuestionIds,
        }),
        config,
      );
      if (finishedRef.current || !runtimeRef.current) return;
      if (!nextQuestion) {
        finalize(latest);
        return;
      }
      const startedAt = Date.now();
      const updated = { ...latest, question: nextQuestion };
      runtimeRef.current = updated;
      questionStartRef.current = startedAt;
      deadlineRef.current = nextQuestion.deadlineWindowMs == null
        ? null
        : startedAt + nextQuestion.deadlineWindowMs;
      answerRef.current = "";
      setNow(startedAt);
      setRuntime(updated);
      setAnswer("");
      setFeedback(null);
      showLevelNotice(nextQuestion);
      gradingRef.current = false;
    }, getFeedbackDelay(config));
  }, [config, feedback, learnerPlatformState, onAttempt, paused, playAudioEffect, showLevelNotice]);

  useEffect(() => {
    if (!runtime || paused || finishedRef.current) return undefined;

    function handleKeyDown(event) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const numberedChoice = /^\d$/.test(event.key)
        ? runtime.question?.choices?.[Number(event.key) - 1]
        : null;
      if (numberedChoice) {
        event.preventDefault();
        handleAnswerKey(`choice:${numberedChoice.value}`);
      } else if (/^\d$/.test(event.key) && !runtime.question?.choices?.length) {
        event.preventDefault();
        handleAnswerKey(event.key);
      } else if (event.key === "." || event.key === ",") {
        event.preventDefault();
        handleAnswerKey(".");
      } else if ((event.key === "/" && runtime.question?.answerType === "rational")
        || (/^r$/i.test(event.key) && runtime.question?.answerType === "quotient-remainder")) {
        event.preventDefault();
        handleAnswerKey("separator");
      } else if (event.key === "Backspace") {
        event.preventDefault();
        handleAnswerKey("backspace");
      } else if (event.key === "Enter") {
        event.preventDefault();
        handleAnswerKey("submit");
      } else if (event.key === "-") {
        event.preventDefault();
        handleAnswerKey("sign");
      } else if (event.key === "Escape") {
        event.preventDefault();
        handleAnswerKey("clear");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runtime, paused, gradeAnswer]);

  const handleAnswerKey = useCallback((key) => {
    const current = runtimeRef.current;
    if (!current?.question || feedback || paused) return;
    const transition = reduceAnswerInput(answerRef.current, key, current.question);
    answerRef.current = transition.value;
    setAnswer(transition.value);
    if (transition.submission) gradeAnswer(transition.value, false);
  }, [feedback, gradeAnswer, paused]);

  const pause = useCallback(() => {
    const current = runtimeRef.current;
    if (!current || paused) return;
    pausedAtRef.current = Date.now();
    const updated = { ...current, adaptiveSession: pausePracticeSession(current.adaptiveSession) };
    runtimeRef.current = updated;
    setRuntime(updated);
    setPaused(true);
    pauseAudio({ immediate: true });
  }, [pauseAudio, paused]);

  const resume = useCallback(() => {
    const current = runtimeRef.current;
    if (!current || !paused) return;
    const resumedAt = Date.now();
    const pausedDuration = resumedAt - (pausedAtRef.current ?? resumedAt);
    questionStartRef.current += pausedDuration;
    if (deadlineRef.current != null) deadlineRef.current += pausedDuration;
    const updated = {
      ...current,
      sessionDeadline: current.sessionDeadline ? current.sessionDeadline + pausedDuration : null,
      adaptiveSession: resumePracticeSession(current.adaptiveSession),
    };
    runtimeRef.current = updated;
    setRuntime(updated);
    setPaused(false);
    setNow(resumedAt);
    const audioRemainingRatio = updated.sessionDeadline
      ? Math.max(0, (updated.sessionDeadline - resumedAt) / 60_000)
      : 1;
    resumeAudio(buildTrainingAudioState(
      config,
      updated.adaptiveSession,
      updated.question,
      audioRemainingRatio,
    ));
  }, [config, paused, resumeAudio]);

  useEffect(() => {
    function pauseWhenHidden() {
      if (document.hidden && runtimeRef.current && !paused && !finishedRef.current) pause();
    }
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, [pause, paused]);

  const finalize = useCallback((providedRuntime = runtimeRef.current) => {
    if (!providedRuntime || finishedRef.current) return;
    finishedRef.current = true;
    if (advanceTimeoutRef.current) window.clearTimeout(advanceTimeoutRef.current);

    const endedAt = Date.now();
    const finished = finishPracticeSession(providedRuntime.adaptiveSession, {
      endedAt,
      previousSessions: learnerPlatformState.sessions,
      theoryIndex: THEORY_INDEX,
    });
    const attempts = finished.session.attempts;
    const correct = attempts.filter((attempt) => attempt.correct && !attempt.timedOut).length;
    const accuracy = attempts.length ? correct / attempts.length : 0;
    const correctTimes = attempts.filter((attempt) => attempt.correct && attempt.responseTimeMs != null).map((attempt) => attempt.responseTimeMs);
    const paceRatios = attempts
      .filter((attempt) => attempt.correct && attempt.responseTimeMs != null && attempt.responseWindowMs)
      .map((attempt) => attempt.responseTimeMs / attempt.responseWindowMs);
    const averagePaceRatio = paceRatios.length
      ? paceRatios.reduce((sum, value) => sum + value, 0) / paceRatios.length
      : null;
    const summaryGroupId = config.practiceKind === "memorization"
      ? getMemorizationOperation(config.memorization?.operationId).sectionId
      : config.groupId;
    const memoryScope = memorizationScopeKey(config.memorization);
    const recordKey = config.practiceKind === "memorization"
      ? `${config.modeId}:memorization:${memoryScope}:${config.timeProfileId}`
      : `${config.modeId}:${config.groupId}:${config.timeProfileId}`;
    const previousBest = previousActorBest(
      learnerPlatformState.sessions,
      recordKey,
      config.modeId,
      summaryGroupId,
    ) || (!actorId && !platformState.sessions.some((session) => session.userId)
      ? Number(platformState.records.bestScore[recordKey])
        || Number(platformState.records.bestScore[`${config.modeId}:${summaryGroupId}`])
      : 0);
    const passed = config.campaignStage ? accuracy >= config.campaignStage.targetAccuracy : true;
    const theoryRecommendation = finished.report.theoryRecommendations?.[0];
    const summary = {
      id: finished.session.id,
      userId: finished.session.userId || null,
      modeId: config.modeId,
      groupId: summaryGroupId,
      recordKey,
      practiceKind: config.practiceKind ?? "adaptive",
      timeProfileId: config.timeProfileId ?? "calmo",
      memorizationOperation: config.practiceKind === "memorization" ? config.memorization?.operationId : null,
      memorizationPresetIds: config.practiceKind === "memorization"
        ? canonicalPresetIds(config.memorization)
        : null,
      memorizationDifficultyMode: config.practiceKind === "memorization"
        ? config.memorization?.difficultyMode ?? "adaptive"
        : null,
      memorizationDifficultyTier: config.practiceKind === "memorization"
        ? config.memorization?.difficultyTier ?? "all"
        : null,
      groupIds: finished.session.groupIds,
      status: finished.session.status,
      startedAt: providedRuntime.startedAt,
      endedAt,
      durationMs: endedAt - providedRuntime.startedAt,
      answered: attempts.length,
      correct,
      accuracy,
      averageResponseMs: correctTimes.length ? correctTimes.reduce((sum, value) => sum + value, 0) / correctTimes.length : null,
      bestCombo: finished.session.bestCombo,
      score: finished.session.score,
      attempts,
      passed,
      stars: getCampaignStars(accuracy),
      campaignStageId: config.campaignStage?.id ?? null,
      trainingContext: config.campaignStage
        ? "campaign"
        : isTheoryTraining(config)
          ? "theory"
          : "standard",
      isNewRecord: finished.session.score > previousBest && previousBest > 0,
      headline: passed ? headlineFor(accuracy, finished.session.bestCombo, averagePaceRatio) : "Mais uma rodada e você passa",
      message: passed
        ? messageFor(accuracy, finished.session.bestCombo, averagePaceRatio)
        : `Você chegou a ${Math.round(accuracy * 100)}%. Esta etapa pede ${Math.round(config.campaignStage.targetAccuracy * 100)}% para avançar.`,
      insight: finished.report.fatigue?.isFatigued && config.settings.autoRestCoach
        ? {
            kind: "rest",
            title: "Seu cérebro pediu intervalo",
            detail: finished.report.fatigue.message ?? "Seu ritmo caiu fora do padrão. Tome um ar e volte com a cabeça renovada.",
          }
        : theoryRecommendation
        ? { kind: "theory", topicId: theoryRecommendation.topicId, title: `Reforce “${theoryRecommendation.title}”`, detail: theoryRecommendation.reason }
        : accuracy >= 0.85 && averagePaceRatio != null && averagePaceRatio <= 0.78
          ? { kind: "progress", title: "Seu nível subiu", detail: "Precisão e ritmo indicam que você pode encarar contas um passo mais difíceis." }
          : accuracy >= 0.85
            ? { kind: "progress", title: "Precisão firme", detail: "Os acertos estão bons. Agora o treino vai repetir o que ainda demora até a resposta ficar automática." }
          : null,
    };
    finishAudioSession({
      success: passed && accuracy >= 0.7,
      timedOut: config.modeId === "sprint" && providedRuntime.sessionDeadline != null && endedAt >= providedRuntime.sessionDeadline,
      gameOver: config.modeId === "sobrevivencia" && finished.session.status === "game-over",
      isNewRecord: summary.isNewRecord,
    });
    audioSessionPrimedRef.current = false;
    onFinish(summary, config.campaignStage);
    runtimeRef.current = null;
    answerRef.current = "";
    setRuntime(null);
    setAnswer("");
    setFeedback(null);
  }, [actorId, config, finishAudioSession, learnerPlatformState.sessions, onFinish, platformState.records.bestScore, platformState.sessions]);

  const exit = useCallback(() => {
    const current = runtimeRef.current;
    if (!current) return;
    if (!current.adaptiveSession.attempts.length) {
      if (advanceTimeoutRef.current) window.clearTimeout(advanceTimeoutRef.current);
      runtimeRef.current = null;
      answerRef.current = "";
      finishedRef.current = true;
      gradingRef.current = false;
      setRuntime(null);
      setAnswer("");
      setFeedback(null);
      audioSessionPrimedRef.current = false;
      stopAudio();
      return;
    }
    finalize(current);
  }, [finalize, stopAudio]);
  const mode = getSessionMode(config.modeId);
  const group = getPracticeGroup(config.groupId);
  const memorizationOperation = getMemorizationOperation(config.memorization?.operationId);
  const timed = Boolean(runtime?.sessionDeadline || deadlineRef.current != null);
  const remainingMs = runtime
    ? runtime.sessionDeadline
      ? Math.max(0, Math.min(
          deadlineRef.current == null ? Number.POSITIVE_INFINITY : deadlineRef.current - now,
          runtime.sessionDeadline - now,
        ))
      : deadlineRef.current == null ? null : Math.max(0, deadlineRef.current - now)
    : 0;
  const questionWindowMs = runtime?.question?.deadlineWindowMs ?? runtime?.question?.responseWindowMs ?? 1;
  const remainingRatio = runtime
    ? runtime.sessionDeadline
      ? Math.max(0, (runtime.sessionDeadline - now) / 60_000)
      : remainingMs == null ? null : Math.max(0, remainingMs / questionWindowMs)
    : 0;
  const remainingSecond = remainingMs == null ? null : Math.ceil(remainingMs / 1_000);
  const audioRemainingRatio = config.modeId === "sprint" && remainingRatio <= 0.25 ? 0.2 : 1;

  useEffect(() => {
    if (!runtime || paused || finishedRef.current) return;
    updateAudioSession(buildTrainingAudioState(
      config,
      runtime.adaptiveSession,
      runtime.question,
      audioRemainingRatio,
    ));
  }, [audioRemainingRatio, config, paused, runtime, updateAudioSession]);

  useEffect(() => {
    if (!runtime || paused || feedback || finishedRef.current) return;
    const activeDeadline = runtime.sessionDeadline ?? deadlineRef.current;
    if (activeDeadline !== tickDeadlineRef.current) {
      tickDeadlineRef.current = activeDeadline;
      tickSecondRef.current = null;
    }
    if (activeDeadline == null || remainingSecond == null || remainingSecond <= 0 || remainingSecond > 5) return;
    if (tickSecondRef.current === remainingSecond) return;
    tickSecondRef.current = remainingSecond;
    playAudioEffect("tick", {
      hurry: remainingSecond === 5,
      voiceCue: remainingSecond === 5 ? "hurry" : false,
    });
  }, [feedback, paused, playAudioEffect, remainingSecond, runtime]);
  const publicSession = useMemo(() => runtime ? {
    ...runtime,
    modeId: config.modeId,
    modeLabel: mode.label,
    groupLabel: config.practiceKind === "memorization"
      ? `Memorizar · ${memorizationOperation.label}`
      : group.label,
    score: runtime.adaptiveSession.score,
    combo: runtime.adaptiveSession.currentCombo,
    lives: runtime.adaptiveSession.modeState?.lives ?? 3,
    difficultyLabel: runtime.question?.difficultyLabel
      ?? runtime.question?.memorization?.difficultyLabel
      ?? runtime.adaptiveSession.currentDifficulty,
    timeProfileLabel: config.modeId === "sprint" ? "Sprint" : getTimeProfile(config.timeProfileId).shortLabel,
    timed,
    targetCount: config.modeId === "sparring"
      ? config.questionCount
      : config.modeId === "campanha"
        ? config.campaignStage?.questionCount ?? config.questionCount ?? null
        : null,
  } : null, [runtime, config, mode.label, group.label, memorizationOperation.label, timed]);

  return {
    active: Boolean(runtime),
    answer: runtime?.question ? displayAnswerInput(answer, runtime.question) : answer,
    begin,
    cancelPendingBegin,
    exit,
    feedback,
    handleAnswerKey,
    levelNotice,
    nudge,
    pause,
    paused,
    remainingMs,
    remainingRatio,
    resume,
    session: publicSession,
    stopAudio,
    unlockAudio,
  };
}

function inferStartingDifficulty(attempts, groupId) {
  const relevant = attempts.filter((attempt) => groupId === "misto" || attempt.groupId === groupId || attempt.sectionId === groupId).slice(0, 20);
  if (!relevant.length) return 3;
  const accuracy = relevant.filter((attempt) => attempt.correct).length / relevant.length;
  const averageLevel = relevant.reduce((sum, attempt) => sum + (Number(attempt.difficulty) || 3), 0) / relevant.length;
  return Math.max(1, Math.min(10, Math.round(averageLevel + (accuracy >= 0.88 ? 1 : accuracy < 0.6 ? -1 : 0))));
}

function selectActorTrainingState(platformState, actorId) {
  const normalizedActorId = String(actorId ?? "").trim();
  const belongsToActor = (entry) => String(entry?.userId ?? "").trim() === normalizedActorId;

  return {
    ...platformState,
    attempts: platformState.attempts.filter(belongsToActor),
    sessions: platformState.sessions.filter(belongsToActor),
  };
}

function previousActorBest(sessions, recordKey, modeId, groupId) {
  return sessions.reduce((best, session) => {
    const sameRecord = session.recordKey === recordKey;
    const legacyRecord = !session.recordKey
      && session.modeId === modeId
      && session.groupId === groupId;
    return sameRecord || legacyRecord
      ? Math.max(best, Number(session.score) || 0)
      : best;
  }, 0);
}

function createTrainingSessionId() {
  if (globalThis.crypto?.randomUUID) return `session-${globalThis.crypto.randomUUID()}`;
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function selectQuestion({ adaptiveSession, config, platformState, recentQuestionIds }) {
  if (config.practiceKind === "memorization") {
    const memory = config.memorization ?? {};
    return selectMemorizationQuestion({
      operationId: memory.operationId ?? "multiplication",
      presetId: memory.presetId,
      presetIds: memory.presetIds,
      attempts: platformState.attempts,
      sessionAttempts: adaptiveSession.attempts,
      recentQuestionIds,
      difficultyMode: memory.difficultyMode ?? "adaptive",
      difficultyTier: memory.difficultyTier ?? "all",
    });
  }

  if (config.groupId === INSANE_MIX_GROUP_ID) {
    return selectInsaneMixQuestion({
      adaptiveSession,
      baselineAttempts: platformState.attempts.filter((attempt) =>
        attempt.groupId === INSANE_MIX_GROUP_ID || attempt.sectionId === INSANE_MIX_GROUP_ID),
      recentQuestionIds,
    });
  }

  return selectAdaptiveQuestion({
    attempts: adaptiveSession.attempts,
    baselineAttempts: platformState.attempts,
    chapterOrder: config.campaignStage?.order ?? config.chapterOrder ?? null,
    currentDifficulty: adaptiveSession.currentDifficulty,
    groupId: config.groupId,
    mode: config.modeId,
    recentQuestionIds,
    sectionPool: config.campaignStage?.sectionPool ?? null,
    responseScale: config.campaignStage?.responseScale ?? 1,
    theoryTopicIds: config.theoryTopicIds ?? null,
    allowedSectionIds: config.sectionIds ?? null,
    sourceChapterOrder: config.sourceChapterOrder ?? null,
  });
}

function applyTimeProfile(question, config) {
  if (!question) return null;
  const targetResponseMs = Number(question.targetResponseMs) || Number(question.responseWindowMs) || 10_000;
  if (config.modeId === "sprint") {
    return {
      ...question,
      targetResponseMs,
      responseWindowMs: targetResponseMs,
      deadlineWindowMs: null,
    };
  }

  const profile = getTimeProfile(config.timeProfileId);
  const deadlineWindowMs = profile.deadlineScale == null
    ? null
    : Math.max(2_500, Math.min(45_000, Math.round(targetResponseMs * profile.deadlineScale)));
  return {
    ...question,
    targetResponseMs,
    responseWindowMs: targetResponseMs,
    deadlineWindowMs,
  };
}

function getFeedbackDelay(config) {
  if (config.modeId === "sprint") return 300;
  const profile = getTimeProfile(config.timeProfileId);
  return Math.max(500, profile.feedbackDelayMs ?? UNTYPED_ANSWER_DELAY_MS);
}

function getMemorizationOperation(operationId) {
  return MEMORIZATION_OPERATIONS.find((operation) => operation.id === operationId)
    ?? MEMORIZATION_OPERATIONS[0];
}

function canonicalPresetIds(memory = {}) {
  if ((memory?.operationId ?? "multiplication") !== "multiplication") {
    return [String(memory?.presetId ?? "one-digit")];
  }
  const values = Array.isArray(memory?.presetIds) && memory.presetIds.length
    ? memory.presetIds
    : [memory?.presetId ?? "all"];
  return [...new Set(values.filter(Boolean).map(String))].sort();
}

function memorizationScopeKey(memory = {}) {
  const operationId = memory?.operationId ?? "multiplication";
  const presets = canonicalPresetIds(memory).join("+");
  const difficultyMode = memory?.difficultyMode ?? "adaptive";
  const tier = difficultyMode === "fixed" ? memory?.difficultyTier ?? "all" : "adaptive";
  return `${operationId}:${presets}:${difficultyMode}:${tier}`;
}

function provideHapticFeedback(correct, settings) {
  if (settings.haptics && navigator.vibrate) navigator.vibrate(correct ? 28 : [50, 40, 50]);
}

function buildTrainingAudioState(config, adaptiveSession = null, question = null, remainingRatio = 1) {
  return {
    modeId: config.modeId,
    groupId: config.groupId,
    timeProfileId: config.timeProfileId,
    difficulty: question?.difficulty ?? adaptiveSession?.currentDifficulty,
    difficultyRating: question?.difficultyRating,
    wave: adaptiveSession?.modeState?.wave,
    lives: adaptiveSession?.modeState?.lives,
    remainingRatio,
  };
}

function isTheoryTraining(config) {
  return Boolean(
    config.chapterOrder
    || config.theoryTopicIds
    || config.sectionIds
    || config.sourceChapterOrder,
  );
}

function correctMessage(combo) {
  if (combo >= 10) return "Você entrou no fluxo!";
  if (combo >= 5) return "Combo limpo!";
  if (combo >= 3) return "Ritmo encaixado!";
  return ["Boa!", "Cravou.", "Resposta limpa.", "Mandou bem."][combo % 4];
}

function headlineFor(accuracy, combo, paceRatio) {
  if (accuracy >= 0.95 && combo >= 10 && paceRatio <= 0.7) return "Sessão absurda";
  if (accuracy >= 0.9 && paceRatio <= 0.85) return "Precisão e ritmo fortes";
  if (accuracy >= 0.9) return "Acertou; agora vamos automatizar";
  if (accuracy >= 0.75) return "Boa construção de ritmo";
  return "Treino feito, mapa atualizado";
}

function messageFor(accuracy, combo, paceRatio) {
  if (accuracy >= 0.95 && paceRatio <= 0.78) return `Você fechou com ${Math.round(accuracy * 100)}% e combo ×${combo}. O próximo treino pode subir a régua.`;
  if (accuracy >= 0.9) return `Você fechou com ${Math.round(accuracy * 100)}%. As contas mais lentas continuarão aparecendo até saírem sem esforço.`;
  if (accuracy >= 0.8) return "Você sustentou um desafio saudável. O motor já separou os padrões que merecem reaparecer.";
  return "Errar aqui é dado útil: o próximo sparring vai abrir espaço para recuperar confiança antes de apertar.";
}

function formatTime(value) {
  return value < 1_000 ? `${value}ms` : `${(value / 1_000).toFixed(1)}s`;
}
