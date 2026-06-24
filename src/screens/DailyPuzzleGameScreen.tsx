import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader, HeaderBackButton, HeaderCoinsPill, HeaderDateBadge } from "../components/AppHeader";
import { BoosterIcon } from "../components/BoosterIcon";
import { CoinIcon } from "../components/CoinIcon";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { GameStartCountdown } from "../components/GameStartCountdown";
import { RankMedal } from "../components/RankMedal";
import { ScreenContainer } from "../components/ScreenContainer";
import { profileAvatarOptions } from "../config/avatarCatalog";
import { useGameStartCountdown } from "../hooks/useGameStartCountdown";
import { maybeShowPendingInterstitialAd, recordInterstitialOpportunity } from "../services/interstitialAd";
import { isRewardedReviveSupported, showRewardedReviveAd } from "../services/rewardedReviveAd";
import { playResultSound, playSound } from "../services/soundEffects";
import { useMonetizationStore } from "../store/useMonetizationStore";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { GuessFeedback } from "../types/game.types";
import type { DailyPuzzleLeaderboardEntry, DailyPuzzleLeaderboardResponse, MatchRecord } from "../types/progression.types";
import { formatDuration } from "../utils/progression";
import { colors, radii, shadows, spacing } from "../utils/theme";
import {
  DAILY_PUZZLE_DEFAULT_MAX,
  getDeterministicDailyPuzzleNumber,
  getUtcTodayKey,
  isTodayPuzzleDate
} from "../utils/dailyPuzzle";

interface GuessEntry {
  counted: boolean;
  guess: number;
  result: GuessFeedback;
}

const keypadRows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["clear", "0", "backspace"]
] as const;

const dailyResultAvatarById = new Map(profileAvatarOptions.map((option) => [option.id, option]));

const getDailyResultRewardLabel = (entry: DailyPuzzleLeaderboardEntry) => {
  if (!entry.rewardEligible || entry.rewardCoins <= 0) {
    return null;
  }

  const rewardCoins = entry.rewardCoinsAwarded > 0 ? entry.rewardCoinsAwarded : entry.rewardCoins;
  return `+${rewardCoins.toLocaleString("en-US")}`;
};

