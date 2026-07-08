import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  bootstrapProgress,
  claimDailyRewardRemote,
  fetchDailyPuzzleLeaderboardRemote,
  fetchDailyPuzzleStatusRemote,
  recordMatchRemote,
  submitDailyPuzzleGuessRemote,
  updateDisplayNameRemote,
  updateProgressPreferences
} from "../api/progressionApi";
import type {
  ActivePracticeRunSnapshot,
  AvatarId,
  DailyPuzzleGuessResponse,
  DailyPuzzleLeaderboardResponse,
  DailyPuzzleStatusResponse,
  LeaderboardEntry,
  MatchInput,
  MatchRecord,
  PlayerProfile,
  ProgressSyncResponse
} from "../types/progression.types";
import {
  applyActivePracticeRun,
  applyRecordedMatch,
  applySinglePlayerHighScores,
  applySinglePlayerHighRounds,
  buildOnlineLeaderboard,
  createInitialProfile,
  getDefaultDisplayName,
  normalizeProfile
} from "../utils/progression";
import { getUtcTodayKey } from "../utils/dailyPuzzle";

const PLAYER_KEY_STORAGE_KEY = "higher-lower-player-key";
const PLAYER_DEVICE_SECRET_STORAGE_KEY = "higher-lower-player-device-secret";

const createPlayerKey = () => `player_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const createPlayerDeviceSecret = () =>
  `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;

interface PlayerProgressStore {
  hydrated: boolean;
  progressReady: boolean;
  progressSynced: boolean;
  progressError: string | null;
  playerKey: string | null;
  displayName: string;
  profile: PlayerProfile;
  leaderboard: LeaderboardEntry[];
  dailyPuzzleTodayKey: string | null;
  dailyPuzzleMaxNumber: number;
  hydrate: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateAvatarId: (avatarId: AvatarId) => Promise<void>;
  purchasePremiumAvatar: (avatarId: AvatarId) => Promise<void>;
  markTutorialSeen: () => Promise<void>;
  toggleSoundPlaceholders: () => Promise<void>;
  updateSinglePlayerHighScore: (difficulty: import("../types/game.types").Difficulty, rounds: number) => Promise<void>;
  updateSinglePlayerBestScore: (difficulty: import("../types/game.types").Difficulty, score: number) => Promise<void>;
  syncSinglePlayerRunProgress: (
    difficulty: import("../types/game.types").Difficulty,
    progress: {
      rounds?: number;
      score?: number;
      snapshot?: ActivePracticeRunSnapshot | null;
    }
  ) => Promise<void>;
  consumeExtraGuessPowerUp: () => Promise<boolean>;
  awardExtraGuessPowerUps: (amount: number) => Promise<boolean>;
  consumeSkipBooster: () => Promise<boolean>;
  awardSkipBoosters: (amount: number) => Promise<boolean>;
  spendCoins: (amount: number) => Promise<boolean>;
  awardCoins: (amount: number) => Promise<boolean>;
  syncActivePracticeRun: (
    difficulty: import("../types/game.types").Difficulty,
    snapshot: ActivePracticeRunSnapshot | null
  ) => Promise<void>;
  claimDailyReward: () => Promise<{
    claimed: boolean;
    points: number;
    xp: number;
    streakDays: number;
  }>;
  recordMatch: (input: MatchInput) => Promise<MatchRecord>;
  fetchDailyPuzzleStatus: (dateKey: string) => Promise<DailyPuzzleStatusResponse>;
  fetchDailyPuzzleLeaderboard: (dateKey: string) => Promise<DailyPuzzleLeaderboardResponse>;
  submitDailyPuzzleGuess: (input: {
    dateKey: string;
    guess: number;
    attempts: number;
    durationMs: number;
    rewardedSkip?: boolean;
  }) => Promise<DailyPuzzleGuessResponse>;
  saveDailyPuzzleCompletionLocal: (input: {
    dateKey: string;
    attempts: number;
    durationMs: number;
    recordId: string | null;
  }) => Promise<void>;
}

