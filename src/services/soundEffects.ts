import { Asset } from "expo-asset";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";

import type { GuessFeedback } from "../types/game.types";
import { usePlayerProgressStore } from "../store/usePlayerProgressStore";

export type SoundEffect =
  | "achievement"
  | "back"
  | "clear"
  | "coinReward"
  | "correct"
  | "countdownGo"
  | "countdownTick"
  | "defeat"
  | "erase"
  | "error"
  | "gameOver"
  | "guessLock"
  | "higher"
  | "lower"
  | "missed"
  | "modalOpen"
  | "numberKey"
  | "onlineNotify"
  | "powerup"
  | "purchaseFail"
  | "purchaseSuccess"
  | "revive"
  | "roundClear"
  | "softNoise"
  | "switchOff"
  | "switchOn"
  | "tabSwitch"
  | "tie"
  | "timerLow"
  | "uiTap"
  | "victory";

const soundSources: Record<SoundEffect, number> = {
  achievement: require("../../assets/sounds/achievement.wav"),
  back: require("../../assets/sounds/back.wav"),
  clear: require("../../assets/sounds/clear.wav"),
  coinReward: require("../../assets/sounds/coin_reward.wav"),
  correct: require("../../assets/sounds/correct.wav"),
  countdownGo: require("../../assets/sounds/countdown_go.wav"),
  countdownTick: require("../../assets/sounds/countdown_tick.wav"),
  defeat: require("../../assets/sounds/defeat.wav"),
  erase: require("../../assets/sounds/erase.wav"),
  error: require("../../assets/sounds/error.wav"),
  gameOver: require("../../assets/sounds/game_over.wav"),
  guessLock: require("../../assets/sounds/guess_lock.wav"),
  higher: require("../../assets/sounds/higher.wav"),
  lower: require("../../assets/sounds/lower.wav"),
  missed: require("../../assets/sounds/missed.wav"),
  modalOpen: require("../../assets/sounds/modal_open.wav"),
  numberKey: require("../../assets/sounds/number_key.wav"),
  onlineNotify: require("../../assets/sounds/online_notify.wav"),
  powerup: require("../../assets/sounds/powerup.wav"),
  purchaseFail: require("../../assets/sounds/purchase_fail.wav"),
  purchaseSuccess: require("../../assets/sounds/purchase_success.wav"),
  revive: require("../../assets/sounds/revive.wav"),
  roundClear: require("../../assets/sounds/round_clear.wav"),
  softNoise: require("../../assets/sounds/soft_noise.wav"),
  switchOff: require("../../assets/sounds/switch_off.wav"),
  switchOn: require("../../assets/sounds/switch_on.wav"),
  tabSwitch: require("../../assets/sounds/tab_switch.wav"),
  tie: require("../../assets/sounds/tie.wav"),
  timerLow: require("../../assets/sounds/timer_low.wav"),
  uiTap: require("../../assets/sounds/ui_tap.wav"),
  victory: require("../../assets/sounds/victory.wav")
};

const menuMusicSource = require("../../assets/sounds/menu_loop.mp3");

const volumes: Partial<Record<SoundEffect, number>> = {
  achievement: 0.8,
  countdownGo: 0.48,
  countdownTick: 0.42,
  error: 0.7,
  guessLock: 0.44,
  higher: 0.44,
  lower: 0.44,
  numberKey: 0.38,
  timerLow: 0.55,
  uiTap: 0.52
};

const players: Partial<Record<SoundEffect, AudioPlayer>> = {};
let menuMusicPlayer: AudioPlayer | null = null;
let webMenuMusicPlayer: any | null = null;
let modeConfigured = false;
let menuMusicRequested = false;

const isAudioEnabled = () => usePlayerProgressStore.getState().profile.soundPlaceholdersEnabled;

const configureAudioMode = async () => {
  if (modeConfigured) {
    return;
  }

  modeConfigured = true;
  await setAudioModeAsync({
    allowsRecording: false,
    interruptionMode: "mixWithOthers",
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false
  });
};

const getPlayer = (effect: SoundEffect) => {
  if (!players[effect]) {
    const player = createAudioPlayer(soundSources[effect], {
      keepAudioSessionActive: true,
      updateInterval: 1000
    });
    player.volume = volumes[effect] ?? 0.68;
    players[effect] = player;
  }

  return players[effect]!;
};

const getMenuMusicPlayer = () => {
  if (!menuMusicPlayer) {
    menuMusicPlayer = createAudioPlayer(menuMusicSource, {
      keepAudioSessionActive: true,
      updateInterval: 1000
    });
    menuMusicPlayer.loop = true;
    menuMusicPlayer.volume = 0.38;
  }

  return menuMusicPlayer;
};

const getWebMenuMusicPlayer = () => {
  if (Platform.OS !== "web" || typeof globalThis.Audio === "undefined") {
    return null;
  }

  if (!webMenuMusicPlayer) {
    const asset = Asset.fromModule(menuMusicSource);
    webMenuMusicPlayer = new globalThis.Audio(asset.uri);
    webMenuMusicPlayer.loop = true;
    webMenuMusicPlayer.preload = "auto";
    webMenuMusicPlayer.volume = 0.38;
  }

  return webMenuMusicPlayer;
};

export const initSoundEffects = () => {
  configureAudioMode().catch(() => { });
};

const playSoundInternal = (effect: SoundEffect, ignorePreference = false) => {
  if (!ignorePreference && !isAudioEnabled()) {
    return;
  }

  configureAudioMode()
    .then(async () => {
      const player = getPlayer(effect);
      await player.seekTo(0).catch(() => { });
      player.play();

      if (menuMusicRequested) {
        startMenuMusic();
      }
    })
    .catch(() => {
      // Sound effects should never block gameplay.
    });
};

export const playSound = (effect: SoundEffect) => {
  playSoundInternal(effect);
};

export const playSoundAlways = (effect: SoundEffect) => {
  playSoundInternal(effect, true);
};

export const playButtonSound = () => playSound("uiTap");

export const startMenuMusic = () => {
  menuMusicRequested = true;

  if (!isAudioEnabled()) {
    stopMenuMusic();
    return;
  }

  const webPlayer = getWebMenuMusicPlayer();

  if (webPlayer) {
    if (webPlayer.paused) {
      const playPromise = webPlayer.play();

      if (playPromise?.catch) {
        playPromise.catch(() => { });
      }
    }
    return;
  }

  configureAudioMode()
    .then(() => {
      const player = getMenuMusicPlayer();

      if (!player.playing) {
        player.play();
      }
    })
    .catch(() => { });
};

export const stopMenuMusic = () => {
  menuMusicRequested = false;

  if (webMenuMusicPlayer && !webMenuMusicPlayer.paused) {
    webMenuMusicPlayer.pause();
  }

  if (!menuMusicPlayer?.playing) {
    return;
  }

  menuMusicPlayer.pause();
};

export const playResultSound = (result: GuessFeedback | null | undefined) => {
  if (result === "correct") {
    playSound("correct");
    return;
  }

  if (result === "higher") {
    playSound("higher");
    return;
  }

  if (result === "lower") {
    playSound("lower");
    return;
  }

  if (result === "missed") {
    playSound("missed");
  }
};
