import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  bootstrapProgress,
  claimDailyRewardRemote,
  recordMatchRemote,
  updateDisplayNameRemote,
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
  getDefaultDisplayName,
  normalizeProfile
} from "../utils/progression";

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
  hydrate: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
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

const persistDisplayName = async (displayName: string) => {
  await AsyncStorage.setItem(DISPLAY_NAME_STORAGE_KEY, displayName);
};

export const usePlayerProgressStore = create<PlayerProgressStore>((set, get) => ({
  hydrated: false,
  playerKey: null,
  displayName: "",
  profile: createInitialProfile(),
  leaderboard: buildOnlineLeaderboard(createInitialProfile()),
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

      set({
        playerKey: response.playerKey,
        displayName: response.displayName,
        profile: response.profile,
        leaderboard: response.leaderboard
      });

      await AsyncStorage.setItem(PLAYER_KEY_STORAGE_KEY, response.playerKey);
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(response.profile));
      await persistDisplayName(response.displayName);
    } catch {
      // Local cache remains the fallback until the server is ready.
    }
  },
  updateDisplayName: async (displayName) => {
    if (!get().playerKey) {
      throw new Error("Your profile is still loading. Try again in a moment.");
    }

    const response = await updateDisplayNameRemote(get().playerKey!, displayName);

    set({
      displayName: response.displayName,
      profile: response.profile,
      leaderboard: response.leaderboard
    });
    await persistProfile(response.profile);
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

      set({
        displayName: response.displayName,
        profile: response.profile,
        leaderboard: response.leaderboard
      });
      await persistProfile(response.profile);
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

      set({
        displayName: response.displayName,
        profile: response.profile,
        leaderboard: response.leaderboard
      });
      await persistProfile(response.profile);
      await persistDisplayName(response.displayName);
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
        displayName: response.displayName,
        profile: response.profile,
        leaderboard: response.leaderboard
      });
      await persistProfile(response.profile);
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

      set({
        displayName: response.displayName,
        profile: response.profile,
        leaderboard: response.leaderboard
      });
      await persistProfile(response.profile);
      await persistDisplayName(response.displayName);

      return response.record;
    } catch {
      return localResult.record;
    }
  }
}));

export const getOnlineLeaderboardPreview = () => usePlayerProgressStore.getState().leaderboard;
