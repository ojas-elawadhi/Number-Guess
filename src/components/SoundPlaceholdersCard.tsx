import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../utils/theme";

interface SoundPlaceholdersCardProps {
  enabled: boolean;
}

const placeholders = ["Countdown", "Guess Lock", "Result Reveal", "Victory", "Defeat"];

export function SoundPlaceholdersCard({ enabled }: SoundPlaceholdersCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Sound Placeholders</Text>
      <Text style={styles.subtitle}>
        {enabled
          ? "Audio hooks are marked out for future sound effects."
          : "Sound placeholders are muted for now."}
      </Text>
      <View style={styles.row}>
        {placeholders.map((label) => (
          <View key={label} style={styles.pill}>
            <Text style={styles.pillText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  pill: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  pillText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  }
});
