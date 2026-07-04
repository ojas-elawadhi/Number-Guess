import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect } from "react";

import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import { useTutorialStore } from "../store/useTutorialStore";
import type { PlayerProfile } from "../types/progression.types";
import { sendTutorialEvent } from "../utils/tutorialAnalytics";

export const TUTORIAL_DONE_LOCAL_KEY = "code-wars:tutorial-done-local";

// Existing players were persisted with tutorialSeen: false before the tutorial
// shipped, so the flag alone cannot distinguish a new player from a veteran.
const isFreshProfile = (profile: PlayerProfile) =>
  profile.stats.matches === 0 &&
  profile.stats.practiceMatches === 0 &&
  profile.history.length === 0 &&
  profile.xp === 0;

export const useTutorialGate = () => {
  const hydrated = usePlayerProgressStore((state) => state.hydrated);
  const progressReady = usePlayerProgressStore((state) => state.progressReady);
  const progressSynced = usePlayerProgressStore((state) => state.progressSynced);
  const playerKey = usePlayerProgressStore((state) => state.playerKey);
  const tutorialSeen = usePlayerProgressStore((state) => state.profile.tutorialSeen);

  useEffect(() => {
    if (!hydrated || !progressReady || !progressSynced || !playerKey) {
      return;
    }

    let cancelled = false;

    const evaluate = async () => {
      const tutorialStore = useTutorialStore.getState();

      if (tutorialStore.phase !== "idle" || tutorialStore.triggeredThisSession) {
        return;
      }

      const progressStore = usePlayerProgressStore.getState();
      const profile = progressStore.profile;
      const doneLocally = await AsyncStorage.getItem(TUTORIAL_DONE_LOCAL_KEY).catch(() => null);

      if (cancelled) {
        return;
      }

      if (doneLocally) {
        // The tutorial finished but the server write failed at the time; heal it.
        if (!profile.tutorialSeen && !tutorialStore.backfillAttempted) {
          tutorialStore.markBackfillAttempted();
          progressStore.markTutorialSeen().catch(() => undefined);
        }
        return;
      }

      if (profile.tutorialSeen) {
        return;
      }

      if (!isFreshProfile(profile)) {
        if (!tutorialStore.backfillAttempted) {
          tutorialStore.markBackfillAttempted();
          progressStore.markTutorialSeen().catch(() => undefined);
        }
        return;
      }

      tutorialStore.markTriggered();
      tutorialStore.setPhase("round");
      sendTutorialEvent("started");
      router.replace("/tutorial");
    };

    void evaluate();

    return () => {
      cancelled = true;
    };
  }, [hydrated, progressReady, progressSynced, playerKey, tutorialSeen]);
};
