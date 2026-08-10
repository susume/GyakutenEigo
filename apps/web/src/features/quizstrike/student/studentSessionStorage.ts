export type StoredStudentSession = { sessionCode: string; playerId: string; playerToken: string };

const STUDENT_SESSION_STORAGE_KEY = "quizstrike_student_session";
const COSMETIC_PROGRESS_STORAGE_KEY = "quizstrike_cosmetic_progress_v1";
const STORED_APPEARANCE_HANDOFF_KEY = "quizstrike_apply_stored_appearance_v1";

export const readStoredStudentSession = (): StoredStudentSession | null => {
  try {
    const raw = localStorage.getItem(STUDENT_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredStudentSession>;
    return stored.sessionCode && stored.playerId && stored.playerToken
      ? { sessionCode: stored.sessionCode, playerId: stored.playerId, playerToken: stored.playerToken }
      : null;
  } catch {
    return null;
  }
};

export const storeStudentSession = (session: StoredStudentSession) => {
  localStorage.setItem(STUDENT_SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredStudentSession = () => localStorage.removeItem(STUDENT_SESSION_STORAGE_KEY);

export const readCosmeticProgressToken = () => {
  const token = localStorage.getItem(COSMETIC_PROGRESS_STORAGE_KEY);
  return token && token.length <= 2_048 ? token : undefined;
};

export const storeCosmeticProgressToken = (token?: string) => {
  if (token && token.length <= 2_048) localStorage.setItem(COSMETIC_PROGRESS_STORAGE_KEY, token);
};

export const markStoredAppearanceForSession = (sessionCode: string, playerId: string) => {
  try {
    sessionStorage.setItem(STORED_APPEARANCE_HANDOFF_KEY, `${sessionCode}:${playerId}`);
  } catch {
    // Appearance replay is optional; joining must still succeed when session storage is unavailable.
  }
};

export const consumeStoredAppearanceForSession = (sessionCode: string, playerId: string) => {
  try {
    const expected = `${sessionCode}:${playerId}`;
    if (sessionStorage.getItem(STORED_APPEARANCE_HANDOFF_KEY) !== expected) return false;
    sessionStorage.removeItem(STORED_APPEARANCE_HANDOFF_KEY);
    return true;
  } catch {
    return false;
  }
};
