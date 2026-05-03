import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenContainer } from "../components/ScreenContainer";
import { TextField } from "../components/TextField";
import { createRoom, joinRoom } from "../socket/onlineSocket";
import { useOnlineGameStore } from "../store/useOnlineGameStore";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { Difficulty, OnlineMode } from "../types/game.types";
import { colors, spacing } from "../utils/theme";
import { DEFAULT_DIFFICULTY, DIFFICULTY_CONFIG, getDifficultyRangeLabel } from "../../shared/difficulty";

type RuleMode = "classic" | "duel";
const difficultyOrder: Difficulty[] = ["easy", "hard", "impossible"];

export default function OnlineSetupScreen() {
  const [roomId, setRoomId] = useState("");
  const [ruleMode, setRuleMode] = useState<RuleMode>("classic");
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  const [loadingAction, setLoadingAction] = useState<"create" | "join" | null>(null);

  const isConnected = useOnlineGameStore((state) => state.isConnected);
  const errorMessage = useOnlineGameStore((state) => state.errorMessage);
  const setErrorMessage = useOnlineGameStore((state) => state.setErrorMessage);
  const setSession = useOnlineGameStore((state) => state.setSession);
  const displayName = usePlayerProgressStore((state) => state.displayName);

  const onlineMode: OnlineMode = ruleMode;

  const handleCreateRoom = async () => {
    try {
      setLoadingAction("create");
      setErrorMessage(null);

      const response = await createRoom(displayName.trim(), onlineMode, difficulty);
      setSession(response.player, response.room, onlineMode);
      router.replace("/online-lobby");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create room.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJoinRoom = async () => {
    try {
      setLoadingAction("join");
      setErrorMessage(null);

      const response = await joinRoom(roomId.trim().toUpperCase(), displayName.trim());
      setSession(response.player, response.room);
      router.replace("/online-lobby");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not join room.");
    } finally {
      setLoadingAction(null);
    }
  };

  const canCreate = displayName.trim().length >= 2;
  const canJoin = canCreate && roomId.trim().length >= 4;

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backLink, pressed && styles.backLinkPressed]}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Online</Text>
        <Text style={styles.title}>Choose A Mode</Text>
        <Text style={styles.subtitle}>
          Pick the room style, choose the number range for new rooms, then create a room or join one with a code.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.identityCard}>
          <Text style={styles.identityLabel}>Joining as</Text>
          <Text style={styles.identityValue}>{displayName}</Text>
          <Text style={styles.identityText}>Your online rooms use the username from your profile.</Text>
        </View>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setRuleMode("classic")}
            style={({ pressed }) => [
              styles.modeCard,
              ruleMode === "classic" && styles.modeCardActive,
              pressed && styles.modeCardPressed
            ]}
          >
            <Text style={styles.modeTitle}>Classic</Text>
            <Text style={styles.modeText}>2 to 6 players guess one shared hidden number.</Text>
          </Pressable>

          <Pressable
            onPress={() => setRuleMode("duel")}
            style={({ pressed }) => [
              styles.modeCard,
              ruleMode === "duel" && styles.modeCardActive,
              pressed && styles.modeCardPressed
            ]}
          >
            <Text style={styles.modeTitle}>Duel</Text>
            <Text style={styles.modeText}>2 players choose secret numbers and guess each other.</Text>
          </Pressable>
        </View>

        <View style={styles.modeRow}>
          {difficultyOrder.map((currentDifficulty) => (
            <Pressable
              key={currentDifficulty}
              onPress={() => setDifficulty(currentDifficulty)}
              style={({ pressed }) => [
                styles.modeCard,
                difficulty === currentDifficulty && styles.modeCardActive,
                pressed && styles.modeCardPressed
              ]}
            >
              <Text style={styles.modeTitle}>{DIFFICULTY_CONFIG[currentDifficulty].label}</Text>
              <Text style={styles.modeText}>Range {getDifficultyRangeLabel(currentDifficulty)}</Text>
            </Pressable>
          ))}
        </View>

        <PrimaryButton
          disabled={!canCreate}
          label={
            ruleMode === "classic"
              ? `Create ${DIFFICULTY_CONFIG[difficulty].label} Online Classic Room`
              : `Create ${DIFFICULTY_CONFIG[difficulty].label} Online Duel Room`
          }
          loading={loadingAction === "create"}
          onPress={handleCreateRoom}
        />
      </View>

      <View style={styles.card}>
        <TextField
          autoCapitalize="characters"
          label="Room code"
          maxLength={6}
          onChangeText={(value) => setRoomId(value.toUpperCase())}
          placeholder="Enter room code"
          value={roomId}
        />

        <PrimaryButton
          disabled={!canJoin}
          label="Join Online Room"
          loading={loadingAction === "join"}
          onPress={handleJoinRoom}
          variant="secondary"
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.connection}>
          {isConnected ? "Server connected" : "Connecting to server..."}
        </Text>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backLink: {
    alignSelf: "flex-start",
    marginTop: spacing.md
  },
  backLinkPressed: {
    opacity: 0.8
  },
  backText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  hero: {
    gap: spacing.sm
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "800"
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md
  },
  identityCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.xs
  },
  identityLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  identityValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800"
  },
  identityText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  modeRow: {
    gap: spacing.sm
  },
  modeCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.xs
  },
  modeCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surface
  },
  modeCardPressed: {
    opacity: 0.9
  },
  modeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  modeText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  footer: {
    gap: spacing.sm
  },
  connection: {
    color: colors.textMuted,
    fontSize: 13
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600"
  }
});
