import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams, useRootNavigationState } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "../components/ScreenContainer";
import { TopBar } from "../components/GameKit";
import { playSound } from "../services/soundEffects";
import { leaveRoom, startGame } from "../socket/onlineSocket";
import { useOnlineGameStore } from "../store/useOnlineGameStore";
import { colors, radii, spacing } from "../utils/theme";
import { DIFFICULTY_CONFIG } from "../../shared/difficulty";

export default function OnlineLobbyScreen() {
  const params = useLocalSearchParams<{ returnTo?: string; mode?: string }>();
  const rootNavigationState = useRootNavigationState();
  const [isStarting, setIsStarting] = useState(false);
  const [copySuccessMessage, setCopySuccessMessage] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const player = useOnlineGameStore((state) => state.player);
  const room = useOnlineGameStore((state) => state.room);
  const errorMessage = useOnlineGameStore((state) => state.errorMessage);
  const setErrorMessage = useOnlineGameStore((state) => state.setErrorMessage);
  const resetAll = useOnlineGameStore((state) => state.resetAll);

  const isHost = useMemo(() => {
    if (!player || !room) {
      return false;
    }

    return room.hostId === player.id;
  }, [player, room]);

  useEffect(() => {
    if (!rootNavigationState?.key) {
      return;
    }

    if (!player || !room) {
      return;
    }

    if (room.gameState === "playing") {
      router.replace("/online-game");
    }
  }, [player, room, rootNavigationState?.key]);

  const handleReturnToOnline = () => {
    router.replace("/online");
  };

  if (!room || !player) {
    return (
      <ScreenContainer contentStyle={styles.screen}>
        <TopBar
          accent={colors.online}
          label="Lobby"
          onBack={handleReturnToOnline}
          title="HIGHER LOWER"
          variant="header-only"
        />

        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Room not open anymore</Text>
          <Text style={styles.emptyText}>Go back to Online and enter the room code again, or create a new room.</Text>
        </View>

        <View style={styles.spacer} />

        <Pressable onPress={handleReturnToOnline} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
          <Text style={styles.primaryActionText}>BACK TO ONLINE</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const mode = room.mode ?? "classic";
  const difficulty = room.difficulty ?? "easy";
  const maxPlayers = room.maxPlayers ?? (mode === "duel" ? 2 : 6);
  const canStart = mode === "duel" ? room.players.length === 2 : room.players.length >= 2;
  const lastWinner = room.players.find((currentPlayer) => currentPlayer.id === room.winner);
  const handleStartGame = async () => {
    try {
      setIsStarting(true);
      setErrorMessage(null);
      await startGame(room.roomId);
      playSound("countdownGo");
    } catch (error) {
      playSound("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not start.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleLeaveRoom = async () => {
    try {
      playSound("back");
      setIsLeaving(true);
      setErrorMessage(null);
      await leaveRoom(room.roomId);
    } catch (error) {
      setIsLeaving(false);
      playSound("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not leave.");
      return;
    }

    resetAll();

    if (params.returnTo === "/online-difficulty") {
      router.replace({
        pathname: "/online-difficulty",
        params: { mode: params.mode === "duel" ? "duel" : "classic" }
      });
      return;
    }

    router.replace("/online");
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(room.roomId);
    setCopySuccessMessage("Copied");
    playSound("onlineNotify");
  };

  const handleShareCode = async () => {
    await Share.share({
      message: `Join my Code Guess room: ${room.roomId}`
    });
    playSound("onlineNotify");
  };

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <TopBar
        accent={colors.online}
        label="Lobby"
        onBack={handleLeaveRoom}
        title="HIGHER LOWER"
        variant="header-only"
      />

      <View style={styles.roomPanel}>
        <View style={styles.roomMetaRow}>
          <View style={styles.summaryPill}>
            <Text numberOfLines={1} style={styles.summaryText}>
              {`${mode === "duel" ? "Duel Match" : "Classic Match"} - ${DIFFICULTY_CONFIG[difficulty].label}`}
            </Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{room.players.length}/{maxPlayers}</Text>
          </View>
        </View>

        <View style={styles.roomCodeWrap}>
          <Text style={styles.roomCode}>{room.roomId}</Text>
        </View>

        <View style={styles.copyRow}>
          <Pressable onPress={handleCopyCode} style={({ pressed }) => [styles.utilityButton, pressed && styles.pressed]}>
            <Ionicons color="#123a6a" name="copy-outline" size={20} />
            <Text style={styles.utilityText}>{copySuccessMessage ?? "Copy Code"}</Text>
          </Pressable>
          <Pressable onPress={handleShareCode} style={({ pressed }) => [styles.utilityButton, pressed && styles.pressed]}>
            <Ionicons color="#123a6a" name="share-social-outline" size={20} />
            <Text style={styles.utilityText}>Share Link</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.playersGrid}>
        {room.players.map((slotPlayer) => {
          const isSlotHost = slotPlayer.id === room.hostId;

          return (
            <View key={slotPlayer.id} style={styles.playerCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{slotPlayer.name.slice(0, 2).toUpperCase()}</Text>
              </View>

              <View style={styles.playerCopy}>
                <Text numberOfLines={1} style={styles.playerName}>
                  {slotPlayer.name}
                </Text>
                <View style={styles.playerStatusPill}>
                  <Text style={styles.playerStatusText}>{isSlotHost ? "HOST" : "JOINED"}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {lastWinner ? <Text style={styles.infoText}>Last winner: {lastWinner.name}</Text> : null}
      {!isHost ? <Text style={styles.infoText}>Waiting for host to start.</Text> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.spacer} />

      <View style={styles.actionRow}>
        {isHost ? (
          <Pressable
            disabled={!canStart || isStarting}
            onPress={handleStartGame}
            style={({ pressed }) => [
              styles.primaryAction,
              (!canStart || isStarting) && styles.actionDisabled,
              pressed && canStart && !isStarting && styles.pressed
            ]}
          >
            <Text style={styles.primaryActionText}>{isStarting ? "STARTING..." : "START"}</Text>
          </Pressable>
        ) : (
          <View style={[styles.primaryAction, styles.primaryActionWaiting]}>
            <Text style={styles.primaryActionText}>WAITING</Text>
          </View>
        )}

        <Pressable onPress={handleLeaveRoom} style={({ pressed }) => [styles.exitAction, pressed && styles.pressed]}>
          <Ionicons color="#20242b" name="exit-outline" size={24} />
          <Text style={styles.exitText}>Exit</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.md
  },
  roomPanel: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(92, 184, 253, 0.35)",
    borderRadius: 22,
    borderWidth: 1.5,
    gap: spacing.xs,
    padding: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3
  },
  roomMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  summaryPill: {
    alignItems: "center",
    backgroundColor: "#eef1f4",
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.sm
  },
  summaryText: {
    color: "#5c666f",
    fontSize: 12,
    fontWeight: "800"
  },
  countPill: {
    alignItems: "center",
    backgroundColor: "#eef1f4",
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 36,
    minWidth: 60,
    paddingHorizontal: spacing.sm
  },
  countText: {
    color: "#4f5963",
    fontSize: 13,
    fontWeight: "900"
  },
  roomCodeWrap: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: colors.online,
    borderRadius: radii.pill,
    borderWidth: 3,
    justifyContent: "center",
    marginTop: spacing.xs,
    minHeight: 82,
    paddingHorizontal: spacing.md
  },
  roomCode: {
    color: "#123a6a",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 2
  },
  copyRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  utilityButton: {
    alignItems: "center",
    backgroundColor: "#d8efff",
    borderBottomColor: "rgba(18, 58, 106, 0.2)",
    borderBottomWidth: 4,
    borderRadius: 16,
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    height: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.xs
  },
  utilityText: {
    color: "#123a6a",
    fontSize: 14,
    fontWeight: "900"
  },
  playersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  playerCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(92, 184, 253, 0.18)",
    borderRadius: 24,
    borderWidth: 1,
    flexBasis: "48%",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 108,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4
  },
  avatarCircle: {
    alignItems: "center",
    backgroundColor: "#edf6ff",
    borderColor: "rgba(92, 184, 253, 0.28)",
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 62,
    justifyContent: "center",
    width: 62
  },
  avatarText: {
    color: "#123a6a",
    fontSize: 18,
    fontWeight: "900"
  },
  playerCopy: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: "center"
  },
  playerName: {
    color: "#15181b",
    fontSize: 18,
    fontWeight: "800"
  },
  playerStatusPill: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    backgroundColor: "#677382",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  playerStatusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    gap: spacing.sm,
    padding: spacing.lg
  },
  emptyTitle: {
    color: "#15181b",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  emptyText: {
    color: "#6d757b",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  },
  infoText: {
    color: "#6d757b",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center"
  },
  spacer: {
    flex: 1
  },
  actionRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.sm
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: "#10db6d",
    borderBottomColor: "#07a551",
    borderBottomWidth: 6,
    borderRadius: 22,
    flex: 1,
    height: 72,
    justifyContent: "center"
  },
  primaryActionWaiting: {
    opacity: 0.7
  },
  primaryActionText: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1
  },
  exitAction: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#20242b",
    borderRadius: 22,
    borderWidth: 2,
    gap: 4,
    height: 72,
    justifyContent: "center",
    minWidth: 96,
    paddingHorizontal: spacing.sm
  },
  exitText: {
    color: "#20242b",
    fontSize: 16,
    fontWeight: "900"
  },
  actionDisabled: {
    opacity: 0.5
  },
  pressed: {
    transform: [{ scale: 0.99 }]
  }
});
