import { useCallback, useEffect, useMemo, useState } from "react";
import { GameCanvas } from "../../GameCanvas";
import { MATH_SHMUP_CONFIG } from "./config";
import { createMathShmupScene } from "./createMathShmupScene";
import { MathShmupControls } from "./MathShmupControls";
import { MathShmupHud } from "./MathShmupHud";
import { useGameAudio } from "./useGameAudio";

export function MathShmupGame({ onExit }) {
  const [snapshot, setSnapshot] = useState({
    problemDisplay: {
      formulaLabel: "",
      questionLabel: "",
      topLine: "",
      bottomLine: "",
      topDecomposition: "",
      bottomDecomposition: "",
    },
    currentPrompt: null,
    openingPrompts: [],
    activePathLabel: null,
    paths: [],
    feedback: { tone: "neutral", text: "" },
  });
  const audio = useGameAudio();
  const scene = useMemo(
    () =>
      createMathShmupScene({
        config: MATH_SHMUP_CONFIG,
        onSnapshot: setSnapshot,
        onGoodHit: audio.playGood,
        onBadHit: audio.playBad,
      }),
    [audio.playBad, audio.playGood],
  );
  const sceneFactory = useCallback(() => scene, [scene]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.repeat) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        scene.setControl("left", true);
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        scene.setControl("right", true);
      }

      if (event.key === " " || event.key === "ArrowUp") {
        event.preventDefault();
        audio.unlock();
        scene.setControl("firing", true);
      }
    }

    function handleKeyUp(event) {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        scene.setControl("left", false);
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        scene.setControl("right", false);
      }

      if (event.key === " " || event.key === "ArrowUp") {
        scene.setControl("firing", false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [audio, scene]);

  function handleCanvasPointerDown(event) {
    audio.unlock();
    const rect = event.currentTarget.getBoundingClientRect();
    scene.pointerDown(event.clientX - rect.left);
  }

  function handleCanvasPointerMove(event) {
    if (event.buttons === 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    scene.pointerMove(event.clientX - rect.left);
  }

  function handleCanvasPointerUp() {
    scene.pointerUp();
  }

  return (
    <section className="game-shell">
      <GameCanvas
        sceneFactory={sceneFactory}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerLeave={handleCanvasPointerUp}
      />

      <div className="game-hud">
        <MathShmupHud snapshot={snapshot} />
      </div>

      <MathShmupControls
        onExit={onExit}
        onFireDown={() => {
          audio.unlock();
          scene.setControl("firing", true);
        }}
        onFireUp={() => scene.setControl("firing", false)}
        onLeftDown={() => scene.setControl("left", true)}
        onLeftUp={() => scene.setControl("left", false)}
        onRightDown={() => scene.setControl("right", true)}
        onRightUp={() => scene.setControl("right", false)}
      />

      <div className="game-footer">
        <span>shmup</span>
        <span>multiplicação</span>
        <span>esquerda → direita</span>
      </div>
    </section>
  );
}
