import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import StudentJoinScreen from "./features/quizstrike/student/StudentJoinScreen";
import { normalizeRoutePath } from "./navigation";

const QuizStrikeApp = lazy(() => import("./QuizStrikeAppEntry"));

const loadingFallback = (
  <section className="app-loading-screen" aria-live="polite">
    <div className="panel form-panel"><p>Loading QuizStrike…</p></div>
  </section>
);

export default function BrowserApp() {
  const [pathname, setPathname] = useState(() => normalizeRoutePath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setPathname(normalizeRoutePath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const openGame = useCallback(({ replace = false }: { replace?: boolean } = {}) => {
    window.history[replace ? "replaceState" : "pushState"]({}, "", "/game");
    setPathname("/game");
  }, []);

  if (pathname === "/join") return <StudentJoinScreen onJoined={openGame} />;

  return <Suspense fallback={loadingFallback}><QuizStrikeApp /></Suspense>;
}
