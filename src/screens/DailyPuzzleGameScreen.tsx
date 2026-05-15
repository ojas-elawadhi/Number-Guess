import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { AppHeader, HeaderBackButton, HeaderCoinsPill, HeaderDateBadge } from "../components/AppHeader";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { FeedbackBadge, HistoryStrip, NumberPad, StatusPill } from "../components/GameKit";
import { GameStartCountdown } from "../components/GameStartCountdown";
import { ScreenContainer } from "../components/ScreenContainer";
import { useGameStartCountdown } from "../hooks/useGameStartCountdown";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { GuessFeedback } from "../types/game.types";
import type { MatchRecord } from "../types/progression.types";
import { formatDuration } from "../utils/progression";
import { colors, radii, shadows, spacing } from "../utils/theme";
import {
  DAILY_PUZZLE_DEFAULT_MAX,
  formatPlayLabel,
  getDeterministicDailyPuzzleNumber,
  getLocalTodayKey,
  isTodayPuzzleDate
} from "../utils/dailyPuzzle";

interface GuessEntry {
  guess: number;
  result: GuessFeedback;
}

export default function DailyPuzzleGameScreen() {
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ dateKey?: string }>();
  const hydrated = usePlayerProgressStore((state) => state.hydrated);
  const fetchDailyPuzzleStatus = usePlayerProgressStore((state) => state.fetchDailyPuzzleStatus);
  const submitDailyPuzzleGuess = usePlayerProgressStore((state) => state.submitDailyPuzzleGuess);
  const recordMatch = usePlayerProgressStore((state) => state.recordMatch);
  const saveDailyPuzzleCompletionLocal = usePlayerProgressStore((state) => state.saveDailyPuzzleCompletionLocal);
  const dailyPuzzleTodayKey = usePlayerProgressStore((state) => state.dailyPuzzleTodayKey);
  const dailyPuzzleMaxNumber = usePlayerProgressStore((state) => state.dailyPuzzleMaxNumber);
  const profile = usePlayerProgressStore((state) => state.profile);
  const countdown = useGameStartCountdown();
  const { countdownActive, startCountdown } = countdown;

  const requestedDateKey = typeof params.dateKey === "string" ? params.dateKey : getLocalTodayKey();
  const requestedDateIsToday = isTodayPuzzleDate(requestedDateKey);
  const compactLayout = height < 860;

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
  const title = puzzleDateKey ? formatPlayLabel(puzzleDateKey).toUpperCase() : "DAILY PUZZLE";
  const historyItems = useMemo(
    () =>
      guessHistory
        .slice(0, 4)
        .reverse()
        .map((entry, index) => ({
          id: `${entry.guess}-${index}`,
          primary: `${entry.guess}`,
          tone: entry.result,
          meta: entry.result
        })),
    [guessHistory]
  );

  const feedbackDetail =
    completed && completion
      ? `${completion.attempts} attempts | ${formatDuration(completion.durationMs)}`
      : usingOfflineFallback
        ? "Offline fallback active. Same local date uses the same puzzle."
        : lastFeedback === null
          ? "One backend-verified secret number for everyone today."
          : lastFeedback === "higher"
            ? "Push your next guess upward."
            : lastFeedback === "lower"
              ? "Dial your next guess down."
              : "Daily puzzle cleared.";

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
    <ScreenContainer contentStyle={[styles.screen, compactLayout && styles.screenCompact]}>
      <ConfettiBurst visible={completed} />
      <GameStartCountdown controller={countdown} label="Daily puzzle" />

      <AppHeader
        center={<HeaderDateBadge dateKey={puzzleDateKey} />}
        left={<HeaderBackButton onPress={() => router.back()} />}
        right={<HeaderCoinsPill coins={profile.coins} />}
      />

      <View style={styles.metaRow}>
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>{usingOfflineFallback ? "Local Board" : "Daily Board"}</Text>
        </View>
        <StatusPill label={`1-${maxNumber}`} tone="neutral" />
        <StatusPill label={`${profile.extraGuessPowerUps} Power-Ups`} tone="neutral" />
      </View>

      <View style={styles.feedbackCard}>
        <FeedbackBadge compact detail={feedbackDetail} result={completed ? "correct" : lastFeedback} title={completed ? "CLEARED" : undefined} />
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Attempts</Text>
          <Text style={styles.infoValue}>{completed && completion ? completion.attempts : guessHistory.length}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={styles.infoValue}>{completed ? "Done" : countdownActive ? "Ready" : "Live"}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Sync</Text>
          <Text style={styles.infoValue}>{usingOfflineFallback ? "Local" : "Server"}</Text>
        </View>
      </View>

      <View style={styles.historyCard}>
        <HistoryStrip compact emptyLabel="No guesses yet." items={historyItems} title="Recent guesses" />
      </View>

      {loadError && usingOfflineFallback ? (
        <View style={styles.noticeCard}>
          <Text numberOfLines={2} style={styles.noticeText}>
            {loadError}
          </Text>
        </View>
      ) : null}
      {errorMessage ? <Text style={styles.inlineError}>{errorMessage}</Text> : null}

      {completed ? (
        <View style={styles.completeCard}>
          <Text style={styles.completeTitle}>Daily win locked in</Text>
          <Text style={styles.completeBody}>
            {matchSummary ? `+${matchSummary.points} points | +${matchSummary.xpEarned} XP` : "Your completion is saved for this date."}
          </Text>
          <Pressable
            onPress={() => router.replace("/daily-puzzle")}
            style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
          >
            <Text style={styles.returnButtonText}>BACK TO CALENDAR</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.padWrap}>
          <NumberPad
            accent={colors.warning}
            compact
            disabled={countdownActive || isSubmitting}
            helper={usingOfflineFallback ? "Offline fallback is active for this date." : "Server verified. Secret stays on the backend."}
            loading={isSubmitting}
            maxLength={digitLimit}
            onChange={(value) => {
              setGuess(value);
              setErrorMessage(null);
            }}
            onSubmit={() => void submitGuess()}
            submitLabel="LOCK GUESS"
            title="Today's guess"
            value={guess}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.backgroundAlt,
    gap: spacing.sm
  },
  screenCompact: {
    gap: spacing.xs
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
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  modeBadge: {
    alignItems: "center",
    backgroundColor: "rgba(246, 183, 60, 0.16)",
    borderColor: "rgba(246, 183, 60, 0.35)",
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing.md
  },
  modeBadgeText: {
    color: "#9b5b00",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  feedbackCard: {
    borderRadius: radii.xl,
    overflow: "hidden"
  },
  infoRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  infoCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 56,
    paddingVertical: spacing.xs,
    ...shadows.card
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  infoValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.sm,
    ...shadows.card
  },
  noticeCard: {
    backgroundColor: "rgba(246, 183, 60, 0.18)",
    borderColor: "rgba(246, 183, 60, 0.3)",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  noticeText: {
    color: "#8a5400",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  inlineError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  padWrap: {
    flex: 1,
    justifyContent: "flex-end"
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
  }
});
