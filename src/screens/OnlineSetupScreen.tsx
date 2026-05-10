import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

import { ModeTile, TopBar } from "../components/GameKit";
import { ScreenContainer } from "../components/ScreenContainer";
import { TextField } from "../components/TextField";
import { joinRoom } from "../socket/onlineSocket";
import { useOnlineGameStore } from "../store/useOnlineGameStore";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import { colors, radii, spacing } from "../utils/theme";

type RuleMode = "classic" | "duel";

export default function OnlineSetupScreen() {
  const [roomId, setRoomId] = useState("");
  const [loadingAction, setLoadingAction] = useState<"join" | null>(null);

  const isConnected = useOnlineGameStore((state) => state.isConnected);
  const errorMessage = useOnlineGameStore((state) => state.errorMessage);
  const setErrorMessage = useOnlineGameStore((state) => state.setErrorMessage);
  const setSession = useOnlineGameStore((state) => state.setSession);
  const displayName = usePlayerProgressStore((state) => state.displayName);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/");
  };

  const handleJoinRoom = async () => {
    try {
      setLoadingAction("join");
      setErrorMessage(null);

      const response = await joinRoom(roomId.trim().toUpperCase(), displayName.trim());
      setSession(response.player, response.room);
      router.push({
        pathname: "/online-lobby",
        params: { returnTo: "/online" }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not join room.");
    } finally {
      setLoadingAction(null);
    }
  };

  const canContinue = isConnected && displayName.trim().length >= 2;
  const canJoin = canContinue && roomId.trim().length >= 4;

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <TopBar
        accent={colors.online}
        label="Online"
        onBack={handleBack}
        title="HIGHER LOWER"
        variant="header-only"
      />

      <View style={styles.badgeRow}>
        <View style={[styles.badge, styles.onlineBadge]}>
          <Text style={[styles.badgeText, styles.onlineBadgeText]}>ONLINE</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>Playing as {displayName}</Text>
        </View>
      </View>

      <View style={styles.stack}>
        <ModeTile
          accent={colors.online}
          icon="people"
          onPress={() => {
            if (!canContinue) {
              return;
            }

            router.push({
              pathname: "/online-difficulty",
              params: { mode: "classic" satisfies RuleMode }
            });
          }}
          subtitle="Shared target room"
          title="Classic Match"
        />
        <ModeTile
          accent={colors.success}
          icon="shield"
          onPress={() => {
            if (!canContinue) {
              return;
            }

            router.push({
              pathname: "/online-difficulty",
              params: { mode: "duel" satisfies RuleMode }
            });
          }}
          subtitle="Secret head to head"
          title="Duel Match"
        />
      </View>

      <View style={styles.actionStack}>
        {!canContinue ? <Text style={styles.infoText}>Connect and keep a valid name to create a room.</Text> : null}

        <View style={styles.joinPanel}>
          <TextField
            autoCapitalize="characters"
            label="Room code"
            maxLength={6}
            onChangeText={(value) => setRoomId(value.toUpperCase())}
            placeholder="ABC123"
            value={roomId}
          />
          <Pressable
            disabled={!canJoin || loadingAction !== null}
            onPress={handleJoinRoom}
            style={({ pressed }) => [
              styles.secondaryAction,
              (!canJoin || loadingAction !== null) && styles.actionDisabled,
              pressed && canJoin && loadingAction === null && styles.actionPressed
            ]}
          >
            <Text style={styles.secondaryActionText}>
              {loadingAction === "join" ? "JOINING..." : "JOIN ROOM >"}
            </Text>
          </Pressable>
        </View>
      </View>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
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
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: spacing.lg
  },
  onlineBadge: {
    backgroundColor: "rgba(92, 184, 253, 0.12)",
    borderColor: "rgba(92, 184, 253, 0.28)"
  },
  badgeText: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  onlineBadgeText: {
    color: colors.online
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    justifyContent: "center"
  },
  statusPill: {
    alignItems: "center",
    backgroundColor: "#edf0f1",
    borderRadius: radii.pill,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing.md
  },
  statusText: {
    color: "#616a70",
    fontSize: 12,
    fontWeight: "800"
  },
  stack: {
    gap: spacing.md
  },
  actionStack: {
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  joinPanel: {
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    gap: spacing.sm,
    padding: spacing.md
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: colors.online,
    borderBottomColor: "#2a8ad1",
    borderBottomWidth: 6,
    borderRadius: radii.pill,
    height: 54,
    justifyContent: "center"
  },
  secondaryActionText: {
    color: "#0d3f68",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1
  },
  actionDisabled: {
    opacity: 0.5
  },
  actionPressed: {
    transform: [{ scale: 0.99 }]
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
  }
});
