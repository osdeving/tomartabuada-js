import { MathExpression } from "../MathExpression";

export function PracticeSetupPanel({
  activePreset,
  activePresetId,
  activeSection,
  presets,
  trickLessons,
  onSelectPreset,
}) {
  return (
    <section className="panel control-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{activeSection.kicker}</p>
          <h2>{activeSection.label}</h2>
          <p className="panel-copy">{activeSection.description}</p>
        </div>
        <div className="status-pill">
          <strong>{activePreset?.label}</strong>
          <span>{activePreset?.detail}</span>
        </div>
      </div>

      <div className="preset-row">
        {presets.map((preset) => (
          <button
            key={preset.id}
            className={`preset-chip${
              preset.id === activePresetId ? " preset-chip--active" : ""
            }`}
            type="button"
            onClick={() => onSelectPreset(activeSection.id, preset.id)}
          >
            <strong>{preset.label}</strong>
            <span>{preset.detail}</span>
          </button>
        ))}
      </div>

      {activeSection.id === "tricks" ? (
        <div className="lesson-grid">
          {trickLessons.map((lesson) => (
            <button
              key={lesson.id}
              className={`lesson-card${
                lesson.presetId === activePresetId ? " lesson-card--active" : ""
              }`}
              type="button"
              onClick={() => onSelectPreset("tricks", lesson.presetId)}
            >
              <strong>{lesson.title}</strong>
              <span className="lesson-card__rule">{lesson.rule}</span>
              <MathExpression
                expression={lesson.exampleLatex}
                className="lesson-card__math"
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
