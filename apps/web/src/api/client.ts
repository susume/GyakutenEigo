import type { Choice, SessionSettings } from "@quizstrike/shared";
import { ApiError } from "./errors";

export { ApiError } from "./errors";

const cleanUrl = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/$/, "") : undefined;
};

const localApiUrl = `${window.location.protocol}//${window.location.hostname}:4000`;
const API_URL =
  cleanUrl(import.meta.env.VITE_API_URL as string | undefined) ??
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? localApiUrl : window.location.origin);

const getToken = () => localStorage.getItem("quizstrike_token");

const playerHeaders = (playerToken: string) => ({ "X-Player-Token": playerToken });

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new ApiError(
      `Could not reach the Quiz-Strike game server at ${API_URL}. Check that the server is deployed, VITE_API_URL is correct, and CLIENT_ORIGIN allows this web address.`,
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
  report: (code: string) => api(`/api/sessions/${code}/report`),
  reportCsv: async (code: string) => {
    const token = getToken();
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/sessions/${code}/report.csv`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
    } catch {
      throw new ApiError(
        `Could not reach the Quiz-Strike game server at ${API_URL}. Check that the server is deployed, VITE_API_URL is correct, and CLIENT_ORIGIN allows this web address.`,
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

export { API_URL };
