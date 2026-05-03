import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { colors } from "../utils/theme";

interface ConfettiBurstProps {
  visible: boolean;
}

const palette = [colors.accent, colors.success, "#38bdf8", "#facc15", "#fb7185"];

export function ConfettiBurst({ visible }: ConfettiBurstProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        left: `${(index % 6) * 16 + 8}%` as `${number}%`,
        color: palette[index % palette.length],
        delay: (index % 6) * 70
      })),
    []
  );
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }

    Animated.timing(progress, {
      duration: 1800,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true
    }).start();
  }, [progress, visible]);

  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {particles.map((particle) => {
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-20 - particle.delay / 10, 420 + particle.delay]
        });
        const translateX = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, particle.id % 2 === 0 ? 34 : -34, particle.id % 2 === 0 ? -24 : 24]
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", particle.id % 2 === 0 ? "220deg" : "-220deg"]
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.85, 1],
          outputRange: [0, 1, 0]
        });

        return (
          <Animated.View
            key={particle.id}
            style={[
              styles.particle,
              {
                backgroundColor: particle.color,
                left: particle.left,
                opacity,
                transform: [{ translateY }, { translateX }, { rotate }]
              }
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 40
  },
  particle: {
    borderRadius: 6,
    height: 14,
    position: "absolute",
    top: -8,
    width: 10
  }
});
