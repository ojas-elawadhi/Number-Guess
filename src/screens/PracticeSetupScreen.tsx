import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { DifficultyOptionCard } from "../components/DifficultyOptionCard";
import { TopBar } from "../components/GameKit";
import { ScreenContainer } from "../components/ScreenContainer";
import type { Difficulty } from "../types/game.types";
import { colors, spacing } from "../utils/theme";

const difficultyOrder: Difficulty[] = ["easy", "hard", "impossible"];

export default function PracticeSetupScreen() {
  return (
    <ScreenContainer contentStyle={styles.screen}>
      <TopBar
        accent={colors.practice}
        label="Single Player"
        onBack={() => router.back()}
        title="HIGHER LOWER"
        variant="header-only"
      />

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Single Player</Text>
        </View>
      </View>

      <View style={styles.stack}>
        {difficultyOrder.map((currentDifficulty) => (
          <DifficultyOptionCard
            difficulty={currentDifficulty}
            key={currentDifficulty}
            onPress={() => {
              router.push({
                pathname: "/single-player-game",
                params: { difficulty: currentDifficulty }
              });
            }}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md
  },
  badgeRow: {
    alignItems: "center"
  },
  badge: {
    alignItems: "center",
    backgroundColor: "rgba(46, 204, 113, 0.08)",
    borderColor: "rgba(46, 204, 113, 0.22)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing.lg
  },
  badgeText: {
    color: colors.practice,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  stack: {
    flex: 1,
    gap: spacing.md,
    justifyContent: "center"
  }
});
