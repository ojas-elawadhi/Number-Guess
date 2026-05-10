import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, radii, shadows, spacing } from "../utils/theme";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "success";
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary"
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondaryButton,
        variant === "ghost" && styles.ghostButton,
        variant === "success" && styles.successButton,
        variant === "primary" && styles.primaryButton,
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressedButton
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" || variant === "ghost" ? colors.accent : "#ffffff"} />
      ) : (
        <Text style={[styles.label, (variant === "secondary" || variant === "ghost") && styles.secondaryLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 72,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    ...shadows.tactile
  },
  primaryButton: {
    backgroundColor: colors.darkSurface
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    shadowOpacity: 0.06
  },
  ghostButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    shadowOpacity: 0
  },
  successButton: {
    backgroundColor: colors.accent
  },
  disabledButton: {
    opacity: 0.55
  },
  pressedButton: {
    transform: [{ scale: 0.98 }]
  },
  label: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1
  },
  secondaryLabel: {
    color: colors.text
  }
});

