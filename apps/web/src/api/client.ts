import type { CharacterCustomizationSettings, Choice, PlayerAppearance, SessionSettings, StudySetSummary } from "@quizstrike/shared";
import { ApiError } from "./errors";
import { ApiRequestTimeoutError, buildApiUrlCandidates, fetchFromApiCandidates, resolveApiOrigin } from "./endpoints.js";
import { retryOnce } from "./retry.js";

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

// The production browser must stay on the public website origin. External
// origins are intentionally limited to local/test overrides so a blocked
// Render/API hostname is never exposed as a student-facing fallback.
const allowConfiguredApiOrigin = Boolean(import.meta.env.DEV || import.meta.env.MODE === "test");
const API_URL = resolveApiOrigin({
  pageOrigin: window.location.origin,
  configuredOrigin: cleanUrl(import.meta.env.VITE_API_URL as string | undefined),
  allowConfiguredOrigin: allowConfiguredApiOrigin
});
const API_URLS = buildApiUrlCandidates(
  API_URL,
  allowConfiguredApiOrigin ? cleanUrl(import.meta.env.VITE_API_FALLBACK_URL as string | undefined) : undefined
);
let activeApiUrl = API_URLS[0] ?? API_URL;

export const getApiUrl = () => activeApiUrl;

type ApiRequestPolicy = {
  attemptTimeoutMs?: number;
};

export type AuthRequestOptions = {
  onRetry?: () => void;
};

const fetchApi = async (path: string, options?: RequestInit, policy: ApiRequestPolicy = {}) => {
  const result = await fetchFromApiCandidates({
    candidates: API_URLS,
    activeUrl: activeApiUrl,
    path,
    options,
    attemptTimeoutMs: policy.attemptTimeoutMs ?? 12_000
  });
  activeApiUrl = result.url;
  return result.response;
};

const getToken = () => localStorage.getItem("quizstrike_token");
export const getTeacherToken = getToken;

const playerHeaders = (playerToken: string) => ({ "X-Player-Token": playerToken });

export async function api<T>(path: string, options: RequestInit = {}, policy: ApiRequestPolicy = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetchApi(path, {
      ...options,
      headers
    }, policy);
  } catch (error) {
    const timedOut = error instanceof ApiRequestTimeoutError;
    throw new ApiError(
      timedOut
        ? "The game server took too long to respond. It may be waking up; wait a few seconds and try again."
        : "We can open QuizStrike, but this network cannot reach the game server. Try again, or ask your teacher for help.",
      0,
      { kind: timedOut ? "timeout" : "network", cause: error }
    );
  }

  const responseText = await response.text();
  let payload: { error?: string } = {};
  if (responseText) {
    try { payload = JSON.parse(responseText) as { error?: string }; } catch { /* A proxy or old server may return HTML. */ }
  }
  if (!response.ok) {
    if (import.meta.env.DEV) {
      console.error(`[api] ${options.method ?? "GET"} ${path} failed with ${response.status}`, payload.error ?? responseText.slice(0, 300));
    }
    throw new ApiError(payload.error ?? "QuizStrike couldn't complete that request. Try again.", response.status, {
      kind: response.status >= 500 ? "server" : "http"
    });
  }
  return payload as T;
}

let apiWarmupPromise: Promise<void> | undefined;

const warmApi = () => {
  if (!apiWarmupPromise) {
    apiWarmupPromise = fetchApi("/api/health", undefined, { attemptTimeoutMs: 35_000 })
      .then((response) => {
        if (!response.ok) throw new ApiError("The game server is still waking up.", response.status);
      })
      .catch((error) => {
        apiWarmupPromise = undefined;
        throw error;
      });
  }
  return apiWarmupPromise;
};

const isTemporaryAuthFailure = (error: unknown) =>
  error instanceof ApiError && (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504);

const requestLogin = async (
  body: { email: string; password: string },
  options: AuthRequestOptions = {}
) => {
  try {
    return await retryOnce({
      request: (attempt) => api(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify(body) },
        { attemptTimeoutMs: attempt === 0 ? 6_000 : 24_000 }
      ),
      shouldRetry: isTemporaryAuthFailure,
      onRetry: options.onRetry,
      delayMs: 1_000
    });
  } catch (error) {
    if (isTemporaryAuthFailure(error)) {
      throw new ApiError(
        "The free game server is still waking up. Wait 15 seconds, then try logging in again.",
        0
      );
    }
    throw error;
  }
};

export const authApi = {
  warmUp: warmApi,
  signup: (body: { name: string; email: string; password: string }) =>
    api("/api/auth/signup", { method: "POST", body: JSON.stringify(body) }, { attemptTimeoutMs: 30_000 }),
  login: requestLogin,
  me: () => api("/api/me", {}, { attemptTimeoutMs: 10_000 })
};

