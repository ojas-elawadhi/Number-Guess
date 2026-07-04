import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTutorialStore } from "../store/useTutorialStore";
import { playButtonSound } from "../services/soundEffects";
import { sendTutorialEvent } from "../utils/tutorialAnalytics";
import { colors, radii, shadows, spacing } from "../utils/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

interface CalloutStep {
  accent: string;
  description: string;
  icon: IconName;
  title: string;
}

const calloutSteps: CalloutStep[] = [
  {
    accent: colors.practice,
    description: "Endless solo runs. Clear rounds, chase your best score.",
    icon: "game-controller",
    title: "SINGLE PLAYER"
  },
  {
    accent: colors.ai,
    description: "Race an AI rival to guess the secret number first.",
    icon: "hardware-chip",
    title: "VS AI"
  },
  {
    accent: colors.online,
    description: "Create a room and race up to 6 real players — fastest guess wins!",
    icon: "globe",
    title: "ONLINE"
  },
  {
    accent: colors.accent,
    description: "One secret number a day, one shot at the daily leaderboard. Come back tomorrow for a new one!",
    icon: "calendar",
    title: "DAILY PUZZLE"
  }
];

export function HomeTutorialCallouts() {
  const phase = useTutorialStore((state) => state.phase);
  const calloutStep = useTutorialStore((state) => state.calloutStep);
  const setCalloutStep = useTutorialStore((state) => state.setCalloutStep);
  const setPhase = useTutorialStore((state) => state.setPhase);
  const isReplay = useTutorialStore((state) => state.replayMode);

  if (phase !== "callouts") {
    return null;
  }

  const stepIndex = Math.min(calloutStep, calloutSteps.length - 1);
  const step = calloutSteps[stepIndex];
  const isLastStep = stepIndex === calloutSteps.length - 1;

  const endTour = (event: "callouts_done" | "callouts_skipped") => {
    if (!isReplay) {
      sendTutorialEvent(event);
    }

    setPhase("done");
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.scrim} />
      <View style={[styles.card, { borderColor: step.accent }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: step.accent }]}>
            <Ionicons color="#ffffff" name={step.icon} size={22} />
          </View>
          <View style={styles.cardHeaderCopy}>
            <Text style={styles.cardEyebrow}>GAME MODES</Text>
            <Text style={[styles.cardTitle, { color: step.accent }]}>{step.title}</Text>
          </View>
          <Pressable
            onPress={() => {
              playButtonSound();
              endTour("callouts_skipped");
            }}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>
        </View>

        <Text style={styles.cardDescription}>{step.description}</Text>

        <View style={styles.cardFooter}>
          <View style={styles.dots}>
            {calloutSteps.map((dotStep, dotIndex) => (
              <View
                key={dotStep.title}
                style={[
                  styles.dot,
                  dotIndex === stepIndex && { backgroundColor: step.accent, width: 18 }
                ]}
              />
            ))}
          </View>

          <View style={styles.buttons}>
            {isLastStep ? (
              <Pressable
                onPress={() => {
                  playButtonSound();
                  endTour("callouts_done");
                  router.push("/daily-puzzle");
                }}
                style={({ pressed }) => [styles.secondaryButton, { borderColor: step.accent }, pressed && styles.pressed]}
              >
                <Text style={[styles.secondaryButtonText, { color: step.accent }]}>TRY IT NOW</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                playButtonSound();

                if (isLastStep) {
                  endTour("callouts_done");
                  return;
                }

                setCalloutStep(stepIndex + 1);
              }}
              style={({ pressed }) => [styles.nextButton, { backgroundColor: step.accent }, pressed && styles.pressed]}
            >
              <Text style={styles.nextButtonText}>{isLastStep ? "GOT IT" : "NEXT"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    padding: spacing.sm,
    zIndex: 100,
    elevation: 20
  },
  // Solid color + element opacity (instead of an rgba background) so the dim
  // layer is composited as a whole and reliably covers the header's animated
  // widgets on web.
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0c1016",
    opacity: 0.78
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 3,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.tactile,
    elevation: 14
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: radii.md,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  cardHeaderCopy: {
    flex: 1,
    gap: 2
  },
  cardEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900"
  },
  skipButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.xs
  },
  skipButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800"
  },
  cardDescription: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21
  },
  cardFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  dots: {
    flexDirection: "row",
    gap: 6
  },
  dot: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: 8,
    width: 8
  },
  buttons: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900"
  },
  nextButton: {
    alignItems: "center",
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg
  },
  nextButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.6
  },
  pressed: {
    opacity: 0.85
  }
});
