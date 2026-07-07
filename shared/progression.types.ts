import type { Difficulty, GuessFeedback } from "./game.types";
import type { SinglePlayerModifierSnapshot } from "./singlePlayerModifiers";

export type MatchCategory = "single-player" | "vs-ai" | "online";
export type MatchMode = "practice" | "classic" | "duel" | "daily";
export type MatchOutcome = "win" | "loss" | "tie";
export const DEFAULT_AVATAR_IDS = [
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
export const PREMIUM_AVATAR_IDS = [
  "crystal-crown",
  "cyber-samurai",
  "neon-oracle",
  "cosmic-royal",
  "solar-monarch",
  "emerald-hacker",
  "ruby-rogue",
  "sapphire-pilot",
  "golden-tactician",
  "frost-archer",
  "plasma-queen",
  "storm-captain",
  "obsidian-mage",
  "aurora-knight",
  "turbo-racer",
  "lunar-guardian",
  "royal-dj",
  "chrome-detective",
  "velvet-alchemist",
  "jade-dragon-rider",
  "star-chef",
  "phoenix-striker",
  "prism-scholar",
  "cyber-boxer",
  "galaxy-botanist"
] as const;
export const PREMIUM_AVATAR_PRICES = {
  "crystal-crown": 50,
  "cyber-samurai": 75,
  "neon-oracle": 100,
  "cosmic-royal": 125,
  "solar-monarch": 150,
  "emerald-hacker": 200,
  "ruby-rogue": 300,
  "sapphire-pilot": 500,
  "golden-tactician": 750,
  "frost-archer": 1000,
  "plasma-queen": 1250,
  "storm-captain": 1500,
  "obsidian-mage": 1750,
  "aurora-knight": 2000,
  "turbo-racer": 2500,
  "lunar-guardian": 3000,
  "royal-dj": 3500,
  "chrome-detective": 4000,
  "velvet-alchemist": 5000,
  "jade-dragon-rider": 7500,
  "star-chef": 10000,
  "phoenix-striker": 10000,
  "prism-scholar": 10000,
  "cyber-boxer": 10000,
  "galaxy-botanist": 10000
} as const satisfies Record<(typeof PREMIUM_AVATAR_IDS)[number], number>;
export const PREMIUM_AVATAR_REQUIRED_LEVELS = {
  "crystal-crown": 1,
  "cyber-samurai": 2,
  "neon-oracle": 3,
  "cosmic-royal": 4,
  "solar-monarch": 5,
  "emerald-hacker": 6,
  "ruby-rogue": 7,
  "sapphire-pilot": 8,
  "golden-tactician": 9,
  "frost-archer": 10,
  "plasma-queen": 11,
  "storm-captain": 12,
  "obsidian-mage": 13,
  "aurora-knight": 14,
  "turbo-racer": 15,
  "lunar-guardian": 16,
  "royal-dj": 17,
  "chrome-detective": 18,
  "velvet-alchemist": 19,
  "jade-dragon-rider": 20,
  "star-chef": 21,
  "phoenix-striker": 22,
  "prism-scholar": 23,
  "cyber-boxer": 24,
  "galaxy-botanist": 25
} as const satisfies Record<(typeof PREMIUM_AVATAR_IDS)[number], number>;
export const AVATAR_IDS = [...DEFAULT_AVATAR_IDS, ...PREMIUM_AVATAR_IDS] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];
export type PremiumAvatarId = (typeof PREMIUM_AVATAR_IDS)[number];
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
  chanceCost?: number;
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
  modifier?: SinglePlayerModifierSnapshot;
  runState: "playing" | "round-cleared";
  adReviveCount?: number;
  reviveCount?: number;
  reviveUsedThisRun: boolean;
  roundElapsedMs: number;
  updatedAt: string;
}

export interface PlayerProfile {
  deviceSecretHash?: string;
  xp: number;
  level: number;
  totalPoints: number;
  currentWinStreak: number;
  bestWinStreak: number;
  extraGuessPowerUps: number;
  skipBoosters: number;
  coins: number;
  avatarId: AvatarId;
  premiumAvatarIds: PremiumAvatarId[];
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
  avatarId?: AvatarId;
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
  deviceSecret?: string;
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
  premiumAvatarId?: AvatarId;
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
  rewardedSkip?: boolean;
}

export interface DailyPuzzleLeaderboardPayload {
  playerKey: string;
  dateKey?: string;
}

export interface ProgressSyncResponse {
  playerKey: string;
  displayName: string;
  profile: PlayerProfile;
  leaderboard: LeaderboardEntry[];
  persistence: "remote";
  sessionToken?: string;
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

export interface DailyPuzzleLeaderboardEntry {
  playerKey: string;
  rank: number;
  name: string;
  avatarId: AvatarId;
  attempts: number;
  durationMs: number;
  completedAt: string;
  rewardEligible: boolean;
  rewardCoins: number;
  rewardCoinsAwarded: number;
  isPlayer?: boolean;
}

export interface DailyPuzzleLeaderboardResponse extends ProgressSyncResponse {
  dateKey: string;
  isFinalized: boolean;
  rewardConfig: Record<number, number>;
  topEntries: DailyPuzzleLeaderboardEntry[];
  playerEntry: DailyPuzzleLeaderboardEntry | null;
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
