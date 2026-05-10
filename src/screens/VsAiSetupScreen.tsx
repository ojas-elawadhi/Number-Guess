import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ModeTile, TopBar } from "../components/GameKit";
import { ScreenContainer } from "../components/ScreenContainer";
import { colors, spacing } from "../utils/theme";

type RuleMode = "classic" | "duel";

export default function VsAiSetupScreen() {
  return (
    <ScreenContainer contentStyle={styles.screen}>
      <TopBar
        accent={colors.ai}
        label="VS AI"
        onBack={() => router.back()}
        title="HIGHER LOWER"
        variant="header-only"
      />

      <View style={styles.badgeRow}>
        <View style={[styles.badge, styles.aiBadge]}>
          <Text style={[styles.badgeText, styles.aiBadgeText]}>VS AI</Text>
        </View>
      </View>

      <View style={styles.stack}>
        <ModeTile
          accent={colors.practice}
          icon="timer-outline"
          onPress={() => {
            router.push({
              pathname: "/vs-ai-difficulty",
              params: { mode: "classic" satisfies RuleMode }
            });
          }}
          subtitle="Race to the hidden number"
          title="Classic Race"
        />
        <ModeTile
          accent={colors.ai}
          icon="bulb-outline"
          onPress={() => {
            router.push({
              pathname: "/vs-ai-difficulty",
              params: { mode: "duel" satisfies RuleMode }
            });
          }}
          subtitle="Guess each other's secret"
          title="Strategic Duel"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md
  },
  badgeRow: {
    alignItems: "center"
  },
  badge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing.lg
  },
  aiBadge: {
    backgroundColor: "rgba(255, 149, 146, 0.1)",
    borderColor: "rgba(255, 149, 146, 0.24)"
  },
  badgeText: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  aiBadgeText: {
    color: colors.ai
  },
  stack: {
    flex: 1,
    gap: spacing.md,
    justifyContent: "center"
  }
});
