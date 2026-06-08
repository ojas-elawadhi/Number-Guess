import { Stack, usePathname } from "expo-router";
import { useEffect } from "react";
import { useMonetizationStore } from "../src/store/useMonetizationStore";
import { usePlayerProgressStore } from "../src/store/usePlayerProgressStore";
import { colors } from "../src/utils/theme";

const shouldInitializeBilling = process.env.EXPO_PUBLIC_ENABLE_BILLING === "true";

export default function RootLayout() {
  const pathname = usePathname();
  const hydrateProgress = usePlayerProgressStore((state) => state.hydrate);
  const playerKey = usePlayerProgressStore((state) => state.playerKey);
  const setHasNoAdsEntitlement = useMonetizationStore((state) => state.setHasNoAdsEntitlement);
  void pathname;

  useEffect(() => {
    Promise.resolve(hydrateProgress?.()).catch(() => {
      // Keep the app usable even if local progression data fails to load.
    });
  }, [hydrateProgress]);

  useEffect(() => {
    import("../src/services/mobileAds")
      .then(async ({ initializeMobileAds }) => {
        await initializeMobileAds();
        const { prepareInterstitialAd } = await import("../src/services/interstitialAd");
        await prepareInterstitialAd();
      })
      .catch(() => {
        // Ads should fail quietly until unit IDs and native setup are ready.
      });
  }, []);

  useEffect(() => {
    if (!shouldInitializeBilling || !playerKey) {
      setHasNoAdsEntitlement(false);
      return;
    }

    import("../src/services/billing")
      .then(async ({ configureBilling, getBillingCustomerSnapshot }) => {
        configureBilling(playerKey);
        const customer = await getBillingCustomerSnapshot();
        setHasNoAdsEntitlement(customer.hasRemoveAds);
      })
      .catch(() => {
        // Billing should fail quietly until RevenueCat keys and store products are fully configured.
      });
  }, [playerKey, setHasNoAdsEntitlement]);

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
