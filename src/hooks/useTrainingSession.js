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
  isCompleteAnswer,
  normalizeUserAnswer,
  serializeUserAnswer,
} from "../lib/platform/answers";
import { selectAdaptiveQuestion, THEORY_INDEX } from "../lib/platform/content";
import { getPracticeGroup, getSessionMode } from "../lib/platform/experience";

const FEEDBACK_DELAY_MS = 680;
const STRUCTURED_ANSWER_DELAY_MS = 700;
const TIME_TICK_MS = 80;

export function useTrainingSession({ config, platformState, onAttempt, onFinish }) {
  const [runtime, setRuntime] = useState(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [nudge, setNudge] = useState(null);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(Date.now());
  const runtimeRef = useRef(runtime);
  const answerRef = useRef(answer);
  const questionStartRef = useRef(Date.now());
  const deadlineRef = useRef(Date.now());
  const advanceTimeoutRef = useRef(null);
  const answerSubmitTimeoutRef = useRef(null);
  const finishedRef = useRef(false);
  const gradingRef = useRef(false);
  const pausedAtRef = useRef(null);
  const recentQuestionIdsRef = useRef([]);

  useEffect(() => { runtimeRef.current = runtime; }, [runtime]);
  useEffect(() => { answerRef.current = answer; }, [answer]);

  const begin = useCallback(async () => {
    if (answerSubmitTimeoutRef.current) window.clearTimeout(answerSubmitTimeoutRef.current);
    finishedRef.current = false;
    gradingRef.current = false;
    recentQuestionIdsRef.current = [];
    const adaptiveMode = config.modeId === "sobrevivencia"
      ? "survival"
      : config.modeId === "campanha"
        ? "campaign"
        : "sparring";
    const difficulty = config.campaignStage
      ? Math.max(1, Math.min(10, config.campaignStage.order))
      : inferStartingDifficulty(platformState.attempts, config.groupId);
    const adaptiveSession = createPracticeSession({
      id: `session-${Date.now()}`,
      mode: adaptiveMode,
      groupIds: getPracticeGroup(config.groupId).sectionIds,
      difficulty,
      lives: 3,
      inputMode: "custom-keypad",
    });
    const question = await selectAdaptiveQuestion({
      attempts: adaptiveSession.attempts,
      baselineAttempts: platformState.attempts,
      chapterOrder: config.campaignStage?.order ?? config.chapterOrder ?? null,
      currentDifficulty: adaptiveSession.currentDifficulty,
      groupId: config.groupId,
      mode: config.modeId,
      sectionPool: config.campaignStage?.sectionPool ?? null,
      responseScale: config.campaignStage?.responseScale ?? 1,
      theoryTopicIds: config.theoryTopicIds ?? null,
      allowedSectionIds: config.sectionIds ?? null,
      sourceChapterOrder: config.sourceChapterOrder ?? null,
    });
    const startedAt = Date.now();

    questionStartRef.current = startedAt;
    deadlineRef.current = startedAt + (question?.responseWindowMs ?? 10_000);
    setNow(startedAt);
    setAnswer("");
    setFeedback(null);
    setNudge(null);
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
  }, [config, platformState.attempts]);

  useEffect(() => {
    if (!runtime || paused || finishedRef.current) return undefined;

    const intervalId = window.setInterval(() => setNow(Date.now()), TIME_TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [runtime, paused]);

  useEffect(() => {
    if (!runtime || paused || feedback || finishedRef.current) return;

    if (runtime.sessionDeadline && now >= runtime.sessionDeadline) {
      finalize(runtime);
      return;
    }

    if (runtime.question && now >= deadlineRef.current) {
      gradeAnswer(answerRef.current, true);
    }
  }, [now, runtime, paused, feedback]);

  useEffect(() => () => {
    if (advanceTimeoutRef.current) window.clearTimeout(advanceTimeoutRef.current);
    if (answerSubmitTimeoutRef.current) window.clearTimeout(answerSubmitTimeoutRef.current);
  }, []);

  const gradeAnswer = useCallback((rawAnswer, timedOut = false) => {
    const current = runtimeRef.current;
    if (!current?.question || feedback || paused || finishedRef.current || gradingRef.current) return;
    if (answerSubmitTimeoutRef.current) window.clearTimeout(answerSubmitTimeoutRef.current);
    gradingRef.current = true;

    const question = current.question;
    const normalized = normalizeUserAnswer(rawAnswer, question);
    const serializedAnswer = serializeUserAnswer(normalized);
    const correct = !timedOut && normalized != null && answersMatch(normalized, question);
    const answeredAt = Date.now();
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
        timedOut,
        responseTimeMs,
        responseWindowMs: question.responseWindowMs,
        difficulty: question.difficulty,
        source: question.source,
        sourceId: question.sourceId,
        sourceDocumentId: question.sourceDocumentId,
        answerGiven: serializedAnswer,
        expectedAnswer: question.answer,
        timestamp: answeredAt,
      },
      {
        previousSessions: platformState.sessions,
        baselineAttempts: platformState.attempts,
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
      answerGiven: serializedAnswer,
      givenAnswer: serializedAnswer,
    };

    onAttempt(attempt);
    providePhysicalFeedback(correct, config.settings);
    setFeedback({
      tone: correct ? "success" : "danger",
      title: timedOut ? "Tempo esgotado" : correct ? comboMessage?.message ?? correctMessage(result.event.combo) : "Quase — ajuste o padrão",
      detail: correct
        ? `${formatTime(responseTimeMs)} · +${result.event.scoreDelta} pontos`
        : `Resposta: ${question.answerDisplay ?? question.answer}`,
    });
    if (coachMessage) {
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
        (config.modeId === "campanha" && latest.answered >= config.campaignStage.questionCount) ||
        (config.modeId === "sprint" && latest.sessionDeadline && Date.now() >= latest.sessionDeadline);

      if (shouldFinish) {
        finalize(latest);
        return;
      }

      const nextQuestion = await selectAdaptiveQuestion({
        attempts: latest.adaptiveSession.attempts,
        baselineAttempts: platformState.attempts,
        chapterOrder: config.campaignStage?.order ?? config.chapterOrder ?? null,
        currentDifficulty: latest.adaptiveSession.currentDifficulty,
        groupId: config.groupId,
        mode: config.modeId,
        recentQuestionIds: recentQuestionIdsRef.current,
        sectionPool: config.campaignStage?.sectionPool ?? null,
        responseScale: config.campaignStage?.responseScale ?? 1,
        theoryTopicIds: config.theoryTopicIds ?? null,
        allowedSectionIds: config.sectionIds ?? null,
        sourceChapterOrder: config.sourceChapterOrder ?? null,
      });
      if (finishedRef.current || !runtimeRef.current) return;
      recentQuestionIdsRef.current = [
        question.questionId,
        ...recentQuestionIdsRef.current.filter((id) => id !== question.questionId),
      ].slice(0, 5);
      const startedAt = Date.now();
      const updated = { ...latest, question: nextQuestion };
      runtimeRef.current = updated;
      questionStartRef.current = startedAt;
      deadlineRef.current = startedAt + (nextQuestion?.responseWindowMs ?? 10_000);
      setNow(startedAt);
      setRuntime(updated);
      setAnswer("");
      setFeedback(null);
      gradingRef.current = false;
    }, FEEDBACK_DELAY_MS);
  }, [config, feedback, onAttempt, paused, platformState.attempts, platformState.sessions]);

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
    if (answerSubmitTimeoutRef.current) window.clearTimeout(answerSubmitTimeoutRef.current);

    if (key === "clear") {
      setAnswer("");
      answerRef.current = "";
      return;
    }
    if (key === "backspace") {
      const next = answerRef.current.slice(0, -1);
      answerRef.current = next;
      setAnswer(next);
      return;
    }
    if (key.startsWith("choice:")) {
      const selected = key.slice("choice:".length);
      answerRef.current = selected;
      setAnswer(displayAnswerInput(selected, current.question));
      window.setTimeout(() => gradeAnswer(selected, false), 40);
      return;
    }
    if (key === "separator") {
      const separator = current.question.answerType === "rational" ? "/" : "|";
      if (!answerRef.current || answerRef.current.includes(separator)) return;
      const next = `${answerRef.current}${separator}`;
      answerRef.current = next;
      setAnswer(displayAnswerInput(next, current.question));
      return;
    }
    if (key === "." && (!current.question.acceptsDecimal || answerRef.current.includes("."))) return;

    const structuredAnswer = ["rational", "quotient-remainder"].includes(current.question.answerType);
    const expectedInput = String(current.question.answerInput ?? current.question.answerDisplay ?? current.question.answer);
    const maxLength = structuredAnswer ? 16 : expectedInput.length;
    const next = `${answerRef.current}${key}`.slice(0, Math.max(1, maxLength));
    answerRef.current = next;
    setAnswer(displayAnswerInput(next, current.question));

    if (structuredAnswer) {
      const separator = current.question.answerType === "rational" ? "/" : "|";
      if (next.includes(separator) && !next.endsWith(separator)) {
        const normalized = normalizeUserAnswer(next, current.question);
        if (normalized != null && answersMatch(normalized, current.question)) {
          answerSubmitTimeoutRef.current = window.setTimeout(() => gradeAnswer(next, false), 40);
        } else {
          answerSubmitTimeoutRef.current = window.setTimeout(
            () => gradeAnswer(next, false),
            STRUCTURED_ANSWER_DELAY_MS,
          );
        }
      }
    } else if (isCompleteAnswer(next, current.question)) {
      window.setTimeout(() => gradeAnswer(next, false), 40);
    }
  }, [feedback, gradeAnswer, paused]);

  const pause = useCallback(() => {
    const current = runtimeRef.current;
    if (!current || paused) return;
    if (answerSubmitTimeoutRef.current) window.clearTimeout(answerSubmitTimeoutRef.current);
    pausedAtRef.current = Date.now();
    const updated = { ...current, adaptiveSession: pausePracticeSession(current.adaptiveSession) };
    runtimeRef.current = updated;
    setRuntime(updated);
    setPaused(true);
  }, [paused]);

  const resume = useCallback(() => {
    const current = runtimeRef.current;
    if (!current || !paused) return;
    const pausedDuration = Date.now() - (pausedAtRef.current ?? Date.now());
    deadlineRef.current += pausedDuration;
    const updated = {
      ...current,
      sessionDeadline: current.sessionDeadline ? current.sessionDeadline + pausedDuration : null,
      adaptiveSession: resumePracticeSession(current.adaptiveSession),
    };
    runtimeRef.current = updated;
    setRuntime(updated);
    setPaused(false);
    setNow(Date.now());
  }, [paused]);

  const finalize = useCallback((providedRuntime = runtimeRef.current) => {
    if (!providedRuntime || finishedRef.current) return;
    finishedRef.current = true;
    if (advanceTimeoutRef.current) window.clearTimeout(advanceTimeoutRef.current);
    if (answerSubmitTimeoutRef.current) window.clearTimeout(answerSubmitTimeoutRef.current);

    const endedAt = Date.now();
    const finished = finishPracticeSession(providedRuntime.adaptiveSession, {
      endedAt,
      previousSessions: platformState.sessions,
      theoryIndex: THEORY_INDEX,
    });
    const attempts = finished.session.attempts;
    const correct = attempts.filter((attempt) => attempt.correct && !attempt.timedOut).length;
    const accuracy = attempts.length ? correct / attempts.length : 0;
    const correctTimes = attempts.filter((attempt) => attempt.correct && attempt.responseTimeMs != null).map((attempt) => attempt.responseTimeMs);
    const previousBest = Number(platformState.records.bestScore[`${config.modeId}:${config.groupId}`]) || 0;
    const passed = config.campaignStage ? accuracy >= config.campaignStage.targetAccuracy : true;
    const theoryRecommendation = finished.report.theoryRecommendations?.[0];
    const summary = {
      id: finished.session.id,
      modeId: config.modeId,
      groupId: config.groupId,
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
      isNewRecord: finished.session.score > previousBest && previousBest > 0,
      headline: passed ? headlineFor(accuracy, finished.session.bestCombo) : "Mais uma rodada e você passa",
      message: passed
        ? messageFor(accuracy, finished.session.bestCombo)
        : `Você chegou a ${Math.round(accuracy * 100)}%. Este capítulo pede ${Math.round(config.campaignStage.targetAccuracy * 100)}% para avançar.`,
      insight: finished.report.fatigue?.isFatigued && config.settings.autoRestCoach
        ? {
            kind: "rest",
            title: "Seu cérebro pediu intervalo",
            detail: finished.report.fatigue.message ?? "Seu ritmo caiu fora do padrão. Tome um ar e volte com a cabeça renovada.",
          }
        : theoryRecommendation
        ? { kind: "theory", topicId: theoryRecommendation.topicId, title: `Reforce “${theoryRecommendation.title}”`, detail: theoryRecommendation.reason }
        : accuracy >= 0.85
          ? { kind: "progress", title: "Seu nível subiu", detail: "Precisão e ritmo indicam que você pode encarar contas um passo mais difíceis." }
          : null,
    };
    onFinish(summary, config.campaignStage);
    runtimeRef.current = null;
    setRuntime(null);
    setAnswer("");
    setFeedback(null);
  }, [config, onFinish, platformState.records.bestScore, platformState.sessions]);

  const exit = useCallback(() => {
    const current = runtimeRef.current;
    if (!current) return;
    if (!current.adaptiveSession.attempts.length) {
      if (advanceTimeoutRef.current) window.clearTimeout(advanceTimeoutRef.current);
      if (answerSubmitTimeoutRef.current) window.clearTimeout(answerSubmitTimeoutRef.current);
      runtimeRef.current = null;
      finishedRef.current = true;
      gradingRef.current = false;
      setRuntime(null);
      setAnswer("");
      setFeedback(null);
      return;
    }
    finalize(current);
  }, [finalize]);
  const mode = getSessionMode(config.modeId);
  const group = getPracticeGroup(config.groupId);
  const remainingMs = runtime
    ? Math.max(0, Math.min(
        deadlineRef.current - now,
        runtime.sessionDeadline ? runtime.sessionDeadline - now : Number.POSITIVE_INFINITY,
      ))
    : 0;
  const questionWindowMs = runtime?.question?.responseWindowMs ?? 1;
  const remainingRatio = runtime
    ? runtime.sessionDeadline
      ? Math.max(0, (runtime.sessionDeadline - now) / 60_000)
      : Math.max(0, remainingMs / questionWindowMs)
    : 0;
  const publicSession = useMemo(() => runtime ? {
    ...runtime,
    modeId: config.modeId,
    modeLabel: mode.label,
    groupLabel: group.label,
    score: runtime.adaptiveSession.score,
    combo: runtime.adaptiveSession.currentCombo,
    lives: runtime.adaptiveSession.modeState?.lives ?? 3,
    difficultyLabel: runtime.adaptiveSession.currentDifficulty,
    targetCount: config.modeId === "sparring"
      ? config.questionCount
      : config.modeId === "campanha"
        ? config.campaignStage.questionCount
        : null,
  } : null, [runtime, config, mode.label, group.label]);

  return {
    active: Boolean(runtime),
    answer,
    begin,
    exit,
    feedback,
    handleAnswerKey,
    nudge,
    pause,
    paused,
    remainingMs,
    remainingRatio,
    resume,
    session: publicSession,
  };
}

