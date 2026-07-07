import { prisma } from "../lib/prisma";
import type { LeaderboardEntry, PlayerProfile } from "../../../shared/progression.types";
import { getPlayerBestScore, normalizeProfile } from "../../../shared/progression";

const LEADERBOARD_LIMIT = 8;
const LEADERBOARD_CACHE_TTL_MS = 60_000;

interface CachedLeaderboardEntry extends LeaderboardEntry {
  displayName: string;
  isPlayer: boolean;
}

const toLeaderboardEntry = (
  playerKey: string,
  displayName: string,
  profile: PlayerProfile,
  isPlayer: boolean
): CachedLeaderboardEntry => ({
  id: playerKey,
  rank: 0,
  displayName,
  name: isPlayer ? "You" : displayName,
  avatarId: profile.avatarId,
  points: getPlayerBestScore(profile),
  streak: profile.bestWinStreak,
  level: profile.level,
  isPlayer
});

class LeaderboardService {
  private cachedEntries: CachedLeaderboardEntry[] = [];
  private cacheExpiresAt = 0;

  async getLeaderboard(playerKey: string, profile: PlayerProfile, displayName: string): Promise<LeaderboardEntry[]> {
    const cachedEntries = await this.getCachedEntries();
    const playerEntry = toLeaderboardEntry(playerKey, displayName, profile, true);
    const entries: CachedLeaderboardEntry[] = cachedEntries
      .filter((entry) => entry.id !== playerKey)
      .map((entry) => ({
        ...entry,
        isPlayer: false,
        name: entry.displayName
      }));

    entries.push(playerEntry);

    const rankedEntries = entries
      .sort(
        (left, right) =>
          right.points - left.points ||
          right.streak - left.streak ||
          right.level - left.level ||
          left.name.localeCompare(right.name)
      )
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));

    const topEntries = rankedEntries.slice(0, LEADERBOARD_LIMIT);
    const rankedPlayerEntry = rankedEntries.find((entry) => entry.id === playerKey);

    return rankedPlayerEntry && !topEntries.some((entry) => entry.id === playerKey)
      ? [...topEntries, rankedPlayerEntry]
      : topEntries;
  }

  invalidate() {
    this.cacheExpiresAt = 0;
  }

  private async getCachedEntries() {
    if (Date.now() < this.cacheExpiresAt) {
      return this.cachedEntries;
    }

    const players = await prisma.playerProgress.findMany({
      select: {
        displayName: true,
        playerKey: true,
        profile: true
      }
    });

    this.cachedEntries = players.map((entry) =>
      toLeaderboardEntry(
        entry.playerKey,
        entry.displayName,
        normalizeProfile(entry.profile as Partial<PlayerProfile>),
        false
      )
    );
    this.cacheExpiresAt = Date.now() + LEADERBOARD_CACHE_TTL_MS;

    return this.cachedEntries;
  }
}

export const leaderboardService = new LeaderboardService();
