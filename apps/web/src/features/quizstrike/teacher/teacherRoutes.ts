import { buildTeacherSpeakingPath } from "../../../navigation";

export type TeacherTab =
  | "home"
  | "discover"
  | "library"
  | "detail"
  | "quizzes"
  | "sessions"
  | "reports"
  | "settings"
  | "tournaments"
  | "speaking";

export type TeacherSetupSection = "mode" | "arena" | "advanced";

export type TeacherRouteState = {
  tab: TeacherTab;
  studySetId?: string;
};

const canonicalTeacherPath = (path: string) => {
  const normalized = path === "/" ? path : path.replace(/\/+$/u, "");
  return buildTeacherSpeakingPath(normalized);
};

const decodeRouteSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

export const teacherRouteState = (path: string): TeacherRouteState => {
  const segments = canonicalTeacherPath(path)
    .split("/")
    .filter(Boolean)
    .map(decodeRouteSegment);
  const section = segments[2];

  if (section === "speaking") return { tab: "speaking" };
  if (section === "discover") return { tab: "discover" };
  if (section === "library") return { tab: "library" };
  if (section === "reports") return { tab: "reports" };
  if (section === "settings") return { tab: "settings" };
  if (section === "competitions") return { tab: "tournaments" };
  if (section === "create") return { tab: "quizzes" };
  if (section === "host") return { tab: "sessions", studySetId: segments[3] };
  if (section === "sets" && segments[3]) {
    return {
      tab: segments[4] === "edit" ? "quizzes" : "detail",
      studySetId: segments[3],
    };
  }
  return { tab: "home" };
};

export type TeacherPrimaryTab = Exclude<
  TeacherTab,
  "detail" | "quizzes" | "sessions"
>;

export const teacherTabPath = (tab: TeacherPrimaryTab) => {
  if (tab === "speaking") return teacherSpeakingPath();
  return `/quiz-strike/teacher/${tab === "tournaments" ? "competitions" : tab}`;
};

export const teacherSpeakingPath = (suffix = "") =>
  `/quiz-strike/teacher/speaking${suffix.startsWith("/") ? suffix : suffix ? `/${suffix}` : ""}`;
