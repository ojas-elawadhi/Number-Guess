import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "../components/ScreenContainer";
import { TopBar } from "../components/GameKit";
import { CoinIcon } from "../components/CoinIcon";
import { profileAvatarOptions } from "../config/avatarCatalog";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { DailyPuzzleLeaderboardEntry, DailyPuzzleLeaderboardResponse } from "../types/progression.types";
import { formatDuration } from "../utils/progression";
import { colors, radii, shadows, spacing } from "../utils/theme";
import { formatPlayLabel, getUtcTodayKey } from "../utils/dailyPuzzle";

const rankTones: Record<number, { background: string; border: string; text: string }> = {
  1: { background: "#ffd766", border: "#bd8313", text: "#5b3900" },
  2: { background: "#e8edf3", border: "#94a3b8", text: "#334155" },
  3: { background: "#f0b079", border: "#a85f2d", text: "#52260d" }
};

const fallbackRankTone = {
  background: "#f7f8f5",
  border: "#d8ded5",
  text: "#34413a"
};

const avatarById = new Map(profileAvatarOptions.map((option) => [option.id, option]));

const getRewardLabel = (entry: DailyPuzzleLeaderboardEntry) => {
  if (!entry.rewardEligible || entry.rewardCoins <= 0) {
    return null;
  }

  if (entry.rewardCoinsAwarded > 0) {
    return `+${entry.rewardCoinsAwarded.toLocaleString("en-US")}`;
  }

  return `+${entry.rewardCoins.toLocaleString("en-US")}`;
};

