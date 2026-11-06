import { useSiteTranslation } from "./siteTranslation";
import ProductHubHeader from "./ProductHubHeader";
import ProductHubHomepage from "./ProductHubHomepage";

export default function ProductHubPage() {
  const { t } = useSiteTranslation();
  const navigate = (path: string) => {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo(0, 0);
  };

  return <main id="main-content" className="app-shell" tabIndex={-1}>
    <a className="hub-skip-link" href="#product-hub-title">{t("Skip to main content")}</a>
    <ProductHubHeader onLogin={() => navigate("/quiz-strike/teacher/home")}
      onGetStarted={() => navigate("/quiz-strike/teacher/home?auth=signup")} />
    <ProductHubHomepage onNavigate={navigate} />
  </main>;
}
