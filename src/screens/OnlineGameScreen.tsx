import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { TextField } from "../components/TextField";
import { makeGuess, setSecretNumber } from "../socket/onlineSocket";
import { useOnlineGameStore } from "../store/useOnlineGameStore";
import { colors, spacing } from "../utils/theme";
import { DIFFICULTY_CONFIG, getDifficultyRangeLabel } from "../../shared/difficulty";

export default function OnlineGameScreen() {
  const [guess, setGuess] = useState("");
  const [secretNumber, setSecretNumberInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingSecret, setIsSubmittingSecret] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [canNavigateToResult, setCanNavigateToResult] = useState(false);

  const player = useOnlineGameStore((state) => state.player);
  const room = useOnlineGameStore((state) => state.room);
  const lastGuessResult = useOnlineGameStore((state) => state.lastGuessResult);
  const guessHistory = useOnlineGameStore((state) => state.guessHistory);
  const personalSecretNumber = useOnlineGameStore((state) => state.personalSecretNumber);
  const errorMessage = useOnlineGameStore((state) => state.errorMessage);
  const setErrorMessage = useOnlineGameStore((state) => state.setErrorMessage);
  const setPersonalSecretNumber = useOnlineGameStore((state) => state.setPersonalSecretNumber);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const previousOpponentReadyRef = useRef(false);
  const previousRoundStatusRef = useRef<string | null>(null);
  const previousSummaryRoundRef = useRef<number | null>(null);
  const roundSummaryOpacity = useRef(new Animated.Value(0)).current;
  const roundSummaryTranslateY = useRef(new Animated.Value(-12)).current;
  const roundSummaryBackdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!player || !room) {
      router.replace("/");
      return;
    }

    if (room.gameState === "finished") {
      if ((room.mode ?? "classic") === "duel" && !canNavigateToResult) {
        return;
      }

      router.replace("/online-result");
    }
  }, [canNavigateToResult, player, room]);

  useEffect(() => {
    if (room?.roundStatus !== "collecting" || !room.roundEndsAt) {
      setCurrentTime(Date.now());
      return;
    }

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 250);

    return () => {
      clearInterval(interval);
    };
  }, [room?.roundEndsAt, room?.roundStatus]);

  useEffect(() => {
    setErrorMessage(null);
  }, [room?.roundNumber, room?.roundStatus, setErrorMessage]);

  useEffect(() => {
    if (room?.roundStatus !== "setup") {
      setSecretNumberInput("");
    }
  }, [room?.roundStatus]);

  useEffect(() => {
    if (room?.gameState !== "finished") {
      setCanNavigateToResult(false);
    }
  }, [room?.gameState]);

  useEffect(() => {
    if (room?.roomId) {
      previousSummaryRoundRef.current = null;
    }
  }, [room?.roomId]);

  useEffect(() => {
    if (!lastGuessResult) {
      previousSummaryRoundRef.current = null;
    }
  }, [lastGuessResult]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setToastMessage(null);
    }, 2800);

    return () => {
      clearTimeout(timeout);
    };
  }, [toastMessage]);

  const latestFeedback = !lastGuessResult
    ? room?.mode === "duel"
      ? "Submit one guess per round to learn whether your opponent's secret number is higher, lower, or correct."
      : `Submit one number from ${getDifficultyRangeLabel(room?.difficulty ?? "easy")} this round to get higher, lower, or correct feedback when the timer ends.`
    : lastGuessResult.result === "missed"
      ? `You missed round ${lastGuessResult.roundNumber}.`
      : room?.mode === "duel"
        ? `Round ${lastGuessResult.roundNumber}: your guess of ${lastGuessResult.guess} against your opponent's number is ${lastGuessResult.result}.`
        : `Round ${lastGuessResult.roundNumber}: your guess of ${lastGuessResult.guess} is ${lastGuessResult.result}.`;

  if (!room || !player) {
    return null;
  }

  const mode = room.mode ?? "classic";
  const difficulty = room.difficulty ?? "easy";
  const maxNumber = room.maxNumber ?? DIFFICULTY_CONFIG[difficulty].maxNumber;
  const digitLimit = String(maxNumber).length;
  const submittedPlayerIds = room.submittedPlayerIds ?? [];
  const secretSubmittedPlayerIds = room.secretSubmittedPlayerIds ?? [];
  const roundDurationSeconds = room.roundDurationSeconds ?? 15;
  const hasSubmitted = submittedPlayerIds.includes(player.id);
  const hasSubmittedSecret = secretSubmittedPlayerIds.includes(player.id);
  const opponentHasSubmittedSecret = secretSubmittedPlayerIds.some((playerId) => playerId !== player.id);
  const isCollecting = room.roundStatus === "collecting";
  const isSecretSetup = mode === "duel" && room.roundStatus === "setup";
  const secondsRemaining = room.roundEndsAt
    ? Math.max(0, Math.ceil((room.roundEndsAt - currentTime) / 1000))
    : 0;
  const roundSummaryHint =
    !lastGuessResult || mode !== "duel"
      ? null
      : lastGuessResult.result === "missed"
        ? { label: "No Guess", icon: "remove" as const, color: colors.textMuted }
        : lastGuessResult.result === "higher"
          ? { label: "Higher", icon: "arrow-up" as const, color: colors.success }
          : lastGuessResult.result === "lower"
            ? { label: "Lower", icon: "arrow-down" as const, color: colors.danger }
            : { label: "Correct", icon: "checkmark" as const, color: colors.success };

  useEffect(() => {
    if (mode !== "duel") {
      previousOpponentReadyRef.current = false;
      previousRoundStatusRef.current = room.roundStatus;
      return;
    }

    if (opponentHasSubmittedSecret && !previousOpponentReadyRef.current && room.roundStatus === "setup") {
      setToastMessage("Your opponent has locked in a secret number.");
    }

    if (
      room.roundStatus === "collecting" &&
      previousRoundStatusRef.current === "setup" &&
      personalSecretNumber !== null
    ) {
      setToastMessage("Your opponent is ready. Round 1 has started.");
    }

    previousOpponentReadyRef.current = opponentHasSubmittedSecret;
    previousRoundStatusRef.current = room.roundStatus;
  }, [mode, opponentHasSubmittedSecret, personalSecretNumber, room.roundStatus]);

  useEffect(() => {
    if (mode !== "duel" || !lastGuessResult) {
      return;
    }

    if (previousSummaryRoundRef.current === lastGuessResult.roundNumber) {
      return;
    }

    previousSummaryRoundRef.current = lastGuessResult.roundNumber;
    setShowRoundSummary(true);
    setCanNavigateToResult(false);
    roundSummaryOpacity.setValue(0);
    roundSummaryTranslateY.setValue(-12);
    roundSummaryBackdropOpacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(roundSummaryBackdropOpacity, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(roundSummaryOpacity, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(roundSummaryTranslateY, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
          toValue: 0,
          useNativeDriver: true
        })
      ]),
      Animated.delay(5000),
      Animated.parallel([
        Animated.timing(roundSummaryBackdropOpacity, {
          duration: 240,
          easing: Easing.in(Easing.cubic),
          toValue: 0,
          useNativeDriver: true
        }),
        Animated.timing(roundSummaryOpacity, {
          duration: 240,
          easing: Easing.in(Easing.cubic),
          toValue: 0,
          useNativeDriver: true
        }),
        Animated.timing(roundSummaryTranslateY, {
          duration: 240,
          easing: Easing.in(Easing.cubic),
          toValue: -8,
          useNativeDriver: true
        })
      ])
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setShowRoundSummary(false);

      if (room.gameState === "finished") {
        setCanNavigateToResult(true);
      }
    });
  }, [
    mode,
    lastGuessResult,
    room.gameState,
    roundSummaryBackdropOpacity,
    roundSummaryOpacity,
    roundSummaryTranslateY
  ]);

  const handleSubmitSecretNumber = async () => {
    const parsedSecretNumber = Number(secretNumber);

    if (!Number.isInteger(parsedSecretNumber) || parsedSecretNumber < 1 || parsedSecretNumber > maxNumber) {
      setErrorMessage(`Enter a whole number between 1 and ${maxNumber} for your secret number.`);
      return;
    }

    try {
      setIsSubmittingSecret(true);
      setErrorMessage(null);
      await setSecretNumber(room.roomId, parsedSecretNumber);
      setPersonalSecretNumber(parsedSecretNumber);
      setToastMessage("Your secret number is locked in.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not lock in your secret number.");
    } finally {
      setIsSubmittingSecret(false);
    }
  };

  const handleSubmitGuess = async () => {
    if (!isCollecting) {
      setErrorMessage("Wait for the next round to start.");
      return;
    }

    if (hasSubmitted) {
      setErrorMessage("You already locked in a guess this round.");
      return;
    }

    const parsedGuess = Number(guess);

    if (!Number.isInteger(parsedGuess) || parsedGuess < 1 || parsedGuess > maxNumber) {
      setErrorMessage(`Enter a whole number between 1 and ${maxNumber}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await makeGuess(room.roomId, parsedGuess);
      setGuess("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not submit guess.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.label}>{isSecretSetup ? "Secret setup" : "Round live"}</Text>
        {mode === "duel" && personalSecretNumber !== null ? (
          <View style={styles.secretBanner}>
            <Text style={styles.secretBannerLabel}>Your secret number</Text>
            <Text style={styles.secretBannerValue}>{personalSecretNumber}</Text>
          </View>
        ) : null}
        {toastMessage ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        ) : null}
        <Text style={styles.title}>
          {mode === "duel" ? (isSecretSetup ? "Choose your secret number" : "Guess your opponent's number") : "Guess the target number"}
        </Text>
        <Text style={styles.subtitle}>
          {mode === "duel"
            ? isSecretSetup
              ? `Pick a number from ${getDifficultyRangeLabel(difficulty)}. Your opponent will try to guess it while you try to guess theirs.`
              : `Each round lasts ${roundDurationSeconds} seconds. Submit one number from ${getDifficultyRangeLabel(difficulty)} to guess your opponent's secret.`
            : `Each round lasts ${roundDurationSeconds} seconds. Submit one number from ${getDifficultyRangeLabel(difficulty)} before time runs out.`}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusPill, isCollecting && styles.statusPillAccent]}>
          <Text style={styles.statusPillText}>
            {isSecretSetup
              ? hasSubmittedSecret
                ? "Secret locked"
                : "Choose secret"
              : hasSubmitted
                ? "Guess locked"
                : isCollecting
                  ? "Your turn"
                  : "Waiting"}
          </Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>
            {isSecretSetup ? `Range ${getDifficultyRangeLabel(difficulty)}` : isCollecting ? `${secondsRemaining}s left` : "Resolving"}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        {isSecretSetup ? (
          <>
            <Text style={styles.status}>
              {hasSubmittedSecret
                ? opponentHasSubmittedSecret
                  ? "Both secret numbers are ready. Starting the duel..."
                  : "Your secret number is locked in. Waiting for the other player."
                : opponentHasSubmittedSecret
                  ? "Your opponent already picked a secret number. Choose yours to begin."
                  : "Choose your secret number before round 1 can begin."}
            </Text>
            <TextField
              editable={!hasSubmittedSecret}
              keyboardType="numeric"
              label="Your secret number"
              maxLength={digitLimit}
              onChangeText={setSecretNumberInput}
              placeholder={hasSubmittedSecret ? "Secret number saved" : "Pick a secret number"}
              value={secretNumber}
            />
            <PrimaryButton
              disabled={hasSubmittedSecret}
              label={hasSubmittedSecret ? "Secret Locked In" : "Lock In Secret Number"}
              loading={isSubmittingSecret}
              onPress={handleSubmitSecretNumber}
            />
          </>
        ) : (
          <>
            <View style={styles.roundHeader}>
              <Text style={styles.roundTitle}>Round {room.roundNumber}</Text>
              <Text style={styles.timer}>
                {isCollecting ? `${secondsRemaining}s left` : "Checking guesses..."}
              </Text>
            </View>
            <Text style={styles.status}>
              {isCollecting
                ? hasSubmitted
                  ? "Your guess is locked in for this round."
                  : "You can submit one guess this round."
                : "Round closed. Feedback is on the way."}
            </Text>
            <TextField
              editable={isCollecting && !hasSubmitted}
              keyboardType="numeric"
              label={mode === "duel" ? "Your guess for the other player" : "Your guess"}
              maxLength={digitLimit}
              onChangeText={setGuess}
              placeholder={isCollecting && !hasSubmitted ? "Pick a number" : "Wait for the next round"}
              value={guess}
            />
            <PrimaryButton
              disabled={!isCollecting || hasSubmitted}
              label={hasSubmitted ? "Guess Submitted" : "Lock In Guess"}
              loading={isSubmitting}
              onPress={handleSubmitGuess}
            />
          </>
        )}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>

      <View style={styles.feedbackCard}>
        <Text style={styles.sectionTitle}>Latest feedback</Text>
        <Text style={styles.feedbackText}>{latestFeedback}</Text>
      </View>

      <View style={styles.feedbackCard}>
        <Text style={styles.sectionTitle}>Previous guesses</Text>
        {guessHistory.length === 0 ? (
          <Text style={styles.feedbackText}>No guesses yet.</Text>
        ) : (
          guessHistory.map((entry, index) => (
            <Text key={`${entry.roundNumber}-${entry.guess ?? "missed"}-${index}`} style={styles.historyItem}>
              Round {entry.roundNumber}
              {": "}
              {entry.guess === null ? "missed" : `${entry.guess} -> ${entry.result}`}
            </Text>
          ))
        )}
      </View>

      {showRoundSummary && mode === "duel" && lastGuessResult ? (
        <Animated.View style={[styles.roundSummaryOverlay, { opacity: roundSummaryBackdropOpacity }]}>
          <Animated.View
            style={[
              styles.roundSummaryPopup,
              {
                opacity: roundSummaryOpacity,
                transform: [{ translateY: roundSummaryTranslateY }]
              }
            ]}
          >
            <Text style={styles.roundSummaryTitle}>Round {lastGuessResult.roundNumber} completed</Text>
            <Text style={styles.roundSummaryPrimary}>
              Your guess: {lastGuessResult.guess ?? "No guess"}
            </Text>
            {roundSummaryHint ? (
              <View style={styles.roundSummaryHintRow}>
                <Ionicons color={roundSummaryHint.color} name={roundSummaryHint.icon} size={18} />
                <Text style={[styles.roundSummaryHint, { color: roundSummaryHint.color }]}>
                  {roundSummaryHint.label}
                </Text>
              </View>
            ) : null}
            <Text style={styles.roundSummarySecondary}>
              Opponent guess: {lastGuessResult.opponentGuess ?? "No guess"}
            </Text>
          </Animated.View>
        </Animated.View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.lg,
    gap: spacing.xs
  },
  label: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  secretBanner: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4
  },
  secretBannerLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  secretBannerValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800"
  },
  toast: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  toastText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  roundSummaryOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(8, 17, 31, 0.62)",
    justifyContent: "center",
    padding: spacing.lg
  },
  roundSummaryPopup: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 20,
    maxWidth: 420,
    padding: spacing.lg,
    gap: spacing.xs,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 10
    },
    elevation: 8
  },
  roundSummaryTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  roundSummaryPrimary: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  roundSummaryHint: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20
  },
  roundSummaryHintRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  roundSummarySecondary: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  statusPill: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  statusPillAccent: {
    borderColor: colors.accent
  },
  statusPillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700"
  },
  roundHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  roundTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700"
  },
  timer: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "800"
  },
  status: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  feedbackCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  },
  feedbackText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  historyItem: {
    color: colors.text,
    fontSize: 15
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600"
  }
});
