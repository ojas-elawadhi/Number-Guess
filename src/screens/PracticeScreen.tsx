import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ConfettiBurst } from "../components/ConfettiBurst";
import { CountdownOverlay } from "../components/CountdownOverlay";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { TextField } from "../components/TextField";
import { useCountdownOverlay } from "../hooks/useCountdownOverlay";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { Difficulty, GuessFeedback } from "../types/game.types";
import type { MatchRecord } from "../types/progression.types";
import { colors, spacing } from "../utils/theme";
import { formatDuration } from "../utils/progression";
import { getDifficultyConfig, getDifficultyRangeLabel, parseDifficulty } from "../../shared/difficulty";

interface PracticeGuessEntry {
  guess: number;
  result: GuessFeedback;
}

export default function PracticeScreen() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty: Difficulty = parseDifficulty(params.difficulty);
  const difficultyConfig = getDifficultyConfig(difficulty);
  const digitLimit = String(difficultyConfig.maxNumber).length;
  const recordMatch = usePlayerProgressStore((state) => state.recordMatch);
  const {
    countdownActive,
    countdownOpacity,
    countdownScale,
    countdownValue,
    startCountdown
  } = useCountdownOverlay();
  const startTimeRef = useRef(Date.now());
  const recordedCompletionRef = useRef(false);
  const [secretNumber, setSecretNumber] = useState(
    () => Math.floor(Math.random() * difficultyConfig.maxNumber) + 1
  );
  const [guess, setGuess] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PracticeGuessEntry | null>(null);
  const [guessHistory, setGuessHistory] = useState<PracticeGuessEntry[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [matchSummary, setMatchSummary] = useState<MatchRecord | null>(null);

  useEffect(() => {
    startCountdown();
  }, [startCountdown]);

  useEffect(() => {
    if (!isComplete || recordedCompletionRef.current) {
      return;
    }

    recordedCompletionRef.current = true;
    const attempts = guessHistory.length;
    const durationMs = Date.now() - startTimeRef.current;

    recordMatch({
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
      .catch(() => {
        // Practice mode should still complete even if meta tracking fails.
      });
  }, [difficulty, guessHistory.length, isComplete, recordMatch]);

  const latestFeedback = useMemo(() => {
    if (!lastResult) {
      return `Guess a number from ${getDifficultyRangeLabel(difficulty)}. You will get an instant high or low hint after each try.`;
    }

    if (lastResult.result === "correct") {
      return `Correct. ${lastResult.guess} was the hidden number.`;
    }

    return `Your guess of ${lastResult.guess} is ${lastResult.result}.`;
  }, [difficulty, lastResult]);

  const handleSubmitGuess = () => {
    const parsedGuess = Number(guess);

    if (!Number.isInteger(parsedGuess) || parsedGuess < 1 || parsedGuess > difficultyConfig.maxNumber) {
      setErrorMessage(`Enter a whole number between 1 and ${difficultyConfig.maxNumber}.`);
      return;
    }

    const result: GuessFeedback =
      parsedGuess === secretNumber ? "correct" : parsedGuess < secretNumber ? "higher" : "lower";

    const entry = {
      guess: parsedGuess,
      result
    } satisfies PracticeGuessEntry;

    setLastResult(entry);
    setGuessHistory((currentHistory) => [entry, ...currentHistory].slice(0, 12));
    setGuess("");
    setErrorMessage(null);

    if (result === "correct") {
      setIsComplete(true);
    }
  };

  const handlePlayAgain = () => {
    recordedCompletionRef.current = false;
    startTimeRef.current = Date.now();
    setSecretNumber(Math.floor(Math.random() * difficultyConfig.maxNumber) + 1);
    setGuess("");
    setErrorMessage(null);
    setLastResult(null);
    setGuessHistory([]);
    setIsComplete(false);
    setMatchSummary(null);
    startCountdown();
  };

  return (
    <ScreenContainer>
      <ConfettiBurst visible={isComplete} />
      {countdownValue !== null ? (
        <CountdownOverlay
          label="Practice Starts In"
          opacity={countdownOpacity}
          scale={countdownScale}
          value={countdownValue}
        />
      ) : null}

      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backLink, pressed && styles.backLinkPressed]}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Practice</Text>
        <Text style={styles.title}>Single Player</Text>
        <Text style={styles.subtitle}>
          The game picked a hidden number in the {getDifficultyRangeLabel(difficulty)} range. Keep reading the high or low feedback until you find it.
        </Text>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusPill, countdownActive && styles.statusPillAccent]}>
          <Text style={styles.statusPillText}>{countdownActive ? "Match starting" : isComplete ? "Solved" : "Your turn"}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{difficultyConfig.label}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <TextField
          editable={!isComplete && !countdownActive}
          keyboardType="numeric"
          label="Your guess"
          maxLength={digitLimit}
          onChangeText={setGuess}
          placeholder={countdownActive ? "Get ready..." : isComplete ? "Round complete" : "Pick a number"}
          value={guess}
        />

        <PrimaryButton
          disabled={isComplete || countdownActive}
          label={countdownActive ? "Starting..." : isComplete ? "Solved" : "Submit Guess"}
          onPress={handleSubmitGuess}
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>

      <View style={styles.feedbackCard}>
        <Text style={styles.sectionTitle}>Latest feedback</Text>
        <Text style={styles.feedbackText}>{latestFeedback}</Text>
      </View>

      {isComplete ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>You found it in {guessHistory.length} guesses.</Text>
          <Text style={styles.successText}>
            {matchSummary
              ? `+${matchSummary.points} points • +${matchSummary.xpEarned} XP • ${formatDuration(matchSummary.durationMs)}`
              : "Scoring your run..."}
          </Text>
          <PrimaryButton label="Rematch" onPress={handlePlayAgain} />
        </View>
      ) : null}

      <View style={styles.feedbackCard}>
        <Text style={styles.sectionTitle}>Previous guesses</Text>
        {guessHistory.length === 0 ? (
          <Text style={styles.feedbackText}>No guesses yet.</Text>
        ) : (
          guessHistory.map((entry, index) => (
            <Text key={`${entry.guess}-${index}`} style={styles.historyItem}>
              {entry.guess}
              {" -> "}
              {entry.result}
            </Text>
          ))
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backLink: {
    alignSelf: "flex-start",
    marginTop: spacing.md
  },
  backLinkPressed: {
    opacity: 0.8
  },
  backText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  hero: {
    gap: spacing.sm
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md
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
  successCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md
  },
  successTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  },
  successText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600"
  }
});
