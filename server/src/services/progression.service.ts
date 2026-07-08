import { createHash } from "crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import type {
  ActivePracticeRunSnapshot,
  ClaimDailyRewardResponse,
  MatchInput,
  PlayerProfile,
  ProgressBootstrapPayload,
  ProgressPreferencesPayload,
  ProgressSyncResponse,
  RecordMatchResponse,
  UpdateDisplayNameResponse
} from "../../../shared/progression.types";
import type { Difficulty } from "../../../shared/game.types";
import {
  applyActivePracticeRun,
  applyAvatarId,
  applyCoins,
  applyExtraGuessPowerUps,
  applyPremiumAvatarPurchase,
  applySkipBoosters,
  applyRecordedMatch,
  applySinglePlayerHighScores,
  applySinglePlayerHighRounds,
  applySoundPlaceholdersEnabled,
  applyTutorialSeen,
  buildOnlineLeaderboard,
  claimProfileDailyReward,
  createInitialProfile,
  getDefaultDisplayName,
  normalizeProfile,
  validateDisplayName
} from "../../../shared/progression";
import { leaderboardService } from "./leaderboard.service";

const isDatabaseConfigured = () => Boolean(process.env.DATABASE_URL);

const profileToJson = (profile: PlayerProfile) => profile as unknown as never;

const parseProfile = (value: unknown): PlayerProfile => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createInitialProfile();
  }

  return normalizeProfile(value as Partial<PlayerProfile>);
};

const createFallbackLeaderboard = (profile: PlayerProfile) => buildOnlineLeaderboard(profile);

class ProgressionService {
  private assertConfigured() {
    if (!isDatabaseConfigured()) {
      throw new Error("Progress persistence is not configured on the server.");
    }
  }

  async bootstrap(payload: ProgressBootstrapPayload): Promise<ProgressSyncResponse> {
    this.assertConfigured();

    const displayName = await this.resolveDisplayName(payload.playerKey, payload.displayName);
    const deviceSecretHash = this.hashDeviceSecret(payload.deviceSecret);
    const existing = await prisma.playerProgress.findUnique({
      where: {
        playerKey: payload.playerKey
      }
    });

    if (!existing) {
      const createdProfile = normalizeProfile({
        ...createInitialProfile(),
        deviceSecretHash: deviceSecretHash ?? undefined
      });
      await prisma.playerProgress.create({
        data: {
          playerKey: payload.playerKey,
          displayName,
          profile: profileToJson(createdProfile),
          totalPoints: createdProfile.totalPoints,
          level: createdProfile.level,
          currentWinStreak: createdProfile.currentWinStreak,
          onlinePoints: createdProfile.stats.category.online.points,
          onlineWins: createdProfile.stats.category.online.wins
        }
      });

      return {
        playerKey: payload.playerKey,
        displayName,
        profile: createdProfile,
        leaderboard: await this.getLeaderboard(payload.playerKey, createdProfile, displayName),
        persistence: "remote"
      };
    }

    const profile = await this.verifyOrAttachDeviceSecret(payload.playerKey, parseProfile(existing.profile), deviceSecretHash);

    return {
      playerKey: existing.playerKey,
      displayName: existing.displayName,
      profile,
      leaderboard: await this.getLeaderboard(existing.playerKey, profile, existing.displayName),
      persistence: "remote"
    };
  }

  async markTutorialSeen(playerKey: string) {
    return this.updateProfile(playerKey, (profile) => applyTutorialSeen(profile));
  }

  async setSoundPlaceholdersEnabled(playerKey: string, enabled: boolean) {
    return this.updateProfile(playerKey, (profile) => applySoundPlaceholdersEnabled(profile, enabled));
  }

  async updateAvatarId(playerKey: string, avatarId: string) {
    return this.updateProfile(playerKey, (profile) => applyAvatarId(profile, avatarId));
  }

