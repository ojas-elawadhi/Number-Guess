import { StyleSheet, Text, View } from "react-native";

import type { Player } from "../types/game.types";
import { colors, radii, spacing } from "../utils/theme";

interface PlayerListProps {
  players: Player[];
  hostId: string;
  winnerId?: string | null;
  winnerIds?: string[];
}

export function PlayerList({ players, hostId, winnerId, winnerIds = [] }: PlayerListProps) {
  return (
    <View style={styles.container}>
      {players.map((player) => {
        const isHost = player.id === hostId;
        const isWinner = winnerIds.includes(player.id) || player.id === winnerId;

        return (
          <View key={player.id} style={styles.row}>
            <View style={styles.identity}>
              <View style={styles.dot} />
              <View>
              <Text style={styles.name}>{player.name}</Text>
              <Text style={styles.meta}>{isHost ? "Host" : "Player"}</Text>
              </View>
            </View>
            {isWinner ? <Text style={styles.badge}>Winner</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    flexBasis: "48%",
    minHeight: 92,
    padding: spacing.md,
    justifyContent: "center"
  },
  identity: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  dot: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    height: 44,
    width: 44
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
    textTransform: "uppercase"
  },
  badge: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    marginTop: spacing.sm
  }
});
