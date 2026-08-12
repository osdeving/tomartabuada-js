import { SECTIONS } from "../academy/content.js";
import {
  calculateMastery,
  computeTrend,
  detectErrorPatterns,
  getAttemptMetrics,
} from "../adaptive/analytics.js";
import { PRACTICE_GROUPS, SESSION_MODES } from "./experience.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_DAYS = 14;
const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((section) => [section.id, section]));
const PRACTICE_SECTION_IDS = new Set(
  PRACTICE_GROUPS.flatMap((group) => group.sectionIds),
);
const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});
const SESSION_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function buildHomeDashboard(rawState, now = Date.now()) {
  const state = normalizeState(rawState);
  const attempts = normalizePlatformAttempts(state.attempts);
  const sessions = normalizeSessions(state.sessions);
  const overall = buildOverallMetrics(state, attempts);
  const trend = computeTrend(attempts, { windowSize: 10 });
  const paceTrend = computeCorrectPaceTrend(attempts);
  const groups = buildGroupModels(state, attempts);
  const skillRows = groups
    .filter((group) => group.id !== "misto")
    .map((group) => ({
      id: group.id,
      groupId: group.id,
      label: group.label,
      attempts: group.attempts,
      mastery: group.mastery,
      labelValue: group.attempts ? `${group.mastery}%` : "novo",
    }));
  const weakest = chooseWeakestGroup(groups);
  const weakPatterns = buildWeakPatterns(attempts);
  const todayAttempts = countTodayAttempts(attempts, sessions, now);
  const dailyGoal = Math.max(1, wholeNumber(state.settings.dailyGoal, 20));
  const recommendation = buildRecommendation({
    attempts: overall.attempts,
    dailyGoal,
    todayAttempts,
    trend,
    weakest,
  });
  const coach = buildHomeCoach({
    attempts: overall.attempts,
    paceTrend,
    trend,
    weakPatterns,
    weakest,
  });
  const level = Math.max(1, wholeNumber(state.profile.level, 1));
  const xp = Math.max(0, finiteNumber(state.profile.xp, 0));

  return {
    greeting: buildGreeting(state.profile.displayName, now),
    recommendationTitle: recommendation.title,
    recommendationDetail: recommendation.detail,
    suggestedCount: Math.max(5, wholeNumber(state.settings.questionCount, 15)),
    todayAttempts,
    dailyGoal,
    accuracyLabel: formatAccuracy(overall.accuracy),
    trendLabel: formatAccuracyTrend(trend, { compact: true }),
    paceLabel: formatPace(overall.correctPaceMs),
    bestCombo: Math.max(
      0,
      wholeNumber(state.records.bestCombo, 0),
      getAttemptMetrics(attempts).bestStreak,
    ),
    level,
    xpToNext: Math.max(0, Math.ceil(level * 250 - xp)),
    skillRows,
    coachTitle: coach.title,
    coachDetail: coach.detail,
    coachAction: coach.action,
  };
}

export function buildReportsDashboard(rawState, now = Date.now()) {
  const state = normalizeState(rawState);
  const attempts = normalizePlatformAttempts(state.attempts);
  const sessions = normalizeSessions(state.sessions);
  const overall = buildOverallMetrics(state, attempts);
  const trend = computeTrend(attempts, { windowSize: 10 });
  const paceTrend = computeCorrectPaceTrend(attempts);
  const groups = buildGroupModels(state, attempts);
  const weakest = chooseWeakestGroup(groups);
  const strongest = chooseStrongestGroup(groups);
  const weakPatterns = buildWeakPatterns(attempts);
  const consistency = buildConsistency(sessions, attempts);

  return {
    accuracyLabel: formatAccuracy(overall.accuracy),
    accuracyTrend: formatAccuracyTrend(trend),
    paceLabel: formatPace(overall.correctPaceMs),
    paceTrend: formatPaceTrend(paceTrend),
    sessionCount: sessions.length,
    totalAttempts: overall.attempts,
    consistencyLabel: consistency.label,
    consistencyDetail: consistency.detail,
    activity: buildActivity(attempts, sessions, now),
    coach: buildReportCoach({
      attempts: overall.attempts,
      attemptsList: attempts,
      strongest,
      weakest,
      trend,
      weakPatterns,
    }),
    groups: groups.map((group) => ({
      id: group.id,
      label: group.label,
      color: group.color,
      attempts: group.attempts,
      mastery: group.mastery,
      accuracyLabel: formatAccuracy(group.accuracy),
      paceLabel: formatPace(group.correctPaceMs),
    })),
    weakPatterns,
    sessions: sessions
      .slice(0, 10)
      .map((session, index) => buildSessionRow(session, now, index)),
  };
}

