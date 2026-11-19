import { createRoot, hydrateRoot } from "react-dom/client";
import SiteApp from "./SiteApp";
import { getPublicPage, publicPagePath } from "./seo/publicPages";
import "./styles/core.css";
import "./styles/join.css";
import "./styles/site-theme.css";

const root = document.getElementById("root")!;
const page = getPublicPage(window.location.pathname);
const pagePath = page && publicPagePath(page.route, page.language);
if (page && pagePath === root.dataset.prerendered) {
  hydrateRoot(root, <SiteApp initialPath={pagePath} initialLanguage={page.language} />);
} else {
  // A static host's SPA fallback can return the pre-rendered home page for a
  // classroom link. Start the classroom on a clean app shell in that case.
  if (root.hasAttribute("data-prerendered")) {
    root.replaceChildren();
    delete document.body.dataset.site;
    delete document.body.dataset.speaking;
  }
  createRoot(root).render(<SiteApp />);
}
