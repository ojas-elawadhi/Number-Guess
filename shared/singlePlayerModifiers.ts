import type { Difficulty, GuessFeedback } from "./game.types";

export type HotColdLevel = "very-cold" | "cold" | "warm" | "hot" | "burning";

const modifierIds = [
  "classic",
  "contains-digit",
  "hot-cold-radar",
  "trap-range",
  "boss-range-seal",
  "boss-parity-radar",
  "boss-digit-choice",
  "boss-digit-anchor",
  "boss-sum",
  "boss-mirror"
] as const;

export type SinglePlayerModifierId = (typeof modifierIds)[number];

export interface SinglePlayerModifierSnapshot {
  id: SinglePlayerModifierId;
  roundNumber: number;
  label: string;
  shortLabel: string;
  description: string;
  accentColor: string;
  scoreMultiplier: number;
  isBoss: boolean;
  hotColdMode?: "blind";
  lockedDigitIndex?: number;
  lockedDigitValue?: string;
  containsDigits?: string[];
  parity?: "odd" | "even";
  rangeSeal?: "at-or-above" | "below";
  rangeSealValue?: number;
  digitSumMin?: number;
  digitSumMax?: number;
  mirrorMode?: boolean;
  trapStart?: number;
  trapEnd?: number;
}

export interface SinglePlayerGuessResolution {
  result: GuessFeedback;
  chanceCost: number;
  hotColdLevel: HotColdLevel | null;
  primaryLabel: string;
  secondaryLabel: string | null;
  historyLabel: string;
  historyColor: string;
  statusText: string;
  soundResult: GuessFeedback | null;
  trapped: boolean;
}

const modifierColors: Record<SinglePlayerModifierId, string> = {
  classic: "#2ecc71",
  "contains-digit": "#8b5cf6",
  "hot-cold-radar": "#ff7a45",
  "trap-range": "#ef476f",
  "boss-range-seal": "#2b1f63",
  "boss-parity-radar": "#2b1f63",
  "boss-digit-choice": "#2b1f63",
  "boss-digit-anchor": "#2b1f63",
  "boss-sum": "#2b1f63",
  "boss-mirror": "#2b1f63"
};

const currentModifierIds = new Set<string>(modifierIds);

const hotColdMeta: Record<HotColdLevel, { label: string; color: string }> = {
  "very-cold": { label: "Very Cold", color: "#4aa7ff" },
  cold: { label: "Cold", color: "#61b7ff" },
  warm: { label: "Warm", color: "#f6b73c" },
  hot: { label: "Hot", color: "#ff8a6a" },
  burning: { label: "Burning", color: "#f25555" }
};

