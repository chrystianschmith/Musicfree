import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/globals.css";
import App from "./App";
import { initStreamBridge } from "./lib/stream";
import { forwardConsoleToLog } from "./lib/logging";
import { initDesktop, platformClass } from "./app/desktop";

const isMini = location.hash.startsWith("#/mini");
void forwardConsoleToLog();
if (isMini) {
  // The mini player window only mirrors the main window; it owns no player or streams.
  document.documentElement.classList.add(platformClass(navigator.userAgent), "mini");
} else {
  void initStreamBridge();
  void initDesktop();
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
