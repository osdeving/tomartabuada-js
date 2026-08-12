import "./game.css";
import { MathShmupGame } from "./modes/math-shmup/MathShmupGame";

export function GameSection({ onExit }) {
  return <MathShmupGame onExit={onExit} />;
}