  async purchasePremiumAvatar(playerKey: string, avatarId: string) {
    return this.updateProfile(playerKey, (profile) => applyPremiumAvatarPurchase(profile, avatarId));
  }

  async updateSinglePlayerHighRounds(
    playerKey: string,
    singlePlayerHighRounds: Partial<PlayerProfile["stats"]["singlePlayerHighRounds"]>
  ) {
    return this.updateProfile(playerKey, (profile) => applySinglePlayerHighRounds(profile, singlePlayerHighRounds));
  }

  async updateSinglePlayerHighScores(
    playerKey: string,
    singlePlayerHighScores: Partial<PlayerProfile["stats"]["singlePlayerHighScores"]>
  ) {
    return this.updateProfile(playerKey, (profile) => applySinglePlayerHighScores(profile, singlePlayerHighScores));
  }

  async adjustExtraGuessPowerUps(playerKey: string, delta: number) {
    return this.updateProfile(playerKey, (profile) => applyExtraGuessPowerUps(profile, delta));
  }

  async adjustSkipBoosters(playerKey: string, delta: number) {
    return this.updateProfile(playerKey, (profile) => applySkipBoosters(profile, delta));
  }

  async adjustCoins(playerKey: string, delta: number) {
    return this.updateProfile(playerKey, (profile) => applyCoins(profile, delta));
  }

  async updateActivePracticeRun(
    playerKey: string,
    difficulty: Difficulty,
    snapshot: ActivePracticeRunSnapshot | null
  ) {
    return this.updateProfile(playerKey, (profile) => applyActivePracticeRun(profile, difficulty, snapshot));
  }

  async updatePreferences(payload: ProgressPreferencesPayload) {
    return this.updateProfile(payload.playerKey, (profile) => {
      let nextProfile = profile;

      if (payload.tutorialSeen === true) {
        nextProfile = applyTutorialSeen(nextProfile);
      }

      if (typeof payload.soundPlaceholdersEnabled === "boolean") {
        nextProfile = applySoundPlaceholdersEnabled(nextProfile, payload.soundPlaceholdersEnabled);
      }

      if (typeof payload.avatarId === "string") {
        nextProfile = applyAvatarId(nextProfile, payload.avatarId);
      }

      if (typeof payload.premiumAvatarId === "string") {
        nextProfile = applyPremiumAvatarPurchase(nextProfile, payload.premiumAvatarId);
      }

      if (payload.singlePlayerHighRounds && Object.keys(payload.singlePlayerHighRounds).length > 0) {
        nextProfile = applySinglePlayerHighRounds(nextProfile, payload.singlePlayerHighRounds);
      }

      if (payload.singlePlayerHighScores && Object.keys(payload.singlePlayerHighScores).length > 0) {
        nextProfile = applySinglePlayerHighScores(nextProfile, payload.singlePlayerHighScores);
      }

      if (typeof payload.extraGuessPowerUpsDelta === "number" && payload.extraGuessPowerUpsDelta !== 0) {
        nextProfile = applyExtraGuessPowerUps(nextProfile, payload.extraGuessPowerUpsDelta);
      }

      if (typeof payload.skipBoostersDelta === "number" && payload.skipBoostersDelta !== 0) {
        nextProfile = applySkipBoosters(nextProfile, payload.skipBoostersDelta);
      }

      if (typeof payload.coinsDelta === "number" && payload.coinsDelta !== 0) {
        nextProfile = applyCoins(nextProfile, payload.coinsDelta);
      }

      if (payload.activePracticeRun) {
        nextProfile = applyActivePracticeRun(
          nextProfile,
          payload.activePracticeRun.difficulty,
          payload.activePracticeRun.snapshot
        );
      }

      return nextProfile;
    });
  }

