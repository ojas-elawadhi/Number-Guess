import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { DailyPrizeEntry } from "../utils/dailyPuzzle";
import { colors, radii, shadows, spacing } from "../utils/theme";
import { CoinIcon } from "./CoinIcon";

interface DailyPrizeModalProps {
  entries: DailyPrizeEntry[];
  onClose: () => void;
  visible: boolean;
}

export function DailyPrizeModal({ entries, onClose, visible }: DailyPrizeModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Close prize details" onPress={onClose} style={StyleSheet.absoluteFill} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <CoinIcon size={22} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Daily prizes</Text>
              <Text style={styles.title}>Rank rewards</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Ionicons color={colors.textMuted} name="close" size={18} />
            </Pressable>
          </View>

          <Text style={styles.body}>Fewest guesses ranks higher. Prizes finalize at UTC midnight.</Text>

          <ScrollView contentContainerStyle={styles.prizeList} style={styles.prizeScroll}>
            {entries.map((entry) => (
              <View key={entry.rank} style={styles.prizeRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{entry.rank}</Text>
                </View>
                <Text style={styles.prizeLabel}>Rank {entry.rank}</Text>
                <View style={styles.coinAmount}>
                  <CoinIcon size={14} />
                  <Text style={styles.coinText}>{entry.coins.toLocaleString("en-US")}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(18, 22, 24, 0.34)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  sheet: {
    backgroundColor: colors.surface,
    borderColor: "#e4e9e6",
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.sm,
    maxWidth: 360,
    padding: spacing.md,
    width: "100%",
    ...shadows.card
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: "#fff6df",
    borderColor: "#f2d17f",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  headerCopy: {
    flex: 1,
    minWidth: 0
  },
  eyebrow: {
    color: "#8a5a00",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  body: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  prizeScroll: {
    maxHeight: 260
  },
  prizeList: {
    gap: 7
  },
  prizeRow: {
    alignItems: "center",
    backgroundColor: "#fffdf8",
    borderColor: "#eee6d3",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 8
  },
  rankBadge: {
    alignItems: "center",
    backgroundColor: "#fff6df",
    borderColor: "#f2d17f",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 44
  },
  rankText: {
    color: "#8a5a00",
    fontSize: 12,
    fontWeight: "900"
  },
  prizeLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "900"
  },
  coinAmount: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4
  },
  coinText: {
    color: "#8a5a00",
    fontSize: 13,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.82
  }
});
