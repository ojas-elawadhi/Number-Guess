import { create } from "zustand";

export type TutorialPhase = "idle" | "round" | "callouts" | "done";

interface TutorialStore {
  phase: TutorialPhase;
  calloutStep: number;
  triggeredThisSession: boolean;
  backfillAttempted: boolean;
  // Replay runs (launched from settings) make no profile writes, award no
  // coins, and log no funnel events.
  replayMode: boolean;
  setPhase: (phase: TutorialPhase) => void;
  setCalloutStep: (calloutStep: number) => void;
  markTriggered: () => void;
  markBackfillAttempted: () => void;
  startReplay: () => void;
}

export const useTutorialStore = create<TutorialStore>((set) => ({
  phase: "idle",
  calloutStep: 0,
  triggeredThisSession: false,
  backfillAttempted: false,
  replayMode: false,
  setPhase: (phase) => set({ phase }),
  setCalloutStep: (calloutStep) => set({ calloutStep }),
  markTriggered: () => set({ triggeredThisSession: true, replayMode: false }),
  markBackfillAttempted: () => set({ backfillAttempted: true }),
  startReplay: () => set({ phase: "round", calloutStep: 0, replayMode: true })
}));
