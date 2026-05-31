import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Polygon } from "react-native-svg";

import { AppHeader, HeaderBackButton, HeaderCoinsPill } from "../components/AppHeader";
import { BottomTabs, ModeTile, StatusPill } from "../components/GameKit";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { ShopTab, ShopTabHeader } from "../components/ShopTab";
import { useOnlineGameStore } from "../store/useOnlineGameStore";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { AvatarId } from "../types/progression.types";
import { DEFAULT_AVATAR_ID, formatDuration, getTodayKey } from "../utils/progression";
import { colors, radii, shadows, spacing } from "../utils/theme";

type HomeTab = "play" | "stats" | "shop" | "profile" | "settings";
type ProfileSection = "stats" | "profile";

const isHomeTab = (value: string | undefined): value is HomeTab =>
  value === "play" || value === "stats" || value === "shop" || value === "profile" || value === "settings";

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
const profileAvatarOptions = [
  { id: "scholar", icon: "school", background: "#63b4ff", foreground: "#173d64", ring: "#f28f67" },
  { id: "rocket", icon: "rocket", background: "#ffaf80", foreground: "#7a260d", ring: "#5db5f5" },
  { id: "flash", icon: "flash", background: "#ffe174", foreground: "#7f5100", ring: "#9dc95b" },
  { id: "planet", icon: "planet", background: "#c8a8ff", foreground: "#47217e", ring: "#f7b33d" },
  { id: "music", icon: "musical-notes", background: "#8ddfc9", foreground: "#00583b", ring: "#d979bc" },
  { id: "gamepad", icon: "game-controller", background: "#90d2ff", foreground: "#0f4970", ring: "#ee6b62" },
  { id: "paw", icon: "paw", background: "#ffd2ad", foreground: "#7f3d00", ring: "#7cc8ff" },
  { id: "book", icon: "book", background: "#f8a7d8", foreground: "#7d2052", ring: "#a98ee8" },
  { id: "flame", icon: "flame", background: "#ffb0a6", foreground: "#80161a", ring: "#5cc78f" },
  { id: "cafe", icon: "cafe", background: "#d8c4a8", foreground: "#5f3c15", ring: "#f28f67" },
  { id: "tennis", icon: "tennisball", background: "#d8f58a", foreground: "#3f6b00", ring: "#5db5f5" },
  { id: "bulb", icon: "bulb", background: "#ffe58c", foreground: "#885700", ring: "#d979bc" }
] as const satisfies ReadonlyArray<{
  id: AvatarId;
  icon: ComponentProps<typeof Ionicons>["name"];
  background: string;
  foreground: string;
  ring: string;
}>;

const difficultyChartConfig = [
  { key: "easy", label: "Easy", accent: colors.practice },
  { key: "hard", label: "Hard", accent: colors.warning },
  { key: "impossible", label: "Impossible", accent: colors.online }
] as const;

const modeChartConfig = [
  { key: "single-player", label: "Single Player", accent: colors.practice },
  { key: "vs-ai", label: "VS AI", accent: colors.ai },
  { key: "online", label: "Online", accent: colors.online }
] as const;

function OnlineVsBadge() {
  return (
    <View style={styles.onlineVsBadge}>
      <Text style={styles.onlineVsBadgeText}>VS!</Text>
    </View>
  );
}

