import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DifficultyOptionCard } from "../components/DifficultyOptionCard";
import { TopBar } from "../components/GameKit";
import { ScreenContainer } from "../components/ScreenContainer";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { Difficulty, OnlineMode } from "../types/game.types";
import { colors, spacing } from "../utils/theme";

const difficultyOrder: Difficulty[] = ["easy", "hard", "impossible"];

const parseMode = (value: string | string[] | undefined): OnlineMode => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  return normalizedValue === "duel" ? "duel" : "classic";
};

export default function VsAiDifficultyScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = parseMode(params.mode);
  const history = usePlayerProgressStore((state) => state.profile.history);
  const accent = mode === "classic" ? colors.ai : colors.success;
  const badgeLabel = mode === "classic" ? "AI Classic" : "AI Duel";

  const difficultyStats = useMemo(
    () =>
      difficultyOrder.reduce(
        (stats, difficulty) => {
          const matches = history
            .filter((match) => match.category === "vs-ai" && match.mode === mode && match.difficulty === difficulty)
            .reverse();
          let currentStreak = 0;
          let bestStreak = 0;

          matches.forEach((match) => {
            if (match.outcome === "win") {
              currentStreak += 1;
              bestStreak = Math.max(bestStreak, currentStreak);
              return;
            }

            currentStreak = 0;
          });

          stats[difficulty] = {
            bestStreak
          };

          return stats;
        },
        {} as Record<Difficulty, { bestStreak: number }>
      ),
    [history, mode]
  );

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <TopBar
        accent={accent}
        label={badgeLabel}
        onBack={() => router.back()}
        title="HIGHER LOWER"
        variant="header-only"
      />

      <View style={styles.badgeRow}>
        <View
          style={[
            styles.badge,
            { backgroundColor: `${accent}14`, borderColor: `${accent}32` }
          ]}
        >
          <Text style={[styles.badgeText, { color: accent }]}>{badgeLabel}</Text>
        </View>
      </View>

      <View style={styles.stack}>
        {difficultyOrder.map((currentDifficulty) => {
          const { bestStreak } = difficultyStats[currentDifficulty];

          return (
            <DifficultyOptionCard
              difficulty={currentDifficulty}
              highScore={bestStreak}
              key={currentDifficulty}
              scoreLabel="BEST"
              onPress={() => {
                router.push({
                  pathname: mode === "classic" ? "/vs-ai-classic" : "/vs-ai-duel",
                  params: { difficulty: currentDifficulty }
                });
              }}
            />
          );
        })}
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
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing.lg
  },
  badgeText: {
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