export function buildTheoryIndex(rawChapters) {
  const chapters = Array.isArray(rawChapters)
    ? rawChapters
    : Array.isArray(rawChapters?.capitulos)
      ? rawChapters.capitulos
      : Array.isArray(rawChapters?.chapters)
        ? rawChapters.chapters
        : [];

  return chapters
    .filter(isObject)
    .map((chapter, chapterIndex) => {
      const rawTopics = arrayValue(chapter.secoes ?? chapter.topics);
      const examples = [
        ...arrayValue(chapter.exemplos ?? chapter.examples),
        ...rawTopics.flatMap((topic) => arrayValue(topic?.exemplos ?? topic?.examples)),
      ]
        .filter(isObject)
        .map((example, exampleIndex) => ({
          id: textValue(example.id, `${textValue(chapter.id, `chapter-${chapterIndex + 1}`)}-example-${exampleIndex + 1}`),
          prompt: textValue(example.prompt ?? example.enunciado),
          promptLatex: textValue(example.promptLatex ?? example.prompt_latex),
          answer: normalizeAnswer(example.answer ?? example.resposta),
          note: textValue(example.note ?? example.resolucao ?? example.explicacao),
          tags: stringArray(example.tags),
          source: isObject(example.origem) ? { ...example.origem } : null,
        }));
      const patternKeys = stringArray(chapter.padroes ?? chapter.patternKeys);
      const sectionIds = inferChapterSectionIds(chapter, rawTopics, examples);
      const groupId = inferChapterGroupId(sectionIds);
      const order = Math.max(1, wholeNumber(chapter.order ?? chapter.ordem, chapterIndex + 1));
      const difficulty = Math.max(1, wholeNumber(chapter.difficulty ?? chapter.dificuldade, order));
      const topics = rawTopics.filter(isObject).map((topic, topicIndex) => ({
        id: textValue(topic.id, `${textValue(chapter.id, `chapter-${order}`)}-topic-${topicIndex + 1}`),
        title: textValue(topic.title ?? topic.titulo, `Técnica ${topicIndex + 1}`),
        summary: textValue(topic.summary ?? topic.resumo),
        steps: stringArray(topic.steps ?? topic.passos),
        formulaLatex: textValue(topic.formulaLatex ?? topic.formula),
        patternKeys: stringArray(topic.padroes ?? topic.patternKeys ?? topic.tags),
        pageLabel: formatPageLabel(topic.paginas ?? topic.pages),
      }));
      const summary = textValue(
        chapter.summary ?? chapter.resumo ?? chapter.objetivo,
        "Conteúdo teórico e exemplos para reconhecer o método durante o treino.",
      );
      const title = textValue(chapter.title ?? chapter.titulo, `Capítulo ${order}`);
      const searchText = normalizeSearchText([
        title,
        chapter.tituloOriginal,
        summary,
        patternKeys,
        sectionIds.map((sectionId) => SECTION_BY_ID[sectionId]?.label),
        getGroup(groupId).label,
        topics.flatMap((topic) => [topic.title, topic.summary, topic.steps]),
        examples.flatMap((example) => [example.prompt, example.note, example.tags]),
      ]);

      return {
        id: textValue(chapter.id, `chapter-${String(order).padStart(2, "0")}`),
        order,
        title,
        originalTitle: textValue(chapter.originalTitle ?? chapter.tituloOriginal),
        difficulty,
        difficultyLabel: formatDifficultyLabel(difficulty),
        summary,
        topics,
        examples,
        patternKeys,
        sectionIds,
        groupId,
        pageLabel: formatChapterPageLabel(chapter),
        searchText,
        practice: {
          chapterId: textValue(chapter.id, `chapter-${String(order).padStart(2, "0")}`),
          groupId,
          sectionIds,
          patternKeys,
        },
      };
    })
    .sort((left, right) => left.order - right.order);
}

function buildOverallMetrics(state, attempts) {
  const attemptMetrics = getAttemptMetrics(attempts);
  const sectionTotals = sumSectionStats(state.sectionStats, [...PRACTICE_SECTION_IDS]);
  const useSectionTotals = sectionTotals.attempts >= attemptMetrics.attempts;
  const totalAttempts = useSectionTotals ? sectionTotals.attempts : attemptMetrics.attempts;
  const totalCorrect = useSectionTotals ? sectionTotals.correct : attemptMetrics.correct;

  return {
    attempts: totalAttempts,
    correct: totalCorrect,
    accuracy: totalAttempts ? totalCorrect / totalAttempts : null,
    correctPaceMs: mean(
      attempts
        .filter((attempt) => attempt.correct)
        .map((attempt) => attempt.responseTimeMs)
        .filter(isPositiveFinite),
    ),
  };
}