  async updateDisplayName(playerKey: string, displayName: string): Promise<UpdateDisplayNameResponse> {
    this.assertConfigured();
    const current = await this.requirePlayer(playerKey);
    const nextDisplayName = await this.resolveDisplayName(playerKey, displayName, true);

    await prisma.playerProgress.update({
      where: {
        playerKey
      },
      data: {
        displayName: nextDisplayName
      }
    });

    return {
      playerKey: current.playerKey,
      displayName: nextDisplayName,
      profile: current.profile,
      leaderboard: await this.getLeaderboard(current.playerKey, current.profile, nextDisplayName),
      persistence: "remote"
    };
  }

  async claimDailyReward(playerKey: string): Promise<ClaimDailyRewardResponse> {
    const result = await this.updateProfileWithResult(playerKey, (profile) => {
      const rewardResult = claimProfileDailyReward(profile);

      return {
        profile: rewardResult.claimed ? rewardResult.profile : profile,
        result: {
          claimed: rewardResult.claimed,
          reward: rewardResult.reward
        }
      };
    });

    return {
      playerKey: result.playerKey,
      displayName: result.displayName,
      profile: result.profile,
      leaderboard: result.leaderboard,
      persistence: "remote",
      claimed: result.result.claimed,
      reward: result.result.reward
    };
  }

  async recordMatch(playerKey: string, input: MatchInput): Promise<RecordMatchResponse> {
    const result = await this.updateProfileWithResult(playerKey, (profile) => {
      const matchResult = applyRecordedMatch(profile, input);

      return {
        profile: matchResult.profile,
        result: matchResult.record
      };
    });

    return {
      playerKey: result.playerKey,
      displayName: result.displayName,
      profile: result.profile,
      leaderboard: result.leaderboard,
      persistence: "remote",
      record: result.result
    };
  }

  private async updateProfile(playerKey: string, updater: (profile: PlayerProfile) => PlayerProfile) {
    const result = await this.updateProfileWithResult(playerKey, (profile) => ({
      profile: updater(profile),
      result: null
    }));

    return {
      playerKey: result.playerKey,
      displayName: result.displayName,
      profile: result.profile,
      leaderboard: result.leaderboard,
      persistence: "remote" as const
    };
  }

  private async updateProfileWithResult<T>(
    playerKey: string,
    updater: (profile: PlayerProfile) => {
      profile: PlayerProfile;
      result: T;
    }
  ) {
    this.assertConfigured();
    const updated = await prisma.$transaction(async (tx) => {
      const current = await this.requirePlayerForUpdate(tx, playerKey);
      const next = updater(current.profile);
      const profile = normalizeProfile(next.profile);
      const persistedProfile = await this.persistLockedProfile(tx, current.playerKey, current.displayName, profile);

      return {
        playerKey: current.playerKey,
        displayName: current.displayName,
        profile: persistedProfile,
        result: next.result
      };
    });

    return {
      ...updated,
      leaderboard: await this.getLeaderboard(updated.playerKey, updated.profile, updated.displayName)
    };
  }

  private async requirePlayer(playerKey: string) {
    const record = await prisma.playerProgress.findUnique({
      where: {
        playerKey
      }
    });

    if (!record) {
      throw new Error("Player profile not found. Please reopen the game and try again.");
    }

    return {
      ...record,
      profile: parseProfile(record.profile)
    };
  }

  private async requirePlayerForUpdate(tx: Prisma.TransactionClient, playerKey: string) {
    const records = await tx.$queryRaw<Array<{
      playerKey: string;
      displayName: string;
      profile: unknown;
    }>>`
      SELECT "playerKey", "displayName", "profile"
      FROM "PlayerProgress"
      WHERE "playerKey" = ${playerKey}
      FOR UPDATE
    `;
    const record = records[0];

    if (!record) {
      throw new Error("Player profile not found. Please reopen the game and try again.");
    }

    return {
      ...record,
      profile: parseProfile(record.profile)
    };
  }

