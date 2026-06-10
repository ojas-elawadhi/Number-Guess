import { router, Stack, usePathname } from "expo-router";
import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";
import { invokeHardwareBackHandler } from "../src/hooks/useHardwareBackHandler";
import { useMonetizationStore } from "../src/store/useMonetizationStore";
import { usePlayerProgressStore } from "../src/store/usePlayerProgressStore";
import { colors } from "../src/utils/theme";

const shouldInitializeBilling = process.env.EXPO_PUBLIC_ENABLE_BILLING === "true";

export default function RootLayout() {
  const pathname = usePathname();
  const hydrateProgress = usePlayerProgressStore((state) => state.hydrate);
  const progressReady = usePlayerProgressStore((state) => state.progressReady);
  const playerKey = usePlayerProgressStore((state) => state.playerKey);
  const soundEffectsEnabled = usePlayerProgressStore((state) => state.profile.soundPlaceholdersEnabled);
  const setHasNoAdsEntitlement = useMonetizationStore((state) => state.setHasNoAdsEntitlement);
  const isGameplayRoute =
    pathname === "/single-player-game" ||
    pathname === "/daily-puzzle-game" ||
    pathname === "/online-game" ||
    pathname === "/vs-ai-classic" ||
    pathname === "/vs-ai-duel";

  useEffect(() => {
    Promise.resolve(hydrateProgress?.()).catch(() => {
      // Keep the app usable even if local progression data fails to load.
    });
  }, [hydrateProgress]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (invokeHardwareBackHandler()) {
        return true;
      }

      if (pathname === "/") {
        BackHandler.exitApp();
        return true;
      }

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/");
      }

      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [pathname]);

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

  useEffect(() => {
    let cancelled = false;

    import("../src/services/soundEffects")
      .then(({ initSoundEffects }) => {
        if (!cancelled) {
          initSoundEffects();
        }
      })
      .catch(() => {
        // Audio should fail quietly so the game can still load.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    import("../src/services/soundEffects")
      .then(({ initSoundEffects, startMenuMusic, stopMenuMusic }) => {
        if (cancelled) {
          return;
        }

        initSoundEffects();

        if (!progressReady) {
          return;
        }

        if (soundEffectsEnabled && !isGameplayRoute) {
          startMenuMusic();
          return;
        }

        stopMenuMusic();
      })
      .catch(() => {
        // Audio should never block navigation.
      });

    return () => {
      cancelled = true;

      import("../src/services/soundEffects")
        .then(({ stopMenuMusic }) => {
          stopMenuMusic();
        })
        .catch(() => { });
    };
  }, [isGameplayRoute, progressReady, soundEffectsEnabled]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function" ||
      typeof window.removeEventListener !== "function" ||
      !progressReady ||
      !soundEffectsEnabled ||
      isGameplayRoute
    ) {
      return;
    }

    let cancelled = false;
    const unlockMenuMusic = () => {
      import("../src/services/soundEffects")
        .then(({ startMenuMusic }) => {
          if (!cancelled) {
            startMenuMusic();
          }
        })
        .catch(() => { });
    };

    window.addEventListener("click", unlockMenuMusic, { once: true });
    window.addEventListener("keydown", unlockMenuMusic, { once: true });
    window.addEventListener("pointerdown", unlockMenuMusic, { once: true });
    window.addEventListener("touchstart", unlockMenuMusic, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("click", unlockMenuMusic);
      window.removeEventListener("keydown", unlockMenuMusic);
      window.removeEventListener("pointerdown", unlockMenuMusic);
      window.removeEventListener("touchstart", unlockMenuMusic);
    };
  }, [isGameplayRoute, progressReady, soundEffectsEnabled]);

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