function buildGroupModels(state, attempts) {
  return PRACTICE_GROUPS.map((group) => {
    const groupAttempts = attempts.filter((attempt) => attemptBelongsToGroup(attempt, group));
    const attemptMetrics = getAttemptMetrics(groupAttempts);
    const sectionTotals = sumSectionStats(state.sectionStats, group.sectionIds);
    const useSectionTotals = sectionTotals.attempts >= attemptMetrics.attempts;
    const count = useSectionTotals ? sectionTotals.attempts : attemptMetrics.attempts;
    const correct = useSectionTotals ? sectionTotals.correct : attemptMetrics.correct;
    const accuracy = count ? correct / count : null;
    const paceRatios = groupAttempts
      .filter((attempt) => attempt.correct)
      .map((attempt) => getPaceRatio(attempt))
      .filter(isPositiveFinite);
    const correctPaceMs = mean(
      groupAttempts
        .filter((attempt) => attempt.correct)
        .map((attempt) => attempt.responseTimeMs)
        .filter(isPositiveFinite),
    );
    const inferredPaceRatio = mean(paceRatios) ?? inferPaceRatio(correctPaceMs);
    const confidence = count ? 1 - Math.exp(-count / 10) : 0;
    const mastery = count
      ? Math.round(
          calculateMastery({
            attempts: count,
            accuracy,
            paceRatio: inferredPaceRatio,
            confidence,
          }) * 100,
        )
      : 0;

    return {
      id: group.id,
      label: group.label,
      shortLabel: group.shortLabel,
      color: group.color,
      attempts: count,
      correct,
      accuracy,
      correctPaceMs,
      mastery: clamp(mastery, 0, 100),
    };
  });
}

function buildActivity(attempts, sessions, now) {
  const referenceDate = startOfLocalDay(now);
  const days = Array.from({ length: ACTIVITY_DAYS }, (_, index) => {
    const date = new Date(referenceDate);
    date.setDate(date.getDate() - (ACTIVITY_DAYS - 1 - index));
    return {
      date: localDateKey(date.getTime()),
      label: DATE_LABEL_FORMATTER.format(date),
      attempts: 0,
      correct: 0,
    };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));

  if (attempts.length) {
    for (const attempt of attempts) {
      const point = byDate.get(localDateKey(attempt.answeredAt));
      if (!point) continue;
      point.attempts += 1;
      point.correct += attempt.correct ? 1 : 0;
    }
  } else {
    for (const session of sessions) {
      const point = byDate.get(localDateKey(sessionTimestamp(session)));
      if (!point) continue;
      const answered = getSessionAnswered(session);
      point.attempts += answered;
      point.correct += getSessionCorrect(session, answered);
    }
  }

  return days.map((day) => ({
    date: day.date,
    label: day.label,
    attempts: day.attempts,
    accuracy: day.attempts ? round(day.correct / day.attempts, 4) : null,
    accuracyLabel: day.attempts ? formatAccuracy(day.correct / day.attempts) : "sem treino",
  }));
}

function buildWeakPatterns(attempts) {
  return detectErrorPatterns(attempts, {
    minimumAttempts: 3,
    minimumErrorRate: 0.35,
  })
    .slice(0, 5)
    .map((pattern) => {
      const groupId = findValidGroupId(pattern.affectedGroupIds) ?? inferGroupIdFromSkills(pattern.affectedSkills);
      const group = getGroup(groupId);
      const accuracy = 1 - pattern.errorRate;
      return {
        key: pattern.patternKey,
        groupId: group.id,
        accuracy,
        accuracyLabel: formatAccuracy(accuracy),
        label: formatPatternLabel(pattern.patternKey, group),
        detail: `${pattern.wrong} erros em ${pattern.attempts} tentativas. ${buildPatternAdvice(group)}`,
        theoryTopicId: pattern.theoryTopicIds[0] ?? null,
      };
    });
}

function buildConsistency(sessions, attempts) {
  let values = sessions
    .slice(0, 10)
    .map(getSessionAccuracy)
    .filter(isRatio);

  if (values.length < 3) {
    values = getActiveDayAccuracies(attempts);
  }

  if (values.length < 3) {
    const missing = Math.max(0, 3 - values.length);
    return {
      label: "Em formação",
      detail: missing === 1 ? "complete 1 sessão para medir" : `complete ${missing} sessões para medir`,
    };
  }

  const deviation = standardDeviation(values);
  if (deviation <= 0.07) {
    return { label: "Alta", detail: "resultados muito estáveis" };
  }
  if (deviation <= 0.14) {
    return { label: "Boa", detail: "pouca variação entre treinos" };
  }
  return { label: "Oscilando", detail: "vale consolidar antes de acelerar" };
}

