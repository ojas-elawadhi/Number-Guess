import { Stack } from "expo-router";
import { useEffect } from "react";

import { connectSocket } from "../src/socket/onlineSocket";
import { usePlayerProgressStore } from "../src/store/usePlayerProgressStore";

export default function RootLayout() {
  const hydrateProgress = usePlayerProgressStore((state) => state.hydrate);

  useEffect(() => {
    connectSocket();
    hydrateProgress().catch(() => {
      // Keep the app usable even if local progression data fails to load.
    });
  }, [hydrateProgress]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: "#08111f"
        }
      }}
    />
  );
}
