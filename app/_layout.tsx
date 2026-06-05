import { Stack, usePathname } from "expo-router";
import { useEffect } from "react";

import { initializeMobileAds } from "../src/services/mobileAds";
import { initSoundEffects, startMenuMusic, stopMenuMusic } from "../src/services/soundEffects";
import { connectSocket } from "../src/socket/onlineSocket";
import { usePlayerProgressStore } from "../src/store/usePlayerProgressStore";
import { colors } from "../src/utils/theme";

const shouldInitializeBilling = process.env.EXPO_PUBLIC_ENABLE_BILLING === "true";

export default function RootLayout() {
  const pathname = usePathname();
  const hydrateProgress = usePlayerProgressStore((state) => state.hydrate);
  const playerKey = usePlayerProgressStore((state) => state.playerKey);
  const soundEffectsEnabled = usePlayerProgressStore((state) => state.profile.soundPlaceholdersEnabled);
  const isGameplayRoute =
    pathname === "/single-player-game" ||
    pathname === "/daily-puzzle-game" ||
    pathname === "/online-game" ||
    pathname === "/vs-ai-classic" ||
    pathname === "/vs-ai-duel";

  useEffect(() => {
    connectSocket();
    initSoundEffects();
    initializeMobileAds().catch(() => {
      // Rewarded ads should fail quietly so the game can still load.
    });
    hydrateProgress().catch(() => {
      // Keep the app usable even if local progression data fails to load.
    });
  }, [hydrateProgress]);

  useEffect(() => {
    if (!shouldInitializeBilling || !playerKey) {
      return;
    }

    import("../src/services/billing")
      .then(({ configureBilling }) => configureBilling(playerKey))
      .catch(() => {
        // Billing should fail quietly until RevenueCat keys and store products are fully configured.
      });
  }, [playerKey]);

  useEffect(() => {
    if (soundEffectsEnabled && !isGameplayRoute) {
      startMenuMusic();
      return;
    }

    stopMenuMusic();
  }, [isGameplayRoute, soundEffectsEnabled]);

  useEffect(() => {
    if (typeof window === "undefined" || !soundEffectsEnabled || isGameplayRoute) {
      return;
    }

    const unlockMenuMusic = () => {
      startMenuMusic();
    };

    window.addEventListener("click", unlockMenuMusic, { once: true });
    window.addEventListener("keydown", unlockMenuMusic, { once: true });
    window.addEventListener("pointerdown", unlockMenuMusic, { once: true });
    window.addEventListener("touchstart", unlockMenuMusic, { once: true });

    return () => {
      window.removeEventListener("click", unlockMenuMusic);
      window.removeEventListener("keydown", unlockMenuMusic);
      window.removeEventListener("pointerdown", unlockMenuMusic);
      window.removeEventListener("touchstart", unlockMenuMusic);
    };
  }, [isGameplayRoute, soundEffectsEnabled]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background
        }
      }}
    />
  );
}
