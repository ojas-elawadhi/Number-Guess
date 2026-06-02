import { Image, StyleSheet, type ImageStyle, type StyleProp } from "react-native";

const coinTokenSource = require("../../assets/ui/coin-token.png");

interface CoinIconProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function CoinIcon({ size = 30, style }: CoinIconProps) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={coinTokenSource}
      style={[styles.coin, { height: size, width: size }, style]}
    />
  );
}

const styles = StyleSheet.create({
  coin: {
    flexShrink: 0
  }
});
