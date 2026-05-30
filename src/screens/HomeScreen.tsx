import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { AppHeader, HeaderBackButton, HeaderCoinsPill } from "../components/AppHeader";
import { BottomTabs, MiniCard, ModeTile, StatusPill } from "../components/GameKit";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { ShopTab, ShopTabHeader } from "../components/ShopTab";
import { TextField } from "../components/TextField";
import { useOnlineGameStore } from "../store/useOnlineGameStore";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import { formatDuration, getAchievementMeta, getTodayKey } from "../utils/progression";
import { colors, radii, shadows, spacing } from "../utils/theme";

type HomeTab = "play" | "stats" | "shop" | "profile" | "settings";

const titleLetters = [
  { accent: "#f28f67", letter: "C" },
  { accent: "#5db5f5", letter: "O" },
  { accent: "#9dc95b", letter: "D" },
  { accent: "#f7b33d", letter: "E" },
  { accent: "#d979bc", letter: "G" },
  { accent: "#ee6b62", letter: "U" },
  { accent: "#7cc8ff", letter: "E" },
  { accent: "#a98ee8", letter: "S" },
  { accent: "#5cc78f", letter: "S" }
] as const;

const PROFILE_RING_SIZE = 40;
const PROFILE_RING_STROKE = 4;
const PROFILE_RING_RADIUS = (PROFILE_RING_SIZE - PROFILE_RING_STROKE) / 2;
const PROFILE_RING_CIRCUMFERENCE = 2 * Math.PI * PROFILE_RING_RADIUS;