function inferStartingDifficulty(attempts, groupId) {
  const relevant = attempts.filter((attempt) => groupId === "misto" || attempt.groupId === groupId || attempt.sectionId === groupId).slice(0, 20);
  if (!relevant.length) return 3;
  const accuracy = relevant.filter((attempt) => attempt.correct).length / relevant.length;
  const averageLevel = relevant.reduce((sum, attempt) => sum + (Number(attempt.difficulty) || 3), 0) / relevant.length;
  return Math.max(1, Math.min(10, Math.round(averageLevel + (accuracy >= 0.88 ? 1 : accuracy < 0.6 ? -1 : 0))));
}

function providePhysicalFeedback(correct, settings) {
  if (settings.haptics && navigator.vibrate) navigator.vibrate(correct ? 28 : [50, 40, 50]);
  if (!settings.sound || typeof AudioContext === "undefined") return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = correct ? 660 : 190;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.addEventListener("ended", () => context.close());
  } catch {
    // Áudio é melhoria progressiva; o treino continua silenciosamente.
  }
}

function correctMessage(combo) {
  if (combo >= 10) return "Você entrou no fluxo!";
  if (combo >= 5) return "Combo limpo!";
  if (combo >= 3) return "Ritmo encaixado!";
  return ["Boa!", "Cravou.", "Resposta limpa.", "Mandou bem."][combo % 4];
}

function headlineFor(accuracy, combo) {
  if (accuracy >= 0.95 && combo >= 10) return "Sessão absurda";
  if (accuracy >= 0.9) return "Precisão de respeito";
  if (accuracy >= 0.75) return "Boa construção de ritmo";
  return "Treino feito, mapa atualizado";
}

function messageFor(accuracy, combo) {
  if (accuracy >= 0.95) return `Você fechou com ${Math.round(accuracy * 100)}% e combo ×${combo}. O próximo treino vai subir a régua.`;
  if (accuracy >= 0.8) return "Você sustentou um desafio saudável. O motor já separou os padrões que merecem reaparecer.";
  return "Errar aqui é dado útil: o próximo sparring vai abrir espaço para recuperar confiança antes de apertar.";
}

function formatTime(value) {
  return value < 1_000 ? `${value}ms` : `${(value / 1_000).toFixed(1)}s`;
}
