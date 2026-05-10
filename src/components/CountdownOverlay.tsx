import { Animated, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadows, spacing } from "../utils/theme";

interface CountdownOverlayProps {
  label?: string;
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
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={[styles.valueWrap, !label && styles.valueWrapSolo]}>
          <Text style={[styles.value, value === "GO" && styles.valueGo]}>{value}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    bottom: -spacing.md,
    justifyContent: "center",
    left: -spacing.md,
    padding: spacing.lg,
    position: "absolute",
    right: -spacing.md,
    top: -spacing.md,
    zIndex: 50
  },
  card: {
    alignItems: "center",
    backgroundColor: "transparent",
    minWidth: 190,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg
  },
  label: {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  valueWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 88,
    minWidth: 120
  },
  valueWrapSolo: {
    minHeight: 108,
    minWidth: 132
  },
  value: {
    color: "#ffffff",
    fontSize: 68,
    fontWeight: "900",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.28)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8
  },
  valueGo: {
    color: "#ffffff",
    fontSize: 62
  }
});