const hotColdGuidance: Record<HotColdLevel, string> = {
  "very-cold": "You are far away. Make a big move.",
  cold: "Still far. Move a good distance.",
  warm: "Getting closer. Narrow the range.",
  hot: "Close. Make smaller moves.",
  burning: "Very close. Fine tune it."
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const seededIndex = (seed: number, length: number) => {
  const normalized = Math.abs(Math.imul(seed ^ 0x45d9f3b, 2654435761));
  return normalized % length;
};

const getDigitCount = (maxNumber: number) => String(maxNumber).length;

const getDigitSum = (value: number) =>
  String(Math.max(0, Math.floor(value)))
    .split("")
    .reduce((sum, digit) => sum + Number(digit), 0);

const getMirrorNumber = (guess: number, maxNumber: number) => maxNumber + 1 - guess;

const getWeightedModifierId = (difficulty: Difficulty, roundNumber: number, secretNumber: number): SinglePlayerModifierId => {
  const pool: SinglePlayerModifierId[] =
    roundNumber >= 20
      ? [
          "classic",
          "classic",
          "contains-digit",
          "contains-digit",
          "hot-cold-radar",
          "hot-cold-radar",
          "trap-range",
          "trap-range"
        ]
      : [
          "classic",
          "classic",
          "classic",
          "contains-digit",
          "hot-cold-radar",
          "trap-range"
        ];

  const difficultySalt = difficulty === "easy" ? 17 : difficulty === "hard" ? 31 : 47;
  return pool[seededIndex(roundNumber * 97 + secretNumber * difficultySalt, pool.length)];
};

const getBossModifierId = (roundNumber: number): SinglePlayerModifierId => {
  const firstCycle: Record<number, SinglePlayerModifierId> = {
    10: "boss-range-seal",
    20: "boss-digit-anchor",
    30: "boss-parity-radar",
    40: "boss-digit-choice",
    50: "boss-sum",
    60: "boss-mirror"
  };
  const firstCycleId = firstCycle[roundNumber];

  if (firstCycleId) {
    return firstCycleId;
  }

  const rotation: SinglePlayerModifierId[] = [
    "boss-range-seal",
    "boss-parity-radar",
    "boss-digit-choice",
    "boss-digit-anchor",
    "boss-sum",
    "boss-mirror"
  ];

  return rotation[Math.floor(roundNumber / 10) % rotation.length];
};

const getScheduledModifierId = (
  difficulty: Difficulty,
  roundNumber: number,
  secretNumber: number
): SinglePlayerModifierId => {
  if (roundNumber > 0 && roundNumber % 10 === 0) {
    return getBossModifierId(roundNumber);
  }

  const earlySchedule: Record<number, SinglePlayerModifierId> = {
    1: "classic",
    2: "classic",
    3: "contains-digit",
    4: "trap-range",
    5: "hot-cold-radar",
    6: "classic",
    7: "trap-range",
    8: "contains-digit",
    9: "hot-cold-radar"
  };

  return earlySchedule[roundNumber] ?? getWeightedModifierId(difficulty, roundNumber, secretNumber);
};

const createLockedDigit = (secretNumber: number, maxNumber: number, roundNumber: number) => {
  const digitCount = getDigitCount(maxNumber);
  const digits = String(secretNumber);
  const digitIndex = seededIndex(secretNumber + roundNumber * 13, digits.length);
  const displayIndex = digitCount - digits.length + digitIndex;

  return {
    lockedDigitIndex: displayIndex,
    lockedDigitValue: digits[digitIndex]
  };
};

const createContainsDigits = (secretNumber: number, roundNumber: number, count: 1 | 2) => {
  const secretDigits = Array.from(new Set(String(secretNumber).split("")));
  const trueDigit = secretDigits[seededIndex(secretNumber + roundNumber * 19, secretDigits.length)];

  if (count === 1) {
    return { containsDigits: [trueDigit] };
  }

  const decoyDigits = "0123456789".split("").filter((digit) => digit !== trueDigit);
  const decoyDigit = decoyDigits[seededIndex(secretNumber + roundNumber * 29, decoyDigits.length)];
  const digits = seededIndex(secretNumber + roundNumber * 37, 2) === 0 ? [trueDigit, decoyDigit] : [decoyDigit, trueDigit];

  return { containsDigits: digits };
};

const createRangeSeal = (secretNumber: number, maxNumber: number) => {
  const midpoint = Math.ceil((maxNumber + 1) / 2);

  return {
    rangeSeal: secretNumber >= midpoint ? "at-or-above" : "below",
    rangeSealValue: midpoint
  } satisfies Pick<SinglePlayerModifierSnapshot, "rangeSeal" | "rangeSealValue">;
};

const createDigitSumBand = (secretNumber: number, maxNumber: number, roundNumber: number) => {
  const digitCount = getDigitCount(maxNumber);
  const targetSum = getDigitSum(secretNumber);
  const maxDigitSum = digitCount * 9;
  const bandWidth = Math.max(4, digitCount * 2);
  const offset = seededIndex(secretNumber + roundNumber * 41, bandWidth + 1);
  const min = clamp(targetSum - offset, 1, Math.max(1, maxDigitSum - bandWidth));

  return {
    digitSumMin: min,
    digitSumMax: clamp(min + bandWidth, min, maxDigitSum)
  };
};

const createTrapRange = (secretNumber: number, maxNumber: number, roundNumber: number) => {
  const width = Math.max(7, Math.round(maxNumber * 0.12));
  const padding = Math.max(3, Math.round(width * 0.35));
  const avoidStart = Math.max(1, secretNumber - padding);
  const avoidEnd = Math.min(maxNumber, secretNumber + padding);
  const slots = [
    Math.round(maxNumber * 0.18),
    Math.round(maxNumber * 0.34),
    Math.round(maxNumber * 0.5),
    Math.round(maxNumber * 0.66),
    Math.round(maxNumber * 0.82)
  ];
  const ordered = [...slots.slice(seededIndex(secretNumber + roundNumber * 23, slots.length)), ...slots].slice(0, slots.length);
  const center = ordered.find((candidate) => {
    const start = clamp(candidate - Math.floor(width / 2), 1, maxNumber);
    const end = clamp(start + width, 1, maxNumber);
    return end < avoidStart || start > avoidEnd;
  }) ?? clamp(secretNumber + Math.round(maxNumber * 0.35), 1, maxNumber);
  const trapStart = clamp(center - Math.floor(width / 2), 1, maxNumber);
  const trapEnd = clamp(trapStart + width, 1, maxNumber);

  return {
    trapStart,
    trapEnd
  };
};

const getModifierBase = (id: SinglePlayerModifierId) => {
  switch (id) {
    case "contains-digit":
      return {
        label: "Digit Hint",
        shortLabel: "Digit",
        description: "One target digit is revealed, but not its position.",
        scoreMultiplier: 1.25
      };
    case "hot-cold-radar":
      return {
        label: "Radar",
        shortLabel: "Radar",
        description: "Only heat is shown. No higher/lower clues.",
        scoreMultiplier: 1.75
      };
    case "trap-range":
      return {
        label: "Trap Range",
        shortLabel: "Trap",
        description: "A hidden danger zone is active. Landing there costs 2 guesses.",
        scoreMultiplier: 1.5
      };
    case "boss-range-seal":
      return {
        label: "Boss: Range Seal",
        shortLabel: "Boss",
        description: "Half the range is sealed away. Radar only with a hidden trap.",
        scoreMultiplier: 2
      };
    case "boss-parity-radar":
      return {
        label: "Boss: Parity Radar",
        shortLabel: "Boss",
        description: "Odd/even clue, radar only, and a hidden trap.",
        scoreMultiplier: 2.5
      };
    case "boss-digit-choice":
      return {
        label: "Boss: Digit Choice",
        shortLabel: "Boss",
        description: "One of two shown digits is in the target. Radar only with a hidden trap.",
        scoreMultiplier: 2.75
      };
    case "boss-digit-anchor":
      return {
        label: "Boss: Digit Anchor",
        shortLabel: "Boss",
        description: "One digit is locked in place. Radar only with a hidden trap.",
        scoreMultiplier: 2.25
      };
    case "boss-sum":
      return {
        label: "Boss: Sum Code",
        shortLabel: "Boss",
        description: "Digit sum band revealed. Radar only with a hidden trap.",
        scoreMultiplier: 3
      };
    case "boss-mirror":
      return {
        label: "Boss: Mirror Trap",
        shortLabel: "Boss",
        description: "Clues judge your mirrored number. Radar only with a hidden trap.",
        scoreMultiplier: 3.25
      };
    case "classic":
    default:
      return {
        label: "Classic",
        shortLabel: "Classic",
        description: "Use higher/lower clues to find the number.",
        scoreMultiplier: 1
      };
  }
};

export const createSinglePlayerModifier = (
  difficulty: Difficulty,
  roundNumber: number,
  secretNumber: number,
  maxNumber: number
): SinglePlayerModifierSnapshot => {
  const id = getScheduledModifierId(difficulty, roundNumber, secretNumber);
  const base = getModifierBase(id);
  const modifier: SinglePlayerModifierSnapshot = {
    id,
    roundNumber,
    label: base.label,
    shortLabel: base.shortLabel,
    description: base.description,
    accentColor: modifierColors[id],
    scoreMultiplier: base.scoreMultiplier,
    isBoss: id.startsWith("boss")
  };

  if (id === "hot-cold-radar" || id.startsWith("boss")) {
    modifier.hotColdMode = "blind";
  }

  if (id === "contains-digit") {
    Object.assign(modifier, createContainsDigits(secretNumber, roundNumber, 1));
  }

  if (id === "boss-range-seal") {
    Object.assign(modifier, createRangeSeal(secretNumber, maxNumber));
  }

  if (id === "boss-parity-radar") {
    modifier.parity = secretNumber % 2 === 0 ? "even" : "odd";
  }

  if (id === "boss-digit-choice") {
    Object.assign(modifier, createContainsDigits(secretNumber, roundNumber, 2));
  }

  if (id === "boss-digit-anchor") {
    Object.assign(modifier, createLockedDigit(secretNumber, maxNumber, roundNumber));
  }

  if (id === "boss-sum") {
    Object.assign(modifier, createDigitSumBand(secretNumber, maxNumber, roundNumber));
  }

  if (id === "boss-mirror") {
    modifier.mirrorMode = true;
  }

  if (id === "trap-range" || id.startsWith("boss")) {
    Object.assign(modifier, createTrapRange(secretNumber, maxNumber, roundNumber));
  }

  return modifier;
};

export const normalizeSinglePlayerModifier = (
  modifier: SinglePlayerModifierSnapshot | undefined | null,
  difficulty: Difficulty,
  roundNumber: number,
  secretNumber: number,
  maxNumber: number
) => {
  const fallback = createSinglePlayerModifier(difficulty, roundNumber, secretNumber, maxNumber);

  if (!modifier || typeof modifier !== "object" || typeof modifier.id !== "string") {
    return fallback;
  }

  if (!currentModifierIds.has(modifier.id)) {
    return fallback;
  }

  const id = modifier.id as SinglePlayerModifierId;
  const base = getModifierBase(id);

  return {
    ...fallback,
    ...modifier,
    id,
    roundNumber,
    label: typeof modifier.label === "string" ? modifier.label : base.label,
    shortLabel: typeof modifier.shortLabel === "string" ? modifier.shortLabel : base.shortLabel,
    description: typeof modifier.description === "string" ? modifier.description : base.description,
    accentColor: id.startsWith("boss")
      ? modifierColors[id]
      : typeof modifier.accentColor === "string"
        ? modifier.accentColor
        : modifierColors[id] ?? fallback.accentColor,
    scoreMultiplier:
      typeof modifier.scoreMultiplier === "number" && Number.isFinite(modifier.scoreMultiplier)
        ? Math.max(1, modifier.scoreMultiplier)
        : base.scoreMultiplier,
    isBoss: id.startsWith("boss")
  } satisfies SinglePlayerModifierSnapshot;
};

const getHotColdThresholds = (maxNumber: number) => {
  if (maxNumber <= 99) {
    return { burning: 2, hot: 7, warm: 14, cold: 28 };
  }

  if (maxNumber <= 999) {
    return { burning: 20, hot: 70, warm: 140, cold: 280 };
  }

  return { burning: 200, hot: 700, warm: 1400, cold: 2800 };
};

export const getHotColdLevel = (guess: number, secretNumber: number, maxNumber: number): HotColdLevel => {
  const difference = Math.abs(guess - secretNumber);
  const { burning, hot, warm, cold } = getHotColdThresholds(maxNumber);

  if (difference <= burning) {
    return "burning";
  }

  if (difference <= hot) {
    return "hot";
  }

  if (difference <= warm) {
    return "warm";
  }

  if (difference <= cold) {
    return "cold";
  }

  return "very-cold";
};

export const getHotColdLabel = (level: HotColdLevel) => hotColdMeta[level].label;
export const getHotColdColor = (level: HotColdLevel) => hotColdMeta[level].color;

export const isGuessInTrap = (guess: number, modifier: SinglePlayerModifierSnapshot) =>
  typeof modifier.trapStart === "number" &&
  typeof modifier.trapEnd === "number" &&
  guess >= modifier.trapStart &&
  guess <= modifier.trapEnd;

const getDirectionLabel = (result: GuessFeedback) =>
  result === "higher" ? "Higher" : result === "lower" ? "Lower" : result === "correct" ? "Correct" : "Missed";

const getDirectionColor = (result: GuessFeedback) =>
  result === "higher" ? "#ff8a6a" : result === "lower" ? "#61b7ff" : result === "correct" ? "#1fc46d" : "#9aa1a7";

const getTrapStatusText = (modifier: SinglePlayerModifierSnapshot) =>
  `Trap hit: ${modifier.trapStart}-${modifier.trapEnd}. You lost 2 guesses.`;

export const resolveSinglePlayerGuess = (
  guess: number,
  secretNumber: number,
  maxNumber: number,
  modifier: SinglePlayerModifierSnapshot
): SinglePlayerGuessResolution => {
  const result: GuessFeedback = guess === secretNumber ? "correct" : guess < secretNumber ? "higher" : "lower";
  const mirrorGuess = modifier.mirrorMode ? getMirrorNumber(guess, maxNumber) : null;
  const clueGuess = mirrorGuess ?? guess;
  const hotColdLevel = modifier.hotColdMode && result !== "correct" ? getHotColdLevel(clueGuess, secretNumber, maxNumber) : null;
  const trapped = result !== "correct" && isGuessInTrap(guess, modifier);
  const chanceCost = trapped ? 2 : 1;

  if (result === "correct") {
    return {
      result,
      chanceCost: 1,
      hotColdLevel: null,
      primaryLabel: "Correct",
      secondaryLabel: null,
      historyLabel: "Hit",
      historyColor: "#1fc46d",
      statusText: "Round cleared.",
      soundResult: "correct",
      trapped: false
    };
  }

  if (modifier.mirrorMode && mirrorGuess === secretNumber) {
    return {
      result,
      chanceCost,
      hotColdLevel,
      primaryLabel: "Broke Mirror",
      secondaryLabel: trapped ? `Mirror ${mirrorGuess} | Trap -2` : `Mirror ${mirrorGuess}`,
      historyLabel: trapped ? "Mirror Broken -2" : "Mirror Broken",
      historyColor: trapped ? "#ef476f" : modifierColors["boss-mirror"],
      statusText: trapped ? getTrapStatusText(modifier) : `You broke the mirror. ${mirrorGuess} is the target.`,
      soundResult: null,
      trapped
    };
  }

  if (modifier.hotColdMode === "blind" && hotColdLevel) {
    const temperatureLabel = getHotColdLabel(hotColdLevel);
    const primaryLabel = modifier.mirrorMode ? `Mirror ${temperatureLabel}` : temperatureLabel;
    const mirrorLabel = mirrorGuess ? `Mirror ${mirrorGuess}` : null;
    const trapLabel = trapped ? "Trap -2" : null;

    return {
      result,
      chanceCost,
      hotColdLevel,
      primaryLabel,
      secondaryLabel: [mirrorLabel, trapLabel].filter(Boolean).join(" | ") || null,
      historyLabel: trapped ? `${primaryLabel} -2` : primaryLabel,
      historyColor: trapped ? "#ef476f" : getHotColdColor(hotColdLevel),
      statusText: trapped
        ? getTrapStatusText(modifier)
        : `${modifier.mirrorMode && mirrorGuess ? `Mirror ${mirrorGuess}. ` : "Radar only. "}${hotColdGuidance[hotColdLevel]}`,
      soundResult: null,
      trapped
    };
  }

  const directionLabel = getDirectionLabel(result);

  return {
    result,
    chanceCost,
    hotColdLevel: null,
    primaryLabel: directionLabel,
    secondaryLabel: trapped ? "Trap -2" : null,
    historyLabel: trapped ? `${directionLabel} -2` : directionLabel,
    historyColor: trapped ? "#ef476f" : getDirectionColor(result),
    statusText: trapped ? getTrapStatusText(modifier) : "",
    soundResult: result,
    trapped
  };
};

export const getLockedDigitPattern = (modifier: SinglePlayerModifierSnapshot, maxNumber: number) => {
  if (typeof modifier.lockedDigitIndex !== "number" || typeof modifier.lockedDigitValue !== "string") {
    return null;
  }

  return Array.from({ length: getDigitCount(maxNumber) }, (_, index) =>
    index === modifier.lockedDigitIndex ? modifier.lockedDigitValue : "_"
  ).join(" ");
};

export const getModifierClueText = (modifier: SinglePlayerModifierSnapshot, maxNumber: number) => {
  const parts: string[] = [];
  const lockedPattern = getLockedDigitPattern(modifier, maxNumber);

  if (modifier.rangeSeal && typeof modifier.rangeSealValue === "number") {
    parts.push(
      modifier.rangeSeal === "at-or-above"
        ? `Target ${modifier.rangeSealValue}+.`
        : `Target below ${modifier.rangeSealValue}.`
    );
  }

  if (lockedPattern) {
    parts.push(`Locked ${lockedPattern}.`);
  }

  if (Array.isArray(modifier.containsDigits) && modifier.containsDigits.length > 0) {
    parts.push(
      modifier.containsDigits.length === 1
        ? `Contains ${modifier.containsDigits[0]}.`
        : `Contains ${modifier.containsDigits.join(" or ")}.`
    );
  }

  if (modifier.parity) {
    parts.push(`${modifier.parity[0].toUpperCase()}${modifier.parity.slice(1)} target.`);
  }

  if (typeof modifier.digitSumMin === "number" && typeof modifier.digitSumMax === "number") {
    parts.push(`Digit sum ${modifier.digitSumMin}-${modifier.digitSumMax}.`);
  }

  if (modifier.mirrorMode) {
    parts.push("Mirror heat clues.");
  } else if (modifier.hotColdMode === "blind") {
    parts.push("Heat clues.");
  }

  if (typeof modifier.trapStart === "number" && typeof modifier.trapEnd === "number") {
    parts.push("Hidden trap (-2 guesses).");
  }

  if (modifier.hotColdMode === "blind") {
    parts.push("Higher/lower disabled.");
  } else {
    parts.push("Higher/lower clues.");
  }

  return parts.join(" ");
};

export const getModifierRuleDetails = (modifier: SinglePlayerModifierSnapshot, maxNumber: number) => {
  const rules: string[] = [];
  const lockedPattern = getLockedDigitPattern(modifier, maxNumber);

  if (modifier.id === "classic") {
    return [
      "You get Higher or Lower after each wrong guess.",
      "No heat clues, hidden trap, or boss rule."
    ];
  }

  if (modifier.rangeSeal && typeof modifier.rangeSealValue === "number") {
    rules.push(
      modifier.rangeSeal === "at-or-above"
        ? `The target is ${modifier.rangeSealValue} or above.`
        : `The target is below ${modifier.rangeSealValue}.`
    );
  }

  if (lockedPattern) {
    rules.push(`One digit is locked in place: ${lockedPattern}.`);
  }

  if (Array.isArray(modifier.containsDigits) && modifier.containsDigits.length > 0) {
    rules.push(
      modifier.containsDigits.length === 1
        ? `The target contains digit ${modifier.containsDigits[0]}, but the position is hidden.`
        : `The target contains ${modifier.containsDigits.join(" or ")}. One of them is real.`
    );
  }

  if (modifier.parity) {
    rules.push(`The target is ${modifier.parity}.`);
  }

  if (typeof modifier.digitSumMin === "number" && typeof modifier.digitSumMax === "number") {
    rules.push(`The target's digits add up to ${modifier.digitSumMin}-${modifier.digitSumMax}.`);
  }

  if (modifier.mirrorMode) {
    rules.push(`Each guess has a mirror: ${maxNumber + 1} minus your guess.`);
    rules.push("Heat is based on the mirror number, not your guess.");
    rules.push("If the mirror is the target, you broke the mirror.");
  } else if (modifier.hotColdMode === "blind") {
    rules.push("You get heat clues only: Very Cold, Cold, Warm, Hot, or Burning.");
  }

  if (modifier.hotColdMode === "blind") {
    rules.push("Higher and Lower are disabled for this round.");
  } else {
    rules.push("Higher and Lower are available.");
  }

  if (typeof modifier.trapStart === "number" && typeof modifier.trapEnd === "number") {
    rules.push("A hidden trap exists. A wrong guess in the danger zone costs 2 guesses.");
    rules.push("The trap range is revealed only if you hit it.");
  } else {
    rules.push("No hidden trap.");
  }

  return rules;
};

export const getNextMilestone = (roundNumber: number) => {
  if (roundNumber < 5) {
    return 5;
  }

  return Math.ceil((roundNumber + 1) / 10) * 10;
};
