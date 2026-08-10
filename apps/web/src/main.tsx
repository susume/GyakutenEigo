import React from "react";
import { createRoot } from "react-dom/client";
import BrowserApp from "./BrowserApp";
import "./styles.css";
import "./homepage-game-first.css";
import "./auth-game-first.css";
import "./question-workspace-game-first.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserApp />
  </React.StrictMode>
);