function buildReportCoach({ attempts, attemptsList, strongest, weakest, trend, weakPatterns }) {
  if (!attempts) {
    return {
      title: "Seu primeiro treino abre o mapa",
      detail: "Depois de algumas respostas, eu comparo precisão, ritmo e recorrência para encontrar seu melhor próximo passo.",
      strongest: "Ainda sem dados",
      weakest: "Fundamentos",
      bestTime: "Ainda sem dados",
      groupId: "base",
    };
  }

  const weakPattern = weakPatterns[0];
  const title = weakPattern
    ? "Há um padrão claro para revisar"
    : trend.direction === "improving"
      ? "Você está acelerando sem perder precisão"
      : trend.direction === "declining"
        ? "Seu bloco recente pediu um ajuste"
        : "Consistência antes de dificuldade";
  const detail = weakPattern
    ? `${weakPattern.label} reapareceu entre os erros. Um bloco curto e a teoria correspondente tendem a render mais que insistir no aleatório.`
    : trend.direction === "declining"
      ? `Volte um passo em ${weakest.label}, recupere respostas limpas e só então aperte o tempo.`
      : `${weakest.label} é hoje a melhor oportunidade de ganho. Treinos curtos mantêm a qualidade sem sacrificar ritmo.`;

  return {
    title,
    detail,
    strongest: strongest.attempts ? strongest.label : "Ainda sem dados",
    weakest: weakest.attempts ? weakest.label : "Fundamentos",
    bestTime: findBestTime(attemptsList),
    groupId: weakPattern?.groupId ?? (weakest.attempts ? weakest.id : "base"),
  };
}

function buildHomeCoach({ attempts, paceTrend, trend, weakPatterns, weakest }) {
  if (!attempts) {
    return {
      title: "Comece sem pressa",
      detail: "Seu primeiro sparring calibra dificuldade e tempo. Depois dele, o treino já começa a reconhecer seus padrões.",
      action: "treinar",
    };
  }

  if (weakPatterns[0]) {
    return {
      title: "Esse erro está formando um padrão",
      detail: `${weakPatterns[0].label} apareceu de novo. Releia a técnica e volte para um bloco curto de reconhecimento.`,
      action: "teoria",
    };
  }

  if (trend.direction === "improving" || paceTrend?.delta <= -0.08) {
    return {
      title: "Seu ritmo está subindo",
      detail: `Você ganhou fluência recentemente. ${weakest.label} é o melhor lugar para transformar esse embalo em domínio.`,
      action: "treinar",
    };
  }

  return {
    title: "Um bloco curto vale mais que insistir cansado",
    detail: `Faça ${weakest.label.toLocaleLowerCase("pt-BR")} com foco em respostas limpas. A velocidade vem depois da consistência.`,
    action: "treinar",
  };
}

function buildRecommendation({ attempts, dailyGoal, todayAttempts, trend, weakest }) {
  if (!attempts) {
    return {
      title: "Descubra seu ponto de partida",
      detail: "Comece com um sparring de fundamentos. As primeiras respostas calibram o nível sem cobrar velocidade antes da hora.",
    };
  }

  if (todayAttempts >= dailyGoal) {
    return {
      title: "Meta do dia cumprida",
      detail: `Você já respondeu ${todayAttempts} contas hoje. Se quiser continuar, faça um bloco leve em ${weakest.label.toLocaleLowerCase("pt-BR")}.`,
    };
  }

  if (trend.direction === "declining") {
    return {
      title: `Recupere o ritmo em ${weakest.shortLabel}`,
      detail: "O bloco recente oscilou. O próximo treino reduz a pressão e prioriza acertos reconhecíveis antes de voltar a acelerar.",
    };
  }

  return {
    title: `Fortaleça ${weakest.shortLabel}`,
    detail: `${weakest.label} oferece hoje o maior ganho potencial. O sparring mistura revisão e novidade sem repetir contas à toa.`,
  };
}

