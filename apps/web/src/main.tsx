import React from "react";
import { createRoot } from "react-dom/client";
import BrowserApp from "./BrowserApp";
import "./styles/core.css";
import "./styles/join.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserApp />
  </React.StrictMode>
);
