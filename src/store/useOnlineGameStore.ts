import { create } from "zustand";

import type {
  Difficulty,
  GameOverPayload,
  GameStartedPayload,
  GameState,
  GuessHistoryItem,
  GuessResultPayload,
  OnlineMode,
  Player,
  PublicRoom,
  RoundStatus
} from "../types/game.types";

interface OnlineGameStore {
  player: Player | null;
  room: PublicRoom | null;
  gameState: GameState;
  matchStartedAt: number | null;
  lastGuessResult: GuessResultPayload | null;
  guessHistory: GuessHistoryItem[];
  personalSecretNumber: number | null;
  isConnected: boolean;
  errorMessage: string | null;
  setConnectionStatus: (isConnected: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  setPersonalSecretNumber: (value: number | null) => void;
  setSession: (player: Player, room: PublicRoom, fallbackMode?: OnlineMode) => void;
  setRoom: (room: PublicRoom) => void;
  setGameStarted: (payload: GameStartedPayload) => void;
  setGuessResult: (payload: GuessResultPayload) => void;
  setGameOver: (payload: GameOverPayload) => void;
  resetRoundState: () => void;
  resetAll: () => void;
}

const initialState = {
  player: null,
  room: null,
  gameState: "waiting" as GameState,
  matchStartedAt: null,
  lastGuessResult: null,
  guessHistory: [] as GuessHistoryItem[],
  personalSecretNumber: null,
  isConnected: false,
  errorMessage: null
};

const normalizeRoom = (
  room: PublicRoom,
  options?: {
    fallbackMode?: OnlineMode;
    fallbackDifficulty?: Difficulty;
    previousRoom?: PublicRoom | null;
  }
): PublicRoom => {
  const legacyRoom = room as Partial<PublicRoom>;
  const mode: OnlineMode =
    legacyRoom.mode ?? options?.previousRoom?.mode ?? options?.fallbackMode ?? "classic";
  const difficulty: Difficulty =
    legacyRoom.difficulty ?? options?.previousRoom?.difficulty ?? options?.fallbackDifficulty ?? "easy";

  return {
    ...room,
    mode,
    difficulty,
    maxNumber:
      legacyRoom.maxNumber ??
      options?.previousRoom?.maxNumber ??
      (difficulty === "easy" ? 99 : difficulty === "hard" ? 999 : 9999),
    maxPlayers: legacyRoom.maxPlayers ?? options?.previousRoom?.maxPlayers ?? (mode === "duel" ? 2 : 6),
    winner: legacyRoom.winner ?? options?.previousRoom?.winner ?? null,
    winnerIds:
      legacyRoom.winnerIds ??
      options?.previousRoom?.winnerIds ??
      (legacyRoom.winner ? [legacyRoom.winner] : []),
    roundNumber: legacyRoom.roundNumber ?? options?.previousRoom?.roundNumber ?? 0,
    roundStatus: legacyRoom.roundStatus ?? options?.previousRoom?.roundStatus ?? ("idle" as RoundStatus),
    roundEndsAt: legacyRoom.roundEndsAt ?? options?.previousRoom?.roundEndsAt ?? null,
    roundDurationSeconds:
      legacyRoom.roundDurationSeconds ?? options?.previousRoom?.roundDurationSeconds ?? 15,
    submittedPlayerIds: legacyRoom.submittedPlayerIds ?? options?.previousRoom?.submittedPlayerIds ?? [],
    secretSubmittedPlayerIds:
      legacyRoom.secretSubmittedPlayerIds ?? options?.previousRoom?.secretSubmittedPlayerIds ?? []
  };
};

export const useOnlineGameStore = create<OnlineGameStore>((set) => ({
  ...initialState,
  setConnectionStatus: (isConnected) => set({ isConnected }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setPersonalSecretNumber: (personalSecretNumber) => set({ personalSecretNumber }),
  setSession: (player, room, fallbackMode) =>
    set({
      player,
      room: normalizeRoom(room, { fallbackMode }),
      gameState: room.gameState,
      matchStartedAt: null,
      personalSecretNumber: null,
      errorMessage: null
    }),
  setRoom: (room) =>
    set((state) => ({
      room: normalizeRoom(room, { previousRoom: state.room }),
      gameState: room.gameState
    })),
  setGameStarted: ({ room }) =>
    set((state) => ({
      room: normalizeRoom(room, { previousRoom: state.room }),
      gameState: room.gameState,
      matchStartedAt: Date.now(),
      personalSecretNumber: null,
      lastGuessResult: null,
      guessHistory: [],
      errorMessage: null
    })),
  setGuessResult: (payload) =>
    set((state) => ({
      lastGuessResult: payload,
      guessHistory: [
        {
          guess: payload.guess,
          roundNumber: payload.roundNumber,
          result: payload.result
        },
        ...state.guessHistory
      ].slice(0, 10)
    })),
  setGameOver: ({ room }) =>
    set((state) => ({
      room: normalizeRoom(room, { previousRoom: state.room }),
      gameState: room.gameState,
      matchStartedAt: state.matchStartedAt
    })),
  resetRoundState: () =>
    set((state) => ({
      room: state.room
        ? {
            ...state.room,
            gameState: "waiting",
            winner: null,
            winnerIds: [],
            roundNumber: 0,
            roundStatus: "idle",
            roundEndsAt: null,
            submittedPlayerIds: [],
            secretSubmittedPlayerIds: []
          }
        : null,
      gameState: "waiting",
      matchStartedAt: null,
      lastGuessResult: null,
      guessHistory: [],
      personalSecretNumber: null,
      errorMessage: null
    })),
  resetAll: () =>
    set((state) => ({
      ...initialState,
      isConnected: state.isConnected
    }))
}));
