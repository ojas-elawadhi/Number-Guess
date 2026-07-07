import type { PaidEvent } from "react-native-google-mobile-ads";

export const AdFormat = {
  banner: "banner",
  interstitial: "interstitial",
  rewarded: "rewarded"
} as const;

export const createAdImpressionId = (placement: string) => placement;

export const trackAdLoaded = (..._args: unknown[]) => {};

export const trackAdDisplayed = (..._args: unknown[]) => {};

export const trackAdOpened = (..._args: unknown[]) => {};

export const trackAdRevenue = (
  _adFormat: string,
  _adUnitId: string,
  _placement: string,
  _impressionId: string,
  _event: PaidEvent
) => {};

export const trackAdFailedToLoad = (..._args: unknown[]) => {};
