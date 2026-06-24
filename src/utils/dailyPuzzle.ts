import type { DailyPuzzleCompletion } from "../types/progression.types";
import { getTodayKey } from "./progression";

export const DAILY_PUZZLE_DEFAULT_MAX = 9999;

const getLocalDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const getUtcTodayKey = (date = new Date()) => date.toISOString().slice(0, 10);
export const getLocalTodayKey = getUtcTodayKey;
export const isTodayPuzzleDate = (dateKey: string) => dateKey === getUtcTodayKey();

export const shiftUtcDateKeyByDays = (dateKey: string, delta: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
};

export const getMonthKeyFromDateKey = (dateKey: string) => dateKey.slice(0, 7);

export const shiftMonthKey = (monthKey: string, delta: number) => {
  const baseDate = getLocalDate(`${monthKey}-01`);
  return getTodayKey(new Date(baseDate.getFullYear(), baseDate.getMonth() + delta, 1)).slice(0, 7);
};

export const getMonthLabel = (monthKey: string) =>
  getLocalDate(`${monthKey}-01`).toLocaleString("en-US", {
    month: "long",
    year: "numeric"
  });

export const getShortMonthLabel = (monthKey: string) =>
  getLocalDate(`${monthKey}-01`).toLocaleString("en-US", {
    month: "short"
  });

export const getDayFromDateKey = (dateKey: string) => Number(dateKey.slice(8, 10));

export const getDaysInMonth = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

export const getMonthCompletions = (
  completedByDate: Record<string, DailyPuzzleCompletion>,
  monthKey: string
) =>
  Object.entries(completedByDate)
    .filter(([dateKey]) => dateKey.startsWith(`${monthKey}-`))
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate));

export const buildCalendarDays = (monthKey: string) => {
  const firstDate = getLocalDate(`${monthKey}-01`);
  const firstWeekDay = firstDate.getDay();
  const daysInMonth = getDaysInMonth(monthKey);
  const cells: Array<{ dateKey: string; day: number } | null> = Array.from({ length: firstWeekDay }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      dateKey: `${monthKey}-${`${day}`.padStart(2, "0")}`,
      day
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

export const formatPlayLabel = (dateKey: string) =>
  getLocalDate(dateKey).toLocaleString("en-US", {
    month: "short",
    day: "numeric"
  });

export const getDeterministicDailyPuzzleNumber = (dateKey: string, maxNumber = DAILY_PUZZLE_DEFAULT_MAX) => {
  let hash = 2166136261;

  for (let index = 0; index < dateKey.length; index += 1) {
    hash ^= dateKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (Math.abs(hash) % maxNumber) + 1;
};
