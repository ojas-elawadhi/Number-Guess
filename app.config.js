module.exports = {
  expo: {
    name: "Code Guess",
    slug: "code-wars-multiplayer",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/app-icon-code-guess-v24.png",
    scheme: "codeguess",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    plugins: ["expo-router", "expo-audio"],
    ios: {
      supportsTablet: true
    },
    android: {
      package: "com.zenostudios.codewars",
      versionCode: 6,
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
