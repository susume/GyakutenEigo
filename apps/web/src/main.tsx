import React from "react";
import { createRoot } from "react-dom/client";
import BrowserApp from "./BrowserApp";
import { SiteLanguageProvider } from "./ui/SiteLanguageProvider";
import "./styles/core.css";
import "./styles/join.css";
import "./styles/site-theme.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SiteLanguageProvider><div className="ge-site"><BrowserApp /></div></SiteLanguageProvider>
  </React.StrictMode>
);
