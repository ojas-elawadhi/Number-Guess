import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadows, spacing } from "../utils/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

const pastelFor = (accent: string) => {
  if (accent === colors.online) {
    return "#7fd6ff";
  }

  if (accent === colors.ai || accent === colors.higher) {
    return "#ffb39f";
  }

  return "#87f56c";
};

const darkFor = (accent: string) => {
  if (accent === colors.online) {
    return "#00476e";
  }

  if (accent === colors.ai || accent === colors.higher) {
    return "#851b22";
  }

  return "#005027";
};

interface TopBarProps {
  label: string;
  title: string;
  subtitle?: string;
  accent?: string;
  onBack?: () => void;
  variant?: "default" | "label-only" | "header-only";
}

export function TopBar({
  accent = colors.accent,
  label,
  onBack,
  subtitle,
  title,
  variant = "default"
}: TopBarProps) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topHeader}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}>
          <Ionicons color={colors.text} name="arrow-back" size={22} />
        </Pressable>
        <View style={styles.headerSpacer} />
      </View>

      {variant === "label-only" ? (
        <View style={[styles.labelOnlyBadge, { backgroundColor: `${accent}14`, borderColor: `${accent}32` }]}>
          <Text style={[styles.labelOnlyText, { color: accent }]}>{label}</Text>
        </View>
      ) : variant === "header-only" ? null : (
        <>
          <Text style={[styles.eyebrow, { color: accent }]}>{label}</Text>
          {title !== "HIGHER LOWER" ? <Text style={styles.screenTitle}>{title}</Text> : null}
          {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
        </>
      )}
      <View style={styles.headerRule} />
    </View>
  );
}

interface StatusPillProps {
  label: string;
  tone?: "neutral" | "accent" | "success" | "danger" | "online" | "ai";
}

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  const toneStyle =
    tone === "success"
      ? styles.pillSuccess
      : tone === "danger"
        ? styles.pillDanger
        : tone === "online"
          ? styles.pillOnline
          : tone === "ai"
            ? styles.pillAi
            : tone === "accent"
              ? styles.pillAccent
              : styles.pillNeutral;

  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

interface MiniCardProps {
  label: string;
  value: string | number;
  accent?: string;
  icon?: IconName;
}

export function MiniCard({ accent = colors.accent, icon, label, value }: MiniCardProps) {
  return (
    <View style={styles.miniCard}>
      {icon ? (
        <Ionicons color={accent} name={icon} size={18} />
      ) : null}
      <Text numberOfLines={1} style={[styles.miniValue, { color: accent }]}>{value}</Text>
      <Text numberOfLines={1} style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

interface ModeTileProps {
  title: string;
  subtitle: string;
  accent: string;
  icon: IconName;
  active?: boolean;
  compact?: boolean;
  onPress: () => void;
}

export function ModeTile({ accent, active = false, compact = false, onPress, subtitle, title }: ModeTileProps) {
  const backgroundColor = pastelFor(accent);
  const foregroundColor = darkFor(accent);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeTile,
        compact && styles.modeTileCompact,
        {
          backgroundColor,
          borderBottomColor: `${foregroundColor}1A`,
          borderBottomWidth: 6,
          borderColor: active ? foregroundColor : "transparent",
          borderWidth: active ? 2 : 0
        },
        pressed && styles.pressed
      ]}
    >
      <View style={styles.modeCopy}>
        <Text numberOfLines={1} style={[styles.modeTitle, compact && styles.modeTitleCompact, { color: foregroundColor }]}>
          {title}
        </Text>
        <Text numberOfLines={2} style={[styles.modeSubtitle, { color: foregroundColor }]}>
          {subtitle}
        </Text>
      </View>
      <View style={[styles.modeGhost, { backgroundColor: `${foregroundColor}1A` }]} />
    </Pressable>
  );
}

interface FeedbackBadgeProps {
  result: "higher" | "lower" | "correct" | "missed" | null;
  title?: string;
  detail?: string;
  compact?: boolean;
}

