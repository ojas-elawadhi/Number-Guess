import { Platform } from "react-native";
import type { InterstitialAd, PaidEvent } from "react-native-google-mobile-ads";

const INTERSTITIAL_FREQUENCY = 3;
const INTERSTITIAL_LOAD_TIMEOUT_MS = 15000;

type GoogleMobileAdsModule = typeof import("react-native-google-mobile-ads");
type AdRevenueTrackingModule = typeof import("./adRevenueTracking");

let googleMobileAdsPromise: Promise<GoogleMobileAdsModule> | null = null;
let adRevenueTrackingPromise: Promise<AdRevenueTrackingModule> | null = null;

let currentAd: InterstitialAd | null = null;
let currentAdUnitId: string | null = null;
let isLoaded = false;
let isShowing = false;
let loadPromise: Promise<void> | null = null;
let loadResolver: (() => void) | null = null;
let closePromise: Promise<boolean> | null = null;
let closeResolver: ((value: boolean) => void) | null = null;
let opportunityCount = 0;
let hasPendingOpportunity = false;
let unsubscribeLoaded: (() => void) | null = null;
let unsubscribeClosed: (() => void) | null = null;
let unsubscribeError: (() => void) | null = null;
let unsubscribeOpened: (() => void) | null = null;
let unsubscribeClicked: (() => void) | null = null;
let unsubscribePaid: (() => void) | null = null;
let currentImpressionId: string | null = null;

const loadGoogleMobileAds = () => {
  googleMobileAdsPromise ??= import("react-native-google-mobile-ads");
  return googleMobileAdsPromise;
};

const loadAdRevenueTracking = () => {
  adRevenueTrackingPromise ??= import("./adRevenueTracking");
  return adRevenueTrackingPromise;
};

const getInterstitialUnitId = (adsModule: GoogleMobileAdsModule) =>
  __DEV__
    ? adsModule.TestIds.INTERSTITIAL
    : Platform.select({
        android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_ANDROID,
        ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_IOS
      })?.trim() || null;

