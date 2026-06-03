import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { AppHeader, HeaderBackButton, HeaderCoinsPill, HeaderScorePill } from "../components/AppHeader";
import { BoosterIcon } from "../components/BoosterIcon";
import { CoinIcon } from "../components/CoinIcon";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { GameStartCountdown } from "../components/GameStartCountdown";
import { ScreenContainer } from "../components/ScreenContainer";
import { useGameStartCountdown } from "../hooks/useGameStartCountdown";
import { isRewardedReviveSupported, showRewardedReviveAd } from "../services/rewardedReviveAd";
import { playResultSound, playSound } from "../services/soundEffects";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { Difficulty, GuessFeedback } from "../types/game.types";
import type { ActivePracticeRunSnapshot, MatchRecord } from "../types/progression.types";
import { formatDuration } from "../utils/progression";
import { colors, radii, spacing } from "../utils/theme";
import { getDifficultyConfig, parseDifficulty } from "../../shared/difficulty";

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

function CoinStack() {
  return (
    <View style={styles.winCoinStack}>
      {(["winCoinBackLeft", "winCoinBackRight", "winCoinFront"] as const).map((position) => (
        <CoinIcon key={position} size={20} style={[styles.winCoin, styles[position]]} />
      ))}
    </View>
  );
}

function Coin() {
  return <CoinIcon size={28} />;
}

