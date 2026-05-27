import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader, HeaderBackButton, HeaderCoinsPill, HeaderDateBadge } from "../components/AppHeader";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { GameStartCountdown } from "../components/GameStartCountdown";
import { ScreenContainer } from "../components/ScreenContainer";
import { useGameStartCountdown } from "../hooks/useGameStartCountdown";
import { isRewardedReviveSupported } from "../services/rewardedReviveAd";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { GuessFeedback } from "../types/game.types";
import type { MatchRecord } from "../types/progression.types";
import { formatDuration } from "../utils/progression";
import { colors, radii, shadows, spacing } from "../utils/theme";
import {
  DAILY_PUZZLE_DEFAULT_MAX,
  getDeterministicDailyPuzzleNumber,
  getLocalTodayKey,
  isTodayPuzzleDate
} from "../utils/dailyPuzzle";

interface GuessEntry {
  guess: number;
  result: GuessFeedback;
}

const keypadRows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["backspace", "0", "clear"]
] as const;

export default function DailyPuzzleGameScreen() {
  const params = useLocalSearchParams<{ dateKey?: string }>();
  const hydrated = usePlayerProgressStore((state) => state.hydrated);
  const fetchDailyPuzzleStatus = usePlayerProgressStore((state) => state.fetchDailyPuzzleStatus);
  const submitDailyPuzzleGuess = usePlayerProgressStore((state) => state.submitDailyPuzzleGuess);
  const recordMatch = usePlayerProgressStore((state) => state.recordMatch);
  const saveDailyPuzzleCompletionLocal = usePlayerProgressStore((state) => state.saveDailyPuzzleCompletionLocal);
  const dailyPuzzleTodayKey = usePlayerProgressStore((state) => state.dailyPuzzleTodayKey);
  const dailyPuzzleMaxNumber = usePlayerProgressStore((state) => state.dailyPuzzleMaxNumber);
  const profile = usePlayerProgressStore((state) => state.profile);
  const extraGuessPowerUps = usePlayerProgressStore((state) => state.profile.extraGuessPowerUps);
  const skipBoosters = usePlayerProgressStore((state) => state.profile.skipBoosters);
  const countdown = useGameStartCountdown();
  const { countdownActive, startCountdown } = countdown;
  const canShowRewardedRevive = isRewardedReviveSupported();

  const requestedDateKey = typeof params.dateKey === "string" ? params.dateKey : getLocalTodayKey();
  const requestedDateIsToday = isTodayPuzzleDate(requestedDateKey);

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

  const digitLimit = String(maxNumber).length;
  const attemptsCount = completed && completion ? completion.attempts : guessHistory.length;
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
  const ctaDisabled = countdownActive || isSubmitting || guess.length === 0;
  const canTriggerExtraGuess = !completed && !countdownActive && !isSubmitting && (extraGuessPowerUps > 0 || canShowRewardedRevive);
  const canTriggerSkipBooster = !completed && !countdownActive && !isSubmitting && (skipBoosters > 0 || canShowRewardedRevive);

  const submitGuess = async () => {
    if (countdownActive || isSubmitting || completed || !puzzleDateKey || !requestedDateIsToday) {
      return;
    }

    const parsedGuess = Number(guess);

    if (!Number.isInteger(parsedGuess) || parsedGuess < 1 || parsedGuess > maxNumber) {
      setErrorMessage(`Use a number from 1 to ${maxNumber}.`);
      return;
    }

    const attempts = guessHistory.length + 1;
    const durationMs = Date.now() - startedAtRef.current;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setPowerUpMessage(null);

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
        return;
      }

      const feedback: GuessFeedback = response.feedback;

      setUsingOfflineFallback(false);
      setLastFeedback(feedback);
      setGuessHistory((currentHistory) => [{ guess: parsedGuess, result: feedback }, ...currentHistory]);
      setGuess("");

      if (feedback === "correct") {
        setMatchSummary(response.record);
      }
    } catch (error) {
      const offlineSecret = getDeterministicDailyPuzzleNumber(puzzleDateKey, maxNumber);
      const feedback: GuessFeedback =
        parsedGuess === offlineSecret ? "correct" : parsedGuess < offlineSecret ? "higher" : "lower";

      setUsingOfflineFallback(true);
      setLoadError(error instanceof Error ? error.message : "Server sync unavailable.");
      setLastFeedback(feedback);
      setGuessHistory((currentHistory) => [{ guess: parsedGuess, result: feedback }, ...currentHistory]);
      setGuess("");

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
        } catch (fallbackError) {
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

    setGuess((currentGuess) => `${currentGuess}${digit}`);
    setErrorMessage(null);
    setPowerUpMessage(null);
  };

  const removeDigit = () => {
    if (countdownActive || isSubmitting || completed) {
      return;
    }

    setGuess((currentGuess) => currentGuess.slice(0, -1));
    setErrorMessage(null);
    setPowerUpMessage(null);
  };

  const clearDigit = () => {
    if (countdownActive || isSubmitting || completed) {
      return;
    }

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
        disabled={disabled}
        key={key}
        onPress={onPress}
        style={({ pressed }) => [styles.keyButton, pressed && !disabled && styles.keyButtonPressed, disabled && styles.keyButtonDisabled]}
      >
        {label}
      </Pressable>
    );
  };

  const handlePowerUpPress = (kind: "extra" | "skip") => {
    if (kind === "extra" && !canTriggerExtraGuess) {
      return;
    }

    if (kind === "skip" && !canTriggerSkipBooster) {
      return;
    }

    setErrorMessage(null);
    setPowerUpMessage(
      kind === "extra"
        ? "Daily board now matches single player visually. Extra-guess behavior will hook into daily rules next."
        : "Daily board now uses the same gameplay controls. Skip-booster behavior will be wired to daily rules next."
    );
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

  if (!requestedDateIsToday) {
    return (
      <ScreenContainer contentStyle={styles.loadingScreen}>
        <Text style={styles.loadingTitle}>Daily puzzle locked</Text>
        <Text style={styles.inlineError}>Only today&apos;s daily puzzle can be played.</Text>
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
        left={<HeaderBackButton onPress={() => router.back()} />}
        right={<HeaderCoinsPill coins={profile.coins} />}
      />

      <View style={styles.playInfoBar}>
        <View style={styles.playInfoCenter}>
          <View style={styles.modeHint}>
            <Text style={styles.modeHintMode}>{usingOfflineFallback ? "LOCAL DAILY" : "DAILY BOARD"}</Text>
            <Text style={styles.modeHintRange}>{`1-${maxNumber}`}</Text>
          </View>
        </View>

        <View style={styles.chancesTextWrap}>
          <Ionicons color="#fff6c8" name="flash" size={12} />
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

      {completed ? (
        <View style={styles.completeCard}>
          <Text style={styles.completeTitle}>Daily win locked in</Text>
          <View style={styles.completeStatsRow}>
            <View style={styles.completeStat}>
              <Text style={styles.completeStatLabel}>Guesses</Text>
              <Text style={styles.completeStatValue}>{completion?.attempts ?? attemptsCount}</Text>
            </View>
            <View style={styles.completeStatDivider} />
            <View style={styles.completeStat}>
              <Text style={styles.completeStatLabel}>Time</Text>
              <Text style={styles.completeStatValue}>
                {completion ? formatDuration(completion.durationMs) : "--"}
              </Text>
            </View>
          </View>
          <Text style={styles.completeBody}>
            {matchSummary ? `+${matchSummary.points} pts | +${matchSummary.xpEarned} XP` : "Your completion is saved for this date."}
          </Text>
          <Pressable
            onPress={() => router.replace("/daily-puzzle")}
            style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
          >
            <Text style={styles.returnButtonText}>BACK TO CALENDAR</Text>
          </Pressable>
        </View>
      ) : (
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
              disabled={!canTriggerExtraGuess}
              onPress={() => handlePowerUpPress("extra")}
              style={({ pressed }) => [
                styles.powerUpButton,
                pressed && canTriggerExtraGuess && styles.keyButtonPressed,
                !canTriggerExtraGuess && styles.keyButtonDisabled
              ]}
            >
              <Ionicons color="#fff6c8" name="flash" size={26} />
              {extraGuessPowerUps > 0 ? (
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
                pressed && !ctaDisabled && styles.keyButtonPressed,
                ctaDisabled && styles.keyButtonDisabled
              ]}
            >
              <Text style={styles.guessButtonText}>{isSubmitting ? "LOADING..." : "GUESS >"}</Text>
            </Pressable>

            <Pressable
              disabled={!canTriggerSkipBooster}
              onPress={() => handlePowerUpPress("skip")}
              style={({ pressed }) => [
                styles.powerUpButton,
                styles.skipBoosterButton,
                pressed && canTriggerSkipBooster && styles.keyButtonPressed,
                !canTriggerSkipBooster && styles.keyButtonDisabled
              ]}
            >
              <Ionicons color="#fff6c8" name="play-forward" size={24} />
              {skipBoosters > 0 ? (
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
    backgroundColor: "#1f6fb9",
    borderBottomColor: "#134c81",
    borderBottomWidth: 3,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 26,
    minWidth: 74,
    paddingHorizontal: 9,
    position: "absolute",
    right: 0
  },
  chancesText: {
    color: "#ffffff",
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
    flexDirection: "row",
    gap: spacing.sm
  },
  keypadWrap: {
    backgroundColor: "#ffffff",
    borderRadius: 26,
    gap: spacing.xs,
    padding: spacing.sm
  },
  keyRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  keyButton: {
    alignItems: "center",
    backgroundColor: "#e6e7e8",
    borderRadius: radii.pill,
    flex: 1,
    height: 40,
    justifyContent: "center"
  },
  keyButtonPressed: {
    transform: [{ scale: 0.98 }]
  },
  keyButtonDisabled: {
    opacity: 0.55
  },
  keyText: {
    color: "#2d2f31",
    fontSize: 18,
    fontWeight: "800"
  },
  guessButton: {
    alignItems: "center",
    backgroundColor: "#047a37",
    borderBottomColor: "#025a29",
    borderBottomWidth: 6,
    borderRadius: radii.pill,
    flex: 1,
    height: 46,
    justifyContent: "center"
  },
  guessButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.4
  },
  powerUpButton: {
    alignItems: "center",
    backgroundColor: "#1f6fb9",
    borderBottomColor: "#134c81",
    borderBottomWidth: 6,
    borderRadius: 22,
    height: 46,
    justifyContent: "center",
    overflow: "visible",
    position: "relative",
    width: 58
  },
  skipBoosterButton: {
    backgroundColor: "#8859f2",
    borderBottomColor: "#5d35b2"
  },
  powerUpCountBadge: {
    alignItems: "center",
    backgroundColor: "#ffcf4f",
    borderColor: "#ffffff",
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    minWidth: 22,
    paddingHorizontal: 4,
    position: "absolute",
    right: -7,
    top: -7,
    zIndex: 2
  },
  powerUpCountBadgeText: {
    color: "#3a2a00",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4
  },
  completeCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    gap: spacing.sm,
    marginTop: "auto",
    padding: spacing.lg,
    ...shadows.card
  },
  completeTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase"
  },
  completeStatsRow: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "center"
  },
  completeStat: {
    alignItems: "center",
    flex: 1,
    gap: 4
  },
  completeStatDivider: {
    backgroundColor: colors.surfaceMuted,
    height: 36,
    width: 1
  },
  completeStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  completeStatValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  completeBody: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center"
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
