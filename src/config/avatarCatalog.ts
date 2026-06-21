import { AVATAR_IDS, type AvatarId } from "../types/progression.types";

const AVATAR_ASSET_VERSION = "v1";

const avatarStyles = {
  scholar: { background: "#63b4ff", ring: "#f28f67" },
  rocket: { background: "#ffaf80", ring: "#5db5f5" },
  flash: { background: "#ffe174", ring: "#9dc95b" },
  planet: { background: "#c8a8ff", ring: "#f7b33d" },
  music: { background: "#8ddfc9", ring: "#d979bc" },
  gamepad: { background: "#90d2ff", ring: "#ee6b62" },
  paw: { background: "#ffd2ad", ring: "#7cc8ff" },
  book: { background: "#f8a7d8", ring: "#a98ee8" },
  flame: { background: "#ffb0a6", ring: "#5cc78f" },
  cafe: { background: "#d8c4a8", ring: "#f28f67" },
  tennis: { background: "#d8f58a", ring: "#5db5f5" },
  bulb: { background: "#ffe58c", ring: "#d979bc" },
  astronaut: { background: "#d8ecff", ring: "#ef8a62" },
  ninja: { background: "#d9c8ff", ring: "#51bfa9" },
  scientist: { background: "#a9e8ff", ring: "#f38c77" },
  knight: { background: "#cbdcff", ring: "#f4b844" },
  chef: { background: "#ffe0c5", ring: "#e56d68" },
  dragon: { background: "#a9dcff", ring: "#f1845f" },
  alien: { background: "#a8ead4", ring: "#8e78d7" },
  superhero: { background: "#ffc3b5", ring: "#55b9d1" },
  detective: { background: "#e4d0b2", ring: "#4eb8a7" },
  dinosaur: { background: "#ffe58f", ring: "#ee765f" },
  unicorn: { background: "#e2c8ff", ring: "#5bc6c3" },
  panda: { background: "#ffe09a", ring: "#579ed6" },
  skater: { background: "#91e1d5", ring: "#f37e65" }
} as const satisfies Record<AvatarId, { background: string; ring: string }>;

const normalizeBaseUrl = (value: string) => {
  const normalized = value.trim().replace(/\/+$/, "");

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  return `https://${normalized}`;
};

const inferLocalAvatarBaseUrl = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const hostname = window.location?.hostname;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `http://${hostname}:3001/avatars`;
  }

  return undefined;
};

const configuredAvatarBaseUrl = process.env.EXPO_PUBLIC_AVATAR_CDN_URL;
const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_SOCKET_URL;
const fallbackAvatarBaseUrl = configuredApiBaseUrl
  ? `${normalizeBaseUrl(configuredApiBaseUrl)}/avatars`
  : "http://localhost:3001/avatars";
const avatarBaseUrl = inferLocalAvatarBaseUrl() ??
  (configuredAvatarBaseUrl ? normalizeBaseUrl(configuredAvatarBaseUrl) : fallbackAvatarBaseUrl);

export const profileAvatarOptions = AVATAR_IDS.map((id) => ({
  id,
  ...avatarStyles[id],
  imageUrl: `${avatarBaseUrl}/${AVATAR_ASSET_VERSION}/${id}.webp`
}));

export const profileAvatarImageUrls = profileAvatarOptions.map((option) => option.imageUrl);
