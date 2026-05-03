import { Animated, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../utils/theme";

interface CountdownOverlayProps {
  label: string;
  value: string | number;
  opacity: Animated.Value;
  scale: Animated.Value;
}

export function CountdownOverlay({
  label,
  value,
  opacity,
  scale
}: CountdownOverlayProps) {
  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(8, 17, 31, 0.78)",
    justifyContent: "center",
    padding: spacing.lg,
    zIndex: 50
  },
  card: {
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.accent,
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.sm,
    minWidth: 220,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  value: {
    color: colors.text,
    fontSize: 56,
    fontWeight: "900"
  }
});
