import { useCallback, useRef, useState } from "react";
import { Animated } from "react-native";

import { playSound } from "../services/soundEffects";

export function useCountdownOverlay(initialValue = 3) {
  const [countdownValue, setCountdownValue] = useState<number | string | null>(null);
  const countdownOpacity = useRef(new Animated.Value(0)).current;
  const countdownScale = useRef(new Animated.Value(0.92)).current;

  const pulse = useCallback(
    (onComplete?: () => void) => {
      countdownOpacity.setValue(0);
      countdownScale.setValue(0.92);

      Animated.parallel([
        Animated.timing(countdownOpacity, {
          duration: 180,
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(countdownScale, {
          duration: 180,
          toValue: 1,
          useNativeDriver: true
        })
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(countdownOpacity, {
              duration: 200,
              toValue: 0,
              useNativeDriver: true
            }),
            Animated.timing(countdownScale, {
              duration: 200,
              toValue: 1.06,
              useNativeDriver: true
            })
          ]).start(() => {
            onComplete?.();
          });
        }, 380);
      });
    },
    [countdownOpacity, countdownScale]
  );

  const startCountdown = useCallback(() => {
    const sequence: Array<number | string> = Array.from({ length: initialValue }, (_, index) => initialValue - index);

    const runStep = (stepIndex: number) => {
      const currentValue = sequence[stepIndex];

      if (currentValue === undefined) {
        setCountdownValue(null);
        return;
      }

      setCountdownValue(currentValue);
      playSound("countdownTick");
      pulse(() => {
        if (stepIndex === sequence.length - 1) {
          setCountdownValue("GO!");
          playSound("countdownGo");
          pulse(() => {
            setCountdownValue(null);
          });
          return;
        }

        runStep(stepIndex + 1);
      });
    };

    runStep(0);
  }, [initialValue, pulse]);

  return {
    countdownValue,
    countdownOpacity,
    countdownScale,
    startCountdown,
    countdownActive: countdownValue !== null
  };
}
