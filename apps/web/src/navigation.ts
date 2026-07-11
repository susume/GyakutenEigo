export type AppMode = "home" | "quizStrike" | "teacher" | "student" | "characterLab";

export const normalizeRoutePath = (path: string) => (path === "/" ? path : path.replace(/\/$/, ""));

export const modeForRoute = (routePath: string): AppMode =>
  routePath === "/character-lab"
    ? "characterLab"
    : routePath === "/join" || routePath === "/game"
      ? "student"
      : routePath === "/quiz-strike"
        ? "quizStrike"
        : "home";
