export function SectionStrip({ sections, activeSectionId, onSelect }) {
  return (
    <section className="panel section-panel">
      <div className="section-strip">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`section-chip${
              section.id === activeSectionId ? " section-chip--active" : ""
            }`}
            type="button"
            onClick={() => onSelect(section.id)}
          >
            <strong>{section.label}</strong>
            <span>{section.kicker}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
