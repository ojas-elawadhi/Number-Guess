import Purchases, {
  AdFormat,
  AdMediatorName,
  AdRevenuePrecision,
  type AdDisplayedData,
  type AdFailedToLoadData,
  type AdFormat as RevenueCatAdFormat,
  type AdLoadedData,
  type AdOpenedData,
  type AdRevenueData
} from "react-native-purchases";
import { RevenuePrecisions, type PaidEvent } from "react-native-google-mobile-ads";

const NETWORK_NAME = "Google Ads";

export const createAdImpressionId = (placement: string) =>
  `${placement}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

const toRevenueCatPrecision = (precision: PaidEvent["precision"]) => {
  switch (precision) {
    case RevenuePrecisions.PRECISE:
      return AdRevenuePrecision.exact;
    case RevenuePrecisions.PUBLISHER_PROVIDED:
      return AdRevenuePrecision.publisherDefined;
    case RevenuePrecisions.ESTIMATED:
      return AdRevenuePrecision.estimated;
    default:
      return AdRevenuePrecision.unknown;
  }
};

const trackSafely = async (track: () => Promise<void>) => {
  try {
    if (!(await Purchases.isConfigured())) {
      return;
    }

    await track();
  } catch (error) {
    if (__DEV__) {
      console.warn("[ads] Could not send ad event to RevenueCat.", error);
    }
  }
};

const baseAdData = (
  adFormat: RevenueCatAdFormat,
  adUnitId: string,
  placement: string,
  impressionId: string
) => ({
  adFormat,
  adUnitId,
  impressionId,
  mediatorName: AdMediatorName.adMob,
  networkName: NETWORK_NAME,
  placement
});

export const trackAdLoaded = (
  adFormat: RevenueCatAdFormat,
  adUnitId: string,
  placement: string,
  impressionId: string
) => {
  const data: AdLoadedData = baseAdData(adFormat, adUnitId, placement, impressionId);
  void trackSafely(() => Purchases.adTracker.trackAdLoaded(data));
};

export const trackAdDisplayed = (
  adFormat: RevenueCatAdFormat,
  adUnitId: string,
  placement: string,
  impressionId: string
) => {
  const data: AdDisplayedData = baseAdData(adFormat, adUnitId, placement, impressionId);
  void trackSafely(() => Purchases.adTracker.trackAdDisplayed(data));
};

export const trackAdOpened = (
  adFormat: RevenueCatAdFormat,
  adUnitId: string,
  placement: string,
  impressionId: string
) => {
  const data: AdOpenedData = baseAdData(adFormat, adUnitId, placement, impressionId);
  void trackSafely(() => Purchases.adTracker.trackAdOpened(data));
};

export const trackAdRevenue = (
  adFormat: RevenueCatAdFormat,
  adUnitId: string,
  placement: string,
  impressionId: string,
  event: PaidEvent
) => {
  const data: AdRevenueData = {
    ...baseAdData(adFormat, adUnitId, placement, impressionId),
    currency: event.currency,
    precision: toRevenueCatPrecision(event.precision),
    revenueMicros: Math.round(event.value * 1_000_000)
  };

  void trackSafely(() => Purchases.adTracker.trackAdRevenue(data));
};

export const trackAdFailedToLoad = (
  adFormat: RevenueCatAdFormat,
  adUnitId: string,
  placement: string
) => {
  const data: AdFailedToLoadData = {
    adFormat,
    adUnitId,
    mediatorName: AdMediatorName.adMob,
    placement
  };

  void trackSafely(() => Purchases.adTracker.trackAdFailedToLoad(data));
};

export { AdFormat };
