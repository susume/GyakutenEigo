import { createRoot, hydrateRoot } from "react-dom/client";
import SiteApp from "./SiteApp";
import "./styles/core.css";
import "./styles/join.css";
import "./styles/site-theme.css";

const root = document.getElementById("root")!;
if (root.hasAttribute("data-prerendered")) {
  hydrateRoot(root, <SiteApp />);
} else {
  createRoot(root).render(<SiteApp />);
}