export default function HomeScreen() {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const isConnected = useOnlineGameStore((state) => state.isConnected);
  const errorMessage = useOnlineGameStore((state) => state.errorMessage);
  const displayName = usePlayerProgressStore((state) => state.displayName);
  const profile = usePlayerProgressStore((state) => state.profile);
  const leaderboard = usePlayerProgressStore((state) => state.leaderboard);
  const singlePlayerHighScores = usePlayerProgressStore((state) => state.profile.stats.singlePlayerHighScores);
  const claimDailyReward = usePlayerProgressStore((state) => state.claimDailyReward);
  const toggleSoundPlaceholders = usePlayerProgressStore((state) => state.toggleSoundPlaceholders);
  const updateDisplayName = usePlayerProgressStore((state) => state.updateDisplayName);
  const updateAvatarId = usePlayerProgressStore((state) => state.updateAvatarId);

  const [activeTab, setActiveTab] = useState<HomeTab>("play");
  const [profileSection, setProfileSection] = useState<ProfileSection>("profile");
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [savingAvatarId, setSavingAvatarId] = useState<AvatarId | null>(null);
  const [usernameDraft, setUsernameDraft] = useState(displayName);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      duration: 280,
      toValue: 1,
      useNativeDriver: true
    }).start();
  }, [fadeIn]);

  useEffect(() => {
    setUsernameDraft(displayName);
  }, [displayName]);

  useEffect(() => {
    if (pathname === "/profile" || pathname === "/stats") {
      setActiveTab("profile");
      setProfileSection(pathname === "/stats" ? "stats" : "profile");
      return;
    }

    const nextTab = typeof params.tab === "string" && isHomeTab(params.tab) && params.tab !== "profile"
      ? params.tab
      : "play";

    setActiveTab(nextTab);
    setProfileSection("profile");
  }, [params.tab, pathname]);

  const lastClaimedToday =
    profile.dailyReward.lastClaimedOn !== null &&
    profile.dailyReward.lastClaimedOn === getTodayKey();
  const latestMatch = profile.history[0] ?? null;
  const playerRank = leaderboard.find((entry) => entry.isPlayer)?.rank ?? null;
  const currentLevelFloorXp = 140 * (Math.max(1, profile.level) - 1) ** 2;
  const nextLevelFloorXp = 140 * Math.max(1, profile.level) ** 2;
  const levelXpSpan = Math.max(1, nextLevelFloorXp - currentLevelFloorXp);
  const levelProgress = Math.min(1, Math.max(0, (profile.xp - currentLevelFloorXp) / levelXpSpan));
  const levelProgressOffset = PROFILE_RING_CIRCUMFERENCE * (1 - levelProgress);
  const levelXpEarned = Math.max(0, profile.xp - currentLevelFloorXp);
  const singlePlayerBestScore = Math.max(
    singlePlayerHighScores.easy,
    singlePlayerHighScores.hard,
    singlePlayerHighScores.impossible
  );
  const today = new Date();
  const dailyMonth = today.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dailyDay = today.getDate();
  const totalMatches = profile.stats.matches;
  const overallWinRate = totalMatches > 0 ? Math.round((profile.stats.wins / totalMatches) * 100) : 0;
  const aiWins = profile.stats.category["vs-ai"].wins;
  const streakProgressTarget = Math.max(3, profile.bestWinStreak, profile.currentWinStreak);
  const streakProgressPercent = Math.max(
    profile.currentWinStreak > 0 ? 10 : 0,
    Math.min(100, Math.round((profile.currentWinStreak / streakProgressTarget) * 100))
  );
  const streakCaption = profile.currentWinStreak <= 0
    ? "Your next win starts a streak"
    : profile.currentWinStreak >= profile.bestWinStreak && profile.bestWinStreak > 0
      ? "You are matching your best run"
      : `${Math.max(0, profile.bestWinStreak - profile.currentWinStreak)} away from your best`;
  const bestScoreCeiling = Math.max(
    1,
    profile.stats.singlePlayerHighScores.easy,
    profile.stats.singlePlayerHighScores.hard,
    profile.stats.singlePlayerHighScores.impossible
  );
  const modePerformance = modeChartConfig.map((mode) => {
    const stats = profile.stats.category[mode.key];
    const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;

    return {
      ...mode,
      matches: stats.matches,
      points: stats.points,
      winRate
    };
  });
  const modeMatchesCeiling = Math.max(1, ...modePerformance.map((mode) => mode.matches));
  const recentMatches = profile.history.slice(0, 5);

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

  const openProfileEditor = () => {
    setProfileSection("profile");
    setUsernameDraft(displayName);
    setUsernameError(null);
    router.push("/profile");
  };

  const handleSaveUsername = async () => {
    try {
      setIsSavingUsername(true);
      setUsernameError(null);
      await updateDisplayName(usernameDraft);
    } catch (error) {
      setUsernameError(error instanceof Error ? error.message : "Try again.");
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleSelectAvatar = async (avatarId: AvatarId) => {
    if (savingAvatarId || avatarId === profile.avatarId) {
      return;
    }

    try {
      setAvatarError(null);
      setSavingAvatarId(avatarId);
      await updateAvatarId(avatarId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Try again.";
      setAvatarError(message);
      Alert.alert("Avatar not saved", message);
    } finally {
      setSavingAvatarId(null);
    }
  };

  const selectedAvatarId = savingAvatarId ?? profile.avatarId ?? DEFAULT_AVATAR_ID;
  const selectedAvatar =
    profileAvatarOptions.find((option) => option.id === selectedAvatarId) ??
    profileAvatarOptions.find((option) => option.id === DEFAULT_AVATAR_ID) ??
    profileAvatarOptions[0];
  const profileHeroAvatarSize = Math.max(72, Math.min(82, screenWidth * 0.2));
  const profileHeroShellMinHeight = Math.max(232, Math.min(270, screenHeight * 0.36));
  const profileHeroCardMinHeight = Math.max(128, Math.min(148, screenHeight * 0.19));
  const profileHeroCardPaddingTop = Math.max(48, profileHeroAvatarSize * 0.62);
  const profileHeroLevelBadgeSize = Math.max(44, Math.min(52, screenWidth * 0.125));
  const profileContentWidth = Math.max(320, Math.min(360, screenWidth - spacing.md * 2));

  const handleTabChange = (tab: HomeTab) => {
    if (tab === "profile") {
      openProfileEditor();
      return;
    }

    if (tab === "stats") {
      router.replace("/stats");
      return;
    }

    if (tab === "play") {
      router.replace("/");
      return;
    }

    router.replace({ pathname: "/", params: { tab } });
  };

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <Animated.View style={[styles.shell, { opacity: fadeIn }]}>
        {activeTab === "profile" ? null : (
          <AppHeader
            center={
              activeTab === "shop" ? (
                <ShopTabHeader />
              ) : (
                <View style={styles.homeHeaderCenter}>
                  <Pressable onPress={openProfileEditor} style={({ pressed }) => [styles.profileCrest, pressed && styles.pressed]}>
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

                      <View style={[styles.profileRingInner, { backgroundColor: selectedAvatar.ring }]}>
                        <View style={[styles.profileAvatarCore, { backgroundColor: selectedAvatar.background }]}>
                          <Ionicons color={selectedAvatar.foreground} name={selectedAvatar.icon} size={18} />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </View>
              )
            }
            left={activeTab === "shop" ? <HeaderBackButton onPress={() => router.replace("/")} /> : undefined}
            right={activeTab === "shop" ? <View /> : (
              <View style={styles.homeHeaderRight}>
                <HeaderCoinsPill coins={profile.coins} />
              </View>
            )}
          />
        )}

        <View style={[styles.mainPane, activeTab === "profile" && styles.profileMainPane]}>
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
                <ModeTile
                  accent={colors.ai}
                  compact
                  icon="hardware-chip-outline"
                  onPress={() => router.push("/vs-ai")}
                  rightAccessory={
                    <View style={styles.modeBestCard}>
                      <View style={styles.modeBestTop}>
                        <Text style={styles.modeBestLabel}>WINS</Text>
                      </View>
                      <View style={styles.modeBestBottom}>
                        <Text style={styles.modeBestValue}>{aiWins}</Text>
                      </View>
                    </View>
                  }
                  subtitle="Battle Mode"
                  title="VS AI"
                />
                <ModeTile
                  accent={colors.online}
                  compact
                  icon="globe-outline"
                  onPress={() => router.push("/online")}
                  rightAccessory={<OnlineVsBadge />}
                  subtitle="Ranked Match"
                  title="Online"
                />
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
            <ScrollView
              contentContainerStyle={styles.profileScrollContent}
              showsVerticalScrollIndicator={false}
              style={styles.profileScroll}
            >
              <View style={[styles.profileHeroShell, { minHeight: profileHeroShellMinHeight, width: profileContentWidth }]}>
                <Text style={styles.profileRouteTitle}>YOUR PROFILE</Text>

                <View style={styles.profileHeroHeaderRow}>
                  <Pressable onPress={() => router.replace("/")} style={({ pressed }) => [styles.profileHeroBackButton, pressed && styles.pressed]}>
                    <Ionicons color={colors.text} name="arrow-back" size={21} />
                  </Pressable>
                  <HeaderCoinsPill coins={profile.coins} />
                </View>

                <View
                  style={[
                    styles.profileHeroCard,
                    {
                      minHeight: profileHeroCardMinHeight,
                      paddingTop: profileHeroCardPaddingTop
                    }
                  ]}
                >
                  <View
                    style={[
                      styles.profileHeroAvatarWrap,
                      {
                        height: profileHeroAvatarSize,
                        marginLeft: -(profileHeroAvatarSize / 2),
                        top: -(profileHeroAvatarSize * 0.5),
                        width: profileHeroAvatarSize
                      }
                    ]}
                  >
                    <View style={styles.profileHeroShadow} />
                    <View
                      style={[
                        styles.profileHeroAvatar,
                        {
                          backgroundColor: selectedAvatar.background,
                          borderColor: selectedAvatar.ring,
                          height: profileHeroAvatarSize,
                          width: profileHeroAvatarSize
                        }
                      ]}
                    >
                      <Ionicons color={selectedAvatar.foreground} name={selectedAvatar.icon} size={Math.max(32, profileHeroAvatarSize * 0.42)} />
                    </View>
                  </View>

                  <Text numberOfLines={1} style={styles.profileHeroName}>{displayName}</Text>

                  <View style={styles.profileHeroProgressCluster}>
                    <View
                      style={[
                        styles.profileHeroLevelBurst,
                        {
                          height: profileHeroLevelBadgeSize,
                          width: profileHeroLevelBadgeSize
                        }
                      ]}
                    >
                      <Svg height="100%" style={styles.profileHeroLevelBurstSvg} viewBox="0 0 100 100" width="100%">
                        <Polygon
                          fill={colors.online}
                          points="50,4 61,23 83,17 77,39 96,50 77,61 83,83 61,77 50,96 39,77 17,83 23,61 4,50 23,39 17,17 39,23"
                          stroke={colors.surfaceCool}
                          strokeLinejoin="round"
                          strokeWidth={7}
                        />
                        <Circle cx={50} cy={50} fill={colors.online} r={27} stroke={colors.surface} strokeWidth={4} />
                      </Svg>
                      <Text style={styles.profileHeroLevelBurstText}>{profile.level}</Text>
                    </View>

                    <View style={styles.profileHeroProgressTrack}>
                      <View
                        style={[
                          styles.profileHeroProgressFill,
                          { width: `${Math.max(12, Math.round(levelProgress * 100))}%` }
                        ]}
                      >
                        <View style={styles.profileHeroProgressFillGloss} />
                      </View>
                      <View pointerEvents="none" style={styles.profileHeroProgressTrackGloss} />
                      <Text style={styles.profileHeroProgressValue}>{levelXpEarned}/{levelXpSpan}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.profileSectionBar, { marginLeft: -spacing.md, width: screenWidth }]}>
                <View style={[styles.profileSectionTabs, { marginLeft: spacing.md, width: profileContentWidth }]}>
                  {(["stats", "profile"] as const).map((section) => {
                    const isActive = profileSection === section;

                    return (
                      <Pressable
                        key={section}
                        onPress={() => {
                          if (section === "stats") {
                            router.replace("/stats");
                            return;
                          }

                          router.replace("/profile");
                        }}
                        style={({ pressed }) => [
                          styles.profileSectionTab,
                          isActive && styles.profileSectionTabActive,
                          pressed && styles.pressed
                        ]}
                      >
                        <Text style={[styles.profileSectionTabText, isActive && styles.profileSectionTabTextActive]}>
                          {section === "stats" ? "STATS" : "PROFILE"}
                        </Text>
                        {section === "profile" ? (
                          <View style={styles.profileSectionTabIcon}>
                            <Ionicons color={colors.surface} name="pencil" size={10} />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {profileSection === "stats" ? (
                <View style={[styles.profileStatsPanel, { width: profileContentWidth }]}>
                  <View style={styles.profileStatsHeroGrid}>
                    <View style={[styles.profileStatsHeroCard, styles.profileStatsHeroCardPrimary]}>
                      <View style={[styles.profileStatsHeroGlow, styles.profileStatsHeroGlowPrimaryA]} />
                      <View style={[styles.profileStatsHeroGlow, styles.profileStatsHeroGlowPrimaryB]} />

                      <View style={styles.profileStatsHeroTopRow}>
                        <View style={[styles.profileStatsHeroBadge, styles.profileStatsHeroBadgePrimary]}>
                          <Ionicons color={colors.accent} name="trending-up" size={16} />
                        </View>
                        <View style={styles.profileStatsHeroTag}>
                          <Text style={styles.profileStatsHeroTagText}>Overall</Text>
                        </View>
                      </View>

                      <Text style={styles.profileStatsHeroLabel}>Win Rate</Text>
                      <Text style={styles.profileStatsHeroValue}>{overallWinRate}%</Text>
                      <Text style={styles.profileStatsHeroCaption}>
                        {totalMatches > 0 ? `${profile.stats.wins} wins in ${totalMatches} matches` : "Start playing to build your record"}
                      </Text>

                      <View style={styles.profileStatsHeroMeterTrack}>
                        <View
                          style={[
                            styles.profileStatsHeroMeterFill,
                            styles.profileStatsHeroMeterFillPrimary,
                            { width: `${Math.max(overallWinRate > 0 ? 12 : 0, overallWinRate)}%` }
                          ]}
                        />
                      </View>
                    </View>

                    <View style={[styles.profileStatsHeroCard, styles.profileStatsHeroCardAccent]}>
                      <View style={[styles.profileStatsHeroGlow, styles.profileStatsHeroGlowAccentA]} />
                      <View style={[styles.profileStatsHeroGlow, styles.profileStatsHeroGlowAccentB]} />

                      <View style={styles.profileStatsHeroTopRow}>
                        <View style={[styles.profileStatsHeroBadge, styles.profileStatsHeroBadgeAccent]}>
                          <Ionicons color="#0f5f87" name="flame" size={16} />
                        </View>
                        <View style={styles.profileStatsHeroTag}>
                          <Text style={styles.profileStatsHeroTagText}>Live</Text>
                        </View>
                      </View>

                      <Text style={styles.profileStatsHeroLabel}>Current Streak</Text>
                      <Text style={styles.profileStatsHeroValue}>{profile.currentWinStreak}</Text>
                      <Text style={styles.profileStatsHeroCaption}>{streakCaption}</Text>

                      <View style={styles.profileStatsHeroMeterTrack}>
                        <View
                          style={[
                            styles.profileStatsHeroMeterFill,
                            styles.profileStatsHeroMeterFillAccent,
                            { width: `${streakProgressPercent}%` }
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.profileStatsMiniRow}>
                      <View style={[styles.profileStatsMiniCard, styles.profileStatsMiniCardWarm]}>
                        <View style={styles.profileStatsMiniTopRow}>
                          <View style={[styles.profileStatsMiniBadge, styles.profileStatsMiniBadgeWarm]}>
                            <Ionicons color="#8a5e00" name="trophy" size={14} />
                          </View>
                        </View>
                        <Text style={styles.profileStatsMiniLabel}>Best Streak</Text>
                        <Text style={styles.profileStatsMiniValue}>{profile.bestWinStreak}</Text>
                        <Text style={styles.profileStatsMiniCaption}>Personal best</Text>
                      </View>

                      <View style={[styles.profileStatsMiniCard, styles.profileStatsMiniCardCool]}>
                        <View style={styles.profileStatsMiniTopRow}>
                          <View style={[styles.profileStatsMiniBadge, styles.profileStatsMiniBadgeCool]}>
                            <Ionicons color="#1f74b0" name="podium" size={14} />
                          </View>
                        </View>
                        <Text style={styles.profileStatsMiniLabel}>Rank</Text>
                        <Text style={styles.profileStatsMiniValue}>{playerRank ? `#${playerRank}` : "--"}</Text>
                        <Text style={styles.profileStatsMiniCaption}>{playerRank ? "Online leaderboard" : "Play online to place"}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.profileStatsFeatureCard}>
                    <View style={styles.profileStatsSectionHeader}>
                      <View>
                        <Text style={styles.profileStatsSectionEyebrow}>Single Player</Text>
                        <Text style={styles.profileStatsSectionTitle}>Difficulty Mastery</Text>
                      </View>
                      <View style={styles.profileStatsChip}>
                        <Text style={styles.profileStatsChipText}>Best Score {singlePlayerBestScore}</Text>
                      </View>
                    </View>

                    <View style={styles.profileStatsChart}>
                      {difficultyChartConfig.map((difficulty) => {
                        const score = profile.stats.singlePlayerHighScores[difficulty.key];
                        const rounds = profile.stats.singlePlayerHighRounds[difficulty.key];
                        const widthPercent = score > 0 ? Math.max(8, Math.round((score / bestScoreCeiling) * 100)) : 0;

                        return (
                          <View key={difficulty.key} style={styles.profileStatsChartRow}>
                            <View style={styles.profileStatsChartHead}>
                              <View style={[styles.profileStatsChartDot, { backgroundColor: difficulty.accent }]} />
                              <Text style={styles.profileStatsChartLabel}>{difficulty.label}</Text>
                              <Text style={styles.profileStatsChartScore}>{score}</Text>
                            </View>

                            <View style={styles.profileStatsChartTrack}>
                              <View
                                style={[
                                  styles.profileStatsChartFill,
                                  {
                                    backgroundColor: difficulty.accent,
                                    width: `${widthPercent}%`
                                  }
                                ]}
                              />
                            </View>

                            <Text style={styles.profileStatsChartMeta}>
                              Best Round {rounds}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.profileStatsFeatureCard}>
                    <View style={styles.profileStatsSectionHeader}>
                      <View>
                        <Text style={styles.profileStatsSectionEyebrow}>Overview</Text>
                        <Text style={styles.profileStatsSectionTitle}>Mode Performance</Text>
                      </View>
                      <View style={styles.profileStatsChip}>
                        <Text style={styles.profileStatsChipText}>{totalMatches} Matches</Text>
                      </View>
                    </View>

                    <View style={styles.profileStatsModeList}>
                      {modePerformance.map((mode) => {
                        const barWidth = mode.matches > 0 ? Math.max(10, Math.round((mode.matches / modeMatchesCeiling) * 100)) : 0;

                        return (
                          <View key={mode.key} style={styles.profileStatsModeCard}>
                            <View style={styles.profileStatsModeHeader}>
                              <View style={styles.profileStatsModeIdentity}>
                                <View style={[styles.profileStatsModeBadge, { backgroundColor: `${mode.accent}22` }]}>
                                  <View style={[styles.profileStatsModeBadgeCore, { backgroundColor: mode.accent }]} />
                                </View>
                                <View style={styles.profileStatsModeCopy}>
                                  <Text style={styles.profileStatsModeTitle}>{mode.label}</Text>
                                  <Text style={styles.profileStatsModeMeta}>{mode.matches} matches played</Text>
                                </View>
                              </View>

                              <View style={styles.profileStatsModeMetrics}>
                                <Text style={styles.profileStatsModeMetricValue}>{mode.winRate}%</Text>
                                <Text style={styles.profileStatsModeMetricLabel}>win rate</Text>
                              </View>
                            </View>

                            <View style={styles.profileStatsModeBarTrack}>
                              <View
                                style={[
                                  styles.profileStatsModeBarFill,
                                  {
                                    backgroundColor: mode.accent,
                                    width: `${barWidth}%`
                                  }
                                ]}
                              />
                            </View>

                            <View style={styles.profileStatsModeFooter}>
                              <Text style={styles.profileStatsModeFooterText}>{mode.points} pts earned</Text>
                              <Text style={styles.profileStatsModeFooterText}>
                                {mode.matches > 0 ? Math.round(mode.points / mode.matches) : 0} avg pts
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.profileStatsFeatureCard}>
                    <View style={styles.profileStatsSectionHeader}>
                      <View>
                        <Text style={styles.profileStatsSectionEyebrow}>Recent Form</Text>
                        <Text style={styles.profileStatsSectionTitle}>Latest Matches</Text>
                      </View>
                    </View>

                    {recentMatches.length > 0 ? recentMatches.map((match) => {
                      const outcomeColor =
                        match.outcome === "win" ? colors.practice : match.outcome === "tie" ? colors.warning : colors.ai;

                      return (
                        <View key={match.id} style={styles.profileStatsMatchRow}>
                          <View style={[styles.profileStatsMatchPill, { backgroundColor: outcomeColor }]}>
                            <Text style={styles.profileStatsMatchPillText}>{match.outcome.toUpperCase()}</Text>
                          </View>

                          <View style={styles.profileStatsMatchCopy}>
                            <Text numberOfLines={1} style={styles.profileStatsMatchTitle}>
                              {match.mode === "daily" ? "Daily Puzzle" : match.category === "single-player" ? "Single Player" : match.category === "vs-ai" ? "VS AI" : "Online"} · {match.difficulty}
                            </Text>
                            <Text numberOfLines={1} style={styles.profileStatsMatchSubtitle}>
                              {match.points} pts · {formatDuration(match.durationMs)} · {match.attempts} attempts
                            </Text>
                          </View>
                        </View>
                      );
                    }) : (
                      <View style={styles.profileStatsEmptyState}>
                        <Ionicons color={colors.textMuted} name="stats-chart-outline" size={20} />
                        <Text style={styles.profileStatsEmptyTitle}>No match history yet</Text>
                        <Text style={styles.profileStatsEmptyCaption}>
                          Your recent games will show up here once you start playing.
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <View style={[styles.profilePanel, { width: profileContentWidth }]}>
                  <View style={styles.profileNameRow}>
                    <TextInput
                      autoCapitalize="none"
                      maxLength={20}
                      onChangeText={(value) => {
                        setUsernameDraft(value);
                        setUsernameError(null);
                      }}
                      placeholder="Enter a nickname"
                      placeholderTextColor="#aaa7b6"
                      style={styles.profileNameInput}
                      value={usernameDraft}
                    />
                    <Pressable
                      disabled={isSavingUsername || usernameDraft.trim().length < 3 || usernameDraft.trim() === displayName.trim()}
                      onPress={() => void handleSaveUsername()}
                      style={({ pressed }) => [
                        styles.profileNameAction,
                        (isSavingUsername || usernameDraft.trim().length < 3 || usernameDraft.trim() === displayName.trim()) &&
                        styles.profileNameActionDisabled,
                        pressed && styles.pressed
                      ]}
                    >
                      <Ionicons color="#ffffff" name="create-outline" size={15} />
                    </Pressable>
                  </View>
                  {usernameError ? <Text style={styles.inlineError}>{usernameError}</Text> : null}

                  <View style={styles.profileDivider} />

                  <View style={styles.profilePanelHeader}>
                    <View style={styles.profilePanelHeaderCopy}>
                      <Text style={styles.profilePanelTitle}>Choose Avatar</Text>
                      <Text style={styles.profilePanelCaption}>Pick a style for this first version.</Text>
                    </View>
                    <View style={styles.profileCurrentBadge}>
                      <Text style={styles.profileCurrentBadgeText}>Selected</Text>
                    </View>
                  </View>

                  <View style={styles.avatarGrid}>
                    {profileAvatarOptions.map((option) => {
                      const isSelected = option.id === selectedAvatarId;

                      return (
                        <Pressable
                          key={option.id}
                          onPress={() => void handleSelectAvatar(option.id)}
                          style={({ pressed }) => [
                            styles.avatarOption,
                            isSelected && styles.avatarOptionSelected,
                            savingAvatarId !== null && savingAvatarId !== option.id && styles.avatarOptionDisabled,
                            pressed && styles.pressed
                          ]}
                        >
                          <View
                            style={[
                              styles.avatarOptionInner,
                              {
                                backgroundColor: option.background,
                                borderColor: option.ring
                              }
                            ]}
                          >
                            <Ionicons color={option.foreground} name={option.icon} size={19} />
                          </View>
                          {isSelected ? (
                            <View style={styles.avatarOptionCheck}>
                              <Ionicons color="#ffffff" name="checkmark" size={10} />
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                  {avatarError ? <Text style={styles.inlineError}>{avatarError}</Text> : null}
                </View>
              )}
            </ScrollView>
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
                  <PrimaryButton label="EDIT" onPress={openProfileEditor} variant="secondary" />
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

      {activeTab === "shop" || activeTab === "profile" ? null : (
          <View style={styles.bottomDock}>
            <BottomTabs activeTab={activeTab} onChange={handleTabChange} />
          </View>
        )}
      </Animated.View>
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
  profileMainPane: {
    justifyContent: "flex-start",
    paddingTop: spacing.xs
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
  modeStack: {
    gap: spacing.sm
  },
  modeBestCard: {
    alignItems: "center",
    backgroundColor: "transparent",
    justifyContent: "center",
    width: 44
  },
  modeBestTop: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 12,
    paddingHorizontal: 2
  },
  modeBestLabel: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textShadowColor: "rgba(0, 0, 0, 0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1
  },
  modeBestBottom: {
    alignItems: "center",
    borderTopColor: "transparent",
    borderTopWidth: 0,
    justifyContent: "center",
    marginTop: -2,
    minHeight: 18
  },
  modeBestValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    textShadowColor: "rgba(0, 0, 0, 0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1
  },
  onlineVsBadge: {
    alignItems: "center",
    justifyContent: "center"
  },
  onlineVsBadgeText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.3,
    lineHeight: 26,
    paddingHorizontal: 10,
    textShadowColor: "rgba(0, 0, 0, 0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1
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
  profileStatusRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  profileTopBar: {
    alignItems: "center",
    borderBottomColor: "#e2e6e1",
    borderBottomWidth: 1,
    flexDirection: "row",
    marginHorizontal: -spacing.md,
    marginBottom: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2
  },
  profileTopBarBack: {
    alignItems: "center",
    borderRadius: radii.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  profileTopBarSpacer: {
    width: 32
  },
  profileRouteTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: "center"
  },
  profileScroll: {
    marginHorizontal: -spacing.md
  },
  profileScrollContent: {
    gap: 0,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md
  },
  profileHeroShell: {
    alignSelf: "flex-start",
    backgroundColor: colors.background,
    gap: 2,
    marginTop: -spacing.xs,
    overflow: "visible",
    paddingBottom: 10,
    paddingHorizontal: 0,
    paddingTop: 8
  },
  profileHeroHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 34
  },
  profileHeroBackButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 34,
    justifyContent: "center",
    width: 34,
    ...shadows.card
  },
  profileHeroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.xs,
    marginHorizontal: 0,
    marginTop: 18,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    position: "relative",
    ...shadows.card
  },
  profileHeroAvatarWrap: {
    alignItems: "center",
    justifyContent: "center",
    left: "50%",
    position: "absolute"
  },
  profileHeroShadow: {
    backgroundColor: "rgba(47, 50, 51, 0.12)",
    borderRadius: radii.pill,
    bottom: 8,
    height: 12,
    position: "absolute",
    width: "62%"
  },
  profileHeroAvatar: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 4,
    justifyContent: "center",
    ...shadows.tactile
  },
  profileHeroName: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.2,
    lineHeight: 26,
    marginTop: 1,
    textAlign: "center"
  },
  profileHeroProgressCluster: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 4,
    paddingHorizontal: 18
  },
  profileHeroLevelBurst: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: radii.pill,
    justifyContent: "center",
    position: "relative",
    zIndex: 2
  },
  profileHeroLevelBurstSvg: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  profileHeroLevelBurstText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18,
    textShadowColor: colors.darkSurface,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1
  },
  profileHeroProgressTrack: {
    backgroundColor: colors.darkSurface,
    borderColor: colors.borderStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    height: 34,
    justifyContent: "center",
    marginLeft: -8,
    overflow: "hidden",
    position: "relative"
  },
  profileHeroProgressFill: {
    backgroundColor: colors.online,
    borderRadius: radii.pill,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0
  },
  profileHeroProgressFillGloss: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    height: "42%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  profileHeroProgressTrackGloss: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    height: "45%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  profileHeroProgressValue: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18,
    textAlign: "center",
    textShadowColor: colors.darkSurface,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    zIndex: 1
  },
  profileSectionBar: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
    backgroundColor: "transparent",
    borderBottomColor: colors.border,
    borderBottomWidth: 3,
    flexDirection: "column",
    justifyContent: "flex-end",
    marginTop: 6
  },
  profileSectionTabs: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 4
  },
  profileSectionTab: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.xs,
    paddingTop: 2
  },
  profileSectionTabActive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1
  },
  profileSectionTabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2
  },
  profileSectionTabTextActive: {
    color: colors.accent
  },
  profileSectionTabIcon: {
    alignItems: "center",
    backgroundColor: colors.practice,
    borderRadius: radii.pill,
    height: 18,
    justifyContent: "center",
    width: 18
  },
  profilePanel: {
    alignSelf: "flex-start",
    gap: 10,
    marginTop: 8
  },
  profileStatsPanel: {
    alignSelf: "flex-start",
    gap: 12,
    marginTop: 8
  },
  profileStatsHeroGrid: {
    gap: 8
  },
  profileStatsHeroCard: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 24,
    gap: 4,
    minHeight: 108,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: "relative",
    ...shadows.card
  },
  profileStatsHeroCardPrimary: {
    backgroundColor: "#f7fbf7"
  },
  profileStatsHeroCardAccent: {
    backgroundColor: "#f5f9fc"
  },
  profileStatsHeroGlow: {
    borderRadius: radii.pill,
    position: "absolute"
  },
  profileStatsHeroGlowPrimaryA: {
    backgroundColor: "rgba(46, 204, 113, 0.16)",
    height: 124,
    right: -18,
    top: -18,
    width: 124
  },
  profileStatsHeroGlowPrimaryB: {
    backgroundColor: "rgba(0, 109, 55, 0.08)",
    height: 88,
    left: -16,
    top: 28,
    width: 88
  },
  profileStatsHeroGlowAccentA: {
    backgroundColor: "rgba(92, 184, 253, 0.18)",
    height: 124,
    right: -16,
    top: -20,
    width: 124
  },
  profileStatsHeroGlowAccentB: {
    backgroundColor: "rgba(15, 95, 135, 0.08)",
    height: 96,
    left: -14,
    top: 34,
    width: 96
  },
  profileStatsHeroTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    zIndex: 1
  },
  profileStatsHeroBadge: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  profileStatsHeroBadgePrimary: {
    backgroundColor: "#dcf7e5"
  },
  profileStatsHeroBadgeAccent: {
    backgroundColor: "#d9effd"
  },
  profileStatsHeroTag: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderColor: "rgba(25, 28, 29, 0.06)",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  profileStatsHeroTagText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsHeroLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    zIndex: 1
  },
  profileStatsHeroValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
    zIndex: 1
  },
  profileStatsHeroCaption: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 2,
    zIndex: 1
  },
  profileStatsHeroMeterTrack: {
    backgroundColor: "rgba(25, 28, 29, 0.08)",
    borderRadius: radii.pill,
    height: 7,
    marginTop: 12,
    overflow: "hidden",
    zIndex: 1
  },
  profileStatsHeroMeterFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  profileStatsHeroMeterFillPrimary: {
    backgroundColor: colors.accent
  },
  profileStatsHeroMeterFillAccent: {
    backgroundColor: colors.online
  },
  profileStatsMiniRow: {
    flexDirection: "row",
    gap: 8
  },
  profileStatsMiniCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minHeight: 76,
    overflow: "hidden",
    paddingHorizontal: 12,
    position: "relative",
    paddingVertical: 10,
    ...shadows.card
  },
  profileStatsMiniCardWarm: {
    backgroundColor: "#fff3d6",
    borderColor: "#f4cd74"
  },
  profileStatsMiniCardCool: {
    backgroundColor: "#e8f5ff",
    borderColor: "#9cd8ff"
  },
  profileStatsMiniCardOnline: {
    backgroundColor: "#eaf8f0",
    borderColor: "#93d1aa"
  },
  profileStatsMiniTopRow: {
    alignItems: "flex-start",
    marginBottom: 8
  },
  profileStatsMiniBadge: {
    alignItems: "center",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  profileStatsMiniBadgeWarm: {
    backgroundColor: "rgba(244, 205, 116, 0.4)"
  },
  profileStatsMiniBadgeCool: {
    backgroundColor: "rgba(156, 216, 255, 0.4)"
  },
  profileStatsMiniLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsMiniValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 30
  },
  profileStatsMiniCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 2
  },
  profileStatsFeatureCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadows.card
  },
  profileStatsSectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  profileStatsSectionEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  profileStatsSectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 23
  },
  profileStatsChip: {
    backgroundColor: colors.surfaceCool,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  profileStatsChipText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  profileStatsChart: {
    gap: 10
  },
  profileStatsChartRow: {
    gap: 5
  },
  profileStatsChartHead: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  profileStatsChartDot: {
    borderRadius: radii.pill,
    height: 10,
    width: 10
  },
  profileStatsChartLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "800"
  },
  profileStatsChartScore: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  profileStatsChartTrack: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    height: 12,
    overflow: "hidden"
  },
  profileStatsChartFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  profileStatsChartMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  profileStatsModeList: {
    gap: 10
  },
  profileStatsModeCard: {
    backgroundColor: "#f8fafa",
    borderColor: colors.surfaceAlt,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  profileStatsModeHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  profileStatsModeIdentity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10
  },
  profileStatsModeBadge: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  profileStatsModeBadgeCore: {
    borderRadius: radii.pill,
    height: 12,
    width: 12
  },
  profileStatsModeCopy: {
    flex: 1,
    gap: 1
  },
  profileStatsModeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  profileStatsModeMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  profileStatsModeMetrics: {
    alignItems: "flex-end",
    marginLeft: 10
  },
  profileStatsModeMetricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20
  },
  profileStatsModeMetricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  profileStatsModeBarTrack: {
    backgroundColor: "rgba(25, 28, 29, 0.08)",
    borderRadius: radii.pill,
    height: 10,
    overflow: "hidden"
  },
  profileStatsModeBarFill: {
    borderRadius: radii.pill,
    height: "100%"
  },
  profileStatsModeFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  profileStatsModeFooterText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  profileStatsMatchRow: {
    alignItems: "center",
    borderTopColor: colors.surfaceAlt,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingTop: 10
  },
  profileStatsMatchPill: {
    alignItems: "center",
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 28,
    minWidth: 64,
    paddingHorizontal: 10
  },
  profileStatsMatchPillText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4
  },
  profileStatsMatchCopy: {
    flex: 1,
    gap: 2
  },
  profileStatsMatchTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  profileStatsMatchSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  profileStatsEmptyState: {
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    borderRadius: 20,
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 18
  },
  profileStatsEmptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  profileStatsEmptyCaption: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center"
  },
  profilePanelEmpty: {
    alignSelf: "flex-start",
    backgroundColor: "transparent",
    minHeight: 132,
    marginTop: 8
  },
  profilePanelTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  profileNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 8
  },
  profileNameInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    minHeight: 42,
    paddingHorizontal: 12
  },
  profileNameAction: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    height: 42,
    justifyContent: "center",
    width: 42,
    ...shadows.card
  },
  profileNameActionDisabled: {
    opacity: 0.45
  },
  profileDivider: {
    backgroundColor: colors.surfaceMuted,
    height: 1,
    marginHorizontal: 8,
    opacity: 1
  },
  profilePanelHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between",
    marginHorizontal: 8
  },
  profilePanelHeaderCopy: {
    flex: 1,
    gap: 2
  },
  profilePanelCaption: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  profileCurrentBadge: {
    backgroundColor: colors.surfaceCool,
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 4
  },
  profileCurrentBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "space-between",
    marginTop: 2
  },
  avatarOption: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    position: "relative",
    width: "22%"
  },
  avatarOptionSelected: {
    transform: [{ scale: 1.02 }]
  },
  avatarOptionDisabled: {
    opacity: 0.45
  },
  avatarOptionInner: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 2.5,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  avatarOptionCheck: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderColor: "#ffffff",
    borderRadius: radii.pill,
    borderWidth: 1.5,
    bottom: 1,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    width: 18
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
    fontWeight: "800",
    marginHorizontal: 8
  },
  errorText: {
    color: colors.danger
  },
  pressed: {
    opacity: 0.84
  }
});
