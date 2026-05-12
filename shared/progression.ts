import type { Difficulty } from "./game.types";
import type {
  AchievementDefinition,
  AchievementId,
  ActivePracticeRunSnapshot,
  DailyPuzzleCompletion,
  LeaderboardEntry,
  MatchInput,
  MatchOutcome,
  MatchRecord,
  PlayerProfile,
  PlayerStats,
  ScoreBreakdown
} from "./progression.types";

export const MAX_HISTORY_ITEMS = 20;
export const DISPLAY_NAME_MIN_LENGTH = 3;
export const DISPLAY_NAME_MAX_LENGTH = 20;

const difficultyMultipliers: Record<Difficulty, number> = {
  easy: 1,
  hard: 1.5,
  impossible: 2.2
};

export const achievements: AchievementDefinition[] = [
  {
    id: "first-win",
    title: "First Win",
    description: "Win your first match.",
    icon: "ribbon-outline"
  },
  {
    id: "streak-3",
    title: "On Fire",
    description: "Reach a 3-match win streak.",
    icon: "flame-outline"
  },
  {
    id: "streak-5",
    title: "Unstoppable",
    description: "Reach a 5-match win streak.",
    icon: "trophy-outline"
  },
  {
    id: "hard-winner",
    title: "High Roller",
    description: "Win a Hard range match.",
    icon: "diamond-outline"
  },
  {
    id: "quick-reader",
    title: "Quick Reader",
    description: "Win in 4 attempts or fewer.",
    icon: "flash-outline"
  },
  {
    id: "ai-slayer",
    title: "AI Slayer",
    description: "Win 5 VS AI matches.",
    icon: "skull-outline"
  },
  {
    id: "online-contender",
    title: "Online Contender",
    description: "Win 3 online matches.",
    icon: "globe-outline"
  },
  {
    id: "daily-dedication",
    title: "Daily Dedication",
    description: "Claim daily rewards 3 days in a row.",
    icon: "calendar-outline"
  },
  {
    id: "daily-starter",
    title: "Daily Starter",
    description: "Clear your first daily puzzle.",
    icon: "sparkles-outline"
  },
  {
    id: "calendar-climber",
    title: "Calendar Climber",
    description: "Clear 3 daily puzzles in a single month.",
    icon: "bar-chart-outline"
  },
  {
    id: "calendar-collector",
    title: "Calendar Collector",
    description: "Clear 10 daily puzzles in a single month.",
    icon: "albums-outline"
  },
  {
    id: "perfect-month",
    title: "Perfect Month",
    description: "Clear every daily puzzle in a calendar month.",
    icon: "trophy-outline"
  }
];

const defaultCategoryStats = () => ({
  wins: 0,
  losses: 0,
  ties: 0,
  matches: 0,
  points: 0
});

export const createInitialStats = (): PlayerStats => ({
  wins: 0,
  losses: 0,
  ties: 0,
  matches: 0,
  totalAttempts: 0,
  totalDurationMs: 0,
  practiceMatches: 0,
  category: {
    "single-player": defaultCategoryStats(),
    "vs-ai": defaultCategoryStats(),
    online: defaultCategoryStats()
  },
  difficultyWins: {
    easy: 0,
    hard: 0,
    impossible: 0
  },
  singlePlayerHighRounds: {
    easy: 0,
    hard: 0,
    impossible: 0
  },
  singlePlayerHighScores: {
    easy: 0,
    hard: 0,
    impossible: 0
  }
});

export const createInitialProfile = (updatedAt = new Date().toISOString()): PlayerProfile => ({
  xp: 0,
  level: 1,
  totalPoints: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  extraGuessPowerUps: 0,
  coins: 0,
  achievements: [],
  history: [],
  stats: createInitialStats(),
  tutorialSeen: false,
  soundPlaceholdersEnabled: true,
  dailyReward: {
    lastClaimedOn: null,
    streakDays: 0
  },
  dailyPuzzle: {
    completedByDate: {}
  },
  activePracticeRuns: {},
  lastRewardSummary: null,
  lastMatchSummary: null,
  updatedAt
});

