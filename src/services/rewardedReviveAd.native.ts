import { Platform } from "react-native";
import type { PaidEvent } from "react-native-google-mobile-ads";

const REWARDED_LOAD_TIMEOUT_MS = 15000;

type GoogleMobileAdsModule = typeof import("react-native-google-mobile-ads");
type AdRevenueTrackingModule = typeof import("./adRevenueTracking");

let googleMobileAdsPromise: Promise<GoogleMobileAdsModule> | null = null;
let adRevenueTrackingPromise: Promise<AdRevenueTrackingModule> | null = null;

let activeRequest: Promise<boolean> | null = null;

const loadGoogleMobileAds = () => {
  googleMobileAdsPromise ??= import("react-native-google-mobile-ads");
  return googleMobileAdsPromise;
};

const loadAdRevenueTracking = () => {
  adRevenueTrackingPromise ??= import("./adRevenueTracking");
  return adRevenueTrackingPromise;
};

const getRewardedUnitId = (adsModule: GoogleMobileAdsModule) =>
  __DEV__
    ? adsModule.TestIds.REWARDED
    : Platform.select({
        android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_REVIVE_UNIT_ID_ANDROID,
        ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_REVIVE_UNIT_ID_IOS
      })?.trim() || null;

const hasConfiguredRewardedUnitId = () =>
  __DEV__ ||
  Boolean(
    Platform.select({
      android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_REVIVE_UNIT_ID_ANDROID,
      ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_REVIVE_UNIT_ID_IOS
    })?.trim()
  );

const trackSafely = (track: (trackingModule: AdRevenueTrackingModule) => void) => {
  void loadAdRevenueTracking()
    .then(track)
    .catch(() => {});
};

export const isRewardedReviveSupported = () => Platform.OS !== "web" && hasConfiguredRewardedUnitId();

export const showRewardedReviveAd = async () => {
  const adsModule = await loadGoogleMobileAds().catch(() => null);
  const rewardedUnitId = adsModule ? getRewardedUnitId(adsModule) : null;

  if (!adsModule || !rewardedUnitId) {
    return false;
  }

  if (activeRequest) {
    return activeRequest;
  }

  activeRequest = new Promise<boolean>((resolve) => {
    let rewardEarned = false;
    let settled = false;
    let cleanup = () => {};

    const impressionId = `revive_rewarded:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

    const resolveOnce = (value: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      activeRequest = null;
      resolve(value);
    };

    const loadTimeout = setTimeout(() => {
      resolveOnce(false);
    }, REWARDED_LOAD_TIMEOUT_MS);

    try {
      const rewardedAd = adsModule.RewardedAd.createForAdRequest(rewardedUnitId, {
        requestNonPersonalizedAdsOnly: true
      });

      const unsubscribeLoaded = rewardedAd.addAdEventListener(adsModule.RewardedAdEventType.LOADED, () => {
        trackSafely((tracking) => {
          tracking.trackAdLoaded(tracking.AdFormat.rewarded, rewardedUnitId, "revive_rewarded", impressionId);
        });
        void rewardedAd.show().catch(() => {
          resolveOnce(false);
        });
      });
      const unsubscribeOpened = rewardedAd.addAdEventListener(adsModule.AdEventType.OPENED, () => {
        trackSafely((tracking) => {
          tracking.trackAdDisplayed(tracking.AdFormat.rewarded, rewardedUnitId, "revive_rewarded", impressionId);
        });
      });
      const unsubscribeClicked = rewardedAd.addAdEventListener(adsModule.AdEventType.CLICKED, () => {
        trackSafely((tracking) => {
          tracking.trackAdOpened(tracking.AdFormat.rewarded, rewardedUnitId, "revive_rewarded", impressionId);
        });
      });
      const unsubscribePaid = rewardedAd.addAdEventListener(adsModule.AdEventType.PAID, ((event: PaidEvent) => {
        trackSafely((tracking) => {
          tracking.trackAdRevenue(tracking.AdFormat.rewarded, rewardedUnitId, "revive_rewarded", impressionId, event);
        });
      }) as never);
      const unsubscribeReward = rewardedAd.addAdEventListener(
        adsModule.RewardedAdEventType.EARNED_REWARD,
        () => {
          rewardEarned = true;
        }
      );
      const unsubscribeClosed = rewardedAd.addAdEventListener(adsModule.AdEventType.CLOSED, () => {
        resolveOnce(rewardEarned);
      });
      const unsubscribeError = rewardedAd.addAdEventListener(adsModule.AdEventType.ERROR, () => {
        trackSafely((tracking) => {
          tracking.trackAdFailedToLoad(tracking.AdFormat.rewarded, rewardedUnitId, "revive_rewarded");
        });
        resolveOnce(false);
      });

      cleanup = () => {
        clearTimeout(loadTimeout);
        unsubscribeLoaded();
        unsubscribeOpened();
        unsubscribeClicked();
        unsubscribePaid();
        unsubscribeReward();
        unsubscribeClosed();
        unsubscribeError();
      };

      rewardedAd.load();
    } catch {
      clearTimeout(loadTimeout);
      resolveOnce(false);
    }
  });

  return activeRequest;
};
