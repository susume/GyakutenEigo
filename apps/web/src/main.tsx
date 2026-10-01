import React from "react";
import { createRoot } from "react-dom/client";
import BrowserApp from "./BrowserApp";
import "./styles/core.css";
import "./styles/join.css";
import "./styles/site-theme.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="ge-site"><BrowserApp /></div>
  </React.StrictMode>
);
