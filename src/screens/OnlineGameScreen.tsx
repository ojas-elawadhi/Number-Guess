import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader, HeaderBackButton } from "../components/AppHeader";
import { GameKeyboard } from "../components/GameKeyboard";
import { ScreenContainer } from "../components/ScreenContainer";
import { showInterstitialAd } from "../services/interstitialAd";
import { playResultSound, playSound } from "../services/soundEffects";
import { leaveRoom, makeGuess, setSecretNumber } from "../socket/onlineSocket";
import { useMonetizationStore } from "../store/useMonetizationStore";
import { useOnlineGameStore } from "../store/useOnlineGameStore";
import { colors, radii, spacing } from "../utils/theme";
import { DIFFICULTY_CONFIG, getDifficultyRangeLabel } from "../../shared/difficulty";

export default function OnlineGameScreen() {
  const [guess, setGuess] = useState("");
  const [secretNumber, setSecretNumberInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingSecret, setIsSubmittingSecret] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [canNavigateToResult, setCanNavigateToResult] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const player = useOnlineGameStore((state) => state.player);
  const room = useOnlineGameStore((state) => state.room);
  const lastGuessResult = useOnlineGameStore((state) => state.lastGuessResult);
  const guessHistory = useOnlineGameStore((state) => state.guessHistory);
  const personalSecretNumber = useOnlineGameStore((state) => state.personalSecretNumber);
  const errorMessage = useOnlineGameStore((state) => state.errorMessage);
  const setErrorMessage = useOnlineGameStore((state) => state.setErrorMessage);
  const setPersonalSecretNumber = useOnlineGameStore((state) => state.setPersonalSecretNumber);
  const resetAll = useOnlineGameStore((state) => state.resetAll);
  const hasNoAdsEntitlement = useMonetizationStore((state) => state.hasNoAdsEntitlement);
  const previousOpponentReadyRef = useRef(false);
  const previousRoundStatusRef = useRef<string | null>(null);
  const previousSummaryRoundRef = useRef<number | null>(null);
  const previousResultSoundRoundRef = useRef<number | null>(null);
  const lastTimerBeepSecondRef = useRef<number | null>(null);
  const roundSummaryOpacity = useRef(new Animated.Value(0)).current;
  const roundSummaryTranslateY = useRef(new Animated.Value(-12)).current;
  const roundSummaryBackdropOpacity = useRef(new Animated.Value(0)).current;

  const mode = room?.mode ?? "classic";
  const difficulty = room?.difficulty ?? "easy";
  const maxNumber = room?.maxNumber ?? DIFFICULTY_CONFIG[difficulty].maxNumber;
  const digitLimit = String(maxNumber).length;
  const submittedPlayerIds = room?.submittedPlayerIds ?? [];
  const secretSubmittedPlayerIds = room?.secretSubmittedPlayerIds ?? [];
  const roundDurationSeconds = room?.roundDurationSeconds ?? 15;
  const hasSubmitted = player ? submittedPlayerIds.includes(player.id) : false;
  const hasSubmittedSecret = player ? secretSubmittedPlayerIds.includes(player.id) : false;
  const opponentHasSubmittedSecret = player
    ? secretSubmittedPlayerIds.some((playerId) => playerId !== player.id)
    : false;
  const isCollecting = room?.roundStatus === "collecting";
  const isSecretSetup = mode === "duel" && room?.roundStatus === "setup";
  const secondsRemaining = room?.roundEndsAt
    ? Math.max(0, Math.ceil((room.roundEndsAt - currentTime) / 1000))
    : 0;

  const handleLeaveGame = async () => {
    if (!room || isLeaving) {
      return;
    }

    try {
      setIsLeaving(true);
      setErrorMessage(null);
      await leaveRoom(room.roomId);

      if (!hasNoAdsEntitlement) {
        await showInterstitialAd();
      }
    } catch (error) {
      setIsLeaving(false);
      playSound("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not leave.");
      return;
    }

    resetAll();
    router.replace("/online");
  };

  useEffect(() => {
    if (!player || !room) {
      if (!isLeaving) {
        router.replace("/");
      }
      return;
    }

    if (room.gameState === "finished") {
      if ((room.mode ?? "classic") === "duel" && !canNavigateToResult) {
        return;
      }

      router.replace("/online-result");
    }
  }, [canNavigateToResult, isLeaving, player, room]);

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
      previousResultSoundRoundRef.current = null;
    }
  }, [lastGuessResult]);

  useEffect(() => {
    if (!lastGuessResult || previousResultSoundRoundRef.current === lastGuessResult.roundNumber) {
      return;
    }

    previousResultSoundRoundRef.current = lastGuessResult.roundNumber;
    playResultSound(lastGuessResult.result);
  }, [lastGuessResult]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setToastMessage(null);
    }, 2600);

    return () => {
      clearTimeout(timeout);
    };
  }, [toastMessage]);

  useEffect(() => {
    if (!room || mode !== "duel") {
      previousOpponentReadyRef.current = false;
      previousRoundStatusRef.current = room?.roundStatus ?? null;
      return;
    }

    if (opponentHasSubmittedSecret && !previousOpponentReadyRef.current && room.roundStatus === "setup") {
      setToastMessage("Opponent locked in.");
      playSound("onlineNotify");
    }

    if (
      room.roundStatus === "collecting" &&
      previousRoundStatusRef.current === "setup" &&
      personalSecretNumber !== null
    ) {
      setToastMessage("Round 1 started.");
      playSound("countdownGo");
    }

    previousOpponentReadyRef.current = opponentHasSubmittedSecret;
    previousRoundStatusRef.current = room.roundStatus;
  }, [mode, opponentHasSubmittedSecret, personalSecretNumber, room]);

  useEffect(() => {
    if (!isCollecting || secondsRemaining <= 0 || secondsRemaining > 3) {
      lastTimerBeepSecondRef.current = null;
      return;
    }

    if (lastTimerBeepSecondRef.current === secondsRemaining) {
      return;
    }

    lastTimerBeepSecondRef.current = secondsRemaining;
    playSound("timerLow");
  }, [isCollecting, secondsRemaining]);

  useEffect(() => {
    if (!room || mode !== "duel" || !lastGuessResult) {
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
      Animated.delay(2600),
      Animated.parallel([
        Animated.timing(roundSummaryBackdropOpacity, {
          duration: 220,
          easing: Easing.in(Easing.cubic),
          toValue: 0,
          useNativeDriver: true
        }),
        Animated.timing(roundSummaryOpacity, {
          duration: 220,
          easing: Easing.in(Easing.cubic),
          toValue: 0,
          useNativeDriver: true
        }),
        Animated.timing(roundSummaryTranslateY, {
          duration: 220,
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
  }, [lastGuessResult, mode, room, roundSummaryBackdropOpacity, roundSummaryOpacity, roundSummaryTranslateY]);

  if (!room || !player) {
    return null;
  }

  const activeValue = isSecretSetup ? secretNumber : guess;
  const emptyGuessValue =
    difficulty === "impossible" ? "_ _ _ _" : difficulty === "hard" ? "- - -" : "- -";
  const historyItems = guessHistory.slice(0, 3).reverse();
  const inputLocked = isSecretSetup ? hasSubmittedSecret : !isCollecting || hasSubmitted;
  const ctaDisabled = inputLocked || activeValue.length === 0 || isSubmitting || isSubmittingSecret;
  const feedbackResult = lastGuessResult?.result ?? null;
  const bannerTone =
    isSecretSetup
      ? hasSubmittedSecret
        ? "locked"
        : "setup"
      : feedbackResult === "correct"
        ? "correct"
        : feedbackResult === "higher"
          ? "higher"
          : feedbackResult === "lower"
            ? "lower"
            : hasSubmitted
              ? "locked"
              : isCollecting
                ? "turn"
                : "waiting";
  const bannerTitle =
    bannerTone === "setup"
      ? "SET SECRET"
      : bannerTone === "locked"
        ? "LOCKED"
        : bannerTone === "correct"
          ? "CORRECT!"
          : bannerTone === "higher"
            ? "HIGHER"
            : bannerTone === "lower"
              ? "LOWER"
              : bannerTone === "turn"
                ? "YOUR TURN"
                : "WAITING";
  const bannerIcon =
    bannerTone === "setup" || bannerTone === "locked"
      ? "lock-closed"
      : bannerTone === "correct"
        ? "checkmark"
        : bannerTone === "higher"
          ? "arrow-up"
          : bannerTone === "lower"
            ? "arrow-down"
            : bannerTone === "turn"
              ? "flash"
              : "timer-outline";
  const bannerColor =
    bannerTone === "setup"
      ? "#7fd6ff"
      : bannerTone === "locked"
        ? "#87f56c"
        : bannerTone === "correct"
          ? "#1fc46d"
          : bannerTone === "higher"
            ? "#ff8a6a"
            : bannerTone === "lower"
              ? "#61b7ff"
              : bannerTone === "turn"
                ? "#7fd6ff"
                : "#d7dce0";
  const bannerTextColor = bannerTone === "waiting" ? "#5d656c" : "#0d3f68";
  const helperText = isSecretSetup
    ? hasSubmittedSecret
      ? `${secretSubmittedPlayerIds.length}/2 ready`
      : `Secret range ${getDifficultyRangeLabel(difficulty)}`
    : isCollecting
      ? `Round ${room.roundNumber} | ${secondsRemaining}s left`
      : `Locked ${submittedPlayerIds.length}/${room.players.length}`;
  const rangeLabel = isSecretSetup
    ? `Choose your secret ${getDifficultyRangeLabel(difficulty)}`
    : mode === "duel" && personalSecretNumber !== null
      ? `Your secret ${personalSecretNumber}`
      : `Shared range ${getDifficultyRangeLabel(difficulty)}`;
  const roundSummaryHint =
    !lastGuessResult
      ? null
      : lastGuessResult.result === "missed"
        ? { label: "No Guess", icon: "remove" as const, color: "#9aa1a7" }
        : lastGuessResult.result === "higher"
          ? { label: "Higher", icon: "arrow-up" as const, color: "#ff8a6a" }
          : lastGuessResult.result === "lower"
            ? { label: "Lower", icon: "arrow-down" as const, color: "#61b7ff" }
            : { label: "Correct", icon: "checkmark" as const, color: "#1fc46d" };

  const handleSubmitSecretNumber = async () => {
    const parsedSecretNumber = Number(secretNumber);

    if (!Number.isInteger(parsedSecretNumber) || parsedSecretNumber < 1 || parsedSecretNumber > maxNumber) {
      playSound("error");
      setErrorMessage(`Use 1-${maxNumber}.`);
      return;
    }

    try {
      setIsSubmittingSecret(true);
      setErrorMessage(null);
      await setSecretNumber(room.roomId, parsedSecretNumber);
      setPersonalSecretNumber(parsedSecretNumber);
      setToastMessage("Secret locked.");
      playSound("guessLock");
    } catch (error) {
      playSound("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not lock secret.");
    } finally {
      setIsSubmittingSecret(false);
    }
  };

  const handleSubmitGuess = async () => {
    if (!isCollecting) {
      playSound("error");
      setErrorMessage("Wait for the round.");
      return;
    }

    if (hasSubmitted) {
      playSound("error");
      setErrorMessage("Already locked.");
      return;
    }

    const parsedGuess = Number(guess);

    if (!Number.isInteger(parsedGuess) || parsedGuess < 1 || parsedGuess > maxNumber) {
      playSound("error");
      setErrorMessage(`Use 1-${maxNumber}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await makeGuess(room.roomId, parsedGuess);
      setGuess("");
      playSound("guessLock");
    } catch (error) {
      playSound("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not submit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const appendDigit = (digit: string) => {
    if (inputLocked || activeValue.length >= digitLimit) {
      return;
    }

    playSound("numberKey");
    if (isSecretSetup) {
      setSecretNumberInput((currentValue) => `${currentValue}${digit}`);
    } else {
      setGuess((currentValue) => `${currentValue}${digit}`);
    }

    setErrorMessage(null);
  };

  const removeDigit = () => {
    if (inputLocked) {
      return;
    }

    playSound("erase");
    if (isSecretSetup) {
      setSecretNumberInput((currentValue) => currentValue.slice(0, -1));
    } else {
      setGuess((currentValue) => currentValue.slice(0, -1));
    }

    setErrorMessage(null);
  };

  const clearDigit = () => {
    if (inputLocked) {
      return;
    }

    playSound("clear");
    if (isSecretSetup) {
      setSecretNumberInput("");
    } else {
      setGuess("");
    }

    setErrorMessage(null);
  };

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <AppHeader left={<HeaderBackButton onPress={handleLeaveGame} />} />

      {toastMessage ? <Text style={styles.toastText}>{toastMessage}</Text> : null}

      <View style={styles.topRow}>
        <View style={styles.edgeSpacer} />
        <View style={styles.miniHistory}>
          {historyItems.length === 0 ? (
            <Text style={styles.historyPlaceholder}>
              {isSecretSetup ? `Room ${room.roomId}` : `${mode === "duel" ? "Duel" : "Classic"} | R${room.roundNumber}`}
            </Text>
          ) : (
            historyItems.map((entry, index) => (
              <View key={`${entry.roundNumber}-${entry.guess ?? "missed"}-${index}`} style={styles.historyChip}>
                <Text style={styles.historyGuess}>{entry.guess ?? "-"}</Text>
                <Ionicons
                  color={entry.result === "higher" ? "#ff8a6a" : entry.result === "lower" ? "#61b7ff" : entry.result === "correct" ? "#1fc46d" : "#9aa1a7"}
                  name={entry.result === "higher" ? "arrow-up" : entry.result === "lower" ? "arrow-down" : entry.result === "correct" ? "checkmark" : "remove"}
                  size={12}
                />
              </View>
            ))
          )}
        </View>
        <View style={styles.edgeSpacer} />
      </View>

      <View style={[styles.bannerCard, { backgroundColor: bannerColor }]}>
        <Ionicons color={bannerTextColor} name={bannerIcon} size={22} />
        <Text style={[styles.bannerText, { color: bannerTextColor }]}>{bannerTitle}</Text>
      </View>

      <View style={styles.guessPanel}>
        <Text style={styles.rangeLabel}>{rangeLabel}</Text>
        <View style={styles.guessPill}>
          <Text style={styles.guessValue}>{activeValue.length > 0 ? activeValue : emptyGuessValue}</Text>
          {!inputLocked ? <View style={styles.caret} /> : null}
        </View>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <Text style={styles.helperText}>{helperText}</Text>
      </View>

      <View style={styles.bottomSpacer} />

      <View style={styles.bottomControls}>
        <GameKeyboard disabled={inputLocked} onAppendDigit={appendDigit} onBackspace={removeDigit} onClear={clearDigit} />

        <Pressable
          disabled={ctaDisabled}
          onPress={isSecretSetup ? handleSubmitSecretNumber : handleSubmitGuess}
          style={({ pressed }) => [
            styles.guessButton,
            pressed && !ctaDisabled && styles.guessButtonPressed,
            ctaDisabled && styles.guessButtonDisabled
          ]}
        >
          <Text style={styles.guessButtonText}>
            {isSecretSetup
              ? isSubmittingSecret
                ? "LOCKING..."
                : "SET SECRET >"
              : isSubmitting
                ? "LOCKING..."
                : "GUESS >"}
          </Text>
        </Pressable>
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
            <Text style={styles.roundSummaryTitle}>Round {lastGuessResult.roundNumber}</Text>
            <Text style={styles.roundSummaryPrimary}>You: {lastGuessResult.guess ?? "-"}</Text>
            {roundSummaryHint ? (
              <View style={styles.roundSummaryHintRow}>
                <Ionicons color={roundSummaryHint.color} name={roundSummaryHint.icon} size={18} />
                <Text style={[styles.roundSummaryHint, { color: roundSummaryHint.color }]}>{roundSummaryHint.label}</Text>
              </View>
            ) : null}
            <Text style={styles.roundSummarySecondary}>Rival: {lastGuessResult.opponentGuess ?? "-"}</Text>
          </Animated.View>
        </Animated.View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm
  },
  toastText: {
    color: "#6d757b",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 30
  },
  edgeSpacer: {
    width: 30
  },
  miniHistory: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center"
  },
  historyPlaceholder: {
    color: "#9ca3a8",
    fontSize: 11,
    fontWeight: "800"
  },
  historyChip: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2
  },
  historyGuess: {
    color: "#8b9298",
    fontSize: 11,
    fontWeight: "900"
  },
  bannerCard: {
    alignItems: "center",
    alignSelf: "center",
    borderBottomColor: "rgba(13, 63, 104, 0.24)",
    borderBottomWidth: 5,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 44,
    minWidth: 176,
    paddingHorizontal: spacing.lg
  },
  bannerText: {
    fontSize: 18,
    fontWeight: "900"
  },
  guessPanel: {
    alignItems: "center",
    gap: spacing.sm
  },
  rangeLabel: {
    color: "#9aa1a7",
    fontSize: 13,
    fontWeight: "800"
  },
  guessPill: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#61b7ff",
    borderRadius: radii.pill,
    borderWidth: 4,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 70,
    minWidth: 200,
    paddingHorizontal: spacing.lg
  },
  guessValue: {
    color: "#15181b",
    fontSize: 42,
    fontWeight: "400"
  },
  caret: {
    backgroundColor: "#61b7ff",
    borderRadius: 2,
    height: 42,
    marginLeft: 2,
    width: 4
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  helperText: {
    color: "#6d757b",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  bottomSpacer: {
    flex: 1
  },
  bottomControls: {
    gap: spacing.sm
  },
  guessButton: {
    alignItems: "center",
    backgroundColor: "#047a37",
    borderBottomColor: "#025a29",
    borderBottomWidth: 6,
    borderColor: "#068f42",
    borderRadius: 20,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    marginHorizontal: 6,
    shadowColor: "#014e23",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  guessButtonPressed: {
    borderBottomWidth: 2,
    transform: [{ translateY: 3 }, { scale: 0.99 }]
  },
  guessButtonDisabled: {
    backgroundColor: "#b9c9bf",
    borderBottomColor: "#9cada2",
    borderColor: "#c7d3cc",
    shadowOpacity: 0
  },
  guessButtonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1
  },
  roundSummaryOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    padding: spacing.lg
  },
  roundSummaryPopup: {
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    gap: spacing.xs,
    maxWidth: 360,
    padding: spacing.lg,
    width: "100%"
  },
  roundSummaryTitle: {
    color: "#15181b",
    fontSize: 22,
    fontWeight: "900"
  },
  roundSummaryPrimary: {
    color: "#15181b",
    fontSize: 18,
    fontWeight: "900"
  },
  roundSummaryHintRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  roundSummaryHint: {
    fontSize: 15,
    fontWeight: "900"
  },
  roundSummarySecondary: {
    color: "#6d757b",
    fontSize: 14,
    fontWeight: "800"
  }
});
