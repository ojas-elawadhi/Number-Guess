import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ConfettiBurst } from "../components/ConfettiBurst";
import { GameStartCountdown } from "../components/GameStartCountdown";
import { ScreenContainer } from "../components/ScreenContainer";
import { useGameStartCountdown } from "../hooks/useGameStartCountdown";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { Difficulty, GuessFeedback } from "../types/game.types";
import type { MatchRecord } from "../types/progression.types";
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

export default function PracticeScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty: Difficulty = parseDifficulty(params.difficulty);
  const difficultyConfig = getDifficultyConfig(difficulty);
  const digitLimit = String(difficultyConfig.maxNumber).length;
  const startingChances = difficultyConfig.startingChances;
  const recordMatch = usePlayerProgressStore((state) => state.recordMatch);
  const singlePlayerHighRounds = usePlayerProgressStore((state) => state.profile.stats.singlePlayerHighRounds);
  const singlePlayerHighScores = usePlayerProgressStore((state) => state.profile.stats.singlePlayerHighScores);
  const updateSinglePlayerHighScore = usePlayerProgressStore((state) => state.updateSinglePlayerHighScore);
  const updateSinglePlayerBestScore = usePlayerProgressStore((state) => state.updateSinglePlayerBestScore);
  const countdown = useGameStartCountdown();
  const { countdownActive, startCountdown } = countdown;
  const roundStartTimeRef = useRef(Date.now());
  const createSecretNumber = () => Math.floor(Math.random() * difficultyConfig.maxNumber) + 1;
  const [secretNumber, setSecretNumber] = useState(() => createSecretNumber());
  const [guess, setGuess] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PracticeGuessEntry | null>(null);
  const [guessHistory, setGuessHistory] = useState<PracticeGuessEntry[]>([]);
  const [roundNumber, setRoundNumber] = useState(1);
  const [remainingChances, setRemainingChances] = useState(startingChances);
  const [currentScore, setCurrentScore] = useState(0);
  const [lastScoreGain, setLastScoreGain] = useState(0);
  const [runState, setRunState] = useState<PracticeRunState>("playing");
  const [matchSummary, setMatchSummary] = useState<MatchRecord | null>(null);
  const isRoundCleared = runState === "round-cleared";
  const isGameOver = runState === "game-over";
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

  useEffect(() => {
    startCountdown();
  }, [startCountdown]);

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
    setLastResult(null);
    setLastScoreGain(0);
    setGuessHistory([]);
    setRoundNumber(nextRoundNumber);
    setRemainingChances(startingChances);
    setRunState("playing");
    setMatchSummary(null);
  };

  const handlePlayAgain = () => {
    roundStartTimeRef.current = Date.now();
    setSecretNumber(createSecretNumber());
    setGuess("");
    setErrorMessage(null);
    setLastResult(null);
    setLastScoreGain(0);
    setGuessHistory([]);
    setCurrentScore(0);
    setRoundNumber(1);
    setRemainingChances(startingChances);
    setRunState("playing");
    setMatchSummary(null);
    startCountdown();
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
      <View style={styles.topRow}>
        <Pressable onPress={handleBackPress} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons color="#636b72" name="arrow-back" size={22} />
        </Pressable>

        <View style={styles.miniHistory}>
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
            <Text style={styles.statusChipText}>SCORE {currentScore}</Text>
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
        {isGameOver ? (
          <Text style={styles.statusMeta}>
            Run ended | Final score {currentScore}
          </Text>
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
            {isRoundCleared ? "NEXT ROUND >" : isGameOver ? "NEW RUN" : "GUESS >"}
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 30
  },
  backButton: {
    alignItems: "center",
    height: 30,
    justifyContent: "center",
    width: 30
  },
  miniHistory: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    paddingRight: 30
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
    height: 54,
    justifyContent: "center"
  },
  guessButtonPressed: {
    transform: [{ scale: 0.99 }]
  },
  guessButtonDisabled: {
    opacity: 0.5
  },
  guessButtonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1
  },
  pressed: {
    opacity: 0.82
  }
});