function buildSessionRow(session, now, index) {
  const modeId = normalizeModeId(session.modeId ?? session.mode);
  const mode = getMode(modeId);
  const group = getGroup(session.groupId ?? session.groupIds?.[0] ?? session.sectionId);
  const answered = getSessionAnswered(session);
  const accuracy = getSessionAccuracy(session);
  const durationMs = getSessionDuration(session);
  const timestamp = sessionTimestamp(session);

  return {
    id: textValue(session.id, `session-${timestamp || "sem-data"}-${index}`),
    modeId,
    modeShort: mode.short,
    groupLabel: group.label,
    dateLabel: formatSessionDate(timestamp, now),
    durationLabel: formatDuration(durationMs),
    accuracyLabel: answered ? formatAccuracy(accuracy) : "—",
    scoreLabel: `${Math.max(0, wholeNumber(session.score, 0)).toLocaleString("pt-BR")} pts`,
  };
}

function normalizePlatformAttempts(rawAttempts) {
  return arrayValue(rawAttempts)
    .filter(isObject)
    .map((attempt, index) => {
      const answeredAt = positiveNumber(
        attempt.answeredAt ?? attempt.timestamp,
        0,
      );
      return {
        ...attempt,
        id: textValue(attempt.id, `attempt-${answeredAt || index}-${index}`),
        answeredAt,
        timestamp: answeredAt,
        mode: normalizeModeId(attempt.modeId ?? attempt.mode),
        groupId: textValue(attempt.groupId ?? attempt.sectionId, "misto"),
        sectionId: textValue(attempt.sectionId ?? attempt.groupId, ""),
        skillKey: textValue(attempt.skillKey ?? attempt.questionId, `unknown:${index}`),
        patternKey: textValue(
          attempt.patternKey ?? attempt.patternId ?? attempt.presetId ?? attempt.tags?.[0],
          inferPatternFromSkill(attempt.skillKey, attempt.sectionId),
        ),
        correct: readBoolean(attempt.correct ?? attempt.isCorrect),
        responseTimeMs: positiveNumber(attempt.responseTimeMs ?? attempt.responseTime, null),
        responseWindowMs: positiveNumber(attempt.responseWindowMs, null),
        theoryTopicId: textValue(attempt.theoryTopicId),
      };
    })
    .sort((left, right) => left.answeredAt - right.answeredAt);
}

function normalizeSessions(rawSessions) {
  return arrayValue(rawSessions)
    .filter(isObject)
    .slice()
    .sort((left, right) => sessionTimestamp(right) - sessionTimestamp(left));
}

function normalizeState(rawState) {
  const state = isObject(rawState) ? rawState : {};
  return {
    ...state,
    settings: isObject(state.settings) ? state.settings : {},
    profile: isObject(state.profile) ? state.profile : {},
    records: isObject(state.records) ? state.records : {},
    sectionStats: isObject(state.sectionStats) ? state.sectionStats : {},
    attempts: arrayValue(state.attempts),
    sessions: arrayValue(state.sessions),
  };
}

function attemptBelongsToGroup(attempt, group) {
  if (group.id === "misto") return true;
  return attempt.groupId === group.id || group.sectionIds.includes(attempt.sectionId);
}

function sumSectionStats(sectionStats, sectionIds) {
  return [...new Set(sectionIds)].reduce(
    (total, sectionId) => {
      const stats = isObject(sectionStats?.[sectionId]) ? sectionStats[sectionId] : {};
      total.attempts += Math.max(0, wholeNumber(stats.attempts, 0));
      total.correct += Math.max(0, wholeNumber(stats.correct, 0));
      return total;
    },
    { attempts: 0, correct: 0 },
  );
}

function chooseWeakestGroup(groups) {
  const candidates = groups.filter((group) => group.id !== "misto" && group.attempts > 0);
  if (!candidates.length) return getEmptyGroup("base");
  return candidates.slice().sort((left, right) => left.mastery - right.mastery || right.attempts - left.attempts)[0];
}

function chooseStrongestGroup(groups) {
  const candidates = groups.filter((group) => group.id !== "misto" && group.attempts > 0);
  if (!candidates.length) return getEmptyGroup("base");
  return candidates.slice().sort((left, right) => right.mastery - left.mastery || right.attempts - left.attempts)[0];
}

function getEmptyGroup(groupId) {
  const group = getGroup(groupId);
  return { ...group, attempts: 0, correct: 0, accuracy: null, correctPaceMs: null, mastery: 0 };
}

function countTodayAttempts(attempts, sessions, now) {
  const todayKey = localDateKey(now);
  if (attempts.length) {
    return attempts.filter((attempt) => localDateKey(attempt.answeredAt) === todayKey).length;
  }
  return sessions
    .filter((session) => localDateKey(sessionTimestamp(session)) === todayKey)
    .reduce((total, session) => total + getSessionAnswered(session), 0);
}

