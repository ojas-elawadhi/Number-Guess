import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { ScreenContainer } from "../components/ScreenContainer";
import { TopBar } from "../components/GameKit";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import { colors, radii, shadows, spacing } from "../utils/theme";
import {
  buildCalendarDays,
  formatPlayLabel,
  getDayFromDateKey,
  getDaysInMonth,
  getLocalTodayKey,
  getMonthCompletions,
  getMonthKeyFromDateKey,
  getMonthLabel,
  getShortMonthLabel,
  isTodayPuzzleDate,
  shiftMonthKey
} from "../utils/dailyPuzzle";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const milestoneTargets = [3, 10] as const;

export default function DailyPuzzleCalendarScreen() {
  const { height } = useWindowDimensions();
  const hydrated = usePlayerProgressStore((state) => state.hydrated);
  const profile = usePlayerProgressStore((state) => state.profile);
  const dailyPuzzleTodayKey = usePlayerProgressStore((state) => state.dailyPuzzleTodayKey);
  const fetchDailyPuzzleStatus = usePlayerProgressStore((state) => state.fetchDailyPuzzleStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let isMounted = true;

    const load = async () => {
      try {
        setLoadError(null);
        setIsLoading(true);
        const response = await fetchDailyPuzzleStatus(getLocalTodayKey());

        if (!isMounted) {
          return;
        }

        setSelectedDateKey(response.todayKey);
        setSelectedMonthKey(getMonthKeyFromDateKey(response.todayKey));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const todayFallback = getLocalTodayKey();
        setLoadError(error instanceof Error ? error.message : "Please try again in a moment.");
        setSelectedDateKey((current) => current ?? todayFallback);
        setSelectedMonthKey((current) => current ?? getMonthKeyFromDateKey(todayFallback));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load().catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [fetchDailyPuzzleStatus, hydrated, reloadKey]);

  const compactLayout = height < 860;
  const boardPadding = compactLayout ? spacing.sm : spacing.md;
  const dayCellSize = compactLayout ? 40 : 46;
  const todayKey = dailyPuzzleTodayKey ?? selectedDateKey;
  const monthKey = selectedMonthKey ?? (todayKey ? getMonthKeyFromDateKey(todayKey) : null);
  const completedByDate = profile.dailyPuzzle?.completedByDate ?? {};

  const calendarCells = useMemo(() => (monthKey ? buildCalendarDays(monthKey) : []), [monthKey]);
  const selectedCompletion = selectedDateKey ? completedByDate[selectedDateKey] ?? null : null;
  const monthCompletions = useMemo(
    () => (monthKey ? getMonthCompletions(completedByDate, monthKey) : []),
    [completedByDate, monthKey]
  );
  const monthWins = monthCompletions.length;
  const monthDays = monthKey ? getDaysInMonth(monthKey) : 31;
  const progressValue = Math.min(1, monthWins / Math.max(1, monthDays));
  const finalMilestone = monthDays;
  const progressMilestones = [
    { key: "starter", value: milestoneTargets[0] },
    { key: "collector", value: milestoneTargets[1] },
    { key: "perfect", value: finalMilestone }
  ] as const;
  const canGoForward = Boolean(
    todayKey && monthKey && shiftMonthKey(monthKey, 1) <= getMonthKeyFromDateKey(todayKey)
  );
  const canOpenSelected = Boolean(selectedDateKey && isTodayPuzzleDate(selectedDateKey));

  const openPuzzle = (dateKey: string | null) => {
    if (!dateKey || !isTodayPuzzleDate(dateKey)) {
      return;
    }

    router.push({
      pathname: "/daily-puzzle-game",
      params: { dateKey }
    });
  };

  const selectedStatusCopy = useMemo(() => {
    if (!selectedDateKey || !todayKey) {
      return {
        title: "Loading puzzle...",
        body: "Syncing the daily board from the server."
      };
    }

    if (selectedCompletion) {
      return {
        title: `${formatPlayLabel(selectedDateKey)} cleared`,
        body: `${selectedCompletion.attempts} attempts | ${Math.max(
          1,
          Math.round(selectedCompletion.durationMs / 1000)
        )}s`
      };
    }

    if (selectedDateKey === todayKey) {
      return {
        title: `${formatPlayLabel(selectedDateKey)} ready`,
        body: "One shared puzzle. Same secret number for everyone today."
      };
    }

    if (selectedDateKey > todayKey) {
      return {
        title: `${formatPlayLabel(selectedDateKey)} locked`,
        body: "That puzzle opens when your local day begins."
      };
    }

    return {
      title: `${formatPlayLabel(selectedDateKey)} unavailable`,
      body: "Daily play is locked to today only."
    };
  }, [selectedCompletion, selectedDateKey, todayKey]);

  if (!hydrated || isLoading || !todayKey || !monthKey || !selectedDateKey) {
    return (
      <ScreenContainer contentStyle={styles.loadingScreen}>
        <ActivityIndicator color={colors.warning} size="large" />
        <Text style={styles.loadingTitle}>Loading daily puzzle</Text>
        <Text style={styles.loadingBody}>Preparing today&apos;s shared board.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <TopBar
        accent={colors.warning}
        label="Daily Puzzle"
        onBack={() => router.back()}
        title="HIGHER LOWER"
        variant="header-only"
      />

      <View style={[styles.boardCard, { padding: boardPadding }]}>
        <View style={styles.boardHeader}>
          <Pressable
            onPress={() => {
              const previousMonth = shiftMonthKey(monthKey, -1);
              setSelectedMonthKey(previousMonth);
              setSelectedDateKey(`${previousMonth}-01`);
            }}
            style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.text} name="chevron-back" size={20} />
          </Pressable>

          <View style={styles.monthPill}>
            <Text numberOfLines={1} style={styles.monthPillText}>
              {getMonthLabel(monthKey).toUpperCase()}
            </Text>
          </View>

          <Pressable
            disabled={!canGoForward}
            onPress={() => {
              if (!canGoForward) {
                return;
              }

              const nextMonth = shiftMonthKey(monthKey, 1);
              setSelectedMonthKey(nextMonth);
              setSelectedDateKey(`${nextMonth}-01`);
            }}
            style={({ pressed }) => [
              styles.navButton,
              !canGoForward && styles.navButtonDisabled,
              pressed && canGoForward && styles.pressed
            ]}
          >
            <Ionicons color={colors.text} name="chevron-forward" size={20} />
          </Pressable>
        </View>

        <View style={styles.milestoneProgressCard}>
          <View style={styles.progressLabelRow}>
            <View style={styles.progressTitleWrap}>
              <Ionicons color={colors.warning} name="bar-chart" size={14} />
              <Text style={styles.progressCaption}>Monthly Progress</Text>
            </View>
            <View style={styles.progressCountPill}>
              <Text style={styles.progressCountText}>{monthWins} clears</Text>
            </View>
          </View>
          <View style={styles.progressTrackFrame}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressValue * 100}%` }]} />
              <View style={[styles.progressMarker, { left: `${(milestoneTargets[0] / monthDays) * 100}%` }]} />
              <View style={[styles.progressMarker, { left: `${(milestoneTargets[1] / monthDays) * 100}%` }]} />
              <View style={[styles.progressOrb, { left: `${progressValue * 100}%` }]}>
                <Text style={styles.progressOrbText}>{monthWins}</Text>
              </View>
            </View>
            <View style={styles.progressMilestoneRail}>
              {progressMilestones.map((milestone, index) => {
                const progressPercent = milestone.value / monthDays;
                const horizontalStyle =
                  index === 0
                    ? { left: 0 }
                    : index === progressMilestones.length - 1
                      ? { right: 0 }
                      : { left: `${progressPercent * 100}%` as `${number}%`, marginLeft: -18 };

                return (
                  <View key={milestone.key} style={[styles.progressMilestoneStop, horizontalStyle]}>
                    <View
                      style={[
                        styles.progressMilestoneCoin,
                        monthWins >= milestone.value && styles.progressMilestoneCoinHit
                      ]}
                    >
                      <Text
                        style={[
                          styles.progressMilestoneValue,
                          monthWins >= milestone.value && styles.progressMilestoneValueHit
                        ]}
                      >
                        {milestone.value}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.calendarCard}>
          <View style={styles.weekdayRow}>
            {weekdayLabels.map((label) => (
              <View key={label} style={styles.weekdayCell}>
                <Text style={styles.weekdayLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarCells.map((cell, index) => {
              if (!cell) {
                return (
                  <View key={`empty-${index}`} style={styles.daySlot}>
                    <View style={[styles.emptyCell, { height: dayCellSize }]} />
                  </View>
                );
              }

              const completion = completedByDate[cell.dateKey] ?? null;
              const isToday = cell.dateKey === todayKey;
              const isSelected = cell.dateKey === selectedDateKey;
              const isFuture = cell.dateKey > todayKey;
              const isMissed = !completion && !isFuture && !isToday;
              const isTodayActive = isToday && !completion;

              return (
                <View key={cell.dateKey} style={styles.daySlot}>
                  <Pressable
                    onPress={() => {
                      setSelectedDateKey(cell.dateKey);

                      if (isTodayPuzzleDate(cell.dateKey)) {
                        openPuzzle(cell.dateKey);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.dayCell,
                      {
                        height: dayCellSize,
                        width: dayCellSize,
                        alignSelf: "center",
                        borderRadius: radii.pill
                      },
                      completion && styles.dayCellComplete,
                      isTodayActive && styles.dayCellToday,
                      isSelected && styles.dayCellSelected,
                      isFuture && styles.dayCellFuture,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        compactLayout && styles.dayNumberCompact,
                        completion && styles.dayNumberComplete,
                        isToday && styles.dayNumberToday,
                        isFuture && styles.dayNumberFuture,
                        isMissed && styles.dayNumberMissed
                      ]}
                    >
                      {cell.day}
                    </Text>
                    {completion ? (
                      <View style={styles.dayCheck}>
                        <Ionicons color="#ffffff" name="checkmark" size={11} />
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {!(selectedDateKey && completedByDate[selectedDateKey]) ? (
        <View style={styles.footerCard}>
          <View style={styles.footerCopy}>
            <Text style={styles.footerTitle}>{selectedStatusCopy.title}</Text>
            <Text numberOfLines={2} style={styles.footerBody}>
              {selectedStatusCopy.body}
            </Text>
            {loadError ? <Text style={styles.footerError}>{loadError}</Text> : null}
          </View>

          <Pressable
            disabled={!canOpenSelected}
            onPress={() => {
              if (loadError && selectedDateKey !== todayKey) {
                setReloadKey((current) => current + 1);
                return;
              }

              openPuzzle(selectedDateKey);
            }}
            style={({ pressed }) => [
              styles.playButton,
              !canOpenSelected && styles.playButtonDisabled,
              pressed && canOpenSelected && styles.playButtonPressed
            ]}
          >
            <Text style={styles.playButtonText}>{`PLAY ${getShortMonthLabel(todayKey).toUpperCase()} ${getDayFromDateKey(todayKey)}`}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.backgroundAlt,
    gap: spacing.sm
  },
  loadingScreen: {
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    gap: spacing.xs,
    justifyContent: "center"
  },
  loadingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  loadingBody: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  boardCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    flex: 1,
    gap: spacing.sm,
    ...shadows.card
  },
  boardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  navButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  navButtonDisabled: {
    opacity: 0.4
  },
  monthPill: {
    alignItems: "center",
    backgroundColor: colors.warning,
    borderBottomColor: "#cc8b15",
    borderBottomWidth: 4,
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: spacing.md
  },
  monthPillText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.8
  },
  milestoneProgressCard: {
    borderRadius: radii.lg,
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs
  },
  sectionDivider: {
    backgroundColor: "#e3e7d7",
    height: 1,
    marginHorizontal: spacing.xs
  },
  progressLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  progressTitleWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  progressCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  progressCountPill: {
    alignItems: "center",
    backgroundColor: "#fff6df",
    borderColor: "#f2d17f",
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 26,
    paddingHorizontal: spacing.sm
  },
  progressCountText: {
    color: "#8a5a00",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  progressTrackFrame: {
    backgroundColor: "#ffffff",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingBottom: 46,
    paddingTop: 14
  },
  progressMilestoneRail: {
    left: 8,
    position: "absolute",
    right: 8,
    top: 36
  },
  progressMilestoneStop: {
    alignItems: "center",
    position: "absolute",
    top: 0,
    width: 32
  },
  progressMilestoneCoin: {
    alignItems: "center",
    backgroundColor: "#fff6df",
    borderColor: "#f2d17f",
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 32,
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    width: 32
  },
  progressMilestoneCoinHit: {
    backgroundColor: "#ffd66e",
    borderColor: "#d39a13"
  },
  progressMilestoneValue: {
    color: "#8a5a00",
    fontSize: 12,
    fontWeight: "900"
  },
  progressMilestoneValueHit: {
    color: "#6a4200"
  },
  progressTrack: {
    backgroundColor: "#e8ecd8",
    borderRadius: radii.pill,
    height: 16,
    overflow: "visible",
    position: "relative"
  },
  progressFill: {
    backgroundColor: colors.practice,
    borderRadius: radii.pill,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0
  },
  progressMarker: {
    backgroundColor: "rgba(25, 28, 29, 0.14)",
    bottom: 0,
    marginLeft: -1,
    position: "absolute",
    top: 0,
    width: 2
  },
  progressOrb: {
    alignItems: "center",
    backgroundColor: colors.practice,
    borderColor: colors.accentDark,
    borderRadius: radii.pill,
    borderWidth: 3,
    height: 30,
    justifyContent: "center",
    marginLeft: -15,
    position: "absolute",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    top: -11,
    width: 30
  },
  progressOrbText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900"
  },
  calendarCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flex: 1,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: spacing.xs
  },
  weekdayCell: {
    alignItems: "center",
    paddingHorizontal: 3,
    width: "14.2857%"
  },
  weekdayLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  daySlot: {
    paddingHorizontal: 3,
    paddingVertical: 3,
    width: "14.2857%"
  },
  emptyCell: {
    width: "100%"
  },
  dayCell: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.backgroundAlt,
    borderColor: "transparent",
    borderRadius: radii.md,
    borderWidth: 2,
    justifyContent: "center",
    position: "relative",
    width: "100%"
  },
  dayCellComplete: {
    backgroundColor: colors.practice,
    borderColor: colors.accentDark
  },
  dayCellToday: {
    backgroundColor: colors.online,
    borderColor: "#2a8ad1"
  },
  dayCellSelected: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2
  },
  dayCellFuture: {
    opacity: 0.5
  },
  dayNumber: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  dayNumberCompact: {
    fontSize: 15
  },
  dayNumberComplete: {
    color: "#ffffff"
  },
  dayNumberToday: {
    color: "#ffffff"
  },
  dayNumberFuture: {
    color: "#9ca6a1"
  },
  dayNumberMissed: {
    color: "#d63a3a"
  },
  dayCheck: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderColor: "#ffffff",
    borderRadius: radii.pill,
    borderWidth: 2,
    bottom: -4,
    height: 17,
    justifyContent: "center",
    position: "absolute",
    right: -3,
    width: 17
  },
  footerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadows.card
  },
  footerCopy: {
    flex: 1,
    gap: 4,
    justifyContent: "center"
  },
  footerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  footerBody: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  footerError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800"
  },
  playButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.accent,
    borderBottomColor: colors.accentDark,
    borderBottomWidth: 5,
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 56,
    minWidth: 210,
    paddingHorizontal: spacing.lg
  },
  playButtonDisabled: {
    opacity: 0.45
  },
  playButtonPressed: {
    transform: [{ scale: 0.99 }]
  },
  playButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.8,
    textAlign: "center"
  },
  pressed: {
    opacity: 0.84
  }
});
