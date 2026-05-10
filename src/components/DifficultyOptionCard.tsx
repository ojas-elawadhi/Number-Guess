import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Difficulty } from "../types/game.types";
import { colors, radii, spacing } from "../utils/theme";
import { DIFFICULTY_CONFIG, getDifficultyRangeLabel } from "../../shared/difficulty";

interface DifficultyOptionCardProps {
  difficulty: Difficulty;
  onPress: () => void;
}

export function DifficultyOptionCard({ difficulty, onPress }: DifficultyOptionCardProps) {
  const theme =
    difficulty === "easy"
      ? {
          backgroundColor: "#87f56c",
          textColor: "#005027",
          edgeColor: "rgba(0, 80, 39, 0.1)",
          ghostColor: "rgba(0, 80, 39, 0.1)"
        }
      : difficulty === "hard"
        ? {
            backgroundColor: "#7fd6ff",
            textColor: "#00476e",
            edgeColor: "rgba(0, 71, 110, 0.1)",
            ghostColor: "rgba(0, 71, 110, 0.1)"
          }
        : {
            backgroundColor: "#ffb39f",
            textColor: "#7f1e28",
            edgeColor: "rgba(133, 27, 34, 0.1)",
            ghostColor: "rgba(133, 27, 34, 0.1)"
          };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundColor,
          borderBottomColor: theme.edgeColor,
          shadowColor: colors.shadow
        },
        pressed && styles.pressed
      ]}
    >
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.textColor }]}>{DIFFICULTY_CONFIG[difficulty].label}</Text>
        <Text style={[styles.subtitle, { color: theme.textColor }]}>{getDifficultyRangeLabel(difficulty)}</Text>
      </View>
      <View style={[styles.ghost, { backgroundColor: theme.ghostColor }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderBottomWidth: 6,
    borderRadius: radii.lg,
    minHeight: 76,
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 7
  },
  copy: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
    textAlign: "center"
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center"
  },
  ghost: {
    backgroundColor: "rgba(133, 27, 34, 0.1)",
    borderRadius: 120,
    bottom: -18,
    height: 84,
    position: "absolute",
    right: -12,
    width: 84
  },
  pressed: {
    opacity: 0.88
  }
});
