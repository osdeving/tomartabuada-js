import { useEffect } from "react";

export function useCanvasScene(canvasRef, createScene) {
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return undefined;
    }

    const scene = createScene();
    let animationFrameId = 0;
    let viewport = { width: 1, height: 1, dpr: 1 };

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      viewport = { width, height, dpr };
      scene.resize(viewport);
    }

    function render(now) {
      scene.render({
        context,
        now,
        viewport,
      });
      animationFrameId = window.requestAnimationFrame(render);
    }

    resizeCanvas();
    animationFrameId = window.requestAnimationFrame(render);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.cancelAnimationFrame(animationFrameId);
      scene.dispose?.();
    };
  }, [canvasRef, createScene]);
}
