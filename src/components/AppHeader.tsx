import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getDayFromDateKey, getShortMonthLabel } from "../utils/dailyPuzzle";
import { colors, radii, shadows, spacing } from "../utils/theme";

export const APP_HEADER_CONTENT_HEIGHT = 72;
export const APP_HEADER_SEPARATOR_HEIGHT = 4;
export const APP_HEADER_HEIGHT = APP_HEADER_CONTENT_HEIGHT + APP_HEADER_SEPARATOR_HEIGHT;

const HEADER_SIDE_WIDTH = 60;

interface AppHeaderProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

export function AppHeader({ center, left, right }: AppHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        <View style={[styles.sideSlot, styles.leftSlot]}>{left}</View>
        <View pointerEvents="box-none" style={styles.centerSlot}>
          {center}
        </View>
        <View style={[styles.sideSlot, styles.rightSlot]}>{right}</View>
      </View>
      <View pointerEvents="none" style={styles.separator} />
    </View>
  );
}

interface HeaderBackButtonProps {
  onPress?: () => void;
}

export function HeaderBackButton({ onPress }: HeaderBackButtonProps) {
  return (
    <Pressable hitSlop={10} onPress={onPress} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <Ionicons color={colors.text} name="arrow-back" size={22} />
    </Pressable>
  );
}

interface HeaderCoinsPillProps {
  coins: number;
}

export function HeaderCoinsPill({ coins }: HeaderCoinsPillProps) {
  return (
    <View style={styles.coinPill}>
      <View style={styles.coinBadge}>
        <View style={styles.coinBadgeInner}>
          <Ionicons color="#ffd85a" name="star" size={12} />
        </View>
      </View>

      <View style={styles.coinValueWrap}>
        <Text style={styles.coinPillText}>{coins.toLocaleString("en-US")}</Text>
      </View>

      <View style={styles.coinPlusBadge}>
        <Ionicons color="#ffffff" name="add" size={16} />
      </View>
    </View>
  );
}

interface HeaderScorePillProps {
  score: number;
}

export function HeaderScorePill({ score }: HeaderScorePillProps) {
  return (
    <View style={styles.scorePill}>
      <Text style={styles.scorePillLabel}>SCORE</Text>
      <Text style={styles.scorePillValue}>{score}</Text>
    </View>
  );
}

interface HeaderDateBadgeProps {
  dateKey: string;
}

export function HeaderDateBadge({ dateKey }: HeaderDateBadgeProps) {
  return (
    <View style={styles.dateWrap}>
      <View style={styles.dateInner}>
        <View style={styles.dateTop}>
          <View style={styles.dateRingLeft} />
          <View style={styles.dateRingRight} />
          <Text style={styles.dateMonth}>{getShortMonthLabel(dateKey).toUpperCase()}</Text>
        </View>
        <View style={styles.dateBottom}>
          <Text style={styles.dateDay}>{getDayFromDateKey(dateKey)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minHeight: APP_HEADER_HEIGHT,
    overflow: "visible",
    position: "relative"
  },
  bar: {
    justifyContent: "center",
    minHeight: APP_HEADER_CONTENT_HEIGHT,
    overflow: "visible",
    position: "relative",
    zIndex: 1
  },
  sideSlot: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    minHeight: APP_HEADER_CONTENT_HEIGHT,
    position: "absolute",
    top: 0,
    width: HEADER_SIDE_WIDTH,
    zIndex: 2
  },
  leftSlot: {
    left: 0
  },
  rightSlot: {
    right: 0
  },
  centerSlot: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: HEADER_SIDE_WIDTH,
    overflow: "visible",
    position: "absolute",
    right: HEADER_SIDE_WIDTH,
    top: 0
  },
  separator: {
    backgroundColor: colors.surfaceMuted,
    bottom: 0,
    height: APP_HEADER_SEPARATOR_HEIGHT,
    left: -spacing.md,
    position: "absolute",
    right: -spacing.md,
    zIndex: 0
  },
  backButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40
  },
  coinPill: {
    alignItems: "center",
    backgroundColor: "#e6e4e4",
    borderColor: "#d6dce2",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 30,
    minWidth: 104,
    paddingRight: 4,
    ...shadows.card
  },
  coinBadge: {
    alignItems: "center",
    backgroundColor: "#ffcf4f",
    borderColor: "#d89c16",
    borderRadius: radii.pill,
    borderBottomWidth: 2,
    height: 30,
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    width: 30
  },
  coinBadgeInner: {
    alignItems: "center",
    backgroundColor: "#f4b631",
    borderRadius: radii.pill,
    height: 16,
    justifyContent: "center",
    width: 16
  },
  coinValueWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minWidth: 0
  },
  coinPillText: {
    color: "#606367",
    fontSize: 13,
    fontWeight: "900"
  },
  coinPlusBadge: {
    alignItems: "center",
    backgroundColor: "#68cb35",
    borderColor: "#3d9620",
    borderRadius: radii.pill,
    borderBottomWidth: 2,
    height: 24,
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    width: 24
  },
  scorePill: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8dde2",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.md,
    ...shadows.card
  },
  scorePillLabel: {
    color: "#66717a",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8
  },
  scorePillValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  dateWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    width: 58
  },
  dateInner: {
    alignItems: "center"
  },
  dateTop: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    justifyContent: "center",
    minHeight: 15,
    paddingHorizontal: 5,
    paddingTop: 1,
    position: "relative",
    width: 44
  },
  dateRingLeft: {
    backgroundColor: "#ffffff",
    borderRadius: radii.pill,
    height: 7,
    left: 8,
    position: "absolute",
    top: -3,
    width: 5
  },
  dateRingRight: {
    backgroundColor: "#ffffff",
    borderRadius: radii.pill,
    height: 7,
    position: "absolute",
    right: 8,
    top: -3,
    width: 5
  },
  dateBottom: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderTopColor: "#f0b13a",
    borderTopWidth: 1.5,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    justifyContent: "center",
    minHeight: 24,
    width: 44
  },
  dateMonth: {
    color: "#f0a500",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  dateDay: {
    color: "#f0a500",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20
  },
  pressed: {
    opacity: 0.82
  }
});
