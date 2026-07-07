import { useRef } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

import { useMonetizationStore } from "../store/useMonetizationStore";
import {
  AdFormat,
  createAdImpressionId,
  trackAdDisplayed,
  trackAdFailedToLoad,
  trackAdLoaded,
  trackAdOpened,
  trackAdRevenue
} from "../services/adRevenueTracking";

const bannerUnitId =
  __DEV__
    ? TestIds.BANNER
    : Platform.select({
        android: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_ANDROID,
        ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID_IOS
      }) ?? TestIds.BANNER;

interface AppBannerAdProps {
  style?: StyleProp<ViewStyle>;
}

export function AppBannerAd({ style }: AppBannerAdProps) {
  const hasNoAdsEntitlement = useMonetizationStore((state) => state.hasNoAdsEntitlement);
  const impressionIdRef = useRef(createAdImpressionId("app_banner"));

  if (hasNoAdsEntitlement) {
    return null;
  }

  return (
    <View style={[styles.bannerWrap, style]}>
      <BannerAd
        requestOptions={{
          requestNonPersonalizedAdsOnly: true
        }}
        onAdClicked={() => {
          trackAdOpened(AdFormat.banner, bannerUnitId, "app_banner", impressionIdRef.current);
        }}
        onAdFailedToLoad={() => {
          trackAdFailedToLoad(AdFormat.banner, bannerUnitId, "app_banner");
        }}
        onAdImpression={() => {
          trackAdDisplayed(AdFormat.banner, bannerUnitId, "app_banner", impressionIdRef.current);
        }}
        onAdLoaded={() => {
          impressionIdRef.current = createAdImpressionId("app_banner");
          trackAdLoaded(AdFormat.banner, bannerUnitId, "app_banner", impressionIdRef.current);
        }}
        onPaid={(event) => {
          trackAdRevenue(AdFormat.banner, bannerUnitId, "app_banner", impressionIdRef.current, event);
        }}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        unitId={bannerUnitId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  }
});