function PracticeGame() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty: Difficulty = parseDifficulty(params.difficulty);
  const difficultyConfig = getDifficultyConfig(difficulty);
  const digitLimit = String(difficultyConfig.maxNumber).length;
  const startingChances = difficultyConfig.startingChances;
  const profile = usePlayerProgressStore((state) => state.profile);
  const coins = usePlayerProgressStore((state) => state.profile.coins);
  const extraGuessPowerUps = usePlayerProgressStore((state) => state.profile.extraGuessPowerUps);
  const skipBoosters = usePlayerProgressStore((state) => state.profile.skipBoosters);
  const recordMatch = usePlayerProgressStore((state) => state.recordMatch);
  const singlePlayerHighRounds = usePlayerProgressStore((state) => state.profile.stats.singlePlayerHighRounds);
  const singlePlayerHighScores = usePlayerProgressStore((state) => state.profile.stats.singlePlayerHighScores);
  const updateSinglePlayerHighScore = usePlayerProgressStore((state) => state.updateSinglePlayerHighScore);
  const updateSinglePlayerBestScore = usePlayerProgressStore((state) => state.updateSinglePlayerBestScore);
  const consumeExtraGuessPowerUp = usePlayerProgressStore((state) => state.consumeExtraGuessPowerUp);
  const consumeSkipBooster = usePlayerProgressStore((state) => state.consumeSkipBooster);
  const awardCoins = usePlayerProgressStore((state) => state.awardCoins);
  const syncActivePracticeRun = usePlayerProgressStore((state) => state.syncActivePracticeRun);
  const countdown = useGameStartCountdown();
  const { countdownActive, startCountdown } = countdown;
  const createSecretNumber = () => Math.floor(Math.random() * difficultyConfig.maxNumber) + 1;
  const savedPracticeRun = profile.activePracticeRuns[difficulty];
  const restoredPracticeRun = canRestorePracticeRun(savedPracticeRun, difficultyConfig.maxNumber)
    ? savedPracticeRun
    : null;
  const roundStartTimeRef = useRef(Date.now() - (restoredPracticeRun?.roundElapsedMs ?? 0));
  const isInitialSyncRef = useRef(true);
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
  const [powerUpAction, setPowerUpAction] = useState<
    "extra-guess-inventory" | "extra-guess-ad" | "skip-inventory" | "skip-ad" | null
  >(null);
  const [powerUpMessage, setPowerUpMessage] = useState<string | null>(null);
  const [reviveUsedThisRun, setReviveUsedThisRun] = useState(() => restoredPracticeRun?.reviveUsedThisRun ?? false);
  const [reviveAction, setReviveAction] = useState<"ad" | null>(null);
  const [reviveMessage, setReviveMessage] = useState<string | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchRecord | null>(null);
  const [coinBonusClaimed, setCoinBonusClaimed] = useState(false);
  const [coinClaimAction, setCoinClaimAction] = useState<"ad" | null>(null);
  const isRoundCleared = runState === "round-cleared";
  const isGameOver = runState === "game-over";
  const canShowRewardedRevive = isRewardedReviveSupported();
  const isUsingRevive = reviveAction !== null;
  const canUseRewardedRevive = isGameOver && canShowRewardedRevive && !reviveUsedThisRun && !isUsingRevive;
  const canPreviewCoinRevive = isGameOver && !reviveUsedThisRun && !isUsingRevive;
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
  const historyItems = guessHistory.slice(0, 2);
  const modeRangeLabel = `1-${difficultyConfig.maxNumber}`;
  const ctaDisabled = countdownActive || (runState === "playing" && guess.length === 0);
  const isPlayingRound = runState === "playing";
  const isUsingPowerUp = powerUpAction !== null;
  const isUsingExtraGuessPowerUp = powerUpAction === "extra-guess-inventory" || powerUpAction === "extra-guess-ad";
  const isUsingSkipBooster = powerUpAction === "skip-inventory" || powerUpAction === "skip-ad";
  const canUseExtraGuessPowerUp =
    isPlayingRound && !countdownActive && !isUsingPowerUp && extraGuessPowerUps > 0;
  const canWatchAdForExtraGuess =
    isPlayingRound && !countdownActive && !isUsingPowerUp && extraGuessPowerUps <= 0 && canShowRewardedRevive;
  const canTriggerExtraGuess = canUseExtraGuessPowerUp || canWatchAdForExtraGuess;
  const canUseSkipBooster = isPlayingRound && !countdownActive && !isUsingPowerUp && skipBoosters > 0;
  const canWatchAdForSkipBooster =
    isPlayingRound && !countdownActive && !isUsingPowerUp && skipBoosters <= 0 && canShowRewardedRevive;
  const canTriggerSkipBooster = canUseSkipBooster || canWatchAdForSkipBooster;

  useEffect(() => {
    if (!restoredPracticeRun) {
      startCountdown();
    }
  }, [restoredPracticeRun, startCountdown]);

  useEffect(() => {
    // The first run mirrors the just-restored snapshot (or an untouched fresh
    // board). Skip it so we never re-write — and possibly clobber — the saved
    // run before the player actually changes anything.
    if (isInitialSyncRef.current) {
      isInitialSyncRef.current = false;
      return;
    }

    if (runState === "game-over") {
      void syncActivePracticeRun(difficulty, null).catch(() => { });
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

    void syncActivePracticeRun(difficulty, snapshot).catch(() => { });
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
      playSound("error");
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
    playSound("guessLock");
    playResultSound(result);

    if (result === "correct") {
      const durationMs = Date.now() - roundStartTimeRef.current;
      const scoreGain = nextRemainingChances + 1;
      const nextScore = currentScore + scoreGain;
      const coinsEarned = scoreGain * 5;

      setCurrentScore(nextScore);
      setLastScoreGain(scoreGain);
      setRunState("round-cleared");
      playSound("roundClear");

      if (coinsEarned > 0) {
        void awardCoins(coinsEarned).catch(() => { });
      }
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
      playSound("gameOver");
    }
  };

  const handleNextRound = () => {
    playSound("uiTap");
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
    setCoinBonusClaimed(false);
    setCoinClaimAction(null);
  };

  const handleSkipAdvance = (source: "inventory" | "ad") => {
    const scoreGain = remainingChances + 1;
    const nextScore = currentScore + scoreGain;
    const nextRoundNumber = roundNumber + 1;

    persistHighScoreIfNeeded(nextRoundNumber);
    persistBestScoreIfNeeded(nextScore);
    roundStartTimeRef.current = Date.now();
    setSecretNumber(createSecretNumber());
    setGuess("");
    setErrorMessage(null);
    setReviveMessage(null);
    setPowerUpMessage(
      source === "inventory"
        ? `Skip booster used. +${scoreGain} score and straight to round ${nextRoundNumber}.`
        : `Skip ad reward unlocked. +${scoreGain} score and straight to round ${nextRoundNumber}.`
    );
    setLastResult(null);
    setLastScoreGain(scoreGain);
    setGuessHistory([]);
    setCurrentScore(nextScore);
    setRoundNumber(nextRoundNumber);
    setRemainingChances(startingChances);
    setRunState("playing");
    setMatchSummary(null);
    setCoinBonusClaimed(false);
    setCoinClaimAction(null);

    if (scoreGain > 0) {
      void awardCoins(scoreGain * 5).catch(() => { });
    }
    playSound("powerup");
    playSound("coinReward");
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
    playSound("revive");
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
        playSound("error");
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

    playSound("modalOpen");
    setReviveMessage("150-coin revive UI is ready. Coin spending will be wired up next.");
  };

  const handlePlayAgain = () => {
    playSound("uiTap");
    roundStartTimeRef.current = Date.now();
    setSecretNumber(createSecretNumber());
    setGuess("");
    setErrorMessage(null);
    setReviveMessage(null);
    setPowerUpMessage(null);
    setLastResult(null);
    setLastScoreGain(0);
    setGuessHistory([]);
    setCurrentScore(0);
    setRoundNumber(1);
    setRemainingChances(startingChances);
    setRunState("playing");
    setReviveUsedThisRun(false);
    setMatchSummary(null);
    setCoinBonusClaimed(false);
    setCoinClaimAction(null);
    startCountdown();
  };

  const baseCoinsEarned = lastScoreGain * 5;
  const coinsDisplayed = coinBonusClaimed ? baseCoinsEarned * 4 : baseCoinsEarned;
  const canClaimBonusCoins =
    isRoundCleared &&
    canShowRewardedRevive &&
    !coinBonusClaimed &&
    coinClaimAction === null &&
    baseCoinsEarned > 0;

  const handleClaimBonusCoins = async () => {
    if (!canClaimBonusCoins) {
      return;
    }

    try {
      setCoinClaimAction("ad");
      const rewarded = await showRewardedReviveAd();

      if (!rewarded) {
        playSound("error");
        return;
      }

      setCoinBonusClaimed(true);
      playSound("coinReward");
      // Base coins were already granted on the win; top up the remaining 3x to reach 4x total.
      void awardCoins(baseCoinsEarned * 3).catch(() => { });
    } finally {
      setCoinClaimAction(null);
    }
  };

  const applyExtraGuess = (source: "inventory" | "ad") => {
    setRemainingChances((currentChances) => currentChances + 1);
    setPowerUpMessage(
      source === "inventory" ? "Extra guess power-up used." : "Reward unlocked. You got 1 extra guess."
    );
    playSound("powerup");
  };

  const handleUseExtraGuessPowerUp = async () => {
    if (!canTriggerExtraGuess) {
      return;
    }

    if (canUseExtraGuessPowerUp) {
      try {
        setPowerUpAction("extra-guess-inventory");
        const used = await consumeExtraGuessPowerUp();

        if (!used) {
          playSound("error");
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
      setPowerUpAction("extra-guess-ad");
      const rewarded = await showRewardedReviveAd();

      if (!rewarded) {
        playSound("error");
        setPowerUpMessage("Ad was skipped or unavailable. Try again.");
        return;
      }

      applyExtraGuess("ad");
    } finally {
      setPowerUpAction(null);
    }
  };

  const handleUseSkipBooster = async () => {
    if (!canTriggerSkipBooster) {
      return;
    }

    if (canUseSkipBooster) {
      try {
        setPowerUpAction("skip-inventory");
        const used = await consumeSkipBooster();

        if (!used) {
          playSound("error");
          setPowerUpMessage("That skip booster could not be used right now.");
          return;
        }

        handleSkipAdvance("inventory");
      } finally {
        setPowerUpAction(null);
      }

      return;
    }

    if (!canWatchAdForSkipBooster) {
      return;
    }

    try {
      setPowerUpAction("skip-ad");
      const rewarded = await showRewardedReviveAd();

      if (!rewarded) {
        playSound("error");
        setPowerUpMessage("Ad was skipped or unavailable. Try again.");
        return;
      }

      handleSkipAdvance("ad");
    } finally {
      setPowerUpAction(null);
    }
  };

  const appendDigit = (digit: string) => {
    if (countdownActive || runState !== "playing" || guess.length >= digitLimit) {
      return;
    }

    playSound("numberKey");
    setGuess((currentGuess) => `${currentGuess}${digit}`);
    setErrorMessage(null);
  };

  const removeDigit = () => {
    if (countdownActive || runState !== "playing") {
      return;
    }

    playSound("erase");
    setGuess((currentGuess) => currentGuess.slice(0, -1));
    setErrorMessage(null);
  };

  const clearDigit = () => {
    if (countdownActive || runState !== "playing") {
      return;
    }

    playSound("clear");
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

      <View style={styles.playInfoBar}>
        <View style={styles.playInfoCenter}>
          <View style={styles.modeHint}>
            <Text style={styles.modeHintMode}>{difficultyConfig.label}</Text>
            <Text style={styles.modeHintRange}>{modeRangeLabel}</Text>
          </View>
        </View>

        <View style={styles.chancesTextWrap}>
          <BoosterIcon kind="extra-guess" size={30} />
          <Text style={styles.chancesText}>
            {remainingChances} left
          </Text>
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
        {historyItems.length > 0 ? (
          <View style={styles.historyList}>
            {historyItems.map((entry, index) => {
              const resultColor =
                entry.result === "higher" ? "#ff8a6a" : entry.result === "lower" ? "#61b7ff" : "#1fc46d";
              const resultLabel =
                entry.result === "higher" ? "HIGHER" : entry.result === "lower" ? "LOWER" : "HIT";

              return (
                <View key={`${entry.guess}-${index}`} style={styles.historyCard}>
                  <Text style={styles.historyGuess}>{entry.guess}</Text>
                  <View style={[styles.historyResultBadge, { borderColor: resultColor }]}>
                    <Text style={[styles.historyResultText, { color: resultColor }]}>{resultLabel}</Text>
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
            <BoosterIcon kind="extra-guess" size={52} />
            {isUsingExtraGuessPowerUp ? (
              <View style={styles.powerUpCountBadge}>
                <Text style={styles.powerUpCountBadgeText}>…</Text>
              </View>
            ) : extraGuessPowerUps > 0 ? (
              <View style={styles.powerUpCountBadge}>
                <Text style={styles.powerUpCountBadgeText}>x{extraGuessPowerUps}</Text>
              </View>
            ) : canShowRewardedRevive ? (
              <View style={styles.powerUpCountBadge}>
                <Ionicons color="#3a2a00" name="play" size={11} />
              </View>
            ) : null}
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

          <Pressable
            disabled={!canTriggerSkipBooster}
            onPress={() => void handleUseSkipBooster()}
            style={({ pressed }) => [
              styles.powerUpButton,
              styles.skipBoosterButton,
              pressed && canTriggerSkipBooster && styles.guessButtonPressed,
              !canTriggerSkipBooster && styles.guessButtonDisabled
            ]}
          >
            <BoosterIcon kind="skip" size={52} />
            {isUsingSkipBooster ? (
              <View style={styles.powerUpCountBadge}>
                <Text style={styles.powerUpCountBadgeText}>...</Text>
              </View>
            ) : skipBoosters > 0 ? (
              <View style={styles.powerUpCountBadge}>
                <Text style={styles.powerUpCountBadgeText}>x{skipBoosters}</Text>
              </View>
            ) : canShowRewardedRevive ? (
              <View style={styles.powerUpCountBadge}>
                <Ionicons color="#3a2a00" name="play" size={11} />
              </View>
            ) : null}
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

      <Modal animationType="fade" statusBarTranslucent transparent visible={isRoundCleared}>
        <View style={styles.gameOverOverlay}>
          <ConfettiBurst visible={isRoundCleared} />
          <View style={styles.winCard}>
            <Text style={styles.winTitle}>ROUND CLEAR</Text>
            <View style={styles.winIconWrap}>
              <Ionicons color="#eafff3" name="checkmark" size={48} />
            </View>
            <Text style={styles.winMessage}>
              The number was {secretNumber}.
            </Text>

            <View style={styles.winScoreBox}>
              <View style={styles.winRewardRow}>
                <View style={styles.winRewardCol}>
                  <Text style={styles.winScoreLabel}>SCORE EARNED</Text>
                  <Text style={styles.winScoreValue}>+{lastScoreGain}</Text>
                </View>
                <View style={styles.winRewardDivider} />
                <View style={styles.winRewardCol}>
                  <Text style={styles.winScoreLabel}>COINS EARNED</Text>
                  <View style={styles.winCoinsValueRow}>
                    <CoinStack />
                    <Text style={styles.winScoreValue}>+{coinsDisplayed}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.winClaimWrap}>
              <Pressable
                disabled={!canClaimBonusCoins}
                onPress={() => void handleClaimBonusCoins()}
                style={({ pressed }) => [
                  styles.winClaimButton,
                  coinBonusClaimed && styles.winClaimButtonClaimed,
                  pressed && canClaimBonusCoins && styles.guessButtonPressed,
                  !canClaimBonusCoins && !coinBonusClaimed && styles.guessButtonDisabled
                ]}
              >
                <View style={styles.winClaimContent}>
                  {coinBonusClaimed ? (
                    <>
                      <Ionicons color="#7a4a00" name="checkmark-circle" size={22} />
                      <Text style={styles.winClaimLabel}>CLAIMED</Text>
                      <Coin />
                      <Text style={styles.winClaimAmount}>{baseCoinsEarned * 4}</Text>
                    </>
                  ) : !canShowRewardedRevive ? (
                    <Text style={styles.winClaimLabel}>AD UNAVAILABLE</Text>
                  ) : coinClaimAction === "ad" ? (
                    <Text style={styles.winClaimLabel}>LOADING AD…</Text>
                  ) : (
                    <>
                      <Text style={styles.winClaimLabel}>CLAIM</Text>
                      <Coin />
                      <Text style={styles.winClaimAmount}>{baseCoinsEarned * 4}</Text>
                    </>
                  )}
                </View>

                <View style={styles.winClaimAdBadge}>
                  <Text style={styles.winClaimAdBadgeText}>AD</Text>
                </View>

                <View style={styles.winClaimMultiplierBadge}>
                  <Text style={styles.winClaimMultiplierText}>4x</Text>
                </View>
              </Pressable>
            </View>

            <Pressable
              onPress={handleNextRound}
              style={({ pressed }) => [
                styles.winNextButton,
                pressed && styles.guessButtonPressed
              ]}
            >
              <Text style={styles.winNextButtonText}>NEXT ROUND {">"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

export default function PracticeScreen() {
  const hydrated = usePlayerProgressStore((state) => state.hydrated);
  const progressReady = usePlayerProgressStore((state) => state.progressReady);

  // Wait for the remote profile to load before mounting the game. Otherwise the
  // game would initialize from an empty snapshot and immediately sync it back,
  // wiping the saved run (guesses + score) on refresh.
  if (!hydrated || !progressReady) {
    return (
      <ScreenContainer contentStyle={styles.loadingScreen}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingTitle}>Loading your run</Text>
        <Text style={styles.loadingBody}>Restoring your saved progress.</Text>
      </ScreenContainer>
    );
  }

  return <PracticeGame />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingBottom: 0,
    paddingTop: 0
  },
  loadingScreen: {
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center"
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  loadingBody: {
    color: "#6d757b",
    fontSize: 13,
    fontWeight: "700"
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
  chancesTextWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: "rgba(0,0,0,0.14)",
    borderBottomWidth: 2,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 1,
    justifyContent: "center",
    minHeight: 30,
    minWidth: 82,
    paddingLeft: 2,
    paddingRight: 10,
    position: "absolute",
    right: 0
  },
  chancesText: {
    color: "#176fb8",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
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
    justifyContent: "space-between",
    minHeight: 42,
    paddingHorizontal: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1
  },
  historyGuess: {
    color: "#606367",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 32
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
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
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
    flex: 1,
    height: 46,
    justifyContent: "center"
  },
  powerUpButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 25,
    height: 50,
    justifyContent: "center",
    overflow: "visible",
    position: "relative",
    width: 58
  },
  skipBoosterButton: {},
  powerUpCountBadge: {
    alignItems: "center",
    backgroundColor: "#ffd86b",
    borderBottomColor: "#d69b1e",
    borderBottomWidth: 1,
    borderColor: "#fff6cf",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    minWidth: 24,
    paddingHorizontal: 5,
    position: "absolute",
    right: -1,
    shadowColor: "#5a3400",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    top: -2,
    zIndex: 2
  },
  powerUpCountBadgeText: {
    color: "#342300",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0
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
  winCard: {
    backgroundColor: "#eafff3",
    borderColor: "#1fc46d",
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
  winTitle: {
    color: "#15181b",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1.2,
    textAlign: "center"
  },
  winIconWrap: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#1fc46d",
    borderColor: "#0f9b52",
    borderRadius: 42,
    borderWidth: 6,
    height: 84,
    justifyContent: "center",
    width: 84
  },
  winMessage: {
    color: "#1f5d3c",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 26,
    textAlign: "center"
  },
  winScoreBox: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderColor: "#bdebd0",
    borderRadius: radii.lg,
    borderWidth: 2,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    width: "100%"
  },
  winRewardRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    width: "100%"
  },
  winRewardCol: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingHorizontal: spacing.xs
  },
  winRewardDivider: {
    alignSelf: "stretch",
    backgroundColor: "#bdebd0",
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    width: 2
  },
  winScoreLabel: {
    color: "#4f8a6b",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2
  },
  winScoreValue: {
    color: "#0f9b52",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 40
  },
  winCoinsValueRow: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 6
  },
  winCoinStack: {
    height: 28,
    position: "relative",
    width: 34
  },
  winCoin: {
    position: "absolute"
  },
  winCoinBackLeft: {
    bottom: 0,
    left: 0
  },
  winCoinBackRight: {
    bottom: 0,
    left: 14
  },
  winCoinFront: {
    bottom: 9,
    left: 7
  },
  winNextButton: {
    alignItems: "center",
    backgroundColor: "#047a37",
    borderBottomColor: "#025a29",
    borderBottomWidth: 7,
    borderRadius: 28,
    justifyContent: "center",
    minHeight: 56
  },
  winNextButtonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1
  },
  winClaimWrap: {
    alignSelf: "stretch",
    marginTop: spacing.sm,
    position: "relative"
  },
  winClaimButton: {
    alignItems: "center",
    backgroundColor: "#ffc224",
    borderBottomColor: "#dd9b10",
    borderBottomWidth: 6,
    borderRadius: 26,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 56,
    overflow: "visible",
    paddingHorizontal: spacing.lg,
    position: "relative"
  },
  winClaimButtonClaimed: {
    backgroundColor: "#e9c25a",
    borderBottomColor: "#c79a1f"
  },
  winClaimContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  winClaimLabel: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.8,
    textShadowColor: "rgba(120, 70, 0, 0.45)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 1
  },
  winClaimAmount: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    textShadowColor: "rgba(120, 70, 0, 0.45)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 1
  },
  winClaimAdBadge: {
    alignItems: "center",
    backgroundColor: "#5a5a5a",
    borderColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    left: 14,
    minHeight: 18,
    paddingHorizontal: 9,
    position: "absolute",
    top: -10,
    zIndex: 2
  },
  winClaimAdBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  winClaimMultiplierBadge: {
    alignItems: "center",
    backgroundColor: "#ff8a1f",
    borderColor: "#ffffff",
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    right: -8,
    shadowColor: "#000000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    top: -12,
    width: 34,
    zIndex: 2
  },
  winClaimMultiplierText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
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