export const competitionApi = {
  list: (filters: Record<string, string> = {}) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    return api(`/api/competitions${params.toString() ? `?${params.toString()}` : ""}`);
  },
  detail: (slug: string) => api(`/api/competitions/${encodeURIComponent(slug)}`),
  studyPack: (slug: string) => api(`/api/competitions/${encodeURIComponent(slug)}/study-pack`),
  matches: (slug: string) => api(`/api/competitions/${encodeURIComponent(slug)}/matches`),
  mine: () => api("/api/competitions/mine"),
  registerTeam: (slug: string, body: Record<string, unknown>) =>
    api(`/api/competitions/${encodeURIComponent(slug)}/teams`, { method: "POST", body: JSON.stringify(body) }),
  checkIn: (teamId: string) => api(`/api/competition-teams/${encodeURIComponent(teamId)}/check-in`, { method: "POST" }),
  matchRoom: (matchId: string) => api(`/api/competition-matches/${encodeURIComponent(matchId)}/room`),
  create: (body: Record<string, unknown>) => api("/api/competitions", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Record<string, unknown>) => api(`/api/competitions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  publishAnnouncement: (id: string, body: { title: string; body: string; pinned?: boolean }) =>
    api(`/api/competitions/${encodeURIComponent(id)}/announcements`, { method: "POST", body: JSON.stringify(body) }),
  saveStudyPack: (id: string, body: Record<string, unknown>) =>
    api(`/api/competitions/${encodeURIComponent(id)}/study-pack`, { method: "POST", body: JSON.stringify(body) }),
  generateBracket: (id: string) => api(`/api/competitions/${encodeURIComponent(id)}/bracket`, { method: "POST" }),
  attachMatchRoom: (matchId: string, sessionCode: string) => api(`/api/competition-matches/${encodeURIComponent(matchId)}/room`, { method: "POST", body: JSON.stringify({ sessionCode }) }),
  confirmResult: (matchId: string, body: Record<string, unknown>) => api(`/api/competition-matches/${encodeURIComponent(matchId)}/result`, { method: "POST", body: JSON.stringify(body) }),
  organizer: () => api("/api/organizer/competitions")
};

export const tournamentApi = {
  list: () => api("/api/tournaments"),
  detail: (id: string) => api(`/api/tournaments/${encodeURIComponent(id)}`),
  create: (body: Record<string, unknown>) => api("/api/tournaments", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Record<string, unknown>) => api(`/api/tournaments/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  publish: (id: string) => api(`/api/tournaments/${encodeURIComponent(id)}/publish`, { method: "POST" }),
  saveStudyPack: (id: string, body: Record<string, unknown>) => api(`/api/tournaments/${encodeURIComponent(id)}/study-pack`, { method: "POST", body: JSON.stringify(body) }),
  releaseStudyPack: (id: string) => api(`/api/tournaments/${encodeURIComponent(id)}/study-pack/release`, { method: "POST" }),
  createInvitation: (id: string) => api(`/api/tournaments/${encodeURIComponent(id)}/invitations`, { method: "POST" }),
  invitationDetails: (id: string, code: string) => api(`/api/tournament-invitations/${encodeURIComponent(id)}?code=${encodeURIComponent(code)}`),
  addTeam: (id: string, body: Record<string, unknown>) => api(`/api/tournaments/${encodeURIComponent(id)}/teams`, { method: "POST", body: JSON.stringify(body) }),
  approveTeam: (id: string, teamId: string) => api(`/api/tournaments/${encodeURIComponent(id)}/teams/${encodeURIComponent(teamId)}/approve`, { method: "POST" }),
  checkInTeam: (id: string, teamId: string) => api(`/api/tournaments/${encodeURIComponent(id)}/teams/${encodeURIComponent(teamId)}/check-in`, { method: "POST" }),
  generateBracket: (id: string) => api(`/api/tournaments/${encodeURIComponent(id)}/bracket`, { method: "POST" }),
  launchMatch: (id: string, matchId: string, sessionCode: string) => api(`/api/tournaments/${encodeURIComponent(id)}/matches/${encodeURIComponent(matchId)}/launch`, { method: "POST", body: JSON.stringify({ sessionCode }) }),
  linkResult: (id: string, matchId: string) => api(`/api/tournaments/${encodeURIComponent(id)}/matches/${encodeURIComponent(matchId)}/link-result`, { method: "POST" }),
  cancelMatch: (id: string, matchId: string, reason: string) => api(`/api/tournaments/${encodeURIComponent(id)}/matches/${encodeURIComponent(matchId)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) })
};

export const teacherApi = {
  dashboard: () => api("/api/teacher/dashboard"),
  recognition: () => api("/api/teacher/recognition"),
  studySets: (filters: Record<string, string> = {}) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    return api(`/api/study-sets${params.toString() ? `?${params.toString()}` : ""}`) as Promise<{ items: StudySetSummary[]; page: number; pageSize: number; total: number }>;
  },
  studySet: (id: string) => api(`/api/study-sets/${encodeURIComponent(id)}`),
  updateStudySet: (id: string, body: Record<string, unknown>) => api(`/api/study-sets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  duplicateStudySet: (id: string, title?: string) => api(`/api/study-sets/${encodeURIComponent(id)}/duplicate`, { method: "POST", body: JSON.stringify(title ? { title } : {}) }),
  createClass: (body: { name: string; description?: string }) =>
    api("/api/classes", { method: "POST", body: JSON.stringify(body) }),
  createQuizSet: (body: { title: string; description?: string; classId?: string; folderId?: string; visibility?: "PRIVATE" | "PUBLIC"; subject?: string; topic?: string; gradeLevel?: string; language?: string; tags?: string[] }) =>
    api("/api/quiz-sets", { method: "POST", body: JSON.stringify(body) }),
  renameQuizSet: (id: string, title: string) =>
    api(`/api/quiz-sets/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  moveQuizSet: (id: string, folderId?: string) =>
    api(`/api/quiz-sets/${id}/move`, { method: "POST", body: JSON.stringify({ folderId: folderId ?? null }) }),
  deleteQuizSet: (id: string) => api(`/api/quiz-sets/${id}`, { method: "DELETE" }),
  createFolder: (body: { name: string; parentId?: string }) =>
    api("/api/folders", { method: "POST", body: JSON.stringify(body) }),
  updateFolder: (id: string, body: { name?: string; parentId?: string | null }) =>
    api(`/api/folders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteFolder: (id: string) => api(`/api/folders/${id}`, { method: "DELETE" }),
  getQuizSet: (id: string) => api(`/api/quiz-sets/${id}`),
  addQuestion: (quizSetId: string, body: Record<string, unknown>) =>
    api(`/api/quiz-sets/${quizSetId}/questions`, { method: "POST", body: JSON.stringify(body) }),
  updateQuestion: (questionId: string, body: Record<string, unknown>) =>
    api(`/api/questions/${questionId}`, { method: "PUT", body: JSON.stringify(body) }),
  uploadQuestionAudio: (questionId: string, audio: Blob) =>
    api(`/api/questions/${questionId}/audio`, {
      method: "POST",
      headers: { "Content-Type": audio.type || "audio/webm" },
      body: audio
    }),
  deleteQuestion: (questionId: string) => api(`/api/questions/${questionId}`, { method: "DELETE" }),
  createSession: (body: { quizSetId: string; classId?: string; settings?: Partial<SessionSettings> }) =>
    api("/api/sessions", { method: "POST", body: JSON.stringify(body) }),
  startSession: (code: string) => api(`/api/sessions/${code}/start`, { method: "POST" }),
  pauseSession: (code: string) => api(`/api/sessions/${code}/pause`, { method: "POST" }),
  resumeSession: (code: string) => api(`/api/sessions/${code}/resume`, { method: "POST" }),
  endRound: (code: string) => api(`/api/sessions/${code}/end-round`, { method: "POST" }),
  endSession: (code: string) => api(`/api/sessions/${code}/end`, { method: "POST" }),
  addBots: (code: string, body: { count: number; difficulty: "beginner" | "standard" | "advanced" }) =>
    api(`/api/sessions/${code}/bots`, { method: "POST", body: JSON.stringify(body) }),
  removePlayer: (code: string, playerId: string) =>
    api(`/api/sessions/${code}/players/${playerId}`, { method: "DELETE" }),
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
  reports: () => api("/api/reports"),
  reportById: (id: string) => api(`/api/reports/${id}`),
  deleteReport: (id: string) => api(`/api/reports/${id}`, { method: "DELETE" }),
  deleteSessionHistory: () => api("/api/sessions/history", { method: "DELETE" }),
  reportCsv: async (code: string) => {
    const token = getToken();
    let response: Response;
    try {
      response = await fetchApi(`/api/sessions/${code}/report.csv`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
    } catch (error) {
      const timedOut = error instanceof ApiRequestTimeoutError;
      throw new ApiError(
        timedOut
          ? "The game server took too long to respond. It may be waking up; wait a few seconds and try again."
          : "We can open QuizStrike, but this network cannot reach the game server. Try again, or ask your teacher for help.",
        0,
        { kind: timedOut ? "timeout" : "network", cause: error }
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
  join: (code: string, nickname: string, cosmeticProgressToken?: string) =>
    api(`/api/sessions/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ nickname, ...(cosmeticProgressToken ? { cosmeticProgressToken } : {}) })
    }),
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
  session: (code: string, playerToken: string) =>
    api(`/api/sessions/${code}`, { headers: playerHeaders(playerToken) }),
  rejoin: (code: string, playerId: string, playerToken: string) =>
    api(`/api/sessions/${code}/players/${playerId}/rejoin`, { headers: playerHeaders(playerToken) }),
  learningReport: (code: string, playerId: string, playerToken: string) =>
    api(`/api/sessions/${code}/players/${playerId}/learning-report`, { headers: playerHeaders(playerToken) }),
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
