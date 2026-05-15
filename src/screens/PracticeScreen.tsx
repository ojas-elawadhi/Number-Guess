import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader, HeaderBackButton, HeaderCoinsPill, HeaderScorePill } from "../components/AppHeader";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { GameStartCountdown } from "../components/GameStartCountdown";
import { ScreenContainer } from "../components/ScreenContainer";
import { useGameStartCountdown } from "../hooks/useGameStartCountdown";
import { isRewardedReviveSupported, showRewardedReviveAd } from "../services/rewardedReviveAd";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { Difficulty, GuessFeedback } from "../types/game.types";
import type { ActivePracticeRunSnapshot, MatchRecord } from "../types/progression.types";
import { formatDuration } from "../utils/progression";
import { colors, radii, spacing } from "../utils/theme";
import { getDifficultyConfig, getDifficultyRangeLabel, parseDifficulty } from "../../shared/difficulty";

interface PracticeGuessEntry {
  guess: number;
  result: GuessFeedback;
}

type PracticeRunState = "playing" | "round-cleared" | "game-over";

const keypadRows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["backspace", "0", "clear"]
] as const;

const canRestorePracticeRun = (
  snapshot: ActivePracticeRunSnapshot | undefined,
  maxNumber: number
): snapshot is ActivePracticeRunSnapshot =>
  Boolean(
    snapshot &&
      snapshot.remainingChances > 0 &&
      snapshot.roundNumber >= 1 &&
      snapshot.secretNumber >= 1 &&
      snapshot.secretNumber <= maxNumber
  );

