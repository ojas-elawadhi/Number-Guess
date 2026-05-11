import { Stack } from "expo-router";
import { useEffect } from "react";

import { initializeMobileAds } from "../src/services/mobileAds";
import { connectSocket } from "../src/socket/onlineSocket";
import { usePlayerProgressStore } from "../src/store/usePlayerProgressStore";
import { colors } from "../src/utils/theme";

export default function RootLayout() {
  const hydrateProgress = usePlayerProgressStore((state) => state.hydrate);

  useEffect(() => {
    connectSocket();
    initializeMobileAds().catch(() => {
      // Rewarded ads should fail quietly so the game can still load.
    });
    hydrateProgress().catch(() => {
      // Keep the app usable even if local progression data fails to load.
    });
  }, [hydrateProgress]);

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