const practiceDifficulties = ["easy", "hard", "impossible"] as const;
const activePracticeRunSyncVersions: Record<(typeof practiceDifficulties)[number], number> = {
  easy: 0,
  hard: 0,
  impossible: 0
};

const getSnapshotTimestamp = (snapshot?: ActivePracticeRunSnapshot | null) => {
  if (!snapshot?.updatedAt) {
    return 0;
  }

  const timestamp = new Date(snapshot.updatedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const mergeSinglePlayerRecords = (incomingProfile: PlayerProfile, currentProfile: PlayerProfile) => {
  const mergedProfile = applySinglePlayerHighScores(
    applySinglePlayerHighRounds(incomingProfile, currentProfile.stats.singlePlayerHighRounds),
    currentProfile.stats.singlePlayerHighScores
  );
  const mergedActivePracticeRuns = { ...mergedProfile.activePracticeRuns };

  practiceDifficulties.forEach((difficulty) => {
    const incomingSnapshot = mergedProfile.activePracticeRuns[difficulty];
    const currentSnapshot = currentProfile.activePracticeRuns[difficulty];

    if (!incomingSnapshot && currentSnapshot) {
      mergedActivePracticeRuns[difficulty] = currentSnapshot;
      return;
    }

    if (incomingSnapshot && currentSnapshot) {
      mergedActivePracticeRuns[difficulty] =
        getSnapshotTimestamp(currentSnapshot) > getSnapshotTimestamp(incomingSnapshot)
          ? currentSnapshot
          : incomingSnapshot;
    }
  });

  return {
    ...mergedProfile,
    activePracticeRuns: mergedActivePracticeRuns
  };
};

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
};

export const usePlayerProgressStore = create<PlayerProgressStore>((set, get) => ({
  hydrated: false,
  progressReady: false,
  progressSynced: false,
  progressError: null,
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

    let deviceSecret = await AsyncStorage.getItem(PLAYER_DEVICE_SECRET_STORAGE_KEY);

    if (!deviceSecret) {
      deviceSecret = createPlayerDeviceSecret();
      await AsyncStorage.setItem(PLAYER_DEVICE_SECRET_STORAGE_KEY, deviceSecret);
    }

    const fallbackDisplayName = getDefaultDisplayName(playerKey);

    set({
      hydrated: true,
      progressReady: false,
      progressSynced: false,
      progressError: null,
      playerKey,
      displayName: fallbackDisplayName,
      profile: createInitialProfile(),
      leaderboard: buildOnlineLeaderboard(createInitialProfile())
    });

    try {
      const response = await bootstrapProgress({
        playerKey,
        deviceSecret,
        displayName: fallbackDisplayName
      });

      await applyRemoteSync(set, get, response);
      set({ progressSynced: true, progressError: null });
    } catch (error) {
      set({
        progressSynced: false,
        progressError: error instanceof Error ? error.message : "Could not connect to the progression database."
      });
    } finally {
      // Remote profile has settled (loaded or failed). Screens can now safely
      // restore from / sync the persisted snapshot without clobbering it.
      set({ progressReady: true });
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
  },
  updateAvatarId: async (avatarId) => {
    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await updateProgressPreferences({
      playerKey: get().playerKey!,
      avatarId
    });
    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });
  },
  purchasePremiumAvatar: async (avatarId) => {
    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await updateProgressPreferences({
      playerKey: get().playerKey!,
      premiumAvatarId: avatarId
    });
    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });
  },
  markTutorialSeen: async () => {
    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

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
  },
  toggleSoundPlaceholders: async () => {
    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await updateProgressPreferences({
      playerKey: get().playerKey!,
      soundPlaceholdersEnabled: !get().profile.soundPlaceholdersEnabled
    });
    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });
  },
  updateSinglePlayerHighScore: async (difficulty, rounds) => {
    const currentProfile = get().profile;
    const currentHighScore = currentProfile.stats.singlePlayerHighRounds[difficulty];

    if (rounds < currentHighScore) {
      return;
    }

    const optimisticProfile = applySinglePlayerHighRounds(currentProfile, {
      [difficulty]: rounds
    });

    set({
      profile: optimisticProfile,
      leaderboard: buildOnlineLeaderboard(optimisticProfile)
    });

    if (!get().playerKey) {
      return;
    }

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
  },
  updateSinglePlayerBestScore: async (difficulty, score) => {
    const currentProfile = get().profile;
    const currentBestScore = currentProfile.stats.singlePlayerHighScores[difficulty];

    if (score < currentBestScore) {
      return;
    }

    const optimisticProfile = applySinglePlayerHighScores(currentProfile, {
      [difficulty]: score
    });

    set({
      profile: optimisticProfile,
      leaderboard: buildOnlineLeaderboard(optimisticProfile)
    });

    if (!get().playerKey) {
      return;
    }

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
  },
  syncSinglePlayerRunProgress: async (difficulty, progress) => {
    let optimisticProfile = get().profile;
    const shouldSyncRounds = typeof progress.rounds === "number" && Number.isFinite(progress.rounds) && progress.rounds > 0;
    const shouldSyncScore = typeof progress.score === "number" && Number.isFinite(progress.score) && progress.score > 0;
    const shouldSyncSnapshot = Object.prototype.hasOwnProperty.call(progress, "snapshot");

    if (!shouldSyncRounds && !shouldSyncScore && !shouldSyncSnapshot) {
      return;
    }

    if (shouldSyncRounds) {
      optimisticProfile = applySinglePlayerHighRounds(optimisticProfile, {
        [difficulty]: Math.floor(progress.rounds!)
      });
    }

    if (shouldSyncScore) {
      optimisticProfile = applySinglePlayerHighScores(optimisticProfile, {
        [difficulty]: Math.floor(progress.score!)
      });
    }

    if (shouldSyncSnapshot) {
      optimisticProfile = applyActivePracticeRun(optimisticProfile, difficulty, progress.snapshot ?? null);
    }

    set({
      profile: optimisticProfile,
      leaderboard: buildOnlineLeaderboard(optimisticProfile)
    });

    if (!get().playerKey) {
      return;
    }

    const response = await updateProgressPreferences({
      playerKey: get().playerKey!,
      ...(shouldSyncRounds
        ? {
            singlePlayerHighRounds: {
              [difficulty]: Math.floor(progress.rounds!)
            }
          }
        : {}),
      ...(shouldSyncScore
        ? {
            singlePlayerHighScores: {
              [difficulty]: Math.floor(progress.score!)
            }
          }
        : {}),
      ...(shouldSyncSnapshot
        ? {
            activePracticeRun: {
              difficulty,
              snapshot: progress.snapshot ?? null
            }
          }
        : {})
    });
    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    if (shouldSyncSnapshot && !progress.snapshot) {
      const activePracticeRuns = { ...normalizedProfile.activePracticeRuns };
      delete activePracticeRuns[difficulty];
      normalizedProfile.activePracticeRuns = activePracticeRuns;
    }

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });
  },
  consumeExtraGuessPowerUp: async () => {
    const currentProfile = get().profile;

    if (currentProfile.extraGuessPowerUps <= 0) {
      return false;
    }

    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await updateProgressPreferences({
      playerKey: get().playerKey!,
      extraGuessPowerUpsDelta: -1
    });
    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });
    return true;
  },
  awardExtraGuessPowerUps: async (amount) => {
    const awardAmount = Math.max(0, Math.floor(amount));

    if (awardAmount <= 0) {
      return true;
    }

    if (!get().playerKey) {
      return false;
    }

    const response = await updateProgressPreferences({
      playerKey: get().playerKey!,
      extraGuessPowerUpsDelta: awardAmount
    });
    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });
    return true;
  },
  consumeSkipBooster: async () => {
    const currentProfile = get().profile;

    if (currentProfile.skipBoosters <= 0) {
      return false;
    }

    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await updateProgressPreferences({
      playerKey: get().playerKey!,
      skipBoostersDelta: -1
    });
    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });
    return true;
  },
  awardSkipBoosters: async (amount) => {
    const awardAmount = Math.max(0, Math.floor(amount));

    if (awardAmount <= 0) {
      return true;
    }

    if (!get().playerKey) {
      return false;
    }

    const response = await updateProgressPreferences({
      playerKey: get().playerKey!,
      skipBoostersDelta: awardAmount
    });
    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });
    return true;
  },
  spendCoins: async (amount) => {
    const spendAmount = Math.max(0, Math.floor(amount));

    if (spendAmount <= 0) {
      return true;
    }

    const currentProfile = get().profile;

    if (currentProfile.coins < spendAmount) {
      return false;
    }

    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await updateProgressPreferences({
      playerKey: get().playerKey!,
      coinsDelta: -spendAmount
    });
    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });
    return true;
  },
  awardCoins: async (amount) => {
    const awardAmount = Math.max(0, Math.floor(amount));

    if (awardAmount <= 0) {
      return true;
    }

    if (!get().playerKey) {
      return false;
    }

    const response = await updateProgressPreferences({
      playerKey: get().playerKey!,
      coinsDelta: awardAmount
    });
    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });
    return true;
  },
  syncActivePracticeRun: async (difficulty, snapshot) => {
    const syncVersion = activePracticeRunSyncVersions[difficulty] + 1;
    activePracticeRunSyncVersions[difficulty] = syncVersion;

    const optimisticProfile = applyActivePracticeRun(get().profile, difficulty, snapshot);

    set({
      profile: optimisticProfile,
      leaderboard: buildOnlineLeaderboard(optimisticProfile)
    });

    if (!get().playerKey) {
      return;
    }

    const response = await updateProgressPreferences({
      playerKey: get().playerKey!,
      activePracticeRun: {
        difficulty,
        snapshot
      }
    });

    if (activePracticeRunSyncVersions[difficulty] !== syncVersion) {
      return;
    }

    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    if (!snapshot) {
      const activePracticeRuns = { ...normalizedProfile.activePracticeRuns };
      delete activePracticeRuns[difficulty];
      normalizedProfile.activePracticeRuns = activePracticeRuns;
    }

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });
  },
  claimDailyReward: async () => {
    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await claimDailyRewardRemote(get().playerKey!);
    const normalizedProfile = mergeSinglePlayerRecords(normalizeProfile(response.profile), get().profile);

    set({
      displayName: response.displayName,
      profile: normalizedProfile,
      leaderboard: response.leaderboard
    });

    return {
      claimed: response.claimed,
      points: response.reward.points,
      xp: response.reward.xp,
      streakDays: response.reward.streakDays
    };
  },
  recordMatch: async (input) => {
    const optimisticResult = applyRecordedMatch(get().profile, input);

    set({
      profile: optimisticResult.profile,
      leaderboard: buildOnlineLeaderboard(optimisticResult.profile)
    });

    if (!get().playerKey) {
      return optimisticResult.record;
    }

    try {
      const response = await recordMatchRemote({
        playerKey: get().playerKey!,
        input
      });

      await applyRemoteSync(set, get, response);

      return response.record;
    } catch {
      set({ progressSynced: false });
      return optimisticResult.record;
    }
  },
  fetchDailyPuzzleStatus: async (dateKey) => {
    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await fetchDailyPuzzleStatusRemote(get().playerKey!, dateKey);
    await applyRemoteSync(set, get, response, {
      updateDailyPuzzleTodayKey: dateKey === getUtcTodayKey()
    });
    return response;
  },
  fetchDailyPuzzleLeaderboard: async (dateKey) => {
    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await fetchDailyPuzzleLeaderboardRemote(get().playerKey!, dateKey);
    await applyRemoteSync(set, get, response, {
      updateDailyPuzzleTodayKey: false
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
      updateDailyPuzzleTodayKey: input.dateKey === getUtcTodayKey()
    });
    return response;
  },
  saveDailyPuzzleCompletionLocal: async (input) => {
    void input;
  }
}));

export const getOnlineLeaderboardPreview = () => usePlayerProgressStore.getState().leaderboard;
