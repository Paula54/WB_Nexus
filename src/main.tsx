import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Cache-bust: ensures browsers/CDN request a fresh CSS module when config changes.
import "./index.css?v=2";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
