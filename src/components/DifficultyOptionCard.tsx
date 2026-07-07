import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Difficulty } from "../types/game.types";
import { colors, radii, spacing } from "../utils/theme";
import { DIFFICULTY_CONFIG, getDifficultyRangeLabel } from "../../shared/difficulty";
import { playButtonSound } from "../services/soundEffects";

interface DifficultyOptionCardProps {
  difficulty: Difficulty;
  highScore?: number;
  scoreLabel?: string;
  scoreMeta?: string;
  onPress: () => void;
}

export function DifficultyOptionCard({ difficulty, highScore, onPress, scoreLabel = "BEST", scoreMeta }: DifficultyOptionCardProps) {
  const handlePress = () => {
    playButtonSound();
    onPress();
  };
  const bestRound = highScore ?? 0;
  const theme =
    difficulty === "easy"
      ? {
          backgroundColor: "#87f56c",
          textColor: "#005027",
          edgeColor: "rgba(0, 80, 39, 0.1)",
          ghostColor: "rgba(0, 80, 39, 0.1)",
          scoreAccent: "#58d83c"
        }
      : difficulty === "hard"
        ? {
            backgroundColor: "#7fd6ff",
            textColor: "#00476e",
            edgeColor: "rgba(0, 71, 110, 0.1)",
            ghostColor: "rgba(0, 71, 110, 0.1)",
            scoreAccent: "#4cb6ea"
          }
        : {
            backgroundColor: "#ffb39f",
            textColor: "#7f1e28",
            edgeColor: "rgba(133, 27, 34, 0.1)",
            ghostColor: "rgba(133, 27, 34, 0.1)",
            scoreAccent: "#f09d89"
          };

  return (
    <Pressable
      onPress={handlePress}
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
      <View style={styles.scoreWrap}>
        <View style={styles.scoreInner}>
          <View style={styles.scoreTop}>
            <Text style={[styles.scoreLabel, { color: theme.scoreAccent }]}>{scoreLabel}</Text>
          </View>
          <View style={[styles.scoreBottom, { borderTopColor: theme.scoreAccent }]}>
            <Text style={[styles.scoreValue, { color: theme.scoreAccent }]}>{bestRound}</Text>
          </View>
          {scoreMeta ? <Text style={[styles.scoreMeta, { color: theme.textColor }]}>{scoreMeta}</Text> : null}
        </View>
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
    justifyContent: "center",
    minHeight: 76,
    overflow: "hidden",
    paddingHorizontal: spacing.xl,
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
    bottom: 0,
    justifyContent: "center",
    left: 0,
    paddingLeft: 70,
    paddingRight: 70,
    position: "absolute",
    right: 0,
    top: 0,
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
  scoreWrap: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 6,
    top: 5,
    width: 58,
    zIndex: 1
  },
  scoreInner: {
    alignItems: "center"
  },
  scoreTop: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    justifyContent: "center",
    minHeight: 15,
    paddingHorizontal: 5,
    paddingTop: 1,
    width: 44
  },
  scoreBottom: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderTopWidth: 1.5,
    justifyContent: "center",
    minHeight: 24,
    width: 44
  },
  scoreLabel: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.4
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20
  },
  scoreMeta: {
    fontSize: 8,
    fontWeight: "900",
    marginTop: 2,
    textAlign: "center",
    textTransform: "uppercase"
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
