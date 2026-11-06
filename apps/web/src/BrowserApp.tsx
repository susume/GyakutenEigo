import { useSiteTranslation } from "./ui/siteTranslation";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { isSpeakingTeacherRoute, modeForRoute, normalizeRoutePath } from "./navigation";
import { renderPageHead } from "./seo/pageHead";
import { appRoute, defaultTitle, getPublicPage, publicPageMetadata } from "./seo/publicPages";

const QuizStrikeApp = lazy(() => import("./QuizStrikeAppEntry"));
const NetworkDiagnosticsPage = lazy(() => import("./features/quizstrike/NetworkDiagnosticsPage"));
const SpeakingPracticeApp = lazy(() => import("./features/speaking/SpeakingPracticeApp"));
const ProductHubPage = lazy(() => import("./ui/ProductHubPage"));
const AboutPage = lazy(() => import("./ui/AboutPage"));
const PrivateLessonsPage = lazy(() => import("./ui/PrivateLessonsPage"));
const StudentJoinScreen = lazy(() => import("./features/quizstrike/student/StudentJoinScreen"));
const ModernizationLab = import.meta.env.DEV ? lazy(() => import("./game/ModernizationLab")) : null;
const AthleticsCourseLab = import.meta.env.DEV ? lazy(() => import("./game/AthleticsCourseLab")) : null;

export default function BrowserApp({ initialPath }: { initialPath?: string }) {
  const { t } = useSiteTranslation();
  const loadingFallback = (
    <section className="app-loading-screen" aria-live="polite">
      <div className="panel form-panel"><p>{t("Loading QuizStrike…")}</p></div>
    </section>
  );
  const [pathname, setPathname] = useState(() => normalizeRoutePath(initialPath ?? window.location.pathname));
  const route = appRoute(pathname);

  useEffect(() => {
    const page = getPublicPage(pathname);
    if (page) document.title = publicPageMetadata(page).title;
    else if (pathname === "/join") document.title = t("Join QuizStrike · GyakutenEigo");
    else if (modeForRoute(pathname) === "teacher") document.title = t("Teacher Dashboard · GyakutenEigo");
    else if (pathname.startsWith("/quiz-strike/")) document.title = t("QuizStrike · GyakutenEigo");
    else if (pathname.startsWith("/speak/")) document.title = t("Speaking Tasks · GyakutenEigo");
    else document.title = t(defaultTitle);

    document.head.querySelectorAll("[data-page-seo]").forEach((tag) => tag.remove());
    document.head.insertAdjacentHTML("beforeend", renderPageHead(page));
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

  if (route === "/join") return <Suspense fallback={<section className="app-loading-screen" role="status"><p>{t("Opening QuizStrike join…")}</p></section>}><StudentJoinScreen onJoined={openGame} /></Suspense>;
  if (route === "/") return <Suspense fallback={<section className="app-loading-screen" role="status"><p>{t("Loading GyakutenEigo…")}</p></section>}><ProductHubPage /></Suspense>;
  if (route === "/about") return <Suspense fallback={<section className="app-loading-screen" role="status"><p>{t("Loading / 読み込み中…")}</p></section>}><AboutPage /></Suspense>;
  if (route === "/private-lessons") return <Suspense fallback={<section className="app-loading-screen" role="status"><p>{t("Loading / 読み込み中…")}</p></section>}><PrivateLessonsPage /></Suspense>;
  if (route === "/modernization-lab" && ModernizationLab) return <Suspense fallback={loadingFallback}><ModernizationLab /></Suspense>;
  if (route === "/athletics-lab" && AthleticsCourseLab) return <Suspense fallback={loadingFallback}><AthleticsCourseLab /></Suspense>;
  if (isSpeakingTeacherRoute(route)) {
    return <Suspense fallback={<section className="app-loading-screen" aria-live="polite"><div className="panel form-panel"><p>{t("Loading teacher workspace…")}</p></div></section>}><QuizStrikeApp initialPath={route} /></Suspense>;
  }
  if (route === "/speak" || route.startsWith("/speak/")) {
    return <Suspense fallback={<section className="app-loading-screen" aria-live="polite"><div className="panel form-panel"><p>{t("Loading Speaking Practice…")}</p></div></section>}><SpeakingPracticeApp initialPath={route} /></Suspense>;
  }
  if (route === "/check" || route === "/diagnostics") {
    return <Suspense fallback={loadingFallback}><NetworkDiagnosticsPage /></Suspense>;
  }

  return <Suspense fallback={loadingFallback}><QuizStrikeApp initialPath={route} /></Suspense>;
}
