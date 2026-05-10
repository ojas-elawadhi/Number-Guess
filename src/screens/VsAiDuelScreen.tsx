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

interface AiDuelRoundEntry {
  roundNumber: number;
  playerGuess: number;
  playerResult: GuessFeedback;
  aiGuess: number;
  aiResult: GuessFeedback;
}

type DuelWinner = "player" | "ai" | "tie" | null;

const keypadRows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["backspace", "0", "clear"]
] as const;

const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export default function VsAiDuelScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty: Difficulty = parseDifficulty(params.difficulty);
  const difficultyConfig = getDifficultyConfig(difficulty);
  const digitLimit = String(difficultyConfig.maxNumber).length;
  const recordMatch = usePlayerProgressStore((state) => state.recordMatch);
  const countdown = useGameStartCountdown();
  const { countdownActive, startCountdown } = countdown;
  const startTimeRef = useRef(Date.now());
  const recordedMatchRef = useRef(false);
  const [playerSecretInput, setPlayerSecretInput] = useState("");
  const [playerSecretNumber, setPlayerSecretNumber] = useState<number | null>(null);
  const [aiSecretNumber, setAiSecretNumber] = useState<number | null>(null);
  const [guess, setGuess] = useState("");
  const [roundNumber, setRoundNumber] = useState(1);
  const [aiMin, setAiMin] = useState(1);
  const [aiMax, setAiMax] = useState(difficultyConfig.maxNumber);
  const [lastRound, setLastRound] = useState<AiDuelRoundEntry | null>(null);
  const [history, setHistory] = useState<AiDuelRoundEntry[]>([]);
  const [winner, setWinner] = useState<DuelWinner>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchRecord | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace({
      pathname: "/vs-ai-difficulty",
      params: { mode: "duel" }
    });
  };

  const isSetup = playerSecretNumber === null || aiSecretNumber === null;
  const isComplete = winner !== null;
  const activeValue = isSetup ? playerSecretInput : guess;
  const revealAiSecret = !isSetup && isComplete && winner === "ai" ? aiSecretNumber : null;
  const emptyGuessValue =
    difficulty === "impossible" ? "_ _ _ _" : difficulty === "hard" ? "- - -" : "- -";
  const bannerTone =
    isSetup
      ? "setup"
      : winner === "player"
        ? "player"
        : winner === "ai"
          ? "ai"
          : winner === "tie"
            ? "tie"
            : lastRound?.playerResult === "higher"
              ? "higher"
              : lastRound?.playerResult === "lower"
                ? "lower"
                : "ready";
  const bannerTitle =
    bannerTone === "setup"
      ? "SET SECRET"
      : bannerTone === "player"
        ? "YOU WIN"
        : bannerTone === "ai"
          ? "AI WINS"
          : bannerTone === "tie"
            ? "TIE"
            : bannerTone === "higher"
              ? "HIGHER"
              : bannerTone === "lower"
                ? "LOWER"
                : "READY";
  const bannerIcon =
    bannerTone === "setup"
      ? "lock-closed"
      : bannerTone === "player"
        ? "checkmark"
        : bannerTone === "ai"
          ? "hardware-chip"
          : bannerTone === "tie"
            ? "remove"
            : bannerTone === "higher"
              ? "arrow-up"
              : "arrow-down";
  const bannerColor =
    bannerTone === "setup"
      ? "#7fd6ff"
      : bannerTone === "player"
        ? "#1fc46d"
        : bannerTone === "ai"
          ? "#ff9d99"
          : bannerTone === "tie"
            ? "#b1b7c2"
            : bannerTone === "higher"
              ? "#ff8a6a"
              : "#61b7ff";
  const historyItems = history.slice(0, 3).reverse();
  const ctaDisabled = countdownActive || activeValue.length === 0 || (!isSetup && isComplete);

  useEffect(() => {
    if (!isComplete || recordedMatchRef.current) {
      return;
    }

    recordedMatchRef.current = true;
    const outcome = winner === "player" ? "win" : winner === "tie" ? "tie" : "loss";

    recordMatch({
      category: "vs-ai",
      mode: "duel",
      difficulty,
      outcome,
      attempts: history.length,
      durationMs: Date.now() - startTimeRef.current,
      opponentName: "Nova AI",
      opponentPersona: "Nova AI"
    })
      .then(setMatchSummary)
      .catch(() => {});
  }, [difficulty, history.length, isComplete, recordMatch, winner]);

  const handleStartDuel = () => {
    const parsedSecretNumber = Number(playerSecretInput);

    if (!Number.isInteger(parsedSecretNumber) || parsedSecretNumber < 1 || parsedSecretNumber > difficultyConfig.maxNumber) {
      setErrorMessage(`Use 1-${difficultyConfig.maxNumber}.`);
      return;
    }

    startTimeRef.current = Date.now();
    recordedMatchRef.current = false;
    setPlayerSecretNumber(parsedSecretNumber);
    setAiSecretNumber(randomBetween(1, difficultyConfig.maxNumber));
    setGuess("");
    setRoundNumber(1);
    setAiMin(1);
    setAiMax(difficultyConfig.maxNumber);
    setLastRound(null);
    setHistory([]);
    setWinner(null);
    setErrorMessage(null);
    setMatchSummary(null);
    startCountdown();
  };

  const handleSubmitGuess = () => {
    if (playerSecretNumber === null || aiSecretNumber === null) {
      return;
    }

    const parsedGuess = Number(guess);

    if (!Number.isInteger(parsedGuess) || parsedGuess < 1 || parsedGuess > difficultyConfig.maxNumber) {
      setErrorMessage(`Use 1-${difficultyConfig.maxNumber}.`);
      return;
    }

    const playerResult: GuessFeedback =
      parsedGuess === aiSecretNumber ? "correct" : parsedGuess < aiSecretNumber ? "higher" : "lower";
    const aiGuess = randomBetween(aiMin, aiMax);
    const aiResult: GuessFeedback =
      aiGuess === playerSecretNumber ? "correct" : aiGuess < playerSecretNumber ? "higher" : "lower";
    const roundEntry: AiDuelRoundEntry = { roundNumber, playerGuess: parsedGuess, playerResult, aiGuess, aiResult };

    setLastRound(roundEntry);
    setHistory((currentHistory) => [roundEntry, ...currentHistory].slice(0, 8));
    setGuess("");
    setErrorMessage(null);

    if (playerResult === "correct" && aiResult === "correct") {
      setWinner("tie");
      return;
    }

    if (playerResult === "correct") {
      setWinner("player");
      return;
    }

    if (aiResult === "correct") {
      setWinner("ai");
      return;
    }

    if (aiResult === "higher") {
      setAiMin(aiGuess + 1);
    } else if (aiResult === "lower") {
      setAiMax(aiGuess - 1);
    }

    setRoundNumber((currentRound) => currentRound + 1);
  };

  const handlePlayAgain = () => {
    startTimeRef.current = Date.now();
    recordedMatchRef.current = false;
    setPlayerSecretInput("");
    setPlayerSecretNumber(null);
    setAiSecretNumber(null);
    setGuess("");
    setRoundNumber(1);
    setAiMin(1);
    setAiMax(difficultyConfig.maxNumber);
    setLastRound(null);
    setHistory([]);
    setWinner(null);
    setErrorMessage(null);
    setMatchSummary(null);
  };

  const appendDigit = (digit: string) => {
    if (countdownActive || (!isSetup && isComplete) || activeValue.length >= digitLimit) {
      return;
    }

    if (isSetup) {
      setPlayerSecretInput((currentValue) => `${currentValue}${digit}`);
    } else {
      setGuess((currentValue) => `${currentValue}${digit}`);
    }
    setErrorMessage(null);
  };

  const removeDigit = () => {
    if (countdownActive || (!isSetup && isComplete)) {
      return;
    }

    if (isSetup) {
      setPlayerSecretInput((currentValue) => currentValue.slice(0, -1));
    } else {
      setGuess((currentValue) => currentValue.slice(0, -1));
    }
    setErrorMessage(null);
  };

  const clearDigit = () => {
    if (countdownActive || (!isSetup && isComplete)) {
      return;
    }

    if (isSetup) {
      setPlayerSecretInput("");
    } else {
      setGuess("");
    }
    setErrorMessage(null);
  };

  const renderKey = (key: (typeof keypadRows)[number][number]) => {
    const disabled = countdownActive || (!isSetup && isComplete);
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
      <ConfettiBurst visible={winner === "player" || winner === "tie"} />
      <GameStartCountdown controller={countdown} />

      <View style={styles.topRow}>
        <Pressable
          hitSlop={10}
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons color="#636b72" name="arrow-back" size={22} />
        </Pressable>

        <View style={styles.miniHistory}>
          {isSetup ? (
            <Text style={styles.historyPlaceholder}>Secret Range {getDifficultyRangeLabel(difficulty)}</Text>
          ) : historyItems.length === 0 ? (
            <Text style={styles.historyPlaceholder}>AI search {aiMin}-{aiMax}</Text>
          ) : (
            historyItems.map((entry, index) => (
              <View key={`${entry.playerGuess}-${index}`} style={styles.historyChip}>
                <Text style={styles.historyGuess}>{entry.playerGuess}</Text>
                <Ionicons
                  color={entry.playerResult === "higher" ? "#ff8a6a" : entry.playerResult === "lower" ? "#61b7ff" : "#1fc46d"}
                  name={entry.playerResult === "higher" ? "arrow-up" : entry.playerResult === "lower" ? "arrow-down" : "checkmark"}
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
        <Text style={styles.rangeLabel}>
          {isSetup
            ? `Choose your secret ${getDifficultyRangeLabel(difficulty)}`
            : revealAiSecret !== null
              ? "Nova AI secret"
              : `Your secret ${playerSecretNumber}`}
        </Text>
        <View style={styles.guessPill}>
          <Text style={styles.guessValue}>
            {activeValue.length > 0 ? activeValue : revealAiSecret !== null ? `${revealAiSecret}` : emptyGuessValue}
          </Text>
          {!countdownActive && (!isSetup ? !isComplete : true) ? <View style={styles.caret} /> : null}
        </View>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <Text style={styles.helperText}>
          {isSetup
            ? "Set your secret, then face Nova AI."
            : isComplete
              ? matchSummary
                ? `${bannerTitle} | +${matchSummary.points} pts | ${formatDuration(matchSummary.durationMs)}`
                : bannerTitle
              : `Nova AI search ${aiMin}-${aiMax} | Round ${roundNumber}`}
        </Text>
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
          onPress={isSetup ? handleStartDuel : isComplete ? handlePlayAgain : handleSubmitGuess}
          style={({ pressed }) => [
            styles.guessButton,
            pressed && !ctaDisabled && styles.guessButtonPressed,
            ctaDisabled && styles.guessButtonDisabled
          ]}
        >
          <Text style={styles.guessButtonText}>
            {isSetup ? "START DUEL >" : isComplete ? "REMATCH" : "LOCK >"}
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
    minWidth: 174,
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
