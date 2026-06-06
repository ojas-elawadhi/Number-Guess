import { Stack, usePathname } from "expo-router";
import { useEffect } from "react";
import { usePlayerProgressStore } from "../src/store/usePlayerProgressStore";
import { colors } from "../src/utils/theme";

const shouldInitializeBilling = process.env.EXPO_PUBLIC_ENABLE_BILLING === "true";

export default function RootLayout() {
  const pathname = usePathname();
  const hydrateProgress = usePlayerProgressStore((state) => state.hydrate);
  const playerKey = usePlayerProgressStore((state) => state.playerKey);
  void pathname;

  useEffect(() => {
    Promise.resolve(hydrateProgress?.()).catch(() => {
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
