import { Platform } from "react-native";
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds
} from "react-native-google-mobile-ads";

const rewardedUnitId =
  __DEV__
    ? TestIds.REWARDED
    : Platform.select({
        android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_REVIVE_UNIT_ID_ANDROID,
        ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_REVIVE_UNIT_ID_IOS
      }) ?? TestIds.REWARDED;

let activeRequest: Promise<boolean> | null = null;

export const isRewardedReviveSupported = () => Platform.OS !== "web";

export const showRewardedReviveAd = async () => {
  if (activeRequest) {
    return activeRequest;
  }

  activeRequest = new Promise<boolean>((resolve) => {
    const rewardedAd = RewardedAd.createForAdRequest(rewardedUnitId, {
      requestNonPersonalizedAdsOnly: true
    });

    let rewardEarned = false;
    let settled = false;

    const unsubscribeLoaded = rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
      void rewardedAd.show().catch(() => {
        resolveOnce(false);
      });
    });
    const unsubscribeReward = rewardedAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        rewardEarned = true;
      }
    );
    const unsubscribeClosed = rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
      resolveOnce(rewardEarned);
    });
    const unsubscribeError = rewardedAd.addAdEventListener(AdEventType.ERROR, () => {
      resolveOnce(false);
    });

    const cleanup = () => {
      unsubscribeLoaded();
      unsubscribeReward();
      unsubscribeClosed();
      unsubscribeError();
    };

    const resolveOnce = (value: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      activeRequest = null;
      resolve(value);
    };

    rewardedAd.load();
  });

  return activeRequest;
};
