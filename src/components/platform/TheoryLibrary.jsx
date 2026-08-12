import { useMemo, useState } from "react";
import { MathExpression } from "../MathExpression";
import { PageHeader } from "./AppChrome";

export function TheoryLibrary({ chapters, initialChapterId, onPractice }) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(initialChapterId ?? chapters[0]?.id);
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = useMemo(
    () => chapters.filter((chapter) => !normalizedQuery || chapter.searchText.includes(normalizedQuery)),
    [chapters, normalizedQuery],
  );
  const active = filtered.find((chapter) => chapter.id === activeId) ?? filtered[0] ?? chapters[0];

  if (!active) {
    return <div className="surface empty-library">O conteúdo teórico ainda está sendo carregado.</div>;
  }

  return (
    <div className="page-stack theory-library-page">
      <PageHeader
        eyebrow="Biblioteca"
        title="Entenda, reconheça, responda"
        description="A teoria segue a ordem do material e liga cada técnica a exemplos que também aparecem no treino."
        actions={
          <label className="theory-search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar técnica ou exemplo" />
          </label>
        }
      />

      <div className="theory-layout">
        <aside className="surface chapter-index" aria-label="Capítulos">
          <p className="eyebrow">Progressão</p>
          <div className="chapter-index__list">
            {filtered.map((chapter) => (
              <button
                key={chapter.id}
                className={chapter.id === active.id ? "is-active" : ""}
                type="button"
                onClick={() => setActiveId(chapter.id)}
              >
                <span>{String(chapter.order).padStart(2, "0")}</span>
                <strong>{chapter.title}</strong>
                <small>{chapter.difficultyLabel}</small>
              </button>
            ))}
          </div>
          {!filtered.length ? <p className="empty-report">Nenhum capítulo corresponde à busca.</p> : null}
        </aside>

        <article className="surface theory-reader">
          <header className="theory-reader__header">
            <div>
              <span className="chapter-pill">Capítulo {String(active.order).padStart(2, "0")} · {active.difficultyLabel}</span>
              <h2>{active.title}</h2>
              <p>{active.summary}</p>
            </div>
            <button className="button button--secondary" type="button" onClick={() => onPractice(active)}>
              Praticar capítulo
            </button>
          </header>

          <div className="theory-reader__body">
            {active.topics.map((topic, index) => (
              <section className="theory-topic" key={topic.id ?? `${active.id}-${index}`}>
                <span className="theory-topic__number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{topic.title}</h3>
                  {topic.summary ? <p>{topic.summary}</p> : null}
                  {topic.steps?.length ? <ol>{topic.steps.map((step) => <li key={step}>{step}</li>)}</ol> : null}
                  {topic.formulaText ? <code className="theory-formula theory-formula--text">{topic.formulaText}</code> : null}
                </div>
              </section>
            ))}

            {active.examples.length ? (
              <section className="theory-examples">
                <div className="section-title-row"><div><p className="eyebrow">Reconhecimento</p><h3>Exemplos do material</h3></div><span>{active.examples.length} exemplos</span></div>
                <div className="example-grid">
                  {active.examples.map((example, index) => (
                    <article key={example.id ?? `${active.id}-example-${index}`}>
                      <span>Exemplo {index + 1}</span>
                      {example.promptLatex ? <MathExpression expression={example.promptLatex} displayMode className="example-math" /> : <strong>{example.prompt}</strong>}
                      {example.answer != null ? <p>Resposta: <strong>{example.answer}</strong></p> : null}
                      {example.note ? <small>{example.note}</small> : null}
                    </article>
                  ))}
                </div>
              </section>
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
