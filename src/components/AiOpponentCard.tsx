import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../utils/theme";

interface AiOpponentCardProps {
  name: string;
  title: string;
  personality: string;
  accentColor?: string;
}

export function AiOpponentCard({
  name,
  title,
  personality,
  accentColor = colors.accent
}: AiOpponentCardProps) {
  const initials = name
    .split(" ")
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return (
    <View style={styles.card}>
      <View style={[styles.avatar, { borderColor: accentColor }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.personality}>{personality}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  avatarText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  body: {
    flex: 1,
    gap: 2
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  title: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  personality: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  }
});
