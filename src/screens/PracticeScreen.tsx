import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader, HeaderBackButton, HeaderCoinsPill, HeaderScorePill } from "../components/AppHeader";
import { BoosterIcon } from "../components/BoosterIcon";
import { CoinIcon } from "../components/CoinIcon";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { GameKeyboard } from "../components/GameKeyboard";
import { GameStartCountdown } from "../components/GameStartCountdown";
import { ScreenContainer } from "../components/ScreenContainer";
import { useGameStartCountdown } from "../hooks/useGameStartCountdown";
import { maybeShowPendingInterstitialAd, recordInterstitialOpportunity } from "../services/interstitialAd";
import { isRewardedReviveSupported, showRewardedReviveAd } from "../services/rewardedReviveAd";
import { playResultSound, playSound } from "../services/soundEffects";
import { useMonetizationStore } from "../store/useMonetizationStore";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { Difficulty, GuessFeedback } from "../types/game.types";
import type { ActivePracticeRunSnapshot, MatchRecord } from "../types/progression.types";
import { formatDuration } from "../utils/progression";
import { colors, radii, spacing } from "../utils/theme";
import { getDifficultyConfig, parseDifficulty } from "../../shared/difficulty";
import {
  createSinglePlayerModifier,
  getModifierClueText,
  getModifierIntroText,
  getModifierRuleDetails,
  getModifierStrategyText,
  getNextMilestone,
  normalizeSinglePlayerModifier,
  resolveSinglePlayerGuess,
  type SinglePlayerModifierSnapshot
} from "../../shared/singlePlayerModifiers";

interface PracticeGuessEntry {
  chanceCost?: number;
  guess: number;
  result: GuessFeedback;
}

type PracticeRunState = "playing" | "round-cleared" | "game-over";
type GameOverView = "revive" | "results";