function DailyResultLeaderboardRow({
  entry,
  isDetachedPlayer = false,
  playerDisplayName
}: {
  entry: DailyPuzzleLeaderboardEntry;
  isDetachedPlayer?: boolean;
  playerDisplayName?: string;
}) {
  const avatar = dailyResultAvatarById.get(entry.avatarId) ?? profileAvatarOptions[0];
  const rewardLabel = getDailyResultRewardLabel(entry);
  const isPlayerRow = Boolean(entry.isPlayer || isDetachedPlayer);
  const displayName = isPlayerRow && playerDisplayName ? playerDisplayName : entry.name;

  return (
    <View style={[styles.dailyResultRankRow, isPlayerRow && styles.dailyResultRankRowPlayer]}>
      <RankMedal rank={entry.rank} size={entry.rank === 1 ? 54 : 50} />

      <View style={[styles.dailyResultAvatarFrame, { backgroundColor: avatar.background, borderColor: avatar.ring }]}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={{ cache: "force-cache", uri: avatar.imageUrl }}
          style={styles.dailyResultAvatarImage}
        />
      </View>

      <View style={styles.dailyResultPlayerCopy}>
        <View style={styles.dailyResultNameLine}>
          <Text numberOfLines={1} style={[styles.dailyResultPlayerName, isPlayerRow && styles.dailyResultPlayerNameActive]}>
            {displayName}
          </Text>
          {entry.isPlayer ? (
            <View style={styles.dailyResultYouBadge}>
              <Text style={styles.dailyResultYouBadgeText}>You</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.dailyResultPlayerMeta, isPlayerRow && styles.dailyResultPlayerMetaActive]}>
          {formatDuration(entry.durationMs)}
        </Text>
      </View>

      <View style={styles.dailyResultScoreStack}>
        <View style={[styles.dailyResultGuessPill, isPlayerRow && styles.dailyResultGuessPillPlayer]}>
          <Text style={[styles.dailyResultGuessValue, isPlayerRow && styles.dailyResultTextLight]}>{entry.attempts}</Text>
          <Text style={[styles.dailyResultGuessLabel, isPlayerRow && styles.dailyResultTextSoft]}>guesses</Text>
        </View>
        {rewardLabel ? (
          <View style={styles.dailyResultRewardPill}>
            <CoinIcon size={12} />
            <Text style={styles.dailyResultRewardText}>{rewardLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function DailyPuzzleGameScreen() {
  const params = useLocalSearchParams<{ dateKey?: string; replayAccess?: string }>();
  const hydrated = usePlayerProgressStore((state) => state.hydrated);
  const fetchDailyPuzzleStatus = usePlayerProgressStore((state) => state.fetchDailyPuzzleStatus);
  const fetchDailyPuzzleLeaderboard = usePlayerProgressStore((state) => state.fetchDailyPuzzleLeaderboard);
  const submitDailyPuzzleGuess = usePlayerProgressStore((state) => state.submitDailyPuzzleGuess);
  const recordMatch = usePlayerProgressStore((state) => state.recordMatch);
  const saveDailyPuzzleCompletionLocal = usePlayerProgressStore((state) => state.saveDailyPuzzleCompletionLocal);
  const consumeExtraGuessPowerUp = usePlayerProgressStore((state) => state.consumeExtraGuessPowerUp);
  const consumeSkipBooster = usePlayerProgressStore((state) => state.consumeSkipBooster);
  const dailyPuzzleTodayKey = usePlayerProgressStore((state) => state.dailyPuzzleTodayKey);
  const dailyPuzzleMaxNumber = usePlayerProgressStore((state) => state.dailyPuzzleMaxNumber);
  const displayName = usePlayerProgressStore((state) => state.displayName);
  const profile = usePlayerProgressStore((state) => state.profile);
  const extraGuessPowerUps = usePlayerProgressStore((state) => state.profile.extraGuessPowerUps);
  const skipBoosters = usePlayerProgressStore((state) => state.profile.skipBoosters);
  const hasNoAdsEntitlement = useMonetizationStore((state) => state.hasNoAdsEntitlement);
  const countdown = useGameStartCountdown();
  const { countdownActive, startCountdown } = countdown;
  const canShowRewardedRevive = isRewardedReviveSupported();

  const requestedDateKey = typeof params.dateKey === "string" ? params.dateKey : getUtcTodayKey();
  const requestedDateIsToday = isTodayPuzzleDate(requestedDateKey);
  const requestedDateIsReplayUnlocked =
    requestedDateKey < getUtcTodayKey() && (params.replayAccess === "ad" || params.replayAccess === "coins");
  const requestedDateIsPlayable = requestedDateIsToday || requestedDateIsReplayUnlocked;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingOfflineFallback, setUsingOfflineFallback] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [puzzleDateKey, setPuzzleDateKey] = useState<string | null>(requestedDateKey);
  const [maxNumber, setMaxNumber] = useState(dailyPuzzleMaxNumber || DAILY_PUZZLE_DEFAULT_MAX);
  const [guess, setGuess] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<GuessFeedback | null>(null);
  const [guessHistory, setGuessHistory] = useState<GuessEntry[]>([]);
  const [matchSummary, setMatchSummary] = useState<MatchRecord | null>(null);
  const [powerUpMessage, setPowerUpMessage] = useState<string | null>(null);
  const [freeGuessCredits, setFreeGuessCredits] = useState(0);
  const [powerUpAction, setPowerUpAction] = useState<
    "extra-inventory" | "extra-ad" | "skip-inventory" | "skip-ad" | null
  >(null);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<DailyPuzzleLeaderboardResponse | null>(null);
  const [dailyLeaderboardLoading, setDailyLeaderboardLoading] = useState(false);
  const [dailyLeaderboardError, setDailyLeaderboardError] = useState<string | null>(null);
  const startedAtRef = useRef(Date.now());

  const completedByDate = profile.dailyPuzzle?.completedByDate ?? {};
  const completion = puzzleDateKey ? completedByDate[puzzleDateKey] ?? null : null;
  const completed = Boolean(completion);
  const hasRequestedDateCompletion = Boolean(completedByDate[requestedDateKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let isMounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const response = await fetchDailyPuzzleStatus(requestedDateKey);

        if (!isMounted) {
          return;
        }

        setUsingOfflineFallback(false);
        setPuzzleDateKey(response.todayKey);
        setMaxNumber(response.maxNumber);
        startedAtRef.current = Date.now();

        if (!response.todayCompletion) {
          startCountdown();
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setUsingOfflineFallback(true);
        setLoadError(error instanceof Error ? error.message : "Please try again later.");
        setPuzzleDateKey(requestedDateKey);
        setMaxNumber(DAILY_PUZZLE_DEFAULT_MAX);
        startedAtRef.current = Date.now();

        if (!hasRequestedDateCompletion) {
          startCountdown();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load().catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [fetchDailyPuzzleStatus, hasRequestedDateCompletion, hydrated, reloadKey, requestedDateKey, startCountdown]);

  useEffect(() => {
    if (dailyPuzzleTodayKey && !params.dateKey) {
      setPuzzleDateKey(dailyPuzzleTodayKey);
    }
  }, [dailyPuzzleTodayKey, params.dateKey]);

  useEffect(() => {
    if (dailyPuzzleMaxNumber) {
      setMaxNumber(dailyPuzzleMaxNumber);
    }
  }, [dailyPuzzleMaxNumber]);

  useEffect(() => {
    if (matchSummary || !puzzleDateKey) {
      return;
    }

    if (profile.lastMatchSummary && profile.lastMatchSummary.mode === "daily" && completedByDate[puzzleDateKey]) {
      setMatchSummary(profile.lastMatchSummary);
    }
  }, [completedByDate, matchSummary, profile.lastMatchSummary, puzzleDateKey]);

  useEffect(() => {
    if (!hydrated || !completed || !puzzleDateKey) {
      return;
    }

    let isMounted = true;

    const loadLeaderboard = async () => {
      try {
        setDailyLeaderboardLoading(true);
        setDailyLeaderboardError(null);
        const response = await fetchDailyPuzzleLeaderboard(puzzleDateKey);

        if (isMounted) {
          setDailyLeaderboard(response);
        }
      } catch (error) {
        if (isMounted) {
          setDailyLeaderboard(null);
          setDailyLeaderboardError(error instanceof Error ? error.message : "Could not load the daily leaderboard.");
        }
      } finally {
        if (isMounted) {
          setDailyLeaderboardLoading(false);
        }
      }
    };

    loadLeaderboard().catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [completed, fetchDailyPuzzleLeaderboard, hydrated, puzzleDateKey]);

  const digitLimit = String(maxNumber).length;
  const countedAttempts = guessHistory.filter((entry) => entry.counted).length;
  const attemptsCount = completed && completion ? completion.attempts : countedAttempts;
  const recentGuesses = guessHistory.slice(0, 2);
  const guessDisplayValue = completed ? "WIN" : guess.length > 0 ? guess : "--";
  const statusState = completed
    ? {
        color: "#1fc46d",
        detail: completion ? `Solved in ${completion.attempts} | ${formatDuration(completion.durationMs)}` : "Saved for today.",
        icon: "checkmark" as const,
        label: "BOARD CLEAR"
      }
    : lastFeedback === "higher"
      ? {
          color: "#ff8a6a",
          detail: "Aim above your last guess.",
          icon: "arrow-up" as const,
          label: "HIGHER"
        }
      : lastFeedback === "lower"
        ? {
            color: "#61b7ff",
            detail: "Bring the next guess down.",
            icon: "arrow-down" as const,
            label: "LOWER"
          }
        : {
            color: countdownActive ? "#8b9298" : colors.accent,
            detail: countdownActive ? "Board opening..." : "Pick your first number.",
            icon: countdownActive ? ("timer-outline" as const) : ("remove" as const),
            label: countdownActive ? "GET READY" : "READY"
          };
  const statusMeta =
    errorMessage ??
    (usingOfflineFallback ? loadError ?? "Server sync is offline. Your local board still stays consistent for today." : null) ??
    powerUpMessage ??
    statusState.detail;
  const isUsingPowerUp = powerUpAction !== null;
  const ctaDisabled = countdownActive || isSubmitting || isUsingPowerUp || guess.length === 0;
  const canTriggerExtraGuess =
    !completed && !countdownActive && !isSubmitting && !isUsingPowerUp && (extraGuessPowerUps > 0 || canShowRewardedRevive);
  const canTriggerSkipBooster =
    !completed && !countdownActive && !isSubmitting && !isUsingPowerUp && (skipBoosters > 0 || canShowRewardedRevive);
  const detachedDailyResultPlayerEntry = useMemo(() => {
    if (!dailyLeaderboard?.playerEntry) {
      return null;
    }

    return dailyLeaderboard.topEntries.some((entry) => entry.playerKey === dailyLeaderboard.playerEntry?.playerKey)
      ? null
      : dailyLeaderboard.playerEntry;
  }, [dailyLeaderboard]);

  const submitGuess = async () => {
    if (countdownActive || isSubmitting || completed || !puzzleDateKey || !requestedDateIsPlayable) {
      return;
    }

    const parsedGuess = Number(guess);

    if (!Number.isInteger(parsedGuess) || parsedGuess < 1 || parsedGuess > maxNumber) {
      playSound("error");
      setErrorMessage(`Use a number from 1 to ${maxNumber}.`);
      return;
    }

    const usesFreeGuess = freeGuessCredits > 0;
    const attempts = Math.max(1, countedAttempts + (usesFreeGuess ? 0 : 1));
    const durationMs = Date.now() - startedAtRef.current;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setPowerUpMessage(null);
      playSound("guessLock");

      const response = await submitDailyPuzzleGuess({
        dateKey: puzzleDateKey,
        guess: parsedGuess,
        attempts,
        durationMs
      });

      if (response.feedback === "already-solved") {
        setMatchSummary(response.record);
        setLastFeedback("correct");
        setGuess("");
        playSound("victory");
        return;
      }

      const feedback: GuessFeedback = response.feedback;

      setUsingOfflineFallback(false);
      setLastFeedback(feedback);
      if (usesFreeGuess) {
        setFreeGuessCredits((currentCredits) => Math.max(0, currentCredits - 1));
      }
      setGuessHistory((currentHistory) => [
        { counted: !usesFreeGuess || feedback === "correct", guess: parsedGuess, result: feedback },
        ...currentHistory
      ]);
      setGuess("");
      playResultSound(feedback);

      if (feedback === "correct") {
        setMatchSummary(response.record);
        playSound("victory");
        playSound("coinReward");
        if (!hasNoAdsEntitlement) {
          recordInterstitialOpportunity();
          await maybeShowPendingInterstitialAd();
        }
      }
    } catch (error) {
      const offlineSecret = getDeterministicDailyPuzzleNumber(puzzleDateKey, maxNumber);
      const feedback: GuessFeedback =
        parsedGuess === offlineSecret ? "correct" : parsedGuess < offlineSecret ? "higher" : "lower";

      setUsingOfflineFallback(true);
      setLoadError(error instanceof Error ? error.message : "Server sync unavailable.");
      setLastFeedback(feedback);
      if (usesFreeGuess) {
        setFreeGuessCredits((currentCredits) => Math.max(0, currentCredits - 1));
      }
      setGuessHistory((currentHistory) => [
        { counted: !usesFreeGuess || feedback === "correct", guess: parsedGuess, result: feedback },
        ...currentHistory
      ]);
      setGuess("");
      playResultSound(feedback);

      if (feedback === "correct") {
        try {
          const offlineRecord = await recordMatch({
            category: "single-player",
            mode: "daily",
            difficulty: "impossible",
            outcome: "win",
            attempts,
            durationMs,
            opponentName: "Daily Board",
            opponentPersona: `LOCAL ${puzzleDateKey}`
          });

          await saveDailyPuzzleCompletionLocal({
            dateKey: puzzleDateKey,
            attempts,
            durationMs,
            recordId: offlineRecord.id
          });

          setMatchSummary(offlineRecord);
          playSound("victory");
          playSound("coinReward");
          if (!hasNoAdsEntitlement) {
            recordInterstitialOpportunity();
            await maybeShowPendingInterstitialAd();
          }
        } catch (fallbackError) {
          playSound("error");
          setErrorMessage(
            fallbackError instanceof Error
              ? fallbackError.message
              : "Could not save the local daily puzzle result."
          );
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const appendDigit = (digit: string) => {
    if (countdownActive || isSubmitting || completed || guess.length >= digitLimit) {
      return;
    }

    playSound("numberKey");
    setGuess((currentGuess) => `${currentGuess}${digit}`);
    setErrorMessage(null);
    setPowerUpMessage(null);
  };

  const removeDigit = () => {
    if (countdownActive || isSubmitting || completed) {
      return;
    }

    playSound("erase");
    setGuess((currentGuess) => currentGuess.slice(0, -1));
    setErrorMessage(null);
    setPowerUpMessage(null);
  };

  const clearDigit = () => {
    if (countdownActive || isSubmitting || completed) {
      return;
    }

    playSound("clear");
    setGuess("");
    setErrorMessage(null);
    setPowerUpMessage(null);
  };

  const renderKey = (key: (typeof keypadRows)[number][number]) => {
    const disabled = countdownActive || isSubmitting || completed;
    const label =
      key === "backspace" ? (
        <Ionicons color="#6b7075" name="backspace-outline" size={20} />
      ) : key === "clear" ? (
        <Ionicons color="#6b7075" name="close" size={20} />
      ) : (
        <Text style={styles.keyText}>{key}</Text>
      );

    const onPress =
      key === "backspace"
        ? removeDigit
        : key === "clear"
          ? clearDigit
          : () => appendDigit(key);

    return (
      <Pressable
        accessibilityLabel={key === "backspace" ? "Backspace" : key === "clear" ? "Clear" : `Number ${key}`}
        disabled={disabled}
        key={key}
        onPress={onPress}
        style={({ pressed }) => [styles.keyButton, pressed && !disabled && styles.keyButtonPressed, disabled && styles.keyButtonDisabled]}
      >
        {label}
      </Pressable>
    );
  };

  const grantExtraGuess = (source: "inventory" | "ad") => {
    setFreeGuessCredits((currentCredits) => currentCredits + 1);
    setErrorMessage(null);
    setPowerUpMessage(source === "inventory" ? "Extra guess power-up used." : "Reward unlocked. Your next miss is free.");
    playSound("powerup");
  };

  const completeDailyPuzzleWithSkip = async (source: "inventory" | "ad") => {
    if (!puzzleDateKey || !requestedDateIsPlayable) {
      return;
    }

    const durationMs = Date.now() - startedAtRef.current;
    const attempts = Math.max(1, countedAttempts + 1);

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setPowerUpMessage(null);

      const response = await submitDailyPuzzleGuess({
        attempts,
        dateKey: puzzleDateKey,
        durationMs,
        guess: 1,
        rewardedSkip: true
      });

      setUsingOfflineFallback(false);
      setGuess("");
      setLastFeedback("correct");
      setMatchSummary(response.record);
      playSound("victory");
      playSound("coinReward");
      setPowerUpMessage(source === "inventory" ? "Skip booster cleared today's board." : "Reward unlocked. Today's board is cleared.");
    } catch (error) {
      const secretNumber = getDeterministicDailyPuzzleNumber(puzzleDateKey, maxNumber);

      try {
        const offlineRecord = await recordMatch({
          category: "single-player",
          mode: "daily",
          difficulty: "impossible",
          outcome: "win",
          attempts,
          durationMs,
          opponentName: "Daily Board",
          opponentPersona: `LOCAL SKIP ${puzzleDateKey}`
        });

        await saveDailyPuzzleCompletionLocal({
          dateKey: puzzleDateKey,
          attempts,
          durationMs,
          recordId: offlineRecord.id
        });

        setUsingOfflineFallback(true);
        setLoadError(error instanceof Error ? error.message : "Server sync unavailable.");
        setGuess("");
        setLastFeedback("correct");
        setGuessHistory((currentHistory) => [
          { counted: true, guess: secretNumber, result: "correct" },
          ...currentHistory
        ]);
        setMatchSummary(offlineRecord);
        playSound("victory");
        playSound("coinReward");
        setPowerUpMessage(source === "inventory" ? "Skip booster cleared the local board." : "Reward unlocked. Local board cleared.");
      } catch (fallbackError) {
        playSound("error");
        setErrorMessage(fallbackError instanceof Error ? fallbackError.message : "Could not apply skip reward.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePowerUpPress = async (kind: "extra" | "skip") => {
    if (kind === "extra" && !canTriggerExtraGuess) {
      playSound("error");
      return;
    }

    if (kind === "skip" && !canTriggerSkipBooster) {
      playSound("error");
      return;
    }

    if (kind === "extra" && extraGuessPowerUps > 0) {
      try {
        setPowerUpAction("extra-inventory");
        const used = await consumeExtraGuessPowerUp();

        if (!used) {
          playSound("error");
          setPowerUpMessage("That power-up could not be used right now.");
          return;
        }

        grantExtraGuess("inventory");
      } finally {
        setPowerUpAction(null);
      }

      return;
    }

    if (kind === "skip" && skipBoosters > 0) {
      try {
        setPowerUpAction("skip-inventory");
        const used = await consumeSkipBooster();

        if (!used) {
          playSound("error");
          setPowerUpMessage("That skip booster could not be used right now.");
          return;
        }

        await completeDailyPuzzleWithSkip("inventory");
      } finally {
        setPowerUpAction(null);
      }

      return;
    }

    try {
      setPowerUpAction(kind === "extra" ? "extra-ad" : "skip-ad");
      const rewarded = await showRewardedReviveAd();

      if (!rewarded) {
        playSound("error");
        setPowerUpMessage("Ad was skipped or unavailable. Try again.");
        return;
      }

      if (kind === "extra") {
        grantExtraGuess("ad");
        return;
      }

      await completeDailyPuzzleWithSkip("ad");
    } finally {
      setPowerUpAction(null);
    }
  };

  if (!hydrated || isLoading) {
    return (
      <ScreenContainer contentStyle={styles.loadingScreen}>
        <ActivityIndicator color={colors.warning} size="large" />
        <Text style={styles.loadingTitle}>Loading daily puzzle</Text>
        <Text style={styles.loadingBody}>Preparing today&apos;s shared board.</Text>
      </ScreenContainer>
    );
  }

  if (!puzzleDateKey) {
    return (
      <ScreenContainer contentStyle={styles.loadingScreen}>
        <Text style={styles.loadingTitle}>Daily puzzle unavailable</Text>
        <Text style={styles.inlineError}>Could not determine the selected date.</Text>
        <Pressable
          onPress={() => router.replace("/daily-puzzle")}
          style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
        >
          <Text style={styles.returnButtonText}>BACK TO CALENDAR</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  if (!requestedDateIsPlayable) {
    return (
      <ScreenContainer contentStyle={styles.loadingScreen}>
        <Text style={styles.loadingTitle}>Daily puzzle locked</Text>
        <Text style={styles.inlineError}>Unlock older daily puzzles from the calendar first.</Text>
        <Pressable
          onPress={() => router.replace("/daily-puzzle")}
          style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
        >
          <Text style={styles.returnButtonText}>BACK TO CALENDAR</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <ConfettiBurst visible={completed} />
      <GameStartCountdown controller={countdown} label="Daily puzzle" />

      <AppHeader
        center={<HeaderDateBadge dateKey={puzzleDateKey} />}
        left={<HeaderBackButton onPress={() => router.replace("/daily-puzzle")} />}
        right={<HeaderCoinsPill coins={profile.coins} />}
      />

      {completed ? (
        <ScrollView contentContainerStyle={styles.completedResultContent} showsVerticalScrollIndicator={false}>
          <View style={styles.completedResultSummary}>
            <View style={styles.completedResultTitleRow}>
              <View style={styles.completedResultIcon}>
                <Ionicons color="#ffffff" name="checkmark" size={18} />
              </View>
              <View style={styles.completedResultCopy}>
                <Text style={styles.completedResultEyebrow}>Board clear</Text>
                <Text style={styles.completedResultTitle}>Daily win locked in</Text>
              </View>
            </View>

            <View style={styles.completedResultStats}>
              <View style={styles.completedResultStat}>
                <Text style={styles.completedResultStatLabel}>Guesses</Text>
                <Text style={styles.completedResultStatValue}>{completion?.attempts ?? attemptsCount}</Text>
              </View>
              <View style={styles.completedResultStatDivider} />
              <View style={styles.completedResultStat}>
                <Text style={styles.completedResultStatLabel}>Time</Text>
                <Text style={styles.completedResultStatValue}>{completion ? formatDuration(completion.durationMs) : "--"}</Text>
              </View>
              <View style={styles.completedResultStatDivider} />
              <View style={styles.completedResultStat}>
                <Text style={styles.completedResultStatLabel}>Rank</Text>
                <Text style={styles.completedResultStatValue}>
                  {dailyLeaderboard?.playerEntry ? `#${dailyLeaderboard.playerEntry.rank}` : "--"}
                </Text>
              </View>
            </View>

          </View>

          <View style={styles.dailyResultLeaderboardCard}>
            <View style={styles.dailyResultLeaderboardHeader}>
              <View>
                <Text style={styles.dailyResultLeaderboardTitle}>Daily leaderboard</Text>
                <Text style={styles.dailyResultLeaderboardBody}>Fewest guesses ranks first.</Text>
              </View>
              {dailyLeaderboardLoading ? <ActivityIndicator color={colors.warning} size="small" /> : null}
            </View>

            {dailyLeaderboardError ? (
              <View style={styles.dailyResultEmptyState}>
                <Text style={styles.dailyResultEmptyTitle}>Leaderboard unavailable</Text>
                <Text style={styles.dailyResultEmptyBody}>{dailyLeaderboardError}</Text>
              </View>
            ) : dailyLeaderboard && dailyLeaderboard.topEntries.length > 0 ? (
              <View style={styles.dailyResultLeaderboardShell}>
                {dailyLeaderboard.topEntries.map((entry) => (
                  <DailyResultLeaderboardRow entry={entry} key={entry.playerKey} playerDisplayName={displayName} />
                ))}
              </View>
            ) : (
              <View style={styles.dailyResultEmptyState}>
                <Text style={styles.dailyResultEmptyTitle}>Waiting for ranks</Text>
                <Text style={styles.dailyResultEmptyBody}>Your clear is saved. The board will appear when ranking data syncs.</Text>
              </View>
            )}

            {detachedDailyResultPlayerEntry ? (
              <>
                <View style={styles.dailyResultDivider}>
                  <Text style={styles.dailyResultDividerText}>Your rank</Text>
                </View>
                <DailyResultLeaderboardRow
                  entry={detachedDailyResultPlayerEntry}
                  isDetachedPlayer
                  playerDisplayName={displayName}
                />
              </>
            ) : null}
          </View>

          <Pressable
            onPress={() => router.replace("/daily-puzzle")}
            style={({ pressed }) => [styles.completedResultReturnButton, pressed && styles.pressed]}
          >
            <Text style={styles.completedResultReturnText}>BACK TO CALENDAR</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <>
      <View style={styles.playInfoBar}>
        <View style={styles.playInfoCenter}>
          <View style={styles.modeHint}>
            <Text style={styles.modeHintMode}>{usingOfflineFallback ? "LOCAL DAILY" : "DAILY BOARD"}</Text>
            <Text style={styles.modeHintRange}>{`1-${maxNumber}`}</Text>
          </View>
        </View>

        <View style={styles.chancesTextWrap}>
          <BoosterIcon kind="extra-guess" size={30} />
          <Text style={styles.chancesText}>
            {attemptsCount} used
          </Text>
        </View>
      </View>

      <View style={styles.guessPanel}>
        <View style={styles.guessHero}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[
              styles.guessInputValue,
              guessDisplayValue === "--" && styles.guessInputValueEmpty
            ]}
          >
            {guessDisplayValue}
          </Text>
        </View>

        <View style={[styles.bannerCard, { borderColor: statusState.color }]}>
          <Ionicons color={statusState.color} name={statusState.icon} size={20} />
          <Text style={[styles.bannerText, { color: statusState.color }]}>{statusState.label}</Text>
        </View>

        <Text style={[styles.statusMeta, errorMessage ? styles.error : null]}>{statusMeta}</Text>

        {recentGuesses.length > 0 ? (
          <View style={styles.historyList}>
            {recentGuesses.map((entry, index) => {
              const toneColor =
                entry.result === "higher" ? "#ff8a6a" : entry.result === "lower" ? "#61b7ff" : colors.correct;
              const toneLabel =
                entry.result === "higher" ? "HIGHER" : entry.result === "lower" ? "LOWER" : "HIT";

              return (
                <View key={`${entry.guess}-${index}`} style={styles.historyCard}>
                  <Text style={styles.historyGuess}>{entry.guess}</Text>
                  <View style={[styles.historyResultBadge, { borderColor: toneColor }]}>
                    <Text style={[styles.historyResultText, { color: toneColor }]}>{toneLabel}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.bottomSpacer} />

        <View style={styles.bottomControls}>
          <View style={styles.keypadWrap}>
            {keypadRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keyRow}>
                {row.map(renderKey)}
              </View>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              accessibilityLabel="Use extra guess power-up"
              disabled={!canTriggerExtraGuess}
              onPress={() => void handlePowerUpPress("extra")}
              style={({ pressed }) => [
                styles.powerUpButton,
                pressed && canTriggerExtraGuess && styles.actionButtonPressed,
              !canTriggerExtraGuess && styles.powerUpButtonDisabled
            ]}
          >
              <BoosterIcon kind="extra-guess" size={52} />
              {powerUpAction === "extra-inventory" || powerUpAction === "extra-ad" ? (
                <View style={styles.powerUpCountBadge}>
                  <Text style={styles.powerUpCountBadgeText}>...</Text>
                </View>
              ) : extraGuessPowerUps > 0 ? (
                <View style={styles.powerUpCountBadge}>
                  <Text style={styles.powerUpCountBadgeText}>x{extraGuessPowerUps}</Text>
                </View>
              ) : canShowRewardedRevive ? (
                <View style={styles.powerUpCountBadge}>
                  <Ionicons color="#3a2a00" name="play" size={11} />
                </View>
              ) : null}
            </Pressable>

            <Pressable
              disabled={ctaDisabled}
              onPress={() => void submitGuess()}
              style={({ pressed }) => [
                styles.guessButton,
                pressed && !ctaDisabled && styles.actionButtonPressed,
                ctaDisabled && styles.actionGuessButtonDisabled
              ]}
            >
              <Text style={styles.guessButtonText}>{isSubmitting ? "LOADING..." : "GUESS >"}</Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Use skip booster"
              disabled={!canTriggerSkipBooster}
              onPress={() => void handlePowerUpPress("skip")}
              style={({ pressed }) => [
                styles.powerUpButton,
                pressed && canTriggerSkipBooster && styles.actionButtonPressed,
                !canTriggerSkipBooster && styles.powerUpButtonDisabled
              ]}
            >
              <BoosterIcon kind="skip" size={52} />
              {powerUpAction === "skip-inventory" || powerUpAction === "skip-ad" ? (
                <View style={styles.powerUpCountBadge}>
                  <Text style={styles.powerUpCountBadgeText}>...</Text>
                </View>
              ) : skipBoosters > 0 ? (
                <View style={styles.powerUpCountBadge}>
                  <Text style={styles.powerUpCountBadgeText}>x{skipBoosters}</Text>
                </View>
              ) : canShowRewardedRevive ? (
                <View style={styles.powerUpCountBadge}>
                  <Ionicons color="#3a2a00" name="play" size={11} />
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingBottom: spacing.sm,
    paddingTop: 0
  },
  loadingScreen: {
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    gap: spacing.xs,
    justifyContent: "center"
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center"
  },
  loadingBody: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  completedResultContent: {
    gap: spacing.sm,
    paddingBottom: spacing.lg
  },
  completedResultSummary: {
    backgroundColor: colors.surface,
    borderColor: "#dfe8e1",
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.card
  },
  completedResultTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  completedResultIcon: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 4,
    borderRadius: radii.pill,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  completedResultCopy: {
    flex: 1,
    gap: 2
  },
  completedResultEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  completedResultTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  completedResultStats: {
    alignItems: "center",
    backgroundColor: "#f5f8f5",
    borderColor: "#e2e9e2",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    paddingVertical: spacing.xs
  },
  completedResultStat: {
    alignItems: "center",
    flex: 1,
    gap: 3
  },
  completedResultStatDivider: {
    backgroundColor: "#d5ded5",
    height: 34,
    width: 1
  },
  completedResultStatLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  completedResultStatValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  dailyResultLeaderboardCard: {
    backgroundColor: colors.surface,
    borderColor: "#e4e9e6",
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
    ...shadows.card
  },
  dailyResultLeaderboardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 36
  },
  dailyResultLeaderboardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  dailyResultLeaderboardBody: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2
  },
  dailyResultLeaderboardShell: {
    gap: 7
  },
  dailyResultRankRow: {
    alignItems: "center",
    backgroundColor: "#fffdf8",
    borderColor: "#e7eadf",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 60,
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  dailyResultRankRowPlayer: {
    backgroundColor: "#f255b6",
    borderColor: "#df2f9c",
    borderWidth: 1
  },
  dailyResultAvatarFrame: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 42,
    justifyContent: "center",
    overflow: "hidden",
    width: 42
  },
  dailyResultAvatarImage: {
    height: 37,
    width: 37
  },
  dailyResultPlayerCopy: {
    flex: 1,
    minWidth: 0
  },
  dailyResultNameLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minWidth: 0
  },
  dailyResultPlayerName: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "900"
  },
  dailyResultPlayerNameActive: {
    color: "#ffffff"
  },
  dailyResultPlayerMeta: {
    color: "#596357",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2
  },
  dailyResultPlayerMetaActive: {
    color: "#ffe8f6"
  },
  dailyResultYouBadge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  dailyResultYouBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  dailyResultScoreStack: {
    alignItems: "flex-end",
    gap: 3,
    minWidth: 72
  },
  dailyResultGuessPill: {
    alignItems: "center",
    backgroundColor: "#aeb5c3",
    borderBottomColor: "#8f98a8",
    borderBottomWidth: 2,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 26,
    minWidth: 70,
    paddingHorizontal: 7
  },
  dailyResultGuessPillPlayer: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderBottomColor: "rgba(0,0,0,0.18)",
    borderColor: "rgba(255,255,255,0.34)",
    borderWidth: 1
  },
  dailyResultGuessValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900"
  },
  dailyResultGuessLabel: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  dailyResultRewardPill: {
    alignItems: "center",
    backgroundColor: "#fff4cf",
    borderColor: "#f3d27d",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 2,
    minHeight: 20,
    paddingHorizontal: 5,
    paddingVertical: 1
  },
  dailyResultRewardText: {
    color: "#8a5a00",
    fontSize: 9,
    fontWeight: "900"
  },
  dailyResultTextLight: {
    color: "#ffffff"
  },
  dailyResultTextSoft: {
    color: "rgba(255,255,255,0.84)"
  },
  dailyResultDivider: {
    alignItems: "center",
    marginTop: spacing.xs
  },
  dailyResultDividerText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  dailyResultEmptyState: {
    alignItems: "center",
    backgroundColor: "#f6f8f6",
    borderColor: "#e3e9e3",
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4,
    padding: spacing.md
  },
  dailyResultEmptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  dailyResultEmptyBody: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    textAlign: "center"
  },
  completedResultReturnButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 5,
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing.lg
  },
  completedResultReturnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  playInfoBar: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 28,
    position: "relative",
    width: "100%"
  },
  playInfoCenter: {
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "70%",
    minHeight: 28
  },
  modeHint: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs
  },
  modeHintMode: {
    color: "#8b9298",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  modeHintRange: {
    color: "#66717a",
    fontSize: 12,
    fontWeight: "900"
  },
  chancesTextWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: "rgba(0,0,0,0.14)",
    borderBottomWidth: 2,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 1,
    justifyContent: "center",
    minHeight: 30,
    minWidth: 82,
    paddingLeft: 2,
    paddingRight: 10,
    position: "absolute",
    right: 0
  },
  chancesText: {
    color: "#176fb8",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  guessPanel: {
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: spacing.sm
  },
  guessHero: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 88,
    minWidth: 196,
    paddingHorizontal: spacing.lg,
    width: "100%"
  },
  bannerCard: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 150,
    paddingHorizontal: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2
  },
  bannerText: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.6
  },
  statusMeta: {
    color: "#6d757b",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  historyList: {
    gap: spacing.xs,
    width: "100%"
  },
  historyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#d6dce2",
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 42,
    paddingHorizontal: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1
  },
  historyGuess: {
    color: "#606367",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 32
  },
  historyResultBadge: {
    alignItems: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 28,
    minWidth: 78,
    paddingHorizontal: spacing.sm
  },
  historyResultText: {
    fontSize: 12,
    fontWeight: "900"
  },
  guessInputValue: {
    color: colors.text,
    fontSize: 68,
    fontWeight: "900",
    lineHeight: 74,
    textAlign: "center"
  },
  guessInputValueEmpty: {
    color: "#8b9298",
    fontSize: 48,
    letterSpacing: 4
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  bottomSpacer: {
    flex: 1,
  },
  bottomControls: {
    gap: spacing.xs,
    justifyContent: "flex-end"
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 6,
    marginTop: 4
  },
  actionSpacer: {
    height: 58,
    width: 64
  },
  keypadWrap: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e8e8",
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    marginHorizontal: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: "#263238",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  keyRow: {
    flexDirection: "row",
    gap: 6
  },
  keyButton: {
    alignItems: "center",
    backgroundColor: "#eef0f1",
    borderBottomColor: "#d2d7d9",
    borderBottomWidth: 3,
    borderColor: "#e0e4e5",
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    height: 44,
    justifyContent: "center"
  },
  keyButtonPressed: {
    backgroundColor: "#e2e6e7",
    borderBottomWidth: 1,
    transform: [{ translateY: 2 }]
  },
  keyButtonDisabled: {
    opacity: 0.55
  },
  keyText: {
    color: "#2d2f31",
    fontSize: 18,
    fontWeight: "900"
  },
  guessButton: {
    alignItems: "center",
    backgroundColor: "#047a37",
    borderBottomColor: "#025a29",
    borderBottomWidth: 6,
    borderColor: "#068f42",
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    height: 58,
    justifyContent: "center",
    shadowColor: "#014e23",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  guessButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.4
  },
  powerUpButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#d8dddd",
    borderBottomWidth: 4,
    borderColor: "#e5e9e9",
    borderRadius: 20,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    overflow: "visible",
    position: "relative",
    shadowColor: "#263238",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 7,
    width: 64,
    elevation: 3
  },
  actionButtonPressed: {
    borderBottomWidth: 2,
    transform: [{ translateY: 3 }, { scale: 0.99 }]
  },
  actionGuessButtonDisabled: {
    backgroundColor: "#b9c9bf",
    borderBottomColor: "#9cada2",
    borderColor: "#c7d3cc",
    shadowOpacity: 0
  },
  powerUpButtonDisabled: {
    backgroundColor: "#f1f3f3",
    borderBottomColor: "#e1e5e5",
    opacity: 0.42,
    shadowOpacity: 0
  },
  skipBoosterButton: {},
  powerUpCountBadge: {
    alignItems: "center",
    backgroundColor: "#ffd86b",
    borderBottomColor: "#d69b1e",
    borderBottomWidth: 1,
    borderColor: "#fff6cf",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    minWidth: 24,
    paddingHorizontal: 5,
    position: "absolute",
    right: -1,
    shadowColor: "#5a3400",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    top: -2,
    zIndex: 2
  },
  powerUpCountBadgeText: {
    color: "#342300",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0
  },
  returnButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 5,
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    width: "100%"
  },
  returnButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.8
  },
  pressed: {
    opacity: 0.84
  },
  inlineError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  }
});
