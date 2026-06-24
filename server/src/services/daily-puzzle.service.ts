import { randomInt } from "crypto";
import type { DailyPuzzleResult } from "@prisma/client";

import { prisma } from "../lib/prisma";
import type {
  DailyPuzzleLeaderboardEntry,
  DailyPuzzleLeaderboardResponse,
  DailyPuzzleGuessPayload,
  DailyPuzzleGuessResponse,
  DailyPuzzleStatusResponse,
  LeaderboardEntry,
  PlayerProfile
} from "../../../shared/progression.types";
import {
  applyDailyPuzzleCompletion,
  applyRecordedMatch,
  DEFAULT_AVATAR_ID,
  getDailyPuzzleCompletion,
  getPlayerOnlineScore,
  normalizeProfile
} from "../../../shared/progression";

const DAILY_PUZZLE_MAX_NUMBER = 9999;
const DAILY_PUZZLE_LEADERBOARD_LIMIT = 20;
const DAILY_PUZZLE_RANK_COIN_REWARDS: Record<number, number> = {
  1: 1000,
  2: 500,
  3: 100
};

const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const getServerTodayKey = () => new Date().toISOString().slice(0, 10);
const resolvePuzzleDateKey = (dateKey?: string) => (dateKey && isDateKey(dateKey) ? dateKey : getServerTodayKey());
const isClosedUtcDailyDate = (dateKey: string) => dateKey < getServerTodayKey();
const getRankCoinReward = (rank: number) => DAILY_PUZZLE_RANK_COIN_REWARDS[rank] ?? 0;
const isCompletedDuringUtcDailyWindow = (dateKey: string, completedAt: Date) => {
  const windowStart = new Date(`${dateKey}T00:00:00.000Z`).getTime();
  const windowEnd = windowStart + 86_400_000;
  const completedTime = completedAt.getTime();

  return Number.isFinite(completedTime) && completedTime >= windowStart && completedTime < windowEnd;
};

class DailyPuzzleService {
  async getStatus(playerKey: string, dateKey?: string): Promise<DailyPuzzleStatusResponse> {
    this.assertConfigured();

    const todayKey = resolvePuzzleDateKey(dateKey);
    const current = await this.requirePlayer(playerKey);
    const puzzle = await this.getPuzzleForDate(todayKey);

    return {
      playerKey: current.playerKey,
      displayName: current.displayName,
      profile: current.profile,
      leaderboard: await this.getLeaderboard(current.playerKey, current.profile, current.displayName),
      persistence: "remote",
      todayKey,
      maxNumber: puzzle.maxNumber,
      todayCompletion: getDailyPuzzleCompletion(current.profile, todayKey)
    };
  }

