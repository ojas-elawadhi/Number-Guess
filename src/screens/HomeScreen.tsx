import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions, type ImageSourcePropType } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Polygon, Stop, Text as SvgText } from "react-native-svg";

import { AppHeader, HeaderBackButton, HeaderCoinsPill, HeaderRewardAdButton } from "../components/AppHeader";
import { CoinIcon } from "../components/CoinIcon";
import { BottomTabs, ModeTile, StatusPill } from "../components/GameKit";
import { HomeTutorialCallouts } from "../components/HomeTutorialCallouts";
import { PrimaryButton } from "../components/PrimaryButton";
import { RankMedal } from "../components/RankMedal";
import { ScreenContainer } from "../components/ScreenContainer";
import { NoAdsPurchasePrompt, ShopTab, ShopTabHeader } from "../components/ShopTab";
import {
  defaultProfileAvatarOptions,
  premiumProfileAvatarOptions,
  profileAvatarImageUrls,
  profileAvatarOptions
} from "../config/avatarCatalog";
import { useHardwareBackHandler } from "../hooks/useHardwareBackHandler";
import { getBillingCustomerSnapshot, restoreBillingPurchases } from "../services/billing";
import { isRewardedReviveSupported, showRewardedReviveAd } from "../services/rewardedReviveAd";
import { playSound, playSoundAlways } from "../services/soundEffects";
import { useMonetizationStore } from "../store/useMonetizationStore";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import { useTutorialStore } from "../store/useTutorialStore";
import type { AvatarId } from "../types/progression.types";
import {
  DEFAULT_AVATAR_ID,
  LEVEL_UP_COIN_REWARD,
  LEVEL_UP_EXTRA_GUESS_POWER_UP_REWARD,
  formatDuration,
  getDailyRewardValues,
  getPlayerBestScore,
  getTodayKey
} from "../utils/progression";
import { colors, radii, shadows, spacing } from "../utils/theme";

type HomeTab = "play" | "stats" | "shop" | "profile" | "settings";
type ProfileSection = "stats" | "profile";
type ProfileAvatarTab = "default" | "premium";
type StatsModeFilter = "single-player" | "vs-ai" | "online" | "daily";
type StatsDifficultyFilter = "easy" | "hard" | "impossible";
type StatsDistributionModeKey = "single-player" | "vs-ai" | "online";
type PremiumProfileAvatarOption = (typeof premiumProfileAvatarOptions)[number];

const billingEnabled = process.env.EXPO_PUBLIC_ENABLE_BILLING === "true";
const HEADER_REWARDED_COIN_AMOUNT = 50;

const isHomeTab = (value: string | undefined): value is HomeTab =>
  value === "play" || value === "stats" || value === "shop" || value === "profile" || value === "settings";

const appDisplayName = "Number Guess: Higher Lower";

const titleLetterRows = [
  [
    { accent: "#f28f67", letter: "N" },
    { accent: "#5db5f5", letter: "U" },
    { accent: "#9dc95b", letter: "M" },
    { accent: "#f7b33d", letter: "B" },
    { accent: "#d979bc", letter: "E" },
    { accent: "#ee6b62", letter: "R" }
  ],
  [
    { accent: "#7cc8ff", letter: "G" },
    { accent: "#a98ee8", letter: "U" },
    { accent: "#5cc78f", letter: "E" },
    { accent: "#f28f67", letter: "S" },
    { accent: "#5db5f5", letter: "S" }
  ]
] as const;

const PROFILE_RING_SIZE = 44;
const PROFILE_RING_STROKE = 4;
const PROFILE_RING_RADIUS = (PROFILE_RING_SIZE - PROFILE_RING_STROKE) / 2;
const PROFILE_RING_CIRCUMFERENCE = 2 * Math.PI * PROFILE_RING_RADIUS;
const DAY_MS = 86_400_000;
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const noAdsButtonImage = require("../../assets/ui/no-ads-button.png") as ImageSourcePropType;
const profileAvatarById = new Map(profileAvatarOptions.map((option) => [option.id, option]));

const difficultyChartConfig = [
  { key: "easy", label: "Easy", accent: colors.practice },
  { key: "hard", label: "Hard", accent: colors.warning },
  { key: "impossible", label: "Impossible", accent: colors.online }
] as const;

const modeChartConfig = [
  { key: "single-player", label: "Single Player", accent: colors.practice },
  { key: "vs-ai", label: "VS AI", accent: colors.ai },
  { key: "online", label: "Online", accent: colors.online }
] as const;

const statsModeFilters = [
  { accent: colors.practice, key: "single-player", label: "Single" },
  { accent: colors.ai, key: "vs-ai", label: "AI" },
  { accent: colors.online, key: "online", label: "Online" },
  { accent: colors.warning, key: "daily", label: "Daily" }
] as const;

const statsDifficultyFilters = [
  { accent: colors.practice, guessLimit: 8, key: "easy", label: "Easy" },
  { accent: colors.warning, guessLimit: 10, key: "hard", label: "Hard" },
  { accent: colors.online, guessLimit: 12, key: "impossible", label: "Impossible" }
] as const;

const climbLeagueConfig = [
  { accent: "#7d8b7e", floor: 0, icon: "trail-sign" as const, name: "Rookie" },
  { accent: "#c7793c", floor: 250, icon: "medal" as const, name: "Bronze" },
  { accent: "#7b93a6", floor: 1000, icon: "shield" as const, name: "Silver" },
  { accent: colors.warning, floor: 3000, icon: "trophy" as const, name: "Gold" },
  { accent: colors.online, floor: 7500, icon: "diamond" as const, name: "Elite" },
  { accent: colors.danger, floor: 15000, icon: "flame" as const, name: "Legend" },
  { accent: colors.accent, floor: 30000, icon: "sparkles" as const, name: "Mythic" }
] as const;

function OnlineVsBadge() {
  return (
    <View style={styles.onlineVsBadge}>
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.onlineVsBadgeText}>
        VS!
      </Text>
    </View>
  );
}

