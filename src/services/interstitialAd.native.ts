import { Platform } from "react-native";
import {
  AdEventType,
  InterstitialAd,
  TestIds
} from "react-native-google-mobile-ads";

const interstitialUnitId =
  __DEV__
    ? TestIds.INTERSTITIAL
    : Platform.select({
        android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_ANDROID,
        ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID_IOS
      }) ?? TestIds.INTERSTITIAL;

const INTERSTITIAL_FREQUENCY = 3;

let currentAd: InterstitialAd | null = null;
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

const clearListeners = () => {
  unsubscribeLoaded?.();
  unsubscribeClosed?.();
  unsubscribeError?.();
  unsubscribeLoaded = null;
  unsubscribeClosed = null;
  unsubscribeError = null;
};

const finishLoad = () => {
  loadResolver?.();
  loadResolver = null;
  loadPromise = null;
};

const resetInterstitial = () => {
  clearListeners();
  currentAd = null;
  isLoaded = false;
  isShowing = false;
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

  currentAd = InterstitialAd.createForAdRequest(interstitialUnitId, {
    requestNonPersonalizedAdsOnly: true
  });

  loadPromise = new Promise<void>((resolve) => {
    loadResolver = resolve;
  });

  unsubscribeLoaded = currentAd.addAdEventListener(AdEventType.LOADED, () => {
    isLoaded = true;
    finishLoad();
  });

  unsubscribeClosed = currentAd.addAdEventListener(AdEventType.CLOSED, () => {
    resolveClose(true);
    resetInterstitial();
    void prepareInterstitialAd();
  });

  unsubscribeError = currentAd.addAdEventListener(AdEventType.ERROR, () => {
    resolveClose(false);
    resetInterstitial();
    finishLoad();
  });

  currentAd.load();

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
