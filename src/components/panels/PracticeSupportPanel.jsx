export function PracticeSupportPanel({
  activePresetId,
  activeSection,
  primers,
  isTabuadaHighlighted,
}) {
  return (
    <section className="panel support-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Apoio</p>
          <h2>Referências rápidas</h2>
        </div>
      </div>

      <div className="support-grid">
        {primers.map((primer) => (
          <article key={primer.title} className="support-card">
            <strong>{primer.title}</strong>
            <p>{primer.body}</p>
          </article>
        ))}
      </div>

      {activeSection.id === "tabuada" ? (
        <div className="table-card">
          <div className="table-card__head">
            <strong>Mapa da tabuada</strong>
            <span>O preset atual destaca a faixa ativa.</span>
          </div>
          <div className="table-grid">
            <div className="table-grid__corner">×</div>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((column) => (
              <div key={`head-${column}`} className="table-grid__label">
                {column}
              </div>
            ))}
            {Array.from({ length: 10 }, (_, rowIndex) => rowIndex + 1).map((row) => (
              <FragmentRow
                key={row}
                row={row}
                activePresetId={activePresetId}
                isTabuadaHighlighted={isTabuadaHighlighted}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FragmentRow({ row, activePresetId, isTabuadaHighlighted }) {
  return (
    <>
      <div className="table-grid__label">{row}</div>
      {Array.from({ length: 10 }, (_, columnIndex) => columnIndex + 1).map((column) => {
        const active = isTabuadaHighlighted(activePresetId, row, column);

        return (
          <div
            key={`${row}-${column}`}
            className={`table-grid__cell${
              active ? " table-grid__cell--active" : ""
            }`}
          >
            {row * column}
          </div>
        );
      })}
    </>
  );
}