function HomePlayBackdrop() {
  return (
    <View pointerEvents="none" style={styles.homePlayBackdrop}>
      <Ionicons color="#d9dede" name="game-controller-outline" size={44} style={styles.homeBackdropGamepad} />
      <Ionicons color="#dfe3e3" name="trophy-outline" size={34} style={styles.homeBackdropTrophy} />
      <Ionicons color="#d9dede" name="flash-outline" size={31} style={styles.homeBackdropFlash} />
      <Ionicons color="#dfe3e3" name="star-outline" size={36} style={styles.homeBackdropStar} />
      <Ionicons color="#d9dede" name="code-slash-outline" size={38} style={styles.homeBackdropCode} />
      <Ionicons color="#dfe3e3" name="bulb-outline" size={30} style={styles.homeBackdropBulb} />
      <Ionicons color="#d9dede" name="help-circle-outline" size={42} style={styles.homeBackdropQuestion} />
      <Ionicons color="#dfe3e3" name="calculator-outline" size={34} style={styles.homeBackdropCalculator} />
      <Ionicons color="#d9dede" name="locate-outline" size={38} style={styles.homeBackdropTarget} />
      <View style={styles.homeBackdropHighLow}>
        <Ionicons color="#d9dede" name="arrow-up" size={22} />
        <Text style={styles.homeBackdropHighLowText}>?</Text>
        <Ionicons color="#d9dede" name="arrow-down" size={22} />
      </View>
      <View style={[styles.homeBackdropNumberChip, styles.homeBackdropNumberChipOne]}>
        <Text style={styles.homeBackdropNumberText}>42</Text>
      </View>
      <View style={[styles.homeBackdropNumberChip, styles.homeBackdropNumberChipTwo]}>
        <Text style={styles.homeBackdropNumberText}>7</Text>
      </View>
      <View style={[styles.homeBackdropNumberChip, styles.homeBackdropNumberChipThree]}>
        <Text style={styles.homeBackdropNumberText}>99</Text>
      </View>
      <Text style={[styles.homeBackdropCompare, styles.homeBackdropCompareHigh]}>&gt;</Text>
      <Text style={[styles.homeBackdropCompare, styles.homeBackdropCompareLow]}>&lt;</Text>
      <Text style={styles.homeBackdropRange}>1 - 100</Text>
      <View style={[styles.homeBackdropRing, styles.homeBackdropRingTop]} />
      <View style={[styles.homeBackdropRing, styles.homeBackdropRingBottom]} />
      <View style={[styles.homeBackdropDiamond, styles.homeBackdropDiamondLeft]} />
      <View style={[styles.homeBackdropDiamond, styles.homeBackdropDiamondRight]} />
      <View style={[styles.homeBackdropDot, styles.homeBackdropDotTop]} />
      <View style={[styles.homeBackdropDot, styles.homeBackdropDotMiddle]} />
      <View style={[styles.homeBackdropDot, styles.homeBackdropDotBottom]} />
      <View style={[styles.homeBackdropCross, styles.homeBackdropCrossLeft]}>
        <View style={styles.homeBackdropCrossVertical} />
        <View style={styles.homeBackdropCrossHorizontal} />
      </View>
      <View style={[styles.homeBackdropCross, styles.homeBackdropCrossRight]}>
        <View style={styles.homeBackdropCrossVertical} />
        <View style={styles.homeBackdropCrossHorizontal} />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const displayName = usePlayerProgressStore((state) => state.displayName);
  const profile = usePlayerProgressStore((state) => state.profile);
  const leaderboard = usePlayerProgressStore((state) => state.leaderboard);
  const playerKey = usePlayerProgressStore((state) => state.playerKey);
  const singlePlayerHighScores = usePlayerProgressStore((state) => state.profile.stats.singlePlayerHighScores);
  const awardCoins = usePlayerProgressStore((state) => state.awardCoins);
  const claimDailyReward = usePlayerProgressStore((state) => state.claimDailyReward);
  const toggleSoundPlaceholders = usePlayerProgressStore((state) => state.toggleSoundPlaceholders);
  const updateDisplayName = usePlayerProgressStore((state) => state.updateDisplayName);
  const updateAvatarId = usePlayerProgressStore((state) => state.updateAvatarId);
  const purchasePremiumAvatar = usePlayerProgressStore((state) => state.purchasePremiumAvatar);
  const hasNoAdsEntitlement = useMonetizationStore((state) => state.hasNoAdsEntitlement);
  const setHasNoAdsEntitlement = useMonetizationStore((state) => state.setHasNoAdsEntitlement);
  const [activeTab, setActiveTab] = useState<HomeTab>("play");
  const [profileSection, setProfileSection] = useState<ProfileSection>("profile");
  const [avatarPickerTab, setAvatarPickerTab] = useState<ProfileAvatarTab>("default");
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [isClaimingHeaderAdReward, setIsClaimingHeaderAdReward] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [savingAvatarId, setSavingAvatarId] = useState<AvatarId | null>(null);
  const [premiumAvatarPurchaseDraft, setPremiumAvatarPurchaseDraft] = useState<PremiumProfileAvatarOption | null>(null);
  const [usernameDraft, setUsernameDraft] = useState(displayName);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [showNoAdsPurchase, setShowNoAdsPurchase] = useState(false);
  const [showFullStats, setShowFullStats] = useState(false);
  const [statsDistributionDifficulties, setStatsDistributionDifficulties] = useState<Record<StatsDistributionModeKey, StatsDifficultyFilter>>({
    online: "easy",
    "single-player": "easy",
    "vs-ai": "easy"
  });
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      duration: 280,
      toValue: 1,
      useNativeDriver: true
    }).start();
  }, [fadeIn]);

  useEffect(() => {
    setUsernameDraft(displayName);
  }, [displayName]);

  useEffect(() => {
    if (pathname === "/profile" || pathname === "/stats") {
      setActiveTab("profile");
      setProfileSection(pathname === "/stats" ? "stats" : "profile");
      return;
    }

    const nextTab = typeof params.tab === "string" && isHomeTab(params.tab) && params.tab !== "profile"
      ? params.tab
      : "play";

    setActiveTab(nextTab);
    setProfileSection("profile");
  }, [params.tab, pathname]);

  const today = new Date();
  const todayKey = getTodayKey(today);
  const lastClaimedToday =
    profile.dailyReward.lastClaimedOn !== null &&
    profile.dailyReward.lastClaimedOn === todayKey;
  const latestMatch = profile.history[0] ?? null;
  const currentLevelFloorXp = 140 * (Math.max(1, profile.level) - 1) ** 2;
  const nextLevelFloorXp = 140 * Math.max(1, profile.level) ** 2;
  const levelXpSpan = Math.max(1, nextLevelFloorXp - currentLevelFloorXp);
  const levelProgress = Math.min(1, Math.max(0, (profile.xp - currentLevelFloorXp) / levelXpSpan));
  const levelProgressOffset = PROFILE_RING_CIRCUMFERENCE * (1 - levelProgress);
  const levelXpEarned = Math.max(0, profile.xp - currentLevelFloorXp);
  const singlePlayerBestScore = Math.max(
    singlePlayerHighScores.easy,
    singlePlayerHighScores.hard,
    singlePlayerHighScores.impossible
  );
  const dailyMonth = today.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dailyDay = today.getDate();
  const totalMatches = profile.stats.matches;
  const overallWinRate = totalMatches > 0 ? Math.round((profile.stats.wins / totalMatches) * 100) : 0;
  const aiWins = profile.stats.category["vs-ai"].wins;
  const streakProgressTarget = Math.max(3, profile.bestWinStreak, profile.currentWinStreak);
  const streakProgressPercent = Math.max(
    profile.currentWinStreak > 0 ? 10 : 0,
    Math.min(100, Math.round((profile.currentWinStreak / streakProgressTarget) * 100))
  );
  const streakCaption = profile.currentWinStreak <= 0
    ? "Your next win starts a streak"
    : profile.currentWinStreak >= profile.bestWinStreak && profile.bestWinStreak > 0
      ? "You are matching your best run"
      : `${Math.max(0, profile.bestWinStreak - profile.currentWinStreak)} away from your best`;
  const bestScoreCeiling = Math.max(
    1,
    profile.stats.singlePlayerHighScores.easy,
    profile.stats.singlePlayerHighScores.hard,
    profile.stats.singlePlayerHighScores.impossible
  );
  const modePerformance = modeChartConfig.map((mode) => {
    const stats = profile.stats.category[mode.key];
    const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;

    return {
      ...mode,
      matches: stats.matches,
      points: stats.points,
      winRate
    };
  });
  const profileLeaderboardScore = getPlayerBestScore(profile);
  const getDistributionSnapshot = (
    matches: typeof profile.history,
    guessLimit: number,
    includeOverflow = false
  ) => {
    const getGuessLabel = (bucket: number) => {
      const suffix = bucket % 100 >= 11 && bucket % 100 <= 13
        ? "th"
        : bucket % 10 === 1
          ? "st"
          : bucket % 10 === 2
            ? "nd"
            : bucket % 10 === 3
              ? "rd"
              : "th";

      return `${bucket}${suffix}`;
    };
    const wins = matches.filter((match) => match.outcome === "win");
    const baseBuckets = Array.from({ length: guessLimit }, (_, index) => index + 1);
    const baseCounts = baseBuckets.map((bucket) => wins.filter((match) => match.attempts === bucket).length);
    const overflowCount = includeOverflow ? wins.filter((match) => match.attempts > guessLimit).length : 0;
    const counts = includeOverflow ? [...baseCounts, overflowCount] : baseCounts;
    const maxCount = Math.max(1, ...counts);
    const avgGuesses = wins.length > 0
      ? wins.reduce((sum, match) => sum + match.attempts, 0) / wins.length
      : 0;

    return {
      avgGuesses,
      buckets: [
        ...baseBuckets.map((bucket, index) => ({
          count: baseCounts[index],
          label: getGuessLabel(bucket),
          width: baseCounts[index] > 0 ? Math.max(12, Math.round((baseCounts[index] / maxCount) * 100)) : 0
        })),
        ...(includeOverflow
          ? [{
            count: overflowCount,
            label: `${getGuessLabel(guessLimit)}+`,
            width: overflowCount > 0 ? Math.max(12, Math.round((overflowCount / maxCount) * 100)) : 0
          }]
          : [])
      ],
      matches: matches.length,
      wins: wins.length
    };
  };
  const getDifficultyConfig = (difficulty: StatsDifficultyFilter) =>
    statsDifficultyFilters.find((option) => option.key === difficulty) ?? statsDifficultyFilters[0];
  const distributionCards = [
    {
      accent: colors.practice,
      difficulty: statsDistributionDifficulties["single-player"],
      key: "single-player" as const,
      matches: profile.history.filter((match) => match.category === "single-player" && match.mode !== "daily"),
      subtitle: "Solo runs",
      title: "Single Player"
    },
    {
      accent: colors.ai,
      difficulty: statsDistributionDifficulties["vs-ai"],
      key: "vs-ai" as const,
      matches: profile.history.filter((match) => match.category === "vs-ai"),
      subtitle: "Classic + Duel",
      title: "AI"
    },
    {
      accent: colors.online,
      difficulty: statsDistributionDifficulties.online,
      key: "online" as const,
      matches: profile.history.filter((match) => match.category === "online"),
      subtitle: "Online matches",
      title: "Online"
    }
  ].map((card) => {
    const difficulty = getDifficultyConfig(card.difficulty);
    const matches = card.matches.filter((match) => match.difficulty === difficulty.key);
    const bestScore = matches.reduce((best, match) => Math.max(best, match.points), 0);

    return {
      ...card,
      bestScore,
      difficulty,
      distribution: getDistributionSnapshot(matches, difficulty.guessLimit)
    };
  });
  const profileStatsSummary = [
    { accent: colors.warning, label: "Best Score", value: profileLeaderboardScore.toLocaleString("en-US") },
    { accent: colors.online, label: "Current Score", value: (profile.lastMatchSummary?.points ?? latestMatch?.points ?? 0).toLocaleString("en-US") },
    { accent: colors.practice, label: "Total Guesses", value: profile.stats.totalAttempts.toLocaleString("en-US") },
    { accent: colors.accent, label: "Win %", value: `${overallWinRate}%` },
    {
      accent: colors.ai,
      label: "Avg Guess",
      value: profile.stats.matches > 0
        ? (profile.stats.totalAttempts / profile.stats.matches).toFixed(1)
        : "0"
    }
  ];
  const modeMatchesCeiling = Math.max(1, ...modePerformance.map((mode) => mode.matches));
  const recentMatches = profile.history.slice(0, 5);
  const leaderboardWithComputedPlayer = leaderboard.map((entry) =>
    entry.isPlayer
      ? {
        ...entry,
        avatarId: profile.avatarId,
        name: displayName,
        points: profileLeaderboardScore
      }
      : entry
  );
  const leaderboardSeed =
    leaderboardWithComputedPlayer.some((entry) => entry.isPlayer) || profileLeaderboardScore <= 0
      ? leaderboardWithComputedPlayer
      : [
        ...leaderboardWithComputedPlayer,
        {
          avatarId: profile.avatarId,
          id: playerKey ?? "you",
          isPlayer: true,
          level: profile.level,
          name: displayName,
          points: profileLeaderboardScore,
          rank: 0,
          streak: profile.bestWinStreak
        }
      ];
  const leaderboardByRank = leaderboardSeed
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
  const playerLeaderboardEntry = leaderboardByRank.find((entry) => entry.isPlayer) ?? null;
  const playerRank = playerLeaderboardEntry?.rank ?? null;
  const leaderboardTopRows = leaderboardByRank.slice(0, 5);
  const leaderboardRows =
    playerLeaderboardEntry && !leaderboardTopRows.some((entry) => entry.id === playerLeaderboardEntry.id)
      ? [...leaderboardTopRows, playerLeaderboardEntry]
      : leaderboardTopRows;
  const nextRankEntry = playerLeaderboardEntry
    ? [...leaderboardByRank]
      .filter((entry) => !entry.isPlayer && entry.rank < playerLeaderboardEntry.rank)
      .sort((left, right) => right.rank - left.rank)[0] ?? null
    : null;
  const closestChaserEntry = playerLeaderboardEntry
    ? [...leaderboardByRank]
      .filter((entry) => !entry.isPlayer && entry.rank > playerLeaderboardEntry.rank)
      .sort((left, right) => left.rank - right.rank)[0] ?? null
    : null;
  const climbScore =
    playerLeaderboardEntry?.points ??
    profileLeaderboardScore;
  const currentLeagueIndex = Math.max(
    0,
    climbLeagueConfig.findIndex((league, index) => {
      const nextLeague = climbLeagueConfig[index + 1];

      return climbScore >= league.floor && (!nextLeague || climbScore < nextLeague.floor);
    })
  );
  const currentLeague = climbLeagueConfig[currentLeagueIndex];
  const nextLeague = climbLeagueConfig[currentLeagueIndex + 1] ?? null;
  const nextLeagueTarget = nextLeague?.floor ?? climbScore + Math.max(500, Math.ceil(climbScore * 0.12));
  const pointsToNextLeague = Math.max(1, nextLeagueTarget - climbScore);
  const leagueProgressSpan = Math.max(1, nextLeagueTarget - currentLeague.floor);
  const leagueProgressPercent = nextLeague
    ? Math.max(7, Math.min(96, Math.round(((climbScore - currentLeague.floor) / leagueProgressSpan) * 100)))
    : 100;
  const pointsToNextRank = nextRankEntry && playerLeaderboardEntry
    ? Math.max(1, nextRankEntry.points - playerLeaderboardEntry.points + 1)
    : 0;
  const previousClimbScore = latestMatch ? Math.max(0, climbScore - latestMatch.points) : 0;
  const previousRankEstimate = latestMatch
    ? leaderboardByRank.filter((entry) => !entry.isPlayer && entry.points > previousClimbScore).length + 1
    : playerRank;
  const rankMoveDelta = playerRank && previousRankEstimate
    ? Math.max(0, previousRankEstimate - playerRank)
    : 0;
  const latestRunCreatedRank = Boolean(latestMatch && playerRank && climbScore <= latestMatch.points);
  const rankMovementTitle = latestMatch
    ? latestRunCreatedRank && playerRank
      ? `Reached #${playerRank} after your last run`
      : rankMoveDelta > 0
        ? `Climbed ${rankMoveDelta} ${rankMoveDelta === 1 ? "spot" : "spots"} last run`
        : playerRank
          ? `Held #${playerRank} after your last run`
          : "Last run saved your progress"
    : "Your first run starts the story";
  const rankMovementCaption = latestMatch
    ? `+${latestMatch.points.toLocaleString("en-US")} pts from ${latestMatch.difficulty} ${latestMatch.category === "single-player" ? "solo" : latestMatch.category}.`
    : "Play once and this card becomes your before-and-after climb.";
  const chaseProgressPercent = nextRankEntry && playerLeaderboardEntry
    ? Math.max(8, Math.min(96, Math.round((playerLeaderboardEntry.points / Math.max(1, nextRankEntry.points)) * 100)))
    : playerLeaderboardEntry
      ? leagueProgressPercent
      : Math.max(8, Math.min(88, Math.round((climbScore / Math.max(1, nextLeagueTarget)) * 100)));
  const primaryChaseTitle = nextRankEntry
    ? `${pointsToNextRank.toLocaleString("en-US")} pts to pass ${nextRankEntry.name}`
    : nextLeague
      ? `${pointsToNextLeague.toLocaleString("en-US")} pts to reach ${nextLeague.name}`
      : "You are holding the top chase spot";
  const primaryChaseCaption = nextRankEntry
    ? `You are #${playerLeaderboardEntry?.rank ?? "--"} with ${playerLeaderboardEntry?.points.toLocaleString("en-US")} pts. One strong run can close the gap.`
    : nextLeague
      ? `${currentLeague.name} ${climbScore.toLocaleString("en-US")} -> ${nextLeague.name} ${nextLeagueTarget.toLocaleString("en-US")}.`
      : "Keep playing to protect your spot before someone catches your score.";
  const recentAveragePoints = recentMatches.length > 0
    ? Math.max(50, Math.round(recentMatches.reduce((sum, match) => sum + match.points, 0) / recentMatches.length))
    : 250;
  const sevenDayCutoffMs = Date.now() - 6 * DAY_MS;
  const sevenDayMatches = profile.history.filter((match) => {
    const playedAtMs = new Date(match.playedAt).getTime();

    return Number.isFinite(playedAtMs) && playedAtMs >= sevenDayCutoffMs;
  });
  const playedDayKeys = new Set(
    profile.history
      .map((match) => {
        const playedAt = new Date(match.playedAt);

        return Number.isFinite(playedAt.getTime()) ? getTodayKey(playedAt) : null;
      })
      .filter((dateKey): dateKey is string => Boolean(dateKey))
  );
  const sevenDayPoints = sevenDayMatches.reduce((sum, match) => sum + match.points, 0);
  const sevenDayActiveDays = new Set(
    sevenDayMatches
      .map((match) => {
        const playedAtMs = new Date(match.playedAt).getTime();

        return Number.isFinite(playedAtMs) ? getTodayKey(new Date(playedAtMs)) : null;
      })
      .filter((dateKey): dateKey is string => Boolean(dateKey))
  ).size;
  const baseSprintPointTarget = Math.max(1000, recentAveragePoints * 7);
  const sprintPointTarget = sevenDayPoints >= baseSprintPointTarget
    ? Math.ceil((sevenDayPoints + recentAveragePoints) / 500) * 500
    : baseSprintPointTarget;
  const sprintPointsNeeded = Math.max(0, sprintPointTarget - sevenDayPoints);
  const sprintRunsNeeded = Math.max(1, Math.ceil(sprintPointsNeeded / recentAveragePoints));
  const sprintDayTarget = sevenDayActiveDays >= 3 ? 5 : 3;
  const sprintDaysNeeded = Math.max(0, sprintDayTarget - sevenDayActiveDays);
  const sprintProgressPercent = Math.max(
    sevenDayPoints > 0 ? 8 : 0,
    Math.min(100, Math.round((sevenDayPoints / Math.max(1, sprintPointTarget)) * 100))
  );
  const sprintCaption = sprintPointsNeeded <= 0
    ? "Sprint target cleared. One more run raises the next chase line."
    : `${sprintRunsNeeded} ${sprintRunsNeeded === 1 ? "run" : "runs"} at your pace can finish this sprint.`;
  const rewardClaimDayKeys = new Set(
    profile.dailyReward.lastClaimedOn ? [profile.dailyReward.lastClaimedOn] : []
  );
  const dailyPuzzleDayKeys = new Set(Object.keys(profile.dailyPuzzle.completedByDate));
  const returnWeekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));

    const dateKey = getTodayKey(date);
    const played = playedDayKeys.has(dateKey);
    const claimed = rewardClaimDayKeys.has(dateKey);
    const puzzle = dailyPuzzleDayKeys.has(dateKey);

    return {
      active: played || claimed || puzzle,
      dateKey,
      isToday: dateKey === todayKey,
      label: dateKey === todayKey ? "Today" : weekdayLabels[date.getDay()],
      played,
      claimed,
      puzzle
    };
  });
  const returnWeekActiveDays = returnWeekDays.filter((day) => day.active).length;
  const playedToday = playedDayKeys.has(todayKey);
  const dailyPuzzleCompletedToday = dailyPuzzleDayKeys.has(todayKey);
  const todayLoopItems = [
    {
      accent: colors.warning,
      done: lastClaimedToday,
      icon: "gift" as const,
      label: "Claim"
    },
    {
      accent: colors.accent,
      done: dailyPuzzleCompletedToday,
      icon: "calendar" as const,
      label: "Daily"
    },
    {
      accent: colors.danger,
      done: playedToday,
      icon: "flash" as const,
      label: "Run"
    }
  ];
  const todayLoopDoneCount = todayLoopItems.filter((item) => item.done).length;
  const todayLoopOpenCount = todayLoopItems.length - todayLoopDoneCount;
  const latestMatchDayKey = latestMatch ? getTodayKey(new Date(latestMatch.playedAt)) : null;
  const daysSinceLastRun = latestMatchDayKey
    ? Math.max(
      0,
      Math.round((new Date(`${todayKey}T00:00:00`).getTime() - new Date(`${latestMatchDayKey}T00:00:00`).getTime()) / DAY_MS)
    )
    : null;
  const returnBriefingTitle = todayLoopOpenCount <= 0
    ? "Today is fully banked"
    : playedToday
      ? "One more move can close today"
      : "Today has an open climb";
  const returnBriefingCaption = !lastClaimedToday
    ? "Claim the reward first, then turn the bonus into visible climb progress."
    : !dailyPuzzleCompletedToday
      ? "Daily puzzle is still open. It is the cleanest habit lock for today."
      : !playedToday
        ? "One quick run puts a fresh score on the board before you leave."
        : "Come back tomorrow with the streak already protected.";
  const returnBriefingAction = !lastClaimedToday
    ? "CLAIM AND PLAY"
    : !dailyPuzzleCompletedToday
      ? "LOCK DAILY RUN"
      : playedToday
        ? "ADD ONE MORE RUN"
        : "START A RUN";
  const comebackCaption = daysSinceLastRun === null
    ? "Your first match will create a comeback line here."
    : daysSinceLastRun === 0
      ? `Last run today added +${latestMatch?.points.toLocaleString("en-US") ?? "0"} pts.`
      : `${daysSinceLastRun} ${daysSinceLastRun === 1 ? "day" : "days"} since your last run. A small score restarts the chain.`;
  const estimatedLeagueRunsToTarget = Math.max(1, Math.ceil(pointsToNextLeague / recentAveragePoints));
  const coachPick = nextRankEntry
    ? {
      accent: colors.danger,
      action: "Chase rival",
      body: `${pointsToNextRank.toLocaleString("en-US")} pts can move you past ${nextRankEntry.name}.`,
      icon: "rocket" as const,
      label: "Best move",
      route: "/online" as const,
      title: "Play ranked now"
    }
    : !playerLeaderboardEntry
      ? {
        accent: colors.danger,
        action: "Enter board",
        body: "One ranked match creates your first public target and rival list.",
        icon: "flag" as const,
        label: "Start here",
        route: "/online" as const,
        title: "Claim a rank"
      }
      : sprintDaysNeeded > 0
        ? {
          accent: colors.accent,
          action: "Lock habit",
          body: `${sprintDaysNeeded} active ${sprintDaysNeeded === 1 ? "day" : "days"} left for this sprint. Keep the week alive.`,
          icon: "calendar" as const,
          label: "Daily move",
          route: "/daily-puzzle" as const,
          title: "Play today's run"
        }
        : nextLeague
          ? {
            accent: nextLeague.accent,
            action: "Push league",
            body: `${estimatedLeagueRunsToTarget} ${estimatedLeagueRunsToTarget === 1 ? "run" : "runs"} at your pace can reach ${nextLeague.name}.`,
            icon: nextLeague.icon,
            label: "Best move",
            route: "/single-player" as const,
            title: `Push toward ${nextLeague.name}`
          }
          : {
            accent: colors.online,
            action: "Build gap",
            body: "No higher tier is waiting. Extend the score people have to chase.",
            icon: "shield-checkmark" as const,
            label: "Best move",
            route: "/single-player" as const,
            title: "Extend your lead"
          };
  const chaserGap = closestChaserEntry
    ? Math.max(1, climbScore - closestChaserEntry.points + 1)
    : 0;
  const chaserIsClose = Boolean(closestChaserEntry && chaserGap <= Math.max(recentAveragePoints * 3, 750));
  const rivalryCards = [
    {
      accent: nextRankEntry ? colors.danger : nextLeague?.accent ?? currentLeague.accent,
      caption: nextRankEntry
        ? `${nextRankEntry.points.toLocaleString("en-US")} pts · ${pointsToNextRank.toLocaleString("en-US")} to pass.`
        : nextLeague
          ? `${pointsToNextLeague.toLocaleString("en-US")} pts until ${nextLeague.name} status.`
          : "Final league gate cleared. Your rival is your own best score now.",
      icon: nextRankEntry ? "arrow-up-circle" as const : "diamond" as const,
      label: nextRankEntry ? `#${nextRankEntry.rank}` : nextLeague?.name ?? "Mythic+",
      name: nextRankEntry?.name ?? nextLeague?.name ?? "Legacy score",
      title: nextRankEntry ? "Catch next" : "Next status"
    },
    {
      accent: closestChaserEntry ? colors.warning : colors.online,
      caption: closestChaserEntry
        ? chaserIsClose
          ? `${chaserGap.toLocaleString("en-US")} pts keeps ${closestChaserEntry.name} behind you.`
          : `${closestChaserEntry.name} is ${chaserGap.toLocaleString("en-US")} pts back. Keep widening it.`
        : playerLeaderboardEntry
          ? "No close chaser yet. Build a cushion before the board gets crowded."
          : "Place once to reveal who is chasing and who is ahead.",
      icon: closestChaserEntry ? "shield-checkmark" as const : "search" as const,
      label: closestChaserEntry ? `#${closestChaserEntry.rank}` : playerLeaderboardEntry ? "Clear" : "Open",
      name: closestChaserEntry?.name ?? (playerLeaderboardEntry ? "No chaser nearby" : "First rival"),
      title: closestChaserEntry ? "Defend from" : playerLeaderboardEntry ? "Lead cushion" : "Rivals unlock"
    }
  ];
  const activeTargetNeed = nextRankEntry ? pointsToNextRank : pointsToNextLeague;
  const activeTargetName = nextRankEntry ? `#${nextRankEntry.rank}` : nextLeague?.name ?? "Mythic+";
  const activeGoalRoute = nextRankEntry || !playerLeaderboardEntry ? "/online" as const : "/single-player" as const;
  const returnBriefingRoute = !lastClaimedToday || !dailyPuzzleCompletedToday
    ? "/daily-puzzle" as const
    : activeGoalRoute;
  const focusDigestCards = [
    {
      accent: colors.danger,
      caption: nextRankEntry
        ? `${pointsToNextRank.toLocaleString("en-US")} pts to pass #${nextRankEntry.rank}.`
        : playerLeaderboardEntry
          ? "Protect this spot with one visible run."
          : "Play ranked once to enter the board.",
      icon: "podium" as const,
      label: "Rank",
      value: playerRank ? `#${playerRank}` : "Open"
    },
    {
      accent: nextLeague?.accent ?? currentLeague.accent,
      caption: nextLeague
        ? `${pointsToNextLeague.toLocaleString("en-US")} pts to ${nextLeague.name}.`
        : "Final league reached. Build legacy score.",
      icon: nextLeague?.icon ?? currentLeague.icon,
      label: "League",
      value: currentLeague.name
    },
    {
      accent: colors.accent,
      caption: todayLoopOpenCount > 0
        ? `${todayLoopOpenCount} ${todayLoopOpenCount === 1 ? "move" : "moves"} left to close today.`
        : "Daily loop complete. Extra runs build cushion.",
      icon: "calendar" as const,
      label: "Today",
      value: `${todayLoopDoneCount}/${todayLoopItems.length}`
    }
  ];
  const estimatedRunsToTarget = Math.max(1, Math.ceil(activeTargetNeed / recentAveragePoints));
  const runPlanRows = [
    {
      label: "Next run",
      runs: 1,
      projected: recentAveragePoints
    },
    {
      label: "3-run push",
      runs: 3,
      projected: recentAveragePoints * 3
    },
    {
      label: "Target pace",
      runs: estimatedRunsToTarget,
      projected: recentAveragePoints * estimatedRunsToTarget
    }
  ];
  const bestDifficultyKey = difficultyChartConfig
    .map((difficulty) => ({
      ...difficulty,
      score: profile.stats.singlePlayerHighScores[difficulty.key],
      rounds: profile.stats.singlePlayerHighRounds[difficulty.key]
    }))
    .sort((left, right) => right.score - left.score)[0];
  const nextBestScoreTarget = Math.max(singlePlayerBestScore + 25, Math.ceil((singlePlayerBestScore + 1) / 25) * 25);
  const streakTarget = Math.max(profile.bestWinStreak + 1, 3);
  const nextDailyStreak = profile.dailyReward.streakDays + 1;
  const nextDailyReward = getDailyRewardValues(nextDailyStreak);
  const dailyReturnCaption = lastClaimedToday
    ? `Come back tomorrow to push the reward streak to Day ${nextDailyStreak}.`
    : `Claim today to lock Day ${profile.dailyReward.streakDays + 1} before you play.`;
  const unlockedAchievements = new Set(profile.achievements);
  const achievementTargets = [
    {
      accent: colors.practice,
      current: Math.min(1, profile.stats.wins),
      goal: 1,
      icon: "ribbon" as const,
      id: "first-win",
      needText: "Win one match",
      title: "First Win"
    },
    {
      accent: colors.danger,
      current: profile.bestWinStreak,
      goal: 3,
      icon: "flame" as const,
      id: "streak-3",
      needText: `${Math.max(1, 3 - profile.bestWinStreak)} streak wins left`,
      title: "On Fire"
    },
    {
      accent: colors.warning,
      current: profile.bestWinStreak,
      goal: 5,
      icon: "trophy" as const,
      id: "streak-5",
      needText: `${Math.max(1, 5 - profile.bestWinStreak)} streak wins left`,
      title: "Unstoppable"
    },
    {
      accent: colors.online,
      current: profile.stats.category.online.wins,
      goal: 3,
      icon: "globe" as const,
      id: "online-contender",
      needText: `${Math.max(1, 3 - profile.stats.category.online.wins)} online wins left`,
      title: "Online Contender"
    },
    {
      accent: colors.ai,
      current: profile.stats.category["vs-ai"].wins,
      goal: 5,
      icon: "hardware-chip" as const,
      id: "ai-slayer",
      needText: `${Math.max(1, 5 - profile.stats.category["vs-ai"].wins)} VS AI wins left`,
      title: "AI Slayer"
    },
    {
      accent: colors.warning,
      current: profile.dailyReward.streakDays,
      goal: 3,
      icon: "calendar" as const,
      id: "daily-dedication",
      needText: `${Math.max(1, 3 - profile.dailyReward.streakDays)} daily claims left`,
      title: "Daily Dedication"
    }
  ]
    .filter((target) => !unlockedAchievements.has(target.id as never))
    .sort((left, right) => right.current / right.goal - left.current / left.goal);
  const nextAchievementTarget = achievementTargets[0] ?? null;
  const xpToNextLevel = Math.max(0, nextLevelFloorXp - profile.xp);
  const rewardTrailCards = [
    {
      accent: nextLeague?.accent ?? currentLeague.accent,
      caption: nextLeague
        ? `${pointsToNextLeague.toLocaleString("en-US")} pts to show ${nextLeague.name} status on the climb board.`
        : "Mythic status is yours. Keep extending the score people see first.",
      icon: nextLeague?.icon ?? currentLeague.icon,
      label: nextLeague ? "Status" : "Legacy",
      title: nextLeague ? `${nextLeague.name} badge` : "Mythic legacy"
    },
    {
      accent: colors.warning,
      caption: lastClaimedToday
        ? `Tomorrow is worth +${nextDailyReward.points} pts and +${nextDailyReward.xp} XP.`
        : `Claim now for +${nextDailyReward.points} pts and +${nextDailyReward.xp} XP.`,
      icon: "gift" as const,
      label: lastClaimedToday ? "Tomorrow" : "Ready",
      title: `Day ${nextDailyStreak} reward`
    },
    {
      accent: nextAchievementTarget?.accent ?? colors.practice,
      caption: nextAchievementTarget
        ? nextAchievementTarget.needText
        : "All core badges are unlocked. Your next flex is rank and league.",
      icon: nextAchievementTarget?.icon ?? "checkmark-circle",
      label: "Badge",
      title: nextAchievementTarget?.title ?? "Badge set complete"
    },
    {
      accent: colors.online,
      caption: `${xpToNextLevel.toLocaleString("en-US")} XP to +${LEVEL_UP_COIN_REWARD} coins and +${LEVEL_UP_EXTRA_GUESS_POWER_UP_REWARD} booster.`,
      icon: "sparkles" as const,
      label: "Level",
      title: `Level ${profile.level + 1} reward`
    }
  ];
  const momentumCards = [
    {
      accent: colors.practice,
      caption: rankMovementCaption,
      icon: "trending-up" as const,
      label: latestRunCreatedRank && playerRank ? `#${playerRank}` : rankMoveDelta > 0 ? `+${rankMoveDelta}` : playerRank ? `#${playerRank}` : "New",
      title: rankMovementTitle
    },
    {
      accent: colors.danger,
      caption: nextRankEntry
        ? `${pointsToNextRank.toLocaleString("en-US")} pts separates you from ${nextRankEntry.name}.`
        : playerLeaderboardEntry
          ? "Keep playing today so your position feels harder to steal."
          : "One ranked run creates your first rival target.",
      icon: "locate" as const,
      label: nextRankEntry ? `#${nextRankEntry.rank}` : playerLeaderboardEntry ? "Defend" : "Start",
      title: nextRankEntry
        ? "Nearest rival is reachable"
        : playerLeaderboardEntry
          ? "Protect the lead"
          : "First rival unlocks next"
    },
    {
      accent: colors.warning,
      caption: dailyReturnCaption,
      icon: "calendar" as const,
      label: lastClaimedToday ? "Tomorrow" : "Today",
      title: lastClaimedToday ? "Return streak armed" : "Daily streak waiting"
    }
  ];
  const missionCards = [
    {
      accent: colors.danger,
      action: "Play ranked",
      caption: nextRankEntry
        ? `Beat ${nextRankEntry.name} by ${pointsToNextRank.toLocaleString("en-US")} pts.`
        : playerLeaderboardEntry
          ? nextLeague
            ? `Build a bigger lead while chasing ${nextLeague.name}.`
            : "Win again to make your lead harder to steal."
          : "Finish one ranked match to enter the live board.",
      icon: "podium" as const,
      progress: chaseProgressPercent,
      route: "/online" as const,
      title: nextRankEntry ? "Overtake the next rival" : playerLeaderboardEntry ? "Protect the top spot" : "Start the climb"
    },
    {
      accent: nextLeague?.accent ?? currentLeague.accent,
      action: "Raise league",
      caption: nextLeague
        ? `${pointsToNextLeague.toLocaleString("en-US")} pts to leave ${currentLeague.name} and unlock ${nextLeague.name}.`
        : "You are past the final league gate. Keep building a score nobody can touch.",
      icon: nextLeague?.icon ?? currentLeague.icon,
      progress: leagueProgressPercent,
      route: "/single-player" as const,
      title: nextLeague ? `Reach ${nextLeague.name} league` : "Extend Mythic status"
    },
    {
      accent: colors.warning,
      action: "Push best score",
      caption: singlePlayerBestScore > 0
        ? `${Math.max(1, nextBestScoreTarget - singlePlayerBestScore).toLocaleString("en-US")} pts to raise your ${bestDifficultyKey.label} best.`
        : "Set your first score and give the stats board something to chase.",
      icon: "flash" as const,
      progress: singlePlayerBestScore > 0
        ? Math.max(12, Math.min(95, Math.round((singlePlayerBestScore / nextBestScoreTarget) * 100)))
        : 8,
      route: "/single-player" as const,
      title: singlePlayerBestScore > 0
        ? `Reach ${nextBestScoreTarget.toLocaleString("en-US")} in ${bestDifficultyKey.label}`
        : "Record your first best score"
    },
    {
      accent: colors.practice,
      action: "Build streak",
      caption: profile.currentWinStreak > 0
        ? `${Math.max(1, streakTarget - profile.currentWinStreak)} more wins to create a new streak target.`
        : "One win starts your comeback chain.",
      icon: "flame" as const,
      progress: Math.max(
        profile.currentWinStreak > 0 ? 12 : 8,
        Math.min(100, Math.round((profile.currentWinStreak / Math.max(1, streakTarget)) * 100))
      ),
      route: "/daily-puzzle" as const,
      title: `Grow streak to ${streakTarget}`
    }
  ];

  const handleClaimDailyReward = async () => {
    try {
      setIsClaimingReward(true);
      const reward = await claimDailyReward();

      if (!reward.claimed) {
        playSound("error");
        Alert.alert("Already claimed", "Come back tomorrow.");
        return;
      }

      playSound("coinReward");
      Alert.alert("Daily reward", `+${reward.points} pts, +${reward.xp} XP`);
    } finally {
      setIsClaimingReward(false);
    }
  };

  const handleClaimHeaderAdReward = async () => {
    if (isClaimingHeaderAdReward) {
      return;
    }

    if (!isRewardedReviveSupported()) {
      playSound("purchaseFail");
      Alert.alert("Rewarded ad unavailable", "Rewarded ads are not available in this build yet.");
      return;
    }

    try {
      setIsClaimingHeaderAdReward(true);
      const rewarded = await showRewardedReviveAd();

      if (!rewarded) {
        playSound("purchaseFail");
        Alert.alert("Reward unavailable", "Ad was skipped or unavailable. Try again.");
        return;
      }

      const awarded = await awardCoins(HEADER_REWARDED_COIN_AMOUNT);

      if (!awarded) {
        throw new Error("Could not add coins right now.");
      }

      playSound("coinReward");
    } catch (error) {
      playSound("purchaseFail");
      Alert.alert("Reward unavailable", error instanceof Error ? error.message : "Could not add coins right now.");
    } finally {
      setIsClaimingHeaderAdReward(false);
    }
  };

  const openProfileEditor = () => {
    setProfileSection("profile");
    setUsernameDraft(displayName);
    setUsernameError(null);
    router.push("/profile");
  };

  const handleSaveUsername = async () => {
    try {
      setIsSavingUsername(true);
      setUsernameError(null);
      await updateDisplayName(usernameDraft);
      playSound("purchaseSuccess");
    } catch (error) {
      playSound("error");
      setUsernameError(error instanceof Error ? error.message : "Try again.");
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleSelectAvatar = async (avatarId: AvatarId) => {
    if (savingAvatarId || avatarId === profile.avatarId) {
      return;
    }

    try {
      setAvatarError(null);
      setSavingAvatarId(avatarId);
      await updateAvatarId(avatarId);
      playSound("tabSwitch");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Try again.";
      setAvatarError(message);
      playSound("error");
      Alert.alert("Avatar not saved", message);
    } finally {
      setSavingAvatarId(null);
    }
  };

  const handleUnlockPremiumAvatar = async (option: PremiumProfileAvatarOption) => {
    if (savingAvatarId) {
      return;
    }

    if (profile.level < option.requiredLevel) {
      const message = `Reach level ${option.requiredLevel} to unlock ${option.label}.`;

      setAvatarError(message);
      setPremiumAvatarPurchaseDraft(null);
      playSound("purchaseFail");
      Alert.alert("Level locked", message);
      return;
    }

    if (profile.coins < option.price) {
      const shortfall = option.price - profile.coins;
      const message = `Not enough coins for ${option.label}. You need ${shortfall.toLocaleString("en-US")} more.`;

      setAvatarError(message);
      setPremiumAvatarPurchaseDraft(null);
      playSound("purchaseFail");
      Alert.alert(
        "Not enough coins",
        message
      );
      return;
    }

    try {
      setAvatarError(null);
      setSavingAvatarId(option.id);
      await purchasePremiumAvatar(option.id);
      setPremiumAvatarPurchaseDraft(null);
      playSound("purchaseSuccess");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Try again.";
      setAvatarError(message);
      setPremiumAvatarPurchaseDraft(null);
      playSound("purchaseFail");
      Alert.alert("Avatar not unlocked", message);
    } finally {
      setSavingAvatarId(null);
    }
  };

  const handlePressPremiumAvatar = async (option: PremiumProfileAvatarOption) => {
    const isOwned = profile.premiumAvatarIds.includes(option.id);

    if (isOwned) {
      await handleSelectAvatar(option.id);
      return;
    }

    if (savingAvatarId) {
      return;
    }

    if (profile.level < option.requiredLevel) {
      const message = `Reach level ${option.requiredLevel} to unlock ${option.label}.`;

      setAvatarError(message);
      playSound("purchaseFail");
      Alert.alert("Level locked", message);
      return;
    }

    if (profile.coins < option.price) {
      const shortfall = option.price - profile.coins;
      const message = `Not enough coins for ${option.label}. You need ${shortfall.toLocaleString("en-US")} more.`;

      setAvatarError(message);
      playSound("purchaseFail");
      Alert.alert(
        "Not enough coins",
        message
      );
      return;
    }

    setAvatarError(null);
    setPremiumAvatarPurchaseDraft(option);
    playSound("modalOpen");
  };

  const handleRestorePurchases = async () => {
    if (!billingEnabled || isRestoringPurchases) {
      return;
    }

    try {
      setIsRestoringPurchases(true);
      setSettingsMessage(null);
      await restoreBillingPurchases();
      const customer = await getBillingCustomerSnapshot();
      setHasNoAdsEntitlement(customer.hasRemoveAds);
      playSound(customer.hasRemoveAds ? "purchaseSuccess" : "uiTap");
      setSettingsMessage(customer.hasRemoveAds ? "No Ads restored." : "No active purchases found.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not restore purchases right now.";
      setSettingsMessage(message);
      playSound("purchaseFail");
    } finally {
      setIsRestoringPurchases(false);
    }
  };

  const handleCopyPlayerKey = async () => {
    if (!playerKey) {
      return;
    }

    await Clipboard.setStringAsync(playerKey);
    setSettingsMessage("Player ID copied.");
    playSound("uiTap");
  };

  const handleOpenNoAdsPurchase = () => {
    if (hasNoAdsEntitlement) {
      playSound("uiTap");
      Alert.alert("No Ads active", "Ads are already removed for this account.");
      return;
    }

    playSound("modalOpen");
    setShowNoAdsPurchase(true);
  };

  const selectedAvatarId = savingAvatarId ?? profile.avatarId ?? DEFAULT_AVATAR_ID;
  const selectedAvatar =
    profileAvatarOptions.find((option) => option.id === selectedAvatarId) ??
    profileAvatarOptions.find((option) => option.id === DEFAULT_AVATAR_ID) ??
    profileAvatarOptions[0];
  const activeAvatarOptions =
    avatarPickerTab === "premium" ? premiumProfileAvatarOptions : defaultProfileAvatarOptions;
  const premiumAvatarPurchaseBalanceAfter = premiumAvatarPurchaseDraft
    ? profile.coins - premiumAvatarPurchaseDraft.price
    : 0;

  useEffect(() => {
    void Image.prefetch(selectedAvatar.imageUrl);
  }, [selectedAvatar.imageUrl]);

  useEffect(() => {
    if (activeTab === "profile") {
      void Promise.allSettled(profileAvatarImageUrls.map((imageUrl) => Image.prefetch(imageUrl)));
    }
  }, [activeTab]);
  const profileBaseInset = Math.max(12, Math.min(16, screenWidth * 0.04));
  const profileMaxContentWidth = screenWidth >= 560 ? 500 : 460;
  const profileContentWidth = Math.min(profileMaxContentWidth, screenWidth - profileBaseInset * 2);
  const profileContentInset = Math.max(profileBaseInset, (screenWidth - profileContentWidth) / 2);
  const isProfileCompact = screenWidth < 360;
  const profileHeroAvatarSize = Math.max(64, Math.min(82, screenWidth * 0.2));
  const profileHeroShellMinHeight = Math.max(214, Math.min(270, screenHeight * 0.34));
  const profileHeroCardMinHeight = Math.max(120, Math.min(148, screenHeight * 0.18));
  const profileHeroCardPaddingTop = Math.max(44, profileHeroAvatarSize * 0.62);
  const profileHeroLevelBadgeSize = Math.max(30, Math.min(38, screenWidth * 0.09));
  const profileHeroNameFontSize = Math.max(18, Math.min(22, profileContentWidth * 0.06));
  const profileHeroProgressPadding = Math.max(10, Math.min(18, profileContentWidth * 0.05));
  const profileAvatarOptionSize = Math.max(48, Math.min(68, (profileContentWidth - 16) / 5));
  const profileInnerMargin = isProfileCompact ? 4 : 8;
  const shopHeaderStatusWidth = Math.min(320, Math.max(250, screenWidth - 56));
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const appBuildNumber = Constants.expoConfig?.android?.versionCode;
  const playerKeyPreview = playerKey ? `${playerKey.slice(0, 10)}...${playerKey.slice(-4)}` : "Loading";

  const handleTabChange = (tab: HomeTab) => {
    if (tab === "profile") {
      openProfileEditor();
      return;
    }

    if (tab === "stats") {
      router.replace("/stats");
      return;
    }

    if (tab === "play") {
      router.replace("/");
      return;
    }

    router.replace({ pathname: "/", params: { tab } });
  };

  const handleReturnHome = () => {
    playSound("back");
    router.replace("/");
  };

  useHardwareBackHandler(handleReturnHome, activeTab === "profile");
  useHardwareBackHandler(handleReturnHome, activeTab === "settings");

  const navigateToGameMode = (path: "/single-player" | "/vs-ai" | "/online" | "/daily-puzzle") => {
    router.push(path);
  };

  return (
    <>
    <ScreenContainer contentStyle={styles.screen}>
      <Animated.View style={[styles.shell, { opacity: fadeIn }]}>
        {activeTab === "profile" ? null : (
          <AppHeader
            center={
              activeTab === "shop" ? undefined : (
                <View style={styles.homeHeaderCenter}>
                  <Pressable onPress={openProfileEditor} style={({ pressed }) => [styles.profileCrest, pressed && styles.pressed]}>
                    <View style={styles.levelBurst}>
                      <Svg height="100%" style={styles.levelBurstSvg} viewBox="0 0 100 100" width="100%">
                        <Defs>
                          <LinearGradient id="homeLevelStarGradient" x1="0" x2="1" y1="0" y2="1">
                            <Stop offset="0" stopColor="#8de7ff" />
                            <Stop offset="0.5" stopColor="#4dbcf4" />
                            <Stop offset="1" stopColor="#2384d1" />
                          </LinearGradient>
                        </Defs>
                        <Polygon
                          fill="url(#homeLevelStarGradient)"
                          points="50,4 61,23 83,17 77,39 96,50 77,61 83,83 61,77 50,96 39,77 17,83 23,61 4,50 23,39 17,17 39,23"
                          stroke="#287fc2"
                          strokeLinejoin="round"
                          strokeWidth={7}
                        />
                        <SvgText
                          fill={colors.surface}
                          fontSize={36}
                          fontWeight="700"
                          textAnchor="middle"
                          x={50}
                          y={63}
                        >
                          {profile.level}
                        </SvgText>
                      </Svg>
                    </View>

                    <View style={styles.profileMedallion}>
                      <View style={styles.profileRingBase}>
                        <Svg height={PROFILE_RING_SIZE} style={styles.profileRingSvg} width={PROFILE_RING_SIZE}>
                          <Circle
                            cx={PROFILE_RING_SIZE / 2}
                            cy={PROFILE_RING_SIZE / 2}
                            fill="none"
                            r={PROFILE_RING_RADIUS}
                            stroke="#aa5139"
                            strokeWidth={PROFILE_RING_STROKE}
                          />
                          <Circle
                            cx={PROFILE_RING_SIZE / 2}
                            cy={PROFILE_RING_SIZE / 2}
                            fill="none"
                            r={PROFILE_RING_RADIUS}
                            stroke="#19d6e9"
                            strokeDasharray={PROFILE_RING_CIRCUMFERENCE}
                            strokeDashoffset={levelProgressOffset}
                            strokeLinecap="round"
                            strokeWidth={PROFILE_RING_STROKE}
                            transform={`rotate(-90 ${PROFILE_RING_SIZE / 2} ${PROFILE_RING_SIZE / 2})`}
                          />
                        </Svg>
                      </View>

                      <View style={[styles.profileRingInner, { backgroundColor: selectedAvatar.ring }]}>
                        <View style={[styles.profileAvatarCore, { backgroundColor: selectedAvatar.background }]}>
                          <Image
                            accessibilityIgnoresInvertColors
                            resizeMode="cover"
                            source={{ cache: "force-cache", uri: selectedAvatar.imageUrl }}
                            style={styles.profileAvatarImage}
                          />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </View>
              )
            }
            hideSeparator={activeTab === "shop"}
            left={activeTab === "shop" ? (
              <HeaderBackButton onPress={() => router.replace("/")} />
            ) : (
              <View style={styles.homeHeaderNoAdsSlot}>
                <Pressable
                  accessibilityLabel="Open No Ads offer"
                  accessibilityRole="button"
                  onPress={handleOpenNoAdsPurchase}
                  style={({ pressed }) => [styles.homeHeaderNoAdsButton, pressed && styles.pressed]}
                >
                  <Image
                    accessibilityIgnoresInvertColors
                    resizeMode="contain"
                    source={noAdsButtonImage}
                    style={styles.homeHeaderNoAdsImage}
                  />
                </Pressable>
              </View>
            )}
            right={activeTab === "shop" ? (
              <View style={[styles.shopHeaderStatusSlot, { width: shopHeaderStatusWidth }]}>
                <ShopTabHeader />
              </View>
            ) : (
              <View style={styles.homeHeaderRight}>
                <HeaderRewardAdButton
                  amount={HEADER_REWARDED_COIN_AMOUNT}
                  loading={isClaimingHeaderAdReward}
                  onPress={() => void handleClaimHeaderAdReward()}
                />
                <HeaderCoinsPill coins={profile.coins} onPressPlus={() => handleTabChange("shop")} />
              </View>
            )}
          />
        )}

        <NoAdsPurchasePrompt
          onClose={() => setShowNoAdsPurchase(false)}
          visible={showNoAdsPurchase}
        />

        <Modal
          animationType="fade"
          onRequestClose={() => {
            if (!savingAvatarId) {
              setPremiumAvatarPurchaseDraft(null);
            }
          }}
          statusBarTranslucent
          transparent
          visible={premiumAvatarPurchaseDraft !== null}
        >
          <View style={styles.avatarConfirmBackdrop}>
            {premiumAvatarPurchaseDraft ? (
              <View style={styles.avatarConfirmCard}>
                <View style={styles.avatarConfirmHeader}>
                  <View
                    style={[
                      styles.avatarConfirmPreview,
                      {
                        backgroundColor: premiumAvatarPurchaseDraft.background,
                        borderColor: premiumAvatarPurchaseDraft.ring
                      }
                    ]}
                  >
                    <Image
                      accessibilityIgnoresInvertColors
                      resizeMode="cover"
                      source={{ cache: "force-cache", uri: premiumAvatarPurchaseDraft.imageUrl }}
                      style={styles.avatarConfirmImage}
                    />
                  </View>
                  <View style={styles.avatarConfirmCopy}>
                    <Text style={styles.avatarConfirmEyebrow}>Premium Avatar</Text>
                    <Text numberOfLines={1} style={styles.avatarConfirmTitle}>{premiumAvatarPurchaseDraft.label}</Text>
                    <Text style={styles.avatarConfirmText}>Unlock this avatar with coins?</Text>
                  </View>
                </View>

                <View style={styles.avatarConfirmCostPanel}>
                  <View style={styles.avatarConfirmCostRow}>
                    <Text style={styles.avatarConfirmCostLabel}>Cost</Text>
                    <View style={styles.avatarConfirmCoinValue}>
                      <CoinIcon size={18} />
                      <Text style={styles.avatarConfirmCostValue}>
                        {premiumAvatarPurchaseDraft.price.toLocaleString("en-US")}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.avatarConfirmCostRow}>
                    <Text style={styles.avatarConfirmCostLabel}>After purchase</Text>
                    <Text style={styles.avatarConfirmBalanceValue}>
                      {Math.max(0, premiumAvatarPurchaseBalanceAfter).toLocaleString("en-US")} coins
                    </Text>
                  </View>
                </View>

                <View style={styles.avatarConfirmActions}>
                  <Pressable
                    disabled={savingAvatarId !== null}
                    onPress={() => {
                      setPremiumAvatarPurchaseDraft(null);
                      playSound("uiTap");
                    }}
                    style={({ pressed }) => [
                      styles.avatarConfirmCancelButton,
                      savingAvatarId !== null && styles.avatarConfirmButtonDisabled,
                      pressed && savingAvatarId === null && styles.pressed
                    ]}
                  >
                    <Text style={styles.avatarConfirmCancelText}>CANCEL</Text>
                  </Pressable>
                  <Pressable
                    disabled={savingAvatarId !== null}
                    onPress={() => void handleUnlockPremiumAvatar(premiumAvatarPurchaseDraft)}
                    style={({ pressed }) => [
                      styles.avatarConfirmUnlockButton,
                      savingAvatarId !== null && styles.avatarConfirmButtonDisabled,
                      pressed && savingAvatarId === null && styles.pressed
                    ]}
                  >
                    <Ionicons color="#ffffff" name="lock-open" size={15} />
                    <Text style={styles.avatarConfirmUnlockText}>
                      {savingAvatarId === premiumAvatarPurchaseDraft.id ? "UNLOCKING" : "UNLOCK"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </Modal>

        <View style={[styles.mainPane, activeTab === "shop" && styles.shopMainPane, activeTab === "profile" && styles.profileMainPane]}>
          {activeTab === "play" ? (
            <View style={[styles.tabPane, styles.playPane]}>
              <HomePlayBackdrop />

              <View style={styles.wordmarkWrap}>
                <View style={styles.wordmark}>
                  {titleLetterRows.map((row, rowIndex) => (
                    <View key={`title-row-${rowIndex}`} style={styles.wordRow}>
                      {row.map((item, index) => (
                        <View key={`${item.letter}-${rowIndex}-${index}`} style={[styles.wordBubble, { backgroundColor: item.accent }]}>
                          <Text style={styles.wordBubbleText}>{item.letter}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.modeStack}>
                <ModeTile
                  accent={colors.practice}
                  compact
                  icon="person-outline"
                  onPress={() => {
                    void navigateToGameMode("/single-player");
                  }}
                  rightAccessory={
                    <View style={styles.modeBestCard}>
                      <View style={styles.modeBestTop}>
                        <Text style={styles.modeBestLabel}>BEST</Text>
                      </View>
                      <View style={styles.modeBestBottom}>
                        <Text style={styles.modeBestValue}>{singlePlayerBestScore}</Text>
                      </View>
                    </View>
                  }
                  style={styles.homeModeTile}
                  subtitle="Endless Mode"
                  title="Single Player"
                />
                <ModeTile
                  accent={colors.ai}
                  compact
                  icon="hardware-chip-outline"
                  onPress={() => {
                    void navigateToGameMode("/vs-ai");
                  }}
                  rightAccessory={
                    <View style={styles.modeBestCard}>
                      <View style={styles.modeBestTop}>
                        <Text style={styles.modeBestLabel}>WINS</Text>
                      </View>
                      <View style={styles.modeBestBottom}>
                        <Text style={styles.modeBestValue}>{aiWins}</Text>
                      </View>
                    </View>
                  }
                  style={styles.homeModeTile}
                  subtitle="Battle Mode"
                  title="VS AI"
                />
                <ModeTile
                  accent={colors.online}
                  compact
                  icon="globe-outline"
                  onPress={() => {
                    void navigateToGameMode("/online");
                  }}
                  rightAccessory={<OnlineVsBadge />}
                  style={styles.homeModeTile}
                  subtitle="Ranked Match"
                  title="Online"
                />
              </View>

              <Pressable
                onPress={() => {
                  void navigateToGameMode("/daily-puzzle");
                }}
                style={({ pressed }) => [styles.dailyCard, pressed && styles.pressed]}
              >
                <View style={styles.dailyCopy}>
                  <Text style={styles.dailyTitle}>Daily Puzzle</Text>
                </View>
                <View style={styles.dailyDateWrap}>
                  <View style={styles.dailyDateInner}>
                    <View style={styles.dailyCalendarTop}>
                      <View style={styles.dailyCalendarRingLeft} />
                      <View style={styles.dailyCalendarRingRight} />
                      <Text style={styles.dailyDateMonth}>{dailyMonth}</Text>
                    </View>
                    <View style={styles.dailyCalendarBottom}>
                      <Text style={styles.dailyDateDay}>{dailyDay}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.dailyCardGhost} />
              </Pressable>
            </View>
          ) : null}

          {activeTab === "stats" ? (
            <View style={styles.tabPane}>
              <View style={styles.panelRow}>
                <View style={styles.panelWide}>
                  <Text style={styles.panelTitle}>Daily Reward</Text>
                  <Text style={styles.panelValue}>{lastClaimedToday ? "Claimed Today" : `Day ${profile.dailyReward.streakDays + 1}`}</Text>
                  <PrimaryButton
                    disabled={lastClaimedToday}
                    label={lastClaimedToday ? "CLAIMED" : "CLAIM REWARD"}
                    loading={isClaimingReward}
                    onPress={handleClaimDailyReward}
                  />
                </View>

                <View style={styles.panelMiniColumn}>
                  <View style={styles.panelMini}>
                    <Text style={styles.panelMiniLabel}>Match</Text>
                    <Text style={[styles.panelMiniValue, { color: colors.accent }]}>
                      {latestMatch ? latestMatch.outcome : "Ready"}
                    </Text>
                  </View>
                  <View style={styles.panelMini}>
                    <Text style={styles.panelMiniLabel}>Rank</Text>
                    <Text style={[styles.panelMiniValue, { color: colors.danger }]}>
                      {playerRank ? `#${playerRank}` : "--"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>Recent Match</Text>
                <Text style={styles.panelValue}>
                  {latestMatch
                    ? `${latestMatch.outcome.toUpperCase()}  +${latestMatch.points}`
                    : "No matches yet"}
                </Text>
                <Text style={styles.panelSubtext}>
                  {latestMatch
                    ? `${formatDuration(latestMatch.durationMs)}  ${latestMatch.difficulty}`
                    : "Play any mode to record your first run."}
                </Text>
              </View>

              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>Leaderboard</Text>
                {leaderboard.slice(0, 3).map((entry) => (
                  <View key={entry.id} style={styles.leaderRow}>
                    <Text style={styles.leaderRank}>#{entry.rank}</Text>
                    <Text numberOfLines={1} style={styles.leaderName}>{entry.name}</Text>
                    <Text style={styles.leaderPoints}>{entry.points}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {activeTab === "shop" ? (
            <ShopTab />
          ) : null}

          {activeTab === "profile" ? (
            <ScrollView
              contentContainerStyle={[
                styles.profileScrollContent,
                { paddingHorizontal: profileContentInset }
              ]}
              showsVerticalScrollIndicator={false}
              style={styles.profileScroll}
            >
              <View style={[styles.profileHeroShell, { minHeight: profileHeroShellMinHeight, width: profileContentWidth }]}>
                <Text style={styles.profileRouteTitle}>YOUR PROFILE</Text>

                <View style={styles.profileHeroHeaderRow}>
                  <Pressable
                    accessibilityLabel="Back"
                    accessibilityRole="button"
                    hitSlop={10}
                    onPress={handleReturnHome}
                    style={({ pressed }) => [styles.profileHeroBackButton, pressed && styles.pressed]}
                  >
                    <Ionicons color={colors.text} name="arrow-back" size={21} />
                  </Pressable>
                  <HeaderCoinsPill coins={profile.coins} />
                </View>

                <View
                  style={[
                    styles.profileHeroCard,
                    {
                      minHeight: profileHeroCardMinHeight,
                      paddingHorizontal: isProfileCompact ? spacing.sm : spacing.md,
                      paddingTop: profileHeroCardPaddingTop
                    }
                  ]}
                >
                  <View
                    pointerEvents="none"
                    style={[
                      styles.profileHeroAvatarWrap,
                      {
                        height: profileHeroAvatarSize,
                        top: -(profileHeroAvatarSize * 0.5)
                      }
                    ]}
                  >
                    <View style={[styles.profileHeroShadow, { width: profileHeroAvatarSize * 0.62 }]} />
                    <View
                      style={[
                        styles.profileHeroAvatar,
                        {
                          backgroundColor: selectedAvatar.background,
                          borderColor: selectedAvatar.ring,
                          height: profileHeroAvatarSize,
                          width: profileHeroAvatarSize
                        }
                      ]}
                    >
                      <Image
                        accessibilityIgnoresInvertColors
                        fadeDuration={120}
                        resizeMode="cover"
                        source={{ cache: "force-cache", uri: selectedAvatar.imageUrl }}
                        style={styles.profileHeroAvatarImage}
                      />
                    </View>
                  </View>

                  <Text
                    numberOfLines={1}
                    style={[
                      styles.profileHeroName,
                      {
                        fontSize: profileHeroNameFontSize,
                        lineHeight: profileHeroNameFontSize + 4
                      }
                    ]}
                  >
                    {displayName}
                  </Text>

                  <View style={[styles.profileHeroProgressCluster, { paddingHorizontal: profileHeroProgressPadding }]}>
                    <View
                      style={[
                        styles.profileHeroLevelBurst,
                        {
                          height: profileHeroLevelBadgeSize,
                          width: profileHeroLevelBadgeSize
                        }
                      ]}
                    >
                      <Svg height="100%" style={styles.profileHeroLevelBurstSvg} viewBox="0 0 100 100" width="100%">
                        <Defs>
                          <LinearGradient id="profileLevelStarGradient" x1="0" x2="1" y1="0" y2="1">
                            <Stop offset="0" stopColor="#8de7ff" />
                            <Stop offset="0.5" stopColor="#4dbcf4" />
                            <Stop offset="1" stopColor="#2384d1" />
                          </LinearGradient>
                        </Defs>
                        <Polygon
                          fill="url(#profileLevelStarGradient)"
                          points="50,4 61,23 83,17 77,39 96,50 77,61 83,83 61,77 50,96 39,77 17,83 23,61 4,50 23,39 17,17 39,23"
                          stroke="#287fc2"
                          strokeLinejoin="round"
                          strokeWidth={7}
                        />
                        <SvgText
                          fill={colors.surface}
                          fontSize={23}
                          fontWeight="600"
                          textAnchor="middle"
                          x={50}
                          y={58}
                        >
                          {profile.level}
                        </SvgText>
                      </Svg>
                    </View>

                    <View style={styles.profileHeroProgressTrack}>
                      <View
                        style={[
                          styles.profileHeroProgressFill,
                          { width: `${Math.max(12, Math.round(levelProgress * 100))}%` }
                        ]}
                      >
                        <View style={styles.profileHeroProgressFillGloss} />
                      </View>
                      <View pointerEvents="none" style={styles.profileHeroProgressTrackGloss} />
                      <Text style={styles.profileHeroProgressValue}>{levelXpEarned}/{levelXpSpan}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.profileSectionBar, { marginLeft: -profileContentInset, width: screenWidth }]}>
                <View style={[styles.profileSectionTabs, { marginLeft: profileContentInset, width: profileContentWidth }]}>
                  {(["stats", "profile"] as const).map((section) => {
                    const isActive = profileSection === section;

                    return (
                      <Pressable
                        key={section}
                        onPress={() => {
                          if (section === "stats") {
                            router.replace("/stats");
                            return;
                          }

                          router.replace("/profile");
                        }}
                        style={({ pressed }) => [
                          styles.profileSectionTab,
                          isActive && styles.profileSectionTabActive,
                          pressed && styles.pressed
                        ]}
                      >
                        <Text style={[styles.profileSectionTabText, isActive && styles.profileSectionTabTextActive]}>
                          {section === "stats" ? "STATS" : "PROFILE"}
                        </Text>
                        {section === "profile" ? (
                          <View style={styles.profileSectionTabIcon}>
                            <Ionicons color={colors.surface} name="pencil" size={10} />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {profileSection === "stats" ? (
                <View style={[styles.profileStatsPanel, { width: profileContentWidth }]}>
                  <View style={styles.profileStatsSimpleLeaderboardCard}>
                    <View style={styles.profileStatsSimpleHeader}>
                      <View>
                        <Text style={styles.profileStatsSimpleEyebrow}>Leaderboard</Text>
                        <Text style={styles.profileStatsSimpleTitle}>Global rankings</Text>
                      </View>
                      <View style={styles.profileStatsSimpleRankPill}>
                        <Text style={styles.profileStatsSimpleRankText}>{playerRank ? `#${playerRank}` : "Unranked"}</Text>
                      </View>
                    </View>

                    {leaderboardRows.length > 0 ? (
                      <View style={styles.profileStatsSimpleRows}>
                        {leaderboardRows.map((entry) => {
                          const isPlayerRow = Boolean(entry.isPlayer);
                          const leaderboardAvatar =
                            profileAvatarById.get(entry.avatarId ?? DEFAULT_AVATAR_ID) ??
                            profileAvatarById.get(DEFAULT_AVATAR_ID) ??
                            profileAvatarOptions[0];
                          const isTopRank = entry.rank === 1 || entry.rank === 2 || entry.rank === 3;

                          return (
                            <View
                              key={entry.id}
                              style={[
                                styles.profileStatsSimpleRow,
                                isPlayerRow && styles.profileStatsSimpleRowPlayer
                              ]}
                            >
                              <View style={styles.profileStatsSimpleRankSlot}>
                                {isTopRank ? (
                                  <RankMedal rank={entry.rank} size={42} />
                                ) : (
                                  <Text
                                    style={[
                                      styles.profileStatsSimpleRank,
                                      isPlayerRow && styles.profileStatsSimpleRankPlayer
                                    ]}
                                  >
                                    #{entry.rank}
                                  </Text>
                                )}
                              </View>
                              <View
                                style={[
                                  styles.profileStatsSimpleAvatarFrame,
                                  {
                                    backgroundColor: leaderboardAvatar.background,
                                    borderColor: isPlayerRow ? colors.accent : leaderboardAvatar.ring
                                  }
                                ]}
                              >
                                <Image
                                  accessibilityIgnoresInvertColors
                                  resizeMode="contain"
                                  source={{ cache: "force-cache", uri: leaderboardAvatar.imageUrl }}
                                  style={styles.profileStatsSimpleAvatarImage}
                                />
                              </View>
                              <View style={styles.profileStatsSimplePlayerCopy}>
                                <Text
                                  numberOfLines={1}
                                  style={[styles.profileStatsSimpleName, isPlayerRow && styles.profileStatsSimpleTextPlayer]}
                                >
                                  {isPlayerRow ? displayName : entry.name}
                                </Text>
                              </View>
                              <Text style={[styles.profileStatsSimpleScore, isPlayerRow && styles.profileStatsSimpleTextPlayer]}>
                                {entry.points.toLocaleString("en-US")}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={styles.profileStatsSimpleEmpty}>
                        <Text style={styles.profileStatsSimpleEmptyText}>Play once to appear on the leaderboard.</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.profileStatsWordleCard}>
                    <View style={styles.profileStatsWordleHeader}>
                      <View>
                        <Text style={styles.profileStatsWordleEyebrow}>My Stats</Text>
                        <Text style={styles.profileStatsWordleTitle}>Performance</Text>
                      </View>
                      <View style={styles.profileStatsWordlePill}>
                        <Text style={styles.profileStatsWordlePillText}>All modes</Text>
                      </View>
                    </View>

                    <View style={styles.profileStatsWordleSummary}>
                      {profileStatsSummary.map((stat) => (
                        <View
                          key={stat.label}
                          style={[
                            styles.profileStatsWordleStat,
                            {
                              backgroundColor: `${stat.accent}16`,
                              borderColor: `${stat.accent}55`
                            }
                          ]}
                        >
                          <Text numberOfLines={1} style={[styles.profileStatsWordleStatValue, { color: stat.accent }]}>
                            {stat.value}
                          </Text>
                          <Text numberOfLines={1} style={styles.profileStatsWordleStatLabel}>{stat.label}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.profileStatsDistributionStack}>
                      {distributionCards.map((card) => (
                        <View
                          key={card.key}
                          style={[
                            styles.profileStatsDistributionCard,
                            {
                              backgroundColor: `${card.accent}10`,
                              borderColor: `${card.accent}44`
                            }
                          ]}
                        >
                          <View style={styles.profileStatsDistributionHeader}>
                            <View style={styles.profileStatsDistributionTitleWrap}>
                              <Text style={[styles.profileStatsDistributionEyebrow, { color: card.accent }]}>{card.subtitle}</Text>
                              <Text style={styles.profileStatsDistributionTitle}>{card.title}</Text>
                            </View>
                            <View
                              style={[
                                styles.profileStatsDistributionPill,
                                {
                                  backgroundColor: card.accent,
                                  borderColor: card.accent
                                }
                              ]}
                            >
                              <Text style={styles.profileStatsDistributionPillText}>
                                {card.distribution.avgGuesses > 0
                                  ? `${card.distribution.avgGuesses.toFixed(1)} avg`
                                  : "0 avg"}
                              </Text>
                            </View>
                          </View>

                          {card.difficulty ? (
                            <ScrollView
                              contentContainerStyle={styles.profileStatsWordleTabsContent}
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              style={styles.profileStatsWordleTabs}
                            >
                              {statsDifficultyFilters.map((difficulty) => {
                                const isSelected = card.difficulty.key === difficulty.key;

                                return (
                                  <Pressable
                                    key={`${card.key}-${difficulty.key}`}
                                    onPress={() => {
                                      setStatsDistributionDifficulties((current) => ({
                                        ...current,
                                        [card.key as StatsDistributionModeKey]: difficulty.key
                                      }));
                                    }}
                                    style={[
                                      styles.profileStatsWordleTab,
                                      isSelected && {
                                        backgroundColor: card.accent,
                                        borderColor: card.accent
                                      }
                                    ]}
                                  >
                                    <Text style={[styles.profileStatsWordleTabText, isSelected && styles.profileStatsWordleTabTextActive]}>
                                      {difficulty.label}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </ScrollView>
                          ) : null}

                          <View style={styles.profileStatsGuessHeaderCompact}>
                            <Text style={styles.profileStatsGuessTitle}>Guess Distribution</Text>
                            <Text style={[styles.profileStatsGuessMeta, { color: card.accent }]}>
                              {card.bestScore.toLocaleString("en-US")} best
                            </Text>
                          </View>

                          <View style={styles.profileStatsGuessBars}>
                            {card.distribution.buckets.map((bucket) => (
                              <View key={`${card.key}-${bucket.label}`} style={styles.profileStatsGuessBarRow}>
                                <Text style={styles.profileStatsGuessBarLabel}>{bucket.label}</Text>
                                <View style={styles.profileStatsGuessBarTrack}>
                                  <View
                                    style={[
                                      styles.profileStatsGuessBarFill,
                                      { backgroundColor: card.accent, width: `${bucket.width}%` }
                                    ]}
                                  />
                                </View>
                                <Text style={[styles.profileStatsGuessBarValue, { color: card.accent }]}>
                                  {bucket.count}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {false ? (
                    <>
                      <Pressable
                        onPress={() => navigateToGameMode(activeGoalRoute)}
                        style={({ pressed }) => [styles.profileStatsClimbTeaser, pressed && styles.pressed]}
                      >
                        <View style={styles.profileStatsClimbTeaserIcon}>
                          <Ionicons color="#ffffff" name="podium" size={20} />
                        </View>
                        <View style={styles.profileStatsClimbTeaserCopy}>
                          <Text style={styles.profileStatsClimbTeaserEyebrow}>Next climb</Text>
                          <Text numberOfLines={2} style={styles.profileStatsClimbTeaserTitle}>{primaryChaseTitle}</Text>
                          <Text numberOfLines={1} style={styles.profileStatsClimbTeaserCaption}>
                            {nextRankEntry
                              ? "Play now while the gap is small."
                              : nextLeague
                                ? `Push toward ${nextLeague.name} with one more run.`
                                : playerLeaderboardEntry
                                  ? "Defend it with one more run today."
                                  : "Start today and give yourself a rank to defend."}
                          </Text>
                        </View>
                        <View style={styles.profileStatsClimbTeaserNeed}>
                          <Text style={styles.profileStatsClimbTeaserNeedLabel}>Need</Text>
                          <Text style={styles.profileStatsClimbTeaserNeedValue}>
                            {(nextRankEntry ? pointsToNextRank : pointsToNextLeague).toLocaleString("en-US")}
                          </Text>
                        </View>
                      </Pressable>

                      <Pressable
                        onPress={() => navigateToGameMode(coachPick.route)}
                        style={({ pressed }) => [styles.profileStatsCoachCard, pressed && styles.pressed]}
                      >
                        <View style={[styles.profileStatsCoachIcon, { backgroundColor: coachPick.accent }]}>
                          <Ionicons color="#ffffff" name={coachPick.icon} size={18} />
                        </View>
                        <View style={styles.profileStatsCoachCopy}>
                          <View style={styles.profileStatsCoachTopRow}>
                            <Text style={styles.profileStatsCoachEyebrow}>Coach&apos;s Pick</Text>
                            <Text style={[styles.profileStatsCoachAction, { color: coachPick.accent }]}>{coachPick.action}</Text>
                          </View>
                          <Text style={styles.profileStatsCoachTitle}>{coachPick.title}</Text>
                          <Text numberOfLines={2} style={styles.profileStatsCoachBody}>{coachPick.body}</Text>
                        </View>
                        <View style={styles.profileStatsCoachPill}>
                          <Text style={styles.profileStatsCoachPillText}>{coachPick.label}</Text>
                        </View>
                      </Pressable>

                      <View style={styles.profileStatsReturnCard}>
                        <View style={styles.profileStatsReturnHeader}>
                          <View style={styles.profileStatsReturnTitleWrap}>
                            <Text style={styles.profileStatsReturnEyebrow}>Return Briefing</Text>
                            <Text style={styles.profileStatsReturnTitle}>{returnBriefingTitle}</Text>
                            <Text numberOfLines={2} style={styles.profileStatsReturnCaption}>{returnBriefingCaption}</Text>
                          </View>
                          <View style={styles.profileStatsReturnScorePill}>
                            <Text style={styles.profileStatsReturnScoreValue}>{todayLoopDoneCount}/{todayLoopItems.length}</Text>
                            <Text style={styles.profileStatsReturnScoreLabel}>today</Text>
                          </View>
                        </View>

                        <View style={styles.profileStatsReturnWeek}>
                          {returnWeekDays.map((day) => (
                            <View
                              key={day.dateKey}
                              style={[
                                styles.profileStatsReturnDay,
                                day.active && styles.profileStatsReturnDayActive,
                                day.isToday && styles.profileStatsReturnDayToday
                              ]}
                            >
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.profileStatsReturnDayLabel,
                                  day.active && styles.profileStatsReturnDayLabelActive,
                                  day.isToday && styles.profileStatsReturnDayLabelToday
                                ]}
                              >
                                {day.label}
                              </Text>
                              <View
                                style={[
                                  styles.profileStatsReturnDayDot,
                                  day.active && styles.profileStatsReturnDayDotActive,
                                  day.isToday && styles.profileStatsReturnDayDotToday
                                ]}
                              />
                            </View>
                          ))}
                        </View>

                        <View style={styles.profileStatsReturnChecklist}>
                          {todayLoopItems.map((item) => (
                            <View
                              key={item.label}
                              style={[
                                styles.profileStatsReturnCheck,
                                item.done && { backgroundColor: `${item.accent}18`, borderColor: `${item.accent}55` }
                              ]}
                            >
                              <Ionicons
                                color={item.done ? item.accent : colors.textMuted}
                                name={item.done ? "checkmark-circle" : item.icon}
                                size={15}
                              />
                              <Text style={[styles.profileStatsReturnCheckText, item.done && { color: item.accent }]}>
                                {item.label}
                              </Text>
                            </View>
                          ))}
                        </View>

                        <View style={styles.profileStatsReturnFooter}>
                          <View style={styles.profileStatsReturnFooterCopy}>
                            <Text style={styles.profileStatsReturnFooterLabel}>
                              {returnWeekActiveDays}/7 active days
                            </Text>
                            <Text numberOfLines={2} style={styles.profileStatsReturnFooterText}>{comebackCaption}</Text>
                          </View>
                          <Pressable
                            onPress={() => navigateToGameMode(returnBriefingRoute)}
                            style={({ pressed }) => [styles.profileStatsReturnButton, pressed && styles.pressed]}
                          >
                            <Text style={styles.profileStatsReturnButtonText}>
                              {todayLoopOpenCount > 0 ? returnBriefingAction : "KEEP CLIMBING"}
                            </Text>
                            <Ionicons color="#ffffff" name="arrow-forward" size={14} />
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.profileStatsDigestCard}>
                        <View style={styles.profileStatsDigestHeader}>
                          <View>
                            <Text style={styles.profileStatsDigestEyebrow}>Today&apos;s Focus</Text>
                            <Text style={styles.profileStatsDigestTitle}>Care about these 3 things</Text>
                          </View>
                          <Pressable
                            onPress={() => setShowFullStats((current) => !current)}
                            style={({ pressed }) => [styles.profileStatsDigestToggle, pressed && styles.pressed]}
                          >
                            <Text style={styles.profileStatsDigestToggleText}>
                              {showFullStats ? "HIDE FULL STATS" : "SHOW FULL STATS"}
                            </Text>
                            <Ionicons color={colors.online} name={showFullStats ? "chevron-up" : "chevron-down"} size={14} />
                          </Pressable>
                        </View>

                        <View style={styles.profileStatsDigestList}>
                          {focusDigestCards.map((item) => (
                            <View key={item.label} style={styles.profileStatsDigestRow}>
                              <View style={[styles.profileStatsDigestIcon, { backgroundColor: `${item.accent}22` }]}>
                                <Ionicons color={item.accent} name={item.icon} size={16} />
                              </View>
                              <View style={styles.profileStatsDigestCopy}>
                                <Text style={styles.profileStatsDigestLabel}>{item.label}</Text>
                                <Text numberOfLines={1} style={styles.profileStatsDigestCaption}>{item.caption}</Text>
                              </View>
                              <Text style={[styles.profileStatsDigestValue, { color: item.accent }]}>{item.value}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </>
                  ) : null}

                  {showFullStats ? (
                    <>
                      <View style={styles.profileStatsHeroGrid}>
                        <View style={[styles.profileStatsHeroCard, styles.profileStatsHeroCardPrimary]}>
                          <View style={[styles.profileStatsHeroGlow, styles.profileStatsHeroGlowPrimaryA]} />
                          <View style={[styles.profileStatsHeroGlow, styles.profileStatsHeroGlowPrimaryB]} />

                          <View style={styles.profileStatsHeroTopRow}>
                            <View style={[styles.profileStatsHeroBadge, styles.profileStatsHeroBadgePrimary]}>
                              <Ionicons color={colors.accent} name="trending-up" size={16} />
                            </View>
                            <View style={styles.profileStatsHeroTag}>
                              <Text style={styles.profileStatsHeroTagText}>Overall</Text>
                            </View>
                          </View>

                          <Text style={styles.profileStatsHeroLabel}>Win Rate</Text>
                          <Text style={styles.profileStatsHeroValue}>{overallWinRate}%</Text>
                          <Text style={styles.profileStatsHeroCaption}>
                            {totalMatches > 0 ? `${profile.stats.wins} wins in ${totalMatches} matches` : "Start playing to build your record"}
                          </Text>

                          <View style={styles.profileStatsHeroMeterTrack}>
                            <View
                              style={[
                                styles.profileStatsHeroMeterFill,
                                styles.profileStatsHeroMeterFillPrimary,
                                { width: `${Math.max(overallWinRate > 0 ? 12 : 0, overallWinRate)}%` }
                              ]}
                            />
                          </View>
                        </View>

                        <View style={[styles.profileStatsHeroCard, styles.profileStatsHeroCardAccent]}>
                          <View style={[styles.profileStatsHeroGlow, styles.profileStatsHeroGlowAccentA]} />
                          <View style={[styles.profileStatsHeroGlow, styles.profileStatsHeroGlowAccentB]} />

                          <View style={styles.profileStatsHeroTopRow}>
                            <View style={[styles.profileStatsHeroBadge, styles.profileStatsHeroBadgeAccent]}>
                              <Ionicons color="#0f5f87" name="flame" size={16} />
                            </View>
                            <View style={styles.profileStatsHeroTag}>
                              <Text style={styles.profileStatsHeroTagText}>Live</Text>
                            </View>
                          </View>

                          <Text style={styles.profileStatsHeroLabel}>Current Streak</Text>
                          <Text style={styles.profileStatsHeroValue}>{profile.currentWinStreak}</Text>
                          <Text style={styles.profileStatsHeroCaption}>{streakCaption}</Text>

                          <View style={styles.profileStatsHeroMeterTrack}>
                            <View
                              style={[
                                styles.profileStatsHeroMeterFill,
                                styles.profileStatsHeroMeterFillAccent,
                                { width: `${streakProgressPercent}%` }
                              ]}
                            />
                          </View>
                        </View>

                        <View style={[styles.profileStatsMiniRow, isProfileCompact && styles.profileStatsMiniRowCompact]}>
                          <View style={[styles.profileStatsMiniCard, styles.profileStatsMiniCardWarm]}>
                            <View style={styles.profileStatsMiniTopRow}>
                              <View style={[styles.profileStatsMiniBadge, styles.profileStatsMiniBadgeWarm]}>
                                <Ionicons color="#8a5e00" name="trophy" size={14} />
                              </View>
                            </View>
                            <Text style={styles.profileStatsMiniLabel}>Best Streak</Text>
                            <Text style={styles.profileStatsMiniValue}>{profile.bestWinStreak}</Text>
                            <Text style={styles.profileStatsMiniCaption}>Personal best</Text>
                          </View>

                          <View style={[styles.profileStatsMiniCard, styles.profileStatsMiniCardCool]}>
                            <View style={styles.profileStatsMiniTopRow}>
                              <View style={[styles.profileStatsMiniBadge, styles.profileStatsMiniBadgeCool]}>
                                <Ionicons color="#1f74b0" name="podium" size={14} />
                              </View>
                            </View>
                            <Text style={styles.profileStatsMiniLabel}>Rank</Text>
                            <Text style={styles.profileStatsMiniValue}>{playerRank ? `#${playerRank}` : "--"}</Text>
                            <Text style={styles.profileStatsMiniCaption}>{playerRank ? "Global climb board" : "Play ranked to place"}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.profileStatsMomentumCard}>
                        <View style={styles.profileStatsMomentumHeader}>
                          <View>
                            <Text style={styles.profileStatsMomentumEyebrow}>Today&apos;s Momentum</Text>
                            <Text style={styles.profileStatsMomentumTitle}>Your climb is moving</Text>
                          </View>
                          <View style={styles.profileStatsMomentumLivePill}>
                            <Text style={styles.profileStatsMomentumLiveText}>Live</Text>
                          </View>
                        </View>

                        <View style={styles.profileStatsMomentumList}>
                          {momentumCards.map((card) => (
                            <View key={card.title} style={styles.profileStatsMomentumRow}>
                              <View style={[styles.profileStatsMomentumIcon, { backgroundColor: `${card.accent}22` }]}>
                                <Ionicons color={card.accent} name={card.icon} size={16} />
                              </View>
                              <View style={styles.profileStatsMomentumCopy}>
                                <Text style={styles.profileStatsMomentumRowTitle}>{card.title}</Text>
                                <Text style={styles.profileStatsMomentumCaption}>{card.caption}</Text>
                              </View>
                              <Text style={[styles.profileStatsMomentumValue, { color: card.accent }]}>{card.label}</Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      <View style={styles.profileStatsSprintCard}>
                        <View style={styles.profileStatsSprintHeader}>
                          <View>
                            <Text style={styles.profileStatsSprintEyebrow}>7-Day Sprint</Text>
                            <Text style={styles.profileStatsSprintTitle}>
                              {sprintPointsNeeded > 0
                                ? `${sprintPointsNeeded.toLocaleString("en-US")} pts left this week`
                                : "Sprint cleared"}
                            </Text>
                            <Text style={styles.profileStatsSprintCaption}>{sprintCaption}</Text>
                          </View>
                          <View style={styles.profileStatsSprintBadge}>
                            <Text style={styles.profileStatsSprintBadgeValue}>{sevenDayActiveDays}/{sprintDayTarget}</Text>
                            <Text style={styles.profileStatsSprintBadgeLabel}>days</Text>
                          </View>
                        </View>

                        <View style={styles.profileStatsSprintTrack}>
                          <View style={[styles.profileStatsSprintFill, { width: `${sprintProgressPercent}%` }]} />
                        </View>

                        <View style={styles.profileStatsSprintStats}>
                          <View style={styles.profileStatsSprintStat}>
                            <Text style={styles.profileStatsSprintStatLabel}>Points</Text>
                            <Text style={styles.profileStatsSprintStatValue}>{sevenDayPoints.toLocaleString("en-US")}</Text>
                          </View>
                          <View style={styles.profileStatsSprintStat}>
                            <Text style={styles.profileStatsSprintStatLabel}>Target</Text>
                            <Text style={styles.profileStatsSprintStatValue}>{sprintPointTarget.toLocaleString("en-US")}</Text>
                          </View>
                          <View style={styles.profileStatsSprintStat}>
                            <Text style={styles.profileStatsSprintStatLabel}>Habit</Text>
                            <Text style={styles.profileStatsSprintStatValue}>
                              {sprintDaysNeeded > 0 ? `${sprintDaysNeeded}d left` : "Locked"}
                            </Text>
                          </View>
                        </View>

                        <Pressable
                          onPress={() => navigateToGameMode("/daily-puzzle")}
                          style={({ pressed }) => [styles.profileStatsSprintButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.profileStatsSprintButtonText}>
                            {sprintDaysNeeded > 0 ? "LOCK TODAY'S DAY" : "ADD SPRINT POINTS"}
                          </Text>
                          <Ionicons color="#ffffff" name="calendar" size={15} />
                        </Pressable>
                      </View>

                      <View style={styles.profileStatsLeagueCard}>
                        <View style={styles.profileStatsLeagueHeader}>
                          <View style={[styles.profileStatsLeagueBadge, { backgroundColor: currentLeague.accent }]}>
                            <Ionicons color="#ffffff" name={currentLeague.icon} size={22} />
                          </View>
                          <View style={styles.profileStatsLeagueCopy}>
                            <Text style={styles.profileStatsLeagueEyebrow}>Climb League</Text>
                            <Text style={styles.profileStatsLeagueTitle}>{currentLeague.name}</Text>
                            <Text style={styles.profileStatsLeagueCaption}>
                              {nextLeague
                                ? `${pointsToNextLeague.toLocaleString("en-US")} pts until ${nextLeague.name}.`
                                : "Final tier reached. Every run now extends your legacy score."}
                            </Text>
                          </View>
                          <View style={styles.profileStatsLeagueScorePill}>
                            <Text style={styles.profileStatsLeagueScoreLabel}>Score</Text>
                            <Text style={styles.profileStatsLeagueScoreValue}>{climbScore.toLocaleString("en-US")}</Text>
                          </View>
                        </View>

                        <View style={styles.profileStatsLeagueTrack}>
                          <View
                            style={[
                              styles.profileStatsLeagueFill,
                              { backgroundColor: nextLeague?.accent ?? currentLeague.accent, width: `${leagueProgressPercent}%` }
                            ]}
                          />
                        </View>

                        <View style={styles.profileStatsLeagueSteps}>
                          {climbLeagueConfig.map((league) => {
                            const isUnlocked = climbScore >= league.floor;
                            const isCurrent = league.name === currentLeague.name;

                            return (
                              <View key={league.name} style={styles.profileStatsLeagueStep}>
                                <View
                                  style={[
                                    styles.profileStatsLeagueStepDot,
                                    {
                                      backgroundColor: isUnlocked ? league.accent : "#d7dddd",
                                      transform: [{ scale: isCurrent ? 1.18 : 1 }]
                                    }
                                  ]}
                                />
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.profileStatsLeagueStepLabel,
                                    isCurrent && { color: league.accent }
                                  ]}
                                >
                                  {league.name}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.profileStatsRunPlanCard}>
                        <View style={styles.profileStatsRunPlanHeader}>
                          <View>
                            <Text style={styles.profileStatsRunPlanEyebrow}>Run Plan</Text>
                            <Text style={styles.profileStatsRunPlanTitle}>
                              {estimatedRunsToTarget === 1
                                ? `${activeTargetName} is one run away`
                                : `${estimatedRunsToTarget} runs to ${activeTargetName}`}
                            </Text>
                            <Text style={styles.profileStatsRunPlanCaption}>
                              {recentMatches.length > 0
                                ? `Based on your ${recentAveragePoints.toLocaleString("en-US")} pt recent pace.`
                                : "Starter pace shown until you record match history."}
                            </Text>
                          </View>
                          <View style={styles.profileStatsRunPlanPace}>
                            <Text style={styles.profileStatsRunPlanPaceLabel}>Pace</Text>
                            <Text style={styles.profileStatsRunPlanPaceValue}>{recentAveragePoints.toLocaleString("en-US")}</Text>
                          </View>
                        </View>

                        <View style={styles.profileStatsRunPlanRows}>
                          {runPlanRows.map((row) => {
                            const remaining = Math.max(0, activeTargetNeed - row.projected);
                            const hitsTarget = remaining <= 0;

                            return (
                              <View
                                key={`${row.label}-${row.runs}`}
                                style={[styles.profileStatsRunPlanRow, hitsTarget && styles.profileStatsRunPlanRowHit]}
                              >
                                <View style={styles.profileStatsRunPlanRowLeft}>
                                  <Text style={styles.profileStatsRunPlanRowLabel}>{row.label}</Text>
                                  <Text style={styles.profileStatsRunPlanRowMeta}>
                                    {row.runs} {row.runs === 1 ? "run" : "runs"} · +{row.projected.toLocaleString("en-US")} pts
                                  </Text>
                                </View>
                                <Text style={[styles.profileStatsRunPlanRowResult, hitsTarget && styles.profileStatsRunPlanRowResultHit]}>
                                  {hitsTarget ? "Target likely" : `${remaining.toLocaleString("en-US")} left`}
                                </Text>
                              </View>
                            );
                          })}
                        </View>

                        <Pressable
                          onPress={() => navigateToGameMode(activeGoalRoute)}
                          style={({ pressed }) => [styles.profileStatsRunPlanButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.profileStatsRunPlanButtonText}>START THIS PLAN</Text>
                          <Ionicons color="#ffffff" name="play" size={15} />
                        </Pressable>
                      </View>

                      <View style={styles.profileStatsRewardCard}>
                        <View style={styles.profileStatsRewardHeader}>
                          <View>
                            <Text style={styles.profileStatsRewardEyebrow}>Reward Trail</Text>
                            <Text style={styles.profileStatsRewardTitle}>What the next push unlocks</Text>
                          </View>
                          <View style={styles.profileStatsRewardCountPill}>
                            <Text style={styles.profileStatsRewardCountText}>{rewardTrailCards.length} goals</Text>
                          </View>
                        </View>

                        <View style={styles.profileStatsRewardGrid}>
                          {rewardTrailCards.map((reward) => (
                            <View key={reward.title} style={styles.profileStatsRewardItem}>
                              <View style={[styles.profileStatsRewardIcon, { backgroundColor: `${reward.accent}22` }]}>
                                <Ionicons color={reward.accent} name={reward.icon} size={17} />
                              </View>
                              <View style={styles.profileStatsRewardCopy}>
                                <View style={styles.profileStatsRewardTitleRow}>
                                  <Text numberOfLines={1} style={styles.profileStatsRewardItemTitle}>{reward.title}</Text>
                                  <Text style={[styles.profileStatsRewardLabel, { color: reward.accent }]}>{reward.label}</Text>
                                </View>
                                <Text numberOfLines={2} style={styles.profileStatsRewardCaption}>{reward.caption}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>

                      <View style={styles.profileStatsRivalCard}>
                        <View style={styles.profileStatsRivalHeader}>
                          <View>
                            <Text style={styles.profileStatsRivalEyebrow}>Rival Watch</Text>
                            <Text style={styles.profileStatsRivalTitle}>
                              {nextRankEntry
                                ? `${nextRankEntry.name} is in reach`
                                : closestChaserEntry
                                  ? chaserIsClose
                                    ? `${closestChaserEntry.name} is chasing`
                                    : "Lead is safe for now"
                                  : "Own the board before rivals arrive"}
                            </Text>
                          </View>
                          <View style={styles.profileStatsRivalRankPill}>
                            <Text style={styles.profileStatsRivalRankText}>{playerRank ? `#${playerRank}` : "Unranked"}</Text>
                          </View>
                        </View>

                        <View style={styles.profileStatsRivalRows}>
                          {rivalryCards.map((rival) => (
                            <View key={rival.title} style={styles.profileStatsRivalRow}>
                              <View style={[styles.profileStatsRivalIcon, { backgroundColor: `${rival.accent}22` }]}>
                                <Ionicons color={rival.accent} name={rival.icon} size={17} />
                              </View>
                              <View style={styles.profileStatsRivalCopy}>
                                <Text style={styles.profileStatsRivalRowLabel}>{rival.title}</Text>
                                <Text numberOfLines={1} style={styles.profileStatsRivalName}>{rival.name}</Text>
                                <Text numberOfLines={2} style={styles.profileStatsRivalCaption}>{rival.caption}</Text>
                              </View>
                              <Text style={[styles.profileStatsRivalBadge, { color: rival.accent }]}>{rival.label}</Text>
                            </View>
                          ))}
                        </View>

                        <Pressable
                          onPress={() => navigateToGameMode(activeGoalRoute)}
                          style={({ pressed }) => [styles.profileStatsRivalButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.profileStatsRivalButtonText}>
                            {nextRankEntry ? "CHASE THIS RIVAL" : "BUILD THE GAP"}
                          </Text>
                          <Ionicons color="#ffffff" name="arrow-forward" size={15} />
                        </Pressable>
                      </View>

                      <View style={styles.profileStatsChaseCard}>
                        <View style={styles.profileStatsChaseHeader}>
                          <View style={styles.profileStatsChaseIcon}>
                            <Ionicons color="#ffffff" name="podium" size={22} />
                          </View>
                          <View style={styles.profileStatsChaseCopy}>
                            <Text style={styles.profileStatsChaseEyebrow}>Leaderboard Chase</Text>
                            <Text style={styles.profileStatsChaseTitle}>{primaryChaseTitle}</Text>
                            <Text style={styles.profileStatsChaseCaption}>{primaryChaseCaption}</Text>
                          </View>
                        </View>

                        <View style={styles.profileStatsChaseMeterTrack}>
                          <View style={[styles.profileStatsChaseMeterFill, { width: `${chaseProgressPercent}%` }]} />
                        </View>

                        <View style={styles.profileStatsChaseStats}>
                          <View style={styles.profileStatsChaseStat}>
                            <Text style={styles.profileStatsChaseStatLabel}>Your score</Text>
                            <Text style={styles.profileStatsChaseStatValue}>{climbScore.toLocaleString("en-US")}</Text>
                          </View>
                          <View style={styles.profileStatsChaseStat}>
                            <Text style={styles.profileStatsChaseStatLabel}>Target</Text>
                            <Text style={styles.profileStatsChaseStatValue}>
                              {nextRankEntry ? `#${nextRankEntry.rank}` : nextLeague?.name ?? "Mythic+"}
                            </Text>
                          </View>
                          <View style={styles.profileStatsChaseStat}>
                            <Text style={styles.profileStatsChaseStatLabel}>Need</Text>
                            <Text style={styles.profileStatsChaseStatValue}>
                              {(nextRankEntry ? pointsToNextRank : pointsToNextLeague).toLocaleString("en-US")}
                            </Text>
                          </View>
                        </View>

                        {leaderboardRows.length > 0 ? (
                          <View style={styles.profileStatsLeaderboardList}>
                            {leaderboardRows.map((entry) => {
                              const isPlayerRow = Boolean(entry.isPlayer);

                              return (
                                <View
                                  key={entry.id}
                                  style={[styles.profileStatsLeaderboardRow, isPlayerRow && styles.profileStatsLeaderboardRowPlayer]}
                                >
                                  <Text style={[styles.profileStatsLeaderboardRank, isPlayerRow && styles.profileStatsLeaderboardTextPlayer]}>
                                    #{entry.rank}
                                  </Text>
                                  <View style={[styles.profileStatsLeaderboardAvatar, isPlayerRow && styles.profileStatsLeaderboardAvatarPlayer]}>
                                    <Text style={[styles.profileStatsLeaderboardAvatarText, isPlayerRow && styles.profileStatsLeaderboardTextPlayer]}>
                                      {entry.name.slice(0, 1).toUpperCase()}
                                    </Text>
                                  </View>
                                  <View style={styles.profileStatsLeaderboardCopy}>
                                    <View style={styles.profileStatsLeaderboardNameRow}>
                                      <Text
                                        numberOfLines={1}
                                        style={[styles.profileStatsLeaderboardName, isPlayerRow && styles.profileStatsLeaderboardTextPlayer]}
                                      >
                                        {isPlayerRow ? displayName : entry.name}
                                      </Text>
                                      {isPlayerRow ? (
                                        <View style={styles.profileStatsLeaderboardYouPill}>
                                          <Text style={styles.profileStatsLeaderboardYouText}>You</Text>
                                        </View>
                                      ) : null}
                                    </View>
                                    <Text style={[styles.profileStatsLeaderboardMeta, isPlayerRow && styles.profileStatsLeaderboardMetaPlayer]}>
                                      Level {entry.level} · {entry.streak} streak
                                    </Text>
                                  </View>
                                  <Text style={[styles.profileStatsLeaderboardPoints, isPlayerRow && styles.profileStatsLeaderboardTextPlayer]}>
                                    {entry.points.toLocaleString("en-US")}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        ) : (
                          <View style={styles.profileStatsLeaderboardEmpty}>
                            <Ionicons color={colors.textMuted} name="rocket-outline" size={18} />
                            <Text style={styles.profileStatsLeaderboardEmptyText}>
                              No public rank yet. One ranked match turns this into your climb board.
                            </Text>
                          </View>
                        )}

                        <Pressable
                          onPress={() => navigateToGameMode(activeGoalRoute)}
                          style={({ pressed }) => [styles.profileStatsChaseButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.profileStatsChaseButtonText}>
                            {nextRankEntry ? "PLAY TO OVERTAKE" : playerLeaderboardEntry ? "DEFEND RANK TODAY" : "ENTER LEADERBOARD"}
                          </Text>
                          <Ionicons color="#ffffff" name="arrow-forward" size={17} />
                        </Pressable>
                      </View>

                      <View style={styles.profileStatsMissionGrid}>
                        {missionCards.map((mission) => (
                          <Pressable
                            key={mission.title}
                            onPress={() => navigateToGameMode(mission.route)}
                            style={({ pressed }) => [styles.profileStatsMissionCard, pressed && styles.pressed]}
                          >
                            <View style={styles.profileStatsMissionHeader}>
                              <View style={[styles.profileStatsMissionIcon, { backgroundColor: `${mission.accent}22` }]}>
                                <Ionicons color={mission.accent} name={mission.icon} size={16} />
                              </View>
                              <Text style={[styles.profileStatsMissionAction, { color: mission.accent }]}>{mission.action}</Text>
                            </View>
                            <Text style={styles.profileStatsMissionTitle}>{mission.title}</Text>
                            <Text style={styles.profileStatsMissionCaption}>{mission.caption}</Text>
                            <View style={styles.profileStatsMissionTrack}>
                              <View
                                style={[
                                  styles.profileStatsMissionFill,
                                  { backgroundColor: mission.accent, width: `${mission.progress}%` }
                                ]}
                              />
                            </View>
                          </Pressable>
                        ))}
                      </View>

                      <View style={styles.profileStatsFeatureCard}>
                        <View style={[styles.profileStatsSectionHeader, isProfileCompact && styles.profileStatsSectionHeaderCompact]}>
                          <View>
                            <Text style={styles.profileStatsSectionEyebrow}>Single Player</Text>
                            <Text style={styles.profileStatsSectionTitle}>Difficulty Mastery</Text>
                          </View>
                          <View style={styles.profileStatsChip}>
                            <Text style={styles.profileStatsChipText}>Best Score {singlePlayerBestScore}</Text>
                          </View>
                        </View>

                        <View style={styles.profileStatsChart}>
                          {difficultyChartConfig.map((difficulty) => {
                            const score = profile.stats.singlePlayerHighScores[difficulty.key];
                            const rounds = profile.stats.singlePlayerHighRounds[difficulty.key];
                            const widthPercent = score > 0 ? Math.max(8, Math.round((score / bestScoreCeiling) * 100)) : 0;

                            return (
                              <View key={difficulty.key} style={styles.profileStatsChartRow}>
                                <View style={styles.profileStatsChartHead}>
                                  <View style={[styles.profileStatsChartDot, { backgroundColor: difficulty.accent }]} />
                                  <Text style={styles.profileStatsChartLabel}>{difficulty.label}</Text>
                                  <Text style={styles.profileStatsChartScore}>{score}</Text>
                                </View>

                                <View style={styles.profileStatsChartTrack}>
                                  <View
                                    style={[
                                      styles.profileStatsChartFill,
                                      {
                                        backgroundColor: difficulty.accent,
                                        width: `${widthPercent}%`
                                      }
                                    ]}
                                  />
                                </View>

                                <Text style={styles.profileStatsChartMeta}>
                                  Best Round {rounds}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.profileStatsFeatureCard}>
                        <View style={[styles.profileStatsSectionHeader, isProfileCompact && styles.profileStatsSectionHeaderCompact]}>
                          <View>
                            <Text style={styles.profileStatsSectionEyebrow}>Overview</Text>
                            <Text style={styles.profileStatsSectionTitle}>Mode Performance</Text>
                          </View>
                          <View style={styles.profileStatsChip}>
                            <Text style={styles.profileStatsChipText}>{totalMatches} Matches</Text>
                          </View>
                        </View>

                        <View style={styles.profileStatsModeList}>
                          {modePerformance.map((mode) => {
                            const barWidth = mode.matches > 0 ? Math.max(10, Math.round((mode.matches / modeMatchesCeiling) * 100)) : 0;

                            return (
                              <View key={mode.key} style={styles.profileStatsModeCard}>
                                <View style={styles.profileStatsModeHeader}>
                                  <View style={styles.profileStatsModeIdentity}>
                                    <View style={[styles.profileStatsModeBadge, { backgroundColor: `${mode.accent}22` }]}>
                                      <View style={[styles.profileStatsModeBadgeCore, { backgroundColor: mode.accent }]} />
                                    </View>
                                    <View style={styles.profileStatsModeCopy}>
                                      <Text style={styles.profileStatsModeTitle}>{mode.label}</Text>
                                      <Text style={styles.profileStatsModeMeta}>{mode.matches} matches played</Text>
                                    </View>
                                  </View>

                                  <View style={styles.profileStatsModeMetrics}>
                                    <Text style={styles.profileStatsModeMetricValue}>{mode.winRate}%</Text>
                                    <Text style={styles.profileStatsModeMetricLabel}>win rate</Text>
                                  </View>
                                </View>

                                <View style={styles.profileStatsModeBarTrack}>
                                  <View
                                    style={[
                                      styles.profileStatsModeBarFill,
                                      {
                                        backgroundColor: mode.accent,
                                        width: `${barWidth}%`
                                      }
                                    ]}
                                  />
                                </View>

                                <View style={styles.profileStatsModeFooter}>
                                  <Text style={styles.profileStatsModeFooterText}>{mode.points} pts earned</Text>
                                  <Text style={styles.profileStatsModeFooterText}>
                                    {mode.matches > 0 ? Math.round(mode.points / mode.matches) : 0} avg pts
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.profileStatsFeatureCard}>
                        <View style={[styles.profileStatsSectionHeader, isProfileCompact && styles.profileStatsSectionHeaderCompact]}>
                          <View>
                            <Text style={styles.profileStatsSectionEyebrow}>Recent Form</Text>
                            <Text style={styles.profileStatsSectionTitle}>Latest Matches</Text>
                          </View>
                        </View>

                        {recentMatches.length > 0 ? recentMatches.map((match) => {
                          const outcomeColor =
                            match.outcome === "win" ? colors.practice : match.outcome === "tie" ? colors.warning : colors.ai;

                          return (
                            <View key={match.id} style={styles.profileStatsMatchRow}>
                              <View style={[styles.profileStatsMatchPill, { backgroundColor: outcomeColor }]}>
                                <Text style={styles.profileStatsMatchPillText}>{match.outcome.toUpperCase()}</Text>
                              </View>

                              <View style={styles.profileStatsMatchCopy}>
                                <Text numberOfLines={1} style={styles.profileStatsMatchTitle}>
                                  {match.mode === "daily" ? "Daily Puzzle" : match.category === "single-player" ? "Single Player" : match.category === "vs-ai" ? "VS AI" : "Online"} · {match.difficulty}
                                </Text>
                                <Text numberOfLines={1} style={styles.profileStatsMatchSubtitle}>
                                  {match.points} pts · {formatDuration(match.durationMs)} · {match.attempts} attempts
                                </Text>
                              </View>
                            </View>
                          );
                        }) : (
                          <View style={styles.profileStatsEmptyState}>
                            <Ionicons color={colors.textMuted} name="stats-chart-outline" size={20} />
                            <Text style={styles.profileStatsEmptyTitle}>No match history yet</Text>
                            <Text style={styles.profileStatsEmptyCaption}>
                              Your recent games will show up here once you start playing.
                            </Text>
                          </View>
                        )}
                      </View>
                    </>
                  ) : null}
                </View>
              ) : (
                <View style={[styles.profilePanel, { width: profileContentWidth }]}>
                  <View style={[styles.profileNameRow, { marginHorizontal: profileInnerMargin }]}>
                    <TextInput
                      autoCapitalize="none"
                      maxLength={20}
                      onChangeText={(value) => {
                        setUsernameDraft(value);
                        setUsernameError(null);
                      }}
                      placeholder="Enter a nickname"
                      placeholderTextColor="#aaa7b6"
                      style={styles.profileNameInput}
                      value={usernameDraft}
                    />
                    <Pressable
                      disabled={isSavingUsername || usernameDraft.trim().length < 3 || usernameDraft.trim() === displayName.trim()}
                      onPress={() => void handleSaveUsername()}
                      style={({ pressed }) => [
                        styles.profileNameAction,
                        (isSavingUsername || usernameDraft.trim().length < 3 || usernameDraft.trim() === displayName.trim()) &&
                        styles.profileNameActionDisabled,
                        pressed && styles.pressed
                      ]}
                    >
                      <Ionicons color="#ffffff" name="create-outline" size={15} />
                    </Pressable>
                  </View>
                  {usernameError ? <Text style={styles.inlineError}>{usernameError}</Text> : null}

                  <View style={[styles.profileDivider, { marginHorizontal: profileInnerMargin }]} />

                  <View style={[styles.profilePanelHeader, { marginHorizontal: profileInnerMargin }]}>
                    <View style={styles.profilePanelHeaderCopy}>
                      <Text style={styles.profilePanelTitle}>Choose Avatar</Text>
                      <Text style={styles.profilePanelCaption}>Free favorites and premium shine.</Text>
                    </View>
                    <View style={styles.profileCurrentBadge}>
                      <Text style={styles.profileCurrentBadgeText}>Selected</Text>
                    </View>
                  </View>

                  <View style={styles.avatarTabs}>
                    {(["default", "premium"] as const).map((tab) => {
                      const isActive = avatarPickerTab === tab;

                      return (
                        <Pressable
                          accessibilityRole="tab"
                          accessibilityState={{ selected: isActive }}
                          key={tab}
                          onPress={() => {
                            setAvatarPickerTab(tab);
                            setAvatarError(null);
                            playSound("tabSwitch");
                          }}
                          style={({ pressed }) => [
                            styles.avatarTab,
                            isActive && styles.avatarTabActive,
                            tab === "premium" && styles.avatarTabPremium,
                            pressed && styles.pressed
                          ]}
                        >
                          <Ionicons
                            color={isActive ? "#1f2933" : tab === "premium" ? "#8a5f00" : colors.textMuted}
                            name={tab === "premium" ? "diamond" : "happy-outline"}
                            size={15}
                          />
                          <Text style={[styles.avatarTabText, isActive && styles.avatarTabTextActive]}>
                            {tab === "premium" ? "Premium" : "Default"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={[styles.avatarGrid, isProfileCompact && styles.avatarGridCompact]}>
                    {activeAvatarOptions.map((option) => {
                      const isSelected = option.id === selectedAvatarId;
                      const premiumOption = avatarPickerTab === "premium" ? option as (typeof premiumProfileAvatarOptions)[number] : null;
                      const isPremiumAvatar = premiumOption !== null;
                      const isPremiumOwned = premiumOption ? profile.premiumAvatarIds.includes(premiumOption.id) : false;
                      const canAffordPremium = premiumOption ? profile.coins >= premiumOption.price : false;
                      const isLevelLocked = Boolean(premiumOption && !isPremiumOwned && profile.level < premiumOption.requiredLevel);
                      const shouldShowPremiumPrice = Boolean(premiumOption && !isPremiumOwned && !isLevelLocked);

                      return (
                        <Pressable
                          key={option.id}
                          accessibilityLabel={
                            premiumOption
                              ? `${premiumOption.label}, ${isPremiumOwned
                                ? "owned"
                                : isLevelLocked
                                  ? `requires level ${premiumOption.requiredLevel}`
                                  : `${premiumOption.price.toLocaleString("en-US")} coins`
                              }`
                              : "Avatar option"
                          }
                          onPress={() => {
                            if (premiumOption) {
                              void handlePressPremiumAvatar(premiumOption);
                              return;
                            }

                            void handleSelectAvatar(option.id);
                          }}
                          style={({ pressed }) => [
                            styles.avatarOption,
                            isPremiumAvatar && styles.avatarOptionPremium,
                            isSelected && styles.avatarOptionSelected,
                            savingAvatarId !== null && savingAvatarId !== option.id && styles.avatarOptionDisabled,
                            pressed && styles.pressed
                          ]}
                        >
                          <View
                            style={[
                              styles.avatarOptionFrame,
                              {
                                height: profileAvatarOptionSize,
                                width: profileAvatarOptionSize
                              }
                            ]}
                          >
                            <View
                              style={[
                                styles.avatarOptionInner,
                                isPremiumAvatar && styles.avatarOptionInnerPremium,
                                isLevelLocked && styles.avatarOptionInnerLocked,
                                {
                                  backgroundColor: option.background,
                                  borderColor: option.ring,
                                  height: profileAvatarOptionSize,
                                  width: profileAvatarOptionSize
                                }
                              ]}
                            >
                              <Image
                                accessibilityIgnoresInvertColors
                                fadeDuration={100}
                                resizeMode="cover"
                                source={{ cache: "force-cache", uri: option.imageUrl }}
                                style={styles.avatarOptionImage}
                              />
                              {isLevelLocked ? <View style={styles.avatarOptionLockedScrim} /> : null}
                            </View>
                            {isSelected ? (
                              <View style={styles.avatarOptionCheck}>
                                <Ionicons color="#ffffff" name="checkmark" size={10} />
                              </View>
                            ) : null}
                            {isLevelLocked ? (
                              <View style={styles.avatarOptionLock}>
                                <Ionicons color="#ffffff" name="lock-closed" size={9} />
                              </View>
                            ) : null}
                            {shouldShowPremiumPrice && premiumOption ? (
                              <View
                                style={[
                                  styles.avatarPricePill,
                                  canAffordPremium && styles.avatarPricePillAffordable,
                                  !canAffordPremium && styles.avatarPricePillInsufficient
                                ]}
                              >
                                <View style={styles.avatarPriceShine} />
                                <View style={styles.avatarPriceCoinWell}>
                                  <CoinIcon size={12} />
                                </View>
                                <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.avatarPriceText}>
                                  {premiumOption.price.toLocaleString("en-US")}
                                </Text>
                              </View>
                            ) : null}
                            {isLevelLocked && premiumOption ? (
                              <View style={styles.avatarLevelPill}>
                                <View style={styles.avatarLevelShine} />
                                <Ionicons color="#f8fafc" name="lock-closed" size={10} />
                                <Text numberOfLines={1} style={styles.avatarLevelText}>
                                  LVL {premiumOption.requiredLevel}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                  {avatarError ? <Text style={styles.inlineError}>{avatarError}</Text> : null}
                </View>
              )}
            </ScrollView>
          ) : null}

          {activeTab === "settings" ? (
            <View style={[styles.tabPane, styles.settingsPane]}>
              <View style={[styles.panelCard, styles.settingsCard]}>
                <Text style={styles.panelTitle}>Settings</Text>
                <View style={styles.settingsActionRow}>
                  <View style={styles.settingsActionCopy}>
                    <Text style={styles.settingsActionTitle}>Sound Effects</Text>
                    <Text style={styles.panelSubtext}>
                      {profile.soundPlaceholdersEnabled ? "Game sounds are on." : "Game sounds are off."}
                    </Text>
                  </View>
                  <Switch
                    onValueChange={() => {
                      playSoundAlways(profile.soundPlaceholdersEnabled ? "switchOff" : "switchOn");
                      toggleSoundPlaceholders().catch(() => { });
                    }}
                    thumbColor="#ffffff"
                    trackColor={{ false: colors.surfaceMuted, true: colors.practice }}
                    value={profile.soundPlaceholdersEnabled}
                  />
                </View>
              </View>

              <View style={[styles.panelCard, styles.settingsCard]}>
                <Text style={styles.panelTitle}>Profile</Text>
                <View style={styles.settingsActionRow}>
                  <View style={styles.settingsActionCopy}>
                    <Text style={styles.settingsActionTitle}>{displayName}</Text>
                    <Text style={styles.panelSubtext}>Level {profile.level} profile</Text>
                  </View>
                  <Pressable
                    onPress={openProfileEditor}
                    style={({ pressed }) => [styles.settingsTextButton, pressed && styles.pressed]}
                  >
                    <Ionicons color={colors.text} name="create-outline" size={16} />
                    <Text style={styles.settingsTextButtonLabel}>EDIT</Text>
                  </Pressable>
                </View>
                <View style={styles.settingsDivider} />
                <View style={styles.settingsActionRow}>
                  <View style={styles.settingsActionCopy}>
                    <Text style={styles.settingsActionTitle}>Player ID</Text>
                    <Text numberOfLines={1} style={styles.panelSubtext}>{playerKeyPreview}</Text>
                  </View>
                  <Pressable
                    disabled={!playerKey}
                    onPress={() => void handleCopyPlayerKey()}
                    style={({ pressed }) => [
                      styles.settingsIconButton,
                      pressed && playerKey && styles.pressed,
                      !playerKey && styles.settingsIconButtonDisabled
                    ]}
                  >
                    <Ionicons color="#ffffff" name="copy-outline" size={18} />
                  </Pressable>
                </View>
              </View>

              <View style={[styles.panelCard, styles.settingsCard]}>
                <Text style={styles.panelTitle}>Help</Text>
                <View style={styles.settingsActionRow}>
                  <View style={styles.settingsActionCopy}>
                    <Text style={styles.settingsActionTitle}>How to Play</Text>
                    <Text style={styles.panelSubtext}>Replay the tutorial and mode tour.</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      playSound("modalOpen");
                      useTutorialStore.getState().startReplay();
                      router.push("/tutorial");
                    }}
                    style={({ pressed }) => [styles.settingsTextButton, pressed && styles.pressed]}
                  >
                    <Ionicons color={colors.text} name="play-circle-outline" size={16} />
                    <Text style={styles.settingsTextButtonLabel}>REPLAY</Text>
                  </Pressable>
                </View>
              </View>

              {billingEnabled ? (
                <View style={[styles.panelCard, styles.settingsCard]}>
                  <Text style={styles.panelTitle}>Purchases</Text>
                  <View style={styles.settingsActionRow}>
                    <View style={styles.settingsActionCopy}>
                      <Text style={styles.settingsActionTitle}>No Ads</Text>
                      <Text style={styles.panelSubtext}>{hasNoAdsEntitlement ? "Active" : "Not active"}</Text>
                    </View>
                    <Pressable
                      disabled={isRestoringPurchases}
                      onPress={() => void handleRestorePurchases()}
                      style={({ pressed }) => [
                        styles.settingsTextButton,
                        isRestoringPurchases && styles.settingsIconButtonDisabled,
                        pressed && !isRestoringPurchases && styles.pressed
                      ]}
                    >
                      <Ionicons color={colors.text} name="refresh" size={16} />
                      <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={styles.settingsTextButtonLabel}>
                        {isRestoringPurchases ? "RESTORING" : "RESTORE"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {settingsMessage ? (
                <View style={styles.settingsNotice}>
                  <Ionicons color={colors.accent} name="information-circle" size={16} />
                  <Text numberOfLines={2} style={styles.settingsMessage}>{settingsMessage}</Text>
                </View>
              ) : null}

              <View style={[styles.panelCard, styles.settingsCard, styles.settingsAppCard]}>
                <Text style={styles.panelTitle}>App</Text>
                <View style={styles.settingsAppRow}>
                  <View style={styles.settingsAppIcon}>
                    <Ionicons color={colors.accent} name="apps" size={17} />
                  </View>
                  <Text style={styles.settingsAppName}>{appDisplayName}</Text>
                  <Text style={styles.settingsAppVersion}>
                    v{appVersion} | build {appBuildNumber ?? "-"}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {activeTab === "shop" || activeTab === "profile" ? null : (
          <View style={styles.bottomDock}>
            <BottomTabs activeTab={activeTab} onChange={handleTabChange} />
          </View>
        )}
      </Animated.View>
    </ScreenContainer>

    <HomeTutorialCallouts />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 0
  },
  shell: {
    flex: 1
  },
  homeHeaderCenter: {
    transform: [{ translateY: 24 }, { scale: 1.72 }]
  },
  homeHeaderRight: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
    position: "absolute",
    right: 2,
    width: 188
  },
  homeHeaderNoAdsSlot: {
    alignItems: "flex-start",
    justifyContent: "center",
    transform: [{ translateX: -42 }],
    width: 52
  },
  homeHeaderNoAdsButton: {
    alignItems: "center",
    height: 52,
    justifyContent: "center",
    width: 52
  },
  homeHeaderNoAdsImage: {
    height: 40,
    width: 40
  },
  shopHeaderStatusSlot: {
    alignItems: "stretch",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    top: 0
  },
  profileCrest: {
    alignItems: "center",
    height: 62,
    justifyContent: "flex-start",
    width: 64,
    zIndex: 3
  },
  levelBurst: {
    alignItems: "center",
    height: 19,
    justifyContent: "center",
    position: "absolute",
    top: 2,
    width: 19,
    zIndex: 4
  },
  levelBurstSvg: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  profileMedallion: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    marginTop: 9,
    padding: 4,
    width: 48
  },
  profileRingBase: {
    alignItems: "center",
    backgroundColor: "#c96744",
    borderRadius: 999,
    height: PROFILE_RING_SIZE,
    justifyContent: "center",
    position: "absolute",
    width: PROFILE_RING_SIZE
  },
  profileRingSvg: {
    position: "absolute"
  },
  profileRingInner: {
    alignItems: "center",
    backgroundColor: "#f7c8ba",
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  profileAvatarCore: {
    alignItems: "center",
    backgroundColor: "#5aa6ff",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    overflow: "hidden",
    width: 34
  },
  profileAvatarImage: {
    height: "100%",
    width: "100%"
  },
  profileAvatarGlow: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    borderRadius: 999,
    height: 38,
    left: 7,
    position: "absolute",
    top: 3,
    width: 38
  },
  profileShield: {
    alignItems: "center",
    bottom: 0,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    width: 18,
    zIndex: 4
  },
  profileShieldText: {
    color: "#7a8794",
    fontSize: 6,
    fontWeight: "900",
    position: "absolute",
    top: 5
  },
  wordmarkWrap: {
    alignItems: "center",
    marginBottom: spacing.sm,
    width: "100%"
  },
  wordmark: {
    alignItems: "center",
    gap: 6
  },
  wordRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    justifyContent: "center"
  },
  wordBubble: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 43,
    justifyContent: "center",
    width: 43,
    ...shadows.tactile
  },
  wordBubbleText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.4,
    lineHeight: 25
  },
  heroCaption: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center"
  },
  mainPane: {
    flex: 1,
    justifyContent: "center",
    paddingTop: spacing.md
  },
  profileMainPane: {
    justifyContent: "flex-start",
    paddingTop: spacing.xs
  },
  shopMainPane: {
    paddingTop: 0
  },
  tabPane: {
    flex: 1,
    gap: spacing.sm
  },
  playPane: {
    justifyContent: "center",
    position: "relative"
  },
  homePlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden"
  },
  homeBackdropGamepad: {
    left: 18,
    opacity: 0.62,
    position: "absolute",
    top: "10%",
    transform: [{ rotate: "-16deg" }]
  },
  homeBackdropTrophy: {
    opacity: 0.58,
    position: "absolute",
    right: 24,
    top: "18%",
    transform: [{ rotate: "13deg" }]
  },
  homeBackdropFlash: {
    left: 34,
    opacity: 0.55,
    position: "absolute",
    top: "43%",
    transform: [{ rotate: "18deg" }]
  },
  homeBackdropStar: {
    opacity: 0.58,
    position: "absolute",
    right: 18,
    top: "50%",
    transform: [{ rotate: "-14deg" }]
  },
  homeBackdropCode: {
    bottom: "15%",
    left: 26,
    opacity: 0.58,
    position: "absolute",
    transform: [{ rotate: "8deg" }]
  },
  homeBackdropBulb: {
    bottom: "8%",
    opacity: 0.55,
    position: "absolute",
    right: 35,
    transform: [{ rotate: "-12deg" }]
  },
  homeBackdropQuestion: {
    left: "43%",
    opacity: 0.48,
    position: "absolute",
    top: "18%",
    transform: [{ rotate: "9deg" }]
  },
  homeBackdropCalculator: {
    bottom: "22%",
    opacity: 0.5,
    position: "absolute",
    right: "30%",
    transform: [{ rotate: "13deg" }]
  },
  homeBackdropTarget: {
    bottom: "6%",
    left: "47%",
    opacity: 0.5,
    position: "absolute",
    transform: [{ rotate: "-8deg" }]
  },
  homeBackdropHighLow: {
    alignItems: "center",
    gap: 0,
    opacity: 0.5,
    position: "absolute",
    right: 10,
    top: "27%",
    transform: [{ rotate: "8deg" }]
  },
  homeBackdropHighLowText: {
    color: "#d9dede",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 18
  },
  homeBackdropNumberChip: {
    alignItems: "center",
    borderColor: "#dce1e1",
    borderRadius: 11,
    borderWidth: 3,
    justifyContent: "center",
    opacity: 0.54,
    position: "absolute"
  },
  homeBackdropNumberChipOne: {
    height: 34,
    left: "23%",
    top: "15%",
    transform: [{ rotate: "-11deg" }],
    width: 42
  },
  homeBackdropNumberChipTwo: {
    bottom: "25%",
    height: 30,
    left: "47%",
    transform: [{ rotate: "8deg" }],
    width: 30
  },
  homeBackdropNumberChipThree: {
    bottom: "13%",
    height: 32,
    right: "21%",
    transform: [{ rotate: "-7deg" }],
    width: 40
  },
  homeBackdropNumberText: {
    color: "#d4dada",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16
  },
  homeBackdropCompare: {
    color: "#d9dede",
    fontSize: 38,
    fontWeight: "900",
    opacity: 0.52,
    position: "absolute"
  },
  homeBackdropCompareHigh: {
    left: "5%",
    top: "23%",
    transform: [{ rotate: "-8deg" }]
  },
  homeBackdropCompareLow: {
    bottom: "17%",
    right: "6%",
    transform: [{ rotate: "12deg" }]
  },
  homeBackdropRange: {
    bottom: "5%",
    color: "#d6dcdc",
    fontSize: 13,
    fontWeight: "900",
    left: "29%",
    letterSpacing: 1.2,
    opacity: 0.52,
    position: "absolute",
    transform: [{ rotate: "-4deg" }]
  },
  homeBackdropRing: {
    borderColor: "#dde2e2",
    borderRadius: radii.pill,
    borderWidth: 5,
    opacity: 0.6,
    position: "absolute"
  },
  homeBackdropRingTop: {
    height: 24,
    right: "28%",
    top: "8%",
    width: 24
  },
  homeBackdropRingBottom: {
    bottom: "20%",
    height: 19,
    left: "39%",
    width: 19
  },
  homeBackdropDiamond: {
    backgroundColor: "#e0e4e4",
    borderRadius: 4,
    opacity: 0.68,
    position: "absolute",
    transform: [{ rotate: "45deg" }]
  },
  homeBackdropDiamondLeft: {
    height: 16,
    left: "12%",
    top: "31%",
    width: 16
  },
  homeBackdropDiamondRight: {
    bottom: "29%",
    height: 13,
    right: "12%",
    width: 13
  },
  homeBackdropDot: {
    backgroundColor: "#d9dede",
    borderRadius: radii.pill,
    opacity: 0.7,
    position: "absolute"
  },
  homeBackdropDotTop: {
    height: 10,
    left: "67%",
    top: "14%",
    width: 10
  },
  homeBackdropDotMiddle: {
    height: 7,
    right: "8%",
    top: "39%",
    width: 7
  },
  homeBackdropDotBottom: {
    bottom: "10%",
    height: 9,
    left: "22%",
    width: 9
  },
  homeBackdropCross: {
    height: 24,
    opacity: 0.62,
    position: "absolute",
    width: 24
  },
  homeBackdropCrossLeft: {
    bottom: "32%",
    left: "7%",
    transform: [{ rotate: "-9deg" }]
  },
  homeBackdropCrossRight: {
    right: "20%",
    top: "34%",
    transform: [{ rotate: "16deg" }]
  },
  homeBackdropCrossVertical: {
    backgroundColor: "#dce1e1",
    borderRadius: radii.pill,
    bottom: 0,
    left: 10,
    position: "absolute",
    top: 0,
    width: 4
  },
  homeBackdropCrossHorizontal: {
    backgroundColor: "#dce1e1",
    borderRadius: radii.pill,
    height: 4,
    left: 0,
    position: "absolute",
    right: 0,
    top: 10
  },
  dailyCard: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#ffe28c",
    borderBottomColor: "rgba(140, 90, 0, 0.08)",
    borderBottomWidth: 6,
    borderColor: "transparent",
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: spacing.sm,
    maxWidth: 360,
    minHeight: 76,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: "relative",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    width: "100%",
    elevation: 7
  },
  dailyCardGhost: {
    backgroundColor: "rgba(140, 90, 0, 0.08)",
    borderRadius: 999,
    bottom: -18,
    height: 84,
    position: "absolute",
    right: -12,
    width: 84
  },
  dailyCopy: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    paddingHorizontal: spacing.sm,
    paddingRight: 56,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1,
  },
  dailyTitle: {
    color: "#8b5a00",
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 22,
    textAlign: "center",
    textTransform: "uppercase"
  },
  dailyDateWrap: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 6,
    top: 5,
    width: 58,
    zIndex: 1
  },
  dailyDateInner: {
    alignItems: "center"
  },
  dailyCalendarTop: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    justifyContent: "center",
    minHeight: 15,
    paddingHorizontal: 5,
    paddingTop: 1,
    position: "relative",
    width: 44
  },
  dailyCalendarRingLeft: {
    backgroundColor: "#ffffff",
    borderRadius: radii.pill,
    height: 7,
    left: 8,
    position: "absolute",
    top: -3,
    width: 5
  },
  dailyCalendarRingRight: {
    backgroundColor: "#ffffff",
    borderRadius: radii.pill,
    height: 7,
    position: "absolute",
    right: 8,
    top: -3,
    width: 5
  },
  dailyCalendarBottom: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderTopColor: "#f0b13a",
    borderTopWidth: 1.5,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    justifyContent: "center",
    minHeight: 24,
    width: 44
  },
  dailyDateMonth: {
    color: "#f0a500",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  dailyDateDay: {
    color: "#f0a500",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20
  },
  dailyBadgeMonth: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  dailyBadgeDay: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28
  },
  modeStack: {
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm
  },
  homeModeTile: {
    maxWidth: 360,
    minHeight: 76,
    width: "100%"
  },
  modeBestCard: {
    alignItems: "center",
    backgroundColor: "transparent",
    justifyContent: "center",
    width: 44
  },
  modeBestTop: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 12,
    paddingHorizontal: 2
  },
  modeBestLabel: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textShadowColor: "rgba(0, 0, 0, 0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1
  },
  modeBestBottom: {
    alignItems: "center",
    borderTopColor: "transparent",
    borderTopWidth: 0,
    justifyContent: "center",
    marginTop: -2,
    minHeight: 18
  },
  modeBestValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    textShadowColor: "rgba(0, 0, 0, 0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1
  },
  onlineVsBadge: {
    alignItems: "center",
    justifyContent: "center",
    width: 56
  },
  onlineVsBadgeText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    includeFontPadding: false,
    letterSpacing: 0.3,
    lineHeight: 24,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1
  },
  panelRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  panelWide: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    flex: 1.25,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.card
  },
  panelMiniColumn: {
    flex: 1,
    gap: spacing.sm
  },
  panelMini: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flex: 1,
    justifyContent: "center",
    padding: spacing.sm,
    ...shadows.card
  },
  panelMiniLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  panelMiniValue: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: spacing.xs
  },
  panelCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    gap: spacing.xs,
    padding: spacing.md,
    ...shadows.card
  },
  panelTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  panelValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  panelSubtext: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  leaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 28
  },
  leaderRank: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "900",
    width: 28
  },
  leaderName: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "800"
  },
  leaderPoints: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "900"
  },
  profileStatusRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  profileTopBar: {
    alignItems: "center",
    borderBottomColor: "#e2e6e1",
    borderBottomWidth: 1,
    flexDirection: "row",
    marginHorizontal: -spacing.md,
    marginBottom: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2
  },
  profileTopBarBack: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  profileTopBarSpacer: {
    width: 32
  },
  profileRouteTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: "center"
  },
  profileScroll: {
    marginHorizontal: -spacing.xxs
  },
  profileScrollContent: {
    gap: 0,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md
  },
  profileHeroShell: {
    alignSelf: "flex-start",
    backgroundColor: colors.background,
    gap: 2,
    marginTop: -spacing.xs,
    overflow: "visible",
    paddingBottom: 10,
    paddingHorizontal: 0,
    paddingTop: 8
  },
  profileHeroHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 34
  },
  profileHeroBackButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    width: 34,
    ...shadows.card
  },
  profileHeroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.xs,
    marginHorizontal: 0,
    marginTop: 18,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    position: "relative",
    ...shadows.card
  },
  profileHeroAvatarWrap: {
    alignItems: "center",
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0
  },
  profileHeroShadow: {
    backgroundColor: "rgba(47, 50, 51, 0.12)",
    borderRadius: radii.pill,
    bottom: 8,
    height: 12,
    position: "absolute"
  },
  profileHeroAvatar: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 4,
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.tactile
  },
  profileHeroAvatarImage: {
    height: "100%",
    width: "100%"
  },
  profileHeroName: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.2,
    lineHeight: 26,
    marginTop: 1,
    textAlign: "center"
  },
  profileHeroProgressCluster: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 4,
    paddingHorizontal: 18
  },
  profileHeroLevelBurst: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: radii.pill,
    justifyContent: "center",
    position: "relative",
    transform: [{ translateX: 10 }],
    zIndex: 3
  },
  profileHeroLevelBurstSvg: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  profileHeroProgressTrack: {
    backgroundColor: colors.darkSurface,
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    height: 34,
    justifyContent: "center",
    marginLeft: -22,
    overflow: "hidden",
    position: "relative"
  },
  profileHeroProgressFill: {
    backgroundColor: colors.online,
    borderRadius: radii.pill,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0
  },
  profileHeroProgressFillGloss: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    height: "42%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  profileHeroProgressTrackGloss: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    height: "45%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  profileHeroProgressValue: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18,
    textAlign: "center",
    textShadowColor: colors.darkSurface,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    zIndex: 1
  },
  profileSectionBar: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
    backgroundColor: "transparent",
    borderBottomColor: colors.border,
    borderBottomWidth: 3,
    flexDirection: "column",
    justifyContent: "flex-end",
    marginTop: 6
  },
  profileSectionTabs: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 4
  },
  profileSectionTab: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.xs,
    paddingTop: 2
  },
  profileSectionTabActive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1
  },
  profileSectionTabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2
  },
  profileSectionTabTextActive: {
    color: colors.accent
  },
  profileSectionTabIcon: {
    alignItems: "center",
    backgroundColor: colors.practice,
    borderRadius: radii.pill,
    height: 18,
    justifyContent: "center",
    width: 18
  },
  profilePanel: {
    alignSelf: "flex-start",
    gap: 10,
    marginTop: 8
  },
  profileStatsPanel: {
    alignSelf: "flex-start",
    gap: 12,
    marginTop: 8
  },
  profileStatsHeroGrid: {
    gap: 8
  },
  profileStatsClimbTeaser: {
    alignItems: "center",
    backgroundColor: "#20292e",
    borderColor: "#101719",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...shadows.card
  },
  profileStatsClimbTeaserIcon: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: 18,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  profileStatsClimbTeaserCopy: {
    flex: 1,
    gap: 1
  },
  profileStatsClimbTeaserEyebrow: {
    color: "#a7f3c5",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsClimbTeaserTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 19
  },
  profileStatsClimbTeaserCaption: {
    color: "#c9d7d2",
    fontSize: 11,
    fontWeight: "700"
  },
  profileStatsClimbTeaserNeed: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 62,
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  profileStatsClimbTeaserNeedLabel: {
    color: "#aebdb7",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsClimbTeaserNeedValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 1
  },
  profileStatsCoachCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d9e7dc",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 82,
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...shadows.card
  },
  profileStatsCoachIcon: {
    alignItems: "center",
    borderRadius: 18,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  profileStatsCoachCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  profileStatsCoachTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  profileStatsCoachEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  profileStatsCoachAction: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsCoachTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 19
  },
  profileStatsCoachBody: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  profileStatsCoachPill: {
    backgroundColor: "#20292e",
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  profileStatsCoachPillText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsHeroCard: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 24,
    gap: 4,
    minHeight: 108,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: "relative",
    ...shadows.card
  },
  profileStatsHeroCardPrimary: {
    backgroundColor: "#f7fbf7"
  },
  profileStatsHeroCardAccent: {
    backgroundColor: "#f5f9fc"
  },
  profileStatsHeroGlow: {
    borderRadius: radii.pill,
    position: "absolute"
  },
  profileStatsHeroGlowPrimaryA: {
    backgroundColor: "rgba(46, 204, 113, 0.16)",
    height: 124,
    right: -18,
    top: -18,
    width: 124
  },
  profileStatsHeroGlowPrimaryB: {
    backgroundColor: "rgba(0, 109, 55, 0.08)",
    height: 88,
    left: -16,
    top: 28,
    width: 88
  },
  profileStatsHeroGlowAccentA: {
    backgroundColor: "rgba(92, 184, 253, 0.18)",
    height: 124,
    right: -16,
    top: -20,
    width: 124
  },
  profileStatsHeroGlowAccentB: {
    backgroundColor: "rgba(15, 95, 135, 0.08)",
    height: 96,
    left: -14,
    top: 34,
    width: 96
  },
  profileStatsHeroTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    zIndex: 1
  },
  profileStatsHeroBadge: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  profileStatsHeroBadgePrimary: {
    backgroundColor: "#dcf7e5"
  },
  profileStatsHeroBadgeAccent: {
    backgroundColor: "#d9effd"
  },
  profileStatsHeroTag: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderColor: "rgba(25, 28, 29, 0.06)",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  profileStatsHeroTagText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsHeroLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    zIndex: 1
  },
  profileStatsHeroValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
    zIndex: 1
  },
  profileStatsHeroCaption: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 2,
    zIndex: 1
  },
  profileStatsHeroMeterTrack: {
    backgroundColor: "rgba(25, 28, 29, 0.08)",
    borderRadius: radii.pill,
    height: 7,
    marginTop: 12,
    overflow: "hidden",
    zIndex: 1
  },
  profileStatsHeroMeterFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  profileStatsHeroMeterFillPrimary: {
    backgroundColor: colors.accent
  },
  profileStatsHeroMeterFillAccent: {
    backgroundColor: colors.online
  },
  profileStatsMiniRow: {
    flexDirection: "row",
    gap: 8
  },
  profileStatsMiniRowCompact: {
    flexDirection: "column"
  },
  profileStatsMiniCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minHeight: 76,
    overflow: "hidden",
    paddingHorizontal: 12,
    position: "relative",
    paddingVertical: 10,
    ...shadows.card
  },
  profileStatsMiniCardWarm: {
    backgroundColor: "#fff3d6",
    borderColor: "#f4cd74"
  },
  profileStatsMiniCardCool: {
    backgroundColor: "#e8f5ff",
    borderColor: "#9cd8ff"
  },
  profileStatsMiniCardOnline: {
    backgroundColor: "#eaf8f0",
    borderColor: "#93d1aa"
  },
  profileStatsMiniTopRow: {
    alignItems: "flex-start",
    marginBottom: 8
  },
  profileStatsMiniBadge: {
    alignItems: "center",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  profileStatsMiniBadgeWarm: {
    backgroundColor: "rgba(244, 205, 116, 0.4)"
  },
  profileStatsMiniBadgeCool: {
    backgroundColor: "rgba(156, 216, 255, 0.4)"
  },
  profileStatsMiniLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsMiniValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 30
  },
  profileStatsMiniCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2
  },
  profileStatsSimpleLeaderboardCard: {
    backgroundColor: "#fbfffc",
    borderColor: "#9fd9b2",
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 11,
    ...shadows.card
  },
  profileStatsSimpleHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  profileStatsSimpleEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsSimpleTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 23,
    marginTop: 1
  },
  profileStatsSimpleRankPill: {
    backgroundColor: "#eef7f1",
    borderColor: "#b7d8c3",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  profileStatsSimpleRankText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900"
  },
  profileStatsSimpleRows: {
    gap: 7
  },
  profileStatsSimpleRow: {
    alignItems: "center",
    backgroundColor: "#f8fbfd",
    borderColor: "rgba(25, 28, 29, 0.07)",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 44,
    paddingHorizontal: 10
  },
  profileStatsSimpleRowPlayer: {
    backgroundColor: "#eaf8f0",
    borderColor: "#8fd5a9"
  },
  profileStatsSimpleRank: {
    backgroundColor: "#edf3ee",
    borderRadius: radii.pill,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 24,
    minWidth: 34,
    overflow: "hidden",
    paddingHorizontal: 7,
    textAlign: "center",
    textAlignVertical: "center"
  },
  profileStatsSimpleRankPlayer: {
    backgroundColor: "#d4f3df",
    color: colors.accentDark
  },
  profileStatsSimpleRankSlot: {
    alignItems: "center",
    justifyContent: "center",
    width: 44
  },
  profileStatsSimpleAvatarFrame: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 38,
    justifyContent: "center",
    overflow: "hidden",
    width: 38
  },
  profileStatsSimpleAvatarImage: {
    height: 34,
    width: 34
  },
  profileStatsSimplePlayerCopy: {
    flex: 1,
    minWidth: 0
  },
  profileStatsSimpleName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  profileStatsSimpleScore: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900"
  },
  profileStatsSimpleTextPlayer: {
    color: colors.accentDark
  },
  profileStatsSimpleEmpty: {
    backgroundColor: "#f8fbfd",
    borderColor: "rgba(25, 28, 29, 0.07)",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  profileStatsSimpleEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  profileStatsWordleCard: {
    backgroundColor: "#fbfffc",
    borderColor: "#9fd9b2",
    borderRadius: 20,
    borderWidth: 1,
    gap: 11,
    paddingHorizontal: 10,
    paddingVertical: 11,
    ...shadows.card
  },
  profileStatsWordleHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  profileStatsWordleEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsWordleTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 23,
    marginTop: 1
  },
  profileStatsWordlePill: {
    backgroundColor: colors.online,
    borderColor: colors.online,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  profileStatsWordlePillText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  profileStatsWordleSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  profileStatsWordleStat: {
    alignItems: "center",
    borderColor: "rgba(25, 28, 29, 0.12)",
    borderRadius: 14,
    borderWidth: 1.5,
    flexBasis: "31%",
    flexGrow: 1,
    minHeight: 56,
    minWidth: 0,
    paddingHorizontal: 5,
    paddingVertical: 7
  },
  profileStatsWordleStatValue: {
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 20
  },
  profileStatsWordleStatLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.35,
    marginTop: 3,
    textAlign: "center",
    textTransform: "uppercase"
  },
  profileStatsDistributionStack: {
    gap: 10
  },
  profileStatsDistributionCard: {
    borderRadius: 17,
    borderWidth: 1.5,
    gap: 9,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 10
  },
  profileStatsDistributionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  profileStatsDistributionTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  profileStatsDistributionEyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.45,
    textTransform: "uppercase"
  },
  profileStatsDistributionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 19,
    marginTop: 1
  },
  profileStatsDistributionPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  profileStatsDistributionPillText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.25,
    textTransform: "uppercase"
  },
  profileStatsWordleTabs: {
    marginHorizontal: -2
  },
  profileStatsWordleTabsContent: {
    gap: 7,
    paddingHorizontal: 2
  },
  profileStatsWordleTab: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 13
  },
  profileStatsWordleTabText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.35,
    textTransform: "uppercase"
  },
  profileStatsWordleTabTextActive: {
    color: "#ffffff"
  },
  profileStatsFilterPanel: {
    backgroundColor: "#f8fbfd",
    borderColor: "rgba(25, 28, 29, 0.07)",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  profileStatsFilterGroup: {
    gap: 6
  },
  profileStatsFilterLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  profileStatsGuessHeaderCompact: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  profileStatsGuessMeta: {
    color: colors.accentDark,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  profileStatsGuessCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.card
  },
  profileStatsGuessHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  profileStatsGuessEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsGuessTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 22,
    marginTop: 1
  },
  profileStatsGuessPill: {
    backgroundColor: "#eef7ff",
    borderColor: "#b7d9f0",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  profileStatsGuessPillText: {
    color: colors.online,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsGuessModeList: {
    gap: 12
  },
  profileStatsGuessMode: {
    gap: 7
  },
  profileStatsGuessModeHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7
  },
  profileStatsGuessModeDot: {
    borderRadius: radii.pill,
    height: 10,
    width: 10
  },
  profileStatsGuessModeTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "900"
  },
  profileStatsGuessModeMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800"
  },
  profileStatsGuessBars: {
    gap: 5
  },
  profileStatsGuessBarRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    minHeight: 24
  },
  profileStatsGuessBarLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    width: 28
  },
  profileStatsGuessBarTrack: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(25, 28, 29, 0.08)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    height: 20,
    overflow: "hidden"
  },
  profileStatsGuessBarFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  profileStatsGuessBarValue: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 17,
    textAlign: "right",
    width: 22
  },
  profileStatsGuessEmpty: {
    backgroundColor: "#f8fbfd",
    borderColor: "rgba(25, 28, 29, 0.07)",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  profileStatsGuessEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  profileStatsFullToggle: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 14
  },
  profileStatsFullToggleText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  profileStatsReturnCard: {
    backgroundColor: "#f7fbff",
    borderColor: "#c6ddef",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.card
  },
  profileStatsReturnHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  profileStatsReturnTitleWrap: {
    flex: 1,
    minWidth: 0
  },
  profileStatsReturnEyebrow: {
    color: colors.online,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsReturnTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 22,
    marginTop: 1
  },
  profileStatsReturnCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3
  },
  profileStatsReturnScorePill: {
    alignItems: "center",
    backgroundColor: colors.online,
    borderRadius: 16,
    minWidth: 58,
    paddingHorizontal: 9,
    paddingVertical: 7
  },
  profileStatsReturnScoreValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  profileStatsReturnScoreLabel: {
    color: "rgba(255, 255, 255, 0.76)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsReturnWeek: {
    flexDirection: "row",
    gap: 6
  },
  profileStatsReturnDay: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(25, 28, 29, 0.08)",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minHeight: 48,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 7
  },
  profileStatsReturnDayActive: {
    backgroundColor: "#edf8ff",
    borderColor: "#8fc6e9"
  },
  profileStatsReturnDayToday: {
    borderColor: colors.danger,
    borderWidth: 2
  },
  profileStatsReturnDayLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase"
  },
  profileStatsReturnDayLabelActive: {
    color: colors.online
  },
  profileStatsReturnDayLabelToday: {
    color: colors.danger
  },
  profileStatsReturnDayDot: {
    backgroundColor: "#d7dddd",
    borderRadius: radii.pill,
    height: 8,
    width: 8
  },
  profileStatsReturnDayDotActive: {
    backgroundColor: colors.online
  },
  profileStatsReturnDayDotToday: {
    backgroundColor: colors.danger,
    height: 9,
    width: 9
  },
  profileStatsReturnChecklist: {
    flexDirection: "row",
    gap: 8
  },
  profileStatsReturnCheck: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(25, 28, 29, 0.08)",
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 0,
    paddingHorizontal: 7
  },
  profileStatsReturnCheckText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  profileStatsReturnFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  profileStatsReturnFooterCopy: {
    flex: 1,
    minWidth: 0
  },
  profileStatsReturnFooterLabel: {
    color: colors.online,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsReturnFooterText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    marginTop: 1
  },
  profileStatsReturnButton: {
    alignItems: "center",
    backgroundColor: colors.online,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12
  },
  profileStatsReturnButtonText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4
  },
  profileStatsDigestCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d7e2e7",
    borderRadius: 22,
    borderWidth: 1,
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...shadows.card
  },
  profileStatsDigestHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  profileStatsDigestEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsDigestTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 20,
    marginTop: 1
  },
  profileStatsDigestToggle: {
    alignItems: "center",
    backgroundColor: "#eef7ff",
    borderColor: "#b7d9f0",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 10
  },
  profileStatsDigestToggleText: {
    color: colors.online,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.35
  },
  profileStatsDigestList: {
    gap: 7
  },
  profileStatsDigestRow: {
    alignItems: "center",
    backgroundColor: "#f8fbfd",
    borderColor: "rgba(25, 28, 29, 0.07)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 50,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  profileStatsDigestIcon: {
    alignItems: "center",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  profileStatsDigestCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0
  },
  profileStatsDigestLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  profileStatsDigestCaption: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  profileStatsDigestValue: {
    fontSize: 14,
    fontWeight: "900",
    maxWidth: 82,
    textAlign: "right"
  },
  profileStatsMomentumCard: {
    backgroundColor: "#fffdf6",
    borderColor: "#f0d890",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.card
  },
  profileStatsMomentumHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  profileStatsMomentumEyebrow: {
    color: "#936700",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsMomentumTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 21,
    marginTop: 1
  },
  profileStatsMomentumLivePill: {
    backgroundColor: "#20292e",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  profileStatsMomentumLiveText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  profileStatsMomentumList: {
    gap: 8
  },
  profileStatsMomentumRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(147, 103, 0, 0.12)",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  profileStatsMomentumIcon: {
    alignItems: "center",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  profileStatsMomentumCopy: {
    flex: 1,
    gap: 1
  },
  profileStatsMomentumRowTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16
  },
  profileStatsMomentumCaption: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  profileStatsMomentumValue: {
    fontSize: 14,
    fontWeight: "900",
    minWidth: 46,
    textAlign: "right"
  },
  profileStatsSprintCard: {
    backgroundColor: "#f2fbf7",
    borderColor: "#aee2c5",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.card
  },
  profileStatsSprintHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  profileStatsSprintEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsSprintTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 23,
    marginTop: 1
  },
  profileStatsSprintCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2
  },
  profileStatsSprintBadge: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 16,
    minWidth: 62,
    paddingHorizontal: 9,
    paddingVertical: 7
  },
  profileStatsSprintBadgeValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  profileStatsSprintBadgeLabel: {
    color: "rgba(255, 255, 255, 0.76)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsSprintTrack: {
    backgroundColor: "rgba(25, 28, 29, 0.08)",
    borderRadius: radii.pill,
    height: 10,
    overflow: "hidden"
  },
  profileStatsSprintFill: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: "100%"
  },
  profileStatsSprintStats: {
    flexDirection: "row",
    gap: 8
  },
  profileStatsSprintStat: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(0, 109, 55, 0.1)",
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 9,
    paddingVertical: 8
  },
  profileStatsSprintStatLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsSprintStatValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2
  },
  profileStatsSprintButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14
  },
  profileStatsSprintButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  profileStatsLeagueCard: {
    backgroundColor: "#f8fbff",
    borderColor: "#c9def1",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.card
  },
  profileStatsLeagueHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11
  },
  profileStatsLeagueBadge: {
    alignItems: "center",
    borderRadius: 20,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  profileStatsLeagueCopy: {
    flex: 1,
    gap: 1
  },
  profileStatsLeagueEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsLeagueTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 24
  },
  profileStatsLeagueCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16
  },
  profileStatsLeagueScorePill: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(25, 28, 29, 0.08)",
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 72,
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  profileStatsLeagueScoreLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsLeagueScoreValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 1
  },
  profileStatsLeagueTrack: {
    backgroundColor: "rgba(25, 28, 29, 0.08)",
    borderRadius: radii.pill,
    height: 10,
    overflow: "hidden"
  },
  profileStatsLeagueFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  profileStatsLeagueSteps: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between"
  },
  profileStatsLeagueStep: {
    alignItems: "center",
    flex: 1,
    gap: 4,
    minWidth: 0
  },
  profileStatsLeagueStepDot: {
    borderColor: "#ffffff",
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 14,
    width: 14
  },
  profileStatsLeagueStepLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase"
  },
  profileStatsRunPlanCard: {
    backgroundColor: "#f5fff9",
    borderColor: "#b9e7c9",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.card
  },
  profileStatsRunPlanHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  profileStatsRunPlanEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsRunPlanTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 22,
    marginTop: 1
  },
  profileStatsRunPlanCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2
  },
  profileStatsRunPlanPace: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 16,
    minWidth: 68,
    paddingHorizontal: 9,
    paddingVertical: 7
  },
  profileStatsRunPlanPaceLabel: {
    color: "rgba(255, 255, 255, 0.76)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsRunPlanPaceValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 1
  },
  profileStatsRunPlanRows: {
    gap: 7
  },
  profileStatsRunPlanRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(0, 109, 55, 0.1)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  profileStatsRunPlanRowHit: {
    backgroundColor: "#eafff0",
    borderColor: "#85d99e"
  },
  profileStatsRunPlanRowLeft: {
    flex: 1,
    gap: 1
  },
  profileStatsRunPlanRowLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  profileStatsRunPlanRowMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  profileStatsRunPlanRowResult: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right"
  },
  profileStatsRunPlanRowResultHit: {
    color: colors.accent
  },
  profileStatsRunPlanButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14
  },
  profileStatsRunPlanButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  profileStatsRewardCard: {
    backgroundColor: "#fff9f0",
    borderColor: "#f2d49a",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.card
  },
  profileStatsRewardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  profileStatsRewardEyebrow: {
    color: "#9a6800",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsRewardTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 22,
    marginTop: 1
  },
  profileStatsRewardCountPill: {
    backgroundColor: "#20292e",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  profileStatsRewardCountText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsRewardGrid: {
    gap: 8
  },
  profileStatsRewardItem: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(154, 104, 0, 0.12)",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  profileStatsRewardIcon: {
    alignItems: "center",
    borderRadius: 15,
    height: 31,
    justifyContent: "center",
    width: 31
  },
  profileStatsRewardCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  profileStatsRewardTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  profileStatsRewardItemTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "900"
  },
  profileStatsRewardLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsRewardCaption: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  profileStatsRivalCard: {
    backgroundColor: "#fff5f5",
    borderColor: "#f0b7b7",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.card
  },
  profileStatsRivalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  profileStatsRivalEyebrow: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsRivalTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 22,
    marginTop: 1
  },
  profileStatsRivalRankPill: {
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  profileStatsRivalRankText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsRivalRows: {
    gap: 8
  },
  profileStatsRivalRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(186, 26, 26, 0.12)",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 72,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  profileStatsRivalIcon: {
    alignItems: "center",
    borderRadius: 15,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  profileStatsRivalCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0
  },
  profileStatsRivalRowLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsRivalName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  profileStatsRivalCaption: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  profileStatsRivalBadge: {
    fontSize: 13,
    fontWeight: "900",
    minWidth: 48,
    textAlign: "right"
  },
  profileStatsRivalButton: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14
  },
  profileStatsRivalButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  profileStatsChaseCard: {
    backgroundColor: "#20292e",
    borderColor: "#101719",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.tactile
  },
  profileStatsChaseHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12
  },
  profileStatsChaseIcon: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: 18,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  profileStatsChaseCopy: {
    flex: 1,
    gap: 2
  },
  profileStatsChaseEyebrow: {
    color: "#a7f3c5",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  profileStatsChaseTitle: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 25
  },
  profileStatsChaseCaption: {
    color: "#c9d7d2",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2
  },
  profileStatsChaseMeterTrack: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: radii.pill,
    height: 11,
    overflow: "hidden"
  },
  profileStatsChaseMeterFill: {
    backgroundColor: colors.warning,
    borderRadius: radii.pill,
    height: "100%"
  },
  profileStatsChaseStats: {
    flexDirection: "row",
    gap: 8
  },
  profileStatsChaseStat: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 9,
    paddingVertical: 9
  },
  profileStatsChaseStatLabel: {
    color: "#aebdb7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsChaseStatValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 3
  },
  profileStatsLeaderboardList: {
    gap: 7
  },
  profileStatsLeaderboardRow: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  profileStatsLeaderboardRowPlayer: {
    backgroundColor: colors.accent,
    borderColor: "#74efaa"
  },
  profileStatsLeaderboardRank: {
    color: "#cddbd5",
    fontSize: 13,
    fontWeight: "900",
    width: 34
  },
  profileStatsLeaderboardAvatar: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  profileStatsLeaderboardAvatarPlayer: {
    backgroundColor: "rgba(255, 255, 255, 0.2)"
  },
  profileStatsLeaderboardAvatarText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900"
  },
  profileStatsLeaderboardCopy: {
    flex: 1,
    gap: 1
  },
  profileStatsLeaderboardNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  profileStatsLeaderboardName: {
    color: "#ffffff",
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "900"
  },
  profileStatsLeaderboardMeta: {
    color: "#b4c4be",
    fontSize: 11,
    fontWeight: "700"
  },
  profileStatsLeaderboardMetaPlayer: {
    color: "rgba(255, 255, 255, 0.82)"
  },
  profileStatsLeaderboardYouPill: {
    backgroundColor: "#ffffff",
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  profileStatsLeaderboardYouText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  profileStatsLeaderboardPoints: {
    color: "#a7f3c5",
    fontSize: 13,
    fontWeight: "900"
  },
  profileStatsLeaderboardTextPlayer: {
    color: "#ffffff"
  },
  profileStatsLeaderboardEmpty: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  profileStatsLeaderboardEmptyText: {
    color: "#c9d7d2",
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  profileStatsChaseButton: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16
  },
  profileStatsChaseButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  profileStatsMissionGrid: {
    gap: 8
  },
  profileStatsMissionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...shadows.card
  },
  profileStatsMissionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  profileStatsMissionIcon: {
    alignItems: "center",
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  profileStatsMissionAction: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsMissionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 19
  },
  profileStatsMissionCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  profileStatsMissionTrack: {
    backgroundColor: "rgba(25, 28, 29, 0.08)",
    borderRadius: radii.pill,
    height: 8,
    marginTop: 2,
    overflow: "hidden"
  },
  profileStatsMissionFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  profileStatsFeatureCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.card
  },
  profileStatsSectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  profileStatsSectionHeaderCompact: {
    flexDirection: "column"
  },
  profileStatsSectionEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsSectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 23
  },
  profileStatsChip: {
    backgroundColor: colors.surfaceCool,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  profileStatsChipText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsChart: {
    gap: 10
  },
  profileStatsChartRow: {
    gap: 5
  },
  profileStatsChartHead: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  profileStatsChartDot: {
    borderRadius: radii.pill,
    height: 10,
    width: 10
  },
  profileStatsChartLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "800"
  },
  profileStatsChartScore: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  profileStatsChartTrack: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    height: 12,
    overflow: "hidden"
  },
  profileStatsChartFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  profileStatsChartMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  profileStatsModeList: {
    gap: 10
  },
  profileStatsModeCard: {
    backgroundColor: "#f8fafa",
    borderColor: colors.surfaceAlt,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  profileStatsModeHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  profileStatsModeIdentity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10
  },
  profileStatsModeBadge: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  profileStatsModeBadgeCore: {
    borderRadius: radii.pill,
    height: 12,
    width: 12
  },
  profileStatsModeCopy: {
    flex: 1,
    gap: 1
  },
  profileStatsModeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  profileStatsModeMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  profileStatsModeMetrics: {
    alignItems: "flex-end",
    marginLeft: 10
  },
  profileStatsModeMetricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20
  },
  profileStatsModeMetricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  profileStatsModeBarTrack: {
    backgroundColor: "rgba(25, 28, 29, 0.08)",
    borderRadius: radii.pill,
    height: 10,
    overflow: "hidden"
  },
  profileStatsModeBarFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  profileStatsModeFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  profileStatsModeFooterText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  profileStatsMatchRow: {
    alignItems: "center",
    borderTopColor: colors.surfaceAlt,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingTop: 10
  },
  profileStatsMatchPill: {
    alignItems: "center",
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 28,
    minWidth: 64,
    paddingHorizontal: 10
  },
  profileStatsMatchPillText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4
  },
  profileStatsMatchCopy: {
    flex: 1,
    gap: 2
  },
  profileStatsMatchTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  profileStatsMatchSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  profileStatsEmptyState: {
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    borderRadius: 20,
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 18
  },
  profileStatsEmptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  profileStatsEmptyCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center"
  },
  profilePanelEmpty: {
    alignSelf: "flex-start",
    backgroundColor: "transparent",
    minHeight: 132,
    marginTop: 8
  },
  profilePanelTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  profileNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 8
  },
  profileNameInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    minHeight: 42,
    paddingHorizontal: 12
  },
  profileNameAction: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: 42,
    justifyContent: "center",
    width: 42,
    ...shadows.card
  },
  profileNameActionDisabled: {
    opacity: 0.45
  },
  profileDivider: {
    backgroundColor: colors.surfaceMuted,
    height: 1,
    marginHorizontal: 8,
    opacity: 1
  },
  profilePanelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between",
    marginHorizontal: 8
  },
  profilePanelHeaderCopy: {
    flex: 1,
    gap: 2
  },
  profilePanelCaption: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  profileCurrentBadge: {
    backgroundColor: colors.surfaceCool,
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 4
  },
  profileCurrentBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  avatarTabs: {
    alignItems: "center",
    backgroundColor: "#f6f4ee",
    borderColor: "#ede6d5",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    marginHorizontal: 8,
    padding: 4
  },
  avatarTab: {
    alignItems: "center",
    borderRadius: radii.pill,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    height: 34,
    justifyContent: "center",
    paddingHorizontal: 8
  },
  avatarTabActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ead8a3",
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#8f6b14",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 5
  },
  avatarTabPremium: {
    backgroundColor: "#fff7dc"
  },
  avatarTabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900"
  },
  avatarTabTextActive: {
    color: "#1f2933"
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
    rowGap: 10
  },
  avatarGridCompact: {
    rowGap: 8
  },
  avatarOption: {
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 2,
    minHeight: 82,
    position: "relative",
    width: "20%"
  },
  avatarOptionPremium: {
    minHeight: 82,
    width: "20%"
  },
  avatarOptionSelected: {
    transform: [{ scale: 1.02 }]
  },
  avatarOptionDisabled: {
    opacity: 0.45
  },
  avatarOptionFrame: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  avatarOptionInner: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 2.5,
    height: 52,
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    width: 52
  },
  avatarOptionInnerPremium: {
    borderWidth: 3,
    elevation: 4,
    shadowColor: "#8f6b14",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 6
  },
  avatarOptionInnerLocked: {
    opacity: 0.78
  },
  avatarOptionImage: {
    height: "100%",
    width: "100%"
  },
  avatarOptionLockedScrim: {
    backgroundColor: "rgba(12, 10, 24, 0.42)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  avatarOptionLock: {
    alignItems: "center",
    backgroundColor: "#1f2933",
    borderColor: "#ffd66b",
    borderRadius: radii.pill,
    borderWidth: 1.5,
    elevation: 3,
    height: 17,
    justifyContent: "center",
    position: "absolute",
    right: -2,
    top: -2,
    width: 17,
    zIndex: 2
  },
  avatarOptionCheck: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderColor: "#ffffff",
    borderRadius: radii.pill,
    borderWidth: 2,
    bottom: -2,
    elevation: 3,
    height: 17,
    justifyContent: "center",
    position: "absolute",
    right: -2,
    shadowColor: "#063c2d",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    width: 17,
    zIndex: 2
  },
  avatarPricePill: {
    alignItems: "center",
    backgroundColor: "#24180b",
    borderColor: "#e9c356",
    borderRadius: radii.pill,
    borderWidth: 1.4,
    elevation: 4,
    flexDirection: "row",
    gap: 3,
    height: 21,
    justifyContent: "center",
    maxWidth: "94%",
    minWidth: 58,
    overflow: "hidden",
    paddingLeft: 4,
    paddingRight: 7,
    position: "absolute",
    bottom: -8,
    shadowColor: "#4b3006",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    zIndex: 3
  },
  avatarPricePillAffordable: {
    backgroundColor: "#2c210d",
    borderColor: "#f4d67a"
  },
  avatarPricePillInsufficient: {
    backgroundColor: "#291918",
    borderColor: "#d58b7c"
  },
  avatarPriceShine: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: radii.pill,
    height: 1,
    left: 8,
    position: "absolute",
    right: 8,
    top: 2
  },
  avatarPriceCoinWell: {
    alignItems: "center",
    backgroundColor: "rgba(255, 232, 154, 0.22)",
    borderColor: "rgba(255, 232, 154, 0.38)",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 16,
    justifyContent: "center",
    width: 16
  },
  avatarPriceText: {
    color: "#fff8df",
    fontSize: 9,
    fontWeight: "900",
    maxWidth: 42,
    textAlign: "center"
  },
  avatarLevelPill: {
    alignItems: "center",
    backgroundColor: "#243043",
    borderColor: "#9fb0c7",
    borderRadius: radii.pill,
    borderWidth: 1.4,
    bottom: -8,
    elevation: 4,
    flexDirection: "row",
    gap: 3,
    height: 21,
    justifyContent: "center",
    minWidth: 58,
    overflow: "hidden",
    paddingHorizontal: 7,
    position: "absolute",
    shadowColor: "#0f172a",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    zIndex: 3
  },
  avatarLevelShine: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: radii.pill,
    height: 1,
    left: 8,
    position: "absolute",
    right: 8,
    top: 2
  },
  avatarLevelText: {
    color: "#f8fafc",
    fontSize: 9,
    fontWeight: "900"
  },
  avatarConfirmBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.46)",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  avatarConfirmCard: {
    backgroundColor: "#ffffff",
    borderColor: "#f0e2bd",
    borderRadius: 18,
    borderWidth: 1,
    elevation: 8,
    gap: 14,
    maxWidth: 360,
    padding: 18,
    shadowColor: "#1f2933",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    width: "100%"
  },
  avatarConfirmHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  avatarConfirmPreview: {
    borderRadius: radii.pill,
    borderWidth: 3,
    elevation: 4,
    height: 70,
    overflow: "hidden",
    shadowColor: "#8f6b14",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    width: 70
  },
  avatarConfirmImage: {
    height: "100%",
    width: "100%"
  },
  avatarConfirmCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0
  },
  avatarConfirmEyebrow: {
    color: "#9a6b08",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  avatarConfirmTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  avatarConfirmText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  avatarConfirmCostPanel: {
    backgroundColor: "#fff9e9",
    borderColor: "#f1dfaa",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  avatarConfirmCostRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  avatarConfirmCostLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  avatarConfirmCoinValue: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  avatarConfirmCostValue: {
    color: "#2a2110",
    fontSize: 15,
    fontWeight: "900"
  },
  avatarConfirmBalanceValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  avatarConfirmActions: {
    flexDirection: "row",
    gap: 10
  },
  avatarConfirmCancelButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceCool,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 42,
    justifyContent: "center"
  },
  avatarConfirmUnlockButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    elevation: 3,
    flex: 1.2,
    flexDirection: "row",
    gap: 6,
    height: 42,
    justifyContent: "center",
    shadowColor: "#063c2d",
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 6
  },
  avatarConfirmButtonDisabled: {
    opacity: 0.62
  },
  avatarConfirmCancelText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900"
  },
  avatarConfirmUnlockText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900"
  },
  settingsActionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  settingsPane: {
    gap: 10,
    paddingHorizontal: 2,
    paddingTop: 2
  },
  settingsCard: {
    borderColor: "rgba(31, 41, 55, 0.05)",
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10
  },
  settingsActionCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  settingsActionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  settingsDivider: {
    backgroundColor: colors.surfaceMuted,
    height: 1,
    marginVertical: 4,
    opacity: 0.8
  },
  settingsIconButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderBottomColor: "#025a29",
    borderBottomWidth: 3,
    borderRadius: radii.pill,
    height: 40,
    justifyContent: "center",
    width: 48
  },
  settingsIconButtonDisabled: {
    opacity: 0.45
  },
  settingsTextButton: {
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 94,
    paddingHorizontal: 13
  },
  settingsTextButtonLabel: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "900",
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 15
  },
  settingsNotice: {
    alignItems: "center",
    backgroundColor: colors.surfaceCool,
    borderRadius: 12,
    flexDirection: "row",
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  settingsMessage: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16
  },
  settingsAppCard: {
    gap: 7
  },
  settingsAppRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    minHeight: 34
  },
  settingsAppIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceCool,
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  settingsAppName: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    minWidth: 0
  },
  settingsAppVersion: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800"
  },
  bottomDock: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs
  },
  modalSwitchRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  modalSwitchLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  inlineError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    marginHorizontal: 8
  },
  errorText: {
    color: colors.danger
  },
  pressed: {
    opacity: 0.84
  }
});