function LeaderboardRow({ entry, isDetachedPlayer = false }: { entry: DailyPuzzleLeaderboardEntry; isDetachedPlayer?: boolean }) {
  const rankTone = rankTones[entry.rank] ?? fallbackRankTone;
  const rewardLabel = getRewardLabel(entry);
  const avatar = avatarById.get(entry.avatarId) ?? profileAvatarOptions[0];
  const isPlayerRow = Boolean(entry.isPlayer || isDetachedPlayer);
  const isTopThree = entry.rank <= 3;

  return (
    <View style={[styles.rowCard, isPlayerRow && styles.rowCardPlayer]}>
      <View
        style={[
          styles.rankBadge,
          { backgroundColor: rankTone.background, borderColor: rankTone.border },
          isPlayerRow && styles.rankBadgePlayer
        ]}
      >
        {isTopThree ? (
          <Ionicons color={rankTone.text} name={entry.rank === 1 ? "trophy" : "medal"} size={11} />
        ) : (
          <Text style={[styles.rankHash, { color: rankTone.text }, isPlayerRow && styles.playerTextSoft]}>#</Text>
        )}
        <Text style={[styles.rankText, { color: rankTone.text }, isPlayerRow && styles.playerText]}>{entry.rank}</Text>
      </View>

      <View style={styles.avatarWrap}>
        <View
          style={[
            styles.avatarFrame,
            { borderColor: avatar.ring, backgroundColor: avatar.background },
            isPlayerRow && styles.avatarFramePlayer
          ]}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={{ cache: "force-cache", uri: avatar.imageUrl }}
            style={styles.avatarImage}
          />
        </View>
        {isTopThree ? (
          <View style={[styles.medalDot, { backgroundColor: rankTone.background, borderColor: rankTone.border }]}>
            <Text style={[styles.medalDotText, { color: rankTone.text }]}>{entry.rank}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.playerCopy}>
        <View style={styles.nameLine}>
          <Text numberOfLines={1} style={[styles.playerName, isPlayerRow && styles.playerNameActive]}>
            {entry.name}
          </Text>
          {entry.isPlayer ? (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>You</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.playerMeta, isPlayerRow && styles.playerMetaActive]}>
          {formatDuration(entry.durationMs)} {entry.rewardEligible ? "| Eligible" : "| Replay"}
        </Text>
      </View>

      <View style={styles.resultStack}>
        <View style={[styles.guessPill, isPlayerRow && styles.guessPillPlayer]}>
          <Text style={[styles.attemptValue, isPlayerRow && styles.playerText]}>{entry.attempts}</Text>
          <Text style={[styles.attemptLabel, isPlayerRow && styles.playerTextSoft]}>guesses</Text>
        </View>
        {rewardLabel ? (
          <View style={[styles.rewardPill, isPlayerRow && styles.rewardPillPlayer]}>
            <CoinIcon size={13} />
            <Text numberOfLines={1} style={[styles.rewardLabel, isPlayerRow && styles.rewardLabelPlayer]}>{rewardLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function DailyPuzzleLeaderboardScreen() {
  const params = useLocalSearchParams<{ dateKey?: string }>();
  const hydrated = usePlayerProgressStore((state) => state.hydrated);
  const fetchDailyPuzzleLeaderboard = usePlayerProgressStore((state) => state.fetchDailyPuzzleLeaderboard);
  const dateKey = typeof params.dateKey === "string" ? params.dateKey : getUtcTodayKey();
  const [response, setResponse] = useState<DailyPuzzleLeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const nextResponse = await fetchDailyPuzzleLeaderboard(dateKey);

        if (mounted) {
          setResponse(nextResponse);
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(error instanceof Error ? error.message : "Could not load leaderboard.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    load().catch(() => {});

    return () => {
      mounted = false;
    };
  }, [dateKey, fetchDailyPuzzleLeaderboard, hydrated]);

  const detachedPlayerEntry = useMemo(() => {
    if (!response?.playerEntry) {
      return null;
    }

    return response.topEntries.some((entry) => entry.playerKey === response.playerEntry?.playerKey)
      ? null
      : response.playerEntry;
  }, [response]);

  const prizeEntries = useMemo(
    () =>
      [1, 2, 3]
        .map((rank) => ({
          rank,
          coins: response?.rewardConfig[rank] ?? 0
        }))
        .filter((entry) => entry.coins > 0),
    [response]
  );

  if (!hydrated || isLoading) {
    return (
      <ScreenContainer contentStyle={styles.loadingScreen}>
        <ActivityIndicator color={colors.warning} size="large" />
        <Text style={styles.loadingTitle}>Loading leaderboard</Text>
        <Text style={styles.loadingBody}>Ranking today&apos;s daily clears.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <TopBar
        accent={colors.warning}
        label="Daily Puzzle"
        onBack={() => router.replace("/daily-puzzle")}
        title="HIGHER LOWER"
        variant="header-only"
      />

      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerIcon}>
            <Ionicons color="#ffffff" name="podium" size={22} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{formatPlayLabel(dateKey)} Ranks</Text>
            <Text style={styles.headerBody}>
              Fewest guesses wins. Coin prizes close at UTC midnight.
            </Text>
          </View>
        </View>
        {prizeEntries.length > 0 ? (
          <View style={styles.prizeStrip}>
            {prizeEntries.map((entry) => {
              const rankTone = rankTones[entry.rank] ?? fallbackRankTone;

              return (
                <View key={entry.rank} style={styles.prizeChip}>
                  <View style={[styles.prizeRankDot, { backgroundColor: rankTone.background, borderColor: rankTone.border }]}>
                    <Text style={[styles.prizeRankText, { color: rankTone.text }]}>{entry.rank}</Text>
                  </View>
                  <CoinIcon size={15} />
                  <Text style={styles.prizeText}>{entry.coins.toLocaleString("en-US")}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {errorMessage ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Leaderboard unavailable</Text>
          <Text style={styles.emptyBody}>{errorMessage}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {response && response.topEntries.length > 0 ? (
            <View style={styles.leaderboardShell}>
              {response.topEntries.map((entry) => <LeaderboardRow entry={entry} key={entry.playerKey} />)}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No clears yet</Text>
              <Text style={styles.emptyBody}>Be the first player to lock in this daily puzzle.</Text>
            </View>
          )}

          {detachedPlayerEntry ? (
            <>
              <View style={styles.detachedDivider}>
                <Text style={styles.detachedDividerText}>Your rank</Text>
              </View>
              <LeaderboardRow entry={detachedPlayerEntry} isDetachedPlayer />
            </>
          ) : null}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
  headerCard: {
    backgroundColor: colors.surface,
    borderColor: "#e7eadd",
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadows.card
  },
  headerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: colors.warning,
    borderBottomColor: "#c78613",
    borderBottomWidth: 4,
    borderRadius: radii.pill,
    height: 46,
    justifyContent: "center",
    width: 46
  },
  headerCopy: {
    flex: 1,
    gap: 3
  },
  headerTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900"
  },
  headerBody: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  prizeStrip: {
    backgroundColor: "#f5f7f2",
    borderColor: "#e4eadf",
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    padding: 6
  },
  prizeChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#e2e7df",
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: 6
  },
  prizeRankDot: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 18,
    justifyContent: "center",
    width: 18
  },
  prizeRankText: {
    fontSize: 10,
    fontWeight: "900"
  },
  prizeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900"
  },
  listContent: {
    gap: spacing.xs,
    paddingBottom: spacing.lg
  },
  leaderboardShell: {
    backgroundColor: colors.darkSurface,
    borderColor: "#232728",
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
    padding: 5,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4
  },
  rowCard: {
    alignItems: "center",
    backgroundColor: "#fffdf7",
    borderColor: "#ede6d8",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 64,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  rowCardPlayer: {
    backgroundColor: "#f255b6",
    borderColor: "#ff9bd7"
  },
  rankBadge: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  rankBadgePlayer: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.46)"
  },
  rankHash: {
    fontSize: 8,
    fontWeight: "900",
    lineHeight: 9
  },
  rankText: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 14
  },
  avatarWrap: {
    height: 48,
    justifyContent: "center",
    position: "relative",
    width: 48
  },
  avatarFrame: {
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 46,
    justifyContent: "center",
    overflow: "hidden",
    width: 46
  },
  avatarFramePlayer: {
    borderColor: "#ffffff"
  },
  avatarImage: {
    height: 41,
    width: 41
  },
  medalDot: {
    alignItems: "center",
    borderColor: "#ffffff",
    borderRadius: radii.pill,
    borderWidth: 1,
    bottom: -1,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    right: -1,
    width: 18
  },
  medalDotText: {
    fontSize: 9,
    fontWeight: "900"
  },
  playerCopy: {
    flex: 1,
    minWidth: 0
  },
  nameLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minWidth: 0
  },
  playerName: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0
  },
  playerNameActive: {
    color: "#ffffff"
  },
  playerMeta: {
    color: "#596357",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2
  },
  playerMetaActive: {
    color: "#ffe8f6"
  },
  youBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  youBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  resultStack: {
    alignItems: "flex-end",
    gap: 4,
    minWidth: 78
  },
  guessPill: {
    alignItems: "center",
    backgroundColor: "#aeb5c3",
    borderBottomColor: "#8f98a8",
    borderBottomWidth: 2,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 28,
    minWidth: 74,
    paddingHorizontal: 8
  },
  guessPillPlayer: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderBottomColor: "rgba(0,0,0,0.18)",
    borderColor: "rgba(255,255,255,0.34)",
    borderWidth: 1
  },
  attemptValue: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 15
  },
  attemptLabel: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.2,
    textTransform: "uppercase"
  },
  rewardLabel: {
    color: "#8a5a00",
    fontSize: 9,
    fontWeight: "900"
  },
  rewardLabelPlayer: {
    color: "#5d2f00"
  },
  rewardPill: {
    alignItems: "center",
    backgroundColor: "#fff4cf",
    borderColor: "#f3d27d",
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 2,
    minHeight: 22,
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  rewardPillPlayer: {
    backgroundColor: "#fff4cf",
    borderColor: "#ffffff"
  },
  playerText: {
    color: "#ffffff"
  },
  playerTextSoft: {
    color: "rgba(255,255,255,0.84)"
  },
  detachedDivider: {
    alignItems: "center",
    marginTop: spacing.xs
  },
  detachedDividerText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#e4e9e6",
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: 5,
    padding: spacing.lg,
    ...shadows.card
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center"
  }
});