export default function PracticeScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty: Difficulty = parseDifficulty(params.difficulty);
  const difficultyConfig = getDifficultyConfig(difficulty);
  const digitLimit = String(difficultyConfig.maxNumber).length;
  const startingChances = difficultyConfig.startingChances;
  const profile = usePlayerProgressStore((state) => state.profile);
  const coins = usePlayerProgressStore((state) => state.profile.coins);
  const extraGuessPowerUps = usePlayerProgressStore((state) => state.profile.extraGuessPowerUps);
  const recordMatch = usePlayerProgressStore((state) => state.recordMatch);
  const singlePlayerHighRounds = usePlayerProgressStore((state) => state.profile.stats.singlePlayerHighRounds);
  const singlePlayerHighScores = usePlayerProgressStore((state) => state.profile.stats.singlePlayerHighScores);
  const updateSinglePlayerHighScore = usePlayerProgressStore((state) => state.updateSinglePlayerHighScore);
  const updateSinglePlayerBestScore = usePlayerProgressStore((state) => state.updateSinglePlayerBestScore);
  const consumeExtraGuessPowerUp = usePlayerProgressStore((state) => state.consumeExtraGuessPowerUp);
  const syncActivePracticeRun = usePlayerProgressStore((state) => state.syncActivePracticeRun);
  const countdown = useGameStartCountdown();
  const { countdownActive, startCountdown } = countdown;
  const createSecretNumber = () => Math.floor(Math.random() * difficultyConfig.maxNumber) + 1;
  const savedPracticeRun = profile.activePracticeRuns[difficulty];
  const restoredPracticeRun = canRestorePracticeRun(savedPracticeRun, difficultyConfig.maxNumber)
    ? savedPracticeRun
    : null;
  const roundStartTimeRef = useRef(Date.now() - (restoredPracticeRun?.roundElapsedMs ?? 0));
  const [secretNumber, setSecretNumber] = useState(() => restoredPracticeRun?.secretNumber ?? createSecretNumber());
  const [guess, setGuess] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PracticeGuessEntry | null>(
    () => restoredPracticeRun?.guessHistory[0] ?? null
  );
  const [guessHistory, setGuessHistory] = useState<PracticeGuessEntry[]>(() => restoredPracticeRun?.guessHistory ?? []);
  const [roundNumber, setRoundNumber] = useState(() => restoredPracticeRun?.roundNumber ?? 1);
  const [remainingChances, setRemainingChances] = useState(
    () => restoredPracticeRun?.remainingChances ?? startingChances
  );
  const [currentScore, setCurrentScore] = useState(() => restoredPracticeRun?.currentScore ?? 0);
  const [lastScoreGain, setLastScoreGain] = useState(() => restoredPracticeRun?.lastScoreGain ?? 0);
  const [runState, setRunState] = useState<PracticeRunState>(() => restoredPracticeRun?.runState ?? "playing");
  const [powerUpAction, setPowerUpAction] = useState<"inventory" | "ad" | null>(null);
  const [powerUpMessage, setPowerUpMessage] = useState<string | null>(null);
  const [reviveUsedThisRun, setReviveUsedThisRun] = useState(() => restoredPracticeRun?.reviveUsedThisRun ?? false);
  const [reviveAction, setReviveAction] = useState<"ad" | null>(null);
  const [reviveMessage, setReviveMessage] = useState<string | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchRecord | null>(null);
  const isRoundCleared = runState === "round-cleared";
  const isGameOver = runState === "game-over";
  const canShowRewardedRevive = isRewardedReviveSupported();
  const isUsingRevive = reviveAction !== null;
  const canUseRewardedRevive = isGameOver && canShowRewardedRevive && !reviveUsedThisRun && !isUsingRevive;
  const canPreviewCoinRevive = isGameOver && !reviveUsedThisRun && !isUsingRevive;
  const emptyGuessValue =
    difficulty === "impossible" ? "_ _ _ _" : difficulty === "hard" ? "- - -" : "- -";
  const bannerTone = isRoundCleared
    ? "cleared"
    : isGameOver
      ? "game-over"
      : lastResult?.result === "higher"
        ? "higher"
        : lastResult?.result === "lower"
          ? "lower"
          : "ready";
  const bannerTitle =
    bannerTone === "cleared"
      ? "ROUND CLEAR"
      : bannerTone === "game-over"
        ? "OUT OF CHANCES"
        : bannerTone === "higher"
          ? "HIGHER"
          : bannerTone === "lower"
            ? "LOWER"
            : "READY";
  const bannerIcon =
    bannerTone === "cleared"
      ? "checkmark"
      : bannerTone === "game-over"
        ? "alert-circle"
        : bannerTone === "higher"
          ? "arrow-up"
          : "arrow-down";
  const bannerColor =
    bannerTone === "cleared"
      ? "#1fc46d"
      : bannerTone === "game-over"
        ? "#ff7b7b"
        : bannerTone === "higher"
          ? "#ff8a6a"
          : "#61b7ff";
  const historyItems = guessHistory.slice(0, 3).reverse();
  const ctaDisabled = countdownActive || (runState === "playing" && guess.length === 0);
  const isPlayingRound = runState === "playing";
  const isUsingPowerUp = powerUpAction !== null;
  const canUseExtraGuessPowerUp =
    isPlayingRound && !countdownActive && !isUsingPowerUp && extraGuessPowerUps > 0;
  const canWatchAdForExtraGuess =
    isPlayingRound && !countdownActive && !isUsingPowerUp && extraGuessPowerUps <= 0 && canShowRewardedRevive;
  const canTriggerExtraGuess = canUseExtraGuessPowerUp || canWatchAdForExtraGuess;

  useEffect(() => {
    if (!restoredPracticeRun) {
      startCountdown();
    }
  }, [restoredPracticeRun, startCountdown]);

  useEffect(() => {
    if (runState === "game-over") {
      void syncActivePracticeRun(difficulty, null).catch(() => {});
      return;
    }

    const snapshot: ActivePracticeRunSnapshot = {
      difficulty,
      secretNumber,
      guessHistory,
      roundNumber,
      remainingChances,
      currentScore,
      lastScoreGain,
      runState,
      reviveUsedThisRun,
      roundElapsedMs: Math.max(0, Date.now() - roundStartTimeRef.current),
      updatedAt: new Date().toISOString()
    };

    void syncActivePracticeRun(difficulty, snapshot).catch(() => {});
  }, [
    currentScore,
    difficulty,
    guessHistory,
    lastScoreGain,
    remainingChances,
    reviveUsedThisRun,
    roundNumber,
    runState,
    secretNumber,
    syncActivePracticeRun
  ]);

  const persistHighScoreIfNeeded = (candidateRound: number) => {
    if (candidateRound > singlePlayerHighRounds[difficulty]) {
      void updateSinglePlayerHighScore(difficulty, candidateRound);
    }
  };

  const persistBestScoreIfNeeded = (candidateScore: number) => {
    if (candidateScore > singlePlayerHighScores[difficulty]) {
      void updateSinglePlayerBestScore(difficulty, candidateScore);
    }
  };

  const handleBackPress = () => {
    persistHighScoreIfNeeded(roundNumber);
    persistBestScoreIfNeeded(currentScore);
    router.back();
  };

  const handleSubmitGuess = () => {
    if (runState !== "playing") {
      return;
    }

    const parsedGuess = Number(guess);

    if (!Number.isInteger(parsedGuess) || parsedGuess < 1 || parsedGuess > difficultyConfig.maxNumber) {
      setErrorMessage(`Use 1-${difficultyConfig.maxNumber}.`);
      return;
    }

    const result: GuessFeedback =
      parsedGuess === secretNumber ? "correct" : parsedGuess < secretNumber ? "higher" : "lower";
    const entry = { guess: parsedGuess, result } satisfies PracticeGuessEntry;
    const attempts = guessHistory.length + 1;
    const nextRemainingChances = Math.max(remainingChances - 1, 0);

    setLastResult(entry);
    setGuessHistory((currentHistory) => [entry, ...currentHistory].slice(0, 8));
    setGuess("");
    setErrorMessage(null);
    setMatchSummary(null);
    setPowerUpMessage(null);
    setRemainingChances(nextRemainingChances);

    if (result === "correct") {
      const durationMs = Date.now() - roundStartTimeRef.current;
      const scoreGain = nextRemainingChances + 1;
      const nextScore = currentScore + scoreGain;

      setCurrentScore(nextScore);
      setLastScoreGain(scoreGain);
      setRunState("round-cleared");
      persistHighScoreIfNeeded(roundNumber);
      persistBestScoreIfNeeded(nextScore);
      void recordMatch({
        category: "single-player",
        mode: "practice",
        difficulty,
        outcome: "win",
        attempts,
        durationMs,
        opponentName: "Practice Board",
        opponentPersona: "Solo training"
      })
        .then(setMatchSummary)
        .catch(() => { });

      return;
    }

    if (nextRemainingChances === 0) {
      persistHighScoreIfNeeded(roundNumber);
      persistBestScoreIfNeeded(currentScore);
      setLastScoreGain(0);
      setRunState("game-over");
    }
  };

  const handleNextRound = () => {
    const nextRoundNumber = roundNumber + 1;

    persistHighScoreIfNeeded(nextRoundNumber);
    roundStartTimeRef.current = Date.now();
    setSecretNumber(createSecretNumber());
    setGuess("");
    setErrorMessage(null);
    setReviveMessage(null);
    setPowerUpMessage(null);
    setLastResult(null);
    setLastScoreGain(0);
    setGuessHistory([]);
    setRoundNumber(nextRoundNumber);
    setRemainingChances(startingChances);
    setRunState("playing");
    setMatchSummary(null);
  };

  const applyRevive = () => {
    setGuess("");
    setErrorMessage(null);
    setReviveMessage(null);
    setPowerUpMessage(null);
    setLastResult(null);
    setLastScoreGain(0);
    setRemainingChances(4);
    setRunState("playing");
    setReviveUsedThisRun(true);
  };

  const handleUseRewardedRevive = async () => {
    if (!canUseRewardedRevive) {
      return;
    }

    try {
      setReviveAction("ad");
      setReviveMessage(null);
      const rewarded = await showRewardedReviveAd();

      if (!rewarded) {
        setReviveMessage("Ad was skipped or unavailable. Try again.");
        return;
      }

      applyRevive();
    } finally {
      setReviveAction(null);
    }
  };

  const handlePreviewCoinRevive = () => {
    if (!canPreviewCoinRevive) {
      return;
    }

    setReviveMessage("150-coin revive UI is ready. Coin spending will be wired up next.");
  };

  const handlePlayAgain = () => {
    roundStartTimeRef.current = Date.now();
    setSecretNumber(createSecretNumber());
    setGuess("");
    setErrorMessage(null);
    setReviveMessage(null);
    setLastResult(null);
    setLastScoreGain(0);
    setGuessHistory([]);
    setCurrentScore(0);
    setRoundNumber(1);
    setRemainingChances(startingChances);
    setRunState("playing");
    setReviveUsedThisRun(false);
    setMatchSummary(null);
    startCountdown();
  };

  const applyExtraGuess = (source: "inventory" | "ad") => {
    setRemainingChances((currentChances) => currentChances + 1);
    setPowerUpMessage(
      source === "inventory" ? "Extra guess power-up used." : "Reward unlocked. You got 1 extra guess."
    );
  };

  const handleUseExtraGuessPowerUp = async () => {
    if (!canTriggerExtraGuess) {
      return;
    }

    if (canUseExtraGuessPowerUp) {
      try {
        setPowerUpAction("inventory");
        const used = await consumeExtraGuessPowerUp();

        if (!used) {
          setPowerUpMessage("That power-up could not be used right now.");
          return;
        }

        applyExtraGuess("inventory");
      } finally {
        setPowerUpAction(null);
      }

      return;
    }

    if (!canWatchAdForExtraGuess) {
      return;
    }

    try {
      setPowerUpAction("ad");
      const rewarded = await showRewardedReviveAd();

      if (!rewarded) {
        setPowerUpMessage("Ad was skipped or unavailable. Try again.");
        return;
      }

      applyExtraGuess("ad");
    } finally {
      setPowerUpAction(null);
    }
  };

  const appendDigit = (digit: string) => {
    if (countdownActive || runState !== "playing" || guess.length >= digitLimit) {
      return;
    }

    setGuess((currentGuess) => `${currentGuess}${digit}`);
    setErrorMessage(null);
  };

  const removeDigit = () => {
    if (countdownActive || runState !== "playing") {
      return;
    }

    setGuess((currentGuess) => currentGuess.slice(0, -1));
    setErrorMessage(null);
  };

  const clearDigit = () => {
    if (countdownActive || runState !== "playing") {
      return;
    }

    setGuess("");
    setErrorMessage(null);
  };

  const renderKey = (key: (typeof keypadRows)[number][number]) => {
    const disabled = countdownActive || runState !== "playing";
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

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <ConfettiBurst visible={isRoundCleared} />
      <GameStartCountdown controller={countdown} />
      <AppHeader
        center={<HeaderScorePill score={currentScore} />}
        left={<HeaderBackButton onPress={handleBackPress} />}
        right={<HeaderCoinsPill coins={coins} />}
      />

      <View style={styles.historyRow}>
        {historyItems.length === 0 ? (
          <Text style={styles.historyPlaceholder}>Range {getDifficultyRangeLabel(difficulty)}</Text>
        ) : (
          historyItems.map((entry, index) => (
            <View key={`${entry.guess}-${index}`} style={styles.historyChip}>
              <Text style={styles.historyGuess}>{entry.guess}</Text>
              <Ionicons
                color={entry.result === "higher" ? "#ff8a6a" : entry.result === "lower" ? "#61b7ff" : "#1fc46d"}
                name={entry.result === "higher" ? "arrow-up" : entry.result === "lower" ? "arrow-down" : "checkmark"}
                size={12}
              />
            </View>
          ))
        )}
      </View>

      <View style={[styles.bannerCard, { backgroundColor: bannerColor }]}>
        <Ionicons color="#0d3f68" name={bannerIcon} size={22} />
        <Text style={styles.bannerText}>{bannerTitle}</Text>
      </View>

      <View style={styles.guessPanel}>
        <View style={styles.statusRow}>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>
              {remainingChances} {remainingChances === 1 ? "CHANCE" : "CHANCES"}
            </Text>
          </View>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>ROUND {roundNumber}</Text>
          </View>
        </View>

        <Text style={styles.rangeLabel}>{getDifficultyRangeLabel(difficulty)}</Text>
        <View style={styles.guessPill}>
          <Text style={styles.guessValue}>{guess.length > 0 ? guess : emptyGuessValue}</Text>
          {!countdownActive && runState === "playing" ? <View style={styles.caret} /> : null}
        </View>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {isRoundCleared ? (
          <Text style={styles.statusMeta}>
            {matchSummary
              ? `Solved in ${guessHistory.length} | +${matchSummary.points} pts | ${formatDuration(matchSummary.durationMs)}`
              : `Solved in ${guessHistory.length} guesses`}
          </Text>
        ) : null}
        {isRoundCleared ? (
          <Text style={styles.statusMeta}>
            +{lastScoreGain} score from leftover guesses
          </Text>
        ) : null}
        {!isRoundCleared && !isGameOver && powerUpMessage ? (
          <Text style={styles.statusMeta}>{powerUpMessage}</Text>
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
            disabled={!canTriggerExtraGuess}
            onPress={() => void handleUseExtraGuessPowerUp()}
            style={({ pressed }) => [
              styles.powerUpButton,
              pressed && canTriggerExtraGuess && styles.guessButtonPressed,
              !canTriggerExtraGuess && styles.guessButtonDisabled
            ]}
          >
            <Text style={styles.powerUpButtonLabel}>EXTRA GUESS</Text>
            <View style={styles.powerUpBadge}>
              {extraGuessPowerUps > 0 ? (
                <>
                  <Ionicons color="#fff6c8" name="flash" size={15} />
                  <Text style={styles.powerUpBadgeText}>
                    {powerUpAction === "inventory" ? "USING..." : `x${extraGuessPowerUps}`}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons color="#ffffff" name="play-circle" size={15} />
                  <Text style={styles.powerUpBadgeText}>
                    {powerUpAction === "ad"
                      ? "LOADING..."
                      : canShowRewardedRevive
                        ? "FREE"
                        : "NO ADS"}
                  </Text>
                </>
              )}
            </View>
          </Pressable>

          <Pressable
            disabled={ctaDisabled}
            onPress={isRoundCleared ? handleNextRound : isGameOver ? handlePlayAgain : handleSubmitGuess}
            style={({ pressed }) => [
              styles.guessButton,
              pressed && !ctaDisabled && styles.guessButtonPressed,
              ctaDisabled && styles.guessButtonDisabled
            ]}
          >
            <Text style={styles.guessButtonText}>
              {isRoundCleared ? "NEXT ROUND >" : isGameOver ? "NEW GAME" : "GUESS >"}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal animationType="fade" statusBarTranslucent transparent visible={isGameOver}>
        <View style={styles.gameOverOverlay}>
          <View style={styles.gameOverCard}>
            <Text style={styles.gameOverTitle}>GAME OVER</Text>
            <View style={styles.gameOverIconWrap}>
              <Text style={styles.gameOverIcon}>!</Text>
            </View>
            <Text style={styles.gameOverMessage}>Keep your streak going or your score will be reset.</Text>
            {reviveUsedThisRun ? (
              <Text style={styles.gameOverHint}>Revive already used for this game.</Text>
            ) : null}
            {reviveMessage ? <Text style={styles.gameOverHint}>{reviveMessage}</Text> : null}

            <View style={styles.gameOverActionRow}>
              <Pressable
                disabled={!canUseRewardedRevive}
                onPress={() => void handleUseRewardedRevive()}
                style={({ pressed }) => [
                  styles.gameOverReviveButton,
                  styles.gameOverAdButton,
                  pressed && canUseRewardedRevive && styles.guessButtonPressed,
                  !canUseRewardedRevive && styles.guessButtonDisabled
                ]}
              >
                <Text style={styles.gameOverReviveButtonTitle}>REVIVE</Text>
                <View style={styles.gameOverBadge}>
                  <Ionicons color="#ffffff" name="play-circle" size={16} />
                  <Text style={styles.gameOverBadgeText}>
                    {reviveUsedThisRun
                      ? "USED"
                      : reviveAction === "ad"
                        ? "LOADING..."
                        : canShowRewardedRevive
                          ? "FREE AD"
                          : "AD UNAVAILABLE"}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                disabled={!canPreviewCoinRevive}
                onPress={handlePreviewCoinRevive}
                style={({ pressed }) => [
                  styles.gameOverReviveButton,
                  styles.gameOverCoinButton,
                  pressed && canPreviewCoinRevive && styles.guessButtonPressed,
                  !canPreviewCoinRevive && styles.guessButtonDisabled
                ]}
              >
                <Text style={styles.gameOverReviveButtonTitle}>REVIVE</Text>
                <View style={styles.gameOverBadge}>
                  <Ionicons color="#fff7c2" name="cash" size={16} />
                  <Text style={styles.gameOverBadgeText}>150 COINS</Text>
                </View>
              </Pressable>
            </View>

          </View>

          <Pressable
            onPress={handlePlayAgain}
            style={({ pressed }) => [
              styles.gameOverDismissButton,
              pressed && styles.guessButtonPressed
            ]}
          >
            <Text style={styles.gameOverDismissText}>NO THANKS</Text>
          </Pressable>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm
  },
  historyRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
    minHeight: 24
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
    borderBottomColor: "rgba(13, 63, 104, 0.35)",
    borderBottomWidth: 5,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 44,
    minWidth: 162,
    paddingHorizontal: spacing.lg
  },
  bannerText: {
    color: "#0d3f68",
    fontSize: 18,
    fontWeight: "900"
  },
  guessPanel: {
    alignItems: "center",
    gap: spacing.sm
  },
  statusRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  statusChip: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8dde2",
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.md
  },
  statusChipText: {
    color: "#66717a",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8
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
    minWidth: 182,
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
  statusMeta: {
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
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  keypadWrap: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    gap: spacing.sm,
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
    height: 44,
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
    flex: 0.92,
    height: 48,
    justifyContent: "center"
  },
  powerUpButton: {
    alignItems: "center",
    backgroundColor: "#1f6fb9",
    borderBottomColor: "#134c81",
    borderBottomWidth: 6,
    borderRadius: 24,
    flex: 1.08,
    gap: 6,
    height: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  powerUpButtonLabel: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.9
  },
  powerUpBadge: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 20,
    minWidth: 76,
    paddingHorizontal: 10
  },
  powerUpBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6
  },
  gameOverOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    padding: spacing.lg
  },
  gameOverCard: {
    backgroundColor: "#eef0ff",
    borderColor: "#5b93ff",
    borderWidth: 6,
    borderRadius: 30,
    gap: spacing.sm,
    padding: spacing.lg,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
    width: "100%",
    maxWidth: 420
  },
  gameOverIconWrap: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#ff8f24",
    borderColor: "#ff541f",
    borderRadius: 42,
    borderWidth: 6,
    height: 84,
    justifyContent: "center",
    width: 84
  },
  gameOverIcon: {
    color: "#fff7cf",
    fontSize: 42,
    fontWeight: "900"
  },
  gameOverTitle: {
    color: "#15181b",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1.2,
    textAlign: "center"
  },
  gameOverMessage: {
    color: "#31456f",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 28,
    textAlign: "center"
  },
  gameOverHint: {
    color: "#6d757b",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center"
  },
  gameOverActionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  gameOverReviveButton: {
    alignItems: "center",
    borderRadius: 28,
    borderBottomWidth: 7,
    flex: 1,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 108,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md
  },
  gameOverAdButton: {
    backgroundColor: "#eb4cae",
    borderBottomColor: "#af1f72"
  },
  gameOverCoinButton: {
    backgroundColor: "#5ce125",
    borderBottomColor: "#2da10c"
  },
  gameOverReviveButtonTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1
  },
  gameOverBadge: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 110,
    paddingHorizontal: spacing.md
  },
  gameOverBadgeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.6
  },
  gameOverDismissButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: radii.pill,
    height: 40,
    justifyContent: "center"
  },
  gameOverDismissText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.8,
    textDecorationLine: "underline"
  },
  guessButtonPressed: {
    transform: [{ scale: 0.99 }]
  },
  guessButtonDisabled: {
    opacity: 0.5
  },
  guessButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1
  },
  pressed: {
    opacity: 0.82
  }
});
