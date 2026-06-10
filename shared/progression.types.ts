import type { Difficulty, GuessFeedback } from "./game.types";

export type MatchCategory = "single-player" | "vs-ai" | "online";
export type MatchMode = "practice" | "classic" | "duel" | "daily";
export type MatchOutcome = "win" | "loss" | "tie";
export const AVATAR_IDS = [
  "scholar",
  "rocket",
  "flash",
  "planet",
  "music",
  "gamepad",
  "paw",
  "book",
  "flame",
  "cafe",
  "tennis",
  "bulb",
  "astronaut",
  "ninja",
  "scientist",
  "knight",
  "chef",
  "dragon",
  "alien",
  "superhero",
  "detective",
  "dinosaur",
  "unicorn",
  "panda",
  "skater"
] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];
export type AchievementId =
  | "first-win"
  | "streak-3"
  | "streak-5"
  | "hard-winner"
  | "quick-reader"
  | "ai-slayer"
  | "online-contender"
  | "daily-dedication"
  | "daily-starter"
  | "calendar-climber"
  | "calendar-collector"
  | "perfect-month";

export interface ScoreBreakdown {
  base: number;
  attempts: number;
  time: number;
  difficulty: number;
  streak: number;
  total: number;
}

export interface MatchRecord {
  id: string;
  category: MatchCategory;
  mode: MatchMode;
  difficulty: Difficulty;
  outcome: MatchOutcome;
  attempts: number;
  durationMs: number;
  points: number;
  xpEarned: number;
  scoreBreakdown: ScoreBreakdown;
  opponentName: string;
  opponentPersona?: string;
  playedAt: string;
  streakAfter: number;
  levelAfter: number;
}

export interface MatchInput {
  category: MatchCategory;
  mode: MatchMode;
  difficulty: Difficulty;
  outcome: MatchOutcome;
  attempts: number;
  durationMs: number;
  opponentName: string;
  opponentPersona?: string;
}

export interface CategoryStats {
  wins: number;
  losses: number;
  ties: number;
  matches: number;
  points: number;
}

export type SinglePlayerHighRounds = Record<Difficulty, number>;
export type SinglePlayerHighScores = Record<Difficulty, number>;

export interface PlayerStats {
  wins: number;
  losses: number;
  ties: number;
  matches: number;
  totalAttempts: number;
  totalDurationMs: number;
  practiceMatches: number;
  category: Record<MatchCategory, CategoryStats>;
  difficultyWins: Record<Difficulty, number>;
  singlePlayerHighRounds: SinglePlayerHighRounds;
  singlePlayerHighScores: SinglePlayerHighScores;
}

export interface DailyRewardState {
  lastClaimedOn: string | null;
  streakDays: number;
}

export interface LastRewardSummary {
  claimedOn: string;
  points: number;
  xp: number;
  streakDays: number;
}

export interface DailyPuzzleCompletion {
  attempts: number;
  durationMs: number;
  completedAt: string;
  recordId: string | null;
}

export interface DailyPuzzleState {
  completedByDate: Record<string, DailyPuzzleCompletion>;
}

export interface PracticeGuessSnapshot {
  guess: number;
  result: GuessFeedback;
}

export interface ActivePracticeRunSnapshot {
  difficulty: Difficulty;
  secretNumber: number;
  guessHistory: PracticeGuessSnapshot[];
  roundNumber: number;
  remainingChances: number;
  currentScore: number;
  lastScoreGain: number;
  runState: "playing" | "round-cleared";
  reviveUsedThisRun: boolean;
  roundElapsedMs: number;
  updatedAt: string;
}

export interface PlayerProfile {
  xp: number;
  level: number;
  totalPoints: number;
  currentWinStreak: number;
  bestWinStreak: number;
  extraGuessPowerUps: number;
  skipBoosters: number;
  coins: number;
  avatarId: AvatarId;
  achievements: AchievementId[];
  history: MatchRecord[];
  stats: PlayerStats;
  tutorialSeen: boolean;
  soundPlaceholdersEnabled: boolean;
  dailyReward: DailyRewardState;
  dailyPuzzle: DailyPuzzleState;
  activePracticeRuns: Partial<Record<Difficulty, ActivePracticeRunSnapshot>>;
  lastRewardSummary: LastRewardSummary | null;
  lastMatchSummary: MatchRecord | null;
  updatedAt: string;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  points: number;
  streak: number;
  level: number;
  isPlayer?: boolean;
}

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
}

export interface ProgressBootstrapPayload {
  playerKey: string;
  displayName?: string;
  localProfile?: PlayerProfile | null;
}

export interface ProgressPreferencesPayload {
  playerKey: string;
  tutorialSeen?: boolean;
  soundPlaceholdersEnabled?: boolean;
  singlePlayerHighRounds?: Partial<SinglePlayerHighRounds>;
  singlePlayerHighScores?: Partial<SinglePlayerHighScores>;
  extraGuessPowerUpsDelta?: number;
  skipBoostersDelta?: number;
  coinsDelta?: number;
  avatarId?: AvatarId;
  activePracticeRun?: {
    difficulty: Difficulty;
    snapshot: ActivePracticeRunSnapshot | null;
  };
}

export interface UpdateDisplayNamePayload {
  playerKey: string;
  displayName: string;
}

export interface ClaimDailyRewardPayload {
  playerKey: string;
}

export interface RecordMatchPayload {
  playerKey: string;
  input: MatchInput;
}

export interface DailyPuzzleStatusPayload {
  playerKey: string;
  dateKey?: string;
}

export interface DailyPuzzleGuessPayload {
  playerKey: string;
  dateKey: string;
  guess: number;
  attempts: number;
  durationMs: number;
}

export interface ProgressSyncResponse {
  playerKey: string;
  displayName: string;
  profile: PlayerProfile;
  leaderboard: LeaderboardEntry[];
  persistence: "remote";
}

export interface ClaimDailyRewardResponse extends ProgressSyncResponse {
  claimed: boolean;
  reward: {
    points: number;
    xp: number;
    streakDays: number;
  };
}

export interface RecordMatchResponse extends ProgressSyncResponse {
  record: MatchRecord;
}

export interface UpdateDisplayNameResponse extends ProgressSyncResponse {}

export interface DailyPuzzleStatusResponse extends ProgressSyncResponse {
  todayKey: string;
  maxNumber: number;
  todayCompletion: DailyPuzzleCompletion | null;
}

export interface DailyPuzzleGuessResponse extends ProgressSyncResponse {
  todayKey: string;
  maxNumber: number;
  feedback: GuessFeedback | "already-solved";
  solved: boolean;
  completion: DailyPuzzleCompletion | null;
  record: MatchRecord | null;
  dailyPuzzleReward?: {
    streakDays: number;
    extraGuessPowerUps: number;
    coins: number;
  };
}
