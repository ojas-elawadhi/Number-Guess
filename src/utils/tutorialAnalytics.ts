import { sendTutorialEventRemote } from "../api/progressionApi";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";

export type TutorialEventName = "started" | "completed" | "skipped_round" | "callouts_done" | "callouts_skipped";

export const sendTutorialEvent = (event: TutorialEventName) => {
  console.log(`[tutorial] ${event}`);

  const playerKey = usePlayerProgressStore.getState().playerKey;

  if (!playerKey) {
    return;
  }

  sendTutorialEventRemote(playerKey, event).catch(() => undefined);
};
