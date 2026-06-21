import {
  DEFAULT_AVATAR_IDS,
  PREMIUM_AVATAR_IDS,
  PREMIUM_AVATAR_PRICES,
  PREMIUM_AVATAR_REQUIRED_LEVELS,
  type AvatarId
} from "../types/progression.types";

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
  skater: { background: "#91e1d5", ring: "#f37e65" },
  "crystal-crown": { background: "#071933", ring: "#f7c75f" },
  "cyber-samurai": { background: "#151039", ring: "#ffc866" },
  "neon-oracle": { background: "#231047", ring: "#d785ff" },
  "cosmic-royal": { background: "#110d32", ring: "#ffbd4f" },
  "solar-monarch": { background: "#2a1405", ring: "#ffd460" },
  "emerald-hacker": { background: "#062216", ring: "#5ff0a5" },
  "ruby-rogue": { background: "#2b0710", ring: "#ff6969" },
  "sapphire-pilot": { background: "#071c3c", ring: "#76c9ff" },
  "golden-tactician": { background: "#2f1d09", ring: "#ffc04d" },
  "frost-archer": { background: "#08213a", ring: "#b9ecff" },
  "plasma-queen": { background: "#28093d", ring: "#e076ff" },
  "storm-captain": { background: "#0c2442", ring: "#6ab8ff" },
  "obsidian-mage": { background: "#130923", ring: "#a074ff" },
  "aurora-knight": { background: "#082332", ring: "#57f0dc" },
  "turbo-racer": { background: "#2b0b0d", ring: "#ff6e4c" },
  "lunar-guardian": { background: "#10193a", ring: "#d6e3ff" },
  "royal-dj": { background: "#2d0f39", ring: "#f2a24b" },
  "chrome-detective": { background: "#202027", ring: "#d7d7d7" },
  "velvet-alchemist": { background: "#321034", ring: "#db74e9" },
  "jade-dragon-rider": { background: "#092b18", ring: "#69d877" },
  "star-chef": { background: "#122248", ring: "#ffdd7a" },
  "phoenix-striker": { background: "#2b0c05", ring: "#ff8a45" },
  "prism-scholar": { background: "#17223f", ring: "#a7dfff" },
  "cyber-boxer": { background: "#07152d", ring: "#4fa6ff" },
  "galaxy-botanist": { background: "#122711", ring: "#d8e96c" }
} as const satisfies Record<AvatarId, { background: string; ring: string }>;

const premiumAvatarMeta = {
  "crystal-crown": { label: "Crystal Crown", price: PREMIUM_AVATAR_PRICES["crystal-crown"] },
  "cyber-samurai": { label: "Cyber Samurai", price: PREMIUM_AVATAR_PRICES["cyber-samurai"] },
  "neon-oracle": { label: "Neon Oracle", price: PREMIUM_AVATAR_PRICES["neon-oracle"] },
  "cosmic-royal": { label: "Cosmic Royal", price: PREMIUM_AVATAR_PRICES["cosmic-royal"] },
  "solar-monarch": { label: "Solar Monarch", price: PREMIUM_AVATAR_PRICES["solar-monarch"] },
  "emerald-hacker": { label: "Emerald Hacker", price: PREMIUM_AVATAR_PRICES["emerald-hacker"] },
  "ruby-rogue": { label: "Ruby Rogue", price: PREMIUM_AVATAR_PRICES["ruby-rogue"] },
  "sapphire-pilot": { label: "Sapphire Pilot", price: PREMIUM_AVATAR_PRICES["sapphire-pilot"] },
  "golden-tactician": { label: "Golden Tactician", price: PREMIUM_AVATAR_PRICES["golden-tactician"] },
  "frost-archer": { label: "Frost Archer", price: PREMIUM_AVATAR_PRICES["frost-archer"] },
  "plasma-queen": { label: "Plasma Queen", price: PREMIUM_AVATAR_PRICES["plasma-queen"] },
  "storm-captain": { label: "Storm Captain", price: PREMIUM_AVATAR_PRICES["storm-captain"] },
  "obsidian-mage": { label: "Obsidian Mage", price: PREMIUM_AVATAR_PRICES["obsidian-mage"] },
  "aurora-knight": { label: "Aurora Knight", price: PREMIUM_AVATAR_PRICES["aurora-knight"] },
  "turbo-racer": { label: "Turbo Racer", price: PREMIUM_AVATAR_PRICES["turbo-racer"] },
  "lunar-guardian": { label: "Lunar Guardian", price: PREMIUM_AVATAR_PRICES["lunar-guardian"] },
  "royal-dj": { label: "Royal DJ", price: PREMIUM_AVATAR_PRICES["royal-dj"] },
  "chrome-detective": { label: "Chrome Detective", price: PREMIUM_AVATAR_PRICES["chrome-detective"] },
  "velvet-alchemist": { label: "Velvet Alchemist", price: PREMIUM_AVATAR_PRICES["velvet-alchemist"] },
  "jade-dragon-rider": { label: "Jade Dragon Rider", price: PREMIUM_AVATAR_PRICES["jade-dragon-rider"] },
  "star-chef": { label: "Star Chef", price: PREMIUM_AVATAR_PRICES["star-chef"] },
  "phoenix-striker": { label: "Phoenix Striker", price: PREMIUM_AVATAR_PRICES["phoenix-striker"] },
  "prism-scholar": { label: "Prism Scholar", price: PREMIUM_AVATAR_PRICES["prism-scholar"] },
  "cyber-boxer": { label: "Cyber Boxer", price: PREMIUM_AVATAR_PRICES["cyber-boxer"] },
  "galaxy-botanist": { label: "Galaxy Botanist", price: PREMIUM_AVATAR_PRICES["galaxy-botanist"] }
} as const satisfies Record<(typeof PREMIUM_AVATAR_IDS)[number], { label: string; price: number }>;

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

const buildAvatarOption = <T extends AvatarId>(id: T) => ({
  id,
  ...avatarStyles[id],
  imageUrl: `${avatarBaseUrl}/${AVATAR_ASSET_VERSION}/${id}.webp`
});

export const defaultProfileAvatarOptions = DEFAULT_AVATAR_IDS.map(buildAvatarOption);

export const premiumProfileAvatarOptions = PREMIUM_AVATAR_IDS.map((id) => ({
  ...buildAvatarOption(id),
  label: premiumAvatarMeta[id].label,
  price: premiumAvatarMeta[id].price,
  requiredLevel: PREMIUM_AVATAR_REQUIRED_LEVELS[id]
}));

export const profileAvatarOptions = [...defaultProfileAvatarOptions, ...premiumProfileAvatarOptions];

export const profileAvatarImageUrls = profileAvatarOptions.map((option) => option.imageUrl);
