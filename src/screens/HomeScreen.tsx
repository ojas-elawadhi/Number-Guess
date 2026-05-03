import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { SoundPlaceholdersCard } from "../components/SoundPlaceholdersCard";
import { TextField } from "../components/TextField";
import { useOnlineGameStore } from "../store/useOnlineGameStore";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import { getAchievementMeta, formatDuration, getTodayKey } from "../utils/progression";
import { colors, spacing } from "../utils/theme";

const modeCards = [
  {
    key: "practice",
    title: "Single Player",
    description: "Practice the core loop on your own, then choose a range.",
    icon: "person-outline" as const,
    route: "/practice"
  },
  {
    key: "vs-ai",
    title: "VS AI",
    description: "Pick Classic or Duel, choose a difficulty, and face an AI rival.",
    icon: "sparkles-outline" as const,
    route: "/vs-ai"
  },
  {
    key: "online",
    title: "Online",
    description: "Create or join a room, track streaks, and climb the online board.",
    icon: "globe-outline" as const,
    route: "/online"
  }
];

export default function HomeScreen() {
  const isConnected = useOnlineGameStore((state) => state.isConnected);
  const errorMessage = useOnlineGameStore((state) => state.errorMessage);
  const hydrated = usePlayerProgressStore((state) => state.hydrated);
  const displayName = usePlayerProgressStore((state) => state.displayName);
  const profile = usePlayerProgressStore((state) => state.profile);
  const leaderboard = usePlayerProgressStore((state) => state.leaderboard);
  const claimDailyReward = usePlayerProgressStore((state) => state.claimDailyReward);
  const markTutorialSeen = usePlayerProgressStore((state) => state.markTutorialSeen);
  const toggleSoundPlaceholders = usePlayerProgressStore((state) => state.toggleSoundPlaceholders);
  const updateDisplayName = usePlayerProgressStore((state) => state.updateDisplayName);
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(heroOpacity, {
        duration: 420,
        toValue: 1,
        useNativeDriver: true
      }),
      Animated.timing(cardOpacity, {
        duration: 420,
        toValue: 1,
        useNativeDriver: true
      })
    ]).start();
  }, [cardOpacity, heroOpacity]);

  useEffect(() => {
    if (hydrated && !profile.tutorialSeen) {
      setShowTutorial(true);
    }
  }, [hydrated, profile.tutorialSeen]);

  const xpIntoLevel = useMemo(() => {
    const previousLevelThreshold = Math.max(0, Math.pow(profile.level - 1, 2) * 140);
    const nextLevelThreshold = Math.pow(profile.level, 2) * 140;
    const earnedInsideLevel = profile.xp - previousLevelThreshold;
    const neededInsideLevel = Math.max(1, nextLevelThreshold - previousLevelThreshold);
    return Math.min(1, earnedInsideLevel / neededInsideLevel);
  }, [profile.level, profile.xp]);

  const recentMatches = profile.history.slice(0, 3);
  const unlockedAchievements = profile.achievements
    .map((achievementId) => getAchievementMeta(achievementId))
    .filter((achievement): achievement is NonNullable<typeof achievement> => achievement !== null)
    .slice(0, 4);
  const lastClaimedToday =
    profile.dailyReward.lastClaimedOn !== null &&
    profile.dailyReward.lastClaimedOn === getTodayKey();

  const handleClaimDailyReward = async () => {
    try {
      setIsClaimingReward(true);
      const reward = await claimDailyReward();

      if (!reward.claimed) {
        Alert.alert("Daily reward already claimed", "Come back tomorrow for your next reward.");
        return;
      }

      Alert.alert(
        "Daily reward claimed",
        `+${reward.points} points, +${reward.xp} XP, day ${reward.streakDays} streak.`
      );
    } finally {
      setIsClaimingReward(false);
    }
  };

  const closeTutorial = async () => {
    setShowTutorial(false);
    await markTutorialSeen();
  };

  const openUsernameModal = () => {
    setUsernameDraft(displayName);
    setUsernameError(null);
    setShowUsernameModal(true);
  };

  const handleSaveUsername = async () => {
    try {
      setIsSavingUsername(true);
      setUsernameError(null);
      await updateDisplayName(usernameDraft);
      setShowUsernameModal(false);
    } catch (error) {
      setUsernameError(error instanceof Error ? error.message : "Try again in a moment.");
    } finally {
      setIsSavingUsername(false);
    }
  };

  return (
    <ScreenContainer>
      <Animated.View style={[styles.hero, { opacity: heroOpacity }]}>
        <Text style={styles.eyebrow}>Higher or Lower</Text>
        <Text style={styles.title}>Guess Smart. Climb Fast.</Text>
        <Text style={styles.subtitle}>
          Same core high-low gameplay, now wrapped in progression, streaks, badges, and match tracking.
        </Text>
        <View style={styles.usernameRow}>
          <View style={styles.usernameChip}>
            <Text style={styles.usernameChipLabel}>Username</Text>
            <Text style={styles.usernameChipValue}>{displayName}</Text>
          </View>
          <Pressable onPress={openUsernameModal} style={({ pressed }) => [styles.editChip, pressed && styles.modeCardPressed]}>
            <Text style={styles.editChipText}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.levelCard}>
            <View style={styles.levelRing}>
              <Text style={styles.levelValue}>{profile.level}</Text>
              <Text style={styles.levelLabel}>LVL</Text>
            </View>
            <View style={styles.levelCopy}>
              <Text style={styles.levelTitle}>Player Progress</Text>
              <Text style={styles.levelText}>{profile.xp} XP earned</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(10, xpIntoLevel * 100)}%` }]} />
              </View>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{profile.totalPoints}</Text>
              <Text style={styles.summaryLabel}>Total Points</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{profile.currentWinStreak}</Text>
              <Text style={styles.summaryLabel}>Win Streak</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{profile.stats.wins}</Text>
              <Text style={styles.summaryLabel}>Wins</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.stack, { opacity: cardOpacity }]}>
        <View style={styles.primaryGrid}>
          {modeCards.map((card) => (
            <Pressable
              key={card.key}
              onPress={() => router.push(card.route as never)}
              style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
            >
              <View style={styles.modeIconWrap}>
                <Ionicons color={colors.text} name={card.icon} size={22} />
              </View>
              <Text style={styles.modeTitle}>{card.title}</Text>
              <Text style={styles.modeText}>{card.description}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.dashboardRow}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Daily Reward</Text>
            <Text style={styles.panelSubtitle}>
              {lastClaimedToday
                ? `Claimed today. Reward streak: ${profile.dailyReward.streakDays} days.`
                : `Ready to claim. Current reward streak: ${profile.dailyReward.streakDays} days.`}
            </Text>
            <PrimaryButton
              disabled={lastClaimedToday}
              label={lastClaimedToday ? "Claimed Today" : "Claim Daily Reward"}
              loading={isClaimingReward}
              onPress={handleClaimDailyReward}
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Leaderboard</Text>
            <Text style={styles.panelSubtitle}>Online standings preview based on your tracked online results.</Text>
            <View style={styles.leaderboardList}>
              {leaderboard.slice(0, 4).map((entry) => (
                <View key={entry.id} style={styles.leaderboardRow}>
                  <Text style={styles.leaderboardRank}>#{entry.rank}</Text>
                  <View style={styles.leaderboardNameWrap}>
                    <Text style={[styles.leaderboardName, entry.isPlayer && styles.leaderboardNameHighlight]}>
                      {entry.name}
                    </Text>
                    <Text style={styles.leaderboardMeta}>Lvl {entry.level} • Streak {entry.streak}</Text>
                  </View>
                  <Text style={styles.leaderboardPoints}>{entry.points}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.dashboardRow}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Achievements</Text>
            <Text style={styles.panelSubtitle}>
              {unlockedAchievements.length === 0
                ? "Your first badge is waiting on the next win."
                : "Unlocked badges from your best runs so far."}
            </Text>
            <View style={styles.badgeWrap}>
              {unlockedAchievements.length === 0 ? (
                <Text style={styles.emptyText}>No badges unlocked yet.</Text>
              ) : (
                unlockedAchievements.map((achievement) => (
                  <View key={achievement.id} style={styles.badgeCard}>
                    <Ionicons color={colors.accent} name={achievement.icon as never} size={18} />
                    <Text style={styles.badgeTitle}>{achievement.title}</Text>
                    <Text style={styles.badgeText}>{achievement.description}</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.panelTitle}>Recent Matches</Text>
                <Text style={styles.panelSubtitle}>Your latest scored runs across practice, AI, and online play.</Text>
              </View>
              <Pressable onPress={() => setShowTutorial(true)} style={({ pressed }) => [styles.tutorialLink, pressed && styles.modeCardPressed]}>
                <Text style={styles.tutorialLinkText}>Tutorial</Text>
              </Pressable>
            </View>
            {recentMatches.length === 0 ? (
              <Text style={styles.emptyText}>No matches recorded yet.</Text>
            ) : (
              recentMatches.map((match) => (
                <View key={match.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyTitle}>
                      {match.category === "single-player"
                        ? "Practice"
                        : match.category === "vs-ai"
                          ? `VS AI ${match.mode === "classic" ? "Classic" : "Duel"}`
                          : `Online ${match.mode === "classic" ? "Classic" : "Duel"}`}
                    </Text>
                    <Text style={styles.historyPoints}>+{match.points}</Text>
                  </View>
                  <Text style={styles.historyMeta}>
                    {match.outcome.toUpperCase()} • {match.attempts} attempts • {formatDuration(match.durationMs)}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {match.opponentName} • {match.difficulty}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.dashboardRow}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Progress Summary</Text>
            <Text style={styles.panelSubtitle}>
              Matches: {profile.stats.matches} • Best streak: {profile.bestWinStreak} • Average attempts:{" "}
              {profile.stats.matches === 0 ? "0" : (profile.stats.totalAttempts / profile.stats.matches).toFixed(1)}
            </Text>
            <Text style={styles.connection}>
              {isConnected ? "Server connected" : "Connecting to server..."}
            </Text>
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          </View>

          <View style={styles.panel}>
            <View style={styles.soundHeader}>
              <View>
                <Text style={styles.panelTitle}>Audio Hooks</Text>
                <Text style={styles.panelSubtitle}>Placeholder sound events are mapped without changing gameplay.</Text>
              </View>
              <Switch
                onValueChange={() => {
                  toggleSoundPlaceholders().catch(() => {
                    // Placeholder toggle should not block the rest of the UI.
                  });
                }}
                thumbColor={profile.soundPlaceholdersEnabled ? colors.text : "#dbe7f7"}
                trackColor={{ false: colors.border, true: colors.accentDark }}
                value={profile.soundPlaceholdersEnabled}
              />
            </View>
            <SoundPlaceholdersCard enabled={profile.soundPlaceholdersEnabled} />
          </View>
        </View>
      </Animated.View>

      <Modal animationType="fade" transparent visible={showTutorial}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>First-Time Tutorial</Text>
            <Text style={styles.modalTitle}>How the Game Flows</Text>
            <View style={styles.tutorialStep}>
              <Text style={styles.tutorialStepTitle}>1. Pick a category</Text>
              <Text style={styles.tutorialStepText}>Single Player for practice, VS AI for local rivalry, Online for room battles.</Text>
            </View>
            <View style={styles.tutorialStep}>
              <Text style={styles.tutorialStepTitle}>2. Choose the range</Text>
              <Text style={styles.tutorialStepText}>Easy is 1-99, Hard is 1-999, and Impossible is 1-9999.</Text>
            </View>
            <View style={styles.tutorialStep}>
              <Text style={styles.tutorialStepTitle}>3. Read only high or low</Text>
              <Text style={styles.tutorialStepText}>Core rules stay the same. You only get high/low feedback and win by finding the number first.</Text>
            </View>
            <PrimaryButton label="Let’s Play" onPress={() => void closeTutorial()} />
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={showUsernameModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>Profile</Text>
            <Text style={styles.modalTitle}>Choose Your Username</Text>
            <Text style={styles.panelSubtitle}>
              This is the name other players will see in rooms and on the leaderboard.
            </Text>
            <TextField
              autoCapitalize="none"
              label="Username"
              maxLength={20}
              onChangeText={(value) => {
                setUsernameDraft(value);
                if (usernameError) {
                  setUsernameError(null);
                }
              }}
              placeholder="player_53739"
              value={usernameDraft}
            />
            {usernameError ? <Text style={styles.inlineError}>{usernameError}</Text> : null}
            <PrimaryButton
              disabled={usernameDraft.trim().length < 3}
              label="Save Username"
              loading={isSavingUsername}
              onPress={() => void handleSaveUsername()}
            />
            <PrimaryButton
              label="Cancel"
              onPress={() => {
                setUsernameError(null);
                setShowUsernameModal(false);
              }}
              variant="secondary"
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.md,
    marginTop: spacing.sm
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 42,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  usernameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  usernameChip: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  usernameChipLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  usernameChipValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  editChip: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  editChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700"
  },
  heroStats: {
    gap: spacing.md
  },
  levelCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg
  },
  levelRing: {
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.accent,
    borderRadius: 34,
    borderWidth: 2,
    height: 68,
    justifyContent: "center",
    width: 68
  },
  levelValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  levelLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8
  },
  levelCopy: {
    flex: 1,
    gap: 6
  },
  levelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  levelText: {
    color: colors.textMuted,
    fontSize: 14
  },
  progressTrack: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    height: 8,
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: "100%"
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  summaryCard: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minWidth: 96,
    padding: spacing.md
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  stack: {
    gap: spacing.lg
  },
  primaryGrid: {
    gap: spacing.sm
  },
  modeCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
  },
  modeCardPressed: {
    opacity: 0.92
  },
  modeIconWrap: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  modeTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  modeText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  dashboardRow: {
    gap: spacing.sm
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  panelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  panelSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  leaderboardList: {
    gap: spacing.sm
  },
  leaderboardRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  leaderboardRank: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "800",
    width: 28
  },
  leaderboardNameWrap: {
    flex: 1
  },
  leaderboardName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  leaderboardNameHighlight: {
    color: colors.accent
  },
  leaderboardMeta: {
    color: colors.textMuted,
    fontSize: 12
  },
  leaderboardPoints: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  badgeWrap: {
    gap: spacing.sm
  },
  badgeCard: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: spacing.md
  },
  badgeTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18
  },
  historyCard: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: spacing.md
  },
  historyHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  historyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  historyPoints: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "800"
  },
  historyMeta: {
    color: colors.textMuted,
    fontSize: 12
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14
  },
  tutorialLink: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8
  },
  tutorialLinkText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700"
  },
  connection: {
    color: colors.textMuted,
    fontSize: 13
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600"
  },
  soundHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(8, 17, 31, 0.82)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: spacing.md,
    maxWidth: 460,
    padding: spacing.xl,
    width: "100%"
  },
  modalEyebrow: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  modalTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  },
  tutorialStep: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: spacing.md
  },
  tutorialStepTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  tutorialStepText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20
  },
  inlineError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600"
  }
});
