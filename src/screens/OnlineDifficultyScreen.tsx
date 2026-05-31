import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useState } from "react";

import { DifficultyOptionCard } from "../components/DifficultyOptionCard";
import { TopBar } from "../components/GameKit";
import { ScreenContainer } from "../components/ScreenContainer";
import { playSound } from "../services/soundEffects";
import { createRoom } from "../socket/onlineSocket";
import { useOnlineGameStore } from "../store/useOnlineGameStore";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";
import type { Difficulty, OnlineMode } from "../types/game.types";
import { colors, radii, spacing } from "../utils/theme";

const difficultyOrder: Difficulty[] = ["easy", "hard", "impossible"];

const parseMode = (value: string | string[] | undefined): OnlineMode => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  return normalizedValue === "duel" ? "duel" : "classic";
};

export default function OnlineDifficultyScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = parseMode(params.mode);
  const [loadingDifficulty, setLoadingDifficulty] = useState<Difficulty | null>(null);

  const isConnected = useOnlineGameStore((state) => state.isConnected);
  const errorMessage = useOnlineGameStore((state) => state.errorMessage);
  const setErrorMessage = useOnlineGameStore((state) => state.setErrorMessage);
  const setSession = useOnlineGameStore((state) => state.setSession);
  const displayName = usePlayerProgressStore((state) => state.displayName);

  const accent = mode === "classic" ? colors.online : colors.success;
  const badgeLabel = mode === "classic" ? "ONLINE CLASSIC" : "ONLINE DUEL";

  const handleCreateRoom = async (difficulty: Difficulty) => {
    if (!isConnected || displayName.trim().length < 2) {
      playSound("error");
      setErrorMessage("Connect first and use a valid name.");
      return;
    }

    try {
      setLoadingDifficulty(difficulty);
      setErrorMessage(null);

      const response = await createRoom(displayName.trim(), mode, difficulty);
      setSession(response.player, response.room, mode);
      playSound("onlineNotify");
      router.push({
        pathname: "/online-lobby",
        params: { returnTo: "/online-difficulty", mode }
      });
    } catch (error) {
      playSound("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not create room.");
    } finally {
      setLoadingDifficulty(null);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <TopBar
        accent={accent}
        label={badgeLabel}
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }

          router.replace("/online");
        }}
        title="HIGHER LOWER"
        variant="header-only"
      />

      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: `${accent}14`, borderColor: `${accent}32` }]}>
          <Text style={[styles.badgeText, { color: accent }]}>{badgeLabel}</Text>
        </View>
      </View>

      <View style={styles.stack}>
        {difficultyOrder.map((currentDifficulty) => (
          <View key={currentDifficulty} style={styles.cardWrap}>
            <DifficultyOptionCard difficulty={currentDifficulty} onPress={() => handleCreateRoom(currentDifficulty)} />
            {loadingDifficulty === currentDifficulty ? (
              <Text style={styles.loadingText}>Creating room...</Text>
            ) : null}
          </View>
        ))}
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
  badgeText: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  stack: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center"
  },
  cardWrap: {
    gap: spacing.xs
  },
  loadingText: {
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
