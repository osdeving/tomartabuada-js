import { useRef } from "react";
import { useCanvasScene } from "./useCanvasScene";

export function GameCanvas({
  sceneFactory,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}) {
  const canvasRef = useRef(null);

  useCanvasScene(canvasRef, sceneFactory);

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    />
  );
}
