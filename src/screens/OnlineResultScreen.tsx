import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ConfettiBurst } from "../components/ConfettiBurst";
import { PlayerList } from "../components/PlayerList";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { useOnlineGameStore } from "../store/useOnlineGameStore";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { MatchRecord } from "../types/progression.types";
import { colors, spacing } from "../utils/theme";
import { formatDuration } from "../utils/progression";

export default function OnlineResultScreen() {
  const player = useOnlineGameStore((state) => state.player);
  const room = useOnlineGameStore((state) => state.room);
  const guessHistory = useOnlineGameStore((state) => state.guessHistory);
  const matchStartedAt = useOnlineGameStore((state) => state.matchStartedAt);
  const resetRoundState = useOnlineGameStore((state) => state.resetRoundState);
  const recordMatch = usePlayerProgressStore((state) => state.recordMatch);
  const recordedMatchRef = useRef(false);
  const [matchSummary, setMatchSummary] = useState<MatchRecord | null>(null);

  useEffect(() => {
    if (!player || !room) {
      router.replace("/");
      return;
    }

    if (room.gameState === "playing") {
      router.replace("/online-game");
    }
  }, [player, room]);

  if (!room || !player) {
    return null;
  }

  const winnerIds = room.winnerIds ?? [];
  const winners = room.players.filter((currentPlayer) => winnerIds.includes(currentPlayer.id));
  const winner = room.players.find((currentPlayer) => currentPlayer.id === room.winner) ?? null;
  const isTie = winners.length > 1;
  const didPlayerWin = winnerIds.includes(player.id);
  const opponent = room.players.find((currentPlayer) => currentPlayer.id !== player.id);

  useEffect(() => {
    if (recordedMatchRef.current) {
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
      .catch(() => {
        // Results should still render even if local progression persistence fails.
      });
  }, [
    didPlayerWin,
    guessHistory,
    isTie,
    matchStartedAt,
    opponent?.name,
    player.id,
    recordMatch,
    room.difficulty,
    room.mode,
    room.roundDurationSeconds,
    room.roundNumber
  ]);

  const handleRematch = () => {
    resetRoundState();
    router.replace("/online-lobby");
  };

  return (
    <ScreenContainer>
      <ConfettiBurst visible={didPlayerWin || isTie} />

      <View style={styles.hero}>
        <Text style={styles.label}>Match Finished</Text>
        <Text style={styles.title}>
          {isTie ? "It’s a tie!" : didPlayerWin ? "You win!" : winner ? `${winner.name} wins!` : "Game complete"}
        </Text>
        <Text style={styles.subtitle}>
          {isTie
            ? "Both players guessed correctly in the same round."
            : didPlayerWin
              ? "Your read on the range beat the room this time."
              : "The other side found the number first. Queue up another rematch when you’re ready."}
        </Text>
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.sectionTitle}>Match rewards</Text>
        <Text style={styles.resultLine}>
          {matchSummary
            ? `+${matchSummary.points} points • +${matchSummary.xpEarned} XP • ${formatDuration(matchSummary.durationMs)}`
            : "Scoring your online match..."}
        </Text>
        <Text style={styles.resultLine}>
          Attempts: {guessHistory.filter((entry) => entry.guess !== null).length} • Difficulty: {room.difficulty}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Players</Text>
        <PlayerList hostId={room.hostId} players={room.players} winnerId={room.winner} winnerIds={winnerIds} />
      </View>

      <PrimaryButton label="Rematch In Lobby" onPress={handleRematch} />
      <PrimaryButton label="Back Home" onPress={() => router.replace("/")} variant="secondary" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.xl,
    gap: spacing.sm
  },
  label: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm
  },
  resultLine: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700"
  }
});
