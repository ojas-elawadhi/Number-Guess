import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader, HeaderBackButton } from "../components/AppHeader";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { GameStartCountdown } from "../components/GameStartCountdown";
import { ScreenContainer } from "../components/ScreenContainer";
import { VsAiWinModal } from "../components/VsAiWinModal";
import { useGameStartCountdown } from "../hooks/useGameStartCountdown";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { Difficulty, GuessFeedback } from "../types/game.types";
import type { MatchRecord } from "../types/progression.types";
import { formatDuration } from "../utils/progression";
import { colors, radii, spacing } from "../utils/theme";
import { getDifficultyConfig, parseDifficulty } from "../../shared/difficulty";

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

  const modeRangeLabel = `1-${difficultyConfig.maxNumber}`;
  const isSetup = playerSecretNumber === null || aiSecretNumber === null;
  const isComplete = winner !== null;
  const activeValue = isSetup ? playerSecretInput : guess;
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
  const historyItems = history.slice(0, 2);
  const ctaDisabled = countdownActive || activeValue.length === 0 || (!isSetup && isComplete);
  const resultDetail = matchSummary
    ? `Solved in ${history.length} rounds | +${matchSummary.points} pts | ${formatDuration(matchSummary.durationMs)}`
    : `Solved in ${history.length} rounds`;
  const showResultModal = winner === "player" || winner === "ai";
  const statusMeta = isSetup
    ? "Choose your secret. Nova AI will try to crack it."
    : isComplete
      ? matchSummary
        ? `${bannerTitle} | +${matchSummary.points} pts | ${formatDuration(matchSummary.durationMs)}`
        : bannerTitle
      : lastRound
        ? `Nova AI guessed ${lastRound.aiGuess} on round ${lastRound.roundNumber}.`
        : "Guess Nova AI's number before it cracks yours.";
  const heroValue = activeValue.length > 0 ? activeValue : "--";
  const statusPillLabel = isSetup ? "LOCK IT" : isComplete ? "MATCH END" : "NOVA AI";

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
      <VsAiWinModal
        actionLabel="REMATCH"
        accentColor={winner === "ai" ? "#f58b96" : undefined}
        buttonColor={winner === "ai" ? "#de6674" : undefined}
        buttonShadowColor={winner === "ai" ? "#bb4e5d" : undefined}
        cardBackgroundColor={winner === "ai" ? "#fff4f6" : undefined}
        detailColor={winner === "ai" ? "#9d5761" : undefined}
        detail={resultDetail}
        iconColor={winner === "ai" ? "#fff2f4" : undefined}
        iconName={winner === "ai" ? "hardware-chip" : undefined}
        iconRingColor={winner === "ai" ? "#ec7683" : undefined}
        message={
          winner === "ai"
            ? playerSecretNumber !== null
              ? `Your secret was ${playerSecretNumber}.`
              : "Nova AI cracked your secret."
            : aiSecretNumber !== null
              ? `Nova AI's secret was ${aiSecretNumber}.`
              : "You cracked Nova AI's secret."
        }
        messageColor={winner === "ai" ? "#8b3e49" : undefined}
        onAction={handlePlayAgain}
        onSecondaryAction={() => router.replace("/")}
        secondaryAccentColor={winner === "ai" ? "#cf5c69" : undefined}
        secondaryActionLabel="MENU"
        showConfetti={winner === "player"}
        title={winner === "ai" ? "AI WINS" : "YOU WIN"}
        titleColor={winner === "ai" ? "#5d2430" : undefined}
        visible={showResultModal}
      />

      <AppHeader
        left={<HeaderBackButton onPress={handleBack} />}
        right={
          <View style={styles.headerRoundPill}>
            <Text style={styles.headerRoundLabel}>{isSetup ? "MODE" : "ROUND"}</Text>
            <Text style={styles.headerRoundValue}>{isSetup ? "SET" : roundNumber}</Text>
          </View>
        }
      />

      <View style={styles.playInfoBar}>
        <View style={styles.playInfoCenter}>
          <View style={styles.modeHint}>
            <Text style={styles.modeHintMode}>{difficultyConfig.label}</Text>
            <Text style={styles.modeHintRange}>{modeRangeLabel}</Text>
          </View>
        </View>

        <View style={[styles.statusPillWrap, isSetup && styles.statusPillSetup]}>
          <Ionicons color="#fff4f5" name={isSetup ? "lock-closed" : "hardware-chip"} size={12} />
          <Text style={styles.statusPillText}>{statusPillLabel}</Text>
        </View>
      </View>

      <View style={styles.guessPanel}>
        <View style={styles.guessHero}>
          <Text style={[styles.guessInputValue, activeValue.length === 0 && styles.guessInputValueEmpty]}>
            {heroValue}
          </Text>
        </View>

        <View style={[styles.bannerCard, { borderColor: bannerColor }]}>
          <Ionicons color={bannerColor} name={bannerIcon} size={20} />
          <Text style={[styles.bannerText, { color: bannerColor }]}>{bannerTitle}</Text>
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <Text style={styles.statusMeta}>{statusMeta}</Text>
        {!isSetup && playerSecretNumber !== null ? (
          <Text style={styles.secretMeta}>Your secret: {playerSecretNumber}</Text>
        ) : null}
      </View>

      <View style={styles.bottomSpacer} />

      <View style={styles.bottomControls}>
        {!isSetup && historyItems.length > 0 ? (
          <View style={styles.historyList}>
            {historyItems.map((entry, index) => {
              const resultColor =
                entry.playerResult === "higher" ? "#ff8a6a" : entry.playerResult === "lower" ? "#61b7ff" : "#1fc46d";
              const resultLabel =
                entry.playerResult === "higher" ? "GO HIGHER" : entry.playerResult === "lower" ? "GO LOWER" : "CORRECT";

              return (
                <View key={`${entry.playerGuess}-${index}`} style={styles.historyCard}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyGuess}>{entry.playerGuess}</Text>
                    <Text style={styles.historyMeta}>Round {entry.roundNumber}</Text>
                  </View>

                  <View style={styles.historyBadgeWrap}>
                    <View style={[styles.historyResultBadge, { borderColor: resultColor }]}>
                      <Text style={[styles.historyResultText, { color: resultColor }]}>{resultLabel}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

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
            {isSetup ? "LOCK NUMBER >" : isComplete ? "REMATCH" : "LOCK >"}
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingBottom: 0,
    paddingTop: 0
  },
  headerRoundPill: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8dde2",
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 62,
    paddingHorizontal: spacing.sm
  },
  headerRoundLabel: {
    color: "#8b9298",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8
  },
  headerRoundValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
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
    gap: spacing.xs,
    justifyContent: "center"
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
  statusPillWrap: {
    alignItems: "center",
    backgroundColor: "#ef6d7a",
    borderBottomColor: "#ce5662",
    borderBottomWidth: 3,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 26,
    minWidth: 84,
    paddingHorizontal: 9,
    position: "absolute",
    right: 0
  },
  statusPillSetup: {
    backgroundColor: "#4aa7ff",
    borderBottomColor: "#2d79cf"
  },
  statusPillText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900"
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
    paddingHorizontal: spacing.lg
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
  secretMeta: {
    color: "#7f3440",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center"
  },
  bottomSpacer: {
    flex: 1
  },
  bottomControls: {
    gap: spacing.xs
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
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1
  },
  historyLeft: {
    alignItems: "flex-start",
    justifyContent: "center",
    flex: 1
  },
  historyGuess: {
    color: "#606367",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 32
  },
  historyMeta: {
    color: "#9aa1a7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  historyBadgeWrap: {
    alignItems: "flex-end",
    minWidth: 108
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
    height: 46,
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
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1
  }
});
