import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

import { useMonetizationStore } from "../store/useMonetizationStore";

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

  if (hasNoAdsEntitlement) {
    return null;
  }

  return (
    <View style={[styles.bannerWrap, style]}>
      <BannerAd
        requestOptions={{
          requestNonPersonalizedAdsOnly: true
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