  private async persistLockedProfile(
    tx: Prisma.TransactionClient,
    playerKey: string,
    displayName: string,
    profile: PlayerProfile
  ) {
    const normalizedProfile = normalizeProfile(profile);

    await tx.playerProgress.update({
      where: {
        playerKey
      },
      data: {
        displayName,
        profile: profileToJson(normalizedProfile),
        totalPoints: normalizedProfile.totalPoints,
        level: normalizedProfile.level,
        currentWinStreak: normalizedProfile.currentWinStreak,
        onlinePoints: normalizedProfile.stats.category.online.points,
        onlineWins: normalizedProfile.stats.category.online.wins
      }
    });

    return normalizedProfile;
  }

  private hashDeviceSecret(deviceSecret?: string) {
    const normalizedSecret = deviceSecret?.trim();

    if (!normalizedSecret || normalizedSecret.length < 24) {
      return null;
    }

    return createHash("sha256").update(normalizedSecret).digest("hex");
  }

  private async verifyOrAttachDeviceSecret(
    playerKey: string,
    profile: PlayerProfile,
    deviceSecretHash: string | null
  ) {
    if (!deviceSecretHash) {
      return profile;
    }

    if (profile.deviceSecretHash === deviceSecretHash) {
      return profile;
    }

    return prisma.$transaction(async (tx) => {
      const current = await this.requirePlayerForUpdate(tx, playerKey);

      if (current.profile.deviceSecretHash === deviceSecretHash) {
        return current.profile;
      }

      // playerKey is the only durable profile credential in this app. Device
      // secrets can change across reinstalls, restores, and native/dev builds,
      // so rotate the stored secret instead of locking out the profile.
      return this.persistLockedProfile(tx, playerKey, current.displayName, {
        ...current.profile,
        deviceSecretHash
      });
    });
  }

  private async getLeaderboard(playerKey: string, profile: PlayerProfile, displayName: string) {
    if (!isDatabaseConfigured()) {
      return createFallbackLeaderboard(profile);
    }

    return leaderboardService.getLeaderboard(playerKey, profile, displayName);
  }

  private async resolveDisplayName(playerKey: string, requestedDisplayName?: string, requireUnique = false) {
    if (requestedDisplayName && requestedDisplayName.trim().length > 0) {
      const normalizedDisplayName = validateDisplayName(requestedDisplayName);
      const conflictingPlayer = await prisma.$queryRaw<Array<{ playerKey: string }>>`
        SELECT "playerKey"
        FROM "PlayerProgress"
        WHERE LOWER("displayName") = LOWER(${normalizedDisplayName})
          AND "playerKey" <> ${playerKey}
        LIMIT 1
      `;

      if (conflictingPlayer.length > 0) {
        throw new Error("That username is already taken.");
      }

      return normalizedDisplayName;
    }

    const baseDisplayName = getDefaultDisplayName(playerKey);

    if (!requireUnique) {
      const conflictingPlayer = await prisma.$queryRaw<Array<{ playerKey: string }>>`
        SELECT "playerKey"
        FROM "PlayerProgress"
        WHERE LOWER("displayName") = LOWER(${baseDisplayName})
          AND "playerKey" <> ${playerKey}
        LIMIT 1
      `;

      if (conflictingPlayer.length === 0) {
        return baseDisplayName;
      }
    }

    for (let suffix = 0; suffix < 50; suffix += 1) {
      const candidate = suffix === 0 ? baseDisplayName : `${baseDisplayName}_${suffix + 1}`;
      const conflictingPlayer = await prisma.$queryRaw<Array<{ playerKey: string }>>`
        SELECT "playerKey"
        FROM "PlayerProgress"
        WHERE LOWER("displayName") = LOWER(${candidate})
          AND "playerKey" <> ${playerKey}
        LIMIT 1
      `;

      if (conflictingPlayer.length === 0) {
        return candidate;
      }
    }

    throw new Error("Could not reserve a username right now. Please try again.");
  }
}

export const progressionService = new ProgressionService();
