import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { applyTheme, resolveInitialTheme } from "./lib/theme";
import { applyDensity, resolveInitialDensity } from "./lib/density";

// Apply the theme/density before first paint to avoid a flash of the wrong state.
applyTheme(resolveInitialTheme());
applyDensity(resolveInitialDensity());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