  async submitGuess(payload: DailyPuzzleGuessPayload): Promise<DailyPuzzleGuessResponse> {
    this.assertConfigured();

    const todayKey = resolvePuzzleDateKey(payload.dateKey);
    const current = await this.requirePlayer(payload.playerKey);
    const puzzle = await this.getPuzzleForDate(todayKey);
    const currentCompletion = getDailyPuzzleCompletion(current.profile, todayKey);

    if (currentCompletion) {
      return {
        playerKey: current.playerKey,
        displayName: current.displayName,
        profile: current.profile,
        leaderboard: await this.getLeaderboard(current.playerKey, current.profile, current.displayName),
        persistence: "remote",
        todayKey,
        maxNumber: puzzle.maxNumber,
        feedback: "already-solved",
        solved: true,
        completion: currentCompletion,
        record: null
      };
    }

    const guess = Number(payload.guess);

    if (!Number.isInteger(guess) || guess < 1 || guess > puzzle.maxNumber) {
      throw new Error(`Guess must be between 1 and ${puzzle.maxNumber}.`);
    }

    if (!payload.rewardedSkip && guess !== puzzle.secretNumber) {
      return {
        playerKey: current.playerKey,
        displayName: current.displayName,
        profile: current.profile,
        leaderboard: await this.getLeaderboard(current.playerKey, current.profile, current.displayName),
        persistence: "remote",
        todayKey,
        maxNumber: puzzle.maxNumber,
        feedback: guess < puzzle.secretNumber ? "higher" : "lower",
        solved: false,
        completion: null,
        record: null
      };
    }

    const attempts = Math.max(1, Math.min(99, Math.floor(payload.attempts)));
    const durationMs = Math.max(1_000, Math.min(7_200_000, Math.floor(payload.durationMs)));
    const recordedMatch = applyRecordedMatch(current.profile, {
      category: "single-player",
      mode: "daily",
      difficulty: "impossible",
      outcome: "win",
      attempts,
      durationMs,
      opponentName: "Daily Board",
      opponentPersona: `UTC ${todayKey}`
    });
    const completed = applyDailyPuzzleCompletion(
      recordedMatch.profile,
      todayKey,
      attempts,
      durationMs,
      recordedMatch.record.id
    );

    await this.persistProfile(current.playerKey, current.displayName, completed.profile);
    await this.recordDailyPuzzleResult({
      attempts,
      avatarId: current.profile.avatarId,
      dateKey: todayKey,
      displayName: current.displayName,
      durationMs,
      playerKey: current.playerKey,
      rewardEligible: todayKey === getServerTodayKey()
    });

    return {
      playerKey: current.playerKey,
      displayName: current.displayName,
      profile: completed.profile,
      leaderboard: await this.getLeaderboard(current.playerKey, completed.profile, current.displayName),
      persistence: "remote",
      todayKey,
      maxNumber: puzzle.maxNumber,
      feedback: "correct",
      solved: true,
      completion: completed.completion,
      record: recordedMatch.record,
      dailyPuzzleReward: {
        streakDays: completed.dailyPuzzleStreak,
        extraGuessPowerUps: completed.extraGuessPowerUpReward,
        coins: completed.coinReward
      }
    };
  }

  async getDailyLeaderboard(playerKey: string, dateKey?: string): Promise<DailyPuzzleLeaderboardResponse> {
    this.assertConfigured();

    const leaderboardDateKey = resolvePuzzleDateKey(dateKey);

    await this.backfillDailyPuzzleResultsForDate(leaderboardDateKey);

    if (isClosedUtcDailyDate(leaderboardDateKey)) {
      await this.finalizeDailyLeaderboardRewards(leaderboardDateKey);
    }

    const current = await this.requirePlayer(playerKey);
    const topRows = await prisma.dailyPuzzleResult.findMany({
      where: {
        dateKey: leaderboardDateKey,
        rewardEligible: true
      },
      orderBy: [
        { attempts: "asc" },
        { durationMs: "asc" },
        { completedAt: "asc" }
      ],
      take: DAILY_PUZZLE_LEADERBOARD_LIMIT
    });
    const playerRank = await this.getDailyPuzzleRank(leaderboardDateKey, playerKey);
    const topEntries = topRows.map((row, index) => this.toDailyPuzzleLeaderboardEntry(row, index + 1, playerKey));
    const playerEntry =
      playerRank && !topEntries.some((entry) => entry.playerKey === playerKey)
        ? this.toDailyPuzzleLeaderboardEntry(playerRank.result, playerRank.rank, playerKey)
        : topEntries.find((entry) => entry.playerKey === playerKey) ?? null;

    return {
      playerKey: current.playerKey,
      displayName: current.displayName,
      profile: current.profile,
      leaderboard: await this.getLeaderboard(current.playerKey, current.profile, current.displayName),
      persistence: "remote",
      dateKey: leaderboardDateKey,
      isFinalized: isClosedUtcDailyDate(leaderboardDateKey),
      rewardConfig: DAILY_PUZZLE_RANK_COIN_REWARDS,
      topEntries,
      playerEntry
    };
  }

  private assertConfigured() {
    if (!process.env.DATABASE_URL) {
      throw new Error("Daily puzzle needs server persistence. Add DATABASE_URL and restart the backend.");
    }
  }

