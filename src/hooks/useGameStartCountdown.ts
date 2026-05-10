import { useCountdownOverlay } from "./useCountdownOverlay";

export function useGameStartCountdown(initialValue = 3) {
  return useCountdownOverlay(initialValue);
}
