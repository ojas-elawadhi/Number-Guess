import { randomInt } from "crypto";

import { prisma } from "../lib/prisma";
import type {
  DailyPuzzleGuessPayload,
  DailyPuzzleGuessResponse,
  DailyPuzzleStatusResponse,
  LeaderboardEntry,
  PlayerProfile
} from "../../../shared/progression.types";
import {
  applyDailyPuzzleCompletion,
  applyRecordedMatch,
  getDailyPuzzleCompletion,
  getPlayerOnlineScore,
  normalizeProfile
} from "../../../shared/progression";

const DAILY_PUZZLE_MAX_NUMBER = 9999;

const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const getServerTodayKey = () => new Date().toISOString().slice(0, 10);
const resolvePuzzleDateKey = (dateKey?: string) => (dateKey && isDateKey(dateKey) ? dateKey : getServerTodayKey());

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

    if (guess !== puzzle.secretNumber) {
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
      record: recordedMatch.record
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