  private async getPuzzleForDate(dateKey: string) {
    return prisma.dailyPuzzle.upsert({
      where: {
        dateKey
      },
      update: {},
      create: {
        dateKey,
        secretNumber: randomInt(1, DAILY_PUZZLE_MAX_NUMBER + 1),
        maxNumber: DAILY_PUZZLE_MAX_NUMBER
      }
    });
  }

  private async requirePlayer(playerKey: string) {
    const record = await prisma.playerProgress.findUnique({
      where: {
        playerKey
      }
    });

    if (!record) {
      throw new Error("Player profile not found. Reopen the game and try again.");
    }

    return {
      ...record,
      profile: normalizeProfile(record.profile as Partial<PlayerProfile>)
    };
  }

  private async persistProfile(playerKey: string, displayName: string, profile: PlayerProfile) {
    await prisma.playerProgress.update({
      where: {
        playerKey
      },
      data: {
        displayName,
        profile: profile as unknown as never,
        totalPoints: profile.totalPoints,
        level: profile.level,
        currentWinStreak: profile.currentWinStreak,
        onlinePoints: profile.stats.category.online.points,
        onlineWins: profile.stats.category.online.wins
      }
    });
  }

  private async recordDailyPuzzleResult(input: {
    attempts: number;
    avatarId: string;
    dateKey: string;
    displayName: string;
    durationMs: number;
    playerKey: string;
    rewardEligible: boolean;
  }) {
    await prisma.dailyPuzzleResult.upsert({
      where: {
        dateKey_playerKey: {
          dateKey: input.dateKey,
          playerKey: input.playerKey
        }
      },
      update: {
        avatarIdSnapshot: input.avatarId,
        displayNameSnapshot: input.displayName
      },
      create: {
        dateKey: input.dateKey,
        playerKey: input.playerKey,
        displayNameSnapshot: input.displayName,
        avatarIdSnapshot: input.avatarId,
        attempts: input.attempts,
        durationMs: input.durationMs,
        completedAt: new Date(),
        rewardEligible: input.rewardEligible
      }
    });
  }

  private async backfillDailyPuzzleResultsForDate(dateKey: string) {
    const players = await prisma.playerProgress.findMany({
      select: {
        displayName: true,
        playerKey: true,
        profile: true
      }
    });

    const resultWrites = players.flatMap((player) => {
      const profile = normalizeProfile(player.profile as Partial<PlayerProfile>);
      const completion = getDailyPuzzleCompletion(profile, dateKey);

      if (!completion) {
        return [];
      }

      const completedAt = new Date(completion.completedAt);

      if (!Number.isFinite(completedAt.getTime())) {
        return [];
      }

      return [
        prisma.dailyPuzzleResult.upsert({
          where: {
            dateKey_playerKey: {
              dateKey,
              playerKey: player.playerKey
            }
          },
          update: {
            displayNameSnapshot: player.displayName,
            avatarIdSnapshot: profile.avatarId
          },
          create: {
            dateKey,
            playerKey: player.playerKey,
            displayNameSnapshot: player.displayName,
            avatarIdSnapshot: profile.avatarId,
            attempts: completion.attempts,
            durationMs: completion.durationMs,
            completedAt,
            rewardEligible: isCompletedDuringUtcDailyWindow(dateKey, completedAt)
          }
        })
      ];
    });

    if (resultWrites.length === 0) {
      return;
    }

    await prisma.$transaction(resultWrites);
  }