function computeCorrectPaceTrend(attempts, windowSize = 10) {
  const correct = attempts.filter(
    (attempt) => attempt.correct && isPositiveFinite(attempt.responseTimeMs),
  );
  const current = correct.slice(-windowSize);
  const previous = correct.slice(-windowSize * 2, -windowSize);
  if (current.length < 3 || previous.length < 3) return null;
  const currentPace = mean(current.map((attempt) => attempt.responseTimeMs));
  const previousPace = mean(previous.map((attempt) => attempt.responseTimeMs));
  return {
    currentPace,
    previousPace,
    delta: previousPace ? currentPace / previousPace - 1 : 0,
  };
}

function formatAccuracyTrend(trend, options = {}) {
  if (!trend || trend.accuracyDelta == null) {
    return options.compact ? "construindo sua base" : "mais respostas revelarão a tendência";
  }
  const points = Math.round(Math.abs(trend.accuracyDelta) * 100);
  if (points < 2) return options.compact ? "ritmo estável" : "estável no bloco recente";
  if (trend.accuracyDelta > 0) {
    return options.compact ? `↑ ${points} p.p. recentemente` : `+${points} p.p. vs. bloco anterior`;
  }
  return options.compact ? `↓ ${points} p.p. recentemente` : `−${points} p.p. vs. bloco anterior`;
}

function formatPaceTrend(trend) {
  if (!trend) return "mais respostas revelarão a tendência";
  const percent = Math.round(Math.abs(trend.delta) * 100);
  if (percent < 5) return "ritmo estável";
  return trend.delta < 0 ? `${percent}% mais rápido` : `${percent}% mais lento`;
}

function findBestTime(attempts) {
  if (!attempts.length) return "Ainda sem dados";
  const periods = [
    { id: "madrugada", label: "de madrugada (0h–6h)", start: 0, end: 6 },
    { id: "manha", label: "de manhã (6h–12h)", start: 6, end: 12 },
    { id: "tarde", label: "à tarde (12h–18h)", start: 12, end: 18 },
    { id: "noite", label: "à noite (18h–0h)", start: 18, end: 24 },
  ].map((period) => ({ ...period, attempts: 0, correct: 0, pace: [] }));

  for (const attempt of attempts) {
    if (!attempt.answeredAt) continue;
    const hour = new Date(attempt.answeredAt).getHours();
    const period = periods.find((item) => hour >= item.start && hour < item.end);
    if (!period) continue;
    period.attempts += 1;
    period.correct += attempt.correct ? 1 : 0;
    if (attempt.correct && isPositiveFinite(attempt.responseTimeMs)) {
      period.pace.push(attempt.responseTimeMs);
    }
  }

  const eligible = periods.filter((period) => period.attempts > 0);
  if (!eligible.length) return "Ainda sem dados";
  const best = eligible
    .map((period) => ({
      ...period,
      score:
        (period.correct + 1.5) / (period.attempts + 2) -
        Math.min(0.12, (mean(period.pace) ?? 6_000) / 100_000),
    }))
    .sort((left, right) => right.score - left.score)[0];
  return best.label;
}

