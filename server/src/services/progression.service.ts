import { prisma } from "../lib/prisma";
import type {
  ClaimDailyRewardResponse,
  LeaderboardEntry,
  MatchInput,
  PlayerProfile,
  ProgressBootstrapPayload,
  ProgressSyncResponse,
  RecordMatchResponse,
  UpdateDisplayNameResponse
} from "../../../shared/progression.types";
import {
  applyRecordedMatch,
  applySoundPlaceholdersEnabled,
  applyTutorialSeen,
  buildOnlineLeaderboard,
  claimProfileDailyReward,
  createInitialProfile,
  getDefaultDisplayName,
  getPlayerOnlineScore,
  normalizeProfile,
  validateDisplayName
} from "../../../shared/progression";

const isDatabaseConfigured = () => Boolean(process.env.DATABASE_URL);

const profileToJson = (profile: PlayerProfile) => profile as unknown as never;

const parseProfile = (value: unknown): PlayerProfile => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createInitialProfile();
  }

  return normalizeProfile(value as Partial<PlayerProfile>);
};

const shouldImportLocalProfile = (remoteProfile: PlayerProfile, localProfile?: PlayerProfile | null) => {
  if (!localProfile) {
    return false;
  }

  const normalizedLocalProfile = normalizeProfile(localProfile);
  const remoteUpdatedAt = new Date(remoteProfile.updatedAt).getTime();
  const localUpdatedAt = new Date(normalizedLocalProfile.updatedAt).getTime();

  return (
    normalizedLocalProfile.stats.matches > remoteProfile.stats.matches &&
    Number.isFinite(localUpdatedAt) &&
    localUpdatedAt > remoteUpdatedAt
  );
};

const toLeaderboardEntry = (
  playerKey: string,
  displayName: string,
  profile: PlayerProfile,
  isPlayer: boolean
): LeaderboardEntry => ({
  id: playerKey,
  rank: 0,
  name: isPlayer ? "You" : displayName,
  points: getPlayerOnlineScore(profile) + profile.bestWinStreak * 8 + profile.level * 16,
  streak: profile.currentWinStreak,
  level: profile.level,
  isPlayer
});

const createFallbackLeaderboard = (profile: PlayerProfile) => buildOnlineLeaderboard(profile);

class ProgressionService {
  private assertConfigured() {
    if (!isDatabaseConfigured()) {
      throw new Error("Progress persistence is not configured on the server.");
    }
  }

  async bootstrap(payload: ProgressBootstrapPayload): Promise<ProgressSyncResponse> {
    this.assertConfigured();

    const localProfile = normalizeProfile(payload.localProfile ?? undefined);
    const displayName = await this.resolveDisplayName(payload.playerKey, payload.displayName);
    const existing = await prisma.playerProgress.findUnique({
      where: {
        playerKey: payload.playerKey
      }
    });

    if (!existing) {
      const createdProfile = localProfile;
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

    let profile = parseProfile(existing.profile);

    if (shouldImportLocalProfile(profile, payload.localProfile)) {
      profile = normalizeProfile(payload.localProfile);
      await this.persistProfile(existing.playerKey, existing.displayName, profile);
    }

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
    this.assertConfigured();
    const current = await this.requirePlayer(playerKey);
    const { profile, claimed, reward } = claimProfileDailyReward(current.profile);

    if (claimed) {
      await this.persistProfile(current.playerKey, current.displayName, profile);
    }

    return {
      playerKey: current.playerKey,
      displayName: current.displayName,
      profile: claimed ? profile : current.profile,
      leaderboard: await this.getLeaderboard(
        current.playerKey,
        claimed ? profile : current.profile,
        current.displayName
      ),
      persistence: "remote",
      claimed,
      reward
    };
  }

  async recordMatch(playerKey: string, input: MatchInput): Promise<RecordMatchResponse> {
    this.assertConfigured();
    const current = await this.requirePlayer(playerKey);
    const { profile, record } = applyRecordedMatch(current.profile, input);

    await this.persistProfile(current.playerKey, current.displayName, profile);

    return {
      playerKey: current.playerKey,
      displayName: current.displayName,
      profile,
      leaderboard: await this.getLeaderboard(current.playerKey, profile, current.displayName),
      persistence: "remote",
      record
    };
  }

  private async updateProfile(playerKey: string, updater: (profile: PlayerProfile) => PlayerProfile) {
    this.assertConfigured();
    const current = await this.requirePlayer(playerKey);
    const profile = normalizeProfile(updater(current.profile));

    await this.persistProfile(current.playerKey, current.displayName, profile);

    return {
      playerKey: current.playerKey,
      displayName: current.displayName,
      profile,
      leaderboard: await this.getLeaderboard(current.playerKey, profile, current.displayName),
      persistence: "remote" as const
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

  private async persistProfile(playerKey: string, displayName: string, profile: PlayerProfile) {
    await prisma.playerProgress.update({
      where: {
        playerKey
      },
      data: {
        displayName,
        profile: profileToJson(profile),
        totalPoints: profile.totalPoints,
        level: profile.level,
        currentWinStreak: profile.currentWinStreak,
        onlinePoints: profile.stats.category.online.points,
        onlineWins: profile.stats.category.online.wins
      }
    });
  }

  private async getLeaderboard(playerKey: string, profile: PlayerProfile, displayName: string) {
    if (!isDatabaseConfigured()) {
      return createFallbackLeaderboard(profile);
    }

    const topPlayers = await prisma.playerProgress.findMany({
      orderBy: [
        {
          onlinePoints: "desc"
        },
        {
          level: "desc"
        },
        {
          currentWinStreak: "desc"
        }
      ],
      take: 8
    });

    const entries: LeaderboardEntry[] = topPlayers.map((entry) =>
      toLeaderboardEntry(entry.playerKey, entry.displayName, parseProfile(entry.profile), entry.playerKey === playerKey)
    );

    if (!entries.some((entry: LeaderboardEntry) => entry.id === playerKey)) {
      entries.push(toLeaderboardEntry(playerKey, displayName, profile, true));
    }

    return entries
      .sort((left: LeaderboardEntry, right: LeaderboardEntry) => right.points - left.points)
      .slice(0, 8)
      .map((entry: LeaderboardEntry, index: number) => ({
        ...entry,
        rank: index + 1
      }));
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
