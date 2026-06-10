import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ConfettiBurst } from "../components/ConfettiBurst";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { showInterstitialAd } from "../services/interstitialAd";
import { playSound } from "../services/soundEffects";
import { leaveRoom } from "../socket/onlineSocket";
import { useMonetizationStore } from "../store/useMonetizationStore";
import { useOnlineGameStore } from "../store/useOnlineGameStore";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { MatchRecord } from "../types/progression.types";
import { colors, radii, shadows, spacing } from "../utils/theme";

export default function OnlineResultScreen() {
  const player = useOnlineGameStore((state) => state.player);
  const room = useOnlineGameStore((state) => state.room);
  const guessHistory = useOnlineGameStore((state) => state.guessHistory);
  const matchStartedAt = useOnlineGameStore((state) => state.matchStartedAt);
  const resetRoundState = useOnlineGameStore((state) => state.resetRoundState);
  const resetAll = useOnlineGameStore((state) => state.resetAll);
  const errorMessage = useOnlineGameStore((state) => state.errorMessage);
  const setErrorMessage = useOnlineGameStore((state) => state.setErrorMessage);
  const hasNoAdsEntitlement = useMonetizationStore((state) => state.hasNoAdsEntitlement);
  const recordMatch = usePlayerProgressStore((state) => state.recordMatch);
  const recordedMatchRef = useRef(false);
  const [matchSummary, setMatchSummary] = useState<MatchRecord | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const winnerIds = room?.winnerIds ?? [];
  const winners = room?.players.filter((currentPlayer) => winnerIds.includes(currentPlayer.id)) ?? [];
  const winner = room?.players.find((currentPlayer) => currentPlayer.id === room.winner) ?? null;
  const isTie = winners.length > 1;
  const didPlayerWin = player ? winnerIds.includes(player.id) : false;
  const opponent = room?.players.find((currentPlayer) => currentPlayer.id !== player?.id);

  useEffect(() => {
    if (!player || !room) {
      router.replace("/");
      return;
    }

    if (room.gameState === "playing") {
      router.replace("/online-game");
    }
  }, [player, room]);

  useEffect(() => {
    if (!player || !room || recordedMatchRef.current) {
      return;
    }

    recordedMatchRef.current = true;
    const outcome = isTie ? "tie" : didPlayerWin ? "win" : "loss";

    recordMatch({
      category: "online",
      mode: room.mode === "duel" ? "duel" : "classic",
      difficulty: room.difficulty,
      outcome,
      attempts: guessHistory.filter((entry) => entry.guess !== null).length,
      durationMs:
        matchStartedAt === null
          ? room.roundNumber * room.roundDurationSeconds * 1000
          : Date.now() - matchStartedAt,
      opponentName: opponent?.name ?? "Online Rival",
      opponentPersona: room.mode === "duel" ? "Room duel rival" : "Room classic rival"
    })
      .then(setMatchSummary)
      .catch(() => {});
  }, [
    didPlayerWin,
    guessHistory,
    isTie,
    matchStartedAt,
    opponent?.name,
    player,
    recordMatch,
    room
  ]);

  useEffect(() => {
    if (!player || !room) {
      return;
    }

    playSound(isTie ? "tie" : didPlayerWin ? "victory" : "defeat");
  }, [didPlayerWin, isTie, player, room]);

  if (!room || !player) {
    return null;
  }

  const rankedPlayers = [...room.players].sort((left, right) => {
    const leftScore = winnerIds.includes(left.id) ? 0 : left.id === player.id ? 1 : 2;
    const rightScore = winnerIds.includes(right.id) ? 0 : right.id === player.id ? 1 : 2;
    return leftScore - rightScore;
  });

  const podiumPlayers = rankedPlayers.slice(0, 3);

  const handleRematch = () => {
    resetRoundState();
    router.replace("/online-lobby");
  };

  const handleHome = async () => {
    if (isLeaving) {
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
    router.replace("/");
  };

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <ConfettiBurst visible={didPlayerWin || isTie} />

      <View style={styles.header}>
        <Text style={[styles.victory, !didPlayerWin && !isTie && styles.lossText]}>
          {isTie ? "TIE GAME" : didPlayerWin ? "VICTORY" : "DEFEAT"}
        </Text>
        <Text style={styles.subtitle}>MATCH COMPLETED</Text>
      </View>

      <View style={styles.podiumRow}>
        {podiumPlayers[1] ? (
          <View style={[styles.podiumCard, styles.podiumSide]}>
            <Text style={styles.podiumRank}>2</Text>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{podiumPlayers[1].name.slice(0, 2).toUpperCase()}</Text>
            </View>
            <Text numberOfLines={1} style={styles.podiumName}>{podiumPlayers[1].name}</Text>
            <Text style={styles.podiumXp}>+300 XP</Text>
          </View>
        ) : <View style={styles.podiumSpacer} />}

        <View style={[styles.podiumCard, styles.podiumWinner, (!didPlayerWin && !isTie) && styles.podiumLoser]}>
          <Text style={styles.podiumRank}>1</Text>
          <View style={[styles.avatarCircle, styles.winnerAvatar]}>
            <Text style={styles.avatarText}>{(winner?.name ?? player.name).slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text numberOfLines={1} style={styles.podiumName}>{winner?.name ?? player.name}</Text>
          <View style={styles.xpPill}>
            <Text style={styles.xpPillText}>{matchSummary ? `+${matchSummary.xpEarned} XP` : "+500 XP"}</Text>
          </View>
        </View>

        {podiumPlayers[2] ? (
          <View style={[styles.podiumCard, styles.podiumSide]}>
            <Text style={styles.podiumRank}>3</Text>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{podiumPlayers[2].name.slice(0, 2).toUpperCase()}</Text>
            </View>
            <Text numberOfLines={1} style={styles.podiumName}>{podiumPlayers[2].name}</Text>
            <Text style={styles.podiumXp}>+150 XP</Text>
          </View>
        ) : <View style={styles.podiumSpacer} />}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryText}>{matchSummary ? `+${matchSummary.points} points` : "Scoring..."}</Text>
        <Text style={styles.summaryText}>Difficulty {room.difficulty}</Text>
        <Text style={styles.summaryText}>Round {room.roundNumber}</Text>
      </View>

      <View style={styles.spacer} />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <PrimaryButton disabled={isLeaving} label="REMATCH" onPress={handleRematch} variant="success" />
      <PrimaryButton label="HOME" loading={isLeaving} onPress={handleHome} variant="secondary" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md
  },
  header: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.lg
  },
  victory: {
    color: colors.accent,
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: 1
  },
  lossText: {
    color: colors.danger
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 2
  },
  podiumRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center"
  },
  podiumCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    width: "31%",
    ...shadows.card
  },
  podiumSide: {
    minHeight: 220
  },
  podiumWinner: {
    backgroundColor: colors.practice,
    minHeight: 320
  },
  podiumLoser: {
    backgroundColor: colors.higher
  },
  podiumRank: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    borderWidth: 2,
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  avatarCircle: {
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 6,
    height: 84,
    justifyContent: "center",
    width: 84
  },
  winnerAvatar: {
    height: 106,
    width: 106
  },
  avatarText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900"
  },
  podiumName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  podiumXp: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700"
  },
  xpPill: {
    backgroundColor: colors.accentDark,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  xpPillText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  podiumSpacer: {
    width: "31%"
  },
  summaryCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.xs,
    padding: spacing.md
  },
  summaryText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800"
  },
  spacer: {
    flex: 1
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  }
});
