import { CountdownOverlay } from "./CountdownOverlay";
import type { useGameStartCountdown } from "../hooks/useGameStartCountdown";

type CountdownController = ReturnType<typeof useGameStartCountdown>;

interface GameStartCountdownProps {
  controller: CountdownController;
  label?: string;
}

export function GameStartCountdown({ controller, label }: GameStartCountdownProps) {
  if (controller.countdownValue === null) {
    return null;
  }

  return (
    <CountdownOverlay
      label={label}
      opacity={controller.countdownOpacity}
      scale={controller.countdownScale}
      value={controller.countdownValue}
    />
  );
}
