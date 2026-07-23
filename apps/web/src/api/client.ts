import type { CharacterCustomizationSettings, Choice, PlayerAppearance, SessionSettings } from "@quizstrike/shared";
import { ApiError } from "./errors";
import { buildApiUrlCandidates, fetchFromApiCandidates } from "./endpoints.js";

export { ApiError } from "./errors";

export interface DecalModerationAsset {
  assetId: string;
  playerId: string;
  nickname: string;
  mimeType: "image/png" | "image/webp";
  byteLength: number;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

export interface DecalModerationSummary {
  assets: DecalModerationAsset[];
  totalBytes: number;
  maxBytes: number;
}

const cleanUrl = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/$/, "") : undefined;
};

const API_URL =
  cleanUrl(import.meta.env.VITE_API_URL as string | undefined) ??
  window.location.origin;
const DEFAULT_HOSTED_FALLBACK = "https://gyakuteneigo-api.onrender.com";
const API_URLS = buildApiUrlCandidates(
  API_URL,
  cleanUrl(import.meta.env.VITE_API_FALLBACK_URL as string | undefined) ??
    (API_URL === "https://api.gyakuteneigo.com" ? DEFAULT_HOSTED_FALLBACK : undefined)
);
let activeApiUrl = API_URLS[0] ?? API_URL;

export const getApiUrl = () => activeApiUrl;

const fetchApi = async (path: string, options?: RequestInit) => {
  const result = await fetchFromApiCandidates({
    candidates: API_URLS,
    activeUrl: activeApiUrl,
    path,
    options
  });
  activeApiUrl = result.url;
  return result.response;
};

const getToken = () => localStorage.getItem("quizstrike_token");

const playerHeaders = (playerToken: string) => ({ "X-Player-Token": playerToken });

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetchApi(path, {
      ...options,
      headers
    });
  } catch {
    throw new ApiError(
      "QuizStrike could not connect to the game server. Reload the page and try again. If this only happens on the school network, ask school IT to allow api.gyakuteneigo.com and gyakuteneigo-api.onrender.com.",
      0
    );
  }

  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new ApiError(payload.error ?? "Request failed.", response.status);
  }
  return payload as T;
}

