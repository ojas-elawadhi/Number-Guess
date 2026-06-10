import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

type HardwareBackHandler = () => void | Promise<void>;

let activeHandler: HardwareBackHandler | null = null;

export const invokeHardwareBackHandler = () => {
  if (!activeHandler) {
    return false;
  }

  void activeHandler();
  return true;
};

export const useHardwareBackHandler = (
  handler: HardwareBackHandler,
  enabled = true
) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return;
      }

      const registeredHandler = () => handlerRef.current();
      activeHandler = registeredHandler;

      return () => {
        if (activeHandler === registeredHandler) {
          activeHandler = null;
        }
      };
    }, [enabled])
  );
};
