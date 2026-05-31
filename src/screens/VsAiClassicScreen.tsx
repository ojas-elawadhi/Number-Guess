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
import { playResultSound, playSound } from "../services/soundEffects";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { Difficulty, GuessFeedback } from "../types/game.types";
import type { MatchRecord } from "../types/progression.types";
import { formatDuration } from "../utils/progression";
import { colors, radii, spacing } from "../utils/theme";
import { getDifficultyConfig, parseDifficulty } from "../../shared/difficulty";

interface AiClassicRoundEntry {
  roundNumber: number;
  playerGuess: number;
  playerResult: GuessFeedback;
  aiGuess: number;
}

type ClassicWinner = "player" | "ai" | "tie" | null;

const keypadRows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["backspace", "0", "clear"]
] as const;

const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export default function VsAiClassicScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty: Difficulty = parseDifficulty(params.difficulty);
  const difficultyConfig = getDifficultyConfig(difficulty);
  const digitLimit = String(difficultyConfig.maxNumber).length;
  const recordMatch = usePlayerProgressStore((state) => state.recordMatch);
  const countdown = useGameStartCountdown();
  const { countdownActive, startCountdown } = countdown;
  const startTimeRef = useRef(Date.now());
  const recordedMatchRef = useRef(false);
  const [targetNumber, setTargetNumber] = useState(() => randomBetween(1, difficultyConfig.maxNumber));
  const [guess, setGuess] = useState("");
  const [roundNumber, setRoundNumber] = useState(1);
  const [aiMin, setAiMin] = useState(1);
  const [aiMax, setAiMax] = useState(difficultyConfig.maxNumber);
  const [lastRound, setLastRound] = useState<AiClassicRoundEntry | null>(null);
  const [history, setHistory] = useState<AiClassicRoundEntry[]>([]);
  const [winner, setWinner] = useState<ClassicWinner>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchRecord | null>(null);

  const modeRangeLabel = `1-${difficultyConfig.maxNumber}`;
  const isComplete = winner !== null;
  const bannerTone =
    winner === "player"
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
    bannerTone === "player"
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
    bannerTone === "player"
      ? "checkmark"
      : bannerTone === "ai"
        ? "hardware-chip"
        : bannerTone === "tie"
          ? "remove"
          : bannerTone === "higher"
            ? "arrow-up"
            : "arrow-down";
  const bannerColor =
    bannerTone === "player"
      ? "#1fc46d"
      : bannerTone === "ai"
        ? "#ff9d99"
        : bannerTone === "tie"
          ? "#b1b7c2"
          : bannerTone === "higher"
            ? "#ff8a6a"
            : "#61b7ff";
  const historyItems = history.slice(0, 2);
  const ctaDisabled = countdownActive || (!isComplete && guess.length === 0);
  const winDetail = matchSummary
    ? `Solved in ${history.length} rounds | +${matchSummary.points} pts | ${formatDuration(matchSummary.durationMs)}`
    : `Solved in ${history.length} rounds`;
  const showResultModal = winner === "player" || winner === "ai";
  const statusMeta = isComplete
    ? matchSummary
      ? `${bannerTitle} | +${matchSummary.points} pts | ${formatDuration(matchSummary.durationMs)}`
      : bannerTitle
    : lastRound
      ? `Nova AI guessed ${lastRound.aiGuess} on round ${lastRound.roundNumber}.`
      : "Race Nova AI to the hidden number.";
  const statusPillLabel = isComplete ? "MATCH END" : "NOVA AI";

  useEffect(() => {
    startCountdown();
  }, [startCountdown]);

  useEffect(() => {
    if (!isComplete || recordedMatchRef.current) {
      return;
    }

    recordedMatchRef.current = true;
    const outcome = winner === "player" ? "win" : winner === "tie" ? "tie" : "loss";

    recordMatch({
      category: "vs-ai",
      mode: "classic",
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
      params: { mode: "classic" }
    });
  };

  const handleSubmitGuess = () => {
    const parsedGuess = Number(guess);

    if (!Number.isInteger(parsedGuess) || parsedGuess < 1 || parsedGuess > difficultyConfig.maxNumber) {
      playSound("error");
      setErrorMessage(`Use 1-${difficultyConfig.maxNumber}.`);
      return;
    }

    const playerResult: GuessFeedback =
      parsedGuess === targetNumber ? "correct" : parsedGuess < targetNumber ? "higher" : "lower";
    const aiGuess = randomBetween(aiMin, aiMax);
    const aiResult: GuessFeedback =
      aiGuess === targetNumber ? "correct" : aiGuess < targetNumber ? "higher" : "lower";
    const roundEntry: AiClassicRoundEntry = { roundNumber, playerGuess: parsedGuess, playerResult, aiGuess };

    setLastRound(roundEntry);
    setHistory((currentHistory) => [roundEntry, ...currentHistory].slice(0, 8));
    setGuess("");
    setErrorMessage(null);
    playSound("guessLock");
    playResultSound(playerResult);

    if (playerResult === "correct" && aiResult === "correct") {
      setWinner("tie");
      playSound("tie");
      return;
    }

    if (playerResult === "correct") {
      setWinner("player");
      playSound("victory");
      return;
    }

    if (aiResult === "correct") {
      setWinner("ai");
      playSound("defeat");
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
    playSound("uiTap");
    recordedMatchRef.current = false;
    startTimeRef.current = Date.now();
    setTargetNumber(randomBetween(1, difficultyConfig.maxNumber));
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

  const appendDigit = (digit: string) => {
    if (countdownActive || isComplete || guess.length >= digitLimit) {
      return;
    }

    playSound("numberKey");
    setGuess((currentGuess) => `${currentGuess}${digit}`);
    setErrorMessage(null);
  };

  const removeDigit = () => {
    if (countdownActive || isComplete) {
      return;
    }

    playSound("erase");
    setGuess((currentGuess) => currentGuess.slice(0, -1));
    setErrorMessage(null);
  };

  const clearDigit = () => {
    if (countdownActive || isComplete) {
      return;
    }

    playSound("clear");
    setGuess("");
    setErrorMessage(null);
  };

  const renderKey = (key: (typeof keypadRows)[number][number]) => {
    const disabled = countdownActive || isComplete;
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
        detail={winDetail}
        iconColor={winner === "ai" ? "#fff2f4" : undefined}
        iconName={winner === "ai" ? "hardware-chip" : undefined}
        iconRingColor={winner === "ai" ? "#ec7683" : undefined}
        message={`The number was ${targetNumber}.`}
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
            <Text style={styles.headerRoundLabel}>ROUND</Text>
            <Text style={styles.headerRoundValue}>{roundNumber}</Text>
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

        <View style={styles.statusPillWrap}>
          <Ionicons color="#fff4f5" name="hardware-chip" size={12} />
          <Text style={styles.statusPillText}>{statusPillLabel}</Text>
        </View>
      </View>

      <View style={styles.guessPanel}>
        <View style={styles.guessHero}>
          <Text style={[styles.guessInputValue, guess.length === 0 && styles.guessInputValueEmpty]}>
            {guess.length > 0 ? guess : "--"}
          </Text>
        </View>

        <View style={[styles.bannerCard, { borderColor: bannerColor }]}>
          <Ionicons color={bannerColor} name={bannerIcon} size={20} />
          <Text style={[styles.bannerText, { color: bannerColor }]}>{bannerTitle}</Text>
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <Text style={styles.statusMeta}>{statusMeta}</Text>
      </View>

      <View style={styles.bottomSpacer} />

      <View style={styles.bottomControls}>
        {historyItems.length > 0 ? (
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
          onPress={isComplete ? handlePlayAgain : handleSubmitGuess}
          style={({ pressed }) => [
            styles.guessButton,
            pressed && !ctaDisabled && styles.guessButtonPressed,
            ctaDisabled && styles.guessButtonDisabled
          ]}
        >
          <Text style={styles.guessButtonText}>{isComplete ? "REMATCH" : "LOCK >"}</Text>
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
