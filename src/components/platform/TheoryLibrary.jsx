import { useEffect, useMemo, useRef, useState } from "react";
import { MathExpression } from "../MathExpression";
import { WorkedCalculation } from "../theory/WorkedCalculation";
import { PageHeader } from "./AppChrome";

function normalizeSearch(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[×·]/g, "x")
    .replace(/[÷:]/g, "/")
    .replace(/\s+/g, " ");
}

function preserveInitialCase(source, replacement) {
  return source[0] === source[0].toLocaleUpperCase("pt-BR")
    ? replacement[0].toLocaleUpperCase("pt-BR") + replacement.slice(1)
    : replacement;
}

function toAppVoice(value) {
  if (value == null) return "";
  return String(value)
    .replace(/\bum cap[ií]tulo memor[aá]vel\b/gi, (match) => preserveInitialCase(match, "memória em ação"))
    .replace(/\bcap[ií]tulos?\b/gi, (match) => preserveInitialCase(match, /s$/i.test(match) ? "níveis" : "nível"))
    .replace(/\blivros?\b/gi, (match) => preserveInitialCase(match, /s$/i.test(match) ? "conteúdos" : "conteúdo"));
}

function theoryTrackLabel(chapter) {
  return chapter.sourceKind === "full-book" ? "Trilha guiada" : "Exploração livre";
}

function lessonAnchor(lesson) {
  return `dica-${lesson.id}`;
}

function scrollToLesson(lesson) {
  const target = document.getElementById(lessonAnchor(lesson));
  if (!target) return;
  target.open = true;
  const prefersLessMotion = document.documentElement.classList.contains("reduce-motion")
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: prefersLessMotion ? "auto" : "smooth", block: "start" });
  target.querySelector("summary")?.focus({ preventScroll: true });
}

function TheorySearch({ query, onChange }) {
  return (
    <label className="theory-search">
      <span aria-hidden="true">⌕</span>
      <span className="sr-only">Buscar nas técnicas de cálculo mental</span>
      <input value={query} onChange={onChange} placeholder="Buscar técnica, passo ou exemplo" />
    </label>
  );
}

