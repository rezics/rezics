import { createRoot } from "react-dom/client";
import "./index.css";

import { configureApi } from "@rezics/api/config";
import { env } from "@/env";
import App from "./App";
import { initI18n } from "./providers/i18n";

// import { setupMock } from "./plugin/providers/mock.ts";

// Initialization (this type of side effect can be ingested and is not involved in hot-swap).
configureApi({
  apiBaseUrl: env.VITE_API_URL,
  authBaseUrl: env.VITE_AUTH_API_URL ?? env.VITE_API_URL,
});
initI18n();

const container = document.getElementById("app") as HTMLElement;

// directly create root; Vite/React Refresh will handle HMR gracefully.
const root = createRoot(container);

// setupMock().then(() => {
//   root.render(<App />);
// });

root.render(<App />);

// If you want to prevent duplicate creation in some environments, you can also:
// (globalThis as any).__APP_ROOT ??= createRoot(container);
// (globalThis as any).__APP_ROOT.render(<App />);
