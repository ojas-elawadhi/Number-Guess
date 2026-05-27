import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { ConfettiBurst } from "./ConfettiBurst";
import { radii, spacing } from "../utils/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

interface VsAiWinModalProps {
  actionLabel: string;
  accentColor?: string;
  buttonColor?: string;
  buttonShadowColor?: string;
  cardBackgroundColor?: string;
  detailColor?: string;
  detail?: string | null;
  iconColor?: string;
  iconName?: IconName;
  iconRingColor?: string;
  message: string;
  messageColor?: string;
  onAction: () => void;
  onSecondaryAction: () => void;
  secondaryAccentColor?: string;
  secondaryActionLabel: string;
  showConfetti?: boolean;
  title?: string;
  titleColor?: string;
  visible: boolean;
}

export function VsAiWinModal({
  actionLabel,
  accentColor = "#1fc46d",
  buttonColor = "#047a37",
  buttonShadowColor = "#025a29",
  cardBackgroundColor = "#eafff3",
  detailColor = "#4f8a6b",
  detail,
  iconColor = "#eafff3",
  iconName = "checkmark",
  iconRingColor = "#0f9b52",
  message,
  messageColor = "#1f5d3c",
  onAction,
  onSecondaryAction,
  secondaryAccentColor = "#0f9b52",
  secondaryActionLabel,
  showConfetti = true,
  title = "YOU WIN",
  titleColor = "#15181b",
  visible
}: VsAiWinModalProps) {
  return (
    <Modal animationType="fade" statusBarTranslucent transparent visible={visible}>
      <View style={styles.overlay}>
        <ConfettiBurst visible={visible && showConfetti} />
        <View style={[styles.card, { backgroundColor: cardBackgroundColor, borderColor: accentColor }]}>
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          <View style={[styles.iconWrap, { backgroundColor: accentColor, borderColor: iconRingColor }]}>
            <Ionicons color={iconColor} name={iconName} size={48} />
          </View>
          <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
          {detail ? <Text style={[styles.detail, { color: detailColor }]}>{detail}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onAction}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: buttonColor, borderBottomColor: buttonShadowColor },
                pressed && styles.buttonPressed
              ]}
            >
              <Text style={styles.buttonText}>{actionLabel}</Text>
            </Pressable>

            <Pressable
              onPress={onSecondaryAction}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderBottomColor: `${secondaryAccentColor}55`, borderColor: accentColor },
                pressed && styles.buttonPressed
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: secondaryAccentColor }]}>{secondaryActionLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(12, 16, 22, 0.78)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  card: {
    backgroundColor: "#eafff3",
    borderColor: "#1fc46d",
    borderRadius: 30,
    borderWidth: 6,
    gap: spacing.sm,
    maxWidth: 420,
    padding: spacing.lg,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
    width: "100%"
  },
  title: {
    color: "#15181b",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1.2,
    textAlign: "center"
  },
  iconWrap: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#1fc46d",
    borderColor: "#0f9b52",
    borderRadius: 42,
    borderWidth: 6,
    height: 84,
    justifyContent: "center",
    width: 84
  },
  message: {
    color: "#1f5d3c",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 26,
    textAlign: "center"
  },
  detail: {
    color: "#4f8a6b",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "center"
  },
  actions: {
    gap: spacing.sm
  },
  button: {
    alignItems: "center",
    backgroundColor: "#047a37",
    borderBottomColor: "#025a29",
    borderBottomWidth: 7,
    borderRadius: 28,
    justifyContent: "center",
    minHeight: 56
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }]
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#bdebd0",
    borderBottomWidth: 5,
    borderColor: "#1fc46d",
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 54
  },
  secondaryButtonText: {
    color: "#0f9b52",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.8
  }
});
