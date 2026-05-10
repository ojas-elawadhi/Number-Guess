import type {
  DailyPuzzleGuessPayload,
  DailyPuzzleGuessResponse,
  DailyPuzzleStatusResponse,
  ClaimDailyRewardResponse,
  ProgressBootstrapPayload,
  ProgressPreferencesPayload,
  ProgressSyncResponse,
  RecordMatchPayload,
  RecordMatchResponse,
  UpdateDisplayNameResponse
} from "../../shared/progression.types";

const inferLocalDevApiUrl = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const hostname = window.location?.hostname;

  if (!hostname) {
    return undefined;
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:3001";
  }

  return undefined;
};

const normalizeBaseUrl = (value?: string) => {
  if (!value) {
    return "http://localhost:3001";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace(/\/+$/, "");
  }

  if (value.includes("localhost") || /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(value)) {
    return `http://${value}`.replace(/\/+$/, "");
  }

  return `https://${value}`.replace(/\/+$/, "");
};

const API_BASE_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_API_URL ?? inferLocalDevApiUrl() ?? process.env.EXPO_PUBLIC_SOCKET_URL
);

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const jsonPayload = (await response.clone().json().catch(() => null)) as { message?: string } | null;

    if (jsonPayload?.message) {
      throw new Error(jsonPayload.message);
    }

    const textPayload = await response.text().catch(() => "");
    const compactText = textPayload.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    throw new Error(compactText || "Could not sync player progress.");
  }

  return response.json() as Promise<T>;
};

export const bootstrapProgress = (payload: ProgressBootstrapPayload) =>
  request<ProgressSyncResponse>("/api/progression/bootstrap", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const updateProgressPreferences = (payload: ProgressPreferencesPayload) =>
  request<ProgressSyncResponse>("/api/progression/preferences", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const updateDisplayNameRemote = (playerKey: string, displayName: string) =>
  request<UpdateDisplayNameResponse>("/api/progression/display-name", {
    method: "PATCH",
    body: JSON.stringify({
      playerKey,
      displayName
    })
  });

export const claimDailyRewardRemote = (playerKey: string) =>
  request<ClaimDailyRewardResponse>("/api/progression/daily-reward", {
    method: "POST",
    body: JSON.stringify({
      playerKey
    })
  });

export const recordMatchRemote = (payload: RecordMatchPayload) =>
  request<RecordMatchResponse>("/api/progression/match", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const fetchDailyPuzzleStatusRemote = (playerKey: string, dateKey: string) =>
  request<DailyPuzzleStatusResponse>(
    `/api/daily-puzzle/status?playerKey=${encodeURIComponent(playerKey)}&dateKey=${encodeURIComponent(dateKey)}`
  );

export const submitDailyPuzzleGuessRemote = (payload: DailyPuzzleGuessPayload) =>
  request<DailyPuzzleGuessResponse>("/api/daily-puzzle/guess", {
    method: "POST",
    body: JSON.stringify(payload)
  });
