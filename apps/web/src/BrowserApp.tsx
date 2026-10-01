import { useSiteTranslation } from "./ui/siteTranslation";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { isSpeakingTeacherRoute, normalizeRoutePath } from "./navigation";

const QuizStrikeApp = lazy(() => import("./QuizStrikeAppEntry"));
const NetworkDiagnosticsPage = lazy(() => import("./features/quizstrike/NetworkDiagnosticsPage"));
const SpeakingPracticeApp = lazy(() => import("./features/speaking/SpeakingPracticeApp"));
const ProductHubPage = lazy(() => import("./ui/ProductHubPage"));
const AboutPage = lazy(() => import("./ui/AboutPage"));
const StudentJoinScreen = lazy(() => import("./features/quizstrike/student/StudentJoinScreen"));
const ModernizationLab = import.meta.env.DEV ? lazy(() => import("./game/ModernizationLab")) : null;
const AthleticsCourseLab = import.meta.env.DEV ? lazy(() => import("./game/AthleticsCourseLab")) : null;

export default function BrowserApp() {
  const { t } = useSiteTranslation();
  const loadingFallback = (
    <section className="app-loading-screen" aria-live="polite">
      <div className="panel form-panel"><p>{t("Loading QuizStrike…")}</p></div>
    </section>
  );
  const [pathname, setPathname] = useState(() => normalizeRoutePath(window.location.pathname));

  useEffect(() => {
    if (pathname === "/join") document.title = t("Join QuizStrike · GyakutenEigo");
    else if (pathname === "/quiz-strike" || pathname.startsWith("/quiz-strike/competitions/")) document.title = t("QuizStrike · GyakutenEigo");
  }, [pathname, t]);

  useEffect(() => {
    const handlePopState = () => setPathname(normalizeRoutePath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const openGame = useCallback(({ replace = false }: { replace?: boolean } = {}) => {
    window.history[replace ? "replaceState" : "pushState"]({}, "", "/game");
    setPathname("/game");
  }, []);

  if (pathname === "/join") return <Suspense fallback={<section className="app-loading-screen" role="status"><p>{t("Opening QuizStrike join…")}</p></section>}><StudentJoinScreen onJoined={openGame} /></Suspense>;
  if (pathname === "/") return <Suspense fallback={<section className="app-loading-screen" role="status"><p>{t("Loading GyakutenEigo…")}</p></section>}><ProductHubPage /></Suspense>;
  if (pathname === "/about") return <Suspense fallback={<section className="app-loading-screen" role="status"><p>{t("Loading / 読み込み中…")}</p></section>}><AboutPage /></Suspense>;
  if (pathname === "/modernization-lab" && ModernizationLab) return <Suspense fallback={loadingFallback}><ModernizationLab /></Suspense>;
  if (pathname === "/athletics-lab" && AthleticsCourseLab) return <Suspense fallback={loadingFallback}><AthleticsCourseLab /></Suspense>;
  if (isSpeakingTeacherRoute(pathname)) {
    return <Suspense fallback={<section className="app-loading-screen" aria-live="polite"><div className="panel form-panel"><p>{t("Loading teacher workspace…")}</p></div></section>}><QuizStrikeApp /></Suspense>;
  }
  if (pathname === "/speak" || pathname.startsWith("/speak/")) {
    return <Suspense fallback={<section className="app-loading-screen" aria-live="polite"><div className="panel form-panel"><p>{t("Loading Speaking Practice…")}</p></div></section>}><SpeakingPracticeApp /></Suspense>;
  }
  if (pathname === "/check" || pathname === "/diagnostics") {
    return <Suspense fallback={loadingFallback}><NetworkDiagnosticsPage /></Suspense>;
  }

  return <Suspense fallback={loadingFallback}><QuizStrikeApp /></Suspense>;
}
