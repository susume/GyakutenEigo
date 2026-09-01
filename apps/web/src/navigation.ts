export type AppMode = "home" | "quizStrike" | "teacher" | "student" | "characterLab" | "tournamentStudy" | "speaking";

export const normalizeRoutePath = (path: string) => (path === "/" ? path : path.replace(/\/+$/, ""));

export const getJoinCodeFromSearch = (search: string) =>
  new URLSearchParams(search).get("code")?.trim().toUpperCase() ?? "";

export const getTournamentInvitationCodeFromSearch = (search: string) =>
  new URLSearchParams(search).get("code")?.trim().toUpperCase() ?? "";

export const buildStudentJoinUrl = (origin: string, sessionCode: string) =>
  `${origin.replace(/\/$/, "")}/join?code=${encodeURIComponent(sessionCode.trim().toUpperCase())}`;

export const buildSpeakingJoinUrl = (origin: string, activityCode: string) =>
  `${origin.replace(/\/$/, "")}/speak/join/${encodeURIComponent(activityCode.trim().toUpperCase())}`;

export const isSpeakingTeacherRoute = (routePath: string) =>
  routePath === "/speak/teacher" || routePath.startsWith("/speak/teacher/");

export const isTeacherSpeakingRoute = (routePath: string) =>
  isSpeakingTeacherRoute(routePath) ||
  routePath === "/quiz-strike/teacher/speaking" ||
  routePath.startsWith("/quiz-strike/teacher/speaking/");

/**
 * Canonical teacher URLs keep Speaking Practice inside the QuizStrike teacher
 * workspace. The old /speak/teacher/* URLs remain valid as compatibility
 * aliases for saved bookmarks and shared links.
 */
export const buildTeacherSpeakingPath = (routePath: string) => {
  const normalized = normalizeRoutePath(routePath);
  if (!isSpeakingTeacherRoute(normalized)) return normalized;
  return `/quiz-strike/teacher/speaking${normalized.slice("/speak/teacher".length)}`;
};

export const modeForRoute = (routePath: string): AppMode =>
  routePath === "/character-lab"
    ? "characterLab"
    : routePath === "/speak" || routePath.startsWith("/speak/")
      ? isSpeakingTeacherRoute(routePath)
        ? "teacher"
        : "speaking"
    : routePath.startsWith("/tournament-study/")
      ? "tournamentStudy"
    : routePath === "/quiz-strike/teacher" || routePath.startsWith("/quiz-strike/teacher/")
      ? "teacher"
    : routePath === "/join" || routePath === "/game"
      ? "student"
      : routePath === "/quiz-strike" || routePath.startsWith("/quiz-strike/")
        ? "quizStrike"
        : "home";