export default function HomeScreen() {
  const isConnected = useOnlineGameStore((state) => state.isConnected);
  const errorMessage = useOnlineGameStore((state) => state.errorMessage);
  const displayName = usePlayerProgressStore((state) => state.displayName);
  const profile = usePlayerProgressStore((state) => state.profile);
  const leaderboard = usePlayerProgressStore((state) => state.leaderboard);
  const singlePlayerHighScores = usePlayerProgressStore((state) => state.profile.stats.singlePlayerHighScores);
  const claimDailyReward = usePlayerProgressStore((state) => state.claimDailyReward);
  const toggleSoundPlaceholders = usePlayerProgressStore((state) => state.toggleSoundPlaceholders);
  const updateDisplayName = usePlayerProgressStore((state) => state.updateDisplayName);

  const [activeTab, setActiveTab] = useState<HomeTab>("play");
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      duration: 280,
      toValue: 1,
      useNativeDriver: true
    }).start();
  }, [fadeIn]);

  const lastClaimedToday =
    profile.dailyReward.lastClaimedOn !== null &&
    profile.dailyReward.lastClaimedOn === getTodayKey();
  const latestMatch = profile.history[0] ?? null;
  const bestBadge = profile.achievements
    .map((achievementId) => getAchievementMeta(achievementId))
    .find((achievement): achievement is NonNullable<typeof achievement> => achievement !== null);
  const playerRank = leaderboard.find((entry) => entry.isPlayer)?.rank ?? null;
  const currentLevelFloorXp = 140 * (Math.max(1, profile.level) - 1) ** 2;
  const nextLevelFloorXp = 140 * Math.max(1, profile.level) ** 2;
  const levelXpSpan = Math.max(1, nextLevelFloorXp - currentLevelFloorXp);
  const levelProgress = Math.min(1, Math.max(0, (profile.xp - currentLevelFloorXp) / levelXpSpan));
  const levelProgressOffset = PROFILE_RING_CIRCUMFERENCE * (1 - levelProgress);
  const singlePlayerBestScore = Math.max(
    singlePlayerHighScores.easy,
    singlePlayerHighScores.hard,
    singlePlayerHighScores.impossible
  );
  const today = new Date();
  const dailyMonth = today.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dailyDay = today.getDate();

  const handleClaimDailyReward = async () => {
    try {
      setIsClaimingReward(true);
      const reward = await claimDailyReward();

      if (!reward.claimed) {
        Alert.alert("Already claimed", "Come back tomorrow.");
        return;
      }

      Alert.alert("Daily reward", `+${reward.points} pts, +${reward.xp} XP`);
    } finally {
      setIsClaimingReward(false);
    }
  };

  const openProfileModal = () => {
    setUsernameDraft(displayName);
    setUsernameError(null);
    setShowProfileModal(true);
  };

  const handleSaveUsername = async () => {
    try {
      setIsSavingUsername(true);
      setUsernameError(null);
      await updateDisplayName(usernameDraft);
      setShowProfileModal(false);
    } catch (error) {
      setUsernameError(error instanceof Error ? error.message : "Try again.");
    } finally {
      setIsSavingUsername(false);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <Animated.View style={[styles.shell, { opacity: fadeIn }]}>
        <AppHeader
          center={
            activeTab === "shop" ? (
              <ShopTabHeader />
            ) : (
              <View style={styles.homeHeaderCenter}>
                <Pressable onPress={openProfileModal} style={({ pressed }) => [styles.profileCrest, pressed && styles.pressed]}>
                  <View style={styles.levelBurstShadow} />
                  <View style={styles.levelBurst}>
                    <View style={[styles.levelBurstLayer, styles.levelBurstLayerA]} />
                    <Text style={styles.levelBurstText}>{profile.level}</Text>
                  </View>

                  <View style={styles.profileMedallion}>
                    <View style={styles.profileRingBase}>
                      <Svg height={PROFILE_RING_SIZE} style={styles.profileRingSvg} width={PROFILE_RING_SIZE}>
                        <Circle
                          cx={PROFILE_RING_SIZE / 2}
                          cy={PROFILE_RING_SIZE / 2}
                          fill="none"
                          r={PROFILE_RING_RADIUS}
                          stroke="#aa5139"
                          strokeWidth={PROFILE_RING_STROKE}
                        />
                        <Circle
                          cx={PROFILE_RING_SIZE / 2}
                          cy={PROFILE_RING_SIZE / 2}
                          fill="none"
                          r={PROFILE_RING_RADIUS}
                          stroke="#19d6e9"
                          strokeDasharray={PROFILE_RING_CIRCUMFERENCE}
                          strokeDashoffset={levelProgressOffset}
                          strokeLinecap="round"
                          strokeWidth={PROFILE_RING_STROKE}
                          transform={`rotate(-90 ${PROFILE_RING_SIZE / 2} ${PROFILE_RING_SIZE / 2})`}
                        />
                      </Svg>
                    </View>

                    <View style={styles.profileRingInner}>
                      <View style={styles.profileAvatarCore}>
                        <Ionicons color="#173d64" name="school" size={18} />
                      </View>
                    </View>
                  </View>
                </Pressable>
              </View>
            )
          }
          left={activeTab === "shop" ? <HeaderBackButton onPress={() => setActiveTab("play")} /> : undefined}
          right={activeTab === "shop" ? <View /> : (
            <View style={styles.homeHeaderRight}>
              <HeaderCoinsPill coins={profile.coins} />
            </View>
          )}
        />

        <View style={styles.mainPane}>
          {activeTab === "play" ? (
            <View style={[styles.tabPane, styles.playPane]}>
              <View style={styles.wordmarkWrap}>
                <View style={styles.wordmark}>
                  <View style={styles.wordRow}>
                    {titleLetters.map((item, index) => (
                      <View
                        key={`${item.letter}-${index}`}
                        style={[
                          styles.wordBubble,
                          index === 3 && styles.wordBubbleWordEnd,
                          { backgroundColor: item.accent }
                        ]}
                      >
                        <Text style={styles.wordBubbleText}>{item.letter}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.modeStack}>
                <ModeTile
                  accent={colors.practice}
                  compact
                  icon="person-outline"
                  onPress={() => router.push("/single-player")}
                  rightAccessory={
                    <View style={styles.modeBestCard}>
                      <View style={styles.modeBestTop}>
                        <Text style={styles.modeBestLabel}>BEST</Text>
                      </View>
                      <View style={styles.modeBestBottom}>
                        <Text style={styles.modeBestValue}>{singlePlayerBestScore}</Text>
                      </View>
                    </View>
                  }
                  subtitle="Endless Mode"
                  title="Single Player"
                />
                <ModeTile accent={colors.ai} compact icon="hardware-chip-outline" onPress={() => router.push("/vs-ai")} subtitle="Practice & Learn" title="VS AI" />
                <ModeTile accent={colors.online} compact icon="globe-outline" onPress={() => router.push("/online")} subtitle="Ranked Match" title="Online" />
              </View>

              <Pressable onPress={() => router.push("/daily-puzzle")} style={({ pressed }) => [styles.dailyCard, pressed && styles.pressed]}>
                <View style={styles.dailyCopy}>
                  <Text style={styles.dailyTitle}>Daily Puzzle</Text>
                </View>
                <View style={styles.dailyDateWrap}>
                  <View style={styles.dailyDateInner}>
                    <View style={styles.dailyCalendarTop}>
                      <View style={styles.dailyCalendarRingLeft} />
                      <View style={styles.dailyCalendarRingRight} />
                      <Text style={styles.dailyDateMonth}>{dailyMonth}</Text>
                    </View>
                    <View style={styles.dailyCalendarBottom}>
                      <Text style={styles.dailyDateDay}>{dailyDay}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.dailyCardGhost} />
              </Pressable>
            </View>
          ) : null}

          {activeTab === "stats" ? (
            <View style={styles.tabPane}>
              <View style={styles.panelRow}>
                <View style={styles.panelWide}>
                  <Text style={styles.panelTitle}>Daily Reward</Text>
                  <Text style={styles.panelValue}>{lastClaimedToday ? "Claimed Today" : `Day ${profile.dailyReward.streakDays + 1}`}</Text>
                  <PrimaryButton
                    disabled={lastClaimedToday}
                    label={lastClaimedToday ? "CLAIMED" : "CLAIM REWARD"}
                    loading={isClaimingReward}
                    onPress={handleClaimDailyReward}
                  />
                </View>

                <View style={styles.panelMiniColumn}>
                  <View style={styles.panelMini}>
                    <Text style={styles.panelMiniLabel}>Match</Text>
                    <Text style={[styles.panelMiniValue, { color: colors.accent }]}>
                      {latestMatch ? latestMatch.outcome : "Ready"}
                    </Text>
                  </View>
                  <View style={styles.panelMini}>
                    <Text style={styles.panelMiniLabel}>Rank</Text>
                    <Text style={[styles.panelMiniValue, { color: colors.danger }]}>
                      {playerRank ? `#${playerRank}` : "--"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>Recent Match</Text>
                <Text style={styles.panelValue}>
                  {latestMatch
                    ? `${latestMatch.outcome.toUpperCase()}  +${latestMatch.points}`
                    : "No matches yet"}
                </Text>
                <Text style={styles.panelSubtext}>
                  {latestMatch
                    ? `${formatDuration(latestMatch.durationMs)}  ${latestMatch.difficulty}`
                    : "Play any mode to record your first run."}
                </Text>
              </View>

              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>Leaderboard</Text>
                {leaderboard.slice(0, 3).map((entry) => (
                  <View key={entry.id} style={styles.leaderRow}>
                    <Text style={styles.leaderRank}>#{entry.rank}</Text>
                    <Text numberOfLines={1} style={styles.leaderName}>{entry.name}</Text>
                    <Text style={styles.leaderPoints}>{entry.points}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {activeTab === "shop" ? (
            <ShopTab />
          ) : null}

          {activeTab === "profile" ? (
            <View style={styles.tabPane}>
              <View style={styles.profileCard}>
                <View style={styles.profileHeader}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.avatarText}>{displayName.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.profileCopy}>
                    <Text style={styles.profileName}>{displayName}</Text>
                    <Text style={styles.profileSubtext}>Level {profile.level}</Text>
                  </View>
                  <PrimaryButton label="EDIT" onPress={openProfileModal} variant="secondary" />
                </View>

                <View style={styles.profileStatsRow}>
                  <MiniCard accent={colors.accent} label="Best Streak" value={profile.bestWinStreak} />
                  <MiniCard accent={colors.online} label="Matches" value={profile.stats.matches} />
                  <MiniCard accent={colors.danger} label="Badges" value={profile.achievements.length} />
                </View>
              </View>

              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>Achievement</Text>
                <Text style={styles.panelValue}>{bestBadge ? bestBadge.title : "First Win"}</Text>
                <Text style={styles.panelSubtext}>
                  {bestBadge ? bestBadge.description : "Win a match to unlock your first badge."}
                </Text>
              </View>

              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>Connection</Text>
                <View style={styles.profileStatusRow}>
                  <StatusPill label={isConnected ? "Server Ready" : "Connecting"} tone={isConnected ? "success" : "neutral"} />
                  <StatusPill label={profile.soundPlaceholdersEnabled ? "Audio On" : "Audio Off"} tone="neutral" />
                </View>
                <Text style={[styles.panelSubtext, errorMessage && styles.errorText]}>
                  {errorMessage ?? "Profile settings and progression are synced here."}
                </Text>
              </View>
            </View>
          ) : null}

          {activeTab === "settings" ? (
            <View style={styles.tabPane}>
              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>Settings</Text>
                <View style={styles.modalSwitchRow}>
                  <Text style={styles.modalSwitchLabel}>Audio</Text>
                  <Switch
                    onValueChange={() => {
                      toggleSoundPlaceholders().catch(() => { });
                    }}
                    thumbColor="#ffffff"
                    trackColor={{ false: colors.surfaceMuted, true: colors.practice }}
                    value={profile.soundPlaceholdersEnabled}
                  />
                </View>
              </View>

              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>Profile Shortcuts</Text>
                <View style={styles.settingsActionRow}>
                  <View style={styles.settingsActionCopy}>
                    <Text style={styles.settingsActionTitle}>Display Name</Text>
                    <Text style={styles.panelSubtext}>Update how your name appears in matches.</Text>
                  </View>
                  <PrimaryButton label="EDIT" onPress={openProfileModal} variant="secondary" />
                </View>
              </View>

              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>Connection</Text>
                <View style={styles.profileStatusRow}>
                  <StatusPill label={isConnected ? "Server Ready" : "Connecting"} tone={isConnected ? "success" : "neutral"} />
                  <StatusPill label={profile.soundPlaceholdersEnabled ? "Audio On" : "Audio Off"} tone="neutral" />
                </View>
                <Text style={[styles.panelSubtext, errorMessage && styles.errorText]}>
                  {errorMessage ?? "Settings are stored locally and sync when the server is available."}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {activeTab === "shop" ? null : (
          <View style={styles.bottomDock}>
            <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
          </View>
        )}
      </Animated.View>

      <Modal animationType="fade" transparent visible={showProfileModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Profile</Text>
            <TextField
              autoCapitalize="none"
              label="Display name"
              maxLength={20}
              onChangeText={(value) => {
                setUsernameDraft(value);
                setUsernameError(null);
              }}
              placeholder="player_53739"
              value={usernameDraft}
            />
            {usernameError ? <Text style={styles.inlineError}>{usernameError}</Text> : null}
            <PrimaryButton
              disabled={usernameDraft.trim().length < 3}
              label="SAVE"
              loading={isSavingUsername}
              onPress={() => void handleSaveUsername()}
              variant="success"
            />
            <PrimaryButton label="CANCEL" onPress={() => setShowProfileModal(false)} variant="secondary" />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 0
  },
  shell: {
    flex: 1
  },
  homeHeaderCenter: {
    transform: [{ translateY: 24 }, { scale: 1.72 }]
  },
  homeHeaderRight: {
    justifyContent: "center"
  },
  profileCrest: {
    alignItems: "center",
    height: 56,
    justifyContent: "flex-start",
    width: 60,
    zIndex: 3
  },
  levelBurstShadow: {
    backgroundColor: "rgba(24, 79, 124, 0.18)",
    borderRadius: 10,
    height: 24,
    position: "absolute",
    top: 2,
    transform: [{ rotate: "14deg" }],
    width: 24
  },
  levelBurst: {
    alignItems: "center",
    height: 20,
    justifyContent: "center",
    position: "absolute",
    top: 0,
    width: 20,
    zIndex: 4
  },
  levelBurstLayer: {
    backgroundColor: "#66d8ff",
    borderColor: "#287fc2",
    borderRadius: 6,
    borderWidth: 2.5,
    height: 18,
    position: "absolute",
    width: 18
  },
  levelBurstLayerA: {
    transform: [{ rotate: "45deg" }]
  },
  levelBurstLayerB: {
    transform: [{ rotate: "0deg" }]
  },
  levelBurstText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
    textShadowColor: "rgba(25, 35, 66, 0.55)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2
  },
  profileMedallion: {
    alignItems: "center",
    backgroundColor: "#f7c8ba",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    marginTop: 8,
    padding: 4,
    width: 44
  },
  profileRingBase: {
    alignItems: "center",
    backgroundColor: "#c96744",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    position: "absolute",
    width: 40
  },
  profileRingSvg: {
    position: "absolute"
  },
  profileRingInner: {
    alignItems: "center",
    backgroundColor: "#f7c8ba",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  profileAvatarCore: {
    alignItems: "center",
    backgroundColor: "#5aa6ff",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    overflow: "hidden",
    width: 30
  },
  profileAvatarGlow: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    borderRadius: 999,
    height: 38,
    left: 7,
    position: "absolute",
    top: 3,
    width: 38
  },
  profileShield: {
    alignItems: "center",
    bottom: 0,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    width: 18,
    zIndex: 4
  },
  profileShieldText: {
    color: "#7a8794",
    fontSize: 6,
    fontWeight: "900",
    position: "absolute",
    top: 5
  },
  wordmarkWrap: {
    alignItems: "center",
    marginBottom: spacing.xs
  },
  wordmark: {
    alignItems: "center",
    gap: spacing.xs
  },
  wordRow: {
    flexDirection: "row",
    gap: spacing.xxs
  },
  wordBubble: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    width: 34,
    ...shadows.tactile
  },
  wordBubbleWordEnd: {
    marginRight: spacing.sm
  },
  wordBubbleText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  heroCaption: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center"
  },
  mainPane: {
    flex: 1,
    justifyContent: "center",
    paddingTop: spacing.md
  },
  tabPane: {
    flex: 1,
    gap: spacing.sm
  },
  playPane: {
    justifyContent: "center"
  },
  dailyCard: {
    alignItems: "center",
    backgroundColor: "#ffe28c",
    borderBottomColor: "rgba(140, 90, 0, 0.08)",
    borderBottomWidth: 6,
    borderColor: "transparent",
    borderRadius: radii.lg,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: "relative",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 7
  },
  dailyCardGhost: {
    backgroundColor: "rgba(140, 90, 0, 0.08)",
    borderRadius: 999,
    bottom: -18,
    height: 84,
    position: "absolute",
    right: -12,
    width: 84
  },
  dailyCopy: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    paddingHorizontal: spacing.sm,
    paddingRight: 56,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1,
  },
  dailyTitle: {
    color: "#8b5a00",
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 22,
    textAlign: "center",
    textTransform: "uppercase"
  },
  dailyDateWrap: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 6,
    top: 5,
    width: 58,
    zIndex: 1
  },
  dailyDateInner: {
    alignItems: "center"
  },
  dailyCalendarTop: {
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
  dailyCalendarRingLeft: {
    backgroundColor: "#ffffff",
    borderRadius: radii.pill,
    height: 7,
    left: 8,
    position: "absolute",
    top: -3,
    width: 5
  },
  dailyCalendarRingRight: {
    backgroundColor: "#ffffff",
    borderRadius: radii.pill,
    height: 7,
    position: "absolute",
    right: 8,
    top: -3,
    width: 5
  },
  dailyCalendarBottom: {
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
  dailyDateMonth: {
    color: "#f0a500",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  dailyDateDay: {
    color: "#f0a500",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20
  },
  dailyBadgeMonth: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  dailyBadgeDay: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28
  },
  avatarText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  modeStack: {
    gap: spacing.sm
  },
  modeBestCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    overflow: "hidden",
    width: 44
  },
  modeBestTop: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 15,
    paddingHorizontal: 5,
    paddingTop: 1
  },
  modeBestLabel: {
    color: "#58d83c",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.4
  },
  modeBestBottom: {
    alignItems: "center",
    borderTopColor: "#58d83c",
    borderTopWidth: 1.5,
    justifyContent: "center",
    minHeight: 24
  },
  modeBestValue: {
    color: "#58d83c",
    fontSize: 18,
    fontWeight: "900"
  },
  panelRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  panelWide: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    flex: 1.25,
    gap: spacing.sm,
    padding: spacing.md,
    ...shadows.card
  },
  panelMiniColumn: {
    flex: 1,
    gap: spacing.sm
  },
  panelMini: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flex: 1,
    justifyContent: "center",
    padding: spacing.sm,
    ...shadows.card
  },
  panelMiniLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  panelMiniValue: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: spacing.xs
  },
  panelCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    gap: spacing.xs,
    padding: spacing.md,
    ...shadows.card
  },
  panelTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  panelValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  panelSubtext: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  leaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 28
  },
  leaderRank: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "900",
    width: 28
  },
  leaderName: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "800"
  },
  leaderPoints: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "900"
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.card
  },
  profileHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  profileAvatar: {
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.practice,
    borderRadius: radii.pill,
    borderWidth: 3,
    height: 72,
    justifyContent: "center",
    width: 72
  },
  profileCopy: {
    flex: 1
  },
  profileName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900"
  },
  profileSubtext: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700"
  },
  profileStatsRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  profileStatusRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  settingsActionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  settingsActionCopy: {
    flex: 1,
    gap: 4
  },
  settingsActionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  bottomDock: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(25, 28, 29, 0.2)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    gap: spacing.md,
    maxWidth: 420,
    padding: spacing.lg,
    width: "100%",
    ...shadows.tactile
  },
  modalTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900"
  },
  modalSwitchRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  modalSwitchLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  inlineError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800"
  },
  errorText: {
    color: colors.danger
  },
  pressed: {
    opacity: 0.84
  }
});