export function FeedbackBadge({ compact = false, detail, result, title }: FeedbackBadgeProps) {
  const meta =
    result === "higher"
      ? { color: colors.higher, icon: "arrow-up" as const, label: "HIGHER" }
      : result === "lower"
        ? { color: colors.lower, icon: "arrow-down" as const, label: "LOWER" }
        : result === "correct"
          ? { color: colors.correct, icon: "checkmark" as const, label: "CORRECT" }
          : result === "missed"
            ? { color: colors.surfaceMuted, icon: "remove" as const, label: "MISSED" }
            : { color: colors.surfaceMuted, icon: "remove" as const, label: title ?? "READY" };

  return (
    <View style={[styles.feedbackBadge, compact && styles.feedbackBadgeCompact, { backgroundColor: meta.color }]}>
      <Text style={[styles.feedbackLabel, compact && styles.feedbackLabelCompact, { color: darkFor(meta.color) }]}>{title ?? meta.label}</Text>
      {detail ? (
        <Text numberOfLines={compact ? 2 : 1} style={[styles.feedbackDetail, compact && styles.feedbackDetailCompact, { color: darkFor(meta.color) }]}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

interface NumberPadProps {
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  loading?: boolean;
  submitLabel?: string;
  title?: string;
  helper?: string;
  accent?: string;
  compact?: boolean;
}

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function NumberPad({
  accent = colors.accent,
  compact = false,
  disabled = false,
  helper,
  loading = false,
  maxLength,
  onChange,
  onSubmit,
  submitLabel = "GUESS",
  title = "Your guess",
  value
}: NumberPadProps) {
  const appendDigit = (digit: string) => {
    if (disabled || value.length >= maxLength) {
      return;
    }

    onChange(`${value}${digit}`);
  };

  const removeDigit = () => {
    if (disabled) {
      return;
    }

    onChange(value.slice(0, -1));
  };

  return (
    <View style={[styles.numpad, compact && styles.numpadCompact]}>
      <View style={[styles.inputWrap, compact && styles.inputWrapCompact]}>
        {helper ? <Text style={[styles.inputHelper, compact && styles.inputHelperCompact]}>{helper}</Text> : null}
        <View style={[styles.inputPanel, compact && styles.inputPanelCompact, { borderColor: accent }]}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.inputValue, compact && styles.inputValueCompact]}>
            {value.length > 0 ? value : "--"}
          </Text>
        </View>
        <Text style={[styles.inputTitle, compact && styles.inputTitleCompact]}>{title}</Text>
      </View>

      <View style={[styles.keyGrid, compact && styles.keyGridCompact]}>
        {keys.map((key) => (
          <Pressable
            disabled={disabled}
            key={key}
            onPress={() => appendDigit(key)}
            style={({ pressed }) => [styles.key, compact && styles.keyCompact, pressed && !disabled && styles.keyPressed, disabled && styles.keyDisabled]}
          >
            <Text style={[styles.keyText, compact && styles.keyTextCompact]}>{key}</Text>
          </Pressable>
        ))}

        <Pressable
          disabled={disabled}
          onPress={removeDigit}
          style={({ pressed }) => [styles.key, compact && styles.keyCompact, styles.utilityKey, pressed && !disabled && styles.keyPressed, disabled && styles.keyDisabled]}
        >
          <Ionicons color={colors.textMuted} name="backspace-outline" size={compact ? 24 : 30} />
        </Pressable>

        <Pressable
          disabled={disabled}
          onPress={() => appendDigit("0")}
          style={({ pressed }) => [styles.key, compact && styles.keyCompact, pressed && !disabled && styles.keyPressed, disabled && styles.keyDisabled]}
        >
          <Text style={[styles.keyText, compact && styles.keyTextCompact]}>0</Text>
        </Pressable>

        <Pressable
          disabled={disabled || loading}
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.key,
            compact && styles.keyCompact,
            styles.enterKey,
            { backgroundColor: accent },
            pressed && !disabled && styles.keyPressed,
            (disabled || loading) && styles.keyDisabled
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Ionicons color="#ffffff" name="checkmark" size={compact ? 24 : 30} />
          )}
        </Pressable>
      </View>

      <Pressable
        disabled={disabled || loading}
        onPress={onSubmit}
        style={({ pressed }) => [
          styles.submitBar,
          compact && styles.submitBarCompact,
          { backgroundColor: darkFor(accent) },
          pressed && !disabled && styles.pressed,
          (disabled || loading) && styles.keyDisabled
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={[styles.submitText, compact && styles.submitTextCompact]}>{submitLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

interface HistoryStripProps {
  title: string;
  emptyLabel: string;
  items: { id: string; primary: string; tone?: "higher" | "lower" | "correct" | "missed"; meta?: string }[];
  compact?: boolean;
}

export function HistoryStrip({ compact = false, emptyLabel, items, title }: HistoryStripProps) {
  return (
    <View style={[styles.historyStrip, compact && styles.historyStripCompact]}>
      <Text style={[styles.historyTitle, compact && styles.historyTitleCompact]}>{title}</Text>
      {items.length === 0 ? (
        <Text style={[styles.emptyText, compact && styles.emptyTextCompact]}>{emptyLabel}</Text>
      ) : (
        <View style={[styles.historyRow, compact && styles.historyRowCompact]}>
          {items.slice(0, 4).map((item) => {
            const toneColor =
              item.tone === "higher"
                ? darkFor(colors.higher)
                : item.tone === "lower"
                  ? darkFor(colors.lower)
                  : item.tone === "correct"
                    ? darkFor(colors.correct)
                    : colors.textMuted;

            return (
              <View key={item.id} style={[styles.historyChip, compact && styles.historyChipCompact]}>
                <Text numberOfLines={1} style={[styles.historyPrimary, compact && styles.historyPrimaryCompact]}>{item.primary}</Text>
                <Text numberOfLines={1} style={[styles.historyMeta, compact && styles.historyMetaCompact, { color: toneColor }]}>{item.meta ?? item.tone ?? ""}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

interface BottomTabsProps {
  activeTab: "play" | "stats" | "profile" | "settings";
  onChange: (tab: "play" | "stats" | "profile" | "settings") => void;
}

export function BottomTabs({ activeTab, onChange }: BottomTabsProps) {
  return (
    <View style={styles.bottomTabs}>
      <Pressable onPress={() => onChange("play")} style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}>
        <Ionicons color={activeTab === "play" ? colors.practice : colors.tab} name="game-controller-outline" size={22} />
        <Text style={[styles.tabLabel, activeTab === "play" && styles.tabLabelActive]}>Play</Text>
      </Pressable>
      <Pressable onPress={() => onChange("stats")} style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}>
        <Ionicons color={activeTab === "stats" ? colors.practice : colors.tab} name="stats-chart-outline" size={22} />
        <Text style={[styles.tabLabel, activeTab === "stats" && styles.tabLabelActive]}>Stats</Text>
      </Pressable>
      <Pressable onPress={() => onChange("profile")} style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}>
        <Ionicons color={activeTab === "profile" ? colors.practice : colors.tab} name="person-outline" size={22} />
        <Text style={[styles.tabLabel, activeTab === "profile" && styles.tabLabelActive]}>Profile</Text>
      </Pressable>
      <Pressable onPress={() => onChange("settings")} style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}>
        <Ionicons color={activeTab === "settings" ? colors.practice : colors.tab} name="settings-outline" size={22} />
        <Text style={[styles.tabLabel, activeTab === "settings" && styles.tabLabelActive]}>Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    gap: spacing.xs
  },
  topHeader: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 36
  },
  headerIcon: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36
  },
  headerSpacer: {
    flex: 1
  },
  eyebrow: {
    alignSelf: "center",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  labelOnlyBadge: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing.md
  },
  labelOnlyText: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  screenTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38
  },
  screenSubtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 22
  },
  headerRule: {
    backgroundColor: colors.surfaceMuted,
    height: 6,
    marginHorizontal: -spacing.md
  },
  pill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    ...shadows.card
  },
  pillNeutral: {
    borderColor: colors.surfaceMuted
  },
  pillAccent: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderStrong
  },
  pillSuccess: {
    backgroundColor: colors.practice,
    borderColor: darkFor(colors.practice)
  },
  pillDanger: {
    backgroundColor: colors.higher,
    borderColor: darkFor(colors.higher)
  },
  pillOnline: {
    backgroundColor: colors.online,
    borderColor: darkFor(colors.online)
  },
  pillAi: {
    backgroundColor: colors.ai,
    borderColor: darkFor(colors.ai)
  },
  pillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  miniCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    justifyContent: "center",
    minHeight: 94,
    padding: spacing.sm
  },
  miniValue: {
    fontSize: 26,
    fontWeight: "900"
  },
  miniLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  modeTile: {
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 76,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: "relative",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 7
  },
  modeTileCompact: {
    minHeight: 64,
    paddingHorizontal: spacing.sm
  },
  modeCopy: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.lg,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1
  },
  modeTitle: {
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32,
    textAlign: "center"
  },
  modeTitleCompact: {
    fontSize: 19,
    lineHeight: 22
  },
  modeSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
    textAlign: "center"
  },
  modeGhost: {
    borderRadius: 120,
    bottom: -18,
    height: 84,
    position: "absolute",
    right: -12,
    width: 84
  },
  feedbackBadge: {
    alignItems: "center",
    borderRadius: radii.pill,
    gap: 2,
    minHeight: 108,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    ...shadows.tactile
  },
  feedbackBadgeCompact: {
    gap: 4,
    minHeight: 82,
    paddingHorizontal: spacing.sm
  },
  feedbackLabel: {
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 1
  },
  feedbackLabelCompact: {
    fontSize: 28,
    lineHeight: 30
  },
  feedbackDetail: {
    fontSize: 14,
    fontWeight: "800"
  },
  feedbackDetailCompact: {
    fontSize: 12,
    textAlign: "center"
  },
  numpad: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceMuted,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: "auto",
    padding: spacing.sm,
    ...shadows.card
  },
  numpadCompact: {
    gap: spacing.xs,
    padding: spacing.xs
  },
  inputWrap: {
    alignItems: "center",
    gap: spacing.xs
  },
  inputWrapCompact: {
    gap: 4
  },
  inputHelper: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700"
  },
  inputHelperCompact: {
    fontSize: 12,
    textAlign: "center"
  },
  inputPanel: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 6,
    height: 124,
    justifyContent: "center",
    width: "82%"
  },
  inputPanelCompact: {
    borderWidth: 4,
    height: 86,
    width: "74%"
  },
  inputValue: {
    color: colors.text,
    fontSize: 68,
    fontWeight: "900",
    maxWidth: "88%"
  },
  inputValueCompact: {
    fontSize: 48
  },
  inputTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800"
  },
  inputTitleCompact: {
    fontSize: 12
  },
  keyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  keyGridCompact: {
    gap: spacing.xs
  },
  key: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flexBasis: "30.5%",
    flexGrow: 1,
    height: 86,
    justifyContent: "center",
    ...shadows.card
  },
  keyCompact: {
    height: 62
  },
  utilityKey: {
    backgroundColor: colors.surfaceMuted
  },
  enterKey: {
    backgroundColor: colors.accent
  },
  keyPressed: {
    transform: [{ translateY: 2 }]
  },
  keyDisabled: {
    opacity: 0.45
  },
  keyText: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800"
  },
  keyTextCompact: {
    fontSize: 26
  },
  submitBar: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 74,
    justifyContent: "center",
    ...shadows.tactile
  },
  submitBarCompact: {
    height: 58
  },
  submitText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1
  },
  submitTextCompact: {
    fontSize: 22
  },
  historyStrip: {
    backgroundColor: "transparent",
    gap: spacing.xs
  },
  historyStripCompact: {
    gap: 6
  },
  historyTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  historyTitleCompact: {
    fontSize: 12
  },
  historyRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  historyRowCompact: {
    gap: 6
  },
  historyChip: {
    alignItems: "center",
    flex: 1,
    minHeight: 42,
    justifyContent: "center"
  },
  historyChipCompact: {
    minHeight: 34
  },
  historyPrimary: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "800"
  },
  historyPrimaryCompact: {
    fontSize: 14
  },
  historyMeta: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  historyMetaCompact: {
    fontSize: 10
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  emptyTextCompact: {
    fontSize: 11
  },
  bottomTabs: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    ...shadows.card
  },
  tabItem: {
    alignItems: "center",
    flex: 1,
    gap: 4
  },
  tabLabel: {
    color: colors.tab,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  tabLabelActive: {
    color: colors.practice
  },
  pressed: {
    opacity: 0.88
  }
});