const createLocalImpressionId = (placement: string) =>
  `${placement}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

const trackSafely = (track: (trackingModule: AdRevenueTrackingModule) => void) => {
  void loadAdRevenueTracking()
    .then(track)
    .catch(() => {});
};

const clearListeners = () => {
  unsubscribeLoaded?.();
  unsubscribeClosed?.();
  unsubscribeError?.();
  unsubscribeOpened?.();
  unsubscribeClicked?.();
  unsubscribePaid?.();
  unsubscribeLoaded = null;
  unsubscribeClosed = null;
  unsubscribeError = null;
  unsubscribeOpened = null;
  unsubscribeClicked = null;
  unsubscribePaid = null;
};

const finishLoad = () => {
  loadResolver?.();
  loadResolver = null;
  loadPromise = null;
};

const resetInterstitial = () => {
  clearListeners();
  currentAd = null;
  currentAdUnitId = null;
  isLoaded = false;
  isShowing = false;
  currentImpressionId = null;
};

const resolveClose = (value: boolean) => {
  closeResolver?.(value);
  closeResolver = null;
  closePromise = null;
};

export const prepareInterstitialAd = async () => {
  if (isLoaded || loadPromise) {
    return loadPromise ?? Promise.resolve();
  }

  const adsModule = await loadGoogleMobileAds().catch(() => null);
  const interstitialUnitId = adsModule ? getInterstitialUnitId(adsModule) : null;

  if (!adsModule || !interstitialUnitId) {
    resetInterstitial();
    return;
  }

  try {
    currentAd = adsModule.InterstitialAd.createForAdRequest(interstitialUnitId, {
      requestNonPersonalizedAdsOnly: true
    });
  } catch {
    resetInterstitial();
    return;
  }

  currentAdUnitId = interstitialUnitId;
  currentImpressionId = createLocalImpressionId("game_interstitial");

  loadPromise = new Promise<void>((resolve) => {
    loadResolver = resolve;
  });

  const loadTimeout = setTimeout(() => {
    resetInterstitial();
    finishLoad();
  }, INTERSTITIAL_LOAD_TIMEOUT_MS);

  unsubscribeLoaded = currentAd.addAdEventListener(adsModule.AdEventType.LOADED, () => {
    clearTimeout(loadTimeout);
    isLoaded = true;
    if (currentAdUnitId && currentImpressionId) {
      const adUnitId = currentAdUnitId;
      const impressionId = currentImpressionId;
      trackSafely((tracking) => {
        tracking.trackAdLoaded(
          tracking.AdFormat.interstitial,
          adUnitId,
          "game_interstitial",
          impressionId
        );
      });
    }
    finishLoad();
  });

  unsubscribeOpened = currentAd.addAdEventListener(adsModule.AdEventType.OPENED, () => {
    if (currentAdUnitId && currentImpressionId) {
      const adUnitId = currentAdUnitId;
      const impressionId = currentImpressionId;
      trackSafely((tracking) => {
        tracking.trackAdDisplayed(
          tracking.AdFormat.interstitial,
          adUnitId,
          "game_interstitial",
          impressionId
        );
      });
    }
  });

  unsubscribeClicked = currentAd.addAdEventListener(adsModule.AdEventType.CLICKED, () => {
    if (currentAdUnitId && currentImpressionId) {
      const adUnitId = currentAdUnitId;
      const impressionId = currentImpressionId;
      trackSafely((tracking) => {
        tracking.trackAdOpened(
          tracking.AdFormat.interstitial,
          adUnitId,
          "game_interstitial",
          impressionId
        );
      });
    }
  });

  unsubscribePaid = currentAd.addAdEventListener(adsModule.AdEventType.PAID, ((event: PaidEvent) => {
    if (currentAdUnitId && currentImpressionId) {
      const adUnitId = currentAdUnitId;
      const impressionId = currentImpressionId;
      trackSafely((tracking) => {
        tracking.trackAdRevenue(
          tracking.AdFormat.interstitial,
          adUnitId,
          "game_interstitial",
          impressionId,
          event
        );
      });
    }
  }) as never);

  unsubscribeClosed = currentAd.addAdEventListener(adsModule.AdEventType.CLOSED, () => {
    clearTimeout(loadTimeout);
    resolveClose(true);
    resetInterstitial();
    void prepareInterstitialAd();
  });

  unsubscribeError = currentAd.addAdEventListener(adsModule.AdEventType.ERROR, () => {
    clearTimeout(loadTimeout);
    trackSafely((tracking) => {
      tracking.trackAdFailedToLoad(tracking.AdFormat.interstitial, interstitialUnitId, "game_interstitial");
    });
    resolveClose(false);
    resetInterstitial();
    finishLoad();
  });

  try {
    currentAd.load();
  } catch {
    clearTimeout(loadTimeout);
    resetInterstitial();
    finishLoad();
  }

  await loadPromise;
};

export const recordInterstitialOpportunity = () => {
  opportunityCount += 1;

  if (opportunityCount % INTERSTITIAL_FREQUENCY !== 0) {
    void prepareInterstitialAd();
    return false;
  }

  hasPendingOpportunity = true;
  void prepareInterstitialAd();
  return true;
};

export const maybeShowPendingInterstitialAd = async () => {
  if (!hasPendingOpportunity) {
    void prepareInterstitialAd();
    return false;
  }

  if (!currentAd || !isLoaded || isShowing) {
    void prepareInterstitialAd();
    return false;
  }

  isShowing = true;
  isLoaded = false;
  hasPendingOpportunity = false;
  closePromise = new Promise<boolean>((resolve) => {
    closeResolver = resolve;
  });

  try {
    await currentAd.show();
  } catch {
    resolveClose(false);
    resetInterstitial();
    void prepareInterstitialAd();
    return false;
  }

  return closePromise ?? true;
};

export const maybeShowInterstitialAd = async () => {
  recordInterstitialOpportunity();
  return maybeShowPendingInterstitialAd();
};

export const showInterstitialAd = async () => {
  hasPendingOpportunity = true;
  await prepareInterstitialAd();
  return maybeShowPendingInterstitialAd();
};
