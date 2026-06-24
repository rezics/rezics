import { createRoot } from "react-dom/client";
import "./index.css";

import { configureApi } from "@rezics/contract/api/config";
import { env } from "@/env";
import { App } from "./App";
import { initI18n } from "./providers/i18n";

// import { setupMock } from "./plugin/providers/mock.ts";

// Initialization (this type of side effect can be ingested and is not involved in hot-swap).
// 初始化（这类副作用可被纳入，不参与热替换）。
configureApi({
  apiBaseUrl: env.VITE_API_URL,
  authBaseUrl: env.VITE_API_URL,
  reactionServiceUrl: env.VITE_REACTION_SERVICE_URL,
  notifyBaseUrl: env.VITE_NOTIFY_BASE_URL,
});
initI18n();

const container = document.getElementById("app") as HTMLElement;

// directly create root; Vite/React Refresh will handle HMR gracefully.
// 直接创建 root；Vite/React Refresh 会优雅地处理 HMR。
const root = createRoot(container);

// setupMock().then(() => {
//   root.render(<App />);
// });

root.render(<App />);

// If you want to prevent duplicate creation in some environments, you can also:
// 如果想在某些环境中防止重复创建，也可以这样：
// (globalThis as any).__APP_ROOT ??= createRoot(container);
// (globalThis as any).__APP_ROOT.render(<App />);
