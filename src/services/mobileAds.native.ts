import mobileAds, { MaxAdContentRating } from "react-native-google-mobile-ads";

let initialized = false;
let initializationPromise: Promise<void> | null = null;

export const initializeMobileAds = async () => {
  if (initialized) {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.PG,
        testDeviceIdentifiers: __DEV__ ? ["EMULATOR"] : []
      });
      await mobileAds().initialize();
      initialized = true;
    })().finally(() => {
      initializationPromise = null;
    });
  }

  await initializationPromise;
};
