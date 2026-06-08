const androidAppId =
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ?? "ca-app-pub-3940256099942544~3347511713";
const iosAppId =
  process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ?? "ca-app-pub-3940256099942544~1458002511";

module.exports = {
  expo: {
    name: "Code Guess",
    slug: "code-wars-multiplayer",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/app-icon-code-guess-v24.png",
    scheme: "codeguess",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    plugins: [
      "expo-router",
      "expo-audio",
      [
        "react-native-google-mobile-ads",
        {
          androidAppId,
          iosAppId
        }
      ]
    ],
    ios: {
      supportsTablet: true
    },
    android: {
      package: "com.zenostudios.codewars",
      versionCode: 14,
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      bundler: "metro",
      output: "static"
    },
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {},
      eas: {
        projectId: "0c3a9356-f4c4-4bbb-922c-34c704895405"
      }
    }
  }
};
