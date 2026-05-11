import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  bootstrapProgress,
  claimDailyRewardRemote,
  fetchDailyPuzzleStatusRemote,
  recordMatchRemote,
  submitDailyPuzzleGuessRemote,
  updateDisplayNameRemote,
  updateProgressPreferences
} from "../api/progressionApi";
import type {
  DailyPuzzleGuessResponse,
  DailyPuzzleStatusResponse,
  LeaderboardEntry,
  MatchInput,
  MatchRecord,
  PlayerProfile,
  ProgressSyncResponse
} from "../types/progression.types";
import {
  applyDailyPuzzleCompletion,
  applyReviveTokens,
  applySinglePlayerHighScores,
  applyRecordedMatch,
  applySinglePlayerHighRounds,
  applySoundPlaceholdersEnabled,
  applyTutorialSeen,
  buildOnlineLeaderboard,
  claimProfileDailyReward,
  createInitialProfile,
  getDefaultDisplayName,
  normalizeProfile
} from "../utils/progression";
import { getLocalTodayKey } from "../utils/dailyPuzzle";

const PROFILE_STORAGE_KEY = "higher-lower-player-progress";
const PLAYER_KEY_STORAGE_KEY = "higher-lower-player-key";
const DISPLAY_NAME_STORAGE_KEY = "higher-lower-display-name";