  private async finalizeDailyLeaderboardRewards(dateKey: string) {
    const winners = await prisma.dailyPuzzleResult.findMany({
      where: {
        dateKey,
        rewardEligible: true
      },
      orderBy: [
        { attempts: "asc" },
        { durationMs: "asc" },
        { completedAt: "asc" }
      ],
      take: 3
    });

    for (let index = 0; index < winners.length; index += 1) {
      const rank = index + 1;
      const rewardCoins = getRankCoinReward(rank);
      const winner = winners[index];

      if (rewardCoins <= 0 || winner.rewardCoinsAwarded >= rewardCoins) {
        continue;
      }

      const delta = rewardCoins - winner.rewardCoinsAwarded;
      const player = await prisma.playerProgress.findUnique({
        where: {
          playerKey: winner.playerKey
        }
      });

      if (!player) {
        continue;
      }

      const profile = normalizeProfile(player.profile as Partial<PlayerProfile>);
      const rewardedProfile: PlayerProfile = {
        ...profile,
        coins: profile.coins + delta,
        updatedAt: new Date().toISOString()
      };

      await prisma.$transaction([
        prisma.playerProgress.update({
          where: {
            playerKey: winner.playerKey
          },
          data: {
            profile: rewardedProfile as unknown as never
          }
        }),
        prisma.dailyPuzzleResult.update({
          where: {
            id: winner.id
          },
          data: {
            rewardAwardedAt: new Date(),
            rewardCoinsAwarded: rewardCoins
          }
        })
      ]);
    }
  }

  private toDailyPuzzleLeaderboardEntry(
    result: DailyPuzzleResult,
    rank: number,
    playerKey: string
  ): DailyPuzzleLeaderboardEntry {
    const rewardCoins = result.rewardEligible ? getRankCoinReward(rank) : 0;

    return {
      playerKey: result.playerKey,
      rank,
      name: result.playerKey === playerKey ? "You" : result.displayNameSnapshot,
      avatarId: (result.avatarIdSnapshot || DEFAULT_AVATAR_ID) as DailyPuzzleLeaderboardEntry["avatarId"],
      attempts: result.attempts,
      durationMs: result.durationMs,
      completedAt: result.completedAt.toISOString(),
      rewardEligible: result.rewardEligible,
      rewardCoins,
      rewardCoinsAwarded: result.rewardCoinsAwarded,
      isPlayer: result.playerKey === playerKey
    };
  }

  private async getDailyPuzzleRank(dateKey: string, playerKey: string) {
    const result = await prisma.dailyPuzzleResult.findUnique({
      where: {
        dateKey_playerKey: {
          dateKey,
          playerKey
        }
      }
    });

    if (!result || !result.rewardEligible) {
      return null;
    }

    const betterCount = await prisma.dailyPuzzleResult.count({
      where: {
        dateKey,
        rewardEligible: true,
        OR: [
          {
            attempts: {
              lt: result.attempts
            }
          },
          {
            attempts: result.attempts,
            durationMs: {
              lt: result.durationMs
            }
          },
          {
            attempts: result.attempts,
            durationMs: result.durationMs,
            completedAt: {
              lt: result.completedAt
            }
          }
        ]
      }
    });

    return {
      rank: betterCount + 1,
      result
    };
  }

  private toLeaderboardEntry(playerKey: string, entryKey: string, displayName: string, profile: PlayerProfile): LeaderboardEntry {
    return {
      id: entryKey,
      rank: 0,
      name: entryKey === playerKey ? "You" : displayName,
      points: getPlayerOnlineScore(profile) + profile.bestWinStreak * 8 + profile.level * 16,
      streak: profile.currentWinStreak,
      level: profile.level,
      isPlayer: entryKey === playerKey
    };
  }

  private async getLeaderboard(playerKey: string, profile: PlayerProfile, displayName: string) {
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

    const entries = topPlayers.map((entry) =>
      this.toLeaderboardEntry(
        playerKey,
        entry.playerKey,
        entry.displayName,
        normalizeProfile(entry.profile as Partial<PlayerProfile>)
      )
    );

    if (!entries.some((entry) => entry.id === playerKey)) {
      entries.push(this.toLeaderboardEntry(playerKey, playerKey, displayName, profile));
    }

    return entries
      .sort((left, right) => right.points - left.points)
      .slice(0, 8)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
  }
}

export const dailyPuzzleService = new DailyPuzzleService();
