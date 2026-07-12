export type AppMode = "home" | "quizStrike" | "teacher" | "student" | "characterLab";

export const normalizeRoutePath = (path: string) => (path === "/" ? path : path.replace(/\/$/, ""));

export const getJoinCodeFromSearch = (search: string) =>
  new URLSearchParams(search).get("code")?.trim().toUpperCase() ?? "";

export const buildStudentJoinUrl = (origin: string, sessionCode: string) =>
  `${origin.replace(/\/$/, "")}/join?code=${encodeURIComponent(sessionCode.trim().toUpperCase())}`;

export const modeForRoute = (routePath: string): AppMode =>
  routePath === "/character-lab"
    ? "characterLab"
    : routePath === "/join" || routePath === "/game"
      ? "student"
      : routePath === "/quiz-strike"
        ? "quizStrike"
        : "home";
