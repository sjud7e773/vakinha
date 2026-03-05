import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import {
  getCloakDecision,
  getCloakRedirectUrl,
  setCloakDecisionResult,
  isAllowlistedBrowser,
} from "@/lib/donation-security";

async function runCloakFlow(): Promise<void> {
  if (typeof window === "undefined" || !document.getElementById("root")) return;

  if (isAllowlistedBrowser()) {
    setCloakDecisionResult("full");
    runApp();
    return;
  }

  const result = await getCloakDecision({
    onDecisionLog(log) {
      if (import.meta.env.DEV && typeof console !== "undefined") {
        console.debug("[cloak]", log.reason, { humanScore: log.humanScore, botScore: log.botScore });
      }
    },
  });

  if (result.action === "redirect") {
    window.location.replace(getCloakRedirectUrl());
    return;
  }

  setCloakDecisionResult(result.action);
  runApp();
}

function runApp(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  window.addEventListener(
    "contextmenu",
    (e) => e.preventDefault(),
    { capture: true }
  );

  window.addEventListener(
    "keydown",
    (e) => {
      const key = e.key.toUpperCase();
      const isDevTools =
        key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "C", "J"].includes(key)) ||
        (e.ctrlKey && key === "U");
      if (isDevTools) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true }
  );

  const root = document.getElementById("root");
  if (root) createRoot(root).render(<App />);
}

runCloakFlow();