const createPlayerKey = () => `player_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

interface PlayerProgressStore {
  hydrated: boolean;
  playerKey: string | null;
  displayName: string;
  profile: PlayerProfile;
  leaderboard: LeaderboardEntry[];
  dailyPuzzleTodayKey: string | null;
  dailyPuzzleMaxNumber: number;
  hydrate: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  markTutorialSeen: () => Promise<void>;
  toggleSoundPlaceholders: () => Promise<void>;
  updateSinglePlayerHighScore: (difficulty: import("../types/game.types").Difficulty, rounds: number) => Promise<void>;
  updateSinglePlayerBestScore: (difficulty: import("../types/game.types").Difficulty, score: number) => Promise<void>;
  consumeReviveToken: () => Promise<boolean>;
  claimDailyReward: () => Promise<{
    claimed: boolean;
    points: number;
    xp: number;
    streakDays: number;
  }>;
  recordMatch: (input: MatchInput) => Promise<MatchRecord>;
  fetchDailyPuzzleStatus: (dateKey: string) => Promise<DailyPuzzleStatusResponse>;
  submitDailyPuzzleGuess: (input: {
    dateKey: string;
    guess: number;
    attempts: number;
    durationMs: number;
  }) => Promise<DailyPuzzleGuessResponse>;
  saveDailyPuzzleCompletionLocal: (input: {
    dateKey: string;
    attempts: number;
    durationMs: number;
    recordId: string | null;
  }) => Promise<void>;
}

const persistProfile = async (profile: PlayerProfile) => {
  await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
};

const persistDisplayName = async (displayName: string) => {
  await AsyncStorage.setItem(DISPLAY_NAME_STORAGE_KEY, displayName);
};

const mergeSinglePlayerRecords = (incomingProfile: PlayerProfile, currentProfile: PlayerProfile) =>
  applySinglePlayerHighScores(
    applySinglePlayerHighRounds(incomingProfile, currentProfile.stats.singlePlayerHighRounds),
    currentProfile.stats.singlePlayerHighScores
  );

const applyRemoteSync = async (
  set: (partial: Partial<PlayerProgressStore>) => void,
  get: () => PlayerProgressStore,
  response: ProgressSyncResponse & {
    todayKey?: string;
    maxNumber?: number;
  },
  options?: {
    updateDailyPuzzleTodayKey?: boolean;
  }
) => {
  const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

  set({
    playerKey: response.playerKey,
    displayName: response.displayName,
    profile: normalizedProfile,
    leaderboard: response.leaderboard,
    dailyPuzzleTodayKey:
      options?.updateDailyPuzzleTodayKey === false
        ? get().dailyPuzzleTodayKey
        : response.todayKey ?? get().dailyPuzzleTodayKey,
    dailyPuzzleMaxNumber: response.maxNumber ?? get().dailyPuzzleMaxNumber
  });

  await AsyncStorage.setItem(PLAYER_KEY_STORAGE_KEY, response.playerKey);
  await persistProfile(normalizedProfile);
  await persistDisplayName(response.displayName);
};

export const usePlayerProgressStore = create<PlayerProgressStore>((set, get) => ({
  hydrated: false,
  playerKey: null,
  displayName: "",
  profile: createInitialProfile(),
  leaderboard: buildOnlineLeaderboard(createInitialProfile()),
  dailyPuzzleTodayKey: null,
  dailyPuzzleMaxNumber: 9999,
  hydrate: async () => {
    let playerKey = await AsyncStorage.getItem(PLAYER_KEY_STORAGE_KEY);

    if (!playerKey) {
      playerKey = createPlayerKey();
      await AsyncStorage.setItem(PLAYER_KEY_STORAGE_KEY, playerKey);
    }

    const rawProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    const storedDisplayName = await AsyncStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
    let mergedProfile = createInitialProfile();
    const fallbackDisplayName = storedDisplayName ?? getDefaultDisplayName(playerKey);

    try {
      mergedProfile = normalizeProfile(rawProfile ? (JSON.parse(rawProfile) as Partial<PlayerProfile>) : undefined);
    } catch {
      mergedProfile = createInitialProfile();
    }

    set({
      hydrated: true,
      playerKey,
      displayName: fallbackDisplayName,
      profile: mergedProfile,
      leaderboard: buildOnlineLeaderboard(mergedProfile)
    });

    try {
      const response = await bootstrapProgress({
        playerKey,
        displayName: fallbackDisplayName,
        localProfile: mergedProfile
      });

      await applyRemoteSync(set, get, response);
    } catch {
      // Local cache remains the fallback until the server is ready.
    }
  },
  updateDisplayName: async (displayName) => {
    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await updateDisplayNameRemote(get().playerKey!, displayName);
    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });
    await persistProfile(normalizedProfile);
    await persistDisplayName(response.displayName);
  },
  markTutorialSeen: async () => {
    const nextProfile = applyTutorialSeen(get().profile);

    set({ profile: nextProfile });
    await persistProfile(nextProfile);

    if (!get().playerKey) {
      return;
    }

    try {
      const response = await updateProgressPreferences({
        playerKey: get().playerKey!,
        tutorialSeen: true
      });
      const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

      set({
        displayName: response.displayName,
        profile: normalizedProfile,
        leaderboard: response.leaderboard
      });
      await persistProfile(normalizedProfile);
      await persistDisplayName(response.displayName);
    } catch {
      // Keep the local value if the backend is temporarily unavailable.
    }
  },
  toggleSoundPlaceholders: async () => {
    const nextProfile = applySoundPlaceholdersEnabled(
      get().profile,
      !get().profile.soundPlaceholdersEnabled
    );

    set({ profile: nextProfile });
    await persistProfile(nextProfile);

    if (!get().playerKey) {
      return;
    }

    try {
      const response = await updateProgressPreferences({
        playerKey: get().playerKey!,
        soundPlaceholdersEnabled: nextProfile.soundPlaceholdersEnabled
      });
      const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

      set({
        displayName: response.displayName,
        profile: normalizedProfile,
        leaderboard: response.leaderboard
      });
      await persistProfile(normalizedProfile);
      await persistDisplayName(response.displayName);
    } catch {
      // The local toggle should keep working even if sync is down.
    }
  },
  updateSinglePlayerHighScore: async (difficulty, rounds) => {
    const currentProfile = get().profile;
    const currentHighScore = currentProfile.stats.singlePlayerHighRounds[difficulty];

    if (rounds <= currentHighScore) {
      return;
    }

    const nextProfile = applySinglePlayerHighRounds(currentProfile, {
      [difficulty]: rounds
    });

    set({ profile: nextProfile });
    await persistProfile(nextProfile);

    if (!get().playerKey) {
      return;
    }

    try {
      const response = await updateProgressPreferences({
        playerKey: get().playerKey!,
        singlePlayerHighRounds: {
          [difficulty]: rounds
        }
      });
      const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

      set({
        displayName: response.displayName,
        profile: normalizedProfile,
        leaderboard: response.leaderboard
      });
      await persistProfile(normalizedProfile);
      await persistDisplayName(response.displayName);
    } catch {
      // Keep the local record even if remote sync is temporarily unavailable.
    }
  },
  updateSinglePlayerBestScore: async (difficulty, score) => {
    const currentProfile = get().profile;
    const currentBestScore = currentProfile.stats.singlePlayerHighScores[difficulty];

    if (score <= currentBestScore) {
      return;
    }

    const nextProfile = applySinglePlayerHighScores(currentProfile, {
      [difficulty]: score
    });

    set({ profile: nextProfile });
    await persistProfile(nextProfile);

    if (!get().playerKey) {
      return;
    }

    try {
      const response = await updateProgressPreferences({
        playerKey: get().playerKey!,
        singlePlayerHighScores: {
          [difficulty]: score
        }
      });
      const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

      set({
        displayName: response.displayName,
        profile: normalizedProfile,
        leaderboard: response.leaderboard
      });
      await persistProfile(normalizedProfile);
      await persistDisplayName(response.displayName);
    } catch {
      // Keep the local record even if remote sync is temporarily unavailable.
    }
  },
  consumeReviveToken: async () => {
    const currentProfile = get().profile;

    if (currentProfile.reviveTokens <= 0) {
      return false;
    }

    const nextProfile = applyReviveTokens(currentProfile, -1);

    set({ profile: nextProfile });
    await persistProfile(nextProfile);

    if (!get().playerKey) {
      return true;
    }

    try {
      const response = await updateProgressPreferences({
        playerKey: get().playerKey!,
        reviveTokensDelta: -1
      });
      const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

      set({
        displayName: response.displayName,
        profile: normalizedProfile,
        leaderboard: response.leaderboard
      });
      await persistProfile(normalizedProfile);
      await persistDisplayName(response.displayName);
      return true;
    } catch {
      return true;
    }
  },
  claimDailyReward: async () => {
    const currentProfile = get().profile;
    const localResult = claimProfileDailyReward(currentProfile);

    set({ profile: localResult.profile });
    await persistProfile(localResult.profile);

    if (!get().playerKey) {
      return {
        claimed: localResult.claimed,
        points: localResult.reward.points,
        xp: localResult.reward.xp,
        streakDays: localResult.reward.streakDays
      };
    }

    try {
      const response = await claimDailyRewardRemote(get().playerKey!);
      const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

      set({
        displayName: response.displayName,
        profile: normalizedProfile,
        leaderboard: response.leaderboard
      });
      await persistProfile(normalizedProfile);
      await persistDisplayName(response.displayName);

      return {
        claimed: response.claimed,
        points: response.reward.points,
        xp: response.reward.xp,
        streakDays: response.reward.streakDays
      };
    } catch {
      return {
        claimed: localResult.claimed,
        points: localResult.reward.points,
        xp: localResult.reward.xp,
        streakDays: localResult.reward.streakDays
      };
    }
  },
  recordMatch: async (input) => {
    const localResult = applyRecordedMatch(get().profile, input);

    set({
      profile: localResult.profile,
      leaderboard: buildOnlineLeaderboard(localResult.profile)
    });
    await persistProfile(localResult.profile);

    if (!get().playerKey) {
      return localResult.record;
    }

    try {
      const response = await recordMatchRemote({
        playerKey: get().playerKey!,
        input
      });

      await applyRemoteSync(set, get, response);

      return response.record;
    } catch {
      return localResult.record;
    }
  },
  fetchDailyPuzzleStatus: async (dateKey) => {
    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await fetchDailyPuzzleStatusRemote(get().playerKey!, dateKey);
    await applyRemoteSync(set, get, response, {
      updateDailyPuzzleTodayKey: dateKey === getLocalTodayKey()
    });
    return response;
  },
  submitDailyPuzzleGuess: async (input) => {
    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await submitDailyPuzzleGuessRemote({
      playerKey: get().playerKey!,
      ...input
    });

    await applyRemoteSync(set, get, response, {
      updateDailyPuzzleTodayKey: input.dateKey === getLocalTodayKey()
    });
    return response;
  },
  saveDailyPuzzleCompletionLocal: async (input) => {
    const result = applyDailyPuzzleCompletion(
      get().profile,
      input.dateKey,
      input.attempts,
      input.durationMs,
      input.recordId
    );

    set({
      profile: result.profile
    });
    await persistProfile(result.profile);
  }
}));

export const getOnlineLeaderboardPreview = () => usePlayerProgressStore.getState().leaderboard;
