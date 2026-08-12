import { MathExpression } from "../MathExpression";

export function TheoryPanel({ topics, onJumpToPractice }) {
  return (
    <section className="panel theory-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Métodos</p>
          <h2>Teoria</h2>
          <p className="panel-copy">
            Estratégias curtas para reduzir atrito mental antes de acelerar.
          </p>
        </div>
      </div>

      <div className="theory-grid">
        {topics.map((topic) => (
          <article key={topic.id} className="theory-card">
            <div className="theory-card__head">
              <strong>{topic.title}</strong>
              <span>{topic.summary}</span>
            </div>
            <ol className="theory-steps">
              {topic.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <MathExpression
              expression={topic.exampleLatex}
              displayMode
              className="theory-example"
            />
            {topic.exampleNote ? <p className="panel-copy">{topic.exampleNote}</p> : null}
            <button
              className="ghost-button"
              type="button"
              onClick={() => onJumpToPractice(topic.practice.sectionId, topic.practice.presetId)}
            >
              {topic.practice.label}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
