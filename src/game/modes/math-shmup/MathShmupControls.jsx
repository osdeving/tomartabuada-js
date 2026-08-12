export function MathShmupControls({
  onExit,
  onFireDown,
  onFireUp,
  onLeftDown,
  onLeftUp,
  onRightDown,
  onRightUp,
}) {
  return (
    <>
      <button className="game-button game-button--ghost game-button--exit" type="button" onClick={onExit}>
        Sair
      </button>

      <div className="game-controls">
        <button
          className="game-control-button"
          type="button"
          onPointerDown={onLeftDown}
          onPointerUp={onLeftUp}
          onPointerLeave={onLeftUp}
          onTouchCancel={onLeftUp}
        >
          ←
        </button>
        <button
          className="game-control-button game-control-button--fire"
          type="button"
          onPointerDown={onFireDown}
          onPointerUp={onFireUp}
          onPointerLeave={onFireUp}
          onTouchCancel={onFireUp}
        >
          Atirar
        </button>
        <button
          className="game-control-button"
          type="button"
          onPointerDown={onRightDown}
          onPointerUp={onRightUp}
          onPointerLeave={onRightUp}
          onTouchCancel={onRightUp}
        >
          →
        </button>
      </div>
    </>
  );
}