function getActiveDayAccuracies(attempts) {
  const buckets = new Map();
  for (const attempt of attempts) {
    const key = localDateKey(attempt.answeredAt);
    if (!key) continue;
    const bucket = buckets.get(key) ?? { attempts: 0, correct: 0 };
    bucket.attempts += 1;
    bucket.correct += attempt.correct ? 1 : 0;
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .filter((bucket) => bucket.attempts >= 3)
    .map((bucket) => bucket.correct / bucket.attempts);
}

function getSessionAnswered(session) {
  if (Array.isArray(session.attempts)) return session.attempts.length;
  return Math.max(
    0,
    wholeNumber(
      session.answered ?? session.attempts ?? session.totalAttempts ?? session.questionCount,
      0,
    ),
  );
}

function getSessionCorrect(session, answered = getSessionAnswered(session)) {
  const explicit = Number(session.correct);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.min(answered, explicit);
  const accuracy = getSessionAccuracy(session);
  return accuracy == null ? 0 : Math.round(accuracy * answered);
}

function getSessionAccuracy(session) {
  if (session.accuracy != null) {
    const explicit = Number(session.accuracy);
    if (isRatio(explicit)) return explicit;
  }
  const answered = getSessionAnswered(session);
  const correct = Number(session.correct);
  return answered && Number.isFinite(correct) ? clamp(correct / answered, 0, 1) : null;
}

function getSessionDuration(session) {
  const explicit = Number(session.durationMs ?? session.elapsedMs);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const startedAt = positiveNumber(session.startedAt, null);
  const endedAt = positiveNumber(session.endedAt ?? session.completedAt, null);
  return startedAt && endedAt ? Math.max(0, endedAt - startedAt) : 0;
}

function sessionTimestamp(session) {
  return positiveNumber(
    session.endedAt ?? session.completedAt ?? session.updatedAt ?? session.startedAt,
    0,
  );
}

function formatSessionDate(timestamp, now) {
  if (!timestamp) return "data não registrada";
  const dayDifference = differenceInLocalDays(timestamp, now);
  const time = TIME_FORMATTER.format(new Date(timestamp));
  if (dayDifference === 0) return `Hoje, ${time}`;
  if (dayDifference === 1) return `Ontem, ${time}`;
  return SESSION_DATE_FORMATTER.format(new Date(timestamp));
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "—";
  const totalSeconds = Math.max(1, Math.round(durationMs / 1_000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}min`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildGreeting(displayName, now) {
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const name = textValue(displayName, "Atleta mental");
  return `${greeting}, ${name}`;
}

function formatAccuracy(value) {
  return isRatio(value) ? `${Math.round(value * 100)}%` : "—";
}

function formatPace(value) {
  if (!isPositiveFinite(value)) return "—";
  if (value < 1_000) return `${Math.round(value)}ms`;
  return `${(value / 1_000).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}s`;
}

function normalizeModeId(modeId) {
  const value = textValue(modeId, "sparring").toLocaleLowerCase("pt-BR");
  if (["survival", "sobrevivência", "sobrevivencia"].includes(value)) return "sobrevivencia";
  if (["campaign", "campanha"].includes(value)) return "campanha";
  if (["training", "treino", "practice"].includes(value)) return "sparring";
  return value;
}

function getMode(modeId) {
  const mode = SESSION_MODES.find((item) => item.id === modeId);
  if (mode) {
    return {
      ...mode,
      short: mode.id === "sobrevivencia" ? "SOB" : mode.id === "sprint" ? "60s" : "SPR",
    };
  }
  if (modeId === "campanha") return { id: modeId, label: "Campanha", short: "CAP" };
  return { id: modeId, label: humanize(modeId), short: modeId.slice(0, 3).toUpperCase() };
}

function getGroup(groupId) {
  const direct = PRACTICE_GROUPS.find((group) => group.id === groupId);
  if (direct) return direct;
  const section = SECTION_BY_ID[groupId];
  if (section) {
    const related = PRACTICE_GROUPS.find(
      (group) => group.id !== "misto" && group.sectionIds.includes(section.id),
    );
    if (related) return related;
  }
  return PRACTICE_GROUPS.find((group) => group.id === "misto") ?? PRACTICE_GROUPS[0];
}

function findValidGroupId(groupIds) {
  const valid = arrayValue(groupIds).filter((groupId) =>
    PRACTICE_GROUPS.some((group) => group.id === groupId),
  );
  return valid.find((groupId) => groupId !== "misto") ?? null;
}

function inferGroupIdFromSkills(skillKeys) {
  const prefix = textValue(arrayValue(skillKeys)[0]).split(":")[0];
  if (prefix === "add") return "adicao";
  if (prefix === "sub") return "subtracao";
  if (prefix === "div") return "divisao";
  if (["square", "same-tens"].includes(prefix)) return "quadrado";
  if (["mul", "mul11"].includes(prefix)) return "tabuada";
  return "misto";
}

function inferPatternFromSkill(skillKey, sectionId) {
  return textValue(skillKey).split(":")[0] || textValue(sectionId, "geral");
}

function formatPatternLabel(patternKey, group) {
  const knownLabels = {
    add: "Somas e complementos",
    sub: "Subtrações e ajustes",
    mul: "Fatos de multiplicação",
    div: "Famílias de divisão",
    square: "Quadrados",
    mul11: "Multiplicação por 11",
    "same-tens": "Produtos com dezenas iguais",
    "passa-10": "Passagem pelo 10",
    "com-vai-um": "Somas com vai-um",
    "com-emprestimo": "Subtrações com empréstimo",
    "ajuste-redondo": "Ajustes com números redondos",
  };
  return knownLabels[patternKey] ?? `${group.shortLabel}: ${humanize(patternKey)}`;
}

function buildPatternAdvice(group) {
  return `Reforce ${group.label.toLocaleLowerCase("pt-BR")} com um bloco curto e reconhecível.`;
}

function inferChapterSectionIds(chapter, topics, examples) {
  const tokens = [
    ...stringArray(chapter.padroes ?? chapter.patternKeys),
    ...stringArray(chapter.tags),
    ...topics.flatMap((topic) => stringArray(topic?.tags ?? topic?.padroes)),
    ...examples.flatMap((example) => example.tags),
  ].map((token) => token.toLocaleLowerCase("pt-BR"));
  const sectionIds = new Set();
  for (const token of tokens) {
    if (/adi|soma|complemento/.test(token)) sectionIds.add("adicao");
    if (/sub|emprest|diferen/.test(token)) sectionIds.add("subtracao");
    if (/div|quociente|fra[cç]/.test(token)) sectionIds.add("divisao");
    if (/quadr|raiz|cubo|pot[eê]ncia/.test(token)) sectionIds.add("quadrado");
    if (/tabuada|multiplica|vezes|produto/.test(token)) sectionIds.add("tabuada");
    if (/11|final-5|unidades-complementares/.test(token)) sectionIds.add("tricks");
  }
  return [...sectionIds];
}

function inferChapterGroupId(sectionIds) {
  if (!sectionIds.length || sectionIds.length >= 4) return "misto";
  if (sectionIds.every((id) => ["tabuada", "adicao", "subtracao"].includes(id))) return "base";
  if (sectionIds.every((id) => ["quadrado", "tricks"].includes(id))) return "quadrado";
  if (sectionIds.every((id) => ["tabuada", "tricks"].includes(id))) return "tabuada";
  if (sectionIds.length === 1) return getGroup(sectionIds[0]).id;
  return "misto";
}

function formatDifficultyLabel(difficulty) {
  if (difficulty <= 2) return "Fundamentos";
  if (difficulty <= 4) return "Essencial";
  if (difficulty <= 6) return "Intermediário";
  if (difficulty <= 8) return "Avançado";
  if (difficulty <= 10) return "Especialista";
  return "Mestre";
}

function formatChapterPageLabel(chapter) {
  const theory = numberArray(chapter.paginasTeoria ?? chapter.theoryPages);
  const exercises = numberArray(chapter.paginasExercicios ?? chapter.exercisePages);
  const all = [...theory, ...exercises];
  return formatPageLabel(all);
}

function formatPageLabel(rawPages) {
  const pages = numberArray(rawPages).sort((left, right) => left - right);
  if (!pages.length) return "";
  if (pages.length === 1) return `p. ${pages[0]}`;
  return `pp. ${pages[0]}–${pages.at(-1)}`;
}

function normalizeAnswer(answer) {
  if (answer == null || ["string", "number", "boolean"].includes(typeof answer)) {
    return answer ?? null;
  }
  if (!isObject(answer)) return null;
  return answer.exibicao ?? answer.display ?? answer.valor ?? answer.value ?? null;
}

function normalizeSearchText(values) {
  const localized = flatten(values)
    .filter((value) => value != null)
    .map(String)
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  const withoutAccents = localized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
  return `${localized} ${withoutAccents}`;
}

function getPaceRatio(attempt) {
  return isPositiveFinite(attempt.responseTimeMs) && isPositiveFinite(attempt.responseWindowMs)
    ? attempt.responseTimeMs / attempt.responseWindowMs
    : null;
}

function inferPaceRatio(responseTimeMs) {
  if (!isPositiveFinite(responseTimeMs)) return null;
  return clamp(responseTimeMs / 8_000, 0.15, 1.4);
}

function startOfLocalDay(timestamp) {
  const date = new Date(positiveNumber(timestamp, Date.now()));
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function localDateKey(timestamp) {
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp) || numericTimestamp <= 0) return "";
  const date = new Date(numericTimestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function differenceInLocalDays(timestamp, referenceTimestamp) {
  const first = startOfLocalDay(referenceTimestamp);
  const second = startOfLocalDay(timestamp);
  return Math.max(0, Math.round((first - second) / DAY_MS));
}

function standardDeviation(values) {
  const average = mean(values) ?? 0;
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)) ?? 0);
}

function humanize(value) {
  const text = textValue(value, "Geral").replace(/[-_]+/g, " ");
  return `${text.charAt(0).toLocaleUpperCase("pt-BR")}${text.slice(1)}`;
}

function stringArray(value) {
  return [...new Set(arrayValue(value).map((item) => textValue(item)).filter(Boolean))];
}

function numberArray(value) {
  return arrayValue(value).map(Number).filter(Number.isFinite);
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function flatten(values) {
  return arrayValue(values).flat(Infinity);
}

function textValue(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readBoolean(value) {
  return value === true || value === 1 || value === "true";
}

function wholeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function mean(values) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

function isRatio(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function round(value, precision = 4) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