export const authApi = {
  signup: (body: { name: string; email: string; password: string }) =>
    api("/api/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    api("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => api("/api/me")
};

export const teacherApi = {
  dashboard: () => api("/api/teacher/dashboard"),
  createClass: (body: { name: string; description?: string }) =>
    api("/api/classes", { method: "POST", body: JSON.stringify(body) }),
  createQuizSet: (body: { title: string; description?: string; classId?: string }) =>
    api("/api/quiz-sets", { method: "POST", body: JSON.stringify(body) }),
  getQuizSet: (id: string) => api(`/api/quiz-sets/${id}`),
  addQuestion: (quizSetId: string, body: Record<string, string>) =>
    api(`/api/quiz-sets/${quizSetId}/questions`, { method: "POST", body: JSON.stringify(body) }),
  updateQuestion: (questionId: string, body: Record<string, string>) =>
    api(`/api/questions/${questionId}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteQuestion: (questionId: string) => api(`/api/questions/${questionId}`, { method: "DELETE" }),
  createSession: (body: { quizSetId: string; classId?: string; settings?: Partial<SessionSettings> }) =>
    api("/api/sessions", { method: "POST", body: JSON.stringify(body) }),
  startSession: (code: string) => api(`/api/sessions/${code}/start`, { method: "POST" }),
  endSession: (code: string) => api(`/api/sessions/${code}/end`, { method: "POST" }),
  addBot: (code: string) => api(`/api/sessions/${code}/bots`, { method: "POST" }),
  updateCustomization: (code: string, settings: CharacterCustomizationSettings) =>
    api(`/api/sessions/${code}/customization`, { method: "PUT", body: JSON.stringify(settings) }),
  clearPlayerAppearance: (code: string, playerId: string) =>
    api(`/api/sessions/${code}/players/${playerId}/appearance`, { method: "DELETE" }),
  removePlayerDecal: (code: string, playerId: string) =>
    api(`/api/sessions/${code}/players/${playerId}/decal`, { method: "DELETE" }),
  listDecals: (code: string) => api(`/api/sessions/${code}/decals`),
  removeDecalAsset: (code: string, assetId: string) =>
    api(`/api/sessions/${code}/decals/${assetId}`, { method: "DELETE" }),
  resetAppearances: (code: string) => api(`/api/sessions/${code}/appearance/reset`, { method: "POST" }),
  report: (code: string) => api(`/api/sessions/${code}/report`),
  reportCsv: async (code: string) => {
    const token = getToken();
    let response: Response;
    try {
      response = await fetchApi(`/api/sessions/${code}/report.csv`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
    } catch {
      throw new ApiError(
        "QuizStrike could not connect to the game server. Reload the page and try again. If this only happens on the school network, ask school IT to allow api.gyakuteneigo.com and gyakuteneigo-api.onrender.com.",
        0
      );
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(payload.error ?? "CSV export failed.", response.status);
    }
    return response.blob();
  }
};

export const studentApi = {
  join: (code: string, nickname: string) =>
    api(`/api/sessions/${code}/join`, { method: "POST", body: JSON.stringify({ nickname }) }),
  chooseTeam: (code: string, playerId: string, playerToken: string, team: "red" | "blue") =>
    api(`/api/sessions/${code}/players/${playerId}/team`, {
      method: "POST",
      headers: playerHeaders(playerToken),
      body: JSON.stringify({ team })
    }),
  saveAppearance: (code: string, playerId: string, playerToken: string, appearance: PlayerAppearance) =>
    api(`/api/sessions/${code}/players/${playerId}/appearance`, {
      method: "PUT",
      headers: playerHeaders(playerToken),
      body: JSON.stringify({ appearance })
    }),
  uploadDecal: (code: string, playerId: string, playerToken: string, blob: Blob) =>
    api(`/api/sessions/${code}/players/${playerId}/decals`, {
      method: "POST",
      headers: { ...playerHeaders(playerToken), "Content-Type": blob.type },
      body: blob
    }),
  session: (code: string) => api(`/api/sessions/${code}`),
  rejoin: (code: string, playerId: string, playerToken: string) =>
    api(`/api/sessions/${code}/players/${playerId}/rejoin`, { headers: playerHeaders(playerToken) }),
  question: (code: string, playerId: string, playerToken: string) =>
    api(`/api/sessions/${code}/players/${playerId}/question`, { headers: playerHeaders(playerToken) }),
  answer: (
    code: string,
    playerId: string,
    playerToken: string,
    body: { questionId: string; selectedChoice: Choice; responseTimeMs?: number }
  ) =>
    api(`/api/sessions/${code}/players/${playerId}/answer`, {
      method: "POST",
      headers: playerHeaders(playerToken),
      body: JSON.stringify(body)
    }),
  buy: (code: string, playerId: string, playerToken: string, gearId: string) =>
    api(`/api/sessions/${code}/players/${playerId}/buy`, {
      method: "POST",
      headers: playerHeaders(playerToken),
      body: JSON.stringify({ gearId })
    }),
  buySnowballs: (code: string, playerId: string, playerToken: string) =>
    api(`/api/sessions/${code}/players/${playerId}/buy-snowballs`, {
      method: "POST",
      headers: playerHeaders(playerToken)
    })
};

export const fetchDecalAsset = async (code: string, assetId: string, playerToken?: string): Promise<Blob> => {
  const teacherToken = getToken();
  const headers = playerToken
    ? playerHeaders(playerToken)
    : teacherToken
      ? { Authorization: `Bearer ${teacherToken}` }
      : undefined;
  const response = await fetchApi(`/api/sessions/${code}/decals/${assetId}`, { headers });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(payload.error ?? "Decal is unavailable.", response.status);
  }
  return response.blob();
};

export { API_URL };
