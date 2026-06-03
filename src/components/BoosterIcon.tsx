import { Image, StyleSheet, type ImageStyle, type StyleProp } from "react-native";

export type BoosterIconKind = "extra-guess" | "skip" | "flash" | "play-skip-forward";

const boosterIconSources = {
  "extra-guess": require("../../assets/ui/booster-extra-guess.png"),
  flash: require("../../assets/ui/booster-extra-guess.png"),
  skip: require("../../assets/ui/booster-skip.png"),
  "play-skip-forward": require("../../assets/ui/booster-skip.png")
};

interface BoosterIconProps {
  kind: BoosterIconKind;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function BoosterIcon({ kind, size = 40, style }: BoosterIconProps) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={boosterIconSources[kind]}
      style={[styles.icon, { height: size, width: size }, style]}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    flexShrink: 0
  }
});
