import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AiOpponentCard } from "../components/AiOpponentCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenContainer } from "../components/ScreenContainer";
import type { Difficulty, OnlineMode } from "../types/game.types";
import { colors, spacing } from "../utils/theme";
import { DEFAULT_DIFFICULTY, DIFFICULTY_CONFIG, getDifficultyRangeLabel } from "../../shared/difficulty";

const difficultyOrder: Difficulty[] = ["easy", "hard", "impossible"];

const parseMode = (value: string | string[] | undefined): OnlineMode => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  return normalizedValue === "duel" ? "duel" : "classic";
};

export default function VsAiDifficultyScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = parseMode(params.mode);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backLink, pressed && styles.backLinkPressed]}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>VS AI</Text>
        <Text style={styles.title}>Choose Difficulty</Text>
        <Text style={styles.subtitle}>
          {mode === "classic"
            ? "Pick the size of the shared number range before you race the AI."
            : "Pick the number range before you and the AI start hiding and guessing secret numbers."}
        </Text>
      </View>

      <AiOpponentCard
        accentColor={mode === "classic" ? colors.accent : colors.success}
        name={mode === "classic" ? "Nova Lynx" : "Cipher Fox"}
        personality={
          mode === "classic"
            ? "Reads shared-target patterns quickly, but only sees the same high or low clues you do."
            : "Plays the long game by narrowing your secret range one guess at a time."
        }
        title={mode === "classic" ? "Classic Rival" : "Duel Rival"}
      />

      <View style={styles.card}>
        <View style={styles.modeRow}>
          {difficultyOrder.map((currentDifficulty) => (
            <Pressable
              key={currentDifficulty}
              onPress={() => setDifficulty(currentDifficulty)}
              style={({ pressed }) => [
                styles.modeCard,
                difficulty === currentDifficulty && styles.modeCardActive,
                pressed && styles.modeCardPressed
              ]}
            >
              <Text style={styles.modeTitle}>{DIFFICULTY_CONFIG[currentDifficulty].label}</Text>
              <Text style={styles.modeText}>Range {getDifficultyRangeLabel(currentDifficulty)}</Text>
            </Pressable>
          ))}
        </View>

        <PrimaryButton
          label={mode === "classic" ? `Play AI Classic ${DIFFICULTY_CONFIG[difficulty].label}` : `Play AI Duel ${DIFFICULTY_CONFIG[difficulty].label}`}
          onPress={() => {
            router.push({
              pathname: mode === "classic" ? "/vs-ai-classic" : "/vs-ai-duel",
              params: { difficulty }
            });
          }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backLink: {
    alignSelf: "flex-start",
    marginTop: spacing.md
  },
  backLinkPressed: {
    opacity: 0.8
  },
  backText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  hero: {
    gap: spacing.sm
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md
  },
  modeRow: {
    gap: spacing.sm
  },
  modeCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.xs
  },
  modeCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surface
  },
  modeCardPressed: {
    opacity: 0.9
  },
  modeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  modeText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  }
});
