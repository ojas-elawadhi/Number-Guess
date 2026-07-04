import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FeedbackBadge, HistoryStrip, NumberPad, StatusPill } from "../components/GameKit";
import { ScreenContainer } from "../components/ScreenContainer";
import { VsAiWinModal } from "../components/VsAiWinModal";
import { TUTORIAL_DONE_LOCAL_KEY } from "../hooks/useTutorialGate";
import { useHardwareBackHandler } from "../hooks/useHardwareBackHandler";
import { playResultSound, playSound } from "../services/soundEffects";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import { useTutorialStore } from "../store/useTutorialStore";
import { sendTutorialEvent } from "../utils/tutorialAnalytics";
import { colors, radii, spacing } from "../utils/theme";

const RANGE_MAX = 50;
const STARTING_CHANCES = 8;
const WINNING_GUESS_NUMBER = 3;
const REWARD_COINS = 40;

type TutorialFeedback = "higher" | "lower" | "correct";

interface TutorialGuessEntry {
  id: string;
  guess: number;
  result: TutorialFeedback;
}

export default function TutorialScreen() {
  const awardCoins = usePlayerProgressStore((state) => state.awardCoins);
  const markTutorialSeen = usePlayerProgressStore((state) => state.markTutorialSeen);
  const setPhase = useTutorialStore((state) => state.setPhase);
  const setCalloutStep = useTutorialStore((state) => state.setCalloutStep);
  const isReplay = useTutorialStore((state) => state.replayMode);

  const [guessValue, setGuessValue] = useState("");
  // The round is scripted: there is no fixed secret number. We keep the interval
  // of numbers still consistent with the feedback given, and declare the player's
  // third in-interval guess correct — a guaranteed early win with no observable
  // contradiction.
  const [lowBound, setLowBound] = useState(1);
  const [highBound, setHighBound] = useState(RANGE_MAX);
  const [inIntervalGuesses, setInIntervalGuesses] = useState(0);
  const [remainingChances, setRemainingChances] = useState(STARTING_CHANCES);
  const [history, setHistory] = useState<TutorialGuessEntry[]>([]);
  const [feedback, setFeedback] = useState<TutorialFeedback | null>(null);
  const [secretNumber, setSecretNumber] = useState<number | null>(null);
  const [coachText, setCoachText] = useState(
    `I'm thinking of a number from 1 to ${RANGE_MAX}. Type a guess and lock it in!`
  );
  const [isFinishing, setIsFinishing] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  const hasWon = secretNumber !== null;

  const finishTutorial = async (event: "completed" | "skipped_round") => {
    if (isReplay) {
      return;
    }

    sendTutorialEvent(event);

    if (event === "completed") {
      await awardCoins(REWARD_COINS).catch(() => false);
    }

    try {
      await markTutorialSeen();
    } catch {
      // Persist completion locally so the tutorial does not repeat; the gate
      // retries the server write on a later launch.
      await AsyncStorage.setItem(TUTORIAL_DONE_LOCAL_KEY, "1").catch(() => undefined);
      usePlayerProgressStore.setState((state) => ({
        profile: {
          ...state.profile,
          tutorialSeen: true
        }
      }));
    }
  };

  const handleSkipRound = async () => {
    if (isFinishing) {
      return;
    }

    setIsFinishing(true);
    playSound("back");
    await finishTutorial(hasWon ? "completed" : "skipped_round");
    setPhase("done");

    if (isReplay && router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/");
  };

  const handleClaimAndContinue = async () => {
    if (isFinishing) {
      return;
    }

    setIsFinishing(true);
    await finishTutorial("completed");
    setCalloutStep(0);
    setPhase("callouts");
    router.replace("/");
  };

  useHardwareBackHandler(() => {
    void handleSkipRound();
  });

  const recordGuess = (guess: number, result: TutorialFeedback) => {
    setHistory((entries) => [{ id: `${entries.length}-${guess}`, guess, result }, ...entries]);
    setFeedback(result);
    playResultSound(result);
  };

  const handleSubmit = () => {
    if (hasWon || isFinishing) {
      return;
    }

    const guess = Number.parseInt(guessValue, 10);
    setGuessValue("");

    if (!Number.isFinite(guess) || guess < 1 || guess > RANGE_MAX) {
      playSound("error");
      setCoachText(`Whoops — pick a number from 1 to ${RANGE_MAX}.`);
      return;
    }

    const isInInterval = guess >= lowBound && guess <= highBound;

    if (!isInInterval) {
      // Contradicts earlier feedback. Answer consistently, but never let the
      // last chance be lost to a stray guess — the tutorial round cannot fail.
      if (remainingChances <= 1) {
        playSound("error");
        setCoachText(`It has to be between ${lowBound} and ${highBound} — try one of those!`);
        return;
      }

      const result: TutorialFeedback = guess < lowBound ? "higher" : "lower";
      setRemainingChances((chances) => chances - 1);
      recordGuess(guess, result);
      setCoachText(
        result === "higher"
          ? `Still HIGHER — the number is bigger than ${guess}. It's between ${lowBound} and ${highBound}.`
          : `Still LOWER — the number is smaller than ${guess}. It's between ${lowBound} and ${highBound}.`
      );
      return;
    }

    const guessNumber = inIntervalGuesses + 1;

    if (guessNumber >= WINNING_GUESS_NUMBER || lowBound === highBound) {
      setSecretNumber(guess);
      setInIntervalGuesses(guessNumber);
      recordGuess(guess, "correct");
      setCoachText("You found it!");
      playSound("roundClear");
      return;
    }

    // Send the player toward the side with more room so the interval never
    // collapses before the winning guess.
    const result: TutorialFeedback = highBound - guess >= guess - lowBound ? "higher" : "lower";
    const nextLow = result === "higher" ? guess + 1 : lowBound;
    const nextHigh = result === "lower" ? guess - 1 : highBound;

    setLowBound(nextLow);
    setHighBound(nextHigh);
    setInIntervalGuesses(guessNumber);
    setRemainingChances((chances) => chances - 1);
    recordGuess(guess, result);
    setCoachText(
      guessNumber === 1
        ? result === "higher"
          ? `HIGHER means my number is bigger than ${guess}. Aim higher!`
          : `LOWER means my number is smaller than ${guess}. Aim lower!`
        : `You're closing in — it's between ${nextLow} and ${nextHigh}. Lock in one more!`
    );
  };

  const feedbackDetail =
    feedback === "higher"
      ? `Bigger than ${history[0]?.guess ?? ""}`
      : feedback === "lower"
        ? `Smaller than ${history[0]?.guess ?? ""}`
        : feedback === "correct"
          ? "Nailed it!"
          : "Make your first guess";

  return (
    <>
      <ScreenContainer contentStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.eyebrow}>WELCOME</Text>
            <Text style={styles.title}>HOW TO PLAY</Text>
          </View>
          <Pressable
            disabled={isFinishing}
            onPress={() => {
              void handleSkipRound();
            }}
            style={({ pressed }) => [styles.skipPill, pressed && styles.pressed]}
          >
            <Text style={styles.skipPillText}>SKIP</Text>
          </Pressable>
        </View>

        <View style={styles.statusRow}>
          <StatusPill label={`RANGE 1–${RANGE_MAX}`} tone="accent" />
          <StatusPill label={`${remainingChances} GUESSES LEFT`} tone="success" />
        </View>

        <FeedbackBadge compact detail={feedbackDetail} result={feedback} />

        <View style={styles.coachCard}>
          <Ionicons color={colors.accent} name="school" size={22} />
          <Text style={styles.coachText}>{coachText}</Text>
        </View>

        <HistoryStrip
          compact
          emptyLabel="No guesses yet"
          items={history.map((entry) => ({ id: entry.id, primary: String(entry.guess), tone: entry.result }))}
          title="Your guesses"
        />

        <NumberPad
          accent={colors.practice}
          compact
          disabled={hasWon || isFinishing || showIntro}
          helper="Type your guess"
          maxLength={2}
          onChange={setGuessValue}
          onSubmit={handleSubmit}
          submitLabel="GUESS"
          value={guessValue}
        />
      </ScreenContainer>

      <VsAiWinModal
        actionLabel="TRY IT"
        detail="I'll tell you HIGHER or LOWER after every guess."
        iconName="school"
        message={`Guess my secret number from 1 to ${RANGE_MAX}!`}
        onAction={() => {
          playSound("modalOpen");
          setShowIntro(false);
        }}
        onSecondaryAction={() => {
          void handleSkipRound();
        }}
        secondaryActionLabel="SKIP TUTORIAL"
        showConfetti={false}
        title="HOW TO PLAY"
        visible={showIntro && !hasWon}
      />

      <VsAiWinModal
        actionLabel={isReplay ? "CONTINUE" : "CLAIM & CONTINUE"}
        detail={
          isReplay
            ? "Fewer guesses means bigger scores — that's the whole game!"
            : `+${REWARD_COINS} coins earned. Fewer guesses means bigger scores — that's the whole game!`
        }
        message={`The number was ${secretNumber ?? 0}!`}
        onAction={() => {
          void handleClaimAndContinue();
        }}
        onSecondaryAction={() => {
          void handleSkipRound();
        }}
        secondaryActionLabel="SKIP TOUR"
        title="YOU GOT IT!"
        visible={hasWon}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    padding: spacing.xs
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  headerTitleWrap: {
    gap: 2
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900"
  },
  skipPill: {
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing.md
  },
  skipPillText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1
  },
  statusRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  coachCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.practice,
    borderRadius: radii.lg,
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  coachText: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21
  },
  pressed: {
    opacity: 0.85
  }
});
