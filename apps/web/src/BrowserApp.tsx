import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { isSpeakingTeacherRoute, normalizeRoutePath } from "./navigation";

const QuizStrikeApp = lazy(() => import("./QuizStrikeAppEntry"));
const NetworkDiagnosticsPage = lazy(() => import("./features/quizstrike/NetworkDiagnosticsPage"));
const SpeakingPracticeApp = lazy(() => import("./features/speaking/SpeakingPracticeApp"));
const ProductHubPage = lazy(() => import("./ui/ProductHubPage"));
const StudentJoinScreen = lazy(() => import("./features/quizstrike/student/StudentJoinScreen"));
const ModernizationLab = import.meta.env.DEV ? lazy(() => import("./game/ModernizationLab")) : null;
const AthleticsCourseLab = import.meta.env.DEV ? lazy(() => import("./game/AthleticsCourseLab")) : null;

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

  if (pathname === "/join") return <Suspense fallback={<section className="app-loading-screen" role="status"><p>Opening QuizStrike join…</p></section>}><StudentJoinScreen onJoined={openGame} /></Suspense>;
  if (pathname === "/") return <Suspense fallback={<section className="app-loading-screen" role="status"><p>Loading GyakutenEigo…</p></section>}><ProductHubPage /></Suspense>;
  if (pathname === "/modernization-lab" && ModernizationLab) return <Suspense fallback={loadingFallback}><ModernizationLab /></Suspense>;
  if (pathname === "/athletics-lab" && AthleticsCourseLab) return <Suspense fallback={loadingFallback}><AthleticsCourseLab /></Suspense>;
  if (isSpeakingTeacherRoute(pathname)) {
    return <Suspense fallback={<section className="app-loading-screen" aria-live="polite"><div className="panel form-panel"><p>Loading teacher workspace…</p></div></section>}><QuizStrikeApp /></Suspense>;
  }
  if (pathname === "/speak" || pathname.startsWith("/speak/")) {
    return <Suspense fallback={<section className="app-loading-screen" aria-live="polite"><div className="panel form-panel"><p>Loading Speaking Practice…</p></div></section>}><SpeakingPracticeApp /></Suspense>;
  }
  if (pathname === "/check" || pathname === "/diagnostics") {
    return <Suspense fallback={loadingFallback}><NetworkDiagnosticsPage /></Suspense>;
  }

  return <Suspense fallback={loadingFallback}><QuizStrikeApp /></Suspense>;
}
