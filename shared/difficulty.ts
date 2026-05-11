import type { Difficulty } from "./game.types";

export const DEFAULT_DIFFICULTY: Difficulty = "easy";

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  {
    label: string;
    maxNumber: number;
    startingChances: number;
  }
> = {
  easy: {
    label: "Easy",
    maxNumber: 99,
    startingChances: 8
  },
  hard: {
    label: "Hard",
    maxNumber: 999,
    startingChances: 10
  },
  impossible: {
    label: "Impossible",
    maxNumber: 9999,
    startingChances: 12
  }
};

export const parseDifficulty = (value: string | string[] | undefined): Difficulty => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;

  if (normalizedValue === "hard" || normalizedValue === "impossible") {
    return normalizedValue;
  }

  return DEFAULT_DIFFICULTY;
};

export const getDifficultyConfig = (difficulty: Difficulty) => DIFFICULTY_CONFIG[difficulty];

export const getDifficultyRangeLabel = (difficulty: Difficulty) => {
  const config = getDifficultyConfig(difficulty);
  return `1-${config.maxNumber}`;
};