export const getDefaultDisplayName = (playerKey: string) => {
  let seed = 0;

  for (let index = 0; index < playerKey.length; index += 1) {
    seed = (seed * 31 + playerKey.charCodeAt(index)) % 100000;
  }

  return `player_${`${seed}`.padStart(5, "0")}`;
};

export const normalizeDisplayName = (value: string) => value.trim().replace(/\s+/g, " ");

export const normalizeDisplayNameLookup = (value: string) => normalizeDisplayName(value).toLowerCase();

export const validateDisplayName = (value: string) => {
  const normalized = normalizeDisplayName(value);

  if (normalized.length < DISPLAY_NAME_MIN_LENGTH || normalized.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Username must be ${DISPLAY_NAME_MIN_LENGTH}-${DISPLAY_NAME_MAX_LENGTH} characters long.`);
  }

  if (!/^[a-zA-Z0-9_ ]+$/.test(normalized)) {
    throw new Error("Username can only use letters, numbers, spaces, and underscores.");
  }

  if (normalized.toLowerCase() === "you") {
    throw new Error("Choose a different username.");
  }

  return normalized;
};

export const normalizeProfile = (profile?: Partial<PlayerProfile> | null): PlayerProfile => {
  const baseProfile = createInitialProfile();

  if (!profile) {
    return baseProfile;
  }

  return {
    ...baseProfile,
    ...profile,
    extraGuessPowerUps:
      typeof profile.extraGuessPowerUps === "number" && Number.isFinite(profile.extraGuessPowerUps)
        ? Math.max(0, Math.floor(profile.extraGuessPowerUps))
        : typeof (profile as Partial<{ reviveTokens: number }>).reviveTokens === "number" &&
            Number.isFinite((profile as Partial<{ reviveTokens: number }>).reviveTokens)
          ? Math.max(0, Math.floor((profile as Partial<{ reviveTokens: number }>).reviveTokens ?? 0))
          : baseProfile.extraGuessPowerUps,
    coins:
      typeof profile.coins === "number" && Number.isFinite(profile.coins)
        ? Math.max(0, Math.floor(profile.coins))
        : baseProfile.coins,
    achievements: Array.isArray(profile.achievements)
      ? [...new Set(profile.achievements as AchievementId[])]
      : baseProfile.achievements,
    history: Array.isArray(profile.history)
      ? profile.history.slice(0, MAX_HISTORY_ITEMS)
      : baseProfile.history,
    stats: {
      ...baseProfile.stats,
      ...profile.stats,
      category: {
        ...baseProfile.stats.category,
        ...profile.stats?.category
      },
      difficultyWins: {
        ...baseProfile.stats.difficultyWins,
        ...profile.stats?.difficultyWins
      },
      singlePlayerHighRounds: {
        ...baseProfile.stats.singlePlayerHighRounds,
        ...profile.stats?.singlePlayerHighRounds
      },
      singlePlayerHighScores: {
        ...baseProfile.stats.singlePlayerHighScores,
        ...profile.stats?.singlePlayerHighScores
      }
    },
    dailyReward: {
      ...baseProfile.dailyReward,
      ...profile.dailyReward
    },
    dailyPuzzle: {
      ...baseProfile.dailyPuzzle,
      ...profile.dailyPuzzle,
      completedByDate:
        profile.dailyPuzzle?.completedByDate &&
        typeof profile.dailyPuzzle.completedByDate === "object" &&
        !Array.isArray(profile.dailyPuzzle.completedByDate)
          ? profile.dailyPuzzle.completedByDate
          : baseProfile.dailyPuzzle.completedByDate
    },
    activePracticeRuns:
      profile.activePracticeRuns && typeof profile.activePracticeRuns === "object" && !Array.isArray(profile.activePracticeRuns)
        ? (Object.entries(profile.activePracticeRuns).reduce<Partial<Record<Difficulty, ActivePracticeRunSnapshot>>>(
            (accumulator, [difficultyKey, snapshot]) => {
              if (
                (difficultyKey === "easy" || difficultyKey === "hard" || difficultyKey === "impossible") &&
                snapshot &&
                typeof snapshot === "object" &&
                typeof snapshot.secretNumber === "number" &&
                Array.isArray((snapshot as ActivePracticeRunSnapshot).guessHistory) &&
                typeof (snapshot as ActivePracticeRunSnapshot).roundNumber === "number" &&
                typeof (snapshot as ActivePracticeRunSnapshot).remainingChances === "number" &&
                typeof (snapshot as ActivePracticeRunSnapshot).currentScore === "number" &&
                typeof (snapshot as ActivePracticeRunSnapshot).lastScoreGain === "number" &&
                ((snapshot as ActivePracticeRunSnapshot).runState === "playing" ||
                  (snapshot as ActivePracticeRunSnapshot).runState === "round-cleared")
              ) {
                accumulator[difficultyKey] = {
                  difficulty: difficultyKey,
                  secretNumber: Math.max(1, Math.floor((snapshot as ActivePracticeRunSnapshot).secretNumber)),
                  guessHistory: (snapshot as ActivePracticeRunSnapshot).guessHistory
                    .filter(
                      (entry) =>
                        entry &&
                        typeof entry.guess === "number" &&
                        (entry.result === "higher" || entry.result === "lower" || entry.result === "correct")
                    )
                    .map((entry) => ({
                      guess: Math.max(1, Math.floor(entry.guess)),
                      result: entry.result
                    })),
                  roundNumber: Math.max(1, Math.floor((snapshot as ActivePracticeRunSnapshot).roundNumber)),
                  remainingChances: Math.max(0, Math.floor((snapshot as ActivePracticeRunSnapshot).remainingChances)),
                  currentScore: Math.max(0, Math.floor((snapshot as ActivePracticeRunSnapshot).currentScore)),
                  lastScoreGain: Math.max(0, Math.floor((snapshot as ActivePracticeRunSnapshot).lastScoreGain)),
                  runState: (snapshot as ActivePracticeRunSnapshot).runState,
                  reviveUsedThisRun: Boolean((snapshot as ActivePracticeRunSnapshot).reviveUsedThisRun),
                  roundElapsedMs: Math.max(0, Math.floor((snapshot as ActivePracticeRunSnapshot).roundElapsedMs ?? 0)),
                  updatedAt:
                    typeof (snapshot as ActivePracticeRunSnapshot).updatedAt === "string"
                      ? (snapshot as ActivePracticeRunSnapshot).updatedAt
                      : baseProfile.updatedAt
                };
              }

              return accumulator;
            },
            {}
          ) as Partial<Record<Difficulty, ActivePracticeRunSnapshot>>)
        : baseProfile.activePracticeRuns,
    updatedAt: profile.updatedAt ?? baseProfile.updatedAt
  };
};

export const getLevelFromXp = (xp: number) => Math.max(1, Math.floor(Math.sqrt(xp / 140)) + 1);

const getBaseScore = (outcome: MatchOutcome) => {
  if (outcome === "win") {
    return 140;
  }

  if (outcome === "tie") {
    return 75;
  }

  return 35;
};

export const calculateMatchScore = (
  input: MatchInput,
  currentStreak: number
): {
  points: number;
  xpEarned: number;
  scoreBreakdown: ScoreBreakdown;
} => {
  const attemptScore = Math.max(8, 110 - Math.max(0, input.attempts - 1) * 11);
  const timeScore = Math.max(10, 90 - Math.floor(input.durationMs / 1000) * 2);
  const difficultyScore = Math.round(55 * difficultyMultipliers[input.difficulty]);
  const streakScore = input.outcome === "win" ? currentStreak * 12 : 0;
  const base = getBaseScore(input.outcome);
  const total = Math.round(base + attemptScore + timeScore + difficultyScore + streakScore);
  const xpEarned = Math.round(total * 0.72 + (input.outcome === "win" ? 24 : input.outcome === "tie" ? 14 : 8));

  return {
    points: total,
    xpEarned,
    scoreBreakdown: {
      base,
      attempts: attemptScore,
      time: timeScore,
      difficulty: difficultyScore,
      streak: streakScore,
      total
    }
  };
};

export const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
};

export const getTodayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getDateDifferenceInDays = (earlierKey: string, laterKey: string) => {
  const earlier = new Date(`${earlierKey}T00:00:00`);
  const later = new Date(`${laterKey}T00:00:00`);
  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
};

export const getDailyRewardValues = (streakDays: number) => ({
  points: 70 + streakDays * 18,
  xp: 40 + streakDays * 12
});

const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getMonthKey = (dateKey: string) => dateKey.slice(0, 7);

const getDaysInMonth = (monthKey: string) => {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return 0;
  }

  return new Date(year, month, 0).getDate();
};

const getDateKeyFromDailyHistoryRecord = (record: MatchRecord) => {
  if (record.mode !== "daily") {
    return null;
  }

  const personaMatch = record.opponentPersona?.match(/\d{4}-\d{2}-\d{2}/);

  if (personaMatch) {
    return personaMatch[0];
  }

  const playedAt = new Date(record.playedAt);

  if (Number.isNaN(playedAt.getTime())) {
    return null;
  }

  return getTodayKey(playedAt);
};

const getDailyPuzzleDateKeys = (profile: PlayerProfile) => {
  const dateKeys = new Set<string>();

  Object.keys(profile.dailyPuzzle.completedByDate).forEach((dateKey) => {
    if (isDateKey(dateKey)) {
      dateKeys.add(dateKey);
    }
  });

  profile.history.forEach((record) => {
    const dateKey = getDateKeyFromDailyHistoryRecord(record);

    if (dateKey && isDateKey(dateKey)) {
      dateKeys.add(dateKey);
    }
  });

  return [...dateKeys];
};

const getDailyPuzzleMilestones = (profile: PlayerProfile) => {
  const countsByMonth: Record<string, number> = {};
  const dateKeys = getDailyPuzzleDateKeys(profile);

  dateKeys.forEach((dateKey) => {
    const monthKey = getMonthKey(dateKey);
    countsByMonth[monthKey] = (countsByMonth[monthKey] ?? 0) + 1;
  });

  const bestMonthCount = Object.values(countsByMonth).reduce((best, count) => Math.max(best, count), 0);
  const hasPerfectMonth = Object.entries(countsByMonth).some(([monthKey, count]) => {
    const daysInMonth = getDaysInMonth(monthKey);
    return daysInMonth > 0 && count >= daysInMonth;
  });

  return {
    totalClears: dateKeys.length,
    bestMonthCount,
    hasPerfectMonth
  };
};

export const getUnlocks = (profile: PlayerProfile, latestMatch: MatchRecord | null) => {
  const unlocked = new Set<AchievementId>(profile.achievements);
  const dailyPuzzleMilestones = getDailyPuzzleMilestones(profile);

  if (profile.stats.wins >= 1) {
    unlocked.add("first-win");
  }

  if (profile.bestWinStreak >= 3) {
    unlocked.add("streak-3");
  }

  if (profile.bestWinStreak >= 5) {
    unlocked.add("streak-5");
  }

  if (profile.stats.category["vs-ai"].wins >= 5) {
    unlocked.add("ai-slayer");
  }

  if (profile.stats.category.online.wins >= 3) {
    unlocked.add("online-contender");
  }

  if (profile.dailyReward.streakDays >= 3) {
    unlocked.add("daily-dedication");
  }

  if (dailyPuzzleMilestones.totalClears >= 1) {
    unlocked.add("daily-starter");
  }

  if (dailyPuzzleMilestones.bestMonthCount >= 3) {
    unlocked.add("calendar-climber");
  }

  if (dailyPuzzleMilestones.bestMonthCount >= 10) {
    unlocked.add("calendar-collector");
  }

  if (dailyPuzzleMilestones.hasPerfectMonth) {
    unlocked.add("perfect-month");
  }

  if (latestMatch?.difficulty === "hard" && latestMatch.outcome === "win") {
    unlocked.add("hard-winner");
  }

  if (latestMatch?.outcome === "win" && latestMatch.attempts <= 4) {
    unlocked.add("quick-reader");
  }

  return [...unlocked];
};

export const applyTutorialSeen = (profile: PlayerProfile) => ({
  ...normalizeProfile(profile),
  tutorialSeen: true,
  updatedAt: new Date().toISOString()
});

export const applySoundPlaceholdersEnabled = (profile: PlayerProfile, enabled: boolean) => ({
  ...normalizeProfile(profile),
  soundPlaceholdersEnabled: enabled,
  updatedAt: new Date().toISOString()
});

export const applySinglePlayerHighRounds = (
  profile: PlayerProfile,
  partialHighRounds: Partial<PlayerStats["singlePlayerHighRounds"]>
) => {
  const currentProfile = normalizeProfile(profile);
  const nextHighRounds = {
    ...currentProfile.stats.singlePlayerHighRounds
  };

  (Object.keys(partialHighRounds) as Array<keyof PlayerStats["singlePlayerHighRounds"]>).forEach((difficulty) => {
    const nextValue = partialHighRounds[difficulty];

    if (typeof nextValue === "number") {
      nextHighRounds[difficulty] = Math.max(currentProfile.stats.singlePlayerHighRounds[difficulty], nextValue);
    }
  });

  return {
    ...currentProfile,
    stats: {
      ...currentProfile.stats,
      singlePlayerHighRounds: nextHighRounds
    },
    updatedAt: new Date().toISOString()
  };
};

export const applySinglePlayerHighScores = (
  profile: PlayerProfile,
  partialHighScores: Partial<PlayerStats["singlePlayerHighScores"]>
) => {
  const currentProfile = normalizeProfile(profile);
  const nextHighScores = {
    ...currentProfile.stats.singlePlayerHighScores
  };

  (Object.keys(partialHighScores) as Array<keyof PlayerStats["singlePlayerHighScores"]>).forEach((difficulty) => {
    const nextValue = partialHighScores[difficulty];

    if (typeof nextValue === "number") {
      nextHighScores[difficulty] = Math.max(currentProfile.stats.singlePlayerHighScores[difficulty], nextValue);
    }
  });

  return {
    ...currentProfile,
    stats: {
      ...currentProfile.stats,
      singlePlayerHighScores: nextHighScores
    },
    updatedAt: new Date().toISOString()
  };
};

export const applyExtraGuessPowerUps = (profile: PlayerProfile, delta: number) => {
  const currentProfile = normalizeProfile(profile);
  const nextExtraGuessPowerUps = Math.max(0, currentProfile.extraGuessPowerUps + Math.floor(delta));

  return {
    ...currentProfile,
    extraGuessPowerUps: nextExtraGuessPowerUps,
    updatedAt: new Date().toISOString()
  };
};

export const applyCoins = (profile: PlayerProfile, delta: number) => {
  const currentProfile = normalizeProfile(profile);
  const nextCoins = Math.max(0, currentProfile.coins + Math.floor(delta));

  return {
    ...currentProfile,
    coins: nextCoins,
    updatedAt: new Date().toISOString()
  };
};

export const applyActivePracticeRun = (
  profile: PlayerProfile,
  difficulty: Difficulty,
  snapshot: ActivePracticeRunSnapshot | null
) => {
  const currentProfile = normalizeProfile(profile);
  const nextActivePracticeRuns = {
    ...currentProfile.activePracticeRuns
  };

  if (!snapshot) {
    delete nextActivePracticeRuns[difficulty];
  } else {
    nextActivePracticeRuns[difficulty] = {
      ...snapshot,
      difficulty,
      updatedAt: new Date().toISOString()
    };
  }

  return {
    ...currentProfile,
    activePracticeRuns: nextActivePracticeRuns,
    updatedAt: new Date().toISOString()
  };
};

const shiftDateKeyByDays = (dateKey: string, delta: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return getTodayKey(new Date(year, month - 1, day + delta));
};

export const getDailyPuzzleCurrentStreak = (profile: PlayerProfile, endingDateKey: string) => {
  const currentProfile = normalizeProfile(profile);

  if (!currentProfile.dailyPuzzle.completedByDate[endingDateKey]) {
    return 0;
  }

  let streak = 0;
  let cursor = endingDateKey;

  while (currentProfile.dailyPuzzle.completedByDate[cursor]) {
    streak += 1;
    cursor = shiftDateKeyByDays(cursor, -1);
  }

  return streak;
};

export const getExtraGuessPowerUpRewardForDailyPuzzleStreak = (streak: number) => {
  if (streak === 3) {
    return 1;
  }

  if (streak === 7) {
    return 2;
  }

  if (streak === 30) {
    return 5;
  }

  return 0;
};

export const getCoinRewardForDailyPuzzleCompletion = () => 25;

export const claimProfileDailyReward = (profile: PlayerProfile, todayKey = getTodayKey()) => {
  const currentProfile = normalizeProfile(profile);

  if (currentProfile.dailyReward.lastClaimedOn === todayKey) {
    return {
      profile: currentProfile,
      claimed: false,
      reward: {
        points: 0,
        xp: 0,
        streakDays: currentProfile.dailyReward.streakDays
      }
    };
  }

  const lastClaimedOn = currentProfile.dailyReward.lastClaimedOn;
  const streakDays =
    lastClaimedOn && getDateDifferenceInDays(lastClaimedOn, todayKey) === 1
      ? currentProfile.dailyReward.streakDays + 1
      : 1;
  const reward = getDailyRewardValues(streakDays);
  const xp = currentProfile.xp + reward.xp;
  const nextProfile: PlayerProfile = {
    ...currentProfile,
    xp,
    level: getLevelFromXp(xp),
    totalPoints: currentProfile.totalPoints + reward.points,
    dailyReward: {
      lastClaimedOn: todayKey,
      streakDays
    },
    lastRewardSummary: {
      claimedOn: todayKey,
      points: reward.points,
      xp: reward.xp,
      streakDays
    },
    updatedAt: new Date().toISOString()
  };

  nextProfile.achievements = getUnlocks(nextProfile, nextProfile.lastMatchSummary);

  return {
    profile: nextProfile,
    claimed: true,
    reward: {
      points: reward.points,
      xp: reward.xp,
      streakDays
    }
  };
};

export const getDailyPuzzleCompletion = (profile: PlayerProfile, dateKey: string) =>
  normalizeProfile(profile).dailyPuzzle.completedByDate[dateKey] ?? null;

export const applyDailyPuzzleCompletion = (
  profile: PlayerProfile,
  dateKey: string,
  attempts: number,
  durationMs: number,
  recordId: string | null
): {
  profile: PlayerProfile;
  completion: DailyPuzzleCompletion;
  dailyPuzzleStreak: number;
  extraGuessPowerUpReward: number;
  coinReward: number;
} => {
  const currentProfile = normalizeProfile(profile);
  const existingCompletion = currentProfile.dailyPuzzle.completedByDate[dateKey];

  if (existingCompletion) {
    return {
      profile: currentProfile,
      completion: existingCompletion,
      dailyPuzzleStreak: getDailyPuzzleCurrentStreak(currentProfile, dateKey),
      extraGuessPowerUpReward: 0,
      coinReward: 0
    };
  }

  const completion: DailyPuzzleCompletion = {
    attempts,
    durationMs,
    completedAt: new Date().toISOString(),
    recordId
  };

  const profileWithCompletion: PlayerProfile = {
    ...currentProfile,
    dailyPuzzle: {
      ...currentProfile.dailyPuzzle,
      completedByDate: {
        ...currentProfile.dailyPuzzle.completedByDate,
        [dateKey]: completion
      }
    },
    updatedAt: new Date().toISOString()
  };
  const dailyPuzzleStreak = getDailyPuzzleCurrentStreak(profileWithCompletion, dateKey);
  const extraGuessPowerUpReward = getExtraGuessPowerUpRewardForDailyPuzzleStreak(dailyPuzzleStreak);
  const coinReward = getCoinRewardForDailyPuzzleCompletion();
  const profileWithPowerUps =
    extraGuessPowerUpReward > 0
      ? applyExtraGuessPowerUps(profileWithCompletion, extraGuessPowerUpReward)
      : profileWithCompletion;
  const profileWithCoins = coinReward > 0 ? applyCoins(profileWithPowerUps, coinReward) : profileWithPowerUps;

  return {
    profile: {
      ...profileWithCoins,
      achievements: getUnlocks(profileWithCoins, currentProfile.lastMatchSummary),
      updatedAt: new Date().toISOString()
    },
    completion,
    dailyPuzzleStreak,
    extraGuessPowerUpReward,
    coinReward
  };
};

export const applyRecordedMatch = (profile: PlayerProfile, input: MatchInput) => {
  const currentProfile = normalizeProfile(profile);
  const streakBase =
    input.category === "single-player"
      ? currentProfile.currentWinStreak
      : input.outcome === "win"
        ? currentProfile.currentWinStreak + 1
        : 0;
  const score = calculateMatchScore(input, currentProfile.currentWinStreak);
  const xp = currentProfile.xp + score.xpEarned;
  const updatedStreak =
    input.category === "single-player"
      ? currentProfile.currentWinStreak
      : input.outcome === "win"
        ? currentProfile.currentWinStreak + 1
        : 0;
  const stats = {
    ...currentProfile.stats,
    wins: currentProfile.stats.wins + (input.outcome === "win" ? 1 : 0),
    losses: currentProfile.stats.losses + (input.outcome === "loss" ? 1 : 0),
    ties: currentProfile.stats.ties + (input.outcome === "tie" ? 1 : 0),
    matches: currentProfile.stats.matches + 1,
    totalAttempts: currentProfile.stats.totalAttempts + input.attempts,
    totalDurationMs: currentProfile.stats.totalDurationMs + input.durationMs,
    practiceMatches:
      currentProfile.stats.practiceMatches + (input.category === "single-player" ? 1 : 0),
    category: {
      ...currentProfile.stats.category,
      [input.category]: {
        ...currentProfile.stats.category[input.category],
        wins: currentProfile.stats.category[input.category].wins + (input.outcome === "win" ? 1 : 0),
        losses:
          currentProfile.stats.category[input.category].losses + (input.outcome === "loss" ? 1 : 0),
        ties: currentProfile.stats.category[input.category].ties + (input.outcome === "tie" ? 1 : 0),
        matches: currentProfile.stats.category[input.category].matches + 1,
        points: currentProfile.stats.category[input.category].points + score.points
      }
    },
    difficultyWins: {
      ...currentProfile.stats.difficultyWins,
      [input.difficulty]:
        currentProfile.stats.difficultyWins[input.difficulty] + (input.outcome === "win" ? 1 : 0)
    }
  };

  const record: MatchRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    points: score.points,
    xpEarned: score.xpEarned,
    scoreBreakdown: score.scoreBreakdown,
    playedAt: new Date().toISOString(),
    streakAfter: updatedStreak,
    levelAfter: getLevelFromXp(xp)
  };

  const nextProfile: PlayerProfile = {
    ...currentProfile,
    xp,
    level: record.levelAfter,
    totalPoints: currentProfile.totalPoints + score.points,
    currentWinStreak: updatedStreak,
    bestWinStreak: Math.max(currentProfile.bestWinStreak, updatedStreak, streakBase),
    stats,
    history: [record, ...currentProfile.history].slice(0, MAX_HISTORY_ITEMS),
    lastMatchSummary: record,
    updatedAt: new Date().toISOString()
  };

  nextProfile.achievements = getUnlocks(nextProfile, record);

  return {
    profile: nextProfile,
    record
  };
};

export const getPlayerOnlineScore = (profile: PlayerProfile) =>
  profile.stats.category.online.points + profile.stats.category.online.wins * 45;

export const buildOnlineLeaderboard = (profile: PlayerProfile): LeaderboardEntry[] => {
  const playerOnlinePoints = getPlayerOnlineScore(profile);
  const hasOnlineActivity =
    profile.stats.category.online.matches > 0 ||
    playerOnlinePoints > 0 ||
    profile.stats.category.online.wins > 0;

  if (!hasOnlineActivity) {
    return [];
  }

  const playerScore = playerOnlinePoints + profile.bestWinStreak * 8 + profile.level * 16;

  return [
    {
      id: "you",
      name: "You",
      points: playerScore,
      streak: profile.currentWinStreak,
      level: profile.level,
      isPlayer: true,
      rank: 1
    }
  ];
};

export const getAchievementMeta = (achievementId: AchievementId) =>
  achievements.find((achievement) => achievement.id === achievementId) ?? null;