function AlgorithmStep({ step, index }) {
  return (
    <li className="theory-algorithm__step">
      <span className="theory-algorithm__number">{String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>{toAppVoice(step.action)}</strong>
        <p>{toAppVoice(step.detail)}</p>
        {step.expression ? <code>{toAppVoice(step.expression)}</code> : null}
      </div>
    </li>
  );
}

function WorkedExample({ example, index }) {
  return (
    <article className="worked-example">
      <header>
        <span>Exemplo resolvido {String(index + 1).padStart(2, "0")}</span>
      </header>
      <div className="worked-example__problem">
        <strong>{toAppVoice(example.question)}</strong>
        {example.answer ? <span>Resposta: {toAppVoice(example.answer)}</span> : null}
      </div>
      {example.visual ? <WorkedCalculation visual={example.visual} /> : null}
      {example.steps?.length ? (
        <ol className="worked-example__steps">
          {example.steps.map((step, stepIndex) => (
            <li key={`${example.id}-step-${stepIndex}`}>
              <span>{stepIndex + 1}</span>
              <div>
                {step.expression ? <code>{toAppVoice(step.expression)}</code> : null}
                <p>{toAppVoice(step.explanation)}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {example.conclusion ? <p className="worked-example__conclusion">{toAppVoice(example.conclusion)}</p> : null}
    </article>
  );
}

function ChapterProgression({ chapters, active, onSelect }) {
  if (active.sourceKind !== "full-book") return null;
  const mainChapters = chapters.filter((chapter) => chapter.sourceKind === "full-book");
  const activeIndex = mainChapters.findIndex((chapter) => chapter.id === active.id);
  const previous = mainChapters[activeIndex - 1] ?? null;
  const next = mainChapters[activeIndex + 1] ?? null;

  return (
    <nav className="theory-progression" aria-label="Progressão da trilha principal">
      {previous ? (
        <button type="button" onClick={() => onSelect(previous.id)}>
          <small>← Etapa anterior · {previous.difficultyLabel}</small>
          <strong>{toAppVoice(previous.title)}</strong>
        </button>
      ) : <span />}
      {next ? (
        <button type="button" onClick={() => onSelect(next.id)}>
          <small>Próxima etapa · {next.difficultyLabel} →</small>
          <strong>{toAppVoice(next.title)}</strong>
        </button>
      ) : null}
    </nav>
  );
}

function TheoryLesson({ lesson, index, expandForSearch }) {
  const displayOrder = lesson.order ?? index + 1;
  return (
    <details
      className="theory-lesson"
      id={lessonAnchor(lesson)}
      open={expandForSearch || index === 0}
    >
      <summary>
        <span className="theory-lesson__number">Dica {String(displayOrder).padStart(2, "0")}</span>
        <div>
          <h3>{toAppVoice(lesson.title)}</h3>
          <p>{toAppVoice(lesson.summary)}</p>
        </div>
        <span className="theory-lesson__toggle" aria-hidden="true">+</span>
      </summary>

      <div className="theory-lesson__content">
        <div className="theory-lesson__context">
          <section className="theory-note theory-note--use">
            <span className="theory-note__icon" aria-hidden="true">◎</span>
            <div>
              <h4>Quando usar</h4>
              <ul>{lesson.whenToUse.map((item) => <li key={item}>{toAppVoice(item)}</li>)}</ul>
            </div>
          </section>
          <section className="theory-note theory-note--why">
            <span className="theory-note__icon" aria-hidden="true">✦</span>
            <div>
              <h4>Por que funciona</h4>
              <p>{toAppVoice(lesson.whyItWorks)}</p>
            </div>
          </section>
        </div>

        <section className="theory-algorithm">
          <div className="theory-section-heading">
            <div>
              <p className="eyebrow">Procedimento mental</p>
              <h4>{toAppVoice(lesson.algorithm.title)}</h4>
            </div>
            <span>{lesson.algorithm.steps.length} passos</span>
          </div>
          <ol>
            {lesson.algorithm.steps.map((step, stepIndex) => (
              <AlgorithmStep key={`${lesson.id}-algorithm-${stepIndex}`} index={stepIndex} step={step} />
            ))}
          </ol>
        </section>

        {lesson.workedExamples.length ? (
          <section className="worked-examples">
            <div className="theory-section-heading">
              <div>
                <p className="eyebrow">Veja o raciocínio</p>
                <h4>Exemplos comentados</h4>
              </div>
              <span>{lesson.workedExamples.length}</span>
            </div>
            <div className="worked-examples__grid">
              {lesson.workedExamples.map((example, exampleIndex) => (
                <WorkedExample example={example} index={exampleIndex} key={example.id} />
              ))}
            </div>
          </section>
        ) : null}

        <div className="theory-lesson__finish">
          {lesson.pitfalls.length ? (
            <section className="theory-pitfalls">
              <h4>Evite estas armadilhas</h4>
              <ul>{lesson.pitfalls.map((pitfall) => <li key={pitfall}>{toAppVoice(pitfall)}</li>)}</ul>
            </section>
          ) : null}
          {lesson.memoryCue ? (
            <aside className="theory-memory-cue">
              <span aria-hidden="true">↯</span>
              <div><small>Guarde isto</small><strong>{toAppVoice(lesson.memoryCue)}</strong></div>
            </aside>
          ) : null}
        </div>

      </div>
    </details>
  );
}

export function TheoryLibrary({ chapters, initialChapterId, initialLessonId, onPractice }) {
  const readerRef = useRef(null);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(initialChapterId ?? chapters[0]?.id);
  const normalizedQuery = normalizeSearch(query);
  const filtered = useMemo(
    () => chapters.filter((chapter) => !normalizedQuery || chapter.searchText.includes(normalizedQuery)),
    [chapters, normalizedQuery],
  );
  const active = filtered.find((chapter) => chapter.id === activeId)
    ?? filtered[0]
    ?? (normalizedQuery ? null : chapters[0]);
  const visibleLessons = useMemo(() => {
    if (!active) return [];
    if (!normalizedQuery || active.headerSearchText.includes(normalizedQuery) || active.topicSearchText.includes(normalizedQuery)) return active.lessons;
    return active.lessons.filter((lesson) => lesson.searchText.includes(normalizedQuery));
  }, [active, normalizedQuery]);
  const visibleExamples = useMemo(() => {
    if (!active) return [];
    if (!normalizedQuery || active.headerSearchText.includes(normalizedQuery) || active.topicSearchText.includes(normalizedQuery)) return active.examples;
    return active.examples.filter((example) => example.searchText.includes(normalizedQuery));
  }, [active, normalizedQuery]);
  const showExampleSearchResults = Boolean(
    normalizedQuery
    && !active?.headerSearchText.includes(normalizedQuery)
    && !active?.topicSearchText.includes(normalizedQuery)
    && visibleExamples.length,
  );

  useEffect(() => {
    if (!initialLessonId) return undefined;
    const lesson = chapters.flatMap((chapter) => chapter.lessons).find((item) => item.id === initialLessonId);
    if (!lesson) return undefined;
    const frame = requestAnimationFrame(() => scrollToLesson(lesson));
    return () => cancelAnimationFrame(frame);
  }, [chapters, initialLessonId]);

  function selectChapter(chapterId) {
    setActiveId(chapterId);
    requestAnimationFrame(() => {
      const target = readerRef.current;
      if (!target) return;
      const prefersLessMotion = document.documentElement.classList.contains("reduce-motion")
        || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: prefersLessMotion ? "auto" : "smooth", block: "start" });
      target.querySelector("h2")?.focus({ preventScroll: true });
    });
  }

  if (!active) {
    return (
      <div className="page-stack theory-library-page">
        <PageHeader
          eyebrow="Técnicas"
          title="Aprenda o raciocínio, não só a resposta"
          description="Siga uma trilha prática com explicações, contas armadas, algoritmos mentais e exemplos que avançam um passo por vez."
          actions={<TheorySearch query={query} onChange={(event) => setQuery(event.target.value)} />}
        />
        <div className="surface empty-library">
          <strong>{chapters.length ? "Nenhuma dica corresponde à busca." : "Abrindo a trilha principal…"}</strong>
          {!chapters.length ? <span className="library-loader" aria-hidden="true" /> : null}
          {chapters.length ? <button className="text-button" type="button" onClick={() => setQuery("")}>Limpar busca</button> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack theory-library-page">
      <PageHeader
        eyebrow="Técnicas"
        title="Aprenda o raciocínio, não só a resposta"
        description="Siga uma trilha prática com explicações, contas armadas, algoritmos mentais e exemplos que avançam um passo por vez."
        actions={<TheorySearch query={query} onChange={(event) => setQuery(event.target.value)} />}
      />

      <div className="theory-layout">
        <aside className="surface chapter-index" aria-label="Trilhas de domínio">
          <div className="chapter-index__heading">
            <div><p className="eyebrow">Progressão</p><strong>{chapters.filter((chapter) => chapter.sourceKind === "full-book").length} etapas guiadas</strong></div>
            <span>{chapters.reduce((total, chapter) => total + chapter.lessons.length, 0)} técnicas</span>
          </div>
          <div className="chapter-index__list">
            {filtered.map((chapter, chapterIndex) => (
              <div className="chapter-index__entry" key={chapter.id}>
                {chapterIndex === 0 || filtered[chapterIndex - 1]?.sourceKind !== chapter.sourceKind ? (
                  <p className="chapter-index__source-label">
                    {chapter.sourceKind === "full-book" ? "Trilha guiada" : "Exploração livre"}
                  </p>
                ) : null}
                <button
                  aria-current={chapter.id === active.id ? "page" : undefined}
                  className={chapter.id === active.id ? "is-active" : ""}
                  type="button"
                  onClick={() => selectChapter(chapter.id)}
                >
                  <span>{chapter.difficultyLabel}</span>
                  <strong>{toAppVoice(chapter.title)}</strong>
                  <small>{chapter.lessons.length} técnicas · {theoryTrackLabel(chapter)}</small>
                </button>
              </div>
            ))}
          </div>
          {!filtered.length ? <p className="empty-report">Nenhuma técnica corresponde à busca.</p> : null}
        </aside>

        <article className="surface theory-reader" ref={readerRef}>
          <header className="theory-reader__header">
            <div>
              <span className="chapter-pill">
                {theoryTrackLabel(active)} · {active.difficultyLabel}
              </span>
              <h2 tabIndex="-1">{toAppVoice(active.title)}</h2>
              <p>{toAppVoice(active.summary)}</p>
              <div className="theory-reader__stats" aria-label="Conteúdo desta etapa">
                <span><strong>{active.lessons.length}</strong> dicas</span>
                <span><strong>{active.workedExampleCount}</strong> exemplos resolvidos</span>
                <span><strong>{active.algorithmStepCount}</strong> passos explicados</span>
              </div>
            </div>
            <button className="button button--secondary" type="button" onClick={() => onPractice(active)}>
              Praticar estas técnicas
            </button>
          </header>

          <div className="theory-reader__body">
            {active.prerequisites?.length ? (
              <aside className="theory-prerequisites">
                <span>Antes de começar</span>
                <p>{active.prerequisites.map(toAppVoice).join(" · ")}</p>
              </aside>
            ) : null}

            <p className="sr-only" aria-live="polite">
              {normalizedQuery ? `${visibleLessons.length + visibleExamples.length} resultados encontrados.` : ""}
            </p>

            {visibleLessons.length ? (
              <nav className="theory-lesson-map" aria-label="Técnicas desta etapa">
                <div className="theory-section-heading">
                  <div><p className="eyebrow">Mapa de técnicas</p><h3>Escolha uma dica</h3></div>
                  <span>{visibleLessons.length} de {active.lessons.length}</span>
                </div>
                <div>
                  {visibleLessons.map((lesson) => (
                    <button key={lesson.id} type="button" onClick={() => scrollToLesson(lesson)}>
                      <span>{String(lesson.order).padStart(2, "0")}</span>{toAppVoice(lesson.title)}
                    </button>
                  ))}
                </div>
              </nav>
            ) : null}

            <div className="theory-lessons">
              {visibleLessons.map((lesson, index) => (
                <TheoryLesson
                  expandForSearch={Boolean(normalizedQuery && lesson.searchText.includes(normalizedQuery))}
                  index={index}
                  key={lesson.id}
                  lesson={lesson}
                />
              ))}
            </div>

            {visibleExamples.length ? (
              <details className="theory-examples" open={showExampleSearchResults}>
                <summary>
                  <div><p className="eyebrow">Reconhecimento rápido</p><h3>Mais exemplos</h3></div>
                  <span>{visibleExamples.length} exemplos <b aria-hidden="true">⌄</b></span>
                </summary>
                <div className="example-grid">
                  {visibleExamples.map((example, index) => (
                    <article key={example.id ?? `${active.id}-example-${index}`}>
                      <span>Exemplo {index + 1}</span>
                      {example.promptLatex ? <MathExpression expression={example.promptLatex} displayMode className="example-math" /> : <strong>{toAppVoice(example.prompt)}</strong>}
                      {example.answer != null ? <p>Resposta: <strong>{toAppVoice(example.answer)}</strong></p> : null}
                      {example.note ? <small>{toAppVoice(example.note)}</small> : null}
                    </article>
                  ))}
                </div>
              </details>
            ) : null}
          </div>

          <footer className="theory-reader__footer">
            <button className="button button--primary" type="button" onClick={() => onPractice(active)}>Reconhecer no treino →</button>
          </footer>
          <ChapterProgression active={active} chapters={chapters} onSelect={selectChapter} />
        </article>
      </div>
    </div>
  );
}
