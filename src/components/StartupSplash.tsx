import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { radii, shadows, spacing } from "../utils/theme";

const HOLD_DURATION_MS = 1600;
const FADE_IN_DURATION_MS = 260;
const FADE_OUT_DURATION_MS = 360;

export function StartupSplash() {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        duration: FADE_IN_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true
      }),
      Animated.spring(scale, {
        damping: 14,
        mass: 0.9,
        stiffness: 130,
        toValue: 1,
        useNativeDriver: true
      })
    ]).start();

    const hideTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          duration: FADE_OUT_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true
        }),
        Animated.timing(scale, {
          duration: FADE_OUT_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          toValue: 0.98,
          useNativeDriver: true
        })
      ]).start(({ finished }) => {
        if (finished) {
          setVisible(false);
        }
      });
    }, HOLD_DURATION_MS);

    return () => {
      clearTimeout(hideTimer);
      opacity.stopAnimation();
      scale.stopAnimation();
    };
  }, [opacity, scale]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      accessibilityLabel="Zeno Studios"
      style={[styles.overlay, { opacity }]}
    >
      <View style={styles.accentRail} />
      <Animated.View style={[styles.logoGroup, { transform: [{ scale }] }]}>
        <View style={styles.logoMark}>
          <View style={styles.logoTileShadow} />
          <View style={styles.logoTile}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.logoLetter}>
              Z
            </Text>
          </View>
        </View>
        <View style={styles.copy}>
          <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.brandName}>
            Zeno Studios
          </Text>
          <View style={styles.presentedRow}>
            <View style={styles.presentedLine} />
            <Text style={styles.presentedText}>PRESENTS</Text>
            <View style={styles.presentedLine} />
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#000000",
    justifyContent: "center",
    padding: spacing.xl,
    zIndex: 50
  },
  accentRail: {
    backgroundColor: "#ffffff",
    bottom: 0,
    height: 6,
    left: 0,
    position: "absolute",
    right: 0
  },
  logoGroup: {
    alignItems: "center",
    gap: spacing.lg,
    maxWidth: 360,
    width: "100%"
  },
  logoMark: {
    height: 108,
    position: "relative",
    width: 108
  },
  logoTileShadow: {
    backgroundColor: "#ffffff",
    borderRadius: radii.lg,
    bottom: -8,
    left: 10,
    position: "absolute",
    right: -8,
    top: 10
  },
  logoTile: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
    borderRadius: radii.lg,
    borderWidth: 3,
    height: 108,
    justifyContent: "center",
    width: 108,
    ...shadows.tactile
  },
  logoLetter: {
    color: "#000000",
    fontSize: 68,
    fontWeight: "900",
    lineHeight: 78
  },
  copy: {
    alignItems: "center",
    gap: spacing.sm,
    width: "100%"
  },
  brandName: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 40,
    textAlign: "center"
  },
  presentedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    maxWidth: 220,
    width: "72%"
  },
  presentedLine: {
    backgroundColor: "#ffffff",
    flex: 1,
    height: 1
  },
  presentedText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0
  }
});
