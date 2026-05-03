import type {
  ClaimDailyRewardResponse,
  ProgressBootstrapPayload,
  ProgressPreferencesPayload,
  ProgressSyncResponse,
  RecordMatchPayload,
  RecordMatchResponse
} from "../../shared/progression.types";

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

const API_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_SOCKET_URL);

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Could not sync player progress.");
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
