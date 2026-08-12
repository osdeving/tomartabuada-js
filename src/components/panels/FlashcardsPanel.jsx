import { MetricCard } from "../common/MetricCard";
import { MathExpression } from "../MathExpression";

export function FlashcardsPanel({
  activeFlashcard,
  decks,
  flashcardDeck,
  flashcardIndex,
  isRevealed,
  onMove,
  onSelectDeck,
  onShuffle,
  onToggle,
}) {
  return (
    <section className="panel flashcards-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Revisão</p>
          <h2>Flashcards</h2>
          <p className="panel-copy">
            Revisão curta para manter padrões e famílias sempre quentes.
          </p>
        </div>
        <div className="status-pill">
          <strong>{flashcardDeck.label}</strong>
          <span>{flashcardDeck.detail}</span>
        </div>
      </div>

      <div className="deck-row">
        {decks.map((deck) => (
          <button
            key={deck.id}
            className={`deck-chip${
              deck.id === flashcardDeck.id ? " deck-chip--active" : ""
            }`}
            type="button"
            onClick={() => onSelectDeck(deck.id)}
          >
            <strong>{deck.label}</strong>
            <span>{deck.cards.length} cards</span>
          </button>
        ))}
      </div>

      <div className="flashcard-layout">
        <button
          className={`flashcard${isRevealed ? " flashcard--revealed" : ""}`}
          type="button"
          onClick={onToggle}
        >
          <span className="flashcard__eyebrow">{isRevealed ? "verso" : "frente"}</span>
          {isRevealed ? (
            activeFlashcard?.backLatex ? (
              <MathExpression
                expression={activeFlashcard.backLatex}
                displayMode
                className="flashcard__math"
              />
            ) : (
              <strong className="flashcard__content">{activeFlashcard?.back}</strong>
            )
          ) : activeFlashcard?.frontLatex ? (
            <MathExpression
              expression={activeFlashcard.frontLatex}
              displayMode
              className="flashcard__math"
            />
          ) : (
            <strong className="flashcard__content">{activeFlashcard?.front}</strong>
          )}
          {isRevealed && activeFlashcard?.note ? (
            <p className="flashcard__note">{activeFlashcard.note}</p>
          ) : null}
          <span className="flashcard__hint">toque para virar</span>
        </button>

        <div className="flashcard-side">
          <div className="micro-metrics">
            <MetricCard
              label="Deck"
              value={flashcardDeck.label}
              detail={`${flashcardDeck.cards.length} cards`}
              accent
            />
            <MetricCard
              label="Posição"
              value={`${flashcardIndex + 1}`}
              detail={`de ${flashcardDeck.cards.length}`}
            />
          </div>

          <div className="action-row action-row--stack">
            <button className="primary-button" type="button" onClick={onToggle}>
              Virar
            </button>
            <button className="ghost-button" type="button" onClick={() => onMove(-1)}>
              Anterior
            </button>
            <button className="ghost-button" type="button" onClick={() => onMove(1)}>
              Próxima
            </button>
            <button className="ghost-button" type="button" onClick={onShuffle}>
              Embaralhar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
