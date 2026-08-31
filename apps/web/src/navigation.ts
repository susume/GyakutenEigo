export type AppMode = "home" | "quizStrike" | "teacher" | "student" | "characterLab" | "tournamentStudy" | "speaking";

export const normalizeRoutePath = (path: string) => (path === "/" ? path : path.replace(/\/$/, ""));

export const getJoinCodeFromSearch = (search: string) =>
  new URLSearchParams(search).get("code")?.trim().toUpperCase() ?? "";

export const getTournamentInvitationCodeFromSearch = (search: string) =>
  new URLSearchParams(search).get("code")?.trim().toUpperCase() ?? "";

export const buildStudentJoinUrl = (origin: string, sessionCode: string) =>
  `${origin.replace(/\/$/, "")}/join?code=${encodeURIComponent(sessionCode.trim().toUpperCase())}`;

export const buildSpeakingJoinUrl = (origin: string, activityCode: string) =>
  `${origin.replace(/\/$/, "")}/speak/join/${encodeURIComponent(activityCode.trim().toUpperCase())}`;

export const modeForRoute = (routePath: string): AppMode =>
  routePath === "/character-lab"
    ? "characterLab"
    : routePath === "/speak" || routePath.startsWith("/speak/")
      ? "speaking"
    : routePath.startsWith("/tournament-study/")
      ? "tournamentStudy"
    : routePath === "/quiz-strike/teacher" || routePath.startsWith("/quiz-strike/teacher/")
      ? "teacher"
    : routePath === "/join" || routePath === "/game"
      ? "student"
      : routePath === "/quiz-strike" || routePath.startsWith("/quiz-strike/")
        ? "quizStrike"
        : "home";
