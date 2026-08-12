import { useEffect, useMemo, useRef, useState } from "react";
import { MathExpression } from "../MathExpression";
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
      <span className="sr-only">Buscar na biblioteca de teoria</span>
      <input value={query} onChange={onChange} placeholder="Buscar técnica, passo ou exemplo" />
    </label>
  );
}

function AlgorithmStep({ step, index }) {
  return (
    <li className="theory-algorithm__step">
      <span className="theory-algorithm__number">{String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>{step.action}</strong>
        <p>{step.detail}</p>
        {step.expression ? <code>{step.expression}</code> : null}
      </div>
    </li>
  );
}

function WorkedExample({ example, index }) {
  return (
    <article className="worked-example">
      <header>
        <span>Exemplo resolvido {String(index + 1).padStart(2, "0")}</span>
        {example.page ? <small>p. {example.page}</small> : null}
      </header>
      <div className="worked-example__problem">
        <strong>{example.question}</strong>
        {example.answer ? <span>Resposta: {example.answer}</span> : null}
      </div>
      {example.steps?.length ? (
        <ol className="worked-example__steps">
          {example.steps.map((step, stepIndex) => (
            <li key={`${example.id}-step-${stepIndex}`}>
              <span>{stepIndex + 1}</span>
              <div>
                {step.expression ? <code>{step.expression}</code> : null}
                <p>{step.explanation}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {example.conclusion ? <p className="worked-example__conclusion">{example.conclusion}</p> : null}
    </article>
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
          <h3>{lesson.title}</h3>
          <p>{lesson.summary}</p>
        </div>
        <span className="theory-lesson__toggle" aria-hidden="true">+</span>
      </summary>

      <div className="theory-lesson__content">
        <div className="theory-lesson__context">
          <section className="theory-note theory-note--use">
            <span className="theory-note__icon" aria-hidden="true">◎</span>
            <div>
              <h4>Quando usar</h4>
              <ul>{lesson.whenToUse.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </section>
          <section className="theory-note theory-note--why">
            <span className="theory-note__icon" aria-hidden="true">✦</span>
            <div>
              <h4>Por que funciona</h4>
              <p>{lesson.whyItWorks}</p>
            </div>
          </section>
        </div>

        <section className="theory-algorithm">
          <div className="theory-section-heading">
            <div>
              <p className="eyebrow">Procedimento mental</p>
              <h4>{lesson.algorithm.title}</h4>
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
              <ul>{lesson.pitfalls.map((pitfall) => <li key={pitfall}>{pitfall}</li>)}</ul>
            </section>
          ) : null}
          {lesson.memoryCue ? (
            <aside className="theory-memory-cue">
              <span aria-hidden="true">↯</span>
              <div><small>Guarde isto</small><strong>{lesson.memoryCue}</strong></div>
            </aside>
          ) : null}
        </div>

        <footer className="theory-lesson__source">
          Fonte: calculo-mental-dicas.pdf{lesson.pageLabel ? ` · ${lesson.pageLabel}` : ""}
        </footer>
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
          eyebrow="Biblioteca"
          title="Aprenda o raciocínio, não só a resposta"
          description="Cada dica do material virou uma aula curta: quando usar, por que funciona, algoritmo mental e exemplos resolvidos passo a passo."
          actions={<TheorySearch query={query} onChange={(event) => setQuery(event.target.value)} />}
        />
        <div className="surface empty-library">
          <strong>{chapters.length ? "Nenhuma dica corresponde à busca." : "O conteúdo teórico ainda está sendo carregado."}</strong>
          {chapters.length ? <button className="text-button" type="button" onClick={() => setQuery("")}>Limpar busca</button> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack theory-library-page">
      <PageHeader
        eyebrow="Biblioteca"
        title="Aprenda o raciocínio, não só a resposta"
        description="Cada dica do material virou uma aula curta: quando usar, por que funciona, algoritmo mental e exemplos resolvidos passo a passo."
        actions={<TheorySearch query={query} onChange={(event) => setQuery(event.target.value)} />}
      />

      <div className="theory-layout">
        <aside className="surface chapter-index" aria-label="Capítulos">
          <div className="chapter-index__heading">
            <div><p className="eyebrow">Progressão</p><strong>12 capítulos</strong></div>
            <span>{chapters.reduce((total, chapter) => total + chapter.lessons.length, 0)} dicas</span>
          </div>
          <div className="chapter-index__list">
            {filtered.map((chapter) => (
              <button
                aria-current={chapter.id === active.id ? "page" : undefined}
                key={chapter.id}
                className={chapter.id === active.id ? "is-active" : ""}
                type="button"
                onClick={() => selectChapter(chapter.id)}
              >
                <span>{String(chapter.order).padStart(2, "0")}</span>
                <strong>{chapter.title}</strong>
                <small>{chapter.lessons.length} dicas · {chapter.difficultyLabel}</small>
              </button>
            ))}
          </div>
          {!filtered.length ? <p className="empty-report">Nenhum capítulo corresponde à busca.</p> : null}
        </aside>

        <article className="surface theory-reader" ref={readerRef}>
          <header className="theory-reader__header">
            <div>
              <span className="chapter-pill">Capítulo {String(active.order).padStart(2, "0")} · {active.difficultyLabel}</span>
              <h2 tabIndex="-1">{active.title}</h2>
              <p>{active.summary}</p>
              <div className="theory-reader__stats" aria-label="Conteúdo do capítulo">
                <span><strong>{active.lessons.length}</strong> dicas</span>
                <span><strong>{active.workedExampleCount}</strong> exemplos resolvidos</span>
                <span><strong>{active.algorithmStepCount}</strong> passos explicados</span>
              </div>
            </div>
            <button className="button button--secondary" type="button" onClick={() => onPractice(active)}>
              Praticar capítulo
            </button>
          </header>

          <div className="theory-reader__body">
            {active.prerequisites?.length ? (
              <aside className="theory-prerequisites">
                <span>Antes de começar</span>
                <p>{active.prerequisites.join(" · ")}</p>
              </aside>
            ) : null}

            <p className="sr-only" aria-live="polite">
              {normalizedQuery ? `${visibleLessons.length + visibleExamples.length} resultados encontrados.` : ""}
            </p>

            {visibleLessons.length ? (
              <nav className="theory-lesson-map" aria-label="Dicas deste capítulo">
                <div className="theory-section-heading">
                  <div><p className="eyebrow">Mapa da aula</p><h3>Escolha uma dica</h3></div>
                  <span>{visibleLessons.length} de {active.lessons.length}</span>
                </div>
                <div>
                  {visibleLessons.map((lesson) => (
                    <button key={lesson.id} type="button" onClick={() => scrollToLesson(lesson)}>
                      <span>{String(lesson.order).padStart(2, "0")}</span>{lesson.title}
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
                  <div><p className="eyebrow">Reconhecimento rápido</p><h3>Mais exemplos do material</h3></div>
                  <span>{visibleExamples.length} exemplos <b aria-hidden="true">⌄</b></span>
                </summary>
                <div className="example-grid">
                  {visibleExamples.map((example, index) => (
                    <article key={example.id ?? `${active.id}-example-${index}`}>
                      <span>Exemplo {index + 1}</span>
                      {example.promptLatex ? <MathExpression expression={example.promptLatex} displayMode className="example-math" /> : <strong>{example.prompt}</strong>}
                      {example.answer != null ? <p>Resposta: <strong>{example.answer}</strong></p> : null}
                      {example.note ? <small>{example.note}</small> : null}
                    </article>
                  ))}
                </div>
              </details>
            ) : null}
          </div>

          <footer className="theory-reader__footer">
            <span>Fonte: <strong>calculo-mental-dicas.pdf</strong>{active.pageLabel ? ` · ${active.pageLabel}` : ""}</span>
            <button className="button button--primary" type="button" onClick={() => onPractice(active)}>Reconhecer no treino →</button>
          </footer>
        </article>
      </div>
    </div>
  );
}
