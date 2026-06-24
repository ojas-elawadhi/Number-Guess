import type { ImageSourcePropType } from "react-native";
import { Image, StyleSheet, Text, View } from "react-native";

const topRankBadges: Record<1 | 2 | 3, ImageSourcePropType> = {
  1: require("../../assets/ui/rank-badge-1.png"),
  2: require("../../assets/ui/rank-badge-2.png"),
  3: require("../../assets/ui/rank-badge-3.png")
};

interface RankMedalProps {
  rank: number;
  size?: number;
}

export function RankMedal({ rank, size = 52 }: RankMedalProps) {
  const topRank = rank === 1 || rank === 2 || rank === 3 ? rank : null;

  if (topRank) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={topRankBadges[topRank]}
        style={[styles.imageBadge, { height: size, width: size }]}
      />
    );
  }

  return (
    <View style={[styles.numberBadge, { borderRadius: size / 2, height: size, width: size }]}>
      <Text style={styles.rankPrefix}>#</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.rankNumber}>
        {rank}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  imageBadge: {
    shadowColor: "#2c2414",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6
  },
  numberBadge: {
    alignItems: "center",
    backgroundColor: "#f3f6f8",
    borderColor: "#cbd6df",
    borderWidth: 1,
    justifyContent: "center",
    shadowColor: "#14202e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  rankNumber: {
    color: "#263444",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 18,
    maxWidth: 34,
    textAlign: "center"
  },
  rankPrefix: {
    color: "#6f7d8c",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 9,
    textAlign: "center"
  }
});