const REVIVE_COIN_COST = 250;
const REVIVE_GUESSES = 5;
const MAX_REWARDED_REVIVES_PER_RUN = 3;
const BOSS_INTRO_DURATION_MS = 4000;
const MODIFIER_ONBOARDING_STORAGE_KEY = "code-wars:seen-single-player-modifiers";
const getReviveCoinCost = (revivesUsed: number) => REVIVE_COIN_COST * 2 ** Math.max(0, revivesUsed);

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
  const hasNoAdsEntitlement = useMonetizationStore((state) => state.hasNoAdsEntitlement);
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
  const spendCoins = usePlayerProgressStore((state) => state.spendCoins);
  const syncActivePracticeRun = usePlayerProgressStore((state) => state.syncActivePracticeRun);
  const countdown = useGameStartCountdown();
  const { countdownActive, startCountdown } = countdown;
  const createSecretNumber = () => Math.floor(Math.random() * difficultyConfig.maxNumber) + 1;
  const createRoundState = (nextRoundNumber: number) => {
    const nextSecretNumber = createSecretNumber();

    return {
      modifier: createSinglePlayerModifier(difficulty, nextRoundNumber, nextSecretNumber, difficultyConfig.maxNumber),
      secretNumber: nextSecretNumber
    };
  };
  const savedPracticeRun = profile.activePracticeRuns[difficulty];
  const restoredPracticeRun = canRestorePracticeRun(savedPracticeRun, difficultyConfig.maxNumber)
    ? savedPracticeRun
    : null;
  const initialSecretNumberRef = useRef(restoredPracticeRun?.secretNumber ?? createSecretNumber());
  const initialModifierRef = useRef(
    normalizeSinglePlayerModifier(
      restoredPracticeRun?.modifier,
      difficulty,
      restoredPracticeRun?.roundNumber ?? 1,
      initialSecretNumberRef.current,
      difficultyConfig.maxNumber
    )
  );
  const roundStartTimeRef = useRef(Date.now() - (restoredPracticeRun?.roundElapsedMs ?? 0));
  const lastSyncedPracticeSnapshotKeyRef = useRef<string | null>(null);
  const persistActivePracticeRunRef = useRef<() => void>(() => {});
  const [secretNumber, setSecretNumber] = useState(() => initialSecretNumberRef.current);
  const [roundModifier, setRoundModifier] = useState<SinglePlayerModifierSnapshot>(() => initialModifierRef.current);
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
  const [reviveCount, setReviveCount] = useState(
    () => restoredPracticeRun?.reviveCount ?? (restoredPracticeRun?.reviveUsedThisRun ? 1 : 0)
  );
  const [adReviveCount, setAdReviveCount] = useState(() => restoredPracticeRun?.adReviveCount ?? 0);
  const [reviveUsedThisRun, setReviveUsedThisRun] = useState(() => restoredPracticeRun?.reviveUsedThisRun ?? false);
  const [reviveAction, setReviveAction] = useState<"ad" | "coins" | null>(null);
  const [reviveMessage, setReviveMessage] = useState<string | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchRecord | null>(null);
  const [gameOverView, setGameOverView] = useState<GameOverView>("revive");
  const [runXpEarned, setRunXpEarned] = useState(0);
  const [runBonusCoinsEarned, setRunBonusCoinsEarned] = useState(0);
  const [coinBonusClaimed, setCoinBonusClaimed] = useState(false);
  const [coinClaimAction, setCoinClaimAction] = useState<"ad" | null>(null);
  const [isRulesModalVisible, setIsRulesModalVisible] = useState(false);
  const [isModifierIntroVisible, setIsModifierIntroVisible] = useState(false);
  const [modifierOnboardingLoaded, setModifierOnboardingLoaded] = useState(false);
  const [seenModifierIds, setSeenModifierIds] = useState<Set<string>>(() => new Set());
  const [isBossIntroVisible, setIsBossIntroVisible] = useState(false);
  const shownBossIntroKeysRef = useRef(new Set<string>());
  const bossIntroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bossIntroOpacity = useRef(new Animated.Value(0)).current;
  const bossIntroScale = useRef(new Animated.Value(0.94)).current;
  const bossCardPulse = useRef(new Animated.Value(1)).current;
  const isRoundCleared = runState === "round-cleared";
  const isGameOver = runState === "game-over";
  const lastGuessResolution = lastResult
    ? resolveSinglePlayerGuess(lastResult.guess, secretNumber, difficultyConfig.maxNumber, roundModifier)
    : null;
  const modifierClueText = getModifierClueText(roundModifier, difficultyConfig.maxNumber);
  const modifierRuleDetails = getModifierRuleDetails(roundModifier, difficultyConfig.maxNumber);
  const modifierStrategyText = getModifierStrategyText(roundModifier, difficultyConfig.maxNumber);
  const modifierIntroText = getModifierIntroText(roundModifier, difficultyConfig.maxNumber);
  const modifierCardTitle = roundModifier.isBoss ? roundModifier.label.replace("Boss: ", "") : roundModifier.label;
  const revealedDigits = Array.isArray(roundModifier.containsDigits) ? roundModifier.containsDigits : [];
  const revealedDigitLabel = revealedDigits.length === 1 ? "Revealed digit" : "One digit is real";
  const centeredModifierRule: null | { label: string; values: string[] } = (() => {
    if (revealedDigits.length > 0) {
      return {
        label: revealedDigits.length === 1 ? "Digit" : "One digit",
        values: revealedDigits
      };
    }

    if (roundModifier.mirrorMode) {
      return { label: "Mirror", values: ["Heat"] };
    }

    if (typeof roundModifier.digitSumMin === "number" && typeof roundModifier.digitSumMax === "number") {
      return { label: "Digit sum", values: [`${roundModifier.digitSumMin}-${roundModifier.digitSumMax}`] };
    }

    if (typeof roundModifier.lockedDigitValue === "string") {
      return { label: "Locked digit", values: [roundModifier.lockedDigitValue] };
    }

    if (roundModifier.parity) {
      return { label: "Target", values: [roundModifier.parity] };
    }

    if (roundModifier.rangeSeal === "at-or-above" && typeof roundModifier.rangeSealValue === "number") {
      return { label: "Range", values: [`${roundModifier.rangeSealValue}+`] };
    }

    if (roundModifier.rangeSeal === "below" && typeof roundModifier.rangeSealValue === "number") {
      return { label: "Range", values: [`<${roundModifier.rangeSealValue}`] };
    }

    return null;
  })();
  const isNewModifierDiscovery =
    modifierOnboardingLoaded &&
    roundModifier.id !== "classic" &&
    !roundModifier.isBoss &&
    !seenModifierIds.has(roundModifier.id);
  const nextMilestone = getNextMilestone(roundNumber);
  const roundsUntilMilestone = Math.max(0, nextMilestone - roundNumber);
  const canShowRewardedRevive = isRewardedReviveSupported();
  const isUsingRevive = reviveAction !== null;
  const currentReviveCoinCost = getReviveCoinCost(reviveCount);
  const nextReviveNumber = reviveCount + 1;
  const rewardedRevivesLeft = Math.max(0, MAX_REWARDED_REVIVES_PER_RUN - adReviveCount);
  const hasRewardedRevivesLeft = rewardedRevivesLeft > 0;
  const canUseRewardedRevive = isGameOver && canShowRewardedRevive && hasRewardedRevivesLeft && !isUsingRevive;
  const canUseCoinRevive = isGameOver && !isUsingRevive;
  const bannerTitle =
    isRoundCleared
      ? "ROUND CLEAR"
      : isGameOver
        ? "OUT OF CHANCES"
        : lastGuessResolution
          ? lastGuessResolution.primaryLabel.toUpperCase()
          : "READY";
  const bannerIcon =
    isRoundCleared
      ? "checkmark"
      : isGameOver
        ? "alert-circle"
        : lastGuessResolution?.hotColdLevel
          ? "flame"
          : lastGuessResolution?.result === "higher"
          ? "arrow-up"
          : lastGuessResolution?.result === "lower"
            ? "arrow-down"
            : "remove";
  const bannerColor =
    isRoundCleared
      ? "#1fc46d"
      : isGameOver
        ? "#ff7b7b"
        : lastGuessResolution?.historyColor ?? roundModifier.accentColor;
  const historyItems = guessHistory.slice(0, 2);
  const modeRangeLabel = `1-${difficultyConfig.maxNumber}`;
  const formattedScoreMultiplier = Number.isInteger(roundModifier.scoreMultiplier)
    ? roundModifier.scoreMultiplier.toString()
    : roundModifier.scoreMultiplier.toFixed(2).replace(/0$/, "");
  const scoreMultiplierLabel =
    roundModifier.scoreMultiplier > 1
      ? `${formattedScoreMultiplier}x score`
      : "Base score";
  const bossIntroChips = [
    roundModifier.mirrorMode
      ? "Mirror heat"
      : typeof roundModifier.digitSumMin === "number"
        ? `Sum ${roundModifier.digitSumMin}-${roundModifier.digitSumMax}`
        : roundModifier.parity
          ? `${roundModifier.parity} target`
          : Array.isArray(roundModifier.containsDigits) && roundModifier.containsDigits.length > 1
            ? `Contains ${roundModifier.containsDigits.join("/")}`
            : typeof roundModifier.lockedDigitValue === "string"
              ? "Locked digit"
              : roundModifier.rangeSeal === "at-or-above" && typeof roundModifier.rangeSealValue === "number"
                ? `${roundModifier.rangeSealValue}+`
                : roundModifier.rangeSeal === "below" && typeof roundModifier.rangeSealValue === "number"
                  ? `Below ${roundModifier.rangeSealValue}`
                  : "Boss rule",
    "Heat only",
    "Hidden range",
    scoreMultiplierLabel.replace(" score", "")
  ];
  const lockedDigitDisplaySlots =
    guess.length === 0 &&
    typeof roundModifier.lockedDigitIndex === "number" &&
    typeof roundModifier.lockedDigitValue === "string"
      ? Array.from({ length: digitLimit }, (_, index) => ({
          isLocked: index === roundModifier.lockedDigitIndex,
          value: index === roundModifier.lockedDigitIndex ? roundModifier.lockedDigitValue : "-"
        }))
      : null;
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
    let isMounted = true;

    const loadSeenModifiers = async () => {
      try {
        const storedValue = await AsyncStorage.getItem(MODIFIER_ONBOARDING_STORAGE_KEY);
        const parsedValue = storedValue ? JSON.parse(storedValue) : [];
        const nextSeenModifiers = Array.isArray(parsedValue)
          ? parsedValue.filter((id): id is string => typeof id === "string")
          : [];

        if (isMounted) {
          setSeenModifierIds(new Set(nextSeenModifiers));
        }
      } catch {
        if (isMounted) {
          setSeenModifierIds(new Set());
        }
      } finally {
        if (isMounted) {
          setModifierOnboardingLoaded(true);
        }
      }
    };

    loadSeenModifiers().catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      !modifierOnboardingLoaded ||
      roundModifier.id === "classic" ||
      roundModifier.isBoss ||
      seenModifierIds.has(roundModifier.id) ||
      runState !== "playing" ||
      guessHistory.length > 0 ||
      isModifierIntroVisible
    ) {
      return;
    }

    setIsModifierIntroVisible(true);
    playSound("powerup");
  }, [
    guessHistory.length,
    isModifierIntroVisible,
    modifierOnboardingLoaded,
    roundModifier.id,
    roundModifier.isBoss,
    runState,
    seenModifierIds
  ]);

  const markModifierIntroSeen = (modifierId: string) => {
    setSeenModifierIds((currentSeenModifierIds) => {
      const nextSeenModifierIds = new Set(currentSeenModifierIds);
      nextSeenModifierIds.add(modifierId);
      void AsyncStorage.setItem(MODIFIER_ONBOARDING_STORAGE_KEY, JSON.stringify(Array.from(nextSeenModifierIds))).catch(() => {});
      return nextSeenModifierIds;
    });
  };

  const closeModifierIntro = () => {
    playSound("uiTap");
    setIsModifierIntroVisible(false);
    markModifierIntroSeen(roundModifier.id);
  };

  const hideBossIntro = () => {
    if (bossIntroTimerRef.current) {
      clearTimeout(bossIntroTimerRef.current);
      bossIntroTimerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(bossIntroOpacity, {
        duration: 180,
        easing: Easing.out(Easing.quad),
        toValue: 0,
        useNativeDriver: true
      }),
      Animated.timing(bossIntroScale, {
        duration: 180,
        easing: Easing.out(Easing.quad),
        toValue: 0.98,
        useNativeDriver: true
      })
    ]).start(() => setIsBossIntroVisible(false));
  };

  useEffect(() => {
    return () => {
      if (bossIntroTimerRef.current) {
        clearTimeout(bossIntroTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!roundModifier.isBoss || runState !== "playing") {
      return;
    }

    const bossIntroKey = `${difficulty}-${roundNumber}-${roundModifier.id}`;

    if (shownBossIntroKeysRef.current.has(bossIntroKey)) {
      return;
    }

    shownBossIntroKeysRef.current.add(bossIntroKey);
    setIsBossIntroVisible(true);
    bossIntroOpacity.setValue(0);
    bossIntroScale.setValue(0.94);
    bossCardPulse.setValue(1);
    playSound("powerup");

    Animated.parallel([
      Animated.timing(bossIntroOpacity, {
        duration: 220,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true
      }),
      Animated.spring(bossIntroScale, {
        friction: 7,
        tension: 90,
        toValue: 1,
        useNativeDriver: true
      })
    ]).start();

    Animated.sequence([
      Animated.timing(bossCardPulse, {
        duration: 180,
        easing: Easing.out(Easing.quad),
        toValue: 1.025,
        useNativeDriver: true
      }),
      Animated.timing(bossCardPulse, {
        duration: 260,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true
      })
    ]).start();

    bossIntroTimerRef.current = setTimeout(hideBossIntro, BOSS_INTRO_DURATION_MS);
  }, [bossCardPulse, bossIntroOpacity, bossIntroScale, difficulty, roundModifier.id, roundModifier.isBoss, roundNumber, runState]);

  const buildActivePracticeSnapshot = useCallback((): ActivePracticeRunSnapshot | null => {
    if (runState === "game-over") {
      return null;
    }

    return {
      difficulty,
      secretNumber,
      guessHistory,
      roundNumber,
      remainingChances,
      currentScore,
      lastScoreGain,
      modifier: roundModifier,
      runState,
      adReviveCount,
      reviveCount,
      reviveUsedThisRun,
      roundElapsedMs: Math.max(0, Date.now() - roundStartTimeRef.current),
      updatedAt: new Date().toISOString()
    };
  }, [
    adReviveCount,
    currentScore,
    difficulty,
    guessHistory,
    lastScoreGain,
    remainingChances,
    reviveCount,
    reviveUsedThisRun,
    roundModifier,
    roundNumber,
    runState,
    secretNumber
  ]);

  const persistActivePracticeRun = useCallback(() => {
    const snapshot = buildActivePracticeSnapshot();
    const snapshotKey = snapshot ? JSON.stringify({ ...snapshot, updatedAt: "" }) : "cleared";

    if (snapshotKey === lastSyncedPracticeSnapshotKeyRef.current) {
      return;
    }

    lastSyncedPracticeSnapshotKeyRef.current = snapshotKey;
    void syncActivePracticeRun(difficulty, snapshot).catch(() => {
      lastSyncedPracticeSnapshotKeyRef.current = null;
    });
  }, [buildActivePracticeSnapshot, difficulty, syncActivePracticeRun]);

  useEffect(() => {
    persistActivePracticeRunRef.current = persistActivePracticeRun;
  }, [persistActivePracticeRun]);

  useEffect(() => {
    const addAppStateListener = AppState?.addEventListener;
    const subscription =
      typeof addAppStateListener === "function"
        ? addAppStateListener.call(AppState, "change", (nextState) => {
            if (nextState === "background" || nextState === "inactive") {
              persistActivePracticeRunRef.current();
            }
          })
        : null;

    return () => {
      subscription?.remove?.();
      persistActivePracticeRunRef.current();
    };
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function" ||
      typeof window.removeEventListener !== "function"
    ) {
      return undefined;
    }

    const handlePageExit = () => {
      persistActivePracticeRunRef.current();
    };

    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);

    return () => {
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
    };
  }, []);

  const persistHighScoreIfNeeded = (candidateRound: number) => {
    if (candidateRound > singlePlayerHighRounds[difficulty]) {
      void updateSinglePlayerHighScore(difficulty, candidateRound).catch(() => { });
    }
  };

  const persistBestScoreIfNeeded = (candidateScore: number) => {
    if (candidateScore > singlePlayerHighScores[difficulty]) {
      void updateSinglePlayerBestScore(difficulty, candidateScore).catch(() => { });
    }
  };

  const handleBackPress = () => {
    persistHighScoreIfNeeded(roundNumber);
    persistBestScoreIfNeeded(currentScore);
    persistActivePracticeRun();
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

    const resolution = resolveSinglePlayerGuess(parsedGuess, secretNumber, difficultyConfig.maxNumber, roundModifier);
    const result = resolution.result;
    const entry = { chanceCost: resolution.chanceCost, guess: parsedGuess, result } satisfies PracticeGuessEntry;
    const attempts = guessHistory.length + 1;
    const nextRemainingChances = Math.max(remainingChances - resolution.chanceCost, 0);

    setLastResult(entry);
    setGuessHistory((currentHistory) => [entry, ...currentHistory].slice(0, 8));
    setGuess("");
    setErrorMessage(null);
    setMatchSummary(null);
    setPowerUpMessage(null);
    setRemainingChances(nextRemainingChances);
    playSound("guessLock");
    if (resolution.soundResult) {
      playResultSound(resolution.soundResult);
    } else {
      playSound(resolution.trapped ? "error" : "softNoise");
    }

    if (result === "correct") {
      const durationMs = Date.now() - roundStartTimeRef.current;
      const scoreGain = Math.max(1, Math.ceil((nextRemainingChances + 1) * roundModifier.scoreMultiplier));
      const nextScore = currentScore + scoreGain;
      const coinsEarned = scoreGain * 5;

      setCurrentScore(nextScore);
      setLastScoreGain(scoreGain);
      setRunState("round-cleared");
      playSound("roundClear");

      if (coinsEarned > 0) {
        void awardCoins(coinsEarned).catch(() => { });
      }
      if (!hasNoAdsEntitlement) {
        recordInterstitialOpportunity();
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
        .then((summary) => {
          setMatchSummary(summary);
          setRunXpEarned((currentXp) => currentXp + summary.xpEarned);
        })
        .catch(() => { });

      return;
    }

    if (nextRemainingChances === 0) {
      persistHighScoreIfNeeded(roundNumber);
      persistBestScoreIfNeeded(currentScore);
      setLastScoreGain(0);
      setGameOverView("revive");
      setRunState("game-over");
      playSound("gameOver");
    }
  };

  const handleNextRound = async () => {
    playSound("uiTap");
    const nextRoundNumber = roundNumber + 1;

    if (!hasNoAdsEntitlement) {
      await maybeShowPendingInterstitialAd();
    }

    persistHighScoreIfNeeded(nextRoundNumber);
    const nextRoundState = createRoundState(nextRoundNumber);
    roundStartTimeRef.current = Date.now();
    setSecretNumber(nextRoundState.secretNumber);
    setRoundModifier(nextRoundState.modifier);
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
    const nextRoundState = createRoundState(nextRoundNumber);
    roundStartTimeRef.current = Date.now();
    setSecretNumber(nextRoundState.secretNumber);
    setRoundModifier(nextRoundState.modifier);
    setGuess("");
    setErrorMessage(null);
    setReviveMessage(null);
    setPowerUpMessage(
      source === "inventory"
        ? `Skip booster used. +${scoreGain} score and straight to round ${nextRoundNumber}. Modifier bonus skipped.`
        : `Skip ad reward unlocked. +${scoreGain} score and straight to round ${nextRoundNumber}. Modifier bonus skipped.`
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

  const applyRevive = (source: "ad" | "coins") => {
    setGuess("");
    setErrorMessage(null);
    setReviveMessage(null);
    setPowerUpMessage(null);
    setLastResult(null);
    setLastScoreGain(0);
    setRemainingChances(REVIVE_GUESSES);
    setGameOverView("revive");
    setRunState("playing");
    setReviveCount((currentReviveCount) => currentReviveCount + 1);
    if (source === "ad") {
      setAdReviveCount((currentAdReviveCount) => currentAdReviveCount + 1);
    }
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

      applyRevive("ad");
    } finally {
      setReviveAction(null);
    }
  };

  const handleUseCoinRevive = async () => {
    if (!canUseCoinRevive) {
      return;
    }

    if (coins < currentReviveCoinCost) {
      playSound("error");
      setReviveMessage(`You need ${currentReviveCoinCost.toLocaleString("en-US")} coins to revive.`);
      return;
    }

    try {
      setReviveAction("coins");
      setReviveMessage(null);
      const spent = await spendCoins(currentReviveCoinCost);

      if (!spent) {
        playSound("error");
        setReviveMessage("Not enough coins. Play a few more rounds or visit the shop.");
        return;
      }

      applyRevive("coins");
    } catch (error) {
      playSound("error");
      setReviveMessage(error instanceof Error ? error.message : "Could not use coins right now. Try again.");
    } finally {
      setReviveAction(null);
    }
  };

  const handlePlayAgain = () => {
    playSound("uiTap");
    const nextRoundState = createRoundState(1);
    roundStartTimeRef.current = Date.now();
    setSecretNumber(nextRoundState.secretNumber);
    setRoundModifier(nextRoundState.modifier);
    setGuess("");
    setErrorMessage(null);
    setReviveMessage(null);
    setPowerUpMessage(null);
    setLastResult(null);
    setLastScoreGain(0);
    setGuessHistory([]);
    setCurrentScore(0);
    setGameOverView("revive");
    setRunXpEarned(0);
    setRunBonusCoinsEarned(0);
    setRoundNumber(1);
    setRemainingChances(startingChances);
    setRunState("playing");
    setAdReviveCount(0);
    setReviveCount(0);
    setReviveUsedThisRun(false);
    setMatchSummary(null);
    setCoinBonusClaimed(false);
    setCoinClaimAction(null);
    startCountdown();
  };

  const handleExitToHome = () => {
    playSound("uiTap");
    persistActivePracticeRun();
    router.replace("/");
  };

  const handleShowResults = () => {
    playSound("uiTap");
    setGameOverView("results");
  };

  const baseCoinsEarned = lastScoreGain * 5;
  const coinsDisplayed = coinBonusClaimed ? baseCoinsEarned * 4 : baseCoinsEarned;
  const roundsCleared = Math.max(0, roundNumber - 1);
  const runCoinsEarned = currentScore * 5 + runBonusCoinsEarned;
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
      setRunBonusCoinsEarned((currentBonus) => currentBonus + baseCoinsEarned * 3);
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

      <Animated.View
        style={[
          styles.modifierCard,
          styles.modifierCardCompact,
          roundModifier.isBoss && styles.modifierCardBoss,
          {
            borderColor: roundModifier.isBoss ? roundModifier.accentColor : "#ebe7f3"
          },
          roundModifier.isBoss && { transform: [{ scale: bossCardPulse }] }
        ]}
      >
        <View
          style={[
            styles.modifierAccentTrack,
            { backgroundColor: roundModifier.accentColor },
            roundModifier.isBoss && styles.modifierAccentTrackBoss
          ]}
        />
        <View style={styles.modifierCopy}>
          <View style={styles.modifierTitleRow}>
            <View style={styles.modifierTitleCluster}>
              <View style={[styles.modifierIcon, { backgroundColor: roundModifier.accentColor }]}>
                <Ionicons
                  color="#ffffff"
                  name={roundModifier.isBoss ? "trophy" : roundModifier.hotColdMode ? "flame" : roundModifier.trapStart ? "warning" : "sparkles"}
                  size={18}
                />
              </View>
              <View style={styles.modifierTitleCopy}>
                <View style={styles.modifierEyebrowRow}>
                  <Text style={[styles.modifierEyebrow, roundModifier.isBoss && styles.modifierEyebrowBoss]}>
                    Round {roundNumber}
                  </Text>
                  {isNewModifierDiscovery ? (
                    <View style={[styles.modifierNewPill, { borderColor: roundModifier.accentColor }]}>
                      <Text style={[styles.modifierNewText, { color: roundModifier.accentColor }]}>New</Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={[styles.modifierTitle, roundModifier.isBoss && styles.modifierTitleBoss]}>
                  {modifierCardTitle}
                </Text>
              </View>
            </View>
            {centeredModifierRule ? (
              <View pointerEvents="none" style={styles.modifierInlineRuleSlot}>
                <View
                  style={[
                    styles.modifierRuleCallout,
                    styles.modifierRuleCalloutCentered,
                    { borderColor: roundModifier.accentColor },
                    roundModifier.isBoss && styles.modifierRuleCalloutBoss
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.modifierRuleCalloutLabel,
                      { color: roundModifier.accentColor },
                      roundModifier.isBoss && styles.modifierRuleCalloutLabelBoss
                    ]}
                  >
                    {centeredModifierRule.label}
                  </Text>
                  <View style={styles.modifierRuleCalloutValueRow}>
                    {centeredModifierRule.values.map((value) => (
                      <View key={value} style={[styles.modifierRuleCalloutValueBadge, { backgroundColor: roundModifier.accentColor }]}>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.72}
                          style={styles.modifierRuleCalloutValueText}
                        >
                          {value}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}
            <View style={styles.modifierActionCluster}>
              <View
                style={[
                  styles.modifierMultiplierPill,
                  !roundModifier.isBoss && { backgroundColor: "#f3edff", borderColor: "#ded0f7", borderWidth: 1 },
                  roundModifier.isBoss && { backgroundColor: roundModifier.accentColor },
                  roundModifier.isBoss && styles.modifierMultiplierPillBoss,
                  roundModifier.isBoss && { backgroundColor: "#6f5cff" }
                ]}
              >
                <Text style={[styles.modifierMultiplierText, !roundModifier.isBoss && { color: roundModifier.accentColor }]}>
                  {scoreMultiplierLabel}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Show round rules"
                accessibilityRole="button"
                onPress={() => {
                  playSound("uiTap");
                  setIsRulesModalVisible(true);
                }}
                style={({ pressed }) => [
                  styles.modifierInfoButton,
                  roundModifier.isBoss && styles.modifierInfoButtonBoss,
                  pressed && styles.guessButtonPressed
                ]}
              >
                <Ionicons color={roundModifier.isBoss ? "#ffffff" : roundModifier.accentColor} name="information-circle" size={20} />
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>

      <Modal
        animationType="fade"
        statusBarTranslucent
        transparent
        visible={isModifierIntroVisible}
        onRequestClose={closeModifierIntro}
      >
        <View style={styles.modifierIntroOverlay}>
          <View style={[styles.modifierIntroCard, { borderColor: roundModifier.accentColor }]}>
            <View style={[styles.modifierIntroIcon, { backgroundColor: roundModifier.accentColor }]}>
              <Ionicons
                color="#ffffff"
                name={roundModifier.hotColdMode ? "flame" : roundModifier.trapStart ? "warning" : "sparkles"}
                size={26}
              />
            </View>
            <Text style={styles.modifierIntroEyebrow}>New twist</Text>
            <Text numberOfLines={1} style={styles.modifierIntroTitle}>
              {roundModifier.label}
            </Text>
            <Text style={styles.modifierIntroBody}>{modifierIntroText}</Text>

            {revealedDigits.length > 0 ? (
              <View style={styles.modifierIntroDigitWrap}>
                <Text style={styles.modifierIntroDigitLabel}>{revealedDigitLabel}</Text>
                <View style={styles.modifierIntroDigitRow}>
                  {revealedDigits.map((digit) => (
                    <View key={digit} style={[styles.modifierIntroDigitBadge, { backgroundColor: roundModifier.accentColor }]}>
                      <Text style={styles.modifierIntroDigitValue}>{digit}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.modifierIntroChipRow}>
              <View style={[styles.modifierIntroChip, { borderColor: roundModifier.accentColor }]}>
                <Text style={[styles.modifierIntroChipText, { color: roundModifier.accentColor }]}>
                  {scoreMultiplierLabel}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={closeModifierIntro}
              style={({ pressed }) => [
                styles.modifierIntroButton,
                { backgroundColor: roundModifier.accentColor, borderBottomColor: roundModifier.accentColor },
                pressed && styles.guessButtonPressed
              ]}
            >
              <Text style={styles.modifierIntroButtonText}>TRY IT</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="none"
        statusBarTranslucent
        transparent
        visible={isBossIntroVisible}
        onRequestClose={hideBossIntro}
      >
        <Pressable accessibilityRole="button" onPress={hideBossIntro} style={styles.bossIntroOverlay}>
          <Animated.View
            style={[
              styles.bossIntroCard,
              { borderColor: roundModifier.accentColor, opacity: bossIntroOpacity, transform: [{ scale: bossIntroScale }] }
            ]}
          >
            <View style={[styles.bossIntroIcon, { backgroundColor: roundModifier.accentColor }]}>
              <Ionicons color="#ffffff" name="trophy" size={30} />
            </View>
            <Text style={styles.bossIntroEyebrow}>BOSS ROUND</Text>
            <Text numberOfLines={1} style={styles.bossIntroTitle}>
              {roundModifier.label.replace("Boss: ", "")}
            </Text>
            <View style={styles.bossIntroChipRow}>
              {bossIntroChips.map((chip) => (
                <View key={chip} style={[styles.bossIntroChip, { borderColor: roundModifier.accentColor }]}>
                  <Text style={[styles.bossIntroChipText, { color: roundModifier.accentColor }]}>{chip}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.bossIntroHint}>Tap to start</Text>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        statusBarTranslucent
        transparent
        visible={isRulesModalVisible}
        onRequestClose={() => setIsRulesModalVisible(false)}
      >
        <View style={styles.rulesOverlay}>
          <View style={styles.rulesCard}>
            <View style={styles.rulesHeader}>
              <View style={[styles.rulesIcon, { backgroundColor: roundModifier.accentColor }]}>
                <Ionicons color="#ffffff" name={roundModifier.isBoss ? "trophy" : "information-circle"} size={22} />
              </View>
              <View style={styles.rulesHeaderCopy}>
                <Text style={styles.rulesEyebrow}>Round {roundNumber}</Text>
                <Text numberOfLines={1} style={styles.rulesTitle}>
                  {roundModifier.label}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close round rules"
                accessibilityRole="button"
                onPress={() => {
                  playSound("uiTap");
                  setIsRulesModalVisible(false);
                }}
                style={({ pressed }) => [styles.rulesCloseButton, pressed && styles.guessButtonPressed]}
              >
                <Ionicons color={colors.textMuted} name="close" size={22} />
              </Pressable>
            </View>

            <View style={[styles.rulesSummaryPill, { borderColor: roundModifier.accentColor }]}>
              <Text style={[styles.rulesSummaryText, { color: roundModifier.accentColor }]}>
                {modifierClueText || roundModifier.description}
              </Text>
            </View>

            <View style={styles.rulesStrategyCard}>
              <View style={[styles.rulesStrategyIcon, { backgroundColor: `${roundModifier.accentColor}22` }]}>
                <Ionicons color={roundModifier.accentColor} name="bulb" size={17} />
              </View>
              <View style={styles.rulesStrategyCopy}>
                <Text style={styles.rulesStrategyLabel}>How to use it</Text>
                <Text style={styles.rulesStrategyText}>{modifierStrategyText}</Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.rulesList} showsVerticalScrollIndicator={false}>
              {modifierRuleDetails.map((rule, index) => (
                <View key={`${rule}-${index}`} style={styles.rulesItem}>
                  <View style={[styles.rulesBullet, { backgroundColor: roundModifier.accentColor }]} />
                  <Text style={styles.rulesItemText}>{rule}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.guessPanel}>
        <View style={styles.guessHero}>
          {lockedDigitDisplaySlots ? (
            <View style={styles.lockedGuessSlots}>
              {lockedDigitDisplaySlots.map((slot, index) => (
                <Text
                  key={`${slot.value}-${index}`}
                  style={[
                    styles.guessInputValue,
                    styles.lockedGuessSlotText,
                    !slot.isLocked && styles.guessInputValueEmpty,
                    slot.isLocked && styles.lockedGuessDigit
                  ]}
                >
                  {slot.value}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={[styles.guessInputValue, guess.length === 0 && styles.guessInputValueEmpty]}>
              {guess.length > 0 ? guess : "--"}
            </Text>
          )}
        </View>

        <View style={[styles.bannerCard, { borderColor: bannerColor }]}>
          <Ionicons color={bannerColor} name={bannerIcon} size={20} />
          <Text style={[styles.bannerText, { color: bannerColor }]}>{bannerTitle}</Text>
        </View>
        {lastGuessResolution?.secondaryLabel ? (
          <View style={[styles.secondaryFeedbackPill, { borderColor: bannerColor }]}>
            <Text style={[styles.secondaryFeedbackText, { color: bannerColor }]}>
              {lastGuessResolution.secondaryLabel}
            </Text>
          </View>
        ) : null}

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
            +{lastScoreGain} score with {scoreMultiplierLabel}. Next milestone: round {nextMilestone}.
          </Text>
        ) : null}
        {!isRoundCleared && !isGameOver && powerUpMessage ? (
          <Text style={styles.statusMeta}>{powerUpMessage}</Text>
        ) : null}
        {!isRoundCleared && !isGameOver && !powerUpMessage && !errorMessage ? (
          <Text style={styles.statusMeta}>
            {lastGuessResolution?.statusText
              ? lastGuessResolution.statusText
              : roundsUntilMilestone > 0
                ? `${roundsUntilMilestone} round${roundsUntilMilestone === 1 ? "" : "s"} to the next milestone.`
                : "Milestone round."}
          </Text>
        ) : null}
      </View>

      <View style={styles.bottomSpacer} />

      <View style={styles.bottomControls}>
        {historyItems.length > 0 ? (
          <View style={styles.historyList}>
            {historyItems.map((entry, index) => {
              const entryResolution = resolveSinglePlayerGuess(
                entry.guess,
                secretNumber,
                difficultyConfig.maxNumber,
                roundModifier
              );

              return (
                <View key={`${entry.guess}-${index}`} style={styles.historyCard}>
                  <Text style={styles.historyGuess}>{entry.guess}</Text>
                  <View style={[styles.historyResultBadge, { borderColor: entryResolution.historyColor }]}>
                    <Text style={[styles.historyResultText, { color: entryResolution.historyColor }]}>
                      {entryResolution.historyLabel.toUpperCase()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <GameKeyboard
          disabled={countdownActive || runState !== "playing"}
          onAppendDigit={appendDigit}
          onBackspace={removeDigit}
          onClear={clearDigit}
        />

        <View style={styles.actionRow}>
          <Pressable
            accessibilityLabel="Use extra guess power-up"
            disabled={!canTriggerExtraGuess}
            onPress={() => void handleUseExtraGuessPowerUp()}
            style={({ pressed }) => [
              styles.powerUpButton,
              pressed && canTriggerExtraGuess && styles.actionButtonPressed,
              !canTriggerExtraGuess && styles.powerUpButtonDisabled
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
              pressed && !ctaDisabled && styles.actionButtonPressed,
              ctaDisabled && styles.actionGuessButtonDisabled
            ]}
          >
            <Text style={styles.guessButtonText}>
              {isRoundCleared ? "NEXT ROUND >" : isGameOver ? "NEW GAME" : "GUESS >"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Use skip power-up"
            disabled={!canTriggerSkipBooster}
            onPress={() => void handleUseSkipBooster()}
            style={({ pressed }) => [
              styles.powerUpButton,
              styles.skipBoosterButton,
              pressed && canTriggerSkipBooster && styles.actionButtonPressed,
              !canTriggerSkipBooster && styles.powerUpButtonDisabled
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

      <Modal
        animationType="fade"
        statusBarTranslucent
        transparent
        visible={isGameOver && gameOverView === "revive"}
      >
        <View style={styles.gameOverOverlay}>
          <View style={styles.gameOverCard}>
            <View style={styles.gameOverIconWrap}>
              <Ionicons color="#ffffff" name="alert" size={34} />
            </View>
            <Text style={styles.gameOverTitle}>GAME OVER</Text>
            <Text style={styles.gameOverMessage}>
              Revive now to keep your score and push toward round {nextMilestone}.
            </Text>
            <View style={styles.gameOverRewardPill}>
              <Ionicons color={colors.accent} name="flash" size={15} />
              <Text style={styles.gameOverRewardText}>{REVIVE_GUESSES} guesses on revive</Text>
            </View>
            {reviveCount > 0 ? (
              <Text style={styles.gameOverHint}>
                Revive #{nextReviveNumber}. Coin price doubles each time.
              </Text>
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
                    {reviveAction === "ad"
                      ? "LOADING"
                      : !canShowRewardedRevive || !hasRewardedRevivesLeft
                        ? "AD UNAVAILABLE"
                        : "FREE AD"}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                disabled={!canUseCoinRevive}
                onPress={() => void handleUseCoinRevive()}
                style={({ pressed }) => [
                  styles.gameOverReviveButton,
                  styles.gameOverCoinButton,
                  pressed && canUseCoinRevive && styles.guessButtonPressed,
                  !canUseCoinRevive && styles.guessButtonDisabled
                ]}
              >
                <Text style={styles.gameOverReviveButtonTitle}>REVIVE</Text>
                <View style={styles.gameOverBadge}>
                  <CoinIcon size={17} />
                  <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.gameOverBadgeText}>
                    {reviveAction === "coins" ? "SPENDING" : `${currentReviveCoinCost.toLocaleString("en-US")} COINS`}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleShowResults}
            style={({ pressed }) => [
              styles.gameOverNoThanksButton,
              pressed && styles.guessButtonPressed
            ]}
          >
            <Text style={styles.gameOverNoThanksText}>NO THANKS</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        statusBarTranslucent
        transparent
        visible={isGameOver && gameOverView === "results"}
      >
        <View style={styles.resultsOverlay}>
          <View style={styles.resultsCard}>
            <View style={styles.resultsHeader}>
              <View style={styles.resultsIcon}>
                <Ionicons color="#ffffff" name="flag" size={24} />
              </View>
              <View style={styles.resultsHeaderCopy}>
                <Text style={styles.resultsEyebrow}>RUN COMPLETE</Text>
                <Text style={styles.resultsTitle}>Nice try!</Text>
              </View>
            </View>

            <View style={styles.resultsScorePanel}>
              <Text style={styles.resultsScoreLabel}>FINAL SCORE</Text>
              <Text adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={styles.resultsScoreValue}>
                {currentScore.toLocaleString("en-US")}
              </Text>
              <Text style={styles.resultsScoreMeta}>
                {roundsCleared === 1 ? "1 round cleared" : `${roundsCleared} rounds cleared`} | Next milestone: round {nextMilestone}
              </Text>
            </View>

            <View style={styles.resultsTargetPanel}>
              <Text style={styles.resultsTargetLabel}>TARGET NUMBER</Text>
              <Text adjustsFontSizeToFit minimumFontScale={0.62} numberOfLines={1} style={styles.resultsTargetValue}>
                {secretNumber.toLocaleString("en-US")}
              </Text>
              <Text style={styles.resultsTargetMeta}>
                Round {roundNumber} | {roundModifier.label}
              </Text>
            </View>

            <View style={styles.resultsRewardsRow}>
              <View style={styles.resultsRewardTile}>
                <CoinIcon size={30} />
                <View style={styles.resultsRewardCopy}>
                  <Text style={styles.resultsRewardLabel}>COINS EARNED</Text>
                  <Text style={styles.resultsRewardValue}>+{runCoinsEarned.toLocaleString("en-US")}</Text>
                </View>
              </View>

              <View style={styles.resultsRewardTile}>
                <View style={styles.resultsXpIcon}>
                  <Ionicons color="#ffffff" name="sparkles" size={17} />
                </View>
                <View style={styles.resultsRewardCopy}>
                  <Text style={styles.resultsRewardLabel}>XP EARNED</Text>
                  <Text style={styles.resultsRewardValue}>+{runXpEarned.toLocaleString("en-US")}</Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={handlePlayAgain}
              style={({ pressed }) => [
                styles.resultsPlayAgainButton,
                pressed && styles.guessButtonPressed
              ]}
            >
              <Ionicons color="#ffffff" name="refresh" size={19} />
              <Text style={styles.resultsPlayAgainText}>PLAY AGAIN</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityLabel="Go to home"
            onPress={handleExitToHome}
            style={({ pressed }) => [
              styles.resultsHomeButton,
              pressed && styles.guessButtonPressed
            ]}
          >
            <Ionicons color="#ffffff" name="home" size={26} />
          </Pressable>
        </View>
      </Modal>

      <Modal animationType="fade" statusBarTranslucent transparent visible={isRoundCleared}>
        <View style={styles.gameOverOverlay}>
          <ConfettiBurst visible={isRoundCleared} />
          <View style={[styles.winCard, roundModifier.isBoss && styles.winCardBoss, roundModifier.isBoss && { borderColor: roundModifier.accentColor }]}>
            <Text style={[styles.winTitle, roundModifier.isBoss && { color: roundModifier.accentColor }]}>
              {roundModifier.isBoss ? "BOSS CLEARED" : "ROUND CLEAR"}
            </Text>
            <View style={[styles.winIconWrap, roundModifier.isBoss && { backgroundColor: roundModifier.accentColor, borderColor: roundModifier.accentColor }]}>
              <Ionicons color="#eafff3" name={roundModifier.isBoss ? "trophy" : "checkmark"} size={48} />
            </View>
            <Text style={styles.winMessage}>
              {roundModifier.isBoss
                ? `You beat ${roundModifier.label.replace("Boss: ", "")}. Number: ${secretNumber}.`
                : `The number was ${secretNumber}.`}
            </Text>
            <View style={[styles.winModifierPill, { borderColor: roundModifier.accentColor }]}>
              <Ionicons color={roundModifier.accentColor} name={roundModifier.isBoss ? "trophy" : "sparkles"} size={16} />
              <Text style={[styles.winModifierText, { color: roundModifier.accentColor }]}>
                {roundModifier.label} cleared | {scoreMultiplierLabel}
              </Text>
            </View>

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
  modifierCard: {
    alignItems: "stretch",
    backgroundColor: "#fffefe",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: spacing.sm,
    minHeight: 86,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: "relative",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3
  },
  modifierCardCompact: {
    justifyContent: "center",
    minHeight: 64,
    paddingVertical: 8
  },
  modifierCardBoss: {
    backgroundColor: "#1f1849",
    shadowColor: "#161033",
    shadowOpacity: 0.2
  },
  modifierAccentTrack: {
    borderBottomRightRadius: 6,
    borderTopRightRadius: 6,
    bottom: 12,
    left: 0,
    opacity: 0.9,
    position: "absolute",
    top: 12,
    width: 4
  },
  modifierAccentTrackBoss: {
    opacity: 1
  },
  modifierIcon: {
    alignItems: "center",
    borderBottomColor: "rgba(0,0,0,0.18)",
    borderBottomWidth: 2,
    borderRadius: 13,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  modifierCopy: {
    gap: 8,
    minWidth: 0
  },
  modifierTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  modifierTitleCluster: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 0
  },
  modifierTitleCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0
  },
  modifierEyebrowRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  modifierEyebrow: {
    color: "#687076",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  modifierEyebrowBoss: {
    color: "#cfc8ff"
  },
  modifierTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.1,
    textTransform: "uppercase"
  },
  modifierTitleBoss: {
    color: "#ffffff"
  },
  modifierNewPill: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 22,
    paddingHorizontal: 8
  },
  modifierNewText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  modifierMultiplierPill: {
    alignItems: "center",
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 24,
    paddingHorizontal: 9
  },
  modifierMultiplierPillBoss: {
    backgroundColor: "#6f5cff",
    borderColor: "rgba(255,255,255,0.22)",
    borderWidth: 1
  },
  modifierMultiplierText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  modifierInfoButton: {
    alignItems: "center",
    backgroundColor: "#fbfbfb",
    borderColor: "#e3e7e3",
    borderRadius: 14,
    borderWidth: 1,
    height: 27,
    justifyContent: "center",
    width: 27
  },
  modifierInfoButtonBoss: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.26)"
  },
  modifierActionCluster: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 6
  },
  modifierBody: {
    color: "#23282b",
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17
  },
  modifierBodyBoss: {
    color: "#ece9ff"
  },
  modifierContentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingLeft: 41
  },
  modifierInlineRuleSlot: {
    alignItems: "center",
    flexShrink: 0,
    justifyContent: "center"
  },
  modifierRuleCallout: {
    alignItems: "center",
    backgroundColor: "#fbf8ff",
    borderColor: "#e1d8f3",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    flexShrink: 0,
    gap: 5,
    minHeight: 36,
    paddingLeft: 11,
    paddingRight: 7,
    paddingVertical: 5
  },
  modifierRuleCalloutCentered: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3
  },
  modifierRuleCalloutBoss: {
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  modifierRuleCalloutLabel: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.35,
    textTransform: "uppercase"
  },
  modifierRuleCalloutLabelBoss: {
    color: "#ffffff"
  },
  modifierRuleCalloutValueRow: {
    flexDirection: "row",
    gap: 6
  },
  modifierRuleCalloutValueBadge: {
    alignItems: "center",
    borderBottomColor: "rgba(0,0,0,0.18)",
    borderBottomWidth: 2,
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 30,
    minWidth: 34,
    paddingHorizontal: 10
  },
  modifierRuleCalloutValueText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    includeFontPadding: false,
    lineHeight: 21
  },
  modifierRulePill: {
    alignSelf: "flex-start",
    backgroundColor: colors.backgroundAlt,
    borderRadius: radii.pill,
    marginLeft: 43,
    maxWidth: "100%",
    minHeight: 25,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  modifierRulePillBoss: {
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  modifierRuleText: {
    fontSize: 10,
    fontWeight: "900"
  },
  modifierRuleTextBoss: {
    color: "#ffffff"
  },
  modifierIntroOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(22, 27, 34, 0.54)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  modifierIntroCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 2,
    gap: spacing.sm,
    maxWidth: 400,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    width: "100%",
    elevation: 12
  },
  modifierIntroIcon: {
    alignItems: "center",
    borderBottomColor: "rgba(0,0,0,0.18)",
    borderBottomWidth: 4,
    borderRadius: 24,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  modifierIntroEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  modifierIntroTitle: {
    color: colors.text,
    fontSize: 25,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase"
  },
  modifierIntroBody: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
    textAlign: "center"
  },
  modifierIntroDigitWrap: {
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.surfaceMuted,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: "100%"
  },
  modifierIntroDigitLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  modifierIntroDigitRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center"
  },
  modifierIntroDigitBadge: {
    alignItems: "center",
    borderBottomColor: "rgba(0,0,0,0.18)",
    borderBottomWidth: 4,
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 58,
    paddingHorizontal: 13
  },
  modifierIntroDigitValue: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
    includeFontPadding: false,
    lineHeight: 38
  },
  modifierIntroChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    justifyContent: "center"
  },
  modifierIntroChip: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 29,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  modifierIntroChipText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  modifierIntroButton: {
    alignItems: "center",
    borderBottomWidth: 5,
    borderRadius: radii.pill,
    justifyContent: "center",
    marginTop: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    width: "100%"
  },
  modifierIntroButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.7
  },
  bossIntroOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(13, 17, 23, 0.78)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  bossIntroCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 3,
    gap: spacing.sm,
    maxWidth: 420,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    width: "100%",
    elevation: 16
  },
  bossIntroIcon: {
    alignItems: "center",
    borderBottomColor: "rgba(0,0,0,0.22)",
    borderBottomWidth: 5,
    borderRadius: 28,
    height: 58,
    justifyContent: "center",
    width: 58
  },
  bossIntroEyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase"
  },
  bossIntroTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center",
    textTransform: "uppercase"
  },
  bossIntroChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    justifyContent: "center",
    marginTop: spacing.xs
  },
  bossIntroChip: {
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    minHeight: 30,
    paddingHorizontal: 11,
    paddingVertical: 6
  },
  bossIntroChipText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  bossIntroHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.xs
  },
  rulesOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(22, 27, 34, 0.72)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  rulesCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    maxHeight: "78%",
    maxWidth: 460,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    width: "100%",
    elevation: 10
  },
  rulesHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  rulesIcon: {
    alignItems: "center",
    borderBottomColor: "rgba(0,0,0,0.18)",
    borderBottomWidth: 3,
    borderRadius: 18,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  rulesHeaderCopy: {
    flex: 1,
    minWidth: 0
  },
  rulesEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  rulesTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  rulesCloseButton: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 16,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  rulesSummaryPill: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  rulesSummaryText: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  rulesStrategyCard: {
    alignItems: "flex-start",
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm
  },
  rulesStrategyIcon: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  rulesStrategyCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  rulesStrategyLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  rulesStrategyText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  rulesList: {
    gap: spacing.sm,
    paddingTop: spacing.md
  },
  rulesItem: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm
  },
  rulesBullet: {
    borderRadius: 4,
    height: 8,
    marginTop: 6,
    width: 8
  },
  rulesItemText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20
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
  secondaryFeedbackPill: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 28,
    paddingHorizontal: 12
  },
  secondaryFeedbackText: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
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
  lockedGuessSlots: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center"
  },
  lockedGuessSlotText: {
    minWidth: 34
  },
  lockedGuessDigit: {
    color: "#7f8790",
    opacity: 0.48
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
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 6,
    marginTop: 4
  },
  guessButton: {
    alignItems: "center",
    backgroundColor: "#047a37",
    borderBottomColor: "#025a29",
    borderBottomWidth: 6,
    borderColor: "#068f42",
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    height: 58,
    justifyContent: "center",
    shadowColor: "#014e23",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  powerUpButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderBottomColor: "transparent",
    borderBottomWidth: 0,
    borderColor: "transparent",
    borderRadius: 20,
    borderWidth: 0,
    height: 58,
    justifyContent: "center",
    overflow: "visible",
    position: "relative",
    width: 64
  },
  actionButtonPressed: {
    borderBottomWidth: 2,
    transform: [{ translateY: 3 }, { scale: 0.99 }]
  },
  actionGuessButtonDisabled: {
    backgroundColor: "#b9c9bf",
    borderBottomColor: "#9cadA2",
    borderColor: "#c7d3cc",
    shadowOpacity: 0
  },
  powerUpButtonDisabled: {
    backgroundColor: "transparent",
    borderBottomColor: "transparent",
    opacity: 0.42,
    shadowOpacity: 0
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
    backgroundColor: "rgba(16, 18, 24, 0.78)",
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl
  },
  gameOverCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "rgba(74, 167, 255, 0.22)",
    borderWidth: 1,
    borderRadius: 28,
    gap: 12,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
    maxWidth: 420,
    width: "100%"
  },
  gameOverIconWrap: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.danger,
    borderColor: "#ffd0c9",
    borderRadius: 34,
    borderWidth: 5,
    height: 68,
    justifyContent: "center",
    shadowColor: "#9f2f24",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    width: 68
  },
  gameOverTitle: {
    color: "#15181b",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center"
  },
  gameOverMessage: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    maxWidth: 300,
    textAlign: "center"
  },
  gameOverRewardPill: {
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: spacing.md
  },
  gameOverRewardText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  gameOverHint: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center"
  },
  gameOverActionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%"
  },
  gameOverReviveButton: {
    alignItems: "center",
    borderRadius: 18,
    borderBottomWidth: 5,
    flex: 1,
    gap: 8,
    justifyContent: "center",
    minHeight: 98,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 14
  },
  gameOverAdButton: {
    backgroundColor: colors.ai,
    borderBottomColor: "#b3297c"
  },
  gameOverCoinButton: {
    backgroundColor: colors.accent,
    borderBottomColor: "#025a29"
  },
  gameOverReviveButtonTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center"
  },
  gameOverBadge: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.16)",
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    maxWidth: "100%",
    minHeight: 32,
    minWidth: 108,
    paddingHorizontal: 10
  },
  gameOverBadgeText: {
    color: "#ffffff",
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "900",
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 16,
    textAlign: "center"
  },
  gameOverNoThanksButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.xl
  },
  gameOverNoThanksText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 16,
    textAlign: "center",
    textTransform: "uppercase"
  },
  resultsOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(16, 18, 24, 0.82)",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl
  },
  resultsCard: {
    backgroundColor: colors.surface,
    borderColor: "rgba(31, 196, 109, 0.18)",
    borderRadius: 26,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 14,
    width: "100%"
  },
  resultsHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11
  },
  resultsIcon: {
    alignItems: "center",
    backgroundColor: colors.online,
    borderBottomColor: "#267ebd",
    borderBottomWidth: 4,
    borderRadius: 18,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  resultsHeaderCopy: {
    flex: 1,
    gap: 1
  },
  resultsEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  resultsTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 0
  },
  resultsScorePanel: {
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.surfaceMuted,
    borderRadius: 20,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 15
  },
  resultsScoreLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  resultsScoreValue: {
    color: colors.text,
    fontSize: 48,
    fontWeight: "900",
    includeFontPadding: false,
    letterSpacing: 0,
    lineHeight: 54,
    maxWidth: "100%"
  },
  resultsScoreMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  resultsTargetPanel: {
    alignItems: "center",
    backgroundColor: "#fff8eb",
    borderColor: "#ffd86b",
    borderRadius: 18,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  resultsTargetLabel: {
    color: "#9c6a00",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  resultsTargetValue: {
    color: "#1f2326",
    fontSize: 34,
    fontWeight: "900",
    includeFontPadding: false,
    lineHeight: 38,
    maxWidth: "100%"
  },
  resultsTargetMeta: {
    color: "#80621a",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center"
  },
  resultsRewardsRow: {
    flexDirection: "row",
    gap: 10
  },
  resultsRewardTile: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 68,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  resultsXpIcon: {
    alignItems: "center",
    backgroundColor: colors.online,
    borderRadius: 15,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  resultsRewardCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  resultsRewardLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  resultsRewardValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    includeFontPadding: false,
    letterSpacing: 0
  },
  resultsPlayAgainButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderBottomColor: "#025a29",
    borderBottomWidth: 5,
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: spacing.lg
  },
  resultsPlayAgainText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0
  },
  resultsHomeButton: {
    alignItems: "center",
    backgroundColor: colors.online,
    borderBottomColor: "#267ebd",
    borderBottomWidth: 5,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    width: 56
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
  winCardBoss: {
    backgroundColor: "#ffffff",
    borderWidth: 6
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
  winModifierPill: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: radii.pill,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12
  },
  winModifierText: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
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
