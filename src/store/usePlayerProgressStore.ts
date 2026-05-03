import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  bootstrapProgress,
  claimDailyRewardRemote,
  recordMatchRemote,
  updateProgressPreferences
} from "../api/progressionApi";
import type {
  LeaderboardEntry,
  MatchInput,
  MatchRecord,
  PlayerProfile
} from "../types/progression.types";
import {
  applyRecordedMatch,
  applySoundPlaceholdersEnabled,
  applyTutorialSeen,
  buildOnlineLeaderboard,
  claimProfileDailyReward,
  createInitialProfile,
  normalizeProfile
} from "../utils/progression";

const PROFILE_STORAGE_KEY = "higher-lower-player-progress";
const PLAYER_KEY_STORAGE_KEY = "higher-lower-player-key";

const createPlayerKey = () => `player_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

interface PlayerProgressStore {
  hydrated: boolean;
  playerKey: string | null;
  profile: PlayerProfile;
  leaderboard: LeaderboardEntry[];
  hydrate: () => Promise<void>;
  markTutorialSeen: () => Promise<void>;
  toggleSoundPlaceholders: () => Promise<void>;
  claimDailyReward: () => Promise<{
    claimed: boolean;
    points: number;
    xp: number;
    streakDays: number;
  }>;
  recordMatch: (input: MatchInput) => Promise<MatchRecord>;
}

const persistProfile = async (profile: PlayerProfile) => {
  await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
};

export const usePlayerProgressStore = create<PlayerProgressStore>((set, get) => ({
  hydrated: false,
  playerKey: null,
  profile: createInitialProfile(),
  leaderboard: buildOnlineLeaderboard(createInitialProfile()),
  hydrate: async () => {
    let playerKey = await AsyncStorage.getItem(PLAYER_KEY_STORAGE_KEY);

    if (!playerKey) {
      playerKey = createPlayerKey();
      await AsyncStorage.setItem(PLAYER_KEY_STORAGE_KEY, playerKey);
    }

    const rawProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    let mergedProfile = createInitialProfile();

    try {
      mergedProfile = normalizeProfile(rawProfile ? (JSON.parse(rawProfile) as Partial<PlayerProfile>) : undefined);
    } catch {
      mergedProfile = createInitialProfile();
    }

    set({
      hydrated: true,
      playerKey,
      profile: mergedProfile,
      leaderboard: buildOnlineLeaderboard(mergedProfile)
    });

    try {
      const response = await bootstrapProgress({
        playerKey,
        localProfile: mergedProfile
      });

      set({
        playerKey: response.playerKey,
        profile: response.profile,
        leaderboard: response.leaderboard
      });

      await AsyncStorage.setItem(PLAYER_KEY_STORAGE_KEY, response.playerKey);
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(response.profile));
    } catch {
      // Local cache remains the fallback until the server is ready.
    }
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

      set({
        profile: response.profile,
        leaderboard: response.leaderboard
      });
      await persistProfile(response.profile);
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

      set({
        profile: response.profile,
        leaderboard: response.leaderboard
      });
      await persistProfile(response.profile);
    } catch {
      // The local toggle should keep working even if sync is down.
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

      set({
        profile: response.profile,
        leaderboard: response.leaderboard
      });
      await persistProfile(response.profile);

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

      set({
        profile: response.profile,
        leaderboard: response.leaderboard
      });
      await persistProfile(response.profile);

      return response.record;
    } catch {
      return localResult.record;
    }
  }
}));

export const getOnlineLeaderboardPreview = () => usePlayerProgressStore.getState().leaderboard;
